import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, audit } from "@/lib/auth";
import { fail, ok, handler, getClientIp } from "@/lib/validation";
import { decryptMfaPayload, verifyMfaInput } from "@/lib/mfa";

// POST /api/v1/admin/mfa/disable — Securely disable Super Admin MFA with mandatory reauthentication
// Body: { password, confirmCode }
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const { password, confirmCode } = body as { password?: string; confirmCode?: string };

  if (!password || !confirmCode) {
    return fail("Both current account password and current MFA code are required to modify MFA settings.", 400);
  }

  // 1. Reauthenticate current password
  if (!ctx.user.passwordHash || !verifyPassword(password, ctx.user.passwordHash)) {
    await audit({
      actorId: ctx.user.id,
      action: "ADMIN_MFA_DISABLE_FAILED_PASSWORD",
      targetType: "USER",
      targetId: ctx.user.id,
      ip: getClientIp(req),
    });
    return fail("Invalid account password.", 401);
  }

  // 2. Verify current MFA factor
  if (ctx.user.mfaEnabled && ctx.user.mfaSecret) {
    const mfaData = decryptMfaPayload(ctx.user.mfaSecret);
    if (!mfaData || !mfaData.secret) {
      return fail("Unable to verify MFA secret. Contact system administrator.", 500);
    }

    const verification = verifyMfaInput(confirmCode.trim(), mfaData);
    if (!verification.valid) {
      await audit({
        actorId: ctx.user.id,
        action: "ADMIN_MFA_DISABLE_FAILED_CODE",
        targetType: "USER",
        targetId: ctx.user.id,
        ip: getClientIp(req),
      });
      return fail("Invalid authenticator or recovery code.", 401);
    }
  }

  // 3. Disable MFA and clear secret
  await db.user.update({
    where: { id: ctx.user.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "ADMIN_MFA_DISABLED",
    targetType: "USER",
    targetId: ctx.user.id,
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    message: "Multi-Factor Authentication has been disabled for this account.",
  });
});
