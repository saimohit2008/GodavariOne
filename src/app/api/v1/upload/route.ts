import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { getStorage, UPLOAD_LIMITS } from "@/lib/storage";

// POST /api/v1/upload
// Accepts multipart/form-data with "file", "image", or "files"
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN" && ctx.user.role !== "ADMIN") {
    return fail("Insufficient permissions. Super Admin required.", 403);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data", 400);

  const file = form.get("file") || form.get("image") || form.getAll("files")[0];
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

  await audit({
    actorId: ctx.user.id,
    action: "HOMEPAGE_IMAGE_UPLOAD",
    targetType: "HOMEPAGE_CONTENT",
    details: {
      filename: saved.filename,
      sizeBytes: saved.sizeBytes,
      mimeType: saved.mimeType,
      url: saved.url,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    url: saved.url,
    filename: saved.filename,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
  });
});

// GET /api/v1/upload
// Returns list of locally available image files for quick selection
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions. Super Admin required.", 403);
  }

  const results: Array<{ url: string; name: string }> = [];

  // 1. Curated images in public/images
  try {
    const imagesDir = path.join(process.cwd(), "public", "images");
    const imageFiles = await fs.readdir(imagesDir).catch(() => []);
    for (const f of imageFiles) {
      if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f)) {
        results.push({
          url: `/images/${f}`,
          name: f,
        });
      }
    }
  } catch {}

  // 2. Uploaded images from active storage provider (local or Supabase)
  try {
    const storage = getStorage();
    if (storage.listFiles) {
      const storedFiles = await storage.listFiles();
      for (const item of storedFiles) {
        if (!results.some((r) => r.url === item.url)) {
          results.push(item);
        }
      }
    }
  } catch {}

  return ok({ images: results });
});

// DELETE /api/v1/upload
// Permanent deletion of an uploaded file with safety and reference checks
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

  // Prevent path traversal
  if (!imageUrl.startsWith("/uploads/") && !imageUrl.startsWith("/images/")) {
    return fail("Deletion denied: File is outside the managed image directory.", 400);
  }

  const normalized = path.normalize(imageUrl).replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("//")) {
    return fail("Invalid file path.", 400);
  }

  const filename = path.basename(imageUrl);
  if (filename === "logo.svg" || filename === "robots.txt") {
    return fail("Protected system file cannot be deleted.", 403);
  }

  // Import usages check dynamically or directly
  const { getImageUsages } = await import("@/app/api/v1/homepage-content/hero-images/route");
  const usages = await getImageUsages(imageUrl);
  if (usages.length > 0) {
    const usageLabels = usages.map((u) => u.title).join(", ");
    return fail(
      `Cannot permanently delete: Image is currently active or referenced in: ${usageLabels}. Please replace or detach these references first.`,
      409,
      { usages }
    );
  }

  const relPath = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
  const absPath = path.join(process.cwd(), "public", relPath);
  const publicDir = path.join(process.cwd(), "public");

  if (!absPath.startsWith(path.join(publicDir, "uploads")) && !absPath.startsWith(path.join(publicDir, "images"))) {
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
    }
  }

  // Also remove from active storage adapter (handles Supabase Cloud Storage or fallback)
  try {
    const storage = getStorage();
    await storage.delete(imageUrl);
    fileExisted = true;
  } catch (err: any) {
    console.warn("[Storage delete warning]", err.message);
  }

  await audit({
    actorId: ctx.user.id,
    action: "IMAGE_PERMANENT_DELETE",
    targetType: "IMAGE_LIBRARY",
    targetId: filename,
    details: { url: imageUrl, fileExisted },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    message: "Image permanently removed from local storage.",
    deletedUrl: imageUrl,
    filename,
  });
});
