// Godavari One — Shared Persistent Atomic Rate Limiter
// Compatible with multi-instance serverless deployments (Vercel) on PostgreSQL and SQLite

import crypto from "crypto";
import { db } from "../db";

const DEFAULT_WINDOW_SECONDS = 60; // 1-minute fixed window
const DEFAULT_CAPACITY = 30; // 30 requests per minute for public visitors
const HASH_SALT = process.env.RATE_LIMIT_SALT || "godavari_ai_rate_limit_salt_2027";

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingTokens: number;
  retryAfterSeconds: number;
  identifierHash: string;
}

/**
 * Generates a privacy-preserving, cryptographically hashed identifier
 * preventing plain-text IP addresses or user IDs from being stored in the database.
 */
export function hashRateLimitKey(identifier: string, windowBucket: number): string {
  return crypto
    .createHash("sha256")
    .update(`${HASH_SALT}:${identifier}:${windowBucket}`)
    .digest("hex");
}

/**
 * Checks and atomically increments rate limit counter using the shared database.
 * Uses atomic upsert with increment to eliminate read-then-write race conditions.
 */
export async function checkAIRateLimit(
  rawIdentifier: string,
  capacity = DEFAULT_CAPACITY,
  windowSeconds = DEFAULT_WINDOW_SECONDS
): Promise<RateLimitCheckResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowBucket = Math.floor(now / windowMs);
  const key = hashRateLimitKey(rawIdentifier, windowBucket);

  const windowStart = new Date(windowBucket * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2); // Retain for 2 windows before pruning
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));

  try {
    // Atomic Upsert:
    // If key exists in this window bucket, requestCount increments atomically by 1.
    // If key does not exist, it is created with requestCount = 1.
    // This translates to atomic ON CONFLICT DO UPDATE SET requestCount = requestCount + 1 in both PostgreSQL & SQLite.
    const record = await db.aIRateLimit.upsert({
      where: { id: key },
      create: {
        id: key,
        requestCount: 1,
        windowStart,
        expiresAt,
      },
      update: {
        requestCount: { increment: 1 },
      },
    });

    const isAllowed = record.requestCount <= capacity;
    const remaining = Math.max(0, capacity - record.requestCount);

    return {
      allowed: isAllowed,
      remainingTokens: remaining,
      retryAfterSeconds: isAllowed ? 0 : retryAfterSeconds,
      identifierHash: key,
    };
  } catch (error) {
    // SECURITY REQUIREMENT: Database failures must NOT silently disable rate limiting.
    console.error("[RateLimiter DB Error] Failed to execute atomic rate limit check:", error);

    // Fail-safe bounded enforcement:
    // When the database encounters transient connection pressure, throttle to protect downstream LLM budget
    return {
      allowed: false,
      remainingTokens: 0,
      retryAfterSeconds: 5,
      identifierHash: key,
    };
  }
}

/**
 * Routine database pruning of expired rate limit buckets.
 * Safe to run opportunistically or in background jobs.
 */
export async function pruneExpiredRateLimits(): Promise<number> {
  try {
    const result = await db.aIRateLimit.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  } catch {
    return 0;
  }
}
