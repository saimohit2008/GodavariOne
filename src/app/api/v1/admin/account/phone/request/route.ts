import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, generateOtp, hashOtp, OTP_CONFIG, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp, phoneSchema, zodError } from "@/lib/validation";
import { toNationalPhone, normalizeToE164 } from "@/lib/twilio";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

// POST /api/v1/admin/account/phone/request
// Step 1 of Super Admin mobile number change:
// Validates current password, validates new phone, generates OTP challenge, and dispatches verification code.
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
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

  // Check cooldown on active unconsumed requests for this user
  const recentChallenge = await db.otpChallenge.findFirst({
    where: {
      userId: user.id,
      purpose: "CHANGE_PHONE",
      consumed: false,
      createdAt: { gt: new Date(Date.now() - OTP_CONFIG.resendCooldownMs) },
    },
  });

  if (recentChallenge) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(recentChallenge.createdAt).getTime()) / 1000);
    const waitSeconds = Math.max(1, Math.ceil(OTP_CONFIG.resendCooldownMs / 1000 - elapsedSeconds));
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

  // Generate 6-digit OTP code and secure hash
  const otpCode = generateOtp();
  const codeHash = hashOtp(otpCode);
  const expiresAt = new Date(Date.now() + OTP_CONFIG.ttlSeconds * 1000);

  // Create OtpChallenge in database
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

  // Dispatch real SMS
  const smsResult = await sendSms({
    to: nationalPhone,
    message: `Your Godavari One Super Admin mobile verification code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`,
  });

  // Dual-channel security: Also dispatch to Super Admin's verified email
  let emailResult = { success: false };
  if (user.email) {
    emailResult = await sendEmail({
      to: user.email,
      subject: "Godavari One — Super Admin Mobile Number Verification Code",
      text: `Hello ${user.name || "Administrator"},\n\nA request was made to update your Godavari One Super Admin mobile number to ${nationalPhone}.\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code expires in 5 minutes. If you did not initiate this request, your existing registered mobile number remains protected.`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #0f766e; margin-top: 0;">Godavari One · Super Admin Security</h2>
        <p style="font-size: 14px; color: #374151;">A request was made to update your registered Super Admin mobile number to <strong>${nationalPhone}</strong>.</p>
        <p style="font-size: 14px; color: #374151;">Use the verification code below to authorize this change:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f766e; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          ${otpCode}
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-bottom: 0;">This code expires in 5 minutes. If you did not initiate this request, your existing account and mobile number remain completely protected.</p>
      </div>`,
    });
  }

  // Check if dev fallback should supply the code (e.g. dev mode)
  const isDevMode = process.env.OTP_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
  const shouldExposeDevCode = isDevMode;

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
      deliveryChannel: smsResult.success && emailResult.success ? "SMS_AND_EMAIL" : smsResult.success ? "SMS" : emailResult.success ? "EMAIL" : "DEV_FALLBACK",
    },
  });

  let deliveryMessage = "";
  if (smsResult.success && emailResult.success) {
    deliveryMessage = `Verification code dispatched via SMS to ${nationalPhone} and emailed to ${user.email}.`;
  } else if (smsResult.success) {
    deliveryMessage = `Verification code dispatched via SMS to ${nationalPhone}.`;
  } else if (emailResult.success) {
    deliveryMessage = `Verification code dispatched to your registered administrator email (${user.email}).`;
  } else if (isDevMode) {
    deliveryMessage = `Verification code generated for ${nationalPhone} (Dev mode active).`;
  } else {
    return fail("Unable to deliver verification code. SMS provider is unconfigured and admin email is unavailable.", 502);
  }

  return ok({
    ok: true,
    challengeId: challenge.id,
    phone: nationalPhone,
    ttlSeconds: OTP_CONFIG.ttlSeconds,
    smsDelivered: smsResult.success,
    emailDelivered: emailResult.success,
    message: deliveryMessage,
    devCode: shouldExposeDevCode ? otpCode : undefined,
  });
});
