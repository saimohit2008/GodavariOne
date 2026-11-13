// POST /api/v1/auth/phone/validate
// Validates international mobile numbers using external phone-number intelligence.
// Distinguishes format validity, number-range allocation, carrier, line type, and reachability.
// INVARIANT 1: SMS OTP verification is NOT required; NO SMS is sent.
// INVARIANT 2: phoneOwnershipVerified is ALWAYS false. External intelligence does not prove ownership.
// INVARIANT 3: External check NEVER queries the application's user database or reveals existing accounts.

import { NextRequest } from "next/server";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { phoneIntelligence } from "@/lib/phone-intelligence";
import { z } from "zod";

const validateRequestSchema = z.object({
  phone: z.string().min(5).max(30),
  countryCode: z.string().min(2).max(4).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = validateRequestSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { phone, countryCode } = parsed.data;

  // Execute external phone intelligence lookup
  // Notice: We deliberately do NOT query db.user here! External existence is completely
  // independent of Godavari One's user database and prevents user enumeration attacks.
  const result = await phoneIntelligence.validateNumber(phone, countryCode);

  return ok({
    ok: true,
    data: result,
  });
});
