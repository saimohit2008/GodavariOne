import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { getStorage, UPLOAD_LIMITS } from "@/lib/storage";

// Helper: Inspect where an image URL is currently referenced across the application
export async function getImageUsages(imageUrl: string) {
  const usages: Array<{ type: string; title: string; id?: string }> = [];

  // 1. Check Hero Section
  const heroSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
  if (heroSection?.settings) {
    try {
      const hero = JSON.parse(heroSection.settings);
      if (hero.statueImageUrl === imageUrl) {
        usages.push({
          type: "HERO",
          title: `Homepage Hero Statue (${hero.showStatue ? "Active" : "Hidden"})`,
          id: "hero",
        });
      }
    } catch {}
  }

  // 2. Check Carousel Banners
  const banners = await db.carouselBanner.findMany({
    where: { imageUrl },
    select: { id: true, title: true },
  });
  for (const b of banners) {
    usages.push({
      type: "CAROUSEL",
      title: `Carousel Banner: "${b.title}"`,
      id: b.id,
    });
  }

  // 3. Check Homepage Content Items
  const items = await db.homepageContentItem.findMany({
    where: { imageUrl },
    select: { id: true, title: true, section: true },
  });
  for (const item of items) {
    usages.push({
      type: "HOMEPAGE_ITEM",
      title: `${item.section}: "${item.title}"`,
      id: item.id,
    });
  }

  // 4. Check Listing Images
  const listings = await db.listingImage.findMany({
    where: { url: imageUrl },
    include: { listing: { select: { id: true, name: true, category: true } } },
  });
  for (const li of listings) {
    usages.push({
      type: "LISTING",
      title: `Listing "${li.listing.name}" (${li.listing.category})`,
      id: li.listing.id,
    });
  }

  return usages;
}

