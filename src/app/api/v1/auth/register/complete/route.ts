import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession, setSessionCookie, audit } from "@/lib/auth";
import { created, fail, handler, phoneSchema, zodError, getClientIp } from "@/lib/validation";
import { toNationalPhone } from "@/lib/twilio";
import { z } from "zod";

// POST /api/v1/auth/register/complete
// Finalizes account creation ONLY after Resend email verification is satisfied.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    phone: phoneSchema.optional(),
    email: z.string().email().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { phone, email } = parsed.data;

  if (!phone && !email) {
    return fail("Phone number or email is required to complete registration", 400);
  }

  const nationalPhone = phone ? toNationalPhone(phone) : null;
  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  const pending = await db.pendingRegistration.findFirst({
    where: {
      OR: [
        ...(nationalPhone ? [{ phone: nationalPhone }] : []),
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ],
    },
  });

  if (!pending) {
    return fail("No pending registration found.", 404);
  }

  if (new Date() > pending.expiresAt) {
    return fail("Registration session has expired. Please initiate registration again.", 400);
  }

  // Strict enforcement: Email OTP verification is mandatory
  if (!pending.emailVerified) {
    return fail("Cannot complete registration: Email address has not been verified via email OTP.", 400);
  }

  // Check if account already exists
  const existingUser = await db.user.findFirst({
    where: {
      OR: [{ phone: pending.phone }, { email: pending.email }],
    },
  });
  if (existingUser) {
    await db.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});
    return fail("An account with this phone or email already exists.", 409);
  }

  // Create active verified user
  const user = await db.user.create({
    data: {
      name: pending.name,
      phone: pending.phone,
      email: pending.email,
      passwordHash: pending.passwordHash,
      role: "VISITOR",
      status: "ACTIVE",
      phoneVerified: true,
      emailVerified: true,
    },
  });

  // Clean up pending registration
  await db.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});

  // Create session and set session cookie
  const session = await createSession(user.id, "PASSWORD");
  await setSessionCookie(session.token);

  await audit({
    actorId: user.id,
    action: "USER_REGISTER",
    targetType: "USER",
    targetId: user.id,
    details: { phone: user.phone, email: user.email, verified: true, authMethod: "RESEND_EMAIL_OTP" },
    ip: getClientIp(req),
  });

  return created({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
  });
});
