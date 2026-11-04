import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, verifyOtp, OTP_CONFIG, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp, phoneSchema, zodError } from "@/lib/validation";
import { toNationalPhone, normalizeToE164 } from "@/lib/twilio";
import { z } from "zod";

// POST /api/v1/admin/account/phone/confirm
// Step 2 of Super Admin mobile number change:
// Validates current password, verifies 6-digit OTP challenge, and updates mobile number.
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPhone: phoneSchema,
    otpCode: z.string().min(4, "Verification code must be at least 4 digits").max(10, "Code too long"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { currentPassword, newPhone, otpCode } = parsed.data;

  // Retrieve user record
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
    return fail("Incorrect current password. Password confirmation is required to apply the change.", 400);
  }

  // Normalize new phone
  const nationalPhone = toNationalPhone(newPhone);
  const e164Phone = normalizeToE164(newPhone);

  // Validate that new phone is different from existing phone
  if (nationalPhone === toNationalPhone(user.phone)) {
    return fail("New mobile number cannot be identical to your current mobile number.", 400);
  }

  // Check if phone was taken by another user
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

  // Find latest active, unconsumed, unexpired OTP challenge for this user and new phone
  const challenge = await db.otpChallenge.findFirst({
    where: {
      userId: user.id,
      phone: nationalPhone,
      purpose: "CHANGE_PHONE",
      consumed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return fail("No active verification code found or the code has expired. Please request a new verification code.", 400);
  }

  // Enforce maximum attempts
  if (challenge.attempts >= OTP_CONFIG.maxAttempts) {
    await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumed: true },
    });
    return fail("Maximum verification attempts exceeded. Please request a new verification code.", 429);
  }

  // Verify OTP code
  const isCodeValid = verifyOtp(otpCode.trim(), challenge.codeHash);
  if (!isCodeValid) {
    await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return fail("Invalid verification code. Please check the code and try again.", 400);
  }

  // Mark challenge as consumed
  await db.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumed: true },
  });

  // Apply change to the existing user record
  const oldPhone = user.phone;
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      phone: nationalPhone,
      phoneVerified: true,
    },
  });

  // Record audit log
  await audit({
    actorId: user.id,
    action: "ADMIN_PHONE_CHANGED",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: {
      oldPhone,
      newPhone: nationalPhone,
      verifiedVia: "OTP",
    },
  });

  // Create notification
  await notify({
    userId: user.id,
    type: "SECURITY_UPDATE",
    title: "Mobile Number Changed",
    message: `Your Super Admin mobile number was updated from ${oldPhone} to ${nationalPhone}. Use this number for all subsequent administrative logins.`,
  });

  return ok({
    ok: true,
    message: `Mobile number successfully updated to ${nationalPhone}. Please use this number for future logins.`,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      phoneVerified: updatedUser.phoneVerified,
    },
  });
});