// GET /api/v1/homepage-content/hero-images
// Returns every existing image available to the hero section with detailed metadata, status, and usages
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions. Super Admin required.", 403);
  }

  // Read current hero settings
  const heroSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
  let heroSettings: any = {};
  if (heroSection?.settings) {
    try {
      heroSettings = JSON.parse(heroSection.settings);
    } catch {
      heroSettings = {};
    }
  }

  const activeStatueUrl = heroSettings.statueImageUrl || "/images/godavari-devi.png";
  const isHeroStatueVisible = heroSettings.showStatue ?? true;
  const hiddenImages: string[] = Array.isArray(heroSettings.hiddenImages) ? heroSettings.hiddenImages : [];

  // Parallel lookup of all active references across the platform
  const [allBanners, allHomepageItems, allListingImages] = await Promise.all([
    db.carouselBanner.findMany({ select: { id: true, title: true, imageUrl: true } }),
    db.homepageContentItem.findMany({ select: { id: true, title: true, imageUrl: true, section: true } }),
    db.listingImage.findMany({ select: { id: true, url: true, listing: { select: { id: true, name: true, category: true } } } }),
  ]);

  const rawImages: Array<{
    url: string;
    filename: string;
    sizeBytes: number;
    mtime: string;
    isSystem: boolean;
  }> = [];

  // 1. Scan public/images
  try {
    const imagesDir = path.join(process.cwd(), "public", "images");
    const imageFiles = await fs.readdir(imagesDir).catch(() => []);
    for (const f of imageFiles) {
      if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f)) {
        const filePath = path.join(imagesDir, f);
        const stats = await fs.stat(filePath).catch(() => null);
        rawImages.push({
          url: `/images/${f}`,
          filename: f,
          sizeBytes: stats ? stats.size : 0,
          mtime: stats ? stats.mtime.toISOString() : new Date().toISOString(),
          isSystem: false,
        });
      }
    }
  } catch {}

  // 2. Scan public/uploads
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const uploadFiles = await fs.readdir(uploadsDir).catch(() => []);
    for (const f of uploadFiles) {
      if (/\.(png|jpg|jpeg|webp|gif)$/i.test(f)) {
        const filePath = path.join(uploadsDir, f);
        const stats = await fs.stat(filePath).catch(() => null);
        rawImages.push({
          url: `/uploads/${f}`,
          filename: f,
          sizeBytes: stats ? stats.size : 0,
          mtime: stats ? stats.mtime.toISOString() : new Date().toISOString(),
          isSystem: false,
        });
      }
    }
  } catch {}

  // Construct image items with usage and status
  const images = rawImages.map((img) => {
    const usages: Array<{ type: string; title: string; id?: string }> = [];

    // Is it the hero statue?
    const isSelectedHero = img.url === activeStatueUrl;
    if (isSelectedHero) {
      usages.push({
        type: "HERO",
        title: `Homepage Hero Statue (${isHeroStatueVisible ? "Active" : "Hidden"})`,
        id: "hero",
      });
    }

    // Carousel banners
    for (const b of allBanners) {
      if (b.imageUrl === img.url) {
        usages.push({
          type: "CAROUSEL",
          title: `Carousel Banner: "${b.title}"`,
          id: b.id,
        });
      }
    }

    // Homepage items
    for (const item of allHomepageItems) {
      if (item.imageUrl === img.url) {
        usages.push({
          type: "HOMEPAGE_ITEM",
          title: `${item.section}: "${item.title}"`,
          id: item.id,
        });
      }
    }

    // Listing images
    for (const li of allListingImages) {
      if (li.url === img.url) {
        usages.push({
          type: "LISTING",
          title: `Listing "${li.listing.name}" (${li.listing.category})`,
          id: li.listing.id,
        });
      }
    }

    // Determine status
    let status: "ACTIVE" | "SELECTED" | "UNPUBLISHED" | "UNUSED" = "UNUSED";
    const isExplicitlyHidden = hiddenImages.includes(img.url);

    if (isSelectedHero) {
      if (isHeroStatueVisible && !isExplicitlyHidden) {
        status = "ACTIVE";
      } else {
        status = "UNPUBLISHED";
      }
    } else if (isExplicitlyHidden) {
      status = "UNPUBLISHED";
    } else if (usages.length > 0) {
      status = "SELECTED";
    } else {
      status = "UNUSED";
    }

    const isProtected = isSelectedHero || usages.length > 0;

    return {
      ...img,
      status,
      isSelectedHero,
      isExplicitlyHidden,
      usages,
      isProtected,
      canDelete: !isProtected,
    };
  });

  // Sort: Active Hero first, then other selected, then newest uploaded first
  images.sort((a, b) => {
    if (a.isSelectedHero && !b.isSelectedHero) return -1;
    if (!a.isSelectedHero && b.isSelectedHero) return 1;
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
    return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
  });

  return ok({
    images,
    activeStatueUrl,
    isHeroStatueVisible,
    totalImages: images.length,
  });
});

