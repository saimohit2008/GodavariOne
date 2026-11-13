// POST /api/v1/auth/phone/otp/request
// Requests a 6-digit OTP challenge for mobile number ownership verification.
// Stage A format validation, Stage B intelligence check, and Stage C SMS OTP challenge.

import { NextRequest } from "next/server";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { requestPhoneOtpChallenge } from "@/lib/phone-verification";
import { z } from "zod";

const requestSchema = z.object({
  phone: z.string().min(5).max(30),
  countryCode: z.string().min(2).max(4).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { phone, countryCode } = parsed.data;
  const ip = getClientIp(req);

  const result = await requestPhoneOtpChallenge({
    phone,
    countryCode,
    ip,
  });

  if (!result.success) {
    return fail(result.error || "Failed to dispatch verification code", result.statusCode || 400, {
      code: result.code,
      isConfigured: result.isConfigured,
    });
  }

  return ok({
    ok: true,
    delivered: result.delivered,
    isConfigured: result.isConfigured,
    ttlSeconds: result.ttlSeconds,
    phone: result.phone,
    message: result.message,
  });
});
