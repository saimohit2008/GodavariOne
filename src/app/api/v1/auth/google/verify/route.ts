// POST /api/v1/auth/google/verify
// Directly verifies a Google identity token (ID token) on the trusted server side.
// Used by native mobile clients (Android/iOS) and Google Identity Services (GIS).

import { NextRequest } from "next/server";
import { verifyGoogleIdToken, resolveGoogleUser } from "@/lib/google-auth";
import { getCurrentUser, isTrustedNativeClient } from "@/lib/auth";
import { ok, fail, handler, getClientIp, zodError } from "@/lib/validation";
import { z } from "zod";

const verifySchema = z.object({
  idToken: z.string().min(10, "Valid Google ID token is required"),
  nonce: z.string().optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { idToken, nonce } = parsed.data;

  // 1. Cryptographically verify Google ID token on server side
  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken, nonce);
  } catch (err: any) {
    return fail(err.message || "Invalid or expired Google identity token.", 401);
  }

  // 2. Resolve user identity and enforce account linking security invariants
  const currentUserCtx = await getCurrentUser(req);
  const ip = getClientIp(req);

  const result = await resolveGoogleUser(identity, {
    currentUserId: currentUserCtx?.user.id,
    ip,
  });

  if (result.status === "ERROR") {
    return fail(result.error, result.statusCode);
  }

  if (result.status === "LINKING_REQUIRED") {
    return fail(result.message, 409, {
      code: "ACCOUNT_LINKING_REQUIRED",
      email: result.existingEmail,
    });
  }

  const { user, isNewUser, session } = result;
  const isNative = isTrustedNativeClient(req);

  return ok({
    ok: true,
    isNewUser,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      ...(isNative ? { token: session.token } : {}),
    },
  });
});
