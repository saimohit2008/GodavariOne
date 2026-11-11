import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, generateOtp, hashOtp, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp, phoneSchema, zodError } from "@/lib/validation";
import { toNationalPhone, normalizeToE164 } from "@/lib/twilio";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

// 15-minute expiration and 60-second cooldown as mandated by security specification
const PHONE_CHANGE_TTL_SECONDS = 900; // 15 minutes
const PHONE_CHANGE_COOLDOWN_MS = 60_000; // 60 seconds

// POST /api/v1/admin/account/phone/request
// Step 1 of Super Admin mobile number change:
// Validates current password, validates new phone, checks verified admin email,
// generates 6-digit OTP challenge, and dispatches verification code via Resend.
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPhone: phoneSchema,
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { currentPassword, newPhone } = parsed.data;

  // Retrieve user record with passwordHash
  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
  });
  if (!user || !user.passwordHash) {
    return fail("Admin account has no password configured. Please contact support.", 500);
  }

  // Validate current password on the server
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    await audit({
      actorId: user.id,
      action: "ADMIN_PHONE_CHANGE_FAILED",
      targetType: "USER",
      targetId: user.id,
      ip: getClientIp(req),
      details: { reason: "INCORRECT_CURRENT_PASSWORD" },
    });
    return fail("Incorrect current password. Password confirmation is required to change your mobile number.", 400);
  }

  // Mandatory Security Rule: A verified admin recovery email is required for secure OTP delivery
  if (!user.email || !user.emailVerified) {
    return fail(
      "A verified administrator recovery email is required to authorize mobile number changes. Please configure and verify your email address in Account Settings first.",
      400,
      { code: "ADMIN_RECOVERY_EMAIL_REQUIRED" }
    );
  }

  // Normalize phone numbers
  const nationalPhone = toNationalPhone(newPhone);
  const e164Phone = normalizeToE164(newPhone);

  // Validate that new phone is different from existing phone
  if (nationalPhone === toNationalPhone(user.phone)) {
    return fail("New mobile number cannot be identical to your current mobile number.", 400);
  }

  // Check if new mobile number is already taken by any other user account
  const existingUser = await db.user.findFirst({
    where: {
      AND: [
        { id: { not: user.id } },
        {
          OR: [
            { phone: nationalPhone },
            { phone: e164Phone },
          ],
        },
      ],
    },
  });

  if (existingUser) {
    return fail("This mobile number is already registered to another account.", 409);
  }

  // Enforce 60-second cooldown on active unconsumed requests for this user
  const recentChallenge = await db.otpChallenge.findFirst({
    where: {
      userId: user.id,
      purpose: "CHANGE_PHONE",
      consumed: false,
      createdAt: { gt: new Date(Date.now() - PHONE_CHANGE_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentChallenge) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(recentChallenge.createdAt).getTime()) / 1000);
    const waitSeconds = Math.max(1, Math.ceil(PHONE_CHANGE_COOLDOWN_MS / 1000 - elapsedSeconds));
    return fail(`Please wait ${waitSeconds} seconds before requesting another verification code.`, 429);
  }

  // Invalidate any previous unconsumed phone-change challenges for this admin
  await db.otpChallenge.updateMany({
    where: {
      userId: user.id,
      purpose: "CHANGE_PHONE",
      consumed: false,
    },
    data: { consumed: true },
  });

  // Generate 6-digit cryptographic OTP code and SHA-256 secure hash
  const otpCode = generateOtp();
  const codeHash = hashOtp(otpCode);
  const expiresAt = new Date(Date.now() + PHONE_CHANGE_TTL_SECONDS * 1000);

  // Create OtpChallenge in database with 15-minute TTL
  const challenge = await db.otpChallenge.create({
    data: {
      phone: nationalPhone,
      codeHash,
      purpose: "CHANGE_PHONE",
      userId: user.id,
      expiresAt,
      consumed: false,
      attempts: 0,
    },
  });

  // Primary Delivery Channel: Dispatch OTP to Super Admin's verified email via Resend
  const emailResult = await sendEmail({
    to: user.email,
    subject: "Godavari One — Super Admin Mobile Number Verification Code",
    text: `Hello ${user.name || "Administrator"},\n\nA request was made to update your Godavari One Super Admin mobile number to ${nationalPhone}.\n\nYour 6-digit verification code is: ${otpCode}\n\nThis single-use code is valid for 15 minutes. Enter this code in Account Settings to authorize updating your login mobile number.\n\nIf you did not initiate this request, your existing registered mobile number remains protected.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #0f766e; margin-top: 0;">Godavari One · Super Admin Security</h2>
      <p style="font-size: 14px; color: #374151;">A request was made to update your registered Super Admin mobile number to <strong>${nationalPhone}</strong>.</p>
      <p style="font-size: 14px; color: #374151;">Use the verification code below to authorize this change:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f766e; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        ${otpCode}
      </div>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 0;">This single-use code is valid for 15 minutes. If you did not initiate this request, your existing account and mobile number remain completely protected.</p>
    </div>`,
  });

  // Secondary Delivery Channel: Optional SMS dispatch if provider is configured
  let smsResult = { success: false };
  try {
    smsResult = await sendSms({
      to: nationalPhone,
      message: `Your Godavari One Super Admin mobile verification code is: ${otpCode}. Valid for 15 minutes. Do not share this code.`,
    });
  } catch {
    // SMS provider optional
  }

  // Check if dev fallback should supply the code (e.g. dev mode)
  const isDevMode = process.env.OTP_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
  const shouldExposeDevCode = isDevMode;

  if (!emailResult.success && !smsResult.success && !isDevMode) {
    await db.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    return fail(`Unable to deliver verification code: ${emailResult.error || "Email delivery failed"}.`, 502);
  }

  await audit({
    actorId: user.id,
    action: "ADMIN_PHONE_CHANGE_REQUESTED",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: {
      targetPhone: nationalPhone,
      smsDelivered: smsResult.success,
      emailDelivered: emailResult.success,
      deliveryChannel: emailResult.success && smsResult.success ? "EMAIL_AND_SMS" : emailResult.success ? "EMAIL" : smsResult.success ? "SMS" : "DEV_FALLBACK",
    },
  });

  let deliveryMessage = "";
  if (emailResult.success && smsResult.success) {
    deliveryMessage = `Verification code emailed to ${user.email} and dispatched via SMS to ${nationalPhone}.`;
  } else if (emailResult.success) {
    deliveryMessage = `Verification code dispatched to your verified administrator email (${user.email}).`;
  } else if (smsResult.success) {
    deliveryMessage = `Verification code dispatched via SMS to ${nationalPhone}.`;
  } else {
    deliveryMessage = `Verification code generated for ${nationalPhone} (Dev mode active).`;
  }

  return ok({
    ok: true,
    challengeId: challenge.id,
    phone: nationalPhone,
    ttlSeconds: PHONE_CHANGE_TTL_SECONDS,
    smsDelivered: smsResult.success,
    emailDelivered: emailResult.success,
    message: deliveryMessage,
    devCode: shouldExposeDevCode ? otpCode : undefined,
  });
});
