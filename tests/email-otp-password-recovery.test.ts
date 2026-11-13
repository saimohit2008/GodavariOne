import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

// Configure isolated test database
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.OTP_DEV_MODE = "true";
(process.env as any).NODE_ENV = "test";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, verifyPassword, createSession } from "../src/lib/auth";
import {
  PASSWORD_RESET_CONFIG,
  getResetEmailKey,
  getResetTokenKey,
  hashResetToken,
} from "../src/lib/password-recovery";

// Route Handlers
import { POST as forgotPasswordRoute } from "../src/app/api/v1/auth/password/forgot/route";
import { POST as verifyOtpRoute } from "../src/app/api/v1/auth/password/verify/route";
import { POST as resetPasswordRoute } from "../src/app/api/v1/auth/password/reset/route";
import { POST as loginRoute } from "../src/app/api/v1/auth/login/route";
import { POST as adminLoginRoute } from "../src/app/api/v1/auth/admin-login/route";

function createReq(method: string, url: string, body?: any, ip = "127.0.0.1"): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": ip,
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Godavari One — Secure Email OTP Password Recovery Test Suite", () => {
  const INITIAL_PASSWORD = "OldSecretPassword2026!";
  const NEW_SECURE_PASSWORD = "BrandNewSecurePassword2027#";
  const ADMIN_INITIAL_PASSWORD = "AdminInitialPassword2026!";
  const ADMIN_NEW_PASSWORD = "AdminBrandNewPassword2027#";

  const TEST_USER_ID = "test_user_pwd_recovery";
  const TEST_USER_PHONE = "9999880001";
  const TEST_USER_EMAIL = "recovery.user@godavari.one";

  const UNVERIFIED_USER_ID = "test_unverified_pwd_user";
  const UNVERIFIED_USER_PHONE = "9999880002";
  const UNVERIFIED_USER_EMAIL = "unverified.user@godavari.one";

  const TEST_ADMIN_ID = "test_super_admin_pwd_recovery";
  const TEST_ADMIN_PHONE = "9999880003";
  const TEST_ADMIN_EMAIL = "superadmin.recovery@godavari.one";

  before(async () => {
    // Clean up test records
    await prisma.session.deleteMany({
      where: { userId: { in: [TEST_USER_ID, UNVERIFIED_USER_ID, TEST_ADMIN_ID] } },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { email: { contains: "recovery.user@godavari.one" } },
          { email: { contains: "unverified.user@godavari.one" } },
          { email: { contains: "superadmin.recovery@godavari.one" } },
          { userId: { in: [TEST_USER_ID, UNVERIFIED_USER_ID, TEST_ADMIN_ID] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [TEST_USER_ID, UNVERIFIED_USER_ID, TEST_ADMIN_ID] } },
          { phone: { in: [TEST_USER_PHONE, UNVERIFIED_USER_PHONE, TEST_ADMIN_PHONE] } },
          { email: { in: [TEST_USER_EMAIL, UNVERIFIED_USER_EMAIL, TEST_ADMIN_EMAIL] } },
        ],
      },
    });

    // 1. Seed active verified user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        name: "Recovery Test User",
        phone: TEST_USER_PHONE,
        email: TEST_USER_EMAIL,
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: true,
        passwordHash: hashPassword(INITIAL_PASSWORD),
      },
    });

    // 2. Seed active unverified user
    await prisma.user.create({
      data: {
        id: UNVERIFIED_USER_ID,
        name: "Unverified User",
        phone: UNVERIFIED_USER_PHONE,
        email: UNVERIFIED_USER_EMAIL,
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: false,
        passwordHash: hashPassword(INITIAL_PASSWORD),
      },
    });

    // 3. Seed active Super Admin with TOTP MFA enabled
    await prisma.user.create({
      data: {
        id: TEST_ADMIN_ID,
        name: "Super Admin Recovery Test",
        phone: TEST_ADMIN_PHONE,
        email: TEST_ADMIN_EMAIL,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: true,
        mfaSecret: "JBSWY3DPEHPK3PXP",
        passwordHash: hashPassword(ADMIN_INITIAL_PASSWORD),
      },
    });
  });

  after(async () => {
    await prisma.session.deleteMany({
      where: { userId: { in: [TEST_USER_ID, UNVERIFIED_USER_ID, TEST_ADMIN_ID] } },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { email: { contains: "recovery.user@godavari.one" } },
          { email: { contains: "unverified.user@godavari.one" } },
          { email: { contains: "superadmin.recovery@godavari.one" } },
          { userId: { in: [TEST_USER_ID, UNVERIFIED_USER_ID, TEST_ADMIN_ID] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_ID, UNVERIFIED_USER_ID, TEST_ADMIN_ID] } },
    });
  });

  // -------------------------------------------------------------------------
  // PHASE 1: POST /api/v1/auth/password/forgot
  // -------------------------------------------------------------------------
  describe("Phase 1: POST /api/v1/auth/password/forgot", () => {
    it("1. Rejects missing or malformed email address with HTTP 422", async () => {
      const req = createReq("POST", "/api/v1/auth/password/forgot", { email: "not-an-email" });
      const res = await forgotPasswordRoute(req);
      assert.equal(res.status, 422);
      const json = await res.json();
      assert.equal(json.error, "Validation failed");
    });

    it("2. Returns generic success response for non-existent email to prevent account enumeration", async () => {
      const nonExistentEmail = "nobody.exists.here@godavari.one";
      const req = createReq("POST", "/api/v1/auth/password/forgot", { email: nonExistentEmail });
      const res = await forgotPasswordRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.match(json.message, /If an account exists/i);

      // Verify no token was created in DB
      const token = await prisma.emailVerificationToken.findFirst({
        where: { email: getResetEmailKey(nonExistentEmail) },
      });
      assert.equal(token, null);
    });

    it("3. Returns generic success response for unverified email without generating OTP", async () => {
      const req = createReq("POST", "/api/v1/auth/password/forgot", { email: UNVERIFIED_USER_EMAIL });
      const res = await forgotPasswordRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.match(json.message, /If an account exists/i);

      // Verify unverified user did NOT get a reset token
      const token = await prisma.emailVerificationToken.findFirst({
        where: { email: getResetEmailKey(UNVERIFIED_USER_EMAIL) },
      });
      assert.equal(token, null);
    });

    it("4. Successfully initiates password reset for verified user, creates token with 15-min TTL and hashed code", async () => {
      const req = createReq("POST", "/api/v1/auth/password/forgot", { email: TEST_USER_EMAIL });
      const res = await forgotPasswordRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.ok(json.devCode, "devCode should be returned in test/dev mode");
      assert.equal(json.devCode.length, 6);

      // Check DB persistence
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { email: getResetEmailKey(TEST_USER_EMAIL), consumed: false },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(tokenRecord);
      assert.equal(tokenRecord.userId, TEST_USER_ID);
      assert.equal(tokenRecord.tokenHash, hashResetToken(json.devCode));
      assert.equal(tokenRecord.consumed, false);
      assert.equal(tokenRecord.attempts, 0);

      // Check 15-minute expiration
      const ttlMs = new Date(tokenRecord.expiresAt).getTime() - new Date(tokenRecord.createdAt).getTime();
      assert.ok(ttlMs >= 890 * 1000 && ttlMs <= 905 * 1000);
    });

    it("5. Enforces 60-second cooldown on consecutive requests with HTTP 429", async () => {
      const req = createReq("POST", "/api/v1/auth/password/forgot", { email: TEST_USER_EMAIL });
      const res = await forgotPasswordRoute(req);
      assert.equal(res.status, 429);
      const json = await res.json();
      assert.match(json.error, /Please wait \d+ seconds before requesting another/i);
    });

    it("6. Invalidates previous unconsumed reset tokens when a new request is made after cooldown", async () => {
      // Artificially age the existing token past cooldown window
      await prisma.emailVerificationToken.updateMany({
        where: { email: getResetEmailKey(TEST_USER_EMAIL) },
        data: { createdAt: new Date(Date.now() - 70 * 1000) },
      });

      const req = createReq("POST", "/api/v1/auth/password/forgot", { email: TEST_USER_EMAIL });
      const res = await forgotPasswordRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.devCode);

      // Verify that old token is marked consumed: true and new token is consumed: false
      const activeTokens = await prisma.emailVerificationToken.findMany({
        where: { email: getResetEmailKey(TEST_USER_EMAIL), consumed: false },
      });
      assert.equal(activeTokens.length, 1);
      assert.equal(activeTokens[0].tokenHash, hashResetToken(json.devCode));
    });
  });

  // -------------------------------------------------------------------------
  // PHASE 2: POST /api/v1/auth/password/verify
  // -------------------------------------------------------------------------
  describe("Phase 2: POST /api/v1/auth/password/verify", () => {
    let currentCode: string;

    beforeEach(async () => {
      // Clear tokens and issue fresh challenge
      await prisma.emailVerificationToken.deleteMany({
        where: { email: { contains: TEST_USER_EMAIL } },
      });
      currentCode = "654321";
      await prisma.emailVerificationToken.create({
        data: {
          email: getResetEmailKey(TEST_USER_EMAIL),
          tokenHash: hashResetToken(currentCode),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          userId: TEST_USER_ID,
        },
      });
    });

    it("7. Rejects verify request for uninitiated email with HTTP 400", async () => {
      const req = createReq("POST", "/api/v1/auth/password/verify", {
        email: "unknown@godavari.one",
        otpCode: "123456",
      });
      const res = await verifyOtpRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /No active password reset code found/i);
    });

    it("8. Rejects invalid OTP submission and increments attempt counter", async () => {
      const req = createReq("POST", "/api/v1/auth/password/verify", {
        email: TEST_USER_EMAIL,
        otpCode: "000000",
      });
      const res = await verifyOtpRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /Invalid verification code/i);

      // Verify attempt count in DB
      const record = await prisma.emailVerificationToken.findFirst({
        where: { email: getResetEmailKey(TEST_USER_EMAIL), consumed: false },
      });
      assert.equal(record?.attempts, 1);
    });

    it("9. Rejects expired OTP with HTTP 400", async () => {
      // Expire the token
      await prisma.emailVerificationToken.updateMany({
        where: { email: getResetEmailKey(TEST_USER_EMAIL) },
        data: { expiresAt: new Date(Date.now() - 10 * 1000) },
      });

      const req = createReq("POST", "/api/v1/auth/password/verify", {
        email: TEST_USER_EMAIL,
        otpCode: currentCode,
      });
      const res = await verifyOtpRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /expired/i);
    });

    it("10. Locks challenge with HTTP 429 when maximum 5 attempts is reached", async () => {
      // Set attempts to 5
      await prisma.emailVerificationToken.updateMany({
        where: { email: getResetEmailKey(TEST_USER_EMAIL) },
        data: { attempts: 5 },
      });

      const req = createReq("POST", "/api/v1/auth/password/verify", {
        email: TEST_USER_EMAIL,
        otpCode: currentCode,
      });
      const res = await verifyOtpRoute(req);
      assert.equal(res.status, 429);
      const json = await res.json();
      assert.match(json.error, /Too many incorrect verification attempts/i);
    });

    it("11. Successfully verifies valid OTP, marks OTP consumed, and returns 256-bit resetToken", async () => {
      const req = createReq("POST", "/api/v1/auth/password/verify", {
        email: TEST_USER_EMAIL,
        otpCode: currentCode,
      });
      const res = await verifyOtpRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.ok(json.resetToken);
      assert.equal(json.resetToken.length, 64); // 32 bytes hex

      // Verify original OTP is now consumed: true
      const otpRecord = await prisma.emailVerificationToken.findFirst({
        where: { email: getResetEmailKey(TEST_USER_EMAIL), tokenHash: hashResetToken(currentCode) },
      });
      assert.equal(otpRecord?.consumed, true);

      // Verify resetToken record was created in DB
      const resetTokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { email: getResetTokenKey(TEST_USER_EMAIL), consumed: false },
      });
      assert.ok(resetTokenRecord);
      assert.equal(resetTokenRecord.tokenHash, hashResetToken(json.resetToken));
      assert.equal(resetTokenRecord.userId, TEST_USER_ID);
    });

    it("12. Enforces replay protection: cannot reuse an already consumed OTP", async () => {
      // First verify: marks consumed
      const req1 = createReq("POST", "/api/v1/auth/password/verify", {
        email: TEST_USER_EMAIL,
        otpCode: currentCode,
      });
      const res1 = await verifyOtpRoute(req1);
      assert.equal(res1.status, 200);

      // Second verify with same code must fail
      const req2 = createReq("POST", "/api/v1/auth/password/verify", {
        email: TEST_USER_EMAIL,
        otpCode: currentCode,
      });
      const res2 = await verifyOtpRoute(req2);
      assert.equal(res2.status, 400);
      const json2 = await res2.json();
      assert.match(json2.error, /No active password reset code found/i);
    });
  });

  // -------------------------------------------------------------------------
  // PHASE 3: POST /api/v1/auth/password/reset
  // -------------------------------------------------------------------------
  describe("Phase 3: POST /api/v1/auth/password/reset", () => {
    let validResetToken: string;

    beforeEach(async () => {
      // Clear tokens and issue fresh resetToken
      await prisma.emailVerificationToken.deleteMany({
        where: { email: { contains: TEST_USER_EMAIL } },
      });
      validResetToken = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
      await prisma.emailVerificationToken.create({
        data: {
          email: getResetTokenKey(TEST_USER_EMAIL),
          tokenHash: hashResetToken(validResetToken),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          userId: TEST_USER_ID,
        },
      });
    });

    it("13. Rejects reset request without resetToken or otpCode with HTTP 400", async () => {
      const req = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        newPassword: NEW_SECURE_PASSWORD,
        confirmPassword: NEW_SECURE_PASSWORD,
      });
      const res = await resetPasswordRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /Either a verified resetToken or an otpCode is required/i);
    });

    it("14. Rejects password and confirmation mismatch with HTTP 400", async () => {
      const req = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: validResetToken,
        newPassword: NEW_SECURE_PASSWORD,
        confirmPassword: "MismatchPassword123#",
      });
      const res = await resetPasswordRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /do not match/i);
    });

    it("15. Rejects weak password failing complexity policy (<8 chars or missing numbers)", async () => {
      // 15a. Too short (<8 chars) returns 422 (Zod input validation)
      const shortReq = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: validResetToken,
        newPassword: "short1!",
        confirmPassword: "short1!",
      });
      const shortRes = await resetPasswordRoute(shortReq);
      assert.equal(shortRes.status, 422);

      // 15b. >=8 chars but missing numbers returns 400 (Password complexity policy)
      const noNumReq = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: validResetToken,
        newPassword: "AllLettersOnlyNoNumbers!",
        confirmPassword: "AllLettersOnlyNoNumbers!",
      });
      const noNumRes = await resetPasswordRoute(noNumReq);
      assert.equal(noNumRes.status, 400);

      // 15c. >=8 chars but missing letters returns 400 (Password complexity policy)
      const noLetterReq = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: validResetToken,
        newPassword: "12345678901234!!",
        confirmPassword: "12345678901234!!",
      });
      const noLetterRes = await resetPasswordRoute(noLetterReq);
      assert.equal(noLetterRes.status, 400);
    });

    it("16. Rejects expired or invalid resetToken with HTTP 400", async () => {
      const req = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: "invalid_tampered_token_hash_00000000000000000000000000000000000000",
        newPassword: NEW_SECURE_PASSWORD,
        confirmPassword: NEW_SECURE_PASSWORD,
      });
      const res = await resetPasswordRoute(req);
      assert.equal(res.status, 400);
    });

    it("17. Successfully resets password, invalidates sessions, preserves role, and verifies user can login with new password", async () => {
      // 1. Create active session for test user
      const existingSession = await createSession(TEST_USER_ID, "PASSWORD");

      // 2. Execute password reset
      const req = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: validResetToken,
        newPassword: NEW_SECURE_PASSWORD,
        confirmPassword: NEW_SECURE_PASSWORD,
      });
      const res = await resetPasswordRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);

      // 3. Verify user record in DB: passwordHash changed, role is preserved as VISITOR
      const updatedUser = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      assert.ok(updatedUser);
      assert.equal(updatedUser.role, "VISITOR");
      assert.equal(updatedUser.status, "ACTIVE");
      assert.ok(verifyPassword(NEW_SECURE_PASSWORD, updatedUser.passwordHash!));
      assert.equal(verifyPassword(INITIAL_PASSWORD, updatedUser.passwordHash!), false);

      // 4. Verify existing session was revoked
      const revokedSession = await prisma.session.findUnique({ where: { id: existingSession.id } });
      assert.ok(revokedSession?.revokedAt !== null);

      // 5. Verify user CANNOT log in with old password
      const oldLoginReq = createReq("POST", "/api/v1/auth/login", {
        phone: TEST_USER_PHONE,
        password: INITIAL_PASSWORD,
      });
      const oldLoginRes = await loginRoute(oldLoginReq);
      assert.equal(oldLoginRes.status, 401);

      // 6. Verify user CAN log in with NEW password
      const newLoginReq = createReq("POST", "/api/v1/auth/login", {
        phone: TEST_USER_PHONE,
        password: NEW_SECURE_PASSWORD,
      });
      const newLoginRes = await loginRoute(newLoginReq);
      assert.equal(newLoginRes.status, 200);
      const loginJson = await newLoginRes.json();
      assert.equal(loginJson.id, TEST_USER_ID);
      assert.equal(loginJson.role, "VISITOR");
    });

    it("18. Enforces replay protection on resetToken: cannot reset password twice with same token", async () => {
      // First attempt succeeds
      const req1 = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: validResetToken,
        newPassword: NEW_SECURE_PASSWORD,
        confirmPassword: NEW_SECURE_PASSWORD,
      });
      const res1 = await resetPasswordRoute(req1);
      assert.equal(res1.status, 200);

      // Second attempt with same token must fail
      const req2 = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        resetToken: validResetToken,
        newPassword: "AnotherPassword123#",
        confirmPassword: "AnotherPassword123#",
      });
      const res2 = await resetPasswordRoute(req2);
      assert.equal(res2.status, 400);
    });

    it("19. Supports atomic password reset via direct otpCode submission without intermediate token", async () => {
      // Issue fresh OTP
      const atomicOtp = "789123";
      await prisma.emailVerificationToken.create({
        data: {
          email: getResetEmailKey(TEST_USER_EMAIL),
          tokenHash: hashResetToken(atomicOtp),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          userId: TEST_USER_ID,
        },
      });

      const nextPassword = "AtomicPasswordUpdated2027#";
      const req = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_USER_EMAIL,
        otpCode: atomicOtp,
        newPassword: nextPassword,
        confirmPassword: nextPassword,
      });
      const res = await resetPasswordRoute(req);
      assert.equal(res.status, 200);

      // Verify user has new password
      const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      assert.ok(verifyPassword(nextPassword, user!.passwordHash!));

      // Verify OTP is consumed
      const token = await prisma.emailVerificationToken.findFirst({
        where: { email: getResetEmailKey(TEST_USER_EMAIL), tokenHash: hashResetToken(atomicOtp) },
      });
      assert.equal(token?.consumed, true);
    });
  });

  // -------------------------------------------------------------------------
  // PHASE 4: SUPER ADMIN PROTECTION & TOTP MFA INTEGRITY
  // -------------------------------------------------------------------------
  describe("Phase 4: Super Admin Protection & TOTP MFA Integrity", () => {
    it("20. Super Admin can recover account via verified email, role remains SUPER_ADMIN and TOTP MFA remains enabled", async () => {
      // 1. Issue OTP for Super Admin
      const adminOtp = "888999";
      await prisma.emailVerificationToken.deleteMany({
        where: { email: { contains: TEST_ADMIN_EMAIL } },
      });
      await prisma.emailVerificationToken.create({
        data: {
          email: getResetEmailKey(TEST_ADMIN_EMAIL),
          tokenHash: hashResetToken(adminOtp),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          userId: TEST_ADMIN_ID,
        },
      });

      // 2. Perform direct password reset for Super Admin
      const req = createReq("POST", "/api/v1/auth/password/reset", {
        email: TEST_ADMIN_EMAIL,
        otpCode: adminOtp,
        newPassword: ADMIN_NEW_PASSWORD,
        confirmPassword: ADMIN_NEW_PASSWORD,
      });
      const res = await resetPasswordRoute(req);
      assert.equal(res.status, 200);

      // 3. Confirm Super Admin record invariants
      const admin = await prisma.user.findUnique({ where: { id: TEST_ADMIN_ID } });
      assert.ok(admin);
      assert.equal(admin.role, "SUPER_ADMIN", "Super Admin role must NOT be altered or demoted");
      assert.equal(admin.mfaEnabled, true, "TOTP MFA must remain ENABLED");
      assert.equal(admin.mfaSecret, "JBSWY3DPEHPK3PXP", "TOTP MFA Secret must remain intact");
      assert.ok(verifyPassword(ADMIN_NEW_PASSWORD, admin.passwordHash!), "New password must verify");

      // 4. Verify Super Admin cannot log in with old password via admin-login
      const oldAdminReq = createReq("POST", "/api/v1/auth/admin-login", {
        phone: TEST_ADMIN_PHONE,
        password: ADMIN_INITIAL_PASSWORD,
      });
      const oldAdminRes = await adminLoginRoute(oldAdminReq);
      assert.equal(oldAdminRes.status, 401);

      // 5. Verify Super Admin CAN log in with new password via admin-login AND MFA is required
      const newAdminReq = createReq("POST", "/api/v1/auth/admin-login", {
        phone: TEST_ADMIN_PHONE,
        password: ADMIN_NEW_PASSWORD,
      });
      const newAdminRes = await adminLoginRoute(newAdminReq);
      assert.equal(newAdminRes.status, 200);
      const adminLoginJson = await newAdminRes.json();
      assert.equal(adminLoginJson.userId, TEST_ADMIN_ID);
      assert.equal(adminLoginJson.requiresMfa, true, "MFA must still be required on admin login");
    });
  });
});
