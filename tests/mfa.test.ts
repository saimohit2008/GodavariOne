import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { NextRequest } from "next/server";

const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import { hashPassword, createSession } from "../src/lib/auth";
import { generateTotp } from "../src/lib/totp";
import { decryptMfaPayload, getEncryptionKey } from "../src/lib/mfa";
import { GET as getMfaStatus } from "../src/app/api/v1/admin/mfa/status/route";
import { GET as setupMfa } from "../src/app/api/v1/admin/mfa/setup/route";
import { POST as enableMfa } from "../src/app/api/v1/admin/mfa/enable/route";
import { POST as disableMfa } from "../src/app/api/v1/admin/mfa/disable/route";
import { POST as regenRecoveryCodes } from "../src/app/api/v1/admin/mfa/recovery-codes/route";
import { POST as adminLoginStep1 } from "../src/app/api/v1/auth/admin-login/route";
import { POST as adminLoginVerify } from "../src/app/api/v1/auth/admin-login/verify/route";

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});

function createReq(url: string, method: string, body?: any, sessionToken?: string): NextRequest {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (sessionToken) {
    headers.set("cookie", `godavari_session=${sessionToken}`);
  }
  const init: any = { method, headers };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

describe("Godavari One — Super Admin Multi-Factor Authentication (MFA) Test Suite", () => {
  let adminUser: any;
  let adminSession: any;
  let enrollmentSecret = "";
  let recoveryCodes: string[] = [];

  before(async () => {
    // Clean up previous test admin in test.db
    await prisma.session.deleteMany({ where: { user: { phone: "9999900001" } } });
    await prisma.user.deleteMany({ where: { phone: "9999900001" } });

    // Create fresh test Super Admin
    adminUser = await prisma.user.create({
      data: {
        phone: "9999900001",
        email: "mfa-admin@godavari.one",
        name: "MFA Test Super Admin",
        passwordHash: hashPassword("AdminMfaSecure2027!"),
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    adminSession = await createSession(adminUser.id, "ADMIN", true);
  });

  after(async () => {
    await prisma.session.deleteMany({ where: { userId: adminUser.id } });
    await prisma.user.deleteMany({ where: { id: adminUser.id } });
    await prisma.$disconnect();
  });

  it("1. GET /api/v1/admin/mfa/status reports MFA disabled initially", async () => {
    const req = createReq("/api/v1/admin/mfa/status", "GET", null, adminSession.token);
    const res = await getMfaStatus(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mfaEnabled, false);
    assert.equal(data.remainingRecoveryCodes, 0);
  });

  it("2. GET /api/v1/admin/mfa/setup generates secret, recovery codes, and inline SVG QR", async () => {
    const req = createReq("/api/v1/admin/mfa/setup", "GET", null, adminSession.token);
    const res = await setupMfa(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.secret && data.secret.length >= 16, "Secret must be valid Base32 string");
    assert.match(data.otpauthUri, /^otpauth:\/\/totp\/Godavari%20One:/, "Must format otpauth URI");
    assert.match(data.qrSvg, /^<svg[\s\S]*<\/svg>$/, "Must return valid SVG XML");
    assert.equal(data.recoveryCodes.length, 8, "Must generate exactly 8 recovery codes");
    assert.match(data.recoveryCodes[0], /^[A-Z0-9]{4}-[A-Z0-9]{6}$/, "Must format recovery codes");

    enrollmentSecret = data.secret;
    recoveryCodes = data.recoveryCodes;
  });

  it("3. POST /api/v1/admin/mfa/enable rejects invalid TOTP code", async () => {
    const req = createReq("/api/v1/admin/mfa/enable", "POST", { totpCode: "000000" }, adminSession.token);
    const res = await enableMfa(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Invalid authenticator code/);
  });

  it("4. POST /api/v1/admin/mfa/enable rejects out-of-window TOTP code", async () => {
    // Generate code for 10 minutes in the future
    const futureCode = generateTotp(enrollmentSecret, 20);
    const req = createReq("/api/v1/admin/mfa/enable", "POST", { totpCode: futureCode }, adminSession.token);
    const res = await enableMfa(req);
    assert.equal(res.status, 400);
  });

  it("5. POST /api/v1/admin/mfa/enable with valid TOTP enables MFA and encrypts secret at rest", async () => {
    const validCode = generateTotp(enrollmentSecret, 0);
    const req = createReq("/api/v1/admin/mfa/enable", "POST", { totpCode: validCode }, adminSession.token);
    const res = await enableMfa(req);
    assert.equal(res.status, 200);

    // Verify database record
    const updatedUser = await prisma.user.findUnique({ where: { id: adminUser.id } });
    assert.equal(updatedUser?.mfaEnabled, true);
    assert.ok(updatedUser?.mfaSecret?.startsWith("enc:v1:"), "MFA secret MUST be AES-256-GCM encrypted at rest");

    // Verify decrypted payload integrity
    const decrypted = decryptMfaPayload(updatedUser?.mfaSecret);
    assert.equal(decrypted?.secret, enrollmentSecret);
    assert.equal(decrypted?.recoveryCodes.length, 8);
  });

  it("6. Step 1 admin login requires MFA when mfaEnabled is true", async () => {
    const req = createReq("/api/v1/auth/admin-login", "POST", {
      phone: "9999900001",
      password: "AdminMfaSecure2027!",
    });
    const res = await adminLoginStep1(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.requiresMfa, true);
  });

  it("7. Step 2 admin login fails when confirmCode is missing", async () => {
    const req = createReq("/api/v1/auth/admin-login/verify", "POST", {
      phone: "9999900001",
      password: "AdminMfaSecure2027!",
      confirmCode: "",
    });
    const res = await adminLoginVerify(req);
    assert.equal(res.status, 402);
    const data = await res.json();
    assert.match(data.error, /code required/);
  });

  it("8. Step 2 admin login fails when confirmCode is invalid", async () => {
    const req = createReq("/api/v1/auth/admin-login/verify", "POST", {
      phone: "9999900001",
      password: "AdminMfaSecure2027!",
      confirmCode: "123456",
    });
    const res = await adminLoginVerify(req);
    assert.equal(res.status, 401);
  });

  it("9. Step 2 admin login succeeds with valid TOTP code", async () => {
    const validCode = generateTotp(enrollmentSecret, 0);
    const req = createReq("/api/v1/auth/admin-login/verify", "POST", {
      phone: "9999900001",
      password: "AdminMfaSecure2027!",
      confirmCode: validCode,
    });
    const res = await adminLoginVerify(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mfaCleared, true);
  });

  it("10. Recovery code authentication succeeds and prevents reuse", async () => {
    const singleUseCode = recoveryCodes[0];

    // First use: must succeed
    const req1 = createReq("/api/v1/auth/admin-login/verify", "POST", {
      phone: "9999900001",
      password: "AdminMfaSecure2027!",
      confirmCode: singleUseCode,
    });
    const res1 = await adminLoginVerify(req1);
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.usedRecoveryCode, true);

    // Verify remaining recovery codes decremented
    const statusReq = createReq("/api/v1/admin/mfa/status", "GET", null, adminSession.token);
    const statusRes = await getMfaStatus(statusReq);
    const statusData = await statusRes.json();
    assert.equal(statusData.remainingRecoveryCodes, 7);

    // Second use of same code: MUST BE REJECTED
    const req2 = createReq("/api/v1/auth/admin-login/verify", "POST", {
      phone: "9999900001",
      password: "AdminMfaSecure2027!",
      confirmCode: singleUseCode,
    });
    const res2 = await adminLoginVerify(req2);
    assert.equal(res2.status, 401, "Reusing a consumed recovery code MUST be rejected");
  });

  it("11. Regenerating recovery codes requires reauthentication", async () => {
    // Wrong password
    const req1 = createReq("/api/v1/admin/mfa/recovery-codes", "POST", {
      password: "WrongPassword123!",
      totpCode: generateTotp(enrollmentSecret, 0),
    }, adminSession.token);
    const res1 = await regenRecoveryCodes(req1);
    assert.equal(res1.status, 401);

    // Valid reauthentication
    const req2 = createReq("/api/v1/admin/mfa/recovery-codes", "POST", {
      password: "AdminMfaSecure2027!",
      totpCode: generateTotp(enrollmentSecret, 0),
    }, adminSession.token);
    const res2 = await regenRecoveryCodes(req2);
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.recoveryCodes.length, 8);
  });

  it("12. Disabling MFA requires reauthentication with password and TOTP", async () => {
    // Valid disable
    const req = createReq("/api/v1/admin/mfa/disable", "POST", {
      password: "AdminMfaSecure2027!",
      confirmCode: generateTotp(enrollmentSecret, 0),
    }, adminSession.token);
    const res = await disableMfa(req);
    assert.equal(res.status, 200);

    const userAfter = await prisma.user.findUnique({ where: { id: adminUser.id } });
    assert.equal(userAfter?.mfaEnabled, false);
    assert.equal(userAfter?.mfaSecret, null);
  });

  it("13. Unauthenticated requests to MFA endpoints are blocked with 401", async () => {
    const req = createReq("/api/v1/admin/mfa/status", "GET");
    const res = await getMfaStatus(req);
    assert.equal(res.status, 401);
  });

  it("14. Enforces explicit, secure MFA_ENCRYPTION_KEY in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.MFA_ENCRYPTION_KEY;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.MFA_ENCRYPTION_KEY;

      // Must throw when key is missing in production
      assert.throws(() => getEncryptionKey(), /MFA_SECURITY_BLOCKER.*required in production/);

      // Must throw when key is under 32 characters in production
      process.env.MFA_ENCRYPTION_KEY = "insecure_short_key_1234";
      assert.throws(() => getEncryptionKey(), /at least 32 characters long/);

      // Must succeed when a valid 32+ character key is provided
      process.env.MFA_ENCRYPTION_KEY = "production_secure_mfa_key_2027_puskaralu_safe";
      const key = getEncryptionKey();
      assert.equal(key.length, 32);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      if (originalKey !== undefined) {
        process.env.MFA_ENCRYPTION_KEY = originalKey;
      } else {
        delete process.env.MFA_ENCRYPTION_KEY;
      }
    }
  });
});
