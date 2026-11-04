import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie, revokeSession, clearSessionCookie, audit } from "@/lib/auth";
import { fail, ok, handler, getClientIp } from "@/lib/validation";

// POST /api/v1/auth/admin-login — step 1: phone + password
// Returns a challenge requiring an MFA / confirmation step (step 2 verify)
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const { phone, password } = body as { phone?: string; password?: string };
  if (!phone || !password) return fail("Phone and password are required");

  const nationalPhone = phone.replace(/\D/g, "").slice(-10);
  const user = await db.user.findFirst({
    where: {
      OR: [
        { phone },
        ...(nationalPhone ? [{ phone: nationalPhone }] : []),
      ],
    },
  });
  if (!user) return fail("This account no longer exists. Please register to create an account.", 404);
  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return fail("Invalid credentials", 401);
  }
  if (user.role !== "SUPER_ADMIN") return fail("Not an administrative account", 403);
  if (user.status !== "ACTIVE") return fail(`Account is ${user.status.toLowerCase()}`, 403);

  // Issue a short-lived pre-session token that must be confirmed via /verify
  // For dev simplicity, we issue a full session but require a confirmation code
  // if MFA is enabled. Without MFA enabled, we still require an explicit
  // confirmation step that records mfaCleared=true.
  return ok({
    userId: user.id,
    name: user.name,
    requiresMfa: user.mfaEnabled,
    challengeToken: null, // session cookie not set yet
  });
});
