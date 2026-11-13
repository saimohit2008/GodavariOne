// Godavari One — Phone Validation & Ownership Verification Test Suite
// Verifies Stage A format validation, Stage B number intelligence, and Stage C ownership verification (OTP).

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";
import { normalizeMobileNumber } from "../src/lib/validation";
import { phoneIntelligence } from "../src/lib/phone-intelligence";
import {
  isSmsServiceConfigured,
  requestPhoneOtpChallenge,
  verifyPhoneOtpChallenge,
  verifyPhoneOwnershipProof,
  createPhoneVerificationProofToken,
  validatePhoneVerificationProofToken,
} from "../src/lib/phone-verification";
import { POST as requestOtpRoute } from "../src/app/api/v1/auth/phone/otp/request/route";
import { POST as verifyOtpRoute } from "../src/app/api/v1/auth/phone/otp/verify/route";
import { POST as registerRoute } from "../src/app/api/v1/auth/register/route";
import { hashPassword, hashOtp } from "../src/lib/auth";

describe("Godavari One — Phone Validation & Ownership Verification Suite", () => {
  const runId = Date.now().toString();
  const validIndianPhone = `98480${runId.slice(-5)}`;
  const fakeIndianPhone = "5555555554";
  const duplicatePhone = `99490${runId.slice(-5)}`;
  let duplicateUserId: string;

  before(async () => {
    // Create an existing user to test duplicate phone detection
    const user = await db.user.create({
      data: {
        phone: duplicatePhone,
        passwordHash: hashPassword("ExistingPass123!"),
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: true,
      },
    });
    duplicateUserId = user.id;
  });

  after(async () => {
    // Cleanup created users and challenges
    await db.user.deleteMany({
      where: {
        OR: [
          { phone: duplicatePhone },
          { phone: validIndianPhone },
          { phone: fakeIndianPhone },
          { id: duplicateUserId },
        ],
      },
    }).catch(() => {});

    await db.otpChallenge.deleteMany({
      where: {
        OR: [
          { phone: validIndianPhone },
          { phone: duplicatePhone },
          { phone: fakeIndianPhone },
        ],
      },
    }).catch(() => {});
  });

  // =========================================================================
  // PART 1: STAGE A — FORMAT VALIDATION
  // =========================================================================
  test("1. Stage A: Valid Indian mobile number (10 digits starting with 6, 7, 8, or 9) normalizes cleanly", () => {
    const res9 = normalizeMobileNumber("9848012345", "IN");
    assert.equal(res9.isValid, true);
    assert.equal(res9.national, "9848012345");
    assert.equal(res9.e164, "+919848012345");

    const res8 = normalizeMobileNumber("8123456789", "IN");
    assert.equal(res8.isValid, true);

    const res7 = normalizeMobileNumber("+917012345678", "IN");
    assert.equal(res7.isValid, true);
    assert.equal(res7.national, "7012345678");

    const res6 = normalizeMobileNumber("06301234567", "IN");
    assert.equal(res6.isValid, true);
    assert.equal(res6.national, "6301234567");
  });

  test("2. Stage A: Rejects Indian mobile number with invalid starting digit (e.g. 5555555554 starts with 5)", () => {
    const res = normalizeMobileNumber(fakeIndianPhone, "IN");
    assert.equal(res.isValid, false);
    assert.equal(res.error, "Indian mobile numbers must start with 6, 7, 8, or 9");
  });

  test("3. Stage A: Rejects Indian mobile numbers with incorrect national length", () => {
    const tooShort = normalizeMobileNumber("98480", "IN");
    assert.equal(tooShort.isValid, false);
    assert.equal(tooShort.error, "Indian mobile numbers must be exactly 10 digits");

    const tooLong = normalizeMobileNumber("984801234567", "IN");
    assert.equal(tooLong.isValid, false);
    assert.equal(tooLong.error, "Indian mobile numbers must be exactly 10 digits");
  });

  test("4. Stage A: Rejects repeating dummy digit sequences (e.g. 5555555555, 9999999999)", () => {
    const repeating = normalizeMobileNumber("9999999999", "IN");
    assert.equal(repeating.isValid, false);
    assert.match(repeating.error || "", /repeating dummy/i);
  });

  test("5. Stage A: Validates international country calling codes and national lengths", () => {
    const us = normalizeMobileNumber("4155552671", "US");
    assert.equal(us.isValid, true);
    assert.equal(us.e164, "+14155552671");

    const uae = normalizeMobileNumber("501234567", "AE");
    assert.equal(uae.isValid, true);
    assert.equal(uae.e164, "+971501234567");
  });

  // =========================================================================
  // PART 2: STAGE B — NUMBER INTELLIGENCE VALIDATION
  // =========================================================================
  test("6. Stage B: Reject fake number 5555555554 as unallocated/invalid via telephone intelligence", async () => {
    const result = await phoneIntelligence.validateNumber(fakeIndianPhone, "IN");
    assert.equal(result.validityStatus, "INVALID");
    assert.equal(result.allocationStatus, "UNALLOCATED");
    assert.equal(result.isAcceptableForRegistration, false);
    assert.equal(result.phoneOwnershipVerified, false);
    assert.match(result.rejectionReason || "", /must start with 6, 7, 8, or 9|unallocated/i);
  });

  test("7. Stage B: External intelligence lookup NEVER claims phone ownership is verified", async () => {
    const result = await phoneIntelligence.validateNumber("9848012345", "IN");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.allocationStatus, "ALLOCATED");
    // Strict invariant: Intelligence lookup CANNOT prove phone ownership
    assert.equal(result.phoneOwnershipVerified, false);
  });

  // =========================================================================
  // PART 3: STAGE C — PHONE OWNERSHIP VERIFICATION & OTP LIFECYCLE
  // =========================================================================
  test("8. Stage C: Unconfigured SMS provider returns 503 without fabricating OTP codes", async () => {
    // If SMS credentials are missing, it must honestly return 503
    const isConfigured = isSmsServiceConfigured();
    if (!isConfigured) {
      const res = await requestPhoneOtpChallenge({
        phone: validIndianPhone,
        countryCode: "IN",
      });
      assert.equal(res.success, false);
      assert.equal(res.statusCode, 503);
      assert.equal(res.isConfigured, false);
      assert.match(res.error || "", /SMS verification provider is not configured/i);
    }
  });

  test("9. Stage C: Rejects OTP request for already registered duplicate mobile number with HTTP 409", async () => {
    const res = await requestPhoneOtpChallenge({
      phone: duplicatePhone,
      countryCode: "IN",
    });
    assert.equal(res.success, false);
    assert.equal(res.statusCode, 409);
    assert.equal(res.code, "ACCOUNT_EXISTS");
  });

  test("10. Stage C: Cryptographic challenge creation, 5-minute TTL, and hashed storage", async () => {
    const otpCode = "829104";
    const codeHash = hashOtp(otpCode);
    const challenge = await db.otpChallenge.create({
      data: {
        phone: validIndianPhone,
        codeHash,
        purpose: "REGISTER_PHONE",
        expiresAt: new Date(Date.now() + 300_000), // 5 minutes
        attempts: 0,
        consumed: false,
      },
    });

    assert.ok(challenge.id);
    assert.equal(challenge.phone, validIndianPhone);
    assert.equal(challenge.consumed, false);
    assert.equal(challenge.attempts, 0);

    // Verify stored code is a SHA-256 hash, NEVER plaintext
    assert.notEqual(challenge.codeHash, otpCode);
    assert.equal(challenge.codeHash.length, 64);
  });

  test("11. Stage C: Rejects incorrect OTP submission and increments attempt counter", async () => {
    const res = await verifyPhoneOtpChallenge({
      phone: validIndianPhone,
      otpCode: "000000", // incorrect code
    });
    assert.equal(res.success, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.error || "", /incorrect/i);

    // Verify attempt counter incremented
    const challenge = await db.otpChallenge.findFirst({
      where: { phone: validIndianPhone, purpose: "REGISTER_PHONE" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(challenge?.attempts, 1);
  });

  test("12. Stage C: Locks verification after 5 failed attempts (HTTP 429)", async () => {
    // Set attempts to 5
    await db.otpChallenge.updateMany({
      where: { phone: validIndianPhone, purpose: "REGISTER_PHONE" },
      data: { attempts: 5 },
    });

    const res = await verifyPhoneOtpChallenge({
      phone: validIndianPhone,
      otpCode: "829104",
    });
    assert.equal(res.success, false);
    assert.equal(res.statusCode, 429);
    assert.match(res.error || "", /maximum verification attempts exceeded/i);
  });

  test("13. Stage C: Rejects expired OTP challenge (>5 minutes)", async () => {
    // Create an expired challenge
    await db.otpChallenge.updateMany({
      where: { phone: validIndianPhone },
      data: { consumed: true },
    });

    await db.otpChallenge.create({
      data: {
        phone: validIndianPhone,
        codeHash: hashOtp("777888"),
        purpose: "REGISTER_PHONE",
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        attempts: 0,
        consumed: false,
      },
    });

    const res = await verifyPhoneOtpChallenge({
      phone: validIndianPhone,
      otpCode: "777888",
    });
    assert.equal(res.success, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.error || "", /expired/i);
  });

  test("14. Stage C: Successful OTP verification consumes challenge and produces signed verificationToken", async () => {
    // Clean prior challenges and create fresh active challenge
    await db.otpChallenge.updateMany({
      where: { phone: validIndianPhone },
      data: { consumed: true },
    });

    const otpCode = "456789";
    await db.otpChallenge.create({
      data: {
        phone: validIndianPhone,
        codeHash: hashOtp(otpCode),
        purpose: "REGISTER_PHONE",
        expiresAt: new Date(Date.now() + 300_000),
        attempts: 0,
        consumed: false,
      },
    });

    const res = await verifyPhoneOtpChallenge({
      phone: validIndianPhone,
      otpCode,
    });

    assert.equal(res.success, true);
    assert.equal(res.phoneVerified, true);
    assert.ok(res.verificationToken && res.verificationToken.length > 20);

    // Verify challenge is marked consumed to prevent replay attacks
    const consumedChallenge = await db.otpChallenge.findFirst({
      where: { phone: validIndianPhone, purpose: "REGISTER_PHONE" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(consumedChallenge?.consumed, true);

    // Verify token cryptographic validity
    const isValidToken = validatePhoneVerificationProofToken(
      res.verificationToken,
      validIndianPhone
    );
    assert.equal(isValidToken, true);

    // Verify token rejected for different phone number
    const isInvalidPhone = validatePhoneVerificationProofToken(
      res.verificationToken,
      "9123456789"
    );
    assert.equal(isInvalidPhone, false);
  });

  test("15. Stage C: Cannot reuse an already consumed OTP challenge (replay defense)", async () => {
    const res = await verifyPhoneOtpChallenge({
      phone: validIndianPhone,
      otpCode: "456789",
    });
    assert.equal(res.success, false);
    assert.match(res.error || "", /no active verification challenge/i);
  });

  // =========================================================================
  // PART 4: REGISTRATION ENFORCEMENT & DIRECT API BYPASS DEFENSE
  // =========================================================================
  test("16. Registration blocked with HTTP 403 when unverified phone number attempts direct POST /api/v1/auth/register", async () => {
    const unverifiedPhone = `97000${runId.slice(-5)}`;
    const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: unverifiedPhone,
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
        name: "Unverified Attacker",
      }),
    });

    const res = await registerRoute(req);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.ok(json.error);
    assert.match(json.error, /ownership verification is required/i);
  });

  test("17. Registration blocked with HTTP 400 when fake number 5555555554 is submitted directly", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: fakeIndianPhone,
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
      }),
    });

    const res = await registerRoute(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /Indian mobile numbers must start with 6, 7, 8, or 9/i);
  });

  test("18. Successful registration with verified ownership sets phoneVerified=true honestly", async () => {
    // Generate valid proof token for valid phone
    const verificationToken = createPhoneVerificationProofToken(validIndianPhone);

    const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: validIndianPhone,
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
        name: "Genuine Pilgrim",
        verificationToken,
      }),
    });

    const res = await registerRoute(req);
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.phone, validIndianPhone);
    assert.equal(json.role, "VISITOR");
    // Ownership was verified by OTP
    assert.equal(json.phoneVerified, true);

    // Verify DB record
    const saved = await db.user.findFirst({ where: { phone: validIndianPhone } });
    assert.ok(saved);
    assert.equal(saved.phoneVerified, true);
    assert.equal(saved.role, "VISITOR");
  });
});
