import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";

// GET /api/v1/auth/me â€” current session user
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return ok({ user: null });
  const { user } = ctx;
  return ok({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
    },
  });
});

