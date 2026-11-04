import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, revokeSession, clearSessionCookie, audit } from "@/lib/auth";
import { ok, handler, getClientIp } from "@/lib/validation";

// POST /api/v1/auth/logout
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (ctx) {
    await revokeSession(ctx.session.token);
    await audit({ actorId: ctx.user.id, action: "LOGOUT", targetType: "USER", targetId: ctx.user.id, ip: getClientIp(req) });
  }
  await clearSessionCookie();
  return ok({ ok: true });
});
