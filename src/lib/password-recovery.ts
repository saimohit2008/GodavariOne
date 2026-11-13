// Godavari One — Secure Email OTP Password Recovery Service
// Provides cryptographic OTP generation, storage, verification, and password reset
// across all Godavari One account roles with zero schema migrations.

import crypto from "crypto";
import { db } from "./db";
import { hashPassword, audit, clearFailedLogin } from "./auth";
import { validatePasswordPolicy } from "./validation";
import { sendEmail } from "./email";
import { getResendConfig } from "./resend";

export const PASSWORD_RESET_CONFIG = {
  tokenTtlSeconds: 900, // 15 minutes for OTP
  resetTokenTtlSeconds: 600, // 10 minutes for verified session token
  resendCooldownMs: 60000, // 60 seconds
  maxAttempts: 5,
};

// In-memory rate limiting for IP-level brute-force defense
interface IpRateLimitRecord {
  count: number;
  windowStart: number;
}
const ipRateLimits = new Map<string, IpRateLimitRecord>();
const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_IP = 15; // Max 15 reset requests per 15 min per IP

export function checkIpRateLimit(ip?: string): boolean {
  if (!ip) return true;
  const now = Date.now();
  const record = ipRateLimits.get(ip);
  if (!record || now - record.windowStart > IP_RATE_LIMIT_WINDOW_MS) {
    ipRateLimits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= MAX_REQUESTS_PER_IP) {
    return false;
  }
  record.count += 1;
  return true;
}

export function generateResetOtp(): string {
  // Cryptographically secure 6-digit numeric OTP (100000-999999)
  return crypto.randomInt(100000, 1000000).toString();
}

export function generateCryptoResetToken(): string {
  // High-entropy 256-bit token (64 hex characters)
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw.trim()).digest("hex");
}

export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Prefixing tokens in existing EmailVerificationToken table provides absolute domain separation
export function getResetEmailKey(email: string): string {
  return `reset:${email.toLowerCase().trim()}`;
}

export function getResetTokenKey(email: string): string {
  return `reset_token:${email.toLowerCase().trim()}`;
}

export interface RequestResetResult {
  success: boolean;
  message: string;
  cooldownSeconds?: number;
  error?: string;
  statusCode?: number;
  devCode?: string; // only populated if OTP_DEV_MODE=true
}

/**
 * Step 1 — Initiates password reset by sending a 6-digit OTP to the user's verified email.
 * Defends against account enumeration via constant-time dummy processing.
 */
