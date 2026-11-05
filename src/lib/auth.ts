import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "./db";
import type { Role } from "./constants";

const SESSION_COOKIE = "godavari_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Password hashing — scrypt (Node built-in, no extra deps)
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = parts[2];
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"));
}

// Constant-time dummy verification to protect against account enumeration via timing analysis
const DUMMY_SALT = "a1b2c3d4e5f67890";
const DUMMY_HASH = crypto.scryptSync("dummy_enumeration_defense_password", DUMMY_SALT, SCRYPT_KEYLEN).toString("hex");
const DUMMY_STORED = `scrypt$${DUMMY_SALT}$${DUMMY_HASH}`;

export function verifyDummyPassword(): boolean {
  return verifyPassword("dummy_input_timing", DUMMY_STORED);
}

// ---------------------------------------------------------------------------
// Rate Limiting & Brute-Force Failed Login Protection
// ---------------------------------------------------------------------------

interface FailedLoginRecord {
  count: number;
  lastAttemptAt: number;
}

const failedLogins = new Map<string, FailedLoginRecord>();
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout window

export function checkLoginRateLimit(identifier: string, ip?: string): { blocked: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const keys = [identifier, ip ? `ip:${ip}` : null].filter(Boolean) as string[];

  for (const key of keys) {
    const record = failedLogins.get(key);
    if (record) {
      if (now - record.lastAttemptAt > LOGIN_LOCKOUT_MS) {
        failedLogins.delete(key);
      } else if (record.count >= MAX_FAILED_LOGIN_ATTEMPTS) {
        const remainingMs = LOGIN_LOCKOUT_MS - (now - record.lastAttemptAt);
        const retryAfterMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
        return { blocked: true, retryAfterMinutes };
      }
    }
  }

  return { blocked: false, retryAfterMinutes: 0 };
}

export function recordFailedLogin(identifier: string, ip?: string) {
  const now = Date.now();
  const keys = [identifier, ip ? `ip:${ip}` : null].filter(Boolean) as string[];

  for (const key of keys) {
    const record = failedLogins.get(key);
    if (!record || now - record.lastAttemptAt > LOGIN_LOCKOUT_MS) {
      failedLogins.set(key, { count: 1, lastAttemptAt: now });
    } else {
      record.count += 1;
      record.lastAttemptAt = now;
    }
  }
}

export function clearFailedLogin(identifier: string, ip?: string) {
  failedLogins.delete(identifier);
  if (ip) failedLogins.delete(`ip:${ip}`);
}

// ---------------------------------------------------------------------------
// OTP — hashed with sha-256, dev mode returns code
// ---------------------------------------------------------------------------

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300);
const OTP_RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_MS || 30_000);
const OTP_MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  // 6-digit numeric code
  const buf = crypto.randomBytes(4);
  const n = buf.readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function verifyOtp(code: string, codeHash: string): boolean {
  const h = crypto.createHash("sha256").update(code).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(codeHash, "hex"));
}

export const OTP_CONFIG = {
  ttlSeconds: OTP_TTL_SECONDS,
  resendCooldownMs: OTP_RESEND_COOLDOWN_MS,
  maxAttempts: OTP_MAX_ATTEMPTS,
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: string, authMethod: "PASSWORD" | "OTP" | "ADMIN", mfaCleared = false) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await db.session.create({
    data: { userId, token, authMethod, mfaCleared, expiresAt },
  });
  return session;
}

export async function setSessionCookie(token: string) {
  try {
    const store = await cookies();
    const isProd =
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL === "1" ||
      process.env.VERCEL_ENV === "production";
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
  } catch {
    // Graceful fallback when invoked outside Next.js request scope (e.g. unit/integration testing)
  }
}

export async function clearSessionCookie() {
  try {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  } catch {
    // Graceful fallback when invoked outside Next.js request scope (e.g. unit/integration testing)
  }
}

export function getSessionCookie(): string | undefined {
  // cookies() must be awaited in Next 15+, but reading is fine synchronously via .get
  return undefined;
}

export async function getCurrentUser(req?: { cookies?: { get: (name: string) => { value: string } | undefined }; headers?: Headers | { get: (name: string) => string | null } }) {
  let token: string | undefined;

  // 1. Try reading from provided request (preferred for route handlers and tests)
  if (req) {
    if (req.cookies && typeof req.cookies.get === "function") {
      token = req.cookies.get(SESSION_COOKIE)?.value;
    }
    if (!token && req.headers && typeof req.headers.get === "function") {
      // 1a. Check Authorization: Bearer <token> for native mobile clients
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.substring(7).trim();
      }

      // 1b. Check godavari_session cookie
      if (!token) {
        const cookieHeader = req.headers.get("cookie");
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
          if (match) token = decodeURIComponent(match[1]);
        }
      }
    }
  }

  // 2. Fall back to Next.js cookies() store only when no req was explicitly provided
  if (!token && !req) {
    try {
      const store = await cookies();
      token = store.get(SESSION_COOKIE)?.value;
    } catch {
      // outside Next.js request context (e.g. tests or background workers)
    }
  }

  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.revokedAt) return null;
  if (session.user.status !== "ACTIVE") return null;
  return { user: session.user, session };
}

