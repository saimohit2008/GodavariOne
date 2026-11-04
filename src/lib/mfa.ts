// Godavari One — Super Admin Multi-Factor Authentication (MFA) Security Module
// Provides RFC 6238 TOTP, AES-256-GCM encryption at rest, recovery codes,
// rate-limiting/brute-force mitigation, and zero-dependency inline QR code generation.

import crypto from "crypto";
import { generateTotpSecret, generateTotp, verifyTotp } from "@/lib/totp";

// ---------------------------------------------------------------------------
// 1. Types & Interfaces
// ---------------------------------------------------------------------------

export interface MfaRecoveryCode {
  hash: string; // SHA-256 hash of plaintext code
  used: boolean;
  usedAt?: string;
}

export interface MfaData {
  secret: string; // RFC 6238 Base32 secret
  recoveryCodes: MfaRecoveryCode[];
  enrolledAt: string;
}

export interface PendingEnrollment {
  userId: string;
  secret: string;
  plaintextRecoveryCodes: string[];
  hashedRecoveryCodes: MfaRecoveryCode[];
  otpauthUri: string;
  qrSvg: string;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// 2. Encryption At Rest (AES-256-GCM)
// ---------------------------------------------------------------------------

export function getEncryptionKey(): Buffer {
  const isProduction = process.env.NODE_ENV === "production";
  const mfaKey = process.env.MFA_ENCRYPTION_KEY?.trim();

  // In production, an explicit MFA_ENCRYPTION_KEY of at least 32 characters is strictly required.
  // There is NO fallback to insecure default keys in production.
  if (isProduction) {
    if (!mfaKey) {
      throw new Error(
        "MFA_SECURITY_BLOCKER: Explicit MFA_ENCRYPTION_KEY environment variable is required in production."
      );
    }
    if (mfaKey.length < 32) {
      throw new Error(
        "MFA_SECURITY_BLOCKER: MFA_ENCRYPTION_KEY must be at least 32 characters long in production."
      );
    }
    return crypto.createHash("sha256").update(mfaKey).digest();
  }

  // Non-production (development and test environments)
  if (mfaKey && mfaKey.length >= 16) {
    return crypto.createHash("sha256").update(mfaKey).digest();
  }

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (sessionSecret && sessionSecret.length >= 16) {
    return crypto.createHash("sha256").update(sessionSecret).digest();
  }

  // Automated test environment fallback
  if (process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test") {
    return crypto.createHash("sha256").update("test-only-mfa-key-not-for-production").digest();
  }

  throw new Error(
    "MFA_CONFIGURATION_ERROR: MFA_ENCRYPTION_KEY or SESSION_SECRET must be configured in environment."
  );
}

/**
 * Encrypts MFA payload into format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptMfaPayload(payload: MfaData): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts MFA payload. Backward-compatible with unencrypted legacy Base32 strings.
 */
export function decryptMfaPayload(storedSecret: string | null | undefined): MfaData | null {
  if (!storedSecret) return null;

  if (storedSecret.startsWith("enc:v1:")) {
    try {
      const parts = storedSecret.split(":");
      if (parts.length !== 5) return null;
      const iv = Buffer.from(parts[2], "hex");
      const tag = Buffer.from(parts[3], "hex");
      const ciphertext = Buffer.from(parts[4], "hex");

      const key = getEncryptionKey();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString("utf8")) as MfaData;
    } catch {
      return null;
    }
  }

