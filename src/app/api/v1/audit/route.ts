import { NextRequest } from "next/server";
import { db, containsInsensitive } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";
import { canViewAuditLogs } from "@/lib/constants";

// GET /api/v1/audit — super admin only
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (!canViewAuditLogs(ctx.user.role as any)) return fail("Insufficient permissions", 403);
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || undefined;
  const targetType = searchParams.get("targetType") || undefined;
  const targetId = searchParams.get("targetId") || undefined;
  const actorId = searchParams.get("actorId") || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
  const where: Record<string, unknown> = {};
  if (action) where.action = containsInsensitive(action);
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (actorId) where.actorId = actorId;
  const items = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
  return ok({ items });
});