// POST /api/v1/homepage-content/hero-images
// Handles image upload, select/set-as-hero, unpublish/hide, publish/show, and replace
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions. Super Admin required.", 403);
  }

  const contentType = req.headers.get("content-type") || "";

  // 1. JSON payload actions: "select", "unpublish", "publish"
  if (contentType.includes("application/json")) {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid JSON payload", 400);
    }

    const { action, imageUrl } = body;
    if (!imageUrl || typeof imageUrl !== "string") {
      return fail("Missing required 'imageUrl' parameter.", 400);
    }

    const heroSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
    let heroSettings: any = {};
    if (heroSection?.settings) {
      try {
        heroSettings = JSON.parse(heroSection.settings);
      } catch {
        heroSettings = {};
      }
    }

    let hiddenImages: string[] = Array.isArray(heroSettings.hiddenImages) ? heroSettings.hiddenImages : [];

    if (action === "select" || action === "set_hero") {
      // Set image as active hero statue
      heroSettings.statueImageUrl = imageUrl;
      heroSettings.showStatue = true;
      hiddenImages = hiddenImages.filter((u) => u !== imageUrl);
      heroSettings.hiddenImages = hiddenImages;

      await db.homepageSection.update({
        where: { id: "hero" },
        data: {
          settings: JSON.stringify(heroSettings),
          lastEditedById: ctx.user.id,
        },
      });

      await audit({
        actorId: ctx.user.id,
        action: "HERO_IMAGE_SELECT",
        targetType: "HOMEPAGE_SECTION",
        targetId: "hero",
        details: { statueImageUrl: imageUrl },
        ip: getClientIp(req),
      });

      return ok({
        success: true,
        message: "Image set as active Goddess Godavari Hero statue.",
        activeStatueUrl: imageUrl,
        showStatue: true,
      });
    }

    if (action === "unpublish" || action === "hide") {
      // If currently active hero statue, hide it from public display
      if (heroSettings.statueImageUrl === imageUrl) {
        heroSettings.showStatue = false;
      }
      if (!hiddenImages.includes(imageUrl)) {
        hiddenImages.push(imageUrl);
      }
      heroSettings.hiddenImages = hiddenImages;

      await db.homepageSection.update({
        where: { id: "hero" },
        data: {
          settings: JSON.stringify(heroSettings),
          lastEditedById: ctx.user.id,
        },
      });

      await audit({
        actorId: ctx.user.id,
        action: "HERO_IMAGE_UNPUBLISH",
        targetType: "HOMEPAGE_SECTION",
        targetId: "hero",
        details: { imageUrl },
        ip: getClientIp(req),
      });

      return ok({
        success: true,
        message: "Image hidden from public display.",
        imageUrl,
        isHeroStatueVisible: heroSettings.showStatue,
      });
    }

    if (action === "publish" || action === "show") {
      // Unhide and restore image
      hiddenImages = hiddenImages.filter((u) => u !== imageUrl);
      heroSettings.hiddenImages = hiddenImages;
      if (heroSettings.statueImageUrl === imageUrl) {
        heroSettings.showStatue = true;
      }

      await db.homepageSection.update({
        where: { id: "hero" },
        data: {
          settings: JSON.stringify(heroSettings),
          lastEditedById: ctx.user.id,
        },
      });

      await audit({
        actorId: ctx.user.id,
        action: "HERO_IMAGE_PUBLISH",
        targetType: "HOMEPAGE_SECTION",
        targetId: "hero",
        details: { imageUrl },
        ip: getClientIp(req),
      });

      return ok({
        success: true,
        message: "Image published and restored.",
        imageUrl,
        isHeroStatueVisible: heroSettings.showStatue,
      });
    }

    return fail(`Unknown action: ${action}`, 400);
  }

  // 2. Multipart form data actions: upload or replace
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data", 400);

  const file = form.get("file") || form.get("image");
  if (!file || !(file instanceof File)) {
    return fail("No image file provided in form data under 'file'", 400);
  }

  if (!UPLOAD_LIMITS.allowedMime.includes(file.type)) {
    return fail(
      `Unsupported file format: ${file.type}. Allowed formats: JPEG, PNG, WebP, GIF.`,
      400
    );
  }

  if (file.size > UPLOAD_LIMITS.maxFileBytes) {
    return fail(
      `File exceeds maximum size of ${Math.round(UPLOAD_LIMITS.maxFileBytes / (1024 * 1024))}MB`,
      400
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const saved = await storage.save(buf, file.name, file.type);

  const targetImageUrl = form.get("targetImageUrl")?.toString();
  const setAsHero = form.get("setAsHero") === "true";

  const heroSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
  let heroSettings: any = {};
  if (heroSection?.settings) {
    try {
      heroSettings = JSON.parse(heroSection.settings);
    } catch {
      heroSettings = {};
    }
  }

  let updatedHero = false;

  // If replacing an existing image that was the active hero image:
  if (targetImageUrl && heroSettings.statueImageUrl === targetImageUrl) {
    heroSettings.statueImageUrl = saved.url;
    updatedHero = true;
  } else if (setAsHero) {
    heroSettings.statueImageUrl = saved.url;
    heroSettings.showStatue = true;
    updatedHero = true;
  }

  if (updatedHero) {
    await db.homepageSection.update({
      where: { id: "hero" },
      data: {
        settings: JSON.stringify(heroSettings),
        lastEditedById: ctx.user.id,
      },
    });
  }

  await audit({
    actorId: ctx.user.id,
    action: targetImageUrl ? "HERO_IMAGE_REPLACE" : "HERO_IMAGE_UPLOAD",
    targetType: "IMAGE_LIBRARY",
    targetId: saved.filename,
    details: {
      replacedUrl: targetImageUrl || null,
      newUrl: saved.url,
      sizeBytes: saved.sizeBytes,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    url: saved.url,
    filename: saved.filename,
    sizeBytes: saved.sizeBytes,
    mimeType: saved.mimeType,
    isCurrentHero: updatedHero,
    message: targetImageUrl
      ? `Image replaced successfully. New file saved as ${saved.filename}`
      : "New image uploaded to Hero Image Library.",
  });
});

// DELETE /api/v1/homepage-content/hero-images
// Handles permanent deletion of an image from library and disk with reference validation
export const DELETE = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions. Super Admin required.", 403);
  }

  let imageUrl: string | null = null;
  const { searchParams } = new URL(req.url);
  imageUrl = searchParams.get("imageUrl") || searchParams.get("url");

  if (!imageUrl) {
    try {
      const body = await req.json();
      imageUrl = body.imageUrl || body.url;
    } catch {}
  }

  if (!imageUrl || typeof imageUrl !== "string") {
    return fail("Missing required 'imageUrl' parameter.", 400);
  }

  // 1. Path safety and directory traversal prevention
  if (!imageUrl.startsWith("/uploads/") && !imageUrl.startsWith("/images/")) {
    return fail("Deletion denied: File is outside the managed image directory.", 400);
  }

  const normalized = path.normalize(imageUrl).replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("//")) {
    return fail("Invalid file path.", 400);
  }

  // 2. Prevent deleting protected system assets
  const filename = path.basename(imageUrl);
  if (filename === "logo.svg" || filename === "robots.txt") {
    return fail("Protected system file cannot be deleted.", 403);
  }

  // 3. Check usages across Hero section, Carousel, Homepage items, and Listings
  const usages = await getImageUsages(imageUrl);

  // Check if it is currently active as Hero statue
  const heroSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
  let heroSettings: any = {};
  if (heroSection?.settings) {
    try {
      heroSettings = JSON.parse(heroSection.settings);
    } catch {}
  }

  const isCurrentHero = heroSettings.statueImageUrl === imageUrl;
  if (isCurrentHero) {
    return fail(
      `Cannot permanently delete: This image is currently selected as the Goddess Godavari Hero Statue. Please select a replacement image or detach it before deleting.`,
      409,
      { usages }
    );
  }

  if (usages.length > 0) {
    const usageLabels = usages.map((u) => u.title).join(", ");
    return fail(
      `Cannot permanently delete: Image is currently used in: ${usageLabels}. Please remove or replace these references before deleting.`,
      409,
      { usages }
    );
  }

  // 4. Physical file deletion from local storage
  const relPath = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
  const absPath = path.join(process.cwd(), "public", relPath);

  const publicDir = path.join(process.cwd(), "public");
  const uploadsDir = path.join(publicDir, "uploads");
  const imagesDir = path.join(publicDir, "images");

  if (!absPath.startsWith(uploadsDir) && !absPath.startsWith(imagesDir)) {
    return fail("Forbidden: Attempted to delete file outside managed uploads directory.", 403);
  }

  let fileExisted = false;
  try {
    await fs.access(absPath);
    fileExisted = true;
    await fs.unlink(absPath);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error("[Delete error]", err);
      return fail(`Failed to delete stored file: ${err.message}`, 500);
    }
  }

  // 5. Clean up any reference in hiddenImages list in heroSettings
  if (Array.isArray(heroSettings.hiddenImages) && heroSettings.hiddenImages.includes(imageUrl)) {
    heroSettings.hiddenImages = heroSettings.hiddenImages.filter((u: string) => u !== imageUrl);
    await db.homepageSection.update({
      where: { id: "hero" },
      data: {
        settings: JSON.stringify(heroSettings),
        lastEditedById: ctx.user.id,
      },
    });
  }

  // 6. Audit log
  await audit({
    actorId: ctx.user.id,
    action: "HERO_IMAGE_PERMANENT_DELETE",
    targetType: "IMAGE_LIBRARY",
    targetId: filename,
    details: {
      url: imageUrl,
      fileExisted,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    message: "Image permanently removed from library and storage.",
    deletedUrl: imageUrl,
    filename,
  });
});
