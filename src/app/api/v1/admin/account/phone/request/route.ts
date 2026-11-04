import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, generateOtp, hashOtp, OTP_CONFIG, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp, phoneSchema, zodError } from "@/lib/validation";
import { toNationalPhone, normalizeToE164 } from "@/lib/twilio";
import { sendSms } from "@/lib/sms";
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

  // Check if dev fallback should supply the code (e.g. dev mode or SMS unconfigured)
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
      smsProvider: smsResult.success ? "SMS_GATEWAY" : "DEV_FALLBACK",
    },
  });

  return ok({
    ok: true,
    challengeId: challenge.id,
    phone: nationalPhone,
    ttlSeconds: OTP_CONFIG.ttlSeconds,
    smsDelivered: smsResult.success,
    message: smsResult.success
      ? `Verification code dispatched to ${nationalPhone}.`
      : `Verification code generated for ${nationalPhone}.`,
    devCode: shouldExposeDevCode ? otpCode : undefined,
  });
});
