import { NextRequest } from "next/server";
import { ok, fail, handler, zodError } from "@/lib/validation";
import { verifyPasswordResetOtp } from "@/lib/password-recovery";
import { z } from "zod";

// POST /api/v1/auth/password/verify
// Step 2: Validates the 6-digit OTP code submitted by the user.
// Returns a single-use high-entropy resetToken for setting the new password.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    email: z.string().email("A valid email address is required"),
    otpCode: z.string().min(4, "Verification code is required").max(10),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { email, otpCode } = parsed.data;
  const result = await verifyPasswordResetOtp(email, otpCode);

  if (!result.success) {
    return fail(result.error || "Invalid verification code.", result.statusCode || 400);
  }

  return ok({
    ok: true,
    resetToken: result.resetToken,
    message: "Verification code verified successfully. You may now create a new password.",
  });
});