export async function requireUser(req?: { cookies?: { get: (name: string) => { value: string } | undefined }; headers?: Headers | { get: (name: string) => string | null } }) {
  const ctx = await getCurrentUser(req);
  if (!ctx) throw new ApiAuthError("Authentication required", 401);
  return ctx;
}

export async function requireRole(roles: Role | Role[], req?: { cookies?: { get: (name: string) => { value: string } | undefined }; headers?: Headers | { get: (name: string) => string | null } }) {
  const roleList = Array.isArray(roles) ? roles : [roles];
  const ctx = await requireUser(req);
  if (!roleList.includes(ctx.user.role as Role)) {
    throw new ApiAuthError("Insufficient permissions", 403);
  }
  return ctx;
}

export async function requireAdmin(req?: { cookies?: { get: (name: string) => { value: string } | undefined }; headers?: Headers | { get: (name: string) => string | null } }) {
  return requireRole(["SUPER_ADMIN"], req);
}

export async function revokeSession(token: string) {
  await db.session.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Rigorously verifies whether an incoming authentication request originates from
 * an authentic native mobile client (Android/iOS) rather than browser JavaScript.
 *
 * Safeguards against Header Spoofing (e.g. XSS attacks sending X-Client-Platform: native):
 * 1. Checks that the request explicitly declares native client platform headers
 *    (X-Client-Platform: native or X-Godavari-Client: godavari-mobile-native-v1).
 * 2. Rejects any request carrying an `Origin` header with http/https schemes
 *    (injected automatically by browsers on all POST fetch calls, but omitted by
 *    native mobile network stacks such as OkHttp and NSURLSession).
 * 3. Rejects any request carrying an `Referer` header from a web browser.
 * 4. Rejects any request carrying forbidden browser metadata (`Sec-Fetch-Mode`)
 *    paired with a browser User-Agent (Mozilla/5.0).
 */
export function isTrustedNativeClient(req: { headers: Headers | { get: (name: string) => string | null } }): boolean {
  const getHeader = (name: string): string | null => {
    if (typeof req.headers?.get === "function") return req.headers.get(name);
    return null;
  };

  const clientPlatform = getHeader("x-client-platform");
  const godavariClient = getHeader("x-godavari-client");
  const isDeclaredNative =
    clientPlatform === "native" ||
    godavariClient === "expo-native" ||
    godavariClient === "godavari-mobile-native-v1";

  if (!isDeclaredNative) {
    return false;
  }

  // 1. Browser Origin Defense:
  // Browsers unconditionally attach an Origin header to POST requests.
  // Native mobile network stacks (OkHttp on Android, NSURLSession on iOS) do not attach Origin.
  // If an Origin header is present with http:// or https://, this is definitively a web browser.
  const origin = getHeader("origin");
  if (origin && (origin.startsWith("http://") || origin.startsWith("https://"))) {
    return false;
  }

  // 2. Browser Referer Defense:
  // Browsers attach a Referer header when navigating or executing page scripts.
  const referer = getHeader("referer");
  if (referer && (referer.startsWith("http://") || referer.startsWith("https://"))) {
    return false;
  }

  // 3. Browser Sec-Fetch & User-Agent Defense:
  // Browsers attach forbidden metadata (Sec-Fetch-Mode) that JavaScript cannot remove.
  // When paired with a browser User-Agent (Mozilla/5.0), this is definitively a web browser.
  const secFetchMode = getHeader("sec-fetch-mode");
  const userAgent = getHeader("user-agent") || "";
  if (secFetchMode && userAgent.includes("Mozilla/")) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

export class ApiAuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

export async function audit(opts: {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: opts.actorId || null,
        action: opts.action,
        targetType: opts.targetType || null,
        targetId: opts.targetId || null,
        details: opts.details ? JSON.stringify(opts.details) : null,
        ip: opts.ip || null,
      },
    });
  } catch {
    // never let audit logging break a request
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function notify(opts: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  try {
    await db.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        link: opts.link || null,
      },
    });
  } catch {
    // best-effort
  }
}
