// Resend Email Delivery Adapter for Godavari One
// Integrates with official Resend API for cryptographically secure email verification.

import crypto from "crypto";
import { db } from "./db";

export interface ResendConfig {
  apiKey: string;
  from: string;
  appBaseUrl: string;
}

export function getResendConfig(): ResendConfig | null {
  const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "").trim();
  const rawFrom = (
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    "onboarding@resend.dev"
  ).trim();

  // If rawFrom does not include '<', wrap in friendly display name
  const from = rawFrom.includes("<") ? rawFrom : `Godavari One <${rawFrom}>`;

  const appBaseUrl = (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).trim().replace(/\/$/, "");

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    from,
    appBaseUrl,
  };
}

export function isResendConfigured(): boolean {
  return getResendConfig() !== null;
}

export const EMAIL_VERIFY_CONFIG = {
  tokenTtlSeconds: 900, // 15 minutes
  resendCooldownMs: 60000, // 60 seconds
  maxAttempts: 5,
};

/**
 * Generates a cryptographically secure 6-digit numeric verification code (100000-999999)
 */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Generates a high-entropy 256-bit cryptographic token (64 hex characters)
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * SHA-256 hash of verification code or token for secure at-rest storage
 */
export function hashVerificationToken(tokenOrCode: string): string {
  return crypto.createHash("sha256").update(tokenOrCode.trim()).digest("hex");
}

export interface SendVerificationEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Creates and stores a single-use email verification code hash and sends it via Resend
 */
export async function sendEmailVerification(options: {
  email: string;
  name?: string;
  userId?: string;
}): Promise<SendVerificationEmailResult> {
  const config = getResendConfig();
  if (!config) {
    return {
      success: false,
      error: "Resend credentials are not configured. Please set RESEND_API_KEY, RESEND_FROM_EMAIL, and APP_BASE_URL in environment variables.",
    };
  }

  const normalizedEmail = options.email.toLowerCase().trim();

  // Enforce resend cooldown (rate limiting)
  const recentToken = await db.emailVerificationToken.findFirst({
    where: {
      email: normalizedEmail,
      createdAt: { gt: new Date(Date.now() - EMAIL_VERIFY_CONFIG.resendCooldownMs) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentToken) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(recentToken.createdAt).getTime()) / 1000);
    const waitSeconds = Math.max(1, Math.ceil(EMAIL_VERIFY_CONFIG.resendCooldownMs / 1000 - elapsedSeconds));
    return {
      success: false,
      error: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
    };
  }

  // Invalidate any older unconsumed tokens for this email address
  await db.emailVerificationToken.updateMany({
    where: { email: normalizedEmail, consumed: false },
    data: { consumed: true },
  });

  // Generate cryptographic 6-digit code and store ONLY its SHA-256 hash
  const rawCode = generateVerificationCode();
  const tokenHash = hashVerificationToken(rawCode);

  const tokenRecord = await db.emailVerificationToken.create({
    data: {
      email: normalizedEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_CONFIG.tokenTtlSeconds * 1000),
      userId: options.userId || null,
    },
  });

  // Construct trusted link with both code and token params for maximum client compatibility
  const verificationLink = `${config.appBaseUrl}/verify-email?code=${rawCode}&token=${rawCode}&email=${encodeURIComponent(normalizedEmail)}`;
  const greeting = options.name ? `Hello ${options.name.trim()}` : "Hello";

  const plainTextBody = `${rawCode} is your Godavari One verification code

${greeting},

Your 6-digit verification code for Godavari One is:

    ${rawCode}

This single-use code is valid for 15 minutes. Enter it in the Godavari One app to complete your verification.

If you requested multiple codes, use only this latest code (${rawCode}).

Alternatively, you can verify your email directly with one click:
${verificationLink}

If you did not request this verification code, please ignore this email.

— Godavari One Team (Godavari Pushkaralu 2027)`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Godavari One Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
  <!-- Preheader text for inbox list preview -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your verification code is ${rawCode}. Enter this code to verify your Godavari One account. Valid for 15 minutes.
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
          Please use the following 6-digit verification code to complete your authentication on Godavari One:
        </p>

        <!-- Prominent High-Contrast OTP Code Display -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 24px;">
          <tr>
            <td align="center">
              <div style="display: inline-block; background-color: #ecfdf5; border: 2px solid #059669; border-radius: 10px; padding: 16px 28px; text-align: center;">
                <span style="font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: block;">
                  ${rawCode}
                </span>
              </div>
              <p style="font-size: 12px; color: #64748b; margin: 8px 0 0;">
                ⏱️ Valid for 15 minutes • Single-use code • Do not share
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">
                If you requested multiple codes, use only this latest code (${rawCode}).
              </p>
            </td>
          </tr>
        </table>

        <!-- Direct One-Click Verification Link -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 24px;">
          <tr>
            <td align="center">
              <p style="font-size: 13px; color: #64748b; margin: 0 0 10px;">Or verify immediately with one click:</p>
              <a href="${verificationLink}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">
                Verify Email Address
              </a>
            </td>
          </tr>
        </table>

        <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 0 0 8px; word-break: break-all;">
          If the button does not work, copy and paste this link into your browser:<br>
          <a href="${verificationLink}" style="color: #0f766e;">${verificationLink}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          If you did not initiate this request, you can safely ignore this email. No action will be taken without entering this verification code.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          Godavari One Platform · Godavari Pushkaralu 2027 · Automated Verification
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [normalizedEmail],
        subject: `${rawCode} is your Godavari One verification code`,
        text: plainTextBody,
        html: htmlBody,
        headers: {
          "X-Entity-Ref-ID": tokenRecord.id,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Remove newly created token so the user is not locked out by cooldown on delivery failure
      await db.emailVerificationToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
      let msg = data.message || `Resend error (HTTP ${res.status})`;
      if (res.status === 401) msg = "Invalid Resend API Key. Check RESEND_API_KEY.";
      if (res.status === 403) msg = data.message || "Resend domain not verified or sender restricted. Check RESEND_FROM_EMAIL.";
      if (res.status === 422) msg = data.message || "Invalid recipient email address.";
      return { success: false, error: msg };
    }

    if (!data.id) {
      await db.emailVerificationToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
      return { success: false, error: "Resend did not return a valid delivery message ID." };
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (err: any) {
    await db.emailVerificationToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error contacting Resend API",
    };
  }
}

