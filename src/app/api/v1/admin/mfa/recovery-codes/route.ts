import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, audit } from "@/lib/auth";
import { fail, ok, handler, getClientIp } from "@/lib/validation";
import { verifyTotp } from "@/lib/totp";
import {
  decryptMfaPayload,
  encryptMfaPayload,
  generateRecoveryCodes,
} from "@/lib/mfa";

// POST /api/v1/admin/mfa/recovery-codes — Regenerate single-use recovery codes with reauthentication
// Body: { password, totpCode }
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") return fail("Unauthorized", 401);

  if (!ctx.user.mfaEnabled || !ctx.user.mfaSecret) {
    return fail("MFA is not enabled on this account.", 400);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const { password, totpCode } = body as { password?: string; totpCode?: string };

  if (!password || !totpCode) {
    return fail("Both password and current authenticator code are required to regenerate recovery codes.", 400);
  }

  // 1. Reauthenticate current password
  if (!ctx.user.passwordHash || !verifyPassword(password, ctx.user.passwordHash)) {
    return fail("Invalid account password.", 401);
  }

  // 2. Verify current TOTP
  const mfaData = decryptMfaPayload(ctx.user.mfaSecret);
  if (!mfaData || !mfaData.secret) {
    return fail("Unable to verify MFA secret. Contact system administrator.", 500);
  }

  const isValid = verifyTotp(totpCode.trim(), mfaData.secret, 1);
  if (!isValid) {
    return fail("Invalid authenticator code.", 401);
  }

  // 3. Generate 8 new recovery codes and re-encrypt
  const { plaintext, hashed } = generateRecoveryCodes(8);
  const updatedEncrypted = encryptMfaPayload({
    secret: mfaData.secret,
    recoveryCodes: hashed,
    enrolledAt: mfaData.enrolledAt || new Date().toISOString(),
  });

  await db.user.update({
    where: { id: ctx.user.id },
    data: { mfaSecret: updatedEncrypted },
  });

  await audit({
    actorId: ctx.user.id,
    action: "ADMIN_MFA_RECOVERY_CODES_REGENERATED",
    targetType: "USER",
    targetId: ctx.user.id,
    ip: getClientIp(req),
  });

  return ok({
    recoveryCodes: plaintext,
    message: "New recovery codes generated. Store them in a secure password manager or offline vault.",
  });
});
