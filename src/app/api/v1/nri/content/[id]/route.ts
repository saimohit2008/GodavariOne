import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

function isValidLinkUrl(url?: string | null): boolean {
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

const updateNriContentSchema = z.object({
  type: z.enum(["SERVICE", "CARD", "ANNOUNCEMENT", "NOTICE", "FAQ"]).optional(),
  title: z.string().trim().min(1, "Title is required").max(160, "Title cannot exceed 160 characters").optional(),
  subtitle: z.string().trim().max(200, "Subtitle cannot exceed 200 characters").optional().nullable(),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  content: z.string().trim().max(5000, "Content cannot exceed 5000 characters").optional().nullable(),
  icon: z.string().trim().max(50).optional().nullable(),
  badgeText: z.string().trim().max(50).optional().nullable(),
  linkUrl: z.string().trim().max(500).optional().nullable().refine(isValidLinkUrl, {
    message: "Link URL must be a valid relative path or secure http(s) URL",
  }),
  linkText: z.string().trim().max(60).optional().nullable(),
  orderIdx: z.number().int().optional(),
  isEnabled: z.boolean().optional(),
  status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
  startDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
});

// GET /api/v1/nri/content/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const item = await db.nriContentItem.findUnique({
    where: { id },
  });

  if (!item) return fail("NRI content item not found", 404);
  return ok(item);
});

// PATCH /api/v1/nri/content/[id]
// Super Admin only: update content item
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAdmin();
  const { id } = await params;

  const existing = await db.nriContentItem.findUnique({ where: { id } });
  if (!existing) return fail("NRI content item not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = updateNriContentSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  const data = parsed.data;

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

  const updated = await db.nriContentItem.update({
    where: { id },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.subtitle !== undefined && { subtitle: data.subtitle || null }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.content !== undefined && { content: data.content || null }),
      ...(data.icon !== undefined && { icon: data.icon || null }),
      ...(data.badgeText !== undefined && { badgeText: data.badgeText || null }),
      ...(data.linkUrl !== undefined && { linkUrl: data.linkUrl || null }),
      ...(data.linkText !== undefined && { linkText: data.linkText || null }),
      ...(data.orderIdx !== undefined && { orderIdx: data.orderIdx }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.status !== undefined && { status: data.status }),
      startDate,
      endDate,
      lastEditedById: ctx.user.id,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_CONTENT_UPDATE",
    targetType: "NRI_CONTENT_ITEM",
    targetId: id,
    details: {
      changed: Object.keys(data),
      title: updated.title,
    },
    ip: getClientIp(req),
  });

  return ok(updated);
});

// DELETE /api/v1/nri/content/[id]
// Super Admin only: delete content item
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAdmin();
  const { id } = await params;

  const existing = await db.nriContentItem.findUnique({ where: { id } });
  if (!existing) return fail("NRI content item not found", 404);

  await db.nriContentItem.delete({ where: { id } });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_CONTENT_DELETE",
    targetType: "NRI_CONTENT_ITEM",
    targetId: id,
    details: {
      title: existing.title,
      type: existing.type,
    },
    ip: getClientIp(req),
  });

  return ok({ success: true, id, message: "NRI content item deleted successfully" });
});
