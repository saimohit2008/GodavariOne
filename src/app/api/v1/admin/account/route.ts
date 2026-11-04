import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";

// GET /api/v1/admin/account — retrieve Super Admin profile & security activity
export const GET = handler(async (_req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      phoneVerified: true,
      emailVerified: true,
      mfaEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return fail("User not found", 404);

  // Fetch recent security audit records for this admin
  const securityLogs = await db.auditLog.findMany({
    where: {
      OR: [
        { actorId: user.id },
        { targetId: user.id },
      ],
      action: {
        in: [
          "ADMIN_LOGIN",
          "ADMIN_PASSWORD_CHANGED",
          "ADMIN_PASSWORD_CHANGE_FAILED",
          "ADMIN_PHONE_CHANGED",
          "ADMIN_PHONE_CHANGE_REQUESTED",
          "BOOTSTRAP_SUPER_ADMIN",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      createdAt: true,
      ip: true,
      details: true,
    },
  });

  return ok({
    account: user,
    securityLogs,
  });
});
