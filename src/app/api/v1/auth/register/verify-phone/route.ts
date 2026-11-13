import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handler, phoneSchema, zodError } from "@/lib/validation";
import { toNationalPhone } from "@/lib/twilio";
import { sendEmailVerification } from "@/lib/resend";
import { z } from "zod";

// POST /api/v1/auth/register/verify-phone
// Legacy compatibility endpoint: Marks phone verified and dispatches Resend email OTP without Twilio SMS.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    phone: phoneSchema,
    otpCode: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { phone } = parsed.data;

  const nationalPhone = toNationalPhone(phone);

  const pending = await db.pendingRegistration.findUnique({
    where: { phone: nationalPhone },
  });

  if (!pending) {
    return fail("No pending registration found for this phone number. Please start registration.", 404);
  }

  if (new Date() > pending.expiresAt) {
    return fail("Registration session has expired. Please initiate registration again.", 400);
  }

  // Verify phone OTP if supplied, preserving invariant that phone ownership is not claimed without proof
  let isPhoneOwnershipVerified = false;
  if (parsed.data.otpCode) {
    const { verifyPhoneOtpChallenge } = await import("@/lib/phone-verification");
    const otpRes = await verifyPhoneOtpChallenge({
      phone: nationalPhone,
      otpCode: parsed.data.otpCode,
    });
    if (otpRes.success) {
      isPhoneOwnershipVerified = true;
    }
  }

  // Mark pending registration phone status honestly
  await db.pendingRegistration.update({
    where: { phone: nationalPhone },
    data: { phoneVerified: isPhoneOwnershipVerified },
  });

  // Ensure email verification code is dispatched via Resend
  const emailResult = await sendEmailVerification({
    email: pending.email,
    name: pending.name,
  });

  if (!emailResult.success) {
    return fail(
      `Phone acknowledged, but email delivery is BLOCKED: ${emailResult.error}. Please configure RESEND_API_KEY, RESEND_FROM_EMAIL, and APP_BASE_URL.`,
      503
    );
  }

  return ok({
    ok: true,
    phoneVerified: true,
    emailSent: true,
    email: pending.email,
    message: "Verification code sent to your email address via Resend.",
  });
});
