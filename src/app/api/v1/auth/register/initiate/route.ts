import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, OTP_CONFIG } from "@/lib/auth";
import { ok, fail, handler, phoneSchema, passwordSchema, zodError } from "@/lib/validation";
import { normalizeToE164, toNationalPhone } from "@/lib/twilio";
import { sendEmailVerification } from "@/lib/resend";
import { z } from "zod";

// POST /api/v1/auth/register/initiate
// Step 1: User enters name, phone, email, and password.
// Registers a pending registration session and dispatches 6-digit email OTP via Resend.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    name: z.string().min(1).max(100),
    phone: phoneSchema,
    email: z.string().email(),
    password: passwordSchema,
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { name, phone, email, password } = parsed.data;

  const nationalPhone = toNationalPhone(phone);
  const normalizedE164 = normalizeToE164(phone);
  const normalizedEmail = email.toLowerCase().trim();

  // Check existing users
  const existingUser = await db.user.findFirst({
    where: {
      OR: [{ phone: nationalPhone }, { phone: normalizedE164 }, { email: normalizedEmail }],
    },
  });
  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      return fail("An account with this email address already exists", 409);
    }
    return fail("An account with this phone number already exists", 409);
  }

  // Check cooldown on recent requests
  const recentPending = await db.pendingRegistration.findFirst({
    where: {
      phone: nationalPhone,
      createdAt: { gt: new Date(Date.now() - OTP_CONFIG.resendCooldownMs) },
    },
  });
  if (recentPending) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(recentPending.createdAt).getTime()) / 1000);
    const waitSeconds = Math.max(1, Math.ceil(OTP_CONFIG.resendCooldownMs / 1000 - elapsedSeconds));
    return fail(`Please wait ${waitSeconds} seconds before requesting another verification code.`, 429);
  }

  // Save pending registration record
  const passwordHash = hashPassword(password);
  await db.pendingRegistration.upsert({
    where: { phone: nationalPhone },
    update: {
      name,
      email: normalizedEmail,
      passwordHash,
      phoneVerified: false,
      emailVerified: false,
      expiresAt: new Date(Date.now() + 1800 * 1000), // 30 minutes
    },
    create: {
      name,
      phone: nationalPhone,
      email: normalizedEmail,
      passwordHash,
      phoneVerified: false,
      emailVerified: false,
      expiresAt: new Date(Date.now() + 1800 * 1000),
    },
  });

  // Dispatch real 6-digit email OTP via Resend
  const emailResult = await sendEmailVerification({
    email: normalizedEmail,
    name,
  });

  if (!emailResult.success) {
    await db.pendingRegistration.deleteMany({ where: { phone: nationalPhone } }).catch(() => {});
    return fail(`Email delivery is BLOCKED: ${emailResult.error}`, 503);
  }

  return ok({
    ok: true,
    email: normalizedEmail,
    phone: nationalPhone,
    service: "resend_email",
    ttlSeconds: 900,
    message: "Verification code sent to your email address via Resend.",
  });
});
