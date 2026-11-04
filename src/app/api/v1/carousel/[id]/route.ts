import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

function isValidBannerDestinationUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return true;
  if (/^tel:[0-9+\-\s]+$/i.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidBannerImageUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("/uploads/")) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidHttpUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const updateBannerSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Title cannot exceed 120 characters").optional(),
  subtitle: z.string().trim().max(200, "Subtitle cannot exceed 200 characters").optional().nullable(),
  description: z.string().trim().max(3000, "Description cannot exceed 3000 characters").optional().nullable(),
  imageUrl: z.string().trim().min(1, "Image URL is required").refine(isValidBannerImageUrl, {
    message: "Image must be an uploaded image path (/uploads/...) or secure http(s) URL",
  }).optional(),
  destinationUrl: z.string().trim().max(500).optional().nullable().refine(isValidBannerDestinationUrl, {
    message: "Destination must be a relative path (e.g. /) or valid http(s) URL",
  }),
  orderIdx: z.number().int().optional(),
  isEnabled: z.boolean().optional(),
  status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
  contentType: z.enum([
    "ADVERTISEMENT",
    "EVENT",
    "ANNOUNCEMENT",
    "TOURIST_ATTRACTION",
    "HOTEL",
    "RESTAURANT",
    "NRI_INFORMATION",
    "GENERAL_PROMOTION",
  ]).optional(),
  advertiserName: z.string().trim().max(150, "Advertiser name cannot exceed 150 characters").optional().nullable(),
  contactPhone: z.string().trim().max(50).optional().nullable(),
  contactEmail: z.string().trim().email("Invalid contact email format").optional().nullable().or(z.literal("")).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  websiteUrl: z.string().trim().max(500).optional().nullable().refine(isValidHttpUrl, {
    message: "Website URL must be a valid http(s) URL",
  }),
  ctaLabel: z.string().trim().max(50).optional().nullable(),
  destinationType: z.enum([
    "DIRECTORY_LISTING",
    "NRI_SECTION",
    "INTERNAL_PAGE",
    "EXTERNAL_URL",
  ]).optional(),
  listingId: z.string().trim().optional().nullable(),
  slug: z.string().trim().max(150).optional().nullable(),
  startDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
});

// GET /api/v1/carousel/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const banner = await db.carouselBanner.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true,
          name: true,
          category: true,
          address: true,
          town: true,
          district: true,
          phone: true,
          email: true,
          description: true,
          mapsUrl: true,
          images: { take: 3, select: { url: true, isPrimary: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      lastEditedBy: { select: { id: true, name: true } },
    },
  });

  if (!banner) return fail("Banner not found", 404);
  return ok(banner);
});

// PATCH /api/v1/carousel/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAdmin();
  const { id } = await params;

  const existing = await db.carouselBanner.findUnique({ where: { id } });
  if (!existing) return fail("Banner not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = updateBannerSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  const data = parsed.data;

  // Conditional validation if updating to advertisement
  const resolvedType = data.contentType || existing.contentType;
  const resolvedAdv = data.advertiserName !== undefined ? data.advertiserName : existing.advertiserName;
  if (resolvedType === "ADVERTISEMENT" && (!resolvedAdv || !resolvedAdv.trim())) {
    return fail("Validation failed: Advertiser or organization name is required for commercial advertisements", 422);
  }

  // Handle destination types
  let destinationUrl = data.destinationUrl !== undefined ? data.destinationUrl : existing.destinationUrl;
  if (data.destinationType === "DIRECTORY_LISTING" && data.listingId) {
    const listing = await db.listing.findUnique({ where: { id: data.listingId } });
    if (!listing) {
      return fail("Validation failed: The selected directory listing does not exist", 422);
    }
    destinationUrl = `/directory?q=${encodeURIComponent(listing.name)}`;
  } else if (data.destinationType === "NRI_SECTION") {
    destinationUrl = "/nri-access";
  }

  let startDate = existing.startDate;
  if ("startDate" in data) {
    if (data.startDate) {
      const d = new Date(data.startDate);
      if (!isNaN(d.getTime())) startDate = d;
      else startDate = null;
    } else {
      startDate = null;
    }
  }

  let endDate = existing.endDate;
  if ("endDate" in data) {
    if (data.endDate) {
      const d = new Date(data.endDate);
      if (!isNaN(d.getTime())) endDate = d;
      else endDate = null;
    } else {
      endDate = null;
    }
  }

  if (startDate && endDate && startDate > endDate) {
    return fail("Start date must be before end date", 422);
  }

  const updated = await db.carouselBanner.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.subtitle !== undefined && { subtitle: data.subtitle || null }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(destinationUrl !== undefined && { destinationUrl }),
      ...(data.orderIdx !== undefined && { orderIdx: data.orderIdx }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.contentType !== undefined && { contentType: data.contentType }),
      ...(data.advertiserName !== undefined && { advertiserName: data.advertiserName || null }),
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone || null }),
      ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl || null }),
      ...(data.ctaLabel !== undefined && { ctaLabel: data.ctaLabel || null }),
      ...(data.destinationType !== undefined && { destinationType: data.destinationType }),
      ...(data.listingId !== undefined && { listingId: data.listingId || null }),
      ...(data.slug !== undefined && { slug: data.slug || null }),
      startDate,
      endDate,
      lastEditedById: ctx.user.id,
    },
    include: {
      listing: {
        select: { id: true, name: true, category: true, address: true, phone: true },
      },
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "CAROUSEL_BANNER_UPDATE",
    targetType: "CAROUSEL_BANNER",
    targetId: id,
    details: {
      changed: Object.keys(data),
      title: updated.title,
    },
    ip: getClientIp(req),
  });

  return ok(updated);
});

// DELETE /api/v1/carousel/[id]
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAdmin();
  const { id } = await params;

  const existing = await db.carouselBanner.findUnique({ where: { id } });
  if (!existing) return fail("Banner not found", 404);

  await db.carouselBanner.delete({ where: { id } });

  await audit({
    actorId: ctx.user.id,
    action: "CAROUSEL_BANNER_DELETE",
    targetType: "CAROUSEL_BANNER",
    targetId: id,
    details: {
      title: existing.title,
      imageUrl: existing.imageUrl,
    },
    ip: getClientIp(req),
  });

  return ok({ success: true, id, message: "Banner deleted successfully" });
});