export interface VerifyTokenResult {
  success: boolean;
  email?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Validates verification code or token server-side, checks expiry, single-use, and timing-safe equality
 */
export async function validateEmailVerificationToken(
  email: string,
  rawTokenOrCode: string
): Promise<VerifyTokenResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const tokenHash = hashVerificationToken(rawTokenOrCode.trim());

  const record = await db.emailVerificationToken.findFirst({
    where: {
      email: normalizedEmail,
      consumed: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return {
      success: false,
      error: "No active verification code found for this email address.",
      statusCode: 400,
    };
  }

  // Check attempt limit
  if (record.attempts >= EMAIL_VERIFY_CONFIG.maxAttempts) {
    return {
      success: false,
      error: "Too many failed attempts. Please request a new verification code.",
      statusCode: 429,
    };
  }

  // Check expiration
  if (new Date() > record.expiresAt) {
    return {
      success: false,
      error: "Verification code has expired. Please request a new one.",
      statusCode: 400,
    };
  }

  // Timing-safe comparison of SHA-256 hashes
  const expectedBuf = Buffer.from(record.tokenHash, "hex");
  const actualBuf = Buffer.from(tokenHash, "hex");
  const isMatch = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!isMatch) {
    await db.emailVerificationToken.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 },
    });
    return {
      success: false,
      error: "Invalid verification code or link.",
      statusCode: 400,
    };
  }

  // Mark token consumed (prevents replay / single-use enforcement)
  await db.emailVerificationToken.update({
    where: { id: record.id },
    data: { consumed: true },
  });

  return {
    success: true,
    email: normalizedEmail,
  };
}
