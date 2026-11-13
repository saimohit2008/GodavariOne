import { NextRequest } from "next/server";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/password-recovery";
import { z } from "zod";

// POST /api/v1/auth/password/forgot
// Step 1: Initiates email OTP password reset.
// Defends against account enumeration by returning standard generic responses.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    email: z.string().email("A valid email address is required"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const ip = getClientIp(req);
  const result = await requestPasswordReset(parsed.data.email, ip);

  if (!result.success) {
    return fail(result.error || "Failed to process request.", result.statusCode || 400);
  }

  return ok({
    ok: true,
    message: result.message,
    expiresInSeconds: 900,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
});