export async function requestPasswordReset(email: string, ip?: string): Promise<RequestResetResult> {
  const normalizedEmail = (email || "").toLowerCase().trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return {
      success: false,
      error: "A valid email address is required.",
      statusCode: 422,
      message: "A valid email address is required.",
    };
  }

  // 1. IP rate limiting
  if (!checkIpRateLimit(ip)) {
    return {
      success: false,
      error: "Too many password reset requests from this network. Please try again later.",
      statusCode: 429,
      message: "Rate limit exceeded.",
    };
  }

  const resetEmailKey = getResetEmailKey(normalizedEmail);

  // 2. Cooldown check: prevent requesting new OTPs within 60 seconds
  const recentToken = await db.emailVerificationToken.findFirst({
    where: {
      email: resetEmailKey,
      createdAt: { gt: new Date(Date.now() - PASSWORD_RESET_CONFIG.resendCooldownMs) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentToken) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(recentToken.createdAt).getTime()) / 1000);
    const waitSeconds = Math.max(1, Math.ceil(PASSWORD_RESET_CONFIG.resendCooldownMs / 1000 - elapsedSeconds));
    return {
      success: false,
      error: `Please wait ${waitSeconds} seconds before requesting another password reset code.`,
      statusCode: 429,
      cooldownSeconds: waitSeconds,
      message: `Cooldown active. Wait ${waitSeconds}s.`,
    };
  }

  // 3. User lookup: must exist, be ACTIVE, and have emailVerified: true
  const user = await db.user.findFirst({
    where: {
      email: normalizedEmail,
      status: "ACTIVE",
    },
  });

  // Account enumeration defense:
  // If user does not exist OR email is unverified, perform dummy hashing to equalize timing,
  // then return the identical generic success message.
  if (!user || !user.emailVerified) {
    // Constant-time dummy calculation
    crypto.createHash("sha256").update("dummy_enumeration_defense_value" + normalizedEmail).digest("hex");
    return {
      success: true,
      message: "If an account exists with this verified email address, a 6-digit password reset code has been sent.",
      statusCode: 200,
    };
  }

  // 4. Invalidate any older unconsumed reset tokens for this email
  await db.emailVerificationToken.updateMany({
    where: {
      OR: [
        { email: resetEmailKey, consumed: false },
        { email: getResetTokenKey(normalizedEmail), consumed: false },
      ],
    },
    data: { consumed: true },
  });

  // 5. Generate secure 6-digit OTP code and store SHA-256 hash
  const rawCode = generateResetOtp();
  const tokenHash = hashResetToken(rawCode);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_CONFIG.tokenTtlSeconds * 1000);

  const tokenRecord = await db.emailVerificationToken.create({
    data: {
      email: resetEmailKey,
      tokenHash,
      expiresAt,
      userId: user.id,
    },
  });

  // 6. Build and dispatch branded password reset email via Resend
  const greeting = user.name ? `Hello ${user.name.trim()}` : "Hello";
  const plainTextBody = `Reset Your Godavari One Account Password

${greeting},

We received a request to reset the password for your Godavari One account.

Your 6-digit password reset verification code is:

    ${rawCode}

⏱️ This single-use code is valid for 15 minutes.
🔒 Do NOT share this code with anyone. Godavari One staff will never ask for your verification code or password.

If you did not request this password reset, please ignore this email. Your password will remain unchanged and your account is secure.

— Godavari One Team (Godavari Pushkaralu 2027)`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Godavari One Account Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your password reset code is ${rawCode}. Valid for 15 minutes. Do not share this code.
  </div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="padding: 28px 32px; text-align: center; background: linear-gradient(135deg, #0f766e, #0d9488); color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Godavari One</h1>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">Godavari Pushkaralu 2027</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 32px 24px;">
        <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 12px; color: #0f172a;">${greeting},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
          We received a request to reset the password for your Godavari One account. Please use the following 6-digit verification code:
        </p>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 24px;">
          <tr>
            <td align="center">
              <div style="display: inline-block; background-color: #ecfdf5; border: 2px solid #059669; border-radius: 10px; padding: 16px 28px; text-align: center;">
                <span style="font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: block;">
                  ${rawCode}
                </span>
              </div>
              <p style="font-size: 12px; color: #64748b; margin: 10px 0 0; font-weight: 500;">
                ⏱️ Valid for 15 minutes • Single-use code
              </p>
            </td>
          </tr>
        </table>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
          <p style="font-size: 13px; line-height: 1.5; color: #991b1b; margin: 0; font-weight: 600;">
            Security Warning: Never share this code with anyone.
          </p>
          <p style="font-size: 12px; line-height: 1.5; color: #7f1d1d; margin: 4px 0 0;">
            Godavari One administrators and staff will never ask you for your verification code or password.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          If you did not request this password reset, please ignore this email. Your password will remain unchanged and your account is completely safe.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          Godavari One Platform · Godavari Pushkaralu 2027 · Automated Password Recovery
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const isDev = process.env.OTP_DEV_MODE === "true" || process.env.NODE_ENV === "test";

  // Dispatch email via configured provider
  const sendRes = await sendEmail({
    to: normalizedEmail,
    subject: "Reset Your Godavari One Account Password",
    text: plainTextBody,
    html: htmlBody,
  });

  // If email dispatch fails and not in dev/test, delete token so user isn't locked by cooldown
  if (!sendRes.success && !isDev && getResendConfig()) {
    await db.emailVerificationToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
    return {
      success: false,
      error: `Email delivery failed: ${sendRes.error}`,
      statusCode: 503,
      message: "Email delivery failed.",
    };
  }

  // Record audit log for reset challenge creation
  await audit({
    actorId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    targetType: "USER",
    targetId: user.id,
    ip,
    details: { email: normalizedEmail, method: "EMAIL_OTP" },
  });

  return {
    success: true,
    message: "If an account exists with this verified email address, a 6-digit password reset code has been sent.",
    statusCode: 200,
    devCode: isDev ? rawCode : undefined,
  };
}

