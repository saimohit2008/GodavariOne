import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

const reorderSchema = z.object({
  bannerIds: z.array(z.string()).min(1, "At least one banner ID required"),
});

// POST /api/v1/carousel/reorder
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues);
  }

  const { bannerIds } = parsed.data;

  // Update orderIdx in transaction
  await db.$transaction(
    bannerIds.map((id, index) =>
      db.carouselBanner.update({
        where: { id },
        data: {
          orderIdx: index,
          lastEditedById: ctx.user.id,
        },
      })
    )
  );

  await audit({
    actorId: ctx.user.id,
    action: "CAROUSEL_BANNER_REORDER",
    targetType: "CAROUSEL_BANNER",
    details: { count: bannerIds.length, bannerIds },
    ip: getClientIp(req),
  });

  return ok({ success: true, count: bannerIds.length });
});
