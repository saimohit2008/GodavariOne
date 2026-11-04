import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { audit } from "@/lib/auth";
import { validateEmailVerificationToken } from "@/lib/resend";
import { z } from "zod";

// POST /api/v1/auth/email/verify
// Confirms single-use email verification code or token
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    email: z.string().email(),
    token: z.string().min(4).max(128).optional(),
    code: z.string().min(4).max(128).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { email, token, code } = parsed.data;

  const rawVerification = (token || code || "").trim();
  if (!rawVerification) {
    return fail("Verification code or token is required.", 400);
  }

  const result = await validateEmailVerificationToken(email, rawVerification);
  if (!result.success) {
    return fail(result.error || "Invalid verification code.", result.statusCode || 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // If a pending registration exists for this email, mark email as verified
  await db.pendingRegistration.updateMany({
    where: { email: normalizedEmail },
    data: { emailVerified: true },
  });

  // If an active user with this email exists, mark verified
  const user = await db.user.findFirst({ where: { email: normalizedEmail } });
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
    await audit({
      actorId: user.id,
      action: "EMAIL_VERIFIED",
      targetType: "USER",
      targetId: user.id,
      details: { email: normalizedEmail },
      ip: getClientIp(req),
    });
  }

  return ok({
    ok: true,
    verified: true,
    email: normalizedEmail,
    message: "Email address verified successfully.",
  });
});

// GET /api/v1/auth/email/verify?token=...&email=... (also accepts ?code=...)
// Allows users to click verification links in their email client
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";
  const token = url.searchParams.get("token") || "";
  const code = url.searchParams.get("code") || "";
  const rawVerification = (token || code).trim();

  if (!email || !rawVerification) {
    return NextResponse.json({ ok: false, error: "Missing email or verification code parameter." }, { status: 400 });
  }

  const result = await validateEmailVerificationToken(email, rawVerification);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.statusCode || 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Mark pending registration or user email verified
  await db.pendingRegistration.updateMany({
    where: { email: normalizedEmail },
    data: { emailVerified: true },
  });

  const user = await db.user.findFirst({ where: { email: normalizedEmail } });
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
    await audit({
      actorId: user.id,
      action: "EMAIL_VERIFIED",
      targetType: "USER",
      targetId: user.id,
      details: { email: normalizedEmail },
      ip: getClientIp(req),
    });
  }

  // Redirect to application with success query param or return success
  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appBaseUrl}/?emailVerified=true`);
}
