import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  createSession,
  setSessionCookie,
  audit,
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogin,
  verifyDummyPassword,
  isTrustedNativeClient,
} from "@/lib/auth";
import {
  fail,
  ok,
  handler,
  getClientIp,
  normalizeMobileNumber,
  buildPhoneQueryFilter,
} from "@/lib/validation";

// POST /api/v1/auth/login — mobile number + password login
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const { phone, password, countryCode } = body as { phone?: string; password?: string; countryCode?: string };
  if (!phone || !password) return fail("Mobile number and password are required", 400);

  // 1. Normalize the mobile number using the same rules as registration
  const phoneNorm = normalizeMobileNumber(phone, countryCode);
  if (!phoneNorm.isValid) {
    return fail(phoneNorm.error || "Invalid mobile number format", 400);
  }

  // 6. Apply rate limiting and failed-login protections
  const ip = getClientIp(req) || "unknown";
  const rateLimit = checkLoginRateLimit(phoneNorm.primary, ip);
  if (rateLimit.blocked) {
    return fail(
      `Too many failed login attempts. Please try again after ${rateLimit.retryAfterMinutes} minutes.`,
      429
    );
  }

  // 2. Look up the account securely across normalized phone variations
  const user = await db.user.findFirst({
    where: {
      OR: buildPhoneQueryFilter(phoneNorm),
    },
  });

  // Account enumeration protection: perform dummy verification when account not found or lacks password
  if (!user || !user.passwordHash) {
    verifyDummyPassword();
    recordFailedLogin(phoneNorm.primary, ip);
    await audit({
      action: "LOGIN_FAILED",
      targetType: "USER",
      ip,
      details: { phone: phoneNorm.primary, reason: "ACCOUNT_NOT_FOUND_OR_NO_PASSWORD" },
    });
    return fail("Invalid mobile number or password.", 401);
  }

  // 3. Verify the submitted password against the stored password hash
  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    recordFailedLogin(phoneNorm.primary, ip);
    await audit({
      actorId: user.id,
      action: "LOGIN_FAILED",
      targetType: "USER",
      targetId: user.id,
      ip,
      details: { phone: phoneNorm.primary, reason: "INCORRECT_PASSWORD" },
    });
    return fail("Invalid mobile number or password.", 401);
  }

  // Check account status
  if (user.status !== "ACTIVE") {
    return fail(`Account is ${user.status.toLowerCase()}. Contact support.`, 403);
  }

  // Super Admins must use the dedicated admin-login endpoint (with MFA step)
  if (user.role === "SUPER_ADMIN") {
    return fail("Administrators must log in through the secure admin portal", 403);
  }

  // Success: Clear failed login attempts counter
  clearFailedLogin(phoneNorm.primary, ip);

  // 4. Create existing secure server-side session and sign the user in
  const session = await createSession(user.id, "PASSWORD");
  await setSessionCookie(session.token);
  await audit({
    actorId: user.id,
    action: "LOGIN",
    targetType: "USER",
    targetId: user.id,
    ip,
    details: { method: "MOBILE_PASSWORD" },
  });

  // Native-specific token delivery: strictly verify authentic native client before delivering token
  const isNativeClient = isTrustedNativeClient(req);

  return ok({
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
