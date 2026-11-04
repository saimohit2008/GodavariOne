import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, handler } from "@/lib/validation";
import { decryptMfaPayload } from "@/lib/mfa";

// GET /api/v1/admin/mfa/status — Check current Super Admin MFA state
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") return fail("Unauthorized", 401);

  if (!ctx.user.mfaEnabled) {
    return ok({
      mfaEnabled: false,
      remainingRecoveryCodes: 0,
      enrolledAt: null,
    });
  }

  const mfaData = decryptMfaPayload(ctx.user.mfaSecret);
  const remainingRecoveryCodes = mfaData?.recoveryCodes?.filter((rc) => !rc.used).length || 0;

  return ok({
    mfaEnabled: true,
    remainingRecoveryCodes,
    enrolledAt: mfaData?.enrolledAt || null,
  });
});
