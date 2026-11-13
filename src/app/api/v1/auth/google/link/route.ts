// POST /api/v1/auth/google/link
// Securely links a verified Google account to the currently authenticated Godavari One account.

import { NextRequest } from "next/server";
import { requireUser, audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyGoogleIdToken } from "@/lib/google-auth";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { z } from "zod";

const linkSchema = z.object({
  idToken: z.string().min(10, "Valid Google ID token is required"),
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireUser(req);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { idToken } = parsed.data;

  // 1. Verify token
  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken);
  } catch (err: any) {
    return fail(err.message || "Failed to verify Google identity.", 401);
  }

  // 2. Check if another account already has this Google ID linked
  const conflictUser = await db.user.findFirst({
    where: {
      OR: [
        { notes: { contains: identity.sub } },
        { phone: `google:${identity.sub}` },
      ],
      NOT: { id: ctx.user.id },
    },
  });

  if (conflictUser) {
    return fail("This Google account is already linked to another Godavari One account.", 409);
  }

  // 3. Update current user notes
  let meta: Record<string, unknown> = {};
  try {
    if (ctx.user.notes) meta = JSON.parse(ctx.user.notes);
  } catch {}

  meta.googleId = identity.sub;
  meta.googleEmail = identity.email;
  meta.googlePicture = identity.picture;
  meta.googleLinkedAt = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    notes: JSON.stringify(meta),
  };

  // If user has no email or unverified email, update it with verified Google email
  if (!ctx.user.email) {
    updateData.email = identity.email;
    updateData.emailVerified = true;
  } else if (ctx.user.email === identity.email && !ctx.user.emailVerified) {
    updateData.emailVerified = true;
  }

  await db.user.update({
    where: { id: ctx.user.id },
    data: updateData,
  });

  await audit({
    actorId: ctx.user.id,
    action: "GOOGLE_ACCOUNT_LINKED",
    targetType: "USER",
    targetId: ctx.user.id,
    ip: getClientIp(req),
    details: { sub: identity.sub, email: identity.email },
  });

  return ok({
    ok: true,
    linked: true,
    googleEmail: identity.email,
    message: "Google account successfully linked to your Godavari One account.",
  });
});
