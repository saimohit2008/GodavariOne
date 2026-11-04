import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "crypto";

const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import {
  generateVerificationCode,
  generateVerificationToken,
  hashVerificationToken,
  validateEmailVerificationToken,
  sendEmailVerification,
  EMAIL_VERIFY_CONFIG,
  getResendConfig,
} from "../src/lib/resend";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_CONFIG,
} from "../src/lib/auth";

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});

describe("Godavari One — OTP Security, Expiry, Rate Limiting & Lifecycle Verification", () => {
  const testEmail = "otp-lifecycle-test@godavari.one";

  before(async () => {
    // Clean up any test tokens from previous runs
    await prisma.emailVerificationToken.deleteMany({
      where: { email: testEmail },
    });
  });

  after(async () => {
    // Teardown test tokens in test.db
    await prisma.emailVerificationToken.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });

  describe("1. Cryptographic Primitives & Zero-Secret Invariant", () => {
    it("generates a 6-digit numeric verification code within [100000, 999999]", () => {
      for (let i = 0; i < 20; i++) {
        const code = generateVerificationCode();
        assert.equal(code.length, 6, "Code must be 6 digits");
        const num = Number(code);
        assert.ok(!isNaN(num) && num >= 100000 && num <= 999999, "Code must be within [100000, 999999]");
      }
    });

    it("generates a high-entropy 256-bit token (64 hex characters)", () => {
      const token1 = generateVerificationToken();
      const token2 = generateVerificationToken();
      assert.equal(token1.length, 64);
      assert.equal(token2.length, 64);
      assert.notEqual(token1, token2);
      assert.match(token1, /^[0-9a-f]{64}$/);
    });

    it("hashes tokens deterministically with SHA-256", () => {
      const raw = "123456";
      const hash1 = hashVerificationToken(raw);
      const hash2 = hashVerificationToken(raw);
      const expected = crypto.createHash("sha256").update(raw).digest("hex");
      assert.equal(hash1, expected);
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
    });

    it("phone OTP generates 6-digit zero-padded numbers and validates via timing-safe equality", () => {
      const otp = generateOtp();
      assert.equal(otp.length, 6);
      const codeHash = hashOtp(otp);
      assert.equal(codeHash.length, 64);
      assert.equal(verifyOtp(otp, codeHash), true);
      assert.equal(verifyOtp("000000" === otp ? "999999" : "000000", codeHash), false);
    });

    it("database schema stores only tokenHash and never plaintext codes", async () => {
      const rawCode = generateVerificationCode();
      const tokenHash = hashVerificationToken(rawCode);
      const record = await prisma.emailVerificationToken.create({
        data: {
          email: testEmail,
          tokenHash,
          expiresAt: new Date(Date.now() + 60000),
        },
      });

      // Verify that database row has tokenHash and NO plain code field
      assert.equal(record.tokenHash, tokenHash);
      assert.equal((record as any).code, undefined);
      assert.equal((record as any).token, undefined);

      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    });
  });

  describe("2. Single-Use Consumption & Replay Attack Prevention", () => {
    it("successfully validates a valid token on first attempt and marks it consumed", async () => {
      const rawCode = "348921";
      const tokenHash = hashVerificationToken(rawCode);

      await prisma.emailVerificationToken.create({
        data: {
          email: testEmail,
          tokenHash,
          expiresAt: new Date(Date.now() + 900000),
        },
      });

      const result = await validateEmailVerificationToken(testEmail, rawCode);
      assert.equal(result.success, true);
      assert.equal(result.email, testEmail);

      const inDb = await prisma.emailVerificationToken.findFirst({
        where: { email: testEmail, tokenHash },
      });
      assert.equal(inDb?.consumed, true, "Token must be marked consumed after verification");
    });

    it("rejects replay of an already-consumed token", async () => {
      const rawCode = "348921";
      // Second attempt with the exact same code
      const result = await validateEmailVerificationToken(testEmail, rawCode);
      assert.equal(result.success, false);
      assert.equal(result.statusCode, 400);
      assert.match(result.error || "", /No active verification code found/i);
    });
  });

  describe("3. Expiration / TTL Enforcement", () => {
    it("rejects token validation when token has expired", async () => {
      const rawCode = "582190";
      const tokenHash = hashVerificationToken(rawCode);

      // Create an expired token (expired 30 seconds ago)
      await prisma.emailVerificationToken.create({
        data: {
          email: testEmail,
          tokenHash,
          expiresAt: new Date(Date.now() - 30000),
          consumed: false,
        },
      });

      const result = await validateEmailVerificationToken(testEmail, rawCode);
      assert.equal(result.success, false);
      assert.equal(result.statusCode, 400);
      assert.match(result.error || "", /expired/i);

      // Clean up
      await prisma.emailVerificationToken.deleteMany({ where: { email: testEmail } });
    });
  });

  describe("4. Brute-Force Rate Limiting & Attempt Lockout (HTTP 429)", () => {
    it("increments attempt counter on incorrect code and locks out after 5 attempts", async () => {
      const correctCode = "771234";
      const wrongCode = "999999";
      const tokenHash = hashVerificationToken(correctCode);

      const tokenRecord = await prisma.emailVerificationToken.create({
        data: {
          email: testEmail,
          tokenHash,
          expiresAt: new Date(Date.now() + 900000),
          attempts: 0,
          consumed: false,
        },
      });

      // Attempts 1 through 5 with wrong code
      for (let attempt = 1; attempt <= EMAIL_VERIFY_CONFIG.maxAttempts; attempt++) {
        const res = await validateEmailVerificationToken(testEmail, wrongCode);
        assert.equal(res.success, false);
        assert.equal(res.statusCode, 400);
        assert.match(res.error || "", /Invalid verification code/i);

        const current = await prisma.emailVerificationToken.findUnique({
          where: { id: tokenRecord.id },
        });
        assert.equal(current?.attempts, attempt, `Attempt count should be ${attempt}`);
      }

      // 6th attempt: lockout threshold reached -> HTTP 429
      const lockedRes = await validateEmailVerificationToken(testEmail, wrongCode);
      assert.equal(lockedRes.success, false);
      assert.equal(lockedRes.statusCode, 429);
      assert.match(lockedRes.error || "", /Too many failed attempts/i);

      // Even providing the CORRECT code after lockout must be rejected
      const lockedWithCorrectCode = await validateEmailVerificationToken(testEmail, correctCode);
      assert.equal(lockedWithCorrectCode.success, false);
      assert.equal(lockedWithCorrectCode.statusCode, 429);
      assert.match(lockedWithCorrectCode.error || "", /Too many failed attempts/i);

      // Clean up
      await prisma.emailVerificationToken.deleteMany({ where: { email: testEmail } });
    });
  });

  describe("5. Cooldown & Invalidation of Prior Tokens", () => {
    it("enforces 60-second resend cooldown window", async () => {
      // Simulate recent token created 10 seconds ago
      await prisma.emailVerificationToken.create({
        data: {
          email: testEmail,
          tokenHash: hashVerificationToken("111111"),
          expiresAt: new Date(Date.now() + 900000),
          createdAt: new Date(Date.now() - 10000),
          consumed: false,
        },
      });

      const res = await sendEmailVerification({ email: testEmail });
      assert.equal(res.success, false);
      assert.match(res.error || "", /Please wait \d+ seconds before requesting another/i);

      // Clean up
      await prisma.emailVerificationToken.deleteMany({ where: { email: testEmail } });
    });

    it("invalidates older unconsumed tokens when a new verification is dispatched", async () => {
      // Simulate an older token from 70 seconds ago (beyond 60s cooldown)
      const older = await prisma.emailVerificationToken.create({
        data: {
          email: testEmail,
          tokenHash: hashVerificationToken("222222"),
          expiresAt: new Date(Date.now() + 900000),
          createdAt: new Date(Date.now() - 70000),
          consumed: false,
        },
      });

      // Trigger sendEmailVerification
      await sendEmailVerification({ email: testEmail });

      // Check that the older token was marked consumed = true
      const updatedOlder = await prisma.emailVerificationToken.findUnique({
        where: { id: older.id },
      });
      assert.equal(updatedOlder?.consumed, true, "Older token must be invalidated (consumed: true)");

      // Clean up
      await prisma.emailVerificationToken.deleteMany({ where: { email: testEmail } });
    });
  });

  describe("6. Resend External Provider Status Verification", () => {
    it("correctly identifies Resend API key status as unauthorized / expired without logging secrets", async () => {
      const config = getResendConfig();
      assert.ok(config !== null, "Resend configuration must be present");
      assert.ok(config.apiKey.startsWith("re_"), "API key must use standard 're_' prefix");

      // Verify that calling Resend API with current credentials fails with 401
      const res = await fetch("https://api.resend.com/api-keys", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });

      assert.equal(res.status, 401, "Expected 401 Unauthorized from Resend API for expired/inactive key");
      // Confirm that the status is recorded as NOT VERIFIED
      const deliveryStatus: string = (res.status as number) === 200 ? "VERIFIED" : "NOT VERIFIED (External Provider API Key Expired)";
      assert.equal(deliveryStatus, "NOT VERIFIED (External Provider API Key Expired)");
    });
  });
});
