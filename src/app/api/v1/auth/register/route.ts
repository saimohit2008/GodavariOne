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
import { phoneIntelligence } from "@/lib/phone-intelligence";
import { verifyPhoneOwnershipProof } from "@/lib/phone-verification";

// POST /api/v1/auth/register — visitor registration with verified mobile number and password.
// Enforces Stage A format validation, Stage B number intelligence, and Stage C ownership verification.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const {
    phone,
    password,
    confirmPassword,
    name,
    email,
    countryCode,
    otpCode,
    verificationToken,
  } = body as {
    phone?: string;
    password?: string;
    confirmPassword?: string;
    name?: string;
    email?: string;
    countryCode?: string;
    otpCode?: string;
    verificationToken?: string;
  };

  if (!phone || typeof phone !== "string") {
    return fail("Mobile number is required", 400);
  }
  if (!password || typeof password !== "string") {
    return fail("Password is required", 400);
  }

  // 1. Stage A: Validate and normalize the mobile number with international support
  const phoneNorm = normalizeMobileNumber(phone, countryCode);
  if (!phoneNorm.isValid) {
    return fail(phoneNorm.error || "Invalid mobile number format", 400);
  }

  // 2. Stage B: Validate number intelligence (reject unallocated, VoIP, fake test ranges)
  const intel = await phoneIntelligence.validateNumber(
    phoneNorm.e164 || phoneNorm.primary,
    phoneNorm.countryCode
  );
  if (!intel.isAcceptableForRegistration) {
    return fail(
      intel.rejectionReason || "Mobile number is not acceptable for registration",
      400
    );
  }

  // 3. Stage C: Verify phone ownership before allowing account creation
  const ownership = await verifyPhoneOwnershipProof(phoneNorm, {
    verificationToken,
    otpCode,
  });
  if (!ownership.verified) {
    return fail(
      ownership.error ||
        "Mobile number ownership verification is required to complete registration. Please verify your mobile number with an OTP challenge first.",
      403,
      { code: "PHONE_VERIFICATION_REQUIRED" }
    );
  }

  // 4. Validate the password against security policy
  const pwCheck = validatePasswordPolicy(password);
  if (!pwCheck.isValid) {
    return fail(pwCheck.error || "Password does not meet security requirements", 400);
  }

  // 5. Ensure the password and confirmation match if confirmPassword was supplied
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return fail("Password and confirmation password do not match", 400);
  }

  // 6. Check whether the mobile number already belongs to an existing account
  const existing = await db.user.findFirst({
    where: {
      OR: buildPhoneQueryFilter(phoneNorm),
    },
  });

  if (existing) {
    return fail(
      "An account with this mobile number already exists. Please log in instead.",
      409,
      { code: "ACCOUNT_EXISTS", phone: phoneNorm.primary }
    );
  }

  // 7. Hash the password using scrypt
  const passwordHash = hashPassword(password);

  // Optional email normalization if provided
  const normalizedEmail = email && typeof email === "string" && email.trim().includes("@")
    ? email.toLowerCase().trim()
    : null;

  // 8. Store user record with default least-privileged role (VISITOR).
  // phoneVerified is true ONLY because Stage C ownership verification succeeded above.
  const user = await db.user.create({
    data: {
      phone: phoneNorm.primary,
      passwordHash,
      name: name ? String(name).trim().slice(0, 100) : null,
      email: normalizedEmail,
      role: "VISITOR",
      status: "ACTIVE",
      phoneVerified: true,
      emailVerified: false,
    },
  });

  // Clean up any pending registrations with that phone
  await db.pendingRegistration.deleteMany({
    where: { OR: buildPhoneQueryFilter(phoneNorm) },
  }).catch(() => {});

  // 9. Sign the user in after successful verified account creation
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
      method: "VERIFIED_MOBILE_PASSWORD",
      phoneVerified: true,
      role: user.role,
    },
  });

  // Native-specific token delivery
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
