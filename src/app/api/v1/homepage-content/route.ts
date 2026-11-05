import { NextRequest } from "next/server";
import { z } from "zod";
import { db, isPostgresDatabase } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";

function isValidDestinationUrl(url?: string | null): boolean {
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

function isValidImageUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/images/")) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const createItemSchema = z.object({
  section: z.string().trim().min(1, "Section is required"),
  title: z.string().trim().min(1, "Title is required").max(160, "Title cannot exceed 160 characters"),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  buttonText: z.string().trim().max(50, "Button text cannot exceed 50 characters").optional().nullable(),
  imageUrl: z.string().trim().optional().nullable().refine(isValidImageUrl, {
    message: "Image must be an uploaded image path (/uploads/... or /images/...) or secure http(s) URL",
  }),
  destinationUrl: z.string().trim().max(500).optional().nullable().refine(isValidDestinationUrl, {
    message: "Destination must be a relative path (e.g. /directory) or valid http(s) URL",
  }),
  listingId: z.string().trim().optional().nullable(),
  badgeText: z.string().trim().max(50).optional().nullable(),
  orderIdx: z.number().int().optional(),
  isEnabled: z.boolean().default(true),
  status: z.enum(["PUBLISHED", "DRAFT"]).default("PUBLISHED"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).or(z.string()).optional().nullable(),
});

// GET /api/v1/homepage-content
// Public: returns active, enabled sections and published active items
// Super Admin (?all=true): returns all sections & all items
export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get("all") === "true";
  const filterSection = searchParams.get("section");

  if (showAll) {
    const ctx = await getCurrentUser(req);
    if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
      return fail("Insufficient permissions to view all homepage content", 403);
    }

    const sections = await db.homepageSection.findMany({
      where: { id: { not: "footer_contact" } },
      orderBy: { orderIdx: "asc" },
    });

    const whereClause: any = {};
    if (filterSection) {
      whereClause.section = filterSection.toUpperCase();
    }

    const items = await db.homepageContentItem.findMany({
      where: whereClause,
      orderBy: [{ section: "asc" }, { orderIdx: "asc" }, { createdAt: "asc" }],
      include: {
        listing: {
          select: {
            id: true,
            name: true,
            category: true,
            town: true,
            district: true,
            publicationStatus: true,
            images: { take: 1, select: { url: true } },
          },
        },
        createdBy: { select: { id: true, name: true, phone: true } },
        lastEditedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    const now = new Date();
    const enrichedItems = items.map((item) => {
      let timingState: "ACTIVE" | "SCHEDULED" | "EXPIRED" = "ACTIVE";
      if (item.startDate && new Date(item.startDate) > now) {
        timingState = "SCHEDULED";
      } else if (item.endDate && new Date(item.endDate) < now) {
        timingState = "EXPIRED";
      }

      return {
        ...item,
        timingState,
        isPubliclyVisible: item.isEnabled && item.status === "PUBLISHED" && timingState === "ACTIVE",
      };
    });

    return ok({
      sections,
      items: enrichedItems,
      total: enrichedItems.length,
    });
  }

  // Public visitor mode
  const now = new Date();
  const whereClause: any = {
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
  };

  if (filterSection) {
    whereClause.section = filterSection.toUpperCase();
  }

  const isPg = isPostgresDatabase();
  const itemQueryOptions: any = {
    where: whereClause,
    orderBy: [{ section: "asc" }, { orderIdx: "asc" }, { createdAt: "asc" }],
    include: {
      listing: {
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          town: true,
          district: true,
          publicationStatus: true,
          images: { take: 1, select: { url: true } },
        },
      },
    },
  };

  const [sections, items] = await Promise.all([
    db.homepageSection.findMany({
      where: { isEnabled: true, id: { not: "footer_contact" } },
      orderBy: { orderIdx: "asc" },
    }),
    db.homepageContentItem.findMany(itemQueryOptions) as Promise<any[]>,
  ]);

  // Filter out any items linking to unpublished/deleted listings if required
  const safeItems = items.map((item) => {
    // If listing was deleted or unpublished, we gracefully keep the item but nullify the invalid listing reference
    const safeListing = item.listing && item.listing.publicationStatus === "PUBLISHED" ? item.listing : null;
    return {
      ...item,
      listing: safeListing,
    };
  });

  return ok({
    sections,
    items: safeItems,
    total: safeItems.length,
  });
});

// POST /api/v1/homepage-content
// Create a new homepage content item (Super Admin only)
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions to create homepage content", 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues);
  }

  const data = parsed.data;
  const section = data.section.toUpperCase();

  // If listingId is provided, verify it exists
  if (data.listingId) {
    const listing = await db.listing.findUnique({
      where: { id: data.listingId },
      select: { id: true, name: true, category: true },
    });
    if (!listing) {
      return fail(`Listing with id "${data.listingId}" does not exist`, 422);
    }
  }

  // Calculate orderIdx if not provided
  let orderIdx = data.orderIdx;
  if (orderIdx === undefined) {
    const highest = await db.homepageContentItem.findFirst({
      where: { section },
      orderBy: { orderIdx: "desc" },
      select: { orderIdx: true },
    });
    orderIdx = (highest?.orderIdx ?? -1) + 1;
  }

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  if (data.startDate) {
    const d = new Date(data.startDate);
    if (!isNaN(d.getTime())) startDate = d;
  }
  if (data.endDate) {
    const d = new Date(data.endDate);
    if (!isNaN(d.getTime())) endDate = d;
  }

  if (startDate && endDate && startDate > endDate) {
    return fail("Start date must be before end date", 422);
  }

  const metadataStr = typeof data.metadata === "object" && data.metadata !== null
    ? JSON.stringify(data.metadata)
    : typeof data.metadata === "string"
    ? data.metadata
    : null;

  const item = await db.homepageContentItem.create({
    data: {
      section,
      title: data.title,
      description: data.description || null,
      buttonText: data.buttonText || null,
      imageUrl: data.imageUrl || null,
      destinationUrl: data.destinationUrl || null,
      listingId: data.listingId || null,
      badgeText: data.badgeText || null,
      orderIdx,
      isEnabled: data.isEnabled ?? true,
      status: data.status ?? "PUBLISHED",
      startDate,
      endDate,
      metadata: metadataStr,
      createdById: ctx.user.id,
      lastEditedById: ctx.user.id,
    },
    include: {
      listing: {
        select: { id: true, name: true, category: true },
      },
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "HOMEPAGE_CONTENT_CREATE",
    targetType: "HOMEPAGE_CONTENT_ITEM",
    targetId: item.id,
    details: {
      section: item.section,
      title: item.title,
      orderIdx: item.orderIdx,
      status: item.status,
      isEnabled: item.isEnabled,
    },
    ip: getClientIp(req),
  });

  return created(item);
});
