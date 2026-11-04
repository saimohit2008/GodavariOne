import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { fail, ok, handler, getClientIp } from "@/lib/validation";
import { verifyTotp } from "@/lib/totp";
import {
  getPendingEnrollment,
  clearPendingEnrollment,
  encryptMfaPayload,
} from "@/lib/mfa";

// POST /api/v1/admin/mfa/enable — Verify initial TOTP code and enable Super Admin MFA
// Body: { totpCode }
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const { totpCode } = body as { totpCode?: string };
  if (!totpCode || !/^\d{6}$/.test(totpCode.trim())) {
    return fail("A 6-digit TOTP verification code is required", 400);
  }

  const pending = getPendingEnrollment(ctx.user.id);
  if (!pending) {
    return fail("No active MFA setup in progress, or setup has expired. Please initiate setup again.", 400);
  }

  const isValid = verifyTotp(totpCode.trim(), pending.secret, 1);
  if (!isValid) {
    await audit({
      actorId: ctx.user.id,
      action: "ADMIN_MFA_ENABLE_FAILED",
      targetType: "USER",
      targetId: ctx.user.id,
      ip: getClientIp(req),
    });
    return fail("Invalid authenticator code. Check that your device clock is synchronized.", 400);
  }

  // Encrypt TOTP secret and recovery code hashes at rest (AES-256-GCM)
  const encryptedPayload = encryptMfaPayload({
    secret: pending.secret,
    recoveryCodes: pending.hashedRecoveryCodes,
    enrolledAt: new Date().toISOString(),
  });

  await db.user.update({
    where: { id: ctx.user.id },
    data: {
      mfaSecret: encryptedPayload,
      mfaEnabled: true,
    },
  });

  clearPendingEnrollment(ctx.user.id);

  await audit({
    actorId: ctx.user.id,
    action: "ADMIN_MFA_ENABLED",
    targetType: "USER",
    targetId: ctx.user.id,
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    message: "Super Admin MFA has been successfully enabled and will be enforced on subsequent logins.",
  });
});
