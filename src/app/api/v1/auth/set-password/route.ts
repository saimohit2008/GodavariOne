import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, createSession, setSessionCookie, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp, validatePasswordPolicy, zodError } from "@/lib/validation";
import { validateEmailVerificationToken } from "@/lib/resend";
import { z } from "zod";

// POST /api/v1/auth/set-password
// Provides safe password setup / recovery for existing accounts that have no password yet
// or need to reset using verified email OTP.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const ctx = await getCurrentUser();

  // Path 1: User is already logged in (e.g. via legacy session) and setting password
  if (ctx && ctx.user) {
    const schema = z.object({
      newPassword: z.string(),
      confirmPassword: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const { newPassword, confirmPassword } = parsed.data;
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return fail("Password and confirmation password do not match", 400);
    }
    const pwCheck = validatePasswordPolicy(newPassword);
    if (!pwCheck.isValid) {
      return fail(pwCheck.error || "Password does not meet requirements", 400);
    }

    await db.user.update({
      where: { id: ctx.user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    await audit({
      actorId: ctx.user.id,
      action: "PASSWORD_SETUP",
      targetType: "USER",
      targetId: ctx.user.id,
      ip: getClientIp(req),
    });

    return ok({ ok: true, message: "Password configured successfully." });
  }

  // Path 2: Unauthenticated recovery for users with registered email
  const schema = z.object({
    email: z.string().email(),
    otpCode: z.string().min(4).max(8),
    newPassword: z.string(),
    confirmPassword: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { email, otpCode, newPassword, confirmPassword } = parsed.data;
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return fail("Password and confirmation password do not match", 400);
  }
  const pwCheck = validatePasswordPolicy(newPassword);
  if (!pwCheck.isValid) {
    return fail(pwCheck.error || "Password does not meet requirements", 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await db.user.findFirst({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return fail("No account found with this email address", 404);
  }

  // Verify single-use email OTP code via Resend
  const tokenResult = await validateEmailVerificationToken(normalizedEmail, otpCode);
  if (!tokenResult.success) {
    return fail(tokenResult.error || "Invalid or expired verification code", 400);
  }

  // Update password and record emailVerified
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(newPassword),
      emailVerified: true,
    },
  });

  // Create session and set cookie
  const session = await createSession(user.id, "PASSWORD");
  await setSessionCookie(session.token);

  await audit({
    actorId: user.id,
    action: "PASSWORD_RESET_RECOVERY",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: { email: normalizedEmail, method: "EMAIL_OTP_RECOVERY" },
  });

  return ok({
    ok: true,
    message: "Password configured successfully. You are now signed in.",
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    },
  });
});
