import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession, setSessionCookie, audit, isTrustedNativeClient } from "@/lib/auth";
import { ok, fail, handler, phoneSchema, zodError, getClientIp } from "@/lib/validation";
import { validateEmailVerificationToken } from "@/lib/resend";
import { toNationalPhone } from "@/lib/twilio";
import { z } from "zod";

// POST /api/v1/auth/otp/verify — Email OTP login
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    email: z.string().email().optional(),
    phone: phoneSchema.optional(),
    identifier: z.string().min(3).max(100).optional(),
    otpCode: z.string().min(4).max(8),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { email, phone, identifier, otpCode } = parsed.data;

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
    return fail("Please provide your email address or mobile number", 400);
  }

  // Look up user account
  const user = targetEmail
    ? await db.user.findFirst({ where: { email: targetEmail } })
    : targetPhone
    ? await db.user.findFirst({
        where: {
          OR: [{ phone: targetPhone }, { phone: toNationalPhone(targetPhone) }],
        },
      })
    : null;

  if (!user) return fail("No account found. Please register first.", 404);
  if (user.status !== "ACTIVE") return fail(`Account is ${user.status.toLowerCase()}`, 403);
  if (user.role === "SUPER_ADMIN") return fail("Administrators must use the secure admin portal", 403);

  // Check email existence
  if (!user.email) {
    return fail(
      "This account does not have an email address for email OTP login. Please log in using your password.",
      400
    );
  }

  // Server-side verification of single-use 6-digit OTP
  const result = await validateEmailVerificationToken(user.email, otpCode);
  if (!result.success) {
    return fail(result.error || "Incorrect OTP code", result.statusCode || 400);
  }

  // Mark email as verified upon successful OTP validation
  if (!user.emailVerified) {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  // Authenticate user with OTP session
  const session = await createSession(user.id, "OTP");
  await setSessionCookie(session.token);
  await audit({
    actorId: user.id,
    action: "OTP_LOGIN",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: { method: "EMAIL_OTP", email: user.email },
  });

  // Native-specific token delivery: strictly verify authentic native client before delivering token
  const isNativeClient = isTrustedNativeClient(req);

  return ok({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    ...(isNativeClient ? { token: session.token } : {}),
  });
});
