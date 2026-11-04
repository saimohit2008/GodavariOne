import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1, "Ordered IDs array is required"),
});

// POST /api/v1/nri/content/reorder
// Super Admin only: Reorder NRI content items
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
    return fail("Validation failed", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  const { orderedIds } = parsed.data;

  // Update orderIdx in transaction
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.nriContentItem.update({
        where: { id },
        data: { orderIdx: index, lastEditedById: ctx.user.id },
      })
    )
  );

  await audit({
    actorId: ctx.user.id,
    action: "NRI_CONTENT_REORDER",
    targetType: "NRI_CONTENT_ITEM",
    targetId: "batch",
    details: { orderedCount: orderedIds.length, orderedIds },
    ip: getClientIp(req),
  });

  return ok({ success: true, message: `Reordered ${orderedIds.length} items successfully` });
});
