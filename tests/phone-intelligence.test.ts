import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  phoneIntelligence,
  PhoneIntelligenceService,
  MockPhoneIntelligenceProvider,
  PhoneIntelligenceResult,
} from "../src/lib/phone-intelligence";
import {
  normalizeMobileNumber,
} from "../src/lib/validation";
import {
  SUPPORTED_COUNTRIES,
  getCountryByCode,
  getCountryByCallingCode,
  guessCountryFromPhone,
} from "../src/lib/country-data";
import { POST as validatePhoneRoute } from "../src/app/api/v1/auth/phone/validate/route";

describe("Godavari One — International Phone Number Intelligence Suite (NO SMS OTP)", () => {
  // -------------------------------------------------------------------------
  // 1. Valid Mobile Numbers (Domestic & International)
  // -------------------------------------------------------------------------
  test("1. Valid Indian mobile number validates format, carrier, and allocation without SMS OTP", async () => {
    const result = await phoneIntelligence.validateNumber("9876543210", "IN");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.allocationStatus, "ALLOCATED");
    assert.equal(result.lineType, "MOBILE");
    assert.ok(result.carrierName && result.carrierName.length > 0);
    assert.equal(result.isAcceptableForRegistration, true);
    // CRITICAL INVARIANT: External validation must NEVER claim ownership is verified!
    assert.equal(result.phoneOwnershipVerified, false);
    assert.equal(result.callingCode, "+91");
  });

  test("2. Valid US international mobile number validates with country code and E.164 normalization", async () => {
    const result = await phoneIntelligence.validateNumber("4155552671", "US");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.allocationStatus, "ALLOCATED");
    assert.equal(result.lineType, "MOBILE");
    assert.equal(result.countryCode, "US");
    assert.equal(result.callingCode, "+1");
    assert.equal(result.phoneE164, "+14155552671");
    assert.equal(result.isAcceptableForRegistration, true);
    assert.equal(result.phoneOwnershipVerified, false);
  });

  test("3. Valid UK international mobile number with leading zero normalizes cleanly", async () => {
    const result = await phoneIntelligence.validateNumber("07911123456", "GB");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.lineType, "MOBILE");
    assert.equal(result.countryCode, "GB");
    assert.equal(result.callingCode, "+44");
    assert.equal(result.phoneE164, "+447911123456");
    assert.equal(result.isAcceptableForRegistration, true);
    assert.equal(result.phoneOwnershipVerified, false);
  });

  test("4. Valid UAE international mobile number normalizes with +971 calling code", async () => {
    const result = await phoneIntelligence.validateNumber("501234567", "AE");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.lineType, "MOBILE");
    assert.equal(result.countryCode, "AE");
    assert.equal(result.callingCode, "+971");
    assert.equal(result.phoneE164, "+971501234567");
    assert.equal(result.isAcceptableForRegistration, true);
    assert.equal(result.phoneOwnershipVerified, false);
  });

  // -------------------------------------------------------------------------
  // 2. Syntax, Calling Code & Length Validation
  // -------------------------------------------------------------------------
  test("5. Rejects too short or malformed phone number structure", async () => {
    const result = await phoneIntelligence.validateNumber("12345", "IN");
    assert.equal(result.validityStatus, "INVALID");
    assert.equal(result.isAcceptableForRegistration, false);
    assert.ok(result.rejectionReason && result.rejectionReason.length > 0);
  });

  test("6. Guess country from phone string correctly identifies +44, +1, +971 prefixes", () => {
    const guessUK = guessCountryFromPhone("+447911123456");
    assert.equal(guessUK.country.code, "GB");
    assert.equal(guessUK.nationalNumber, "7911123456");

    const guessUS = guessCountryFromPhone("+14155552671");
    assert.equal(guessUS.country.code, "US");
    assert.equal(guessUS.nationalNumber, "4155552671");

    const guessUAE = guessCountryFromPhone("+971501234567");
    assert.equal(guessUAE.country.code, "AE");
    assert.equal(guessUAE.nationalNumber, "501234567");
  });

  // -------------------------------------------------------------------------
  // 3. Unallocated Range & Number Restrictions
  // -------------------------------------------------------------------------
  test("7. Clearly unallocated number range is identified and rejected", async () => {
    // E.g., in North America, 555-0100 through 555-0199 are fictional/unallocated
    const result = await phoneIntelligence.validateNumber("+15550199", "US");
    assert.equal(result.validityStatus, "INVALID");
    assert.equal(result.allocationStatus, "UNALLOCATED");
    assert.equal(result.isAcceptableForRegistration, false);
    assert.match(result.rejectionReason || "", /unallocated|invalid/i);
  });

  // -------------------------------------------------------------------------
  // 4. Landline & VoIP Number Detection
  // -------------------------------------------------------------------------
  test("8. Landline number is correctly identified and rejected for mobile registration", async () => {
    const result = await phoneIntelligence.validateNumber("2125551234", "US");
    assert.equal(result.lineType, "LANDLINE");
    assert.equal(result.isAcceptableForRegistration, false);
    assert.match(result.rejectionReason || "", /landline/i);
    assert.equal(result.phoneOwnershipVerified, false);
  });

  test("9. Virtual VoIP number is correctly identified and rejected for registration", async () => {
    const result = await phoneIntelligence.validateNumber("+15558647000", "US");
    assert.equal(result.lineType, "VOIP");
    assert.equal(result.isAcceptableForRegistration, false);
    assert.match(result.rejectionReason || "", /voip/i);
    assert.equal(result.phoneOwnershipVerified, false);
  });

  // -------------------------------------------------------------------------
  // 5. Provider Resilience & Error Handling
  // -------------------------------------------------------------------------
  test("10. Provider timeout falls back gracefully to structural validation without false rejection", async () => {
    // Number containing 9999999990 triggers simulated timeout in mock engine
    const result = await phoneIntelligence.validateNumber("9999999990", "IN");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.allocationStatus, "UNKNOWN");
    assert.equal(result.reachabilityStatus, "INCONCLUSIVE");
    assert.equal(result.isAcceptableForRegistration, true);
    assert.equal(result.phoneOwnershipVerified, false);
    assert.match(result.provider, /fallback_resilience/);
  });

  test("11. Provider API 500 error falls back gracefully without breaking registration", async () => {
    // Number containing 9999999991 triggers simulated 500 error
    const result = await phoneIntelligence.validateNumber("9999999991", "IN");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.allocationStatus, "UNKNOWN");
    assert.equal(result.isAcceptableForRegistration, true);
    assert.equal(result.phoneOwnershipVerified, false);
    assert.match(result.provider, /fallback_resilience/);
  });

  test("12. Provider rate limiting (429) falls back gracefully to structural validation", async () => {
    // Number containing 9999999992 triggers simulated 429
    const result = await phoneIntelligence.validateNumber("9999999992", "IN");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.isAcceptableForRegistration, true);
    assert.equal(result.phoneOwnershipVerified, false);
  });

  test("13. Incomplete provider coverage handles result gracefully without falsely claiming invalid", async () => {
    // Number containing 7777777777 triggers simulated partial coverage
    const result = await phoneIntelligence.validateNumber("7777777777", "IN");
    assert.equal(result.validityStatus, "VALID");
    assert.equal(result.allocationStatus, "UNKNOWN");
    assert.equal(result.reachabilityStatus, "INCONCLUSIVE");
    assert.equal(result.isAcceptableForRegistration, true);
  });

  // -------------------------------------------------------------------------
  // 6. Database Independence & Separation of Verification States
  // -------------------------------------------------------------------------
  test("14. POST /api/v1/auth/phone/validate executes lookup independently of database user records", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/phone/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9876543210", countryCode: "IN" }),
    });

    const res = await validatePhoneRoute(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.data);
    assert.equal(body.data.validityStatus, "VALID");
    assert.equal(body.data.allocationStatus, "ALLOCATED");
    assert.equal(body.data.lineType, "MOBILE");
    assert.equal(body.data.phoneOwnershipVerified, false);
    // Guarantee no user account existence is leaked
    assert.equal(body.data.userExists, undefined);
    assert.equal(body.data.accountExists, undefined);
  });

  test("15. POST /api/v1/auth/phone/validate rejects empty payload with HTTP 422", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/phone/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "" }),
    });

    const res = await validatePhoneRoute(req);
    assert.equal(res.status, 422);
  });
});
