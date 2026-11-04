import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      orderIdx: z.number().int(),
    })
  ).min(1, "At least one item required"),
});

// POST /api/v1/homepage-content/reorder
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions to reorder homepage content", 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues);
  }

  const { items } = parsed.data;

  // Execute in transaction
  await db.$transaction(
    items.map((item) =>
      db.homepageContentItem.update({
        where: { id: item.id },
        data: {
          orderIdx: item.orderIdx,
          lastEditedById: ctx.user.id,
        },
      })
    )
  );

  await audit({
    actorId: ctx.user.id,
    action: "HOMEPAGE_CONTENT_REORDER",
    targetType: "HOMEPAGE_CONTENT_ITEM",
    targetId: items[0]?.id,
    details: {
      count: items.length,
      itemIds: items.map((i) => i.id),
    },
    ip: getClientIp(req),
  });

  return ok({ success: true, count: items.length });
});
