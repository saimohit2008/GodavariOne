import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { generateVerificationCode, hashVerificationToken, EMAIL_VERIFY_CONFIG } from "@/lib/resend";
import { z } from "zod";

// POST /api/v1/admin/account/email/request
// Step 1 of Super Admin email address binding/update:
// Requires active Super Admin session and current-password re-authentication.
// Validates email format, checks uniqueness, generates 6-digit cryptographic OTP,
// stores SHA-256 hash in EmailVerificationToken, and dispatches verification email via Resend.
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newEmail: z.string().email("A valid email address is required"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { currentPassword, newEmail } = parsed.data;

  // Retrieve Super Admin user record with passwordHash
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
    return fail("Incorrect current password. Password confirmation is required to update your email address.", 400);
  }

  const normalizedEmail = newEmail.toLowerCase().trim();

  // Validate that new email is different from existing registered email
  if (user.email && user.email.toLowerCase().trim() === normalizedEmail) {
    return fail("New email address cannot be identical to your current email address.", 400);
  }

  // Check if new email is already registered to another user account
  const existingUser = await db.user.findFirst({
    where: {
      id: { not: user.id },
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    return fail("This email address is already registered to another account.", 409);
  }

  // Check if email has a pending registration
  const pending = await db.pendingRegistration.findFirst({
    where: { email: normalizedEmail },
  });

  if (pending) {
    return fail("This email address is currently associated with a pending registration.", 409);
  }

  // Check resend cooldown on active requests for this user or email
  const recentToken = await db.emailVerificationToken.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        { userId: user.id },
      ],
      createdAt: { gt: new Date(Date.now() - EMAIL_VERIFY_CONFIG.resendCooldownMs) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentToken) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(recentToken.createdAt).getTime()) / 1000);
    const waitSeconds = Math.max(1, Math.ceil(EMAIL_VERIFY_CONFIG.resendCooldownMs / 1000 - elapsedSeconds));
    return fail(`Please wait ${waitSeconds} seconds before requesting another verification email.`, 429);
  }

  // Invalidate any older unconsumed tokens for this user or target email
  await db.emailVerificationToken.updateMany({
    where: {
      OR: [
        { email: normalizedEmail },
        { userId: user.id },
      ],
      consumed: false,
    },
    data: { consumed: true },
  });

  // Generate cryptographic 6-digit OTP code and secure SHA-256 hash
  const otpCode = generateVerificationCode();
  const tokenHash = hashVerificationToken(otpCode);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_CONFIG.tokenTtlSeconds * 1000);

  // Store token challenge in database bound to this Super Admin account ID
  const tokenRecord = await db.emailVerificationToken.create({
    data: {
      email: normalizedEmail,
      tokenHash,
      expiresAt,
      userId: user.id,
      consumed: false,
      attempts: 0,
    },
  });

  // Dispatch email via Resend integration
  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: "Godavari One — Super Admin Email Verification Code",
    text: `Hello ${user.name || "Administrator"},\n\nYour 6-digit verification code to bind this email address to your Godavari One Super Admin account is: ${otpCode}\n\nThis single-use code expires in 15 minutes.\n\nIf you did not initiate this request, your account credentials remain protected.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #0f766e; margin-top: 0;">Godavari One · Super Admin Security</h2>
      <p style="font-size: 14px; color: #374151;">A request was made to associate this email address (<strong>${normalizedEmail}</strong>) with your Godavari One Super Admin account.</p>
      <p style="font-size: 14px; color: #374151;">Use the verification code below to authorize this email binding:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f766e; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        ${otpCode}
      </div>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 0;">This single-use code is valid for 15 minutes. If you did not initiate this request, your account credentials remain protected.</p>
    </div>`,
  });

  const isDevMode = process.env.OTP_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
  const shouldExposeDevCode = isDevMode;

  if (!emailResult.success && !isDevMode) {
    // If dispatch failed in production, remove unverified token and return error
    await db.emailVerificationToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
    return fail(`Unable to dispatch verification email: ${emailResult.error || "Email delivery failed"}.`, 502);
  }

  // Record audit log without logging raw OTPs or passwords
  await audit({
    actorId: user.id,
    action: "ADMIN_EMAIL_CHANGE_REQUESTED",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: {
      targetEmail: normalizedEmail,
      emailDelivered: emailResult.success,
    },
  });

  return ok({
    ok: true,
    email: normalizedEmail,
    ttlSeconds: EMAIL_VERIFY_CONFIG.tokenTtlSeconds,
    emailDelivered: emailResult.success,
    message: `Verification code dispatched to ${normalizedEmail}.`,
    devCode: shouldExposeDevCode ? otpCode : undefined,
  });
});