  // Backward compatibility with raw legacy Base32 secret
  return {
    secret: storedSecret.trim(),
    recoveryCodes: [],
    enrolledAt: new Date(0).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 3. Recovery Codes Management
// ---------------------------------------------------------------------------

export function hashRecoveryCode(code: string): string {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return crypto.createHash("sha256").update(clean).digest("hex");
}

export function generateRecoveryCodes(count = 8): {
  plaintext: string[];
  hashed: MfaRecoveryCode[];
} {
  const plaintext: string[] = [];
  const hashed: MfaRecoveryCode[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 10-char formatted alphanumeric code: XXXX-XXXXXX
    const bytes = crypto.randomBytes(5).toString("hex").toUpperCase();
    const formatted = `${bytes.slice(0, 4)}-${bytes.slice(4)}`;
    plaintext.push(formatted);
    hashed.push({
      hash: hashRecoveryCode(formatted),
      used: false,
    });
  }

  return { plaintext, hashed };
}

// ---------------------------------------------------------------------------
// 4. Verification (TOTP or Recovery Code)
// ---------------------------------------------------------------------------

export function verifyMfaInput(
  input: string,
  mfaData: MfaData
): { valid: boolean; isRecovery: boolean; updatedMfaData?: MfaData } {
  if (!input || !mfaData?.secret) {
    return { valid: false, isRecovery: false };
  }

  const clean = input.trim();

  // Case A: 6-digit TOTP code
  if (/^\d{6}$/.test(clean)) {
    const isValid = verifyTotp(clean, mfaData.secret, 1);
    return { valid: isValid, isRecovery: false };
  }

  // Case B: Recovery code
  const inputHash = hashRecoveryCode(clean);
  const matchIndex = mfaData.recoveryCodes.findIndex(
    (rc) => rc.hash === inputHash && !rc.used
  );

  if (matchIndex !== -1) {
    const updatedCodes = [...mfaData.recoveryCodes];
    updatedCodes[matchIndex] = {
      ...updatedCodes[matchIndex],
      used: true,
      usedAt: new Date().toISOString(),
    };

    return {
      valid: true,
      isRecovery: true,
      updatedMfaData: {
        ...mfaData,
        recoveryCodes: updatedCodes,
      },
    };
  }

  return { valid: false, isRecovery: false };
}

// ---------------------------------------------------------------------------
// 5. Rate Limiting & Brute Force Protection
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  failures: number;
  lockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkMfaRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const entry = rateLimitMap.get(identifier);
  if (!entry) {
    return { allowed: true, remainingAttempts: MAX_FAILURES };
  }

  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Reset expired lockout
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    rateLimitMap.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_FAILURES };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_FAILURES - entry.failures),
  };
}

export function recordMfaFailure(identifier: string): {
  remainingAttempts: number;
  locked: boolean;
  retryAfterSeconds?: number;
} {
  const entry = rateLimitMap.get(identifier) || { failures: 0 };
  entry.failures += 1;

  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    rateLimitMap.set(identifier, entry);
    return {
      remainingAttempts: 0,
      locked: true,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }

  rateLimitMap.set(identifier, entry);
  return {
    remainingAttempts: MAX_FAILURES - entry.failures,
    locked: false,
  };
}

export function resetMfaRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

// ---------------------------------------------------------------------------
// 6. Pending Enrollment Store (10 minute expiry)
// ---------------------------------------------------------------------------

const pendingEnrollments = new Map<string, PendingEnrollment>();

export function storePendingEnrollment(enrollment: PendingEnrollment): void {
  pendingEnrollments.set(enrollment.userId, enrollment);
}

export function getPendingEnrollment(userId: string): PendingEnrollment | null {
  const entry = pendingEnrollments.get(userId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingEnrollments.delete(userId);
    return null;
  }
  return entry;
}

export function clearPendingEnrollment(userId: string): void {
  pendingEnrollments.delete(userId);
}

// ---------------------------------------------------------------------------
// 7. Standalone ISO/IEC 18004 QR Code SVG Generator (Zero External Dependencies)
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGf() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val & 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsCompute(data: number[], numEc: number): number[] {
  let poly = [1];
  for (let i = 0; i < numEc; i++) {
    const factor = [1, GF_EXP[i]];
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], factor[0]);
      next[j + 1] ^= gfMul(poly[j], factor[1]);
    }
    poly = next;
  }

  const res = new Array(numEc).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res.shift()!;
    res.push(0);
    for (let j = 0; j < numEc; j++) {
      res[j] ^= gfMul(poly[j + 1], factor);
    }
  }
  return res;
}

const QR_VERSIONS = [
  null,
  { version: 1, size: 21, dataBytes: 16, ecBytes: 10, blocks: 1, align: [] },
  { version: 2, size: 25, dataBytes: 28, ecBytes: 16, blocks: 1, align: [6, 18] },
  { version: 3, size: 29, dataBytes: 44, ecBytes: 26, blocks: 1, align: [6, 22] },
  { version: 4, size: 33, dataBytes: 64, ecBytes: 18, blocks: 2, align: [6, 26] },
  { version: 5, size: 37, dataBytes: 86, ecBytes: 24, blocks: 2, align: [6, 30] },
  { version: 6, size: 41, dataBytes: 108, ecBytes: 16, blocks: 4, align: [6, 34] },
  { version: 7, size: 45, dataBytes: 124, ecBytes: 18, blocks: 4, align: [6, 22, 38] },
  { version: 8, size: 49, dataBytes: 154, ecBytes: 22, blocks: 4, align: [6, 24, 42] },
];

