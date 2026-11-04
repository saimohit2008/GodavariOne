import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireAdmin, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";

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

const nriContentSchema = z.object({
  type: z.enum(["SERVICE", "CARD", "ANNOUNCEMENT", "NOTICE", "FAQ"]).default("CARD"),
  title: z.string().trim().min(1, "Title is required").max(160, "Title cannot exceed 160 characters"),
  subtitle: z.string().trim().max(200, "Subtitle cannot exceed 200 characters").optional().nullable(),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  content: z.string().trim().max(5000, "Content cannot exceed 5000 characters").optional().nullable(),
  icon: z.string().trim().max(50).optional().nullable(),
  badgeText: z.string().trim().max(50).optional().nullable(),
  linkUrl: z.string().trim().max(500).optional().nullable().refine(isValidLinkUrl, {
    message: "Link URL must be a valid relative path (e.g. /nri-access) or secure http(s) URL",
  }),
  linkText: z.string().trim().max(60).optional().nullable(),
  orderIdx: z.number().int().optional(),
  isEnabled: z.boolean().default(true),
  status: z.enum(["PUBLISHED", "DRAFT"]).default("PUBLISHED"),
  startDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/)).optional().nullable(),
});

// GET /api/v1/nri/content
// Public: returns active, enabled, published NRI items
// Super Admin (?all=true): returns all items including drafts, disabled, scheduled, expired
export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get("all") === "true";
  const typeFilter = searchParams.get("type");

  if (showAll) {
    const ctx = await getCurrentUser(req);
    if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
      return fail("Insufficient permissions to inspect full administrative NRI content", 403);
    }

    const where: any = {};
    if (typeFilter) where.type = typeFilter;

    const items = await db.nriContentItem.findMany({
      where,
      orderBy: [{ orderIdx: "asc" }, { createdAt: "asc" }],
    });

    const now = new Date();
    const enriched = items.map((item) => {
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

    return ok({ items: enriched, total: enriched.length });
  }

  // Public: filter by enabled, published, and within date window
  const now = new Date();
  const where: any = {
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

  if (typeFilter) where.type = typeFilter;

  const items = await db.nriContentItem.findMany({
    where,
    orderBy: [{ orderIdx: "asc" }, { createdAt: "asc" }],
  });

  return ok({ items, count: items.length });
});

// POST /api/v1/nri/content
// Super Admin only: Create a new NRI content item
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = nriContentSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  const data = parsed.data;

  // Determine orderIdx
  let orderIdx = data.orderIdx;
  if (orderIdx === undefined) {
    const highest = await db.nriContentItem.findFirst({
      where: { type: data.type },
      orderBy: { orderIdx: "desc" },
      select: { orderIdx: true },
    });
    orderIdx = (highest?.orderIdx ?? -1) + 1;
  }

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

  const item = await db.nriContentItem.create({
    data: {
      type: data.type,
      title: data.title,
      subtitle: data.subtitle || null,
      description: data.description || null,
      content: data.content || null,
      icon: data.icon || null,
      badgeText: data.badgeText || null,
      linkUrl: data.linkUrl || null,
      linkText: data.linkText || null,
      orderIdx,
      isEnabled: data.isEnabled ?? true,
      status: data.status ?? "PUBLISHED",
      startDate,
      endDate,
      createdById: ctx.user.id,
      lastEditedById: ctx.user.id,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_CONTENT_CREATE",
    targetType: "NRI_CONTENT_ITEM",
    targetId: item.id,
    details: {
      type: item.type,
      title: item.title,
      status: item.status,
      isEnabled: item.isEnabled,
    },
    ip: getClientIp(req),
  });

  return created(item);
});
