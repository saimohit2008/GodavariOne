import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

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

const updateItemSchema = z.object({
  section: z.string().trim().optional(),
  title: z.string().trim().min(1, "Title is required").max(160).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  buttonText: z.string().trim().max(50).optional().nullable(),
  imageUrl: z.string().trim().optional().nullable().refine(isValidImageUrl, {
    message: "Image must be an uploaded image path (/uploads/... or /images/...) or secure http(s) URL",
  }),
  destinationUrl: z.string().trim().max(500).optional().nullable().refine(isValidDestinationUrl, {
    message: "Destination must be a relative path or valid http(s) URL",
  }),
  listingId: z.string().trim().optional().nullable(),
  badgeText: z.string().trim().max(50).optional().nullable(),
  orderIdx: z.number().int().optional(),
  isEnabled: z.boolean().optional(),
  status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).or(z.string()).optional().nullable(),
});

// GET /api/v1/homepage-content/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const item = await db.homepageContentItem.findUnique({
    where: { id },
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

  if (!item) return fail("Homepage content item not found", 404);
  return ok(item);
});

// PATCH /api/v1/homepage-content/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions to update homepage content", 403);
  }

  const { id } = await params;
  const existing = await db.homepageContentItem.findUnique({ where: { id } });
  if (!existing) return fail("Homepage content item not found", 404);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues);
  }

  const data = parsed.data;

  // Validate listingId if supplied
  if (data.listingId !== undefined && data.listingId !== null && data.listingId !== "") {
    const listing = await db.listing.findUnique({
      where: { id: data.listingId },
      select: { id: true },
    });
    if (!listing) {
      return fail(`Listing with id "${data.listingId}" does not exist`, 422);
    }
  }

  const updateData: any = {
    lastEditedById: ctx.user.id,
  };

  if (data.section !== undefined) updateData.section = data.section.toUpperCase();
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.buttonText !== undefined) updateData.buttonText = data.buttonText || null;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null;
  if (data.destinationUrl !== undefined) updateData.destinationUrl = data.destinationUrl || null;
  if (data.listingId !== undefined) updateData.listingId = data.listingId || null;
  if (data.badgeText !== undefined) updateData.badgeText = data.badgeText || null;
  if (data.orderIdx !== undefined) updateData.orderIdx = data.orderIdx;
  if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
  if (data.status !== undefined) updateData.status = data.status;

  if (data.startDate !== undefined) {
    if (!data.startDate) {
      updateData.startDate = null;
    } else {
      const d = new Date(data.startDate);
      if (!isNaN(d.getTime())) updateData.startDate = d;
    }
  }

  if (data.endDate !== undefined) {
    if (!data.endDate) {
      updateData.endDate = null;
    } else {
      const d = new Date(data.endDate);
      if (!isNaN(d.getTime())) updateData.endDate = d;
    }
  }

  const effectiveStart = updateData.startDate !== undefined ? updateData.startDate : existing.startDate;
  const effectiveEnd = updateData.endDate !== undefined ? updateData.endDate : existing.endDate;
  if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
    return fail("Start date must be before end date", 422);
  }

  if (data.metadata !== undefined) {
    updateData.metadata = typeof data.metadata === "object" && data.metadata !== null
      ? JSON.stringify(data.metadata)
      : typeof data.metadata === "string"
      ? data.metadata
      : null;
  }

  const updated = await db.homepageContentItem.update({
    where: { id },
    data: updateData,
    include: {
      listing: {
        select: {
          id: true,
          name: true,
          category: true,
          town: true,
          district: true,
          images: { take: 1, select: { url: true } },
        },
      },
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "HOMEPAGE_CONTENT_UPDATE",
    targetType: "HOMEPAGE_CONTENT_ITEM",
    targetId: id,
    details: {
      changes: Object.keys(updateData).filter((k) => k !== "lastEditedById"),
      title: updated.title,
      status: updated.status,
      isEnabled: updated.isEnabled,
    },
    ip: getClientIp(req),
  });

  return ok(updated);
});

// DELETE /api/v1/homepage-content/[id]
// Permanently removes the homepage content item.
// IMPORTANT: Does NOT delete the underlying directory listing!
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions to delete homepage content", 403);
  }

  const { id } = await params;
  const existing = await db.homepageContentItem.findUnique({
    where: { id },
    select: { id: true, title: true, section: true, listingId: true },
  });
  if (!existing) return fail("Homepage content item not found", 404);

  // Permanently delete the content item only
  await db.homepageContentItem.delete({ where: { id } });

  await audit({
    actorId: ctx.user.id,
    action: "HOMEPAGE_CONTENT_DELETE",
    targetType: "HOMEPAGE_CONTENT_ITEM",
    targetId: id,
    details: {
      title: existing.title,
      section: existing.section,
      listingIdKeptSafe: existing.listingId,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    message: `Homepage content item "${existing.title}" permanently deleted. Linked directory listing was kept intact.`,
  });
});
