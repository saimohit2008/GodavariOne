import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handler, phoneSchema, zodError } from "@/lib/validation";
import { sendEmailVerification } from "@/lib/resend";
import { toNationalPhone } from "@/lib/twilio";
import { z } from "zod";

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  const visible = local.length <= 2 ? local[0] || "*" : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

// POST /api/v1/auth/otp/request
// Dispatches an email OTP verification code through Resend for authentication
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    email: z.string().email().optional(),
    phone: phoneSchema.optional(),
    identifier: z.string().min(3).max(100).optional(),
    purpose: z.enum(["LOGIN", "REGISTER", "RESET"]).default("LOGIN"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { email, phone, identifier } = parsed.data;

  // Resolve target email or phone identifier
  let targetEmail = email ? email.toLowerCase().trim() : "";
  let targetPhone = phone ? phone.trim() : "";

  if (!targetEmail && !targetPhone && identifier) {
    const raw = identifier.trim();
    if (raw.includes("@")) {
      targetEmail = raw.toLowerCase();
    } else {
      targetPhone = raw;
    }
  }

  if (!targetEmail && !targetPhone) {
    return fail("Please enter your registered email address or mobile number", 400);
  }

  // Look up user account (never create user during login)
  const user = targetEmail
    ? await db.user.findFirst({ where: { email: targetEmail } })
    : targetPhone
    ? await db.user.findFirst({
        where: {
          OR: [{ phone: targetPhone }, { phone: toNationalPhone(targetPhone) }],
        },
      })
    : null;

  if (!user) {
    return fail("No account found with these details. Please register first.", 404);
  }

  // Super Admins must use the dedicated admin-login endpoint
  if (user.role === "SUPER_ADMIN") {
    return fail("Administrators must log in through the secure admin portal", 403);
  }

  if (user.status !== "ACTIVE") {
    return fail(`Account is ${user.status.toLowerCase()}. Contact support.`, 403);
  }

  // Verify account has an email address for email OTP login
  if (!user.email) {
    return fail(
      "This account does not have an email address for email OTP login. Please log in using your phone and password, then add your email in your profile settings.",
      400
    );
  }

  // Dispatch real 6-digit email OTP via Resend (enforces 60s cooldown, invalidates prior tokens)
  const result = await sendEmailVerification({
    email: user.email,
    name: user.name || undefined,
    userId: user.id,
  });

  if (!result.success) {
    return fail(`Email delivery is BLOCKED: ${result.error}`, 503);
  }

  return ok({
    ok: true,
    delivered: true,
    service: "resend_email",
    emailMasked: maskEmail(user.email),
    expiresInSeconds: 900,
    message: `Verification code sent to ${maskEmail(user.email)} via Resend email.`,
  });
});
