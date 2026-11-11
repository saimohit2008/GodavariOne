import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

// Configure isolated test database
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.OTP_DEV_MODE = "true";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession, hashOtp } from "../src/lib/auth";

// Route Handlers
import { POST as requestPhoneRoute } from "../src/app/api/v1/admin/account/phone/request/route";
import { POST as confirmPhoneRoute } from "../src/app/api/v1/admin/account/phone/confirm/route";
import { POST as adminLoginRoute } from "../src/app/api/v1/auth/admin-login/route";

function createReq(method: string, url: string, sessionToken?: string, body?: any): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sessionToken) {
    headers["cookie"] = `godavari_session=${sessionToken}`;
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Godavari One — Super Admin Mobile Number Change OTP Verification Suite", () => {
  const ADMIN_PASSWORD = "CorrectAdminSecretPassword2026!";
  const TEST_ADMIN_ID = "test_super_admin_phone_change";
  const TEST_ADMIN_INITIAL_PHONE = "9999990001";
  const TEST_ADMIN_VERIFIED_EMAIL = "admin.verified@godavari.one";
  const TEST_VISITOR_ID = "test_regular_visitor_phone";
  const TEST_OTHER_USER_ID = "test_other_user_phone";
  const TEST_OTHER_PHONE = "9999990003";
  const NEW_TARGET_PHONE = "9876543210";

  let adminSessionToken: string;
  let visitorSessionToken: string;

  before(async () => {
    // Teardown any leftover test data
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.otpChallenge.deleteMany({
      where: {
        OR: [
          { userId: TEST_ADMIN_ID },
          { phone: { in: [TEST_ADMIN_INITIAL_PHONE, NEW_TARGET_PHONE, TEST_OTHER_PHONE] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });

    // 1. Seed Super Admin account with verified recovery email
    await prisma.user.create({
      data: {
        id: TEST_ADMIN_ID,
        phone: TEST_ADMIN_INITIAL_PHONE,
        email: TEST_ADMIN_VERIFIED_EMAIL,
        name: "Godavari One Administrator",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: true,
        passwordHash: hashPassword(ADMIN_PASSWORD),
      },
    });

    // 2. Seed regular visitor
    await prisma.user.create({
      data: {
        id: TEST_VISITOR_ID,
        phone: "9999990002",
        email: "visitor@godavari.one",
        name: "Regular Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: true,
        passwordHash: hashPassword("VisitorPassword123!"),
      },
    });

    // 3. Seed another user with conflicting phone
    await prisma.user.create({
      data: {
        id: TEST_OTHER_USER_ID,
        phone: TEST_OTHER_PHONE,
        email: "conflict@godavari.one",
        name: "Other User",
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: true,
        passwordHash: hashPassword("OtherUserPassword123!"),
      },
    });

    // Create active sessions
    const adminSession = await createSession(TEST_ADMIN_ID, "ADMIN", true);
    adminSessionToken = adminSession.token;

    const visitorSession = await createSession(TEST_VISITOR_ID, "PASSWORD", false);
    visitorSessionToken = visitorSession.token;
  });

  after(async () => {
    // Teardown
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.otpChallenge.deleteMany({
      where: {
        OR: [
          { userId: TEST_ADMIN_ID },
          { phone: { in: [TEST_ADMIN_INITIAL_PHONE, NEW_TARGET_PHONE, TEST_OTHER_PHONE] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up OTP challenges before each test
    await prisma.otpChallenge.deleteMany({
      where: {
        OR: [
          { userId: TEST_ADMIN_ID },
          { phone: { in: [NEW_TARGET_PHONE, TEST_OTHER_PHONE] } },
        ],
      },
    });

    // Ensure admin user has verified email restored
    await prisma.user.update({
      where: { id: TEST_ADMIN_ID },
      data: {
        phone: TEST_ADMIN_INITIAL_PHONE,
        email: TEST_ADMIN_VERIFIED_EMAIL,
        emailVerified: true,
      },
    });
  });

  describe("Step 1: Request Phone Change Verification (POST /api/v1/admin/account/phone/request)", () => {
    it("1. Rejects unauthenticated request with HTTP 401", async () => {
      const req = createReq("POST", "/api/v1/admin/account/phone/request", undefined, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 401, "Unauthenticated call must return HTTP 401");
      const body = await res.json();
      assert.match(body.error, /authentication required/i);
    });

    it("2. Rejects non-admin authenticated caller with HTTP 403", async () => {
      const req = createReq("POST", "/api/v1/admin/account/phone/request", visitorSessionToken, {
        currentPassword: "VisitorPassword123!",
        newPhone: NEW_TARGET_PHONE,
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 403, "Non-admin caller must return HTTP 403");
      const body = await res.json();
      assert.match(body.error, /insufficient permissions/i);
    });

    it("3. Rejects incorrect current password with HTTP 400 and logs audit failure", async () => {
      const req = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: "WrongPassword999!",
        newPhone: NEW_TARGET_PHONE,
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 400, "Wrong password must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /incorrect current password/i);

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: { actorId: TEST_ADMIN_ID, action: "ADMIN_PHONE_CHANGE_FAILED" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(auditLog, "Audit record for failed password verification must exist");
      assert.match(auditLog.details || "", /INCORRECT_CURRENT_PASSWORD/);
    });

    it("4. Rejects invalid mobile number with HTTP 422", async () => {
      const req = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: "123", // Too short
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 422, "Malformed phone number must return HTTP 422");
    });

    it("5. Rejects request when admin has no email or unverified email (HTTP 400, ADMIN_RECOVERY_EMAIL_REQUIRED)", async () => {
      // Simulate production state: email is null
      await prisma.user.update({
        where: { id: TEST_ADMIN_ID },
        data: { email: null, emailVerified: false },
      });

      const req = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 400, "Missing verified email must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /verified administrator recovery email is required/i);
      assert.strictEqual((body.details as any)?.code, "ADMIN_RECOVERY_EMAIL_REQUIRED");
    });

    it("6. Successfully requests OTP when admin email is verified, sets 15-minute TTL, hashes token, and sends via Resend", async () => {
      const req = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 200, "Valid request must return HTTP 200");
      const body = await res.json();
      assert.strictEqual(body.ok, true);
      assert.strictEqual(body.ttlSeconds, 900, "TTL must be 900 seconds (15 minutes)");
      assert.ok(body.challengeId, "Must return challengeId");
      assert.ok(body.devCode, "Must supply devCode in dev test environment");

      // Verify database record
      const challenge = await prisma.otpChallenge.findUnique({
        where: { id: body.challengeId },
      });
      assert.ok(challenge, "Challenge must be persisted in database");
      assert.strictEqual(challenge.userId, TEST_ADMIN_ID);
      assert.strictEqual(challenge.phone, NEW_TARGET_PHONE);
      assert.strictEqual(challenge.purpose, "CHANGE_PHONE");
      assert.strictEqual(challenge.consumed, false);
      assert.strictEqual(challenge.attempts, 0);

      // Verify SHA-256 hash
      const expectedHash = crypto.createHash("sha256").update(body.devCode).digest("hex");
      assert.strictEqual(challenge.codeHash, expectedHash, "Stored hash must match SHA-256 of generated OTP");

      // Verify expiration is ~15 minutes (900 seconds) in the future
      const diffMs = challenge.expiresAt.getTime() - challenge.createdAt.getTime();
      assert.ok(diffMs >= 895_000 && diffMs <= 905_000, "Expiry must be set to 15 minutes");

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: { actorId: TEST_ADMIN_ID, action: "ADMIN_PHONE_CHANGE_REQUESTED" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(auditLog, "Audit log for phone change request must exist");
    });

    it("7. Enforces 60-second cooldown on consecutive requests (HTTP 429)", async () => {
      // First request
      const req1 = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
      });
      const res1 = await requestPhoneRoute(req1);
      assert.strictEqual(res1.status, 200);

      // Immediate second request
      const req2 = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
      });
      const res2 = await requestPhoneRoute(req2);
      assert.strictEqual(res2.status, 429, "Immediate second request must trigger HTTP 429 cooldown");
      const body2 = await res2.json();
      assert.match(body2.error, /please wait \d+ seconds/i);
    });

    it("8. Invalidation of previous challenges when new OTP is requested after cooldown", async () => {
      // Create an older unconsumed challenge (simulating 65 seconds ago)
      const oldChallenge = await prisma.otpChallenge.create({
        data: {
          userId: TEST_ADMIN_ID,
          phone: NEW_TARGET_PHONE,
          purpose: "CHANGE_PHONE",
          codeHash: hashOtp("111111"),
          expiresAt: new Date(Date.now() + 800_000),
          consumed: false,
          createdAt: new Date(Date.now() - 65_000),
        },
      });

      // Request new OTP
      const req = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 200);

      // Old challenge must now be consumed/invalidated
      const recheckedOld = await prisma.otpChallenge.findUnique({
        where: { id: oldChallenge.id },
      });
      assert.strictEqual(recheckedOld?.consumed, true, "Previous challenge must be invalidated");
    });
  });

  describe("Step 2: Confirm Phone Change Verification (POST /api/v1/admin/account/phone/confirm)", () => {
    it("9. Rejects confirmation with incorrect password (HTTP 400)", async () => {
      // Seed active challenge
      await prisma.otpChallenge.create({
        data: {
          userId: TEST_ADMIN_ID,
          phone: NEW_TARGET_PHONE,
          purpose: "CHANGE_PHONE",
          codeHash: hashOtp("123456"),
          expiresAt: new Date(Date.now() + 900_000),
          consumed: false,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/phone/confirm", adminSessionToken, {
        currentPassword: "WrongPassword123!",
        newPhone: NEW_TARGET_PHONE,
        otpCode: "123456",
      });
      const res = await confirmPhoneRoute(req);
      assert.strictEqual(res.status, 400, "Incorrect password on confirm must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /incorrect current password/i);
    });

    it("10. Rejects invalid OTP submission and increments attempt counter (HTTP 400)", async () => {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: TEST_ADMIN_ID,
          phone: NEW_TARGET_PHONE,
          purpose: "CHANGE_PHONE",
          codeHash: hashOtp("654321"),
          expiresAt: new Date(Date.now() + 900_000),
          consumed: false,
          attempts: 0,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/phone/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
        otpCode: "000000", // Wrong code
      });
      const res = await confirmPhoneRoute(req);
      assert.strictEqual(res.status, 400, "Wrong OTP must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /invalid verification code/i);

      // Verify attempts incremented
      const updated = await prisma.otpChallenge.findUnique({
        where: { id: challenge.id },
      });
      assert.strictEqual(updated?.attempts, 1, "Attempt counter must increment on failure");
      assert.strictEqual(updated?.consumed, false);
    });

    it("11. Rejects expired OTP (>15 minutes) with HTTP 400", async () => {
      await prisma.otpChallenge.create({
        data: {
          userId: TEST_ADMIN_ID,
          phone: NEW_TARGET_PHONE,
          purpose: "CHANGE_PHONE",
          codeHash: hashOtp("123456"),
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          consumed: false,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/phone/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
        otpCode: "123456",
      });
      const res = await confirmPhoneRoute(req);
      assert.strictEqual(res.status, 400, "Expired OTP must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /expired/i);
    });

    it("12. Locks challenge after 5 failed attempts (HTTP 429)", async () => {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: TEST_ADMIN_ID,
          phone: NEW_TARGET_PHONE,
          purpose: "CHANGE_PHONE",
          codeHash: hashOtp("123456"),
          expiresAt: new Date(Date.now() + 900_000),
          consumed: false,
          attempts: 5, // Already reached max attempts
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/phone/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
        otpCode: "123456",
      });
      const res = await confirmPhoneRoute(req);
      assert.strictEqual(res.status, 429, "5 failed attempts must lock token with HTTP 429");
      const body = await res.json();
      assert.match(body.error, /maximum verification attempts exceeded/i);

      // Verify challenge marked consumed
      const updated = await prisma.otpChallenge.findUnique({
        where: { id: challenge.id },
      });
      assert.strictEqual(updated?.consumed, true, "Challenge must be locked/consumed");
    });

    it("13. Rejects replay of already consumed challenge (HTTP 400)", async () => {
      await prisma.otpChallenge.create({
        data: {
          userId: TEST_ADMIN_ID,
          phone: NEW_TARGET_PHONE,
          purpose: "CHANGE_PHONE",
          codeHash: hashOtp("123456"),
          expiresAt: new Date(Date.now() + 900_000),
          consumed: true, // Already consumed
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/phone/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
        otpCode: "123456",
      });
      const res = await confirmPhoneRoute(req);
      assert.strictEqual(res.status, 400, "Replay of consumed challenge must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /already been used/i);
    });

    it("14. Successfully verifies valid OTP, executes atomic phone update, verifies DB persistence, and verifies admin can log in with new phone", async () => {
      const validOtp = "842109";
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: TEST_ADMIN_ID,
          phone: NEW_TARGET_PHONE,
          purpose: "CHANGE_PHONE",
          codeHash: hashOtp(validOtp),
          expiresAt: new Date(Date.now() + 900_000),
          consumed: false,
          attempts: 0,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/phone/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: NEW_TARGET_PHONE,
        otpCode: validOtp,
      });
      const res = await confirmPhoneRoute(req);
      assert.strictEqual(res.status, 200, "Valid OTP confirmation must return HTTP 200");
      const body = await res.json();
      assert.strictEqual(body.ok, true);
      assert.strictEqual(body.user.phone, NEW_TARGET_PHONE);

      // Verify DB persistence: challenge consumed
      const updatedChallenge = await prisma.otpChallenge.findUnique({
        where: { id: challenge.id },
      });
      assert.strictEqual(updatedChallenge?.consumed, true, "Challenge must be marked consumed");

      // Verify DB persistence: user record updated with new phone and phoneVerified: true
      const updatedUser = await prisma.user.findUnique({
        where: { id: TEST_ADMIN_ID },
      });
      assert.strictEqual(updatedUser?.phone, NEW_TARGET_PHONE, "User phone must be updated to new phone");
      assert.strictEqual(updatedUser?.phoneVerified, true, "phoneVerified must be true");

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: { actorId: TEST_ADMIN_ID, action: "ADMIN_PHONE_CHANGED" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(auditLog, "Audit log for phone change must exist");

      // Verify admin can now authenticate / log in with the new phone number via admin portal
      const loginReq = createReq("POST", "/api/v1/auth/admin-login", undefined, {
        phone: NEW_TARGET_PHONE,
        password: ADMIN_PASSWORD,
      });
      const loginRes = await adminLoginRoute(loginReq);
      assert.strictEqual(loginRes.status, 200, "Admin must be able to log in with new mobile number");
      const loginBody = await loginRes.json();
      assert.strictEqual(loginBody.userId, TEST_ADMIN_ID);

      // Verify old phone can no longer be used to log in
      const oldLoginReq = createReq("POST", "/api/v1/auth/admin-login", undefined, {
        phone: TEST_ADMIN_INITIAL_PHONE,
        password: ADMIN_PASSWORD,
      });
      const oldLoginRes = await adminLoginRoute(oldLoginReq);
      assert.notStrictEqual(oldLoginRes.status, 200, "Old mobile number must no longer authenticate");
    });

    it("15. Rejects phone change if new phone is identical to current phone (HTTP 400)", async () => {
      const req = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: TEST_ADMIN_INITIAL_PHONE, // Same phone
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 400, "Identical phone must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /identical to your current mobile number/i);
    });

    it("16. Rejects phone change if new phone is already registered to another user (HTTP 409)", async () => {
      const req = createReq("POST", "/api/v1/admin/account/phone/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newPhone: TEST_OTHER_PHONE, // Already registered to TEST_OTHER_USER_ID
      });
      const res = await requestPhoneRoute(req);
      assert.strictEqual(res.status, 409, "Colliding phone must return HTTP 409");
      const body = await res.json();
      assert.match(body.error, /already registered to another account/i);
    });
  });
});
