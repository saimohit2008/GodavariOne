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

import { hashPassword, createSession } from "../src/lib/auth";
import { hashVerificationToken, EMAIL_VERIFY_CONFIG } from "../src/lib/resend";

// Route Handlers
import { POST as requestEmailRoute } from "../src/app/api/v1/admin/account/email/request/route";
import { POST as confirmEmailRoute } from "../src/app/api/v1/admin/account/email/confirm/route";

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

describe("Godavari One — Super Admin Verified Email Binding & Account Security Suite", () => {
  const ADMIN_PASSWORD = "CorrectAdminSecretPassword2026!";
  const TEST_ADMIN_ID = "test_super_admin_email_recovery";
  const TEST_ADMIN_PHONE = "9999990001";
  const TEST_VISITOR_ID = "test_regular_visitor_email";
  const TEST_OTHER_USER_ID = "test_other_user_email";
  const TARGET_EMAIL = "saimohitangara@gmail.com";
  const CONFLICT_EMAIL = "conflict.user@godavari.one";

  let adminSessionToken: string;
  let visitorSessionToken: string;

  before(async () => {
    // Clean up test records
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { email: TARGET_EMAIL },
          { email: CONFLICT_EMAIL },
          { userId: TEST_ADMIN_ID },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });

    // 1. Seed Super Admin account with NULL email (reproducing production state)
    await prisma.user.create({
      data: {
        id: TEST_ADMIN_ID,
        phone: TEST_ADMIN_PHONE,
        email: null,
        name: "Godavari One Administrator",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: false,
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

    // 3. Seed another user with existing registered email for collision testing
    await prisma.user.create({
      data: {
        id: TEST_OTHER_USER_ID,
        phone: "9999990003",
        email: CONFLICT_EMAIL,
        name: "Conflict User",
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: true,
        passwordHash: hashPassword("OtherPassword123!"),
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
    await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { email: TARGET_EMAIL },
          { email: CONFLICT_EMAIL },
          { userId: TEST_ADMIN_ID },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_ADMIN_ID, TEST_VISITOR_ID, TEST_OTHER_USER_ID] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up verification tokens for clean test state
    await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { email: TARGET_EMAIL },
          { userId: TEST_ADMIN_ID },
        ],
      },
    });
  });

  describe("Phase 1: POST /api/v1/admin/account/email/request — Security & Verification", () => {
    it("1. Rejects unauthenticated request with HTTP 401", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/request", undefined, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
      });
      const res = await requestEmailRoute(req);
      assert.strictEqual(res.status, 401, "Unauthenticated call must return HTTP 401");
      const body = await res.json();
      assert.match(body.error, /authentication required/i);
    });

    it("2. Rejects non-admin authenticated caller (VISITOR) with HTTP 403", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/request", visitorSessionToken, {
        currentPassword: "VisitorPassword123!",
        newEmail: TARGET_EMAIL,
      });
      const res = await requestEmailRoute(req);
      assert.strictEqual(res.status, 403, "Non-admin user must return HTTP 403");
      const body = await res.json();
      assert.match(body.error, /insufficient permissions/i);
    });

    it("3. Rejects incorrect current password with HTTP 400 and logs audit failure", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/request", adminSessionToken, {
        currentPassword: "WrongPassword999!",
        newEmail: TARGET_EMAIL,
      });
      const res = await requestEmailRoute(req);
      assert.strictEqual(res.status, 400, "Wrong password must return HTTP 400");
      const body = await res.json();
      assert.match(body.error, /incorrect current password/i);

      // Verify audit failure was recorded
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          actorId: TEST_ADMIN_ID,
          action: "ADMIN_EMAIL_CHANGE_FAILED",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(auditEntry, "Audit failure record must be created");
      assert.match(auditEntry.details || "", /INCORRECT_CURRENT_PASSWORD/);
    });

    it("4. Rejects malformed email address with HTTP 422 (Zod schema validation)", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: "not-an-email",
      });
      const res = await requestEmailRoute(req);
      assert.strictEqual(res.status, 422, "Malformed email must return HTTP 422");
      const body = await res.json();
      assert.match(body.error, /validation failed/i);
    });

    it("5. Rejects email already registered to another user with HTTP 409 Conflict", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: CONFLICT_EMAIL,
      });
      const res = await requestEmailRoute(req);
      assert.strictEqual(res.status, 409, "Duplicate registered email must return HTTP 409");
      const body = await res.json();
      assert.match(body.error, /already registered/i);
    });

    it("6. Successfully initiates challenge, generates OTP, hashes token, and sets 15-min TTL", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
      });
      const res = await requestEmailRoute(req);
      assert.strictEqual(res.status, 200, "Valid request must return HTTP 200");
      const body = await res.json();
      assert.strictEqual(body.ok, true);
      assert.strictEqual(body.email, TARGET_EMAIL);
      assert.strictEqual(body.ttlSeconds, EMAIL_VERIFY_CONFIG.tokenTtlSeconds);

      // Verify token record in database
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: {
          userId: TEST_ADMIN_ID,
          email: TARGET_EMAIL,
          consumed: false,
        },
      });
      assert.ok(tokenRecord, "EmailVerificationToken must be created in DB");
      assert.strictEqual(tokenRecord.tokenHash.length, 64, "Token hash must be SHA-256 (64 hex chars)");
      assert.ok(tokenRecord.expiresAt > new Date(), "Token must not be expired");

      // Verify devCode exposed in test/dev mode for testing
      assert.ok(body.devCode, "devCode is present in test mode");
      assert.strictEqual(body.devCode.length, 6, "OTP code must be 6 digits");
      assert.strictEqual(
        tokenRecord.tokenHash,
        hashVerificationToken(body.devCode),
        "Stored hash must match SHA-256 of the generated code"
      );
    });

    it("7. Enforces 60-second cooldown on consecutive requests with HTTP 429", async () => {
      // First request succeeds
      const req1 = createReq("POST", "/api/v1/admin/account/email/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
      });
      const res1 = await requestEmailRoute(req1);
      assert.strictEqual(res1.status, 200);

      // Immediate second request within 60s must fail with HTTP 429
      const req2 = createReq("POST", "/api/v1/admin/account/email/request", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
      });
      const res2 = await requestEmailRoute(req2);
      assert.strictEqual(res2.status, 429, "Immediate repeat request must return HTTP 429");
      const body2 = await res2.json();
      assert.match(body2.error, /wait \d+ seconds/i);
    });
  });

  describe("Phase 2: POST /api/v1/admin/account/email/confirm — Cryptographic Verification & Binding", () => {
    it("1. Rejects unauthenticated confirm request with HTTP 401", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/confirm", undefined, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
        otpCode: "123456",
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 401);
    });

    it("2. Rejects non-admin caller (VISITOR) with HTTP 403", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/confirm", visitorSessionToken, {
        currentPassword: "VisitorPassword123!",
        newEmail: TARGET_EMAIL,
        otpCode: "123456",
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 403);
    });

    it("3. Rejects confirmation with incorrect current password with HTTP 400", async () => {
      const req = createReq("POST", "/api/v1/admin/account/email/confirm", adminSessionToken, {
        currentPassword: "WrongPassword123!",
        newEmail: TARGET_EMAIL,
        otpCode: "123456",
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.match(body.error, /incorrect current password/i);
    });

    it("4. Rejects invalid OTP submission with HTTP 400 and increments attempts", async () => {
      const testCode = "654321";
      await prisma.emailVerificationToken.create({
        data: {
          userId: TEST_ADMIN_ID,
          email: TARGET_EMAIL,
          tokenHash: hashVerificationToken(testCode),
          expiresAt: new Date(Date.now() + 900000),
          consumed: false,
          attempts: 0,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/email/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
        otpCode: "999999", // Wrong code
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.match(body.error, /invalid verification code/i);

      // Verify attempts counter was incremented
      const token = await prisma.emailVerificationToken.findFirst({
        where: { userId: TEST_ADMIN_ID, email: TARGET_EMAIL },
      });
      assert.strictEqual(token?.attempts, 1, "Token attempts counter must increment to 1");
      assert.strictEqual(token?.consumed, false, "Token must remain unconsumed");
    });

    it("5. Rejects expired OTP (>15 minutes) with HTTP 400", async () => {
      const testCode = "123789";
      await prisma.emailVerificationToken.create({
        data: {
          userId: TEST_ADMIN_ID,
          email: TARGET_EMAIL,
          tokenHash: hashVerificationToken(testCode),
          expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
          consumed: false,
          attempts: 0,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/email/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
        otpCode: testCode,
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.match(body.error, /expired/i);
    });

    it("6. Rejects OTP when maximum 5 attempts ceiling is reached with HTTP 429", async () => {
      const testCode = "456123";
      await prisma.emailVerificationToken.create({
        data: {
          userId: TEST_ADMIN_ID,
          email: TARGET_EMAIL,
          tokenHash: hashVerificationToken(testCode),
          expiresAt: new Date(Date.now() + 900000),
          consumed: false,
          attempts: 5, // Ceiling reached
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/email/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
        otpCode: testCode,
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 429);
      const body = await res.json();
      assert.match(body.error, /maximum verification attempts exceeded/i);

      // Verify token was marked consumed to prevent further brute-force
      const token = await prisma.emailVerificationToken.findFirst({
        where: { userId: TEST_ADMIN_ID, email: TARGET_EMAIL },
      });
      assert.strictEqual(token?.consumed, true, "Locked token must be consumed");
    });

    it("7. Enforces replay protection: cannot reuse an already consumed token", async () => {
      const testCode = "889900";
      await prisma.emailVerificationToken.create({
        data: {
          userId: TEST_ADMIN_ID,
          email: TARGET_EMAIL,
          tokenHash: hashVerificationToken(testCode),
          expiresAt: new Date(Date.now() + 900000),
          consumed: true, // Already consumed
          attempts: 1,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/email/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
        otpCode: testCode,
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.match(body.error, /no active verification code found/i);
    });

    it("8. Successfully verifies valid OTP, executes transactional binding, preserves invariants, and records audit", async () => {
      const testCode = "554433";
      const tokenRecord = await prisma.emailVerificationToken.create({
        data: {
          userId: TEST_ADMIN_ID,
          email: TARGET_EMAIL,
          tokenHash: hashVerificationToken(testCode),
          expiresAt: new Date(Date.now() + 900000),
          consumed: false,
          attempts: 0,
        },
      });

      const req = createReq("POST", "/api/v1/admin/account/email/confirm", adminSessionToken, {
        currentPassword: ADMIN_PASSWORD,
        newEmail: TARGET_EMAIL,
        otpCode: testCode,
      });
      const res = await confirmEmailRoute(req);
      assert.strictEqual(res.status, 200, "Valid OTP confirmation must succeed with HTTP 200");
      const body = await res.json();
      assert.strictEqual(body.ok, true);
      assert.strictEqual(body.user.email, TARGET_EMAIL);
      assert.strictEqual(body.user.emailVerified, true);

      // Verify token was consumed
      const updatedToken = await prisma.emailVerificationToken.findUnique({
        where: { id: tokenRecord.id },
      });
      assert.strictEqual(updatedToken?.consumed, true, "Token must be marked consumed");

      // Verify User record in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: TEST_ADMIN_ID },
      });
      assert.strictEqual(updatedUser?.id, TEST_ADMIN_ID, "Account ID invariant preserved");
      assert.strictEqual(updatedUser?.role, "SUPER_ADMIN", "Role invariant preserved");
      assert.strictEqual(updatedUser?.phone, TEST_ADMIN_PHONE, "Phone number invariant preserved");
      assert.strictEqual(updatedUser?.email, TARGET_EMAIL, "Email updated to target address");
      assert.strictEqual(updatedUser?.emailVerified, true, "emailVerified set to true");

      // Verify AuditLog record
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actorId: TEST_ADMIN_ID,
          action: "ADMIN_EMAIL_BOUND",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(auditLog, "Audit log record for ADMIN_EMAIL_BOUND must exist");
      assert.match(auditLog.details || "", /saimohitangara@gmail\.com/);
      assert.strictEqual(auditLog.targetId, TEST_ADMIN_ID);
    });
  });
});
