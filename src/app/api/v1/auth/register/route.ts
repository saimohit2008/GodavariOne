import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie, audit, isTrustedNativeClient } from "@/lib/auth";
import {
  created,
  fail,
  handler,
  getClientIp,
  normalizeMobileNumber,
  buildPhoneQueryFilter,
  validatePasswordPolicy,
} from "@/lib/validation";

// POST /api/v1/auth/register — visitor registration with mobile number and password
// Works completely without email OTP or paid SMS provider.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const { phone, password, confirmPassword, name, email } = body as {
    phone?: string;
    password?: string;
    confirmPassword?: string;
    name?: string;
    email?: string;
    otpCode?: string; // accepted optionally for backward compatibility
  };

  if (!phone || typeof phone !== "string") {
    return fail("Mobile number is required", 400);
  }
  if (!password || typeof password !== "string") {
    return fail("Password is required", 400);
  }

  // 1. Validate and normalize the mobile number
  const phoneNorm = normalizeMobileNumber(phone);
  if (!phoneNorm.isValid) {
    return fail(phoneNorm.error || "Invalid mobile number format", 400);
  }

  // 2. Validate the password against a sensible password policy
  const pwCheck = validatePasswordPolicy(password);
  if (!pwCheck.isValid) {
    return fail(pwCheck.error || "Password does not meet security requirements", 400);
  }

  // 3. Ensure the password and confirmation match if confirmPassword was supplied
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return fail("Password and confirmation password do not match", 400);
  }

  // 4. Check whether the mobile number already belongs to an account
  const existing = await db.user.findFirst({
    where: {
      OR: buildPhoneQueryFilter(phoneNorm),
    },
  });

  // 5. If it already exists, show a helpful message directing the user to log in
  if (existing) {
    return fail(
      "An account with this mobile number already exists. Please log in instead.",
      409,
      { code: "ACCOUNT_EXISTS", phone: phoneNorm.primary }
    );
  }

  // 6. Hash the password using scrypt (Node built-in secure implementation)
  const passwordHash = hashPassword(password);

  // Optional email normalization if provided
  const normalizedEmail = email && typeof email === "string" && email.trim().includes("@")
    ? email.toLowerCase().trim()
    : null;

  // 7, 8, 9. Store mobile number and password hash in the database. Never store plaintext passwords.
  // Assign only the application's existing default, least-privileged role (VISITOR).
  // Section 5: Track verification status honestly — phoneVerified is false until SMS verification occurs.
  const user = await db.user.create({
    data: {
      phone: phoneNorm.primary,
      passwordHash,
      name: name ? String(name).trim().slice(0, 100) : null,
      email: normalizedEmail,
      role: "VISITOR",
      status: "ACTIVE",
      phoneVerified: false,
      emailVerified: false,
    },
  });

  // Clean up any pending registrations with that phone
  await db.pendingRegistration.deleteMany({
    where: { OR: buildPhoneQueryFilter(phoneNorm) },
  }).catch(() => {});

  // 10. Sign the user in only after successful account creation
  const session = await createSession(user.id, "PASSWORD");
  await setSessionCookie(session.token);

  await audit({
    actorId: user.id,
    action: "USER_REGISTER",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: {
      phone: user.phone,
      method: "MOBILE_PASSWORD",
      phoneVerified: false,
      role: user.role,
    },
  });

  // Native-specific token delivery: strictly verify authentic native client before delivering token
  const isNativeClient = isTrustedNativeClient(req);

  return created({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    ...(isNativeClient ? { token: session.token } : {}),
  });
});
