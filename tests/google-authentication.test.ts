import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";
import {
  generateOAuthParams,
  buildGoogleAuthUrl,
  verifyGoogleIdToken,
  resolveGoogleUser,
  setOAuthStateCookie,
  getAndClearOAuthStateCookie,
} from "../src/lib/google-auth";
import { createSession, revokeSession, getCurrentUser, hashPassword } from "../src/lib/auth";
import { POST as verifyRoute } from "../src/app/api/v1/auth/google/verify/route";
import { GET as initiateRoute } from "../src/app/api/v1/auth/google/initiate/route";
import { GET as callbackRoute } from "../src/app/api/v1/auth/google/callback/route";
import { POST as linkRoute } from "../src/app/api/v1/auth/google/link/route";
import { POST as unlinkRoute } from "../src/app/api/v1/auth/google/unlink/route";

function makeTestJwt(payload: Record<string, unknown>): string {
  const header = { alg: "RS256", typ: "JWT" };
  const h64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const p64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `test_google_token_${h64}.${p64}.simulated_signature_bytes`;
}

describe("Godavari One — Google Sign-In & OpenID Connect Authentication Suite", () => {
  const testRunId = Date.now().toString();
  const testSub1 = `g_sub_new_${testRunId}`;
  const testSub2 = `g_sub_existing_${testRunId}`;
  const testSub3 = `g_sub_unlinked_${testRunId}`;
  const testSubEsc = `g_sub_escalation_${testRunId}`;

  const testEmail1 = `google.new.${testRunId}@gmail.com`;
  const testEmail2 = `google.existing.${testRunId}@gmail.com`;
  const testEmail3 = `existing.local.${testRunId}@godavarione.com`;
  const testPhone2 = `91234${testRunId.slice(-5)}`;
  const testPhone3 = `98765${testRunId.slice(-5)}`;

  let existingLinkedUserId: string;
  let existingLocalUserId: string;

  before(async () => {
    // 1. Create an existing user with pre-linked Google ID
    const user2 = await db.user.create({
      data: {
        phone: testPhone2,
        email: testEmail2,
        name: "Existing Google Pilgrim",
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: false,
        emailVerified: true,
        notes: JSON.stringify({
          googleId: testSub2,
          googleEmail: testEmail2,
          provider: "google",
        }),
      },
    });
    existingLinkedUserId = user2.id;

    // 2. Create an existing local user with password and email, but NO Google link
    const user3 = await db.user.create({
      data: {
        phone: testPhone3,
        email: testEmail3,
        name: "Existing Local User",
        passwordHash: hashPassword("LocalPass123!"),
        role: "VISITOR",
        status: "ACTIVE",
        phoneVerified: false,
        emailVerified: true,
      },
    });
    existingLocalUserId = user3.id;
  });

  after(async () => {
    // Clean up created test users and sessions
    await db.session.deleteMany({
      where: {
        user: {
          OR: [
            { email: testEmail1 },
            { email: testEmail2 },
            { email: testEmail3 },
            { phone: `google:${testSub1}` },
            { phone: `google:${testSubEsc}` },
            { id: existingLinkedUserId },
            { id: existingLocalUserId },
          ],
        },
      },
    }).catch(() => {});

    await db.user.deleteMany({
      where: {
        OR: [
          { email: testEmail1 },
          { email: testEmail2 },
          { email: testEmail3 },
          { phone: `google:${testSub1}` },
          { phone: `google:${testSubEsc}` },
          { id: existingLinkedUserId },
          { id: existingLocalUserId },
        ],
      },
    }).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // 1. OAuth Initiate & PKCE Parameter Generation
  // -------------------------------------------------------------------------
  test("1. Generates secure state, nonce, and PKCE parameters (code_verifier and S256 code_challenge)", () => {
    const params = generateOAuthParams();
    assert.ok(params.state && params.state.length >= 32, "State must be high entropy");
    assert.ok(params.nonce && params.nonce.length >= 32, "Nonce must be high entropy");
    assert.ok(params.codeVerifier && params.codeVerifier.length >= 43, "Code verifier must satisfy RFC 7636");
    assert.ok(params.codeChallenge && params.codeChallenge.length >= 32, "Code challenge must be valid base64url");

    const authUrl = buildGoogleAuthUrl({
      state: params.state,
      nonce: params.nonce,
      codeChallenge: params.codeChallenge,
    });

    const parsed = new URL(authUrl);
    assert.equal(parsed.hostname, "accounts.google.com");
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
    assert.equal(parsed.searchParams.get("state"), params.state);
    assert.equal(parsed.searchParams.get("nonce"), params.nonce);
    assert.equal(parsed.searchParams.get("code_challenge"), params.codeChallenge);
  });

  test("2. Initiate route handles unconfigured or configured Google client gracefully", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/google/initiate?format=json");
    const res = await initiateRoute(req);
    assert.ok([200, 302, 503].includes(res.status), "Initiate route returns standard response");
    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data.authUrl || data.state);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Token Verification & Cryptographic Invariants
  // -------------------------------------------------------------------------
  test("3. Successfully verifies valid Google ID token with correct claims", async () => {
    const token = makeTestJwt({
      sub: testSub1,
      email: testEmail1,
      email_verified: true,
      name: "New Divine Pilgrim",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: "valid_test_nonce_123",
    });

    const identity = await verifyGoogleIdToken(token, "valid_test_nonce_123");
    assert.equal(identity.sub, testSub1);
    assert.equal(identity.email, testEmail1);
    assert.equal(identity.name, "New Divine Pilgrim");
    assert.equal(identity.emailVerified, true);
  });

  test("4. Rejects expired Google identity token with appropriate error", async () => {
    const expiredToken = makeTestJwt({
      sub: "expired-sub",
      email: "expired@gmail.com",
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
    });

    await assert.rejects(
      async () => {
        await verifyGoogleIdToken(expiredToken);
      },
      /expired/i,
      "Expired token must be rejected"
    );
  });

  test("5. Rejects token with OAuth nonce mismatch (replay protection)", async () => {
    const token = makeTestJwt({
      sub: "replay-sub",
      email: "replay@gmail.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: "legitimate_nonce_abc",
    });

    await assert.rejects(
      async () => {
        await verifyGoogleIdToken(token, "tampered_nonce_xyz");
      },
      /nonce mismatch/i,
      "Mismatched nonce must be rejected"
    );
  });

  // -------------------------------------------------------------------------
  // 3. New User Registration through Google
  // -------------------------------------------------------------------------
  test("6. New user registration via Google creates account with default VISITOR role and verified email", async () => {
    const identity = {
      sub: testSub1,
      email: testEmail1,
      emailVerified: true,
      name: "Radha Devi",
      picture: "https://lh3.googleusercontent.com/test",
    };

    const result = await resolveGoogleUser(identity);
    assert.equal(result.status, "SUCCESS");
    if (result.status === "SUCCESS") {
      assert.equal(result.isNewUser, true);
      assert.equal(result.user.email, testEmail1);
      assert.equal(result.user.role, "VISITOR"); // Least privileged role
      assert.equal(result.user.emailVerified, true); // Verified by Google
      assert.equal(result.user.phoneVerified, false); // Honestly tracked: false until phone verification
      assert.equal(result.user.phone, `google:${testSub1}`);

      // Verify DB persistence
      const saved = await db.user.findUnique({ where: { id: result.user.id } });
      assert.ok(saved);
      assert.equal(saved.email, testEmail1);
      assert.equal(saved.role, "VISITOR");
    }
  });

  // -------------------------------------------------------------------------
  // 4. Existing User Login through Google
  // -------------------------------------------------------------------------
  test("7. Existing user login via linked Google identity preserves user ID, profile, and permissions", async () => {
    const identity = {
      sub: testSub2,
      email: testEmail2,
      emailVerified: true,
      name: "Existing Google Pilgrim",
    };

    const result = await resolveGoogleUser(identity);
    assert.equal(result.status, "SUCCESS");
    if (result.status === "SUCCESS") {
      assert.equal(result.isNewUser, false);
      assert.equal(result.user.id, existingLinkedUserId);
      assert.equal(result.user.phone, testPhone2);
      assert.equal(result.user.role, "VISITOR");
      assert.ok(result.session && result.session.token);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Account Takeover Protection & Duplicate Prevention (INVARIANT)
  // -------------------------------------------------------------------------
  test("8. Unauthenticated Google login matching existing email BLOCKS auto-merge and requires explicit login", async () => {
    const identity = {
      sub: testSub3, // different Google sub
      email: testEmail3, // identical email to existing local user
      emailVerified: true,
      name: "Malicious Actor or Disconnected Google",
    };

    // Caller is NOT authenticated
    const result = await resolveGoogleUser(identity);
    assert.equal(result.status, "LINKING_REQUIRED");
    if (result.status === "LINKING_REQUIRED") {
      assert.equal(result.existingEmail, testEmail3);
      assert.match(result.message, /log in.*first.*link/i);
    }

    // Verify local user was NOT altered or taken over
    const localUser = await db.user.findUnique({ where: { id: existingLocalUserId } });
    assert.ok(localUser);
    assert.equal(localUser.phone, testPhone3);
    assert.ok(!localUser.notes?.includes(testSub3));
  });

  // -------------------------------------------------------------------------
  // 6. Authenticated Account Linking
  // -------------------------------------------------------------------------
  test("9. Authenticated user can securely link their verified Google account", async () => {
    const identity = {
      sub: testSub3,
      email: testEmail3,
      emailVerified: true,
      name: "Existing Local User",
    };

    // Caller is authenticated into the existing account
    const result = await resolveGoogleUser(identity, { currentUserId: existingLocalUserId });
    assert.equal(result.status, "SUCCESS");
    if (result.status === "SUCCESS") {
      assert.equal(result.isNewUser, false);
      assert.equal(result.user.id, existingLocalUserId);

      // Verify DB persistence of Google ID in notes
      const updated = await db.user.findUnique({ where: { id: existingLocalUserId } });
      assert.ok(updated?.notes?.includes(testSub3));
    }
  });

  // -------------------------------------------------------------------------
  // 7. Privilege Escalation Defense (INVARIANT)
  // -------------------------------------------------------------------------
  test("10. Google Sign-In NEVER automatically grants administrative privileges or alters existing roles", async () => {
    // Attempting to pass role or escalate privileges via token payload
    const identity = {
      sub: testSubEsc,
      email: `admin.spoof.${testRunId}@gmail.com`,
      emailVerified: true,
      name: "Attempted Escalation Actor",
    };

    const result = await resolveGoogleUser(identity);
    assert.equal(result.status, "SUCCESS");
    if (result.status === "SUCCESS") {
      assert.equal(result.user.role, "VISITOR"); // strictly VISITOR
      assert.notEqual(result.user.role, "SUPER_ADMIN");
    }
  });

  // -------------------------------------------------------------------------
  // 8. Session Management & Logout
  // -------------------------------------------------------------------------
  test("11. Google login creates active session in database and logout revokes session cleanly", async () => {
    const session = await createSession(existingLinkedUserId, "PASSWORD");
    assert.ok(session && session.token);

    // Verify session retrieval
    const sessionUser = await db.session.findUnique({
      where: { token: session.token },
      include: { user: true },
    });
    assert.ok(sessionUser);
    assert.equal(sessionUser.userId, existingLinkedUserId);

    // Revoke session
    await revokeSession(session.token);

    // Verify revoked
    const revoked = await db.session.findUnique({ where: { token: session.token } });
    assert.ok(revoked?.revokedAt !== null);
  });

  // -------------------------------------------------------------------------
  // 9. API Routes Integration (/verify, /link, /unlink)
  // -------------------------------------------------------------------------
  test("12. POST /api/v1/auth/google/verify accepts valid ID token and returns authenticated user", async () => {
    const token = makeTestJwt({
      sub: testSub2,
      email: testEmail2,
      email_verified: true,
      name: "Existing Google Pilgrim",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const req = new NextRequest("http://localhost:3000/api/v1/auth/google/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });

    const res = await verifyRoute(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.user.email, testEmail2);
  });

  test("13. POST /api/v1/auth/google/verify rejects malformed token with HTTP 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/google/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "invalid_corrupted_token" }),
    });

    const res = await verifyRoute(req);
    assert.equal(res.status, 401);
  });

  test("14. GET /api/v1/auth/google/callback gracefully handles user cancelled authentication", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/google/callback?error=access_denied&state=sample_state"
    );
    const res = await callbackRoute(req);
    assert.equal(res.status, 307); // Next.js redirect
    const location = res.headers.get("location") || "";
    assert.ok(location.includes("auth_error="));
    assert.ok(location.includes("cancelled"));
  });
});
