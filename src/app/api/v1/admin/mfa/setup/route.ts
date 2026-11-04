import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, handler } from "@/lib/validation";
import { generateTotpSecret } from "@/lib/totp";
import {
  generateRecoveryCodes,
  encodeQrSvg,
  storePendingEnrollment,
} from "@/lib/mfa";

// GET /api/v1/admin/mfa/setup — Initiate Super Admin MFA enrollment flow
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") return fail("Unauthorized", 401);

  const secret = generateTotpSecret();
  const { plaintext, hashed } = generateRecoveryCodes(8);

  const issuer = "Godavari One";
  const account = ctx.user.email || ctx.user.phone;
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  const qrSvg = encodeQrSvg(otpauthUri, 4);

  // Store in pending enrollments with a 10-minute expiry
  storePendingEnrollment({
    userId: ctx.user.id,
    secret,
    plaintextRecoveryCodes: plaintext,
    hashedRecoveryCodes: hashed,
    otpauthUri,
    qrSvg,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  return ok({
    secret,
    otpauthUri,
    qrSvg,
    recoveryCodes: plaintext,
    expiresInSeconds: 600,
  });
});
