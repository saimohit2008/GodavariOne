// Genuine RFC 6238 Time-based One-Time Password (TOTP) implementation

// Uses Node.js crypto module — zero external dependencies.

import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += BASE32_ALPHABET[bytes[i] % 32];
  }
  return result;
}

export function generateTotp(secret: string, timeStepOffset = 0, timeStepSeconds = 30): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStepSeconds) + timeStepOffset;

  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(buf);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = code % 1_000_000;
  return otp.toString().padStart(6, "0");
}

export function verifyTotp(token: string, secret: string, window = 1): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  // Check current time step and +/- window steps to account for slight clock drift
  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotp(secret, offset);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}