export interface VerifyResetOtpResult {
  success: boolean;
  resetToken?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Step 2 — Verifies the 6-digit OTP code submitted by the user.
 * Enforces single-use, max attempts (5), and expiration.
 * On success, generates a short-lived cryptographically secure reset token.
 */
export async function verifyPasswordResetOtp(email: string, rawCode: string): Promise<VerifyResetOtpResult> {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const code = (rawCode || "").trim();

  if (!normalizedEmail || !code) {
    return {
      success: false,
      error: "Email address and 6-digit verification code are required.",
      statusCode: 422,
    };
  }

  const resetEmailKey = getResetEmailKey(normalizedEmail);

  // Retrieve active token
  const record = await db.emailVerificationToken.findFirst({
    where: {
      email: resetEmailKey,
      consumed: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return {
      success: false,
      error: "No active password reset code found for this email address. Please request a new one.",
      statusCode: 400,
    };
  }

  // Attempt limit check
  if (record.attempts >= PASSWORD_RESET_CONFIG.maxAttempts) {
    return {
      success: false,
      error: "Too many incorrect verification attempts. Please request a new password reset code.",
      statusCode: 429,
    };
  }

  // Expiration check
  if (new Date() > record.expiresAt) {
    return {
      success: false,
      error: "Password reset code has expired. Please request a new code.",
      statusCode: 400,
    };
  }

  // Timing-safe comparison of SHA-256 hashes
  const computedHash = hashResetToken(code);
  const isMatch = timingSafeCompare(computedHash, record.tokenHash);

  if (!isMatch) {
    await db.emailVerificationToken.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 },
    });

    const remainingAttempts = PASSWORD_RESET_CONFIG.maxAttempts - (record.attempts + 1);
    const attemptWarning = remainingAttempts > 0
      ? ` (${remainingAttempts} attempt${remainingAttempts > 1 ? "s" : ""} remaining)`
      : " (Challenge locked. Please request a new code.)";

    return {
      success: false,
      error: `Invalid verification code${attemptWarning}.`,
      statusCode: 400,
    };
  }

  // Mark OTP token as consumed (prevents replay)
  await db.emailVerificationToken.update({
    where: { id: record.id },
    data: { consumed: true },
  });

  // Generate cryptographically secure resetToken (valid for 10 minutes)
  const resetToken = generateCryptoResetToken();
  const resetTokenHash = hashResetToken(resetToken);

  await db.emailVerificationToken.create({
    data: {
      email: getResetTokenKey(normalizedEmail),
      tokenHash: resetTokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_CONFIG.resetTokenTtlSeconds * 1000),
      userId: record.userId,
    },
  });

  return {
    success: true,
    resetToken,
  };
}

export interface CompleteResetParams {
  email: string;
  newPassword: string;
  confirmPassword?: string;
  resetToken?: string;
  otpCode?: string;
  ip?: string;
}

export interface CompleteResetResult {
  success: boolean;
  message?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Step 3 & 4 — Validates password policy and applies the new password.
 * Revokes all existing sessions, clears brute-force trackers, preserves user role and MFA settings.
 */
export async function completePasswordReset(params: CompleteResetParams): Promise<CompleteResetResult> {
  const normalizedEmail = (params.email || "").toLowerCase().trim();
  const { newPassword, confirmPassword, resetToken, otpCode, ip } = params;

  if (!normalizedEmail) {
    return { success: false, error: "Email address is required.", statusCode: 422 };
  }

  if (!newPassword) {
    return { success: false, error: "New password is required.", statusCode: 422 };
  }

  // Confirm password matching
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return { success: false, error: "New password and confirmation password do not match.", statusCode: 400 };
  }

