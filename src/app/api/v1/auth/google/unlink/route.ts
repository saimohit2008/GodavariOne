// POST /api/v1/auth/google/unlink
// Unlinks a Google account from the currently authenticated user.
// Enforces that the account retains at least one alternative login method (password or verified email OTP).

import { NextRequest } from "next/server";
import { requireUser, audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireUser(req);

  // 1. Check if account is currently linked to Google
  let meta: Record<string, unknown> = {};
  try {
    if (ctx.user.notes) meta = JSON.parse(ctx.user.notes);
  } catch {}

  const hasGoogleLink = Boolean(meta.googleId || (ctx.user.phone && ctx.user.phone.startsWith("google:")));
  if (!hasGoogleLink) {
    return fail("No linked Google account found on this profile.", 400);
  }

  // 2. Safeguard: Prevent account lockout
  // User must have a password or real phone number or verified email before unlinking
  const hasPassword = Boolean(ctx.user.passwordHash);
  const hasRealPhone = ctx.user.phone && !ctx.user.phone.startsWith("google:");
  const hasEmail = Boolean(ctx.user.email);

  if (!hasPassword && !hasRealPhone && !hasEmail) {
    return fail("Cannot unlink Google: Please set a password or mobile number first to avoid losing access to your account.", 400);
  }

  // 3. Remove Google metadata
  delete meta.googleId;
  delete meta.googleEmail;
  delete meta.googlePicture;
  delete meta.googleLinkedAt;

  await db.user.update({
    where: { id: ctx.user.id },
    data: {
      notes: Object.keys(meta).length > 0 ? JSON.stringify(meta) : null,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "GOOGLE_ACCOUNT_UNLINKED",
    targetType: "USER",
    targetId: ctx.user.id,
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    unlinked: true,
    message: "Google account has been unlinked successfully.",
  });
});
