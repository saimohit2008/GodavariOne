// POST /api/v1/auth/phone/otp/verify
// Cryptographically verifies the 6-digit OTP code submitted by the user.
// Returns an ownership verification proof token upon successful verification.

import { NextRequest } from "next/server";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { verifyPhoneOtpChallenge } from "@/lib/phone-verification";
import { z } from "zod";

const verifySchema = z.object({
  phone: z.string().min(5).max(30),
  otpCode: z.string().min(4).max(10),
  countryCode: z.string().min(2).max(4).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { phone, otpCode, countryCode } = parsed.data;
  const ip = getClientIp(req);

  const result = await verifyPhoneOtpChallenge({
    phone,
    otpCode,
    countryCode,
    ip,
  });

  if (!result.success) {
    return fail(result.error || "Verification failed", result.statusCode || 400);
  }

  return ok({
    ok: true,
    phoneVerified: true,
    phone: result.phone,
    verificationToken: result.verificationToken,
    message: result.message,
  });
});