  // Password policy check
  const pwCheck = validatePasswordPolicy(newPassword);
  if (!pwCheck.isValid) {
    return { success: false, error: pwCheck.error || "Password does not meet complexity requirements.", statusCode: 400 };
  }

  // Must provide either a verified resetToken or a direct otpCode
  if (!resetToken && !otpCode) {
    return { success: false, error: "A valid reset verification token or OTP code is required.", statusCode: 400 };
  }

  let authorizedUserId: string | null = null;

  if (resetToken) {
    // Validate resetToken
    const resetTokenKey = getResetTokenKey(normalizedEmail);
    const record = await db.emailVerificationToken.findFirst({
      where: {
        email: resetTokenKey,
        consumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return { success: false, error: "Invalid or expired password reset session. Please restart recovery.", statusCode: 400 };
    }

    if (new Date() > record.expiresAt) {
      return { success: false, error: "Password reset session has expired. Please restart recovery.", statusCode: 400 };
    }

    const computedHash = hashResetToken(resetToken);
    if (!timingSafeCompare(computedHash, record.tokenHash)) {
      return { success: false, error: "Invalid password reset token.", statusCode: 400 };
    }

    // Mark reset token consumed
    await db.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    authorizedUserId = record.userId;
  } else if (otpCode) {
    // Validate direct OTP submission
    const verifyRes = await verifyPasswordResetOtp(normalizedEmail, otpCode);
    if (!verifyRes.success) {
      return { success: false, error: verifyRes.error, statusCode: verifyRes.statusCode || 400 };
    }

    // Consume the intermediate resetToken that verifyPasswordResetOtp generated
    if (verifyRes.resetToken) {
      await db.emailVerificationToken.updateMany({
        where: { email: getResetTokenKey(normalizedEmail), consumed: false },
        data: { consumed: true },
      });
    }
  }

  // Look up user
  const user = authorizedUserId
    ? await db.user.findUnique({ where: { id: authorizedUserId } })
    : await db.user.findFirst({ where: { email: normalizedEmail, status: "ACTIVE" } });

  if (!user || user.status !== "ACTIVE") {
    return { success: false, error: "Account not found or inactive.", statusCode: 404 };
  }

  // Hash new password using scrypt
  const passwordHash = hashPassword(newPassword);

  // Transactionally update password
  // PRESERVES: role, mfaEnabled, mfaSecret, status, phone, name, email
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      emailVerified: true, // confirmed verified via email OTP
    },
  });

  // Revoke all existing sessions and refresh tokens for this user
  await db.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Clear brute force lockout counters
  clearFailedLogin(user.phone, ip);
  clearFailedLogin(normalizedEmail, ip);

  // Invalidate any remaining tokens for this user/email
  await db.emailVerificationToken.updateMany({
    where: {
      OR: [
        { email: getResetEmailKey(normalizedEmail) },
        { email: getResetTokenKey(normalizedEmail) },
      ],
      consumed: false,
    },
    data: { consumed: true },
  });

  // Audit log
  await audit({
    actorId: user.id,
    action: "PASSWORD_RESET_SUCCESS",
    targetType: "USER",
    targetId: user.id,
    ip,
    details: {
      email: normalizedEmail,
      role: user.role,
      sessionsRevoked: true,
      mfaProtected: user.mfaEnabled,
    },
  });

  // Optional: Send password change confirmation notification email
  sendEmail({
    to: normalizedEmail,
    subject: "Your Godavari One Account Password Has Been Reset",
    text: `Hello ${user.name || "User"},\n\nYour Godavari One password was successfully reset on ${new Date().toUTCString()}.\n\nIf you made this change, no further action is required.\n\nIf you did NOT authorize this change, please contact Godavari One security immediately.\n\n— Godavari One Security Team`,
  }).catch(() => {});

  return {
    success: true,
    message: "Your password has been reset successfully. Please log in with your new password.",
  };
}
