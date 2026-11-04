import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

// DELETE /api/v1/ceremonies/purohits/[id]/blocked-slots/[slotId]
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) => {
  const { id, slotId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const purohit = await db.purohitProfile.findUnique({ where: { id } });
  if (!purohit) return fail("Purohit not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isOwner = ctx.user.id === purohit.userId;

  if (!isSuperAdmin && !isOwner) {
    return fail("Unauthorized to modify blocked slots for this purohit", 403);
  }

  await db.purohitBlockedSlot.delete({ where: { id: slotId } });

  await audit({
    actorId: ctx.user.id,
    action: "PUROHIT_SLOT_UNBLOCKED",
    targetType: "PUROHIT_PROFILE",
    targetId: id,
    details: { slotId },
    ip: getClientIp(req),
  });

  return ok({ ok: true, message: "Blocked period removed" });
});
