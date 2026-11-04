import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, handler, zodError } from "@/lib/validation";
import { sendEmailVerification } from "@/lib/resend";
import { z } from "zod";

// POST /api/v1/auth/email/request
// Sends a single-use email verification code and link via Resend.
// Tokens/codes are hashed with SHA-256 before database storage.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    email: z.string().email(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { email } = parsed.data;

  const normalizedEmail = email.toLowerCase().trim();
  const ctx = await getCurrentUser();

  let name = ctx?.user.name || undefined;
  if (!name) {
    const pending = await db.pendingRegistration.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: "desc" },
    });
    if (pending?.name) {
      name = pending.name;
    }
  }

  const result = await sendEmailVerification({
    email: normalizedEmail,
    name,
    userId: ctx?.user.id || undefined,
  });

  if (!result.success) {
    return fail(
      `Email delivery is BLOCKED: ${result.error}. Please configure RESEND_API_KEY, RESEND_FROM_EMAIL, and APP_BASE_URL.`,
      503
    );
  }

  return ok({
    ok: true,
    delivered: true,
    expiresInSeconds: 900,
    message: "Verification email sent successfully via Resend.",
  });
});
