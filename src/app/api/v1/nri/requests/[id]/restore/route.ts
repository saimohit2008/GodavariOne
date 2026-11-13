import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

// POST /api/v1/nri/requests/[id]/restore
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
  });

  if (!request) return fail("Package request not found", 404);

  if (request.status !== "ARCHIVED") {
    return fail("Request is not archived", 400);
  }

  // Find the archive record to check who archived it and what status it had
  const lastArchive = await db.nriStatusHistory.findFirst({
    where: { requestId: id, toStatus: "ARCHIVED" },
    orderBy: { createdAt: "desc" },
  });

  // Authorization check
  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isAssignedManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;
  const isArchivedByThisManager = ctx.user.role === "NRI_SERVICE_MANAGER" && lastArchive?.changedById === ctx.user.id;

  if (!isSuperAdmin && !isAssignedManager && !isArchivedByThisManager) {
    if (ctx.user.role === "NRI_SERVICE_MANAGER") {
      return fail("You can only restore NRI requests within your permitted scope", 403);
    }
    return fail("Insufficient permissions to restore NRI requests", 403);
  }

  const body = await req.json().catch(() => null);
  const reason = (body?.reason || "").trim() || "Restored from archive by authorized user";

  // Determine target status from history prior to archive
  const targetStatus =
    lastArchive?.fromStatus && lastArchive.fromStatus !== "ARCHIVED"
      ? lastArchive.fromStatus
      : "SUBMITTED";

  const actorName = ctx.user.name || (isSuperAdmin ? "Super Admin" : "NRI Service Manager");

  const [updated] = await db.$transaction([
    db.nriPackageRequest.update({
      where: { id },
      data: { status: targetStatus },
    }),
    db.nriStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: "ARCHIVED",
        toStatus: targetStatus,
        changedById: ctx.user.id,
        changedByName: actorName,
        reason,
      },
    }),
  ]);

  await audit({
    actorId: ctx.user.id,
    action: "NRI_REQUEST_RESTORE",
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: id,
    details: {
      referenceNumber: request.referenceNumber,
      fromStatus: "ARCHIVED",
      restoredToStatus: targetStatus,
      reason,
      restoredByRole: ctx.user.role,
    },
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    message: "NRI request restored successfully",
    request: updated,
    restoredStatus: targetStatus,
  });
});