export function encodeQrSvg(text: string, margin = 4): string {
  const utf8 = Buffer.from(text, "utf8");
  let ver: (typeof QR_VERSIONS)[number] = null;
  for (let v = 1; v < QR_VERSIONS.length; v++) {
    const candidate = QR_VERSIONS[v];
    if (candidate && candidate.dataBytes >= utf8.length + 3) {
      ver = candidate;
      break;
    }
  }
  if (!ver) {
    throw new Error("Text too long for built-in QR generator");
  }

  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode
  pushBits(utf8.length, 8);
  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8);
  }
  const termLen = Math.min(4, ver.dataBytes * 8 - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }

  let padIdx = 0;
  const padBytes = [0xec, 0x11];
  while (data.length < ver.dataBytes) {
    data.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  const numBlocks = ver.blocks;
  const ecPerBlock = ver.ecBytes;
  const baseBlockDataLen = Math.floor(ver.dataBytes / numBlocks);
  const extraDataBlocks = ver.dataBytes % numBlocks;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const blockLen = baseBlockDataLen + (b >= numBlocks - extraDataBlocks ? 1 : 0);
    const blockData = data.slice(offset, offset + blockLen);
    offset += blockLen;
    dataBlocks.push(blockData);
    ecBlocks.push(rsCompute(blockData, ecPerBlock));
  }

  const finalStream: number[] = [];
  const maxDataBlockLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalStream.push(dataBlocks[b][i]);
      }
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalStream.push(ecBlocks[b][i]);
    }
  }

  const N = ver.size;
  const matrix: number[][] = Array.from({ length: N }, () => new Array(N).fill(-1));
  const isFunction: boolean[][] = Array.from({ length: N }, () => new Array(N).fill(false));

  function setModule(r: number, c: number, val: number, func = true) {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      matrix[r][c] = val;
      if (func) isFunction[r][c] = true;
    }
  }

  function placeFinder(top: number, left: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= N || col < 0 || col >= N) continue;
        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          setModule(row, col, 1);
        } else {
          setModule(row, col, 0);
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, N - 7);
  placeFinder(N - 7, 0);

  for (let i = 8; i < N - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (!isFunction[6][i]) setModule(6, i, val);
    if (!isFunction[i][6]) setModule(i, 6, val);
  }

  if (ver.align.length > 0) {
    const pos = ver.align;
    for (const r of pos) {
      for (const c of pos) {
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === pos[pos.length - 1]) ||
          (r === pos[pos.length - 1] && c === 6)
        ) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            setModule(r + dr, c + dc, isBorder || isCenter ? 1 : 0);
          }
        }
      }
    }
  }

  setModule(N - 8, 8, 1);

  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][N - 1 - i] = true;
    isFunction[N - 1 - i][8] = true;
  }

  let bitIdx = 0;
  const totalStreamBits = finalStream.length * 8;
  function getNextBit() {
    if (bitIdx >= totalStreamBits) return 0;
    const byte = finalStream[Math.floor(bitIdx / 8)];
    const bit = (byte >> (7 - (bitIdx % 8))) & 1;
    bitIdx++;
    return bit;
  }

  let right = N - 1;
  let upward = true;
  while (right > 0) {
    if (right === 6) right--;
    for (let vert = 0; vert < N; vert++) {
      const r = upward ? N - 1 - vert : vert;
      for (let c = right; c >= right - 1; c--) {
        if (!isFunction[r][c]) {
          matrix[r][c] = getNextBit();
        }
      }
    }
    upward = !upward;
    right -= 2;
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!isFunction[r][c]) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] ^= 1;
        }
      }
    }
  }

  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const posTopLeft = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8],
    [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    matrix[posTopLeft[i][0]][posTopLeft[i][1]] = formatBits[i];
  }
  for (let i = 0; i < 7; i++) {
    matrix[N - 1 - i][8] = formatBits[i];
  }
  for (let i = 7; i < 15; i++) {
    matrix[8][N - 15 + i] = formatBits[i];
  }

  const totalModules = N + margin * 2;
  let pathD = "";
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c] === 1) {
        pathD += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <path d="${pathD}" fill="#0f172a"/>
</svg>`;
}
