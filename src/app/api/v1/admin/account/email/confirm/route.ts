import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { hashVerificationToken, EMAIL_VERIFY_CONFIG } from "@/lib/resend";
import { z } from "zod";

// POST /api/v1/admin/account/email/confirm
// Step 2 of Super Admin email address binding/update:
// Re-authenticates current password, verifies single-use cryptographic 6-digit OTP code,
// and transactionally updates User.email and User.emailVerified = true.
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newEmail: z.string().email("A valid email address is required"),
    otpCode: z.string().min(4, "Verification code must be at least 4 digits").max(10, "Code too long"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { currentPassword, newEmail, otpCode } = parsed.data;

  // Retrieve Super Admin user record
  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
  });
  if (!user || !user.passwordHash) {
    return fail("Admin account has no password configured. Please contact support.", 500);
  }

  // Validate current password on the server using timing-safe scrypt verification
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    await audit({
      actorId: user.id,
      action: "ADMIN_EMAIL_CHANGE_FAILED",
      targetType: "USER",
      targetId: user.id,
      ip: getClientIp(req),
      details: { reason: "INCORRECT_CURRENT_PASSWORD" },
    });
    return fail("Incorrect current password. Password confirmation is required to apply the change.", 400);
  }

  const normalizedEmail = newEmail.toLowerCase().trim();

  // Re-verify that email is not registered to another account immediately before binding
  const existingUser = await db.user.findFirst({
    where: {
      id: { not: user.id },
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    return fail("This email address is already registered to another account.", 409);
  }

  // Find latest active, unconsumed, unexpired challenge bound to this user and email
  const challenge = await db.emailVerificationToken.findFirst({
    where: {
      userId: user.id,
      email: normalizedEmail,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return fail("No active verification code found or the code has expired. Please request a new verification code.", 400);
  }

  // Enforce maximum attempt ceiling (rate-limiting / brute-force protection)
  if (challenge.attempts >= EMAIL_VERIFY_CONFIG.maxAttempts) {
    await db.emailVerificationToken.update({
      where: { id: challenge.id },
      data: { consumed: true },
    });
    return fail("Maximum verification attempts exceeded. Please request a new verification code.", 429);
  }

  // Constant-time comparison of SHA-256 OTP hashes
  const incomingHash = hashVerificationToken(otpCode.trim());
  const expectedBuf = Buffer.from(challenge.tokenHash, "hex");
  const actualBuf = Buffer.from(incomingHash, "hex");
  const isMatch = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!isMatch) {
    await db.emailVerificationToken.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return fail("Invalid verification code. Please check the code and try again.", 400);
  }

  const oldEmail = user.email;

  // Transactionally consume challenge token and update Super Admin user email
  const [, updatedUser] = await db.$transaction([
    db.emailVerificationToken.update({
      where: { id: challenge.id },
      data: { consumed: true },
    }),
    db.user.update({
      where: { id: user.id },
      data: {
        email: normalizedEmail,
        emailVerified: true,
      },
    }),
  ]);

  // Record administrative security audit log
  await audit({
    actorId: user.id,
    action: "ADMIN_EMAIL_BOUND",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: {
      oldEmail,
      newEmail: normalizedEmail,
      verifiedVia: "EMAIL_OTP",
    },
  });

  // Create internal security notification
  await notify({
    userId: user.id,
    type: "SECURITY_UPDATE",
    title: "Administrator Email Verified",
    message: `Your Super Admin email address was successfully verified and bound to ${normalizedEmail}.`,
  });

  return ok({
    ok: true,
    message: `Administrator email successfully verified and updated to ${normalizedEmail}.`,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      phoneVerified: updatedUser.phoneVerified,
      emailVerified: updatedUser.emailVerified,
    },
  });
});
