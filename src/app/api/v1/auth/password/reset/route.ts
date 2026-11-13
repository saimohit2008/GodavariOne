import { NextRequest } from "next/server";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { completePasswordReset } from "@/lib/password-recovery";
import { z } from "zod";

// POST /api/v1/auth/password/reset
// Step 3 & 4: Validates new password and completes the password reset.
// Accepts either a verified resetToken or direct otpCode.
// Revokes all existing user sessions and preserves role, status, and MFA.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    email: z.string().email("A valid email address is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().optional(),
    resetToken: z.string().optional(),
    otpCode: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { email, newPassword, confirmPassword, resetToken, otpCode } = parsed.data;

  if (!resetToken && !otpCode) {
    return fail("Either a verified resetToken or an otpCode is required to reset password.", 400);
  }

  const ip = getClientIp(req);
  const result = await completePasswordReset({
    email,
    newPassword,
    confirmPassword,
    resetToken,
    otpCode,
    ip,
  });

  if (!result.success) {
    return fail(result.error || "Failed to reset password.", result.statusCode || 400);
  }

  return ok({
    ok: true,
    message: result.message || "Your password has been reset successfully. Please log in with your new password.",
  });
});
