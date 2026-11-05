import { NextRequest } from "next/server";
import { z } from "zod";
import { db, isPostgresDatabase } from "@/lib/db";
import { getCurrentUser, requireAdmin, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";

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

const carouselBannerSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Title cannot exceed 120 characters"),
  subtitle: z.string().trim().max(200, "Subtitle cannot exceed 200 characters").optional().nullable(),
  description: z.string().trim().max(3000, "Description cannot exceed 3000 characters").optional().nullable(),
  imageUrl: z.string().trim().min(1, "Image URL is required").refine(isValidBannerImageUrl, {
    message: "Image must be an uploaded image path (/uploads/...) or secure http(s) URL",
  }),
  destinationUrl: z.string().trim().max(500).optional().nullable().refine(isValidBannerDestinationUrl, {
    message: "Destination must be a relative path (e.g. /) or valid http(s) URL",
  }),
  orderIdx: z.number().int().optional(),
  isEnabled: z.boolean().default(true),
  status: z.enum(["PUBLISHED", "DRAFT"]).default("PUBLISHED"),
  contentType: z.enum([
    "ADVERTISEMENT",
    "EVENT",
    "ANNOUNCEMENT",
    "TOURIST_ATTRACTION",
    "HOTEL",
    "RESTAURANT",
    "NRI_INFORMATION",
    "GENERAL_PROMOTION",
  ]).default("GENERAL_PROMOTION"),
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
  ]).default("EXTERNAL_URL"),
  listingId: z.string().trim().optional().nullable(),
  slug: z.string().trim().max(150).optional().nullable(),
  startDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
});

// GET /api/v1/carousel
// Public: returns active, enabled, published banners
// Super Admin (?all=true): returns all banners including drafts, disabled, scheduled, expired
export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get("all") === "true";

  if (showAll) {
    const ctx = await getCurrentUser(req);
    if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
      return fail("Insufficient permissions to view all carousel banners", 403);
    }

    const banners = await db.carouselBanner.findMany({
      orderBy: [{ orderIdx: "asc" }, { createdAt: "asc" }],
      include: {
        listing: {
          select: { id: true, name: true, category: true, address: true, phone: true },
        },
        createdBy: { select: { id: true, name: true, phone: true } },
        lastEditedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    const now = new Date();
    const enriched = banners.map((b) => {
      let timingState: "ACTIVE" | "SCHEDULED" | "EXPIRED" = "ACTIVE";
      if (b.startDate && new Date(b.startDate) > now) {
        timingState = "SCHEDULED";
      } else if (b.endDate && new Date(b.endDate) < now) {
        timingState = "EXPIRED";
      }
      return {
        ...b,
        timingState,
        isPubliclyVisible: b.isEnabled && b.status === "PUBLISHED" && timingState === "ACTIVE",
      };
    });

    return ok({ items: enriched, total: enriched.length });
  }

  // Public: filter by enabled, published, and currently active in IST / UTC time
  const now = new Date();
  const isPg = isPostgresDatabase();
  const bannerQueryOptions: any = {
    where: {
      isEnabled: true,
      status: "PUBLISHED",
      AND: [
        {
          OR: [
            { startDate: null },
            { startDate: { lte: now } },
          ],
        },
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    },
    orderBy: [{ orderIdx: "asc" }, { createdAt: "asc" }],
    include: {
      listing: {
        select: { id: true, name: true, category: true, address: true, phone: true },
      },
    },
  };

  const banners = await db.carouselBanner.findMany(bannerQueryOptions);

  return ok({ items: banners, count: banners.length });
});

// POST /api/v1/carousel
// Super Admin only: Create a new carousel banner / advertisement
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = carouselBannerSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  const data = parsed.data;

  // Conditional validation: Advertisements should provide advertiser name
  if (data.contentType === "ADVERTISEMENT" && (!data.advertiserName || !data.advertiserName.trim())) {
    return fail("Validation failed: Advertiser or organization name is required for commercial advertisements", 422);
  }

  // If destinationType is DIRECTORY_LISTING and listingId is given, verify listing exists
  let destinationUrl = data.destinationUrl || null;
  if (data.destinationType === "DIRECTORY_LISTING") {
    if (data.listingId) {
      const listing = await db.listing.findUnique({ where: { id: data.listingId } });
      if (!listing) {
        return fail("Validation failed: The selected directory listing does not exist", 422);
      }
      destinationUrl = `/directory?q=${encodeURIComponent(listing.name)}`;
    }
  } else if (data.destinationType === "NRI_SECTION") {
    destinationUrl = "/nri-access";
  }

  // Determine orderIdx if not specified
  let orderIdx = data.orderIdx;
  if (orderIdx === undefined) {
    const highest = await db.carouselBanner.findFirst({
      orderBy: { orderIdx: "desc" },
      select: { orderIdx: true },
    });
    orderIdx = (highest?.orderIdx ?? -1) + 1;
  }

  // Parse start / end dates if provided
  let startDate: Date | null = null;
  if (data.startDate) {
    const d = new Date(data.startDate);
    if (!isNaN(d.getTime())) startDate = d;
  }

  let endDate: Date | null = null;
  if (data.endDate) {
    const d = new Date(data.endDate);
    if (!isNaN(d.getTime())) endDate = d;
  }

  if (startDate && endDate && startDate > endDate) {
    return fail("Start date must be before end date", 422);
  }

  // Default CTA Label based on content type if not provided
  let ctaLabel = data.ctaLabel?.trim();
  if (!ctaLabel) {
    if (data.contentType === "ADVERTISEMENT") ctaLabel = "Learn More";
    else if (data.contentType === "HOTEL" || data.contentType === "RESTAURANT") ctaLabel = "Book Now";
    else if (data.contentType === "NRI_INFORMATION") ctaLabel = "Explore Packages";
    else if (data.contentType === "EVENT") ctaLabel = "View Schedule";
    else ctaLabel = "Explore Details";
  }

  const banner = await db.carouselBanner.create({
    data: {
      title: data.title,
      subtitle: data.subtitle || null,
      description: data.description || null,
      imageUrl: data.imageUrl,
      destinationUrl,
      orderIdx,
      isEnabled: data.isEnabled ?? true,
      status: data.status ?? "PUBLISHED",
      contentType: data.contentType ?? "GENERAL_PROMOTION",
      advertiserName: data.advertiserName || null,
      contactPhone: data.contactPhone || null,
      contactEmail: data.contactEmail || null,
      location: data.location || null,
      websiteUrl: data.websiteUrl || null,
      ctaLabel,
      destinationType: data.destinationType ?? "EXTERNAL_URL",
      listingId: data.listingId || null,
      slug: data.slug || null,
      startDate,
      endDate,
      createdById: ctx.user.id,
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
    action: "CAROUSEL_BANNER_CREATE",
    targetType: "CAROUSEL_BANNER",
    targetId: banner.id,
    details: {
      title: banner.title,
      contentType: banner.contentType,
      orderIdx: banner.orderIdx,
      status: banner.status,
      isEnabled: banner.isEnabled,
    },
    ip: getClientIp(req),
  });

  return created(banner);
});
