import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie, audit } from "@/lib/auth";
import { fail, ok, handler, getClientIp } from "@/lib/validation";
import {
  decryptMfaPayload,
  encryptMfaPayload,
  verifyMfaInput,
  checkMfaRateLimit,
  recordMfaFailure,
  resetMfaRateLimit,
} from "@/lib/mfa";

// POST /api/v1/auth/admin-login/verify — step 2: confirm admin login
// Body: { phone, password, confirmCode? }
// If MFA is disabled, confirmCode is not required but the explicit two-step
// flow still applies. If MFA is enabled, a genuine RFC 6238 TOTP token or
// valid single-use recovery code is required.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const { phone, password, confirmCode } = body as {
    phone?: string;
    password?: string;
    confirmCode?: string;
  };
  if (!phone || !password) return fail("Phone and password are required");

  const clientIp = getClientIp(req);
  const nationalPhone = phone.replace(/\D/g, "").slice(-10);
  const user = await db.user.findFirst({
    where: {
      OR: [
        { phone },
        ...(nationalPhone ? [{ phone: nationalPhone }] : []),
      ],
    },
  });
  if (!user || !user.passwordHash) return fail("Invalid credentials", 401);
  if (!verifyPassword(password, user.passwordHash)) return fail("Invalid credentials", 401);
  if (user.role !== "SUPER_ADMIN") return fail("Not an administrative account", 403);
  if (user.status !== "ACTIVE") return fail(`Account is ${user.status.toLowerCase()}`, 403);

  // Rate limiting & brute-force mitigation for Super Admin MFA
  const userRateLimit = checkMfaRateLimit(`user:${user.id}`);
  const ipRateLimit = checkMfaRateLimit(`ip:${clientIp}`);
  if (!userRateLimit.allowed || !ipRateLimit.allowed) {
    const retryAfter = userRateLimit.retryAfterSeconds || ipRateLimit.retryAfterSeconds || 900;
    await audit({
      actorId: user.id,
      action: "ADMIN_MFA_LOCKED",
      targetType: "USER",
      targetId: user.id,
      ip: clientIp,
      details: { retryAfterSeconds: retryAfter },
    });
    return fail(`Too many failed attempts. Account authentication temporarily locked. Retry in ${retryAfter}s.`, 429);
  }

  // Genuine RFC 6238 TOTP & Recovery Code verification
  let usedRecoveryCode = false;
  if (user.mfaEnabled) {
    if (!confirmCode || !confirmCode.trim()) {
      return fail("MFA TOTP code or recovery code required", 402);
    }
    const mfaData = decryptMfaPayload(user.mfaSecret);
    if (!mfaData || !mfaData.secret) {
      return fail(
        "MFA is enabled on this account, but TOTP secret is not configured or unreadable. Contact system administration.",
        500
      );
    }

    const verification = verifyMfaInput(confirmCode.trim(), mfaData);
    if (!verification.valid) {
      const userFailure = recordMfaFailure(`user:${user.id}`);
      recordMfaFailure(`ip:${clientIp}`);

      await audit({
        actorId: user.id,
        action: "ADMIN_MFA_FAILED",
        targetType: "USER",
        targetId: user.id,
        ip: clientIp,
        details: { remainingAttempts: userFailure.remainingAttempts },
      });

      return fail(
        `Invalid authenticator code or recovery code. ${userFailure.remainingAttempts} attempts remaining before temporary lockout.`,
        401
      );
    }

    // Reset rate limits on successful authentication
    resetMfaRateLimit(`user:${user.id}`);
    resetMfaRateLimit(`ip:${clientIp}`);

    // If a recovery code was used, consume it and save updated encrypted payload
    if (verification.isRecovery && verification.updatedMfaData) {
      usedRecoveryCode = true;
      const updatedEncrypted = encryptMfaPayload(verification.updatedMfaData);
      await db.user.update({
        where: { id: user.id },
        data: { mfaSecret: updatedEncrypted },
      });

      await audit({
        actorId: user.id,
        action: "ADMIN_MFA_RECOVERY_CODE_USED",
        targetType: "USER",
        targetId: user.id,
        ip: clientIp,
        details: {
          remainingRecoveryCodes: verification.updatedMfaData.recoveryCodes.filter((rc) => !rc.used).length,
        },
      });
    } else {
      await audit({
        actorId: user.id,
        action: "ADMIN_MFA_VERIFIED",
        targetType: "USER",
        targetId: user.id,
        ip: clientIp,
      });
    }
  }

  const session = await createSession(user.id, "ADMIN", true);
  await setSessionCookie(session.token);
  await audit({
    actorId: user.id,
    action: "ADMIN_LOGIN",
    targetType: "USER",
    targetId: user.id,
    ip: clientIp,
    details: usedRecoveryCode ? { usedRecoveryCode: true } : undefined,
  });

  return ok({
    id: user.id,
    name: user.name,
    role: user.role,
    mfaCleared: true,
    usedRecoveryCode,
  });
});
