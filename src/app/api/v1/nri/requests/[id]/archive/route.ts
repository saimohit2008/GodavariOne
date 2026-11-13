import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { recordNriStatusChange } from "@/lib/nri";

// POST /api/v1/nri/requests/[id]/archive
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: {
      quotations: {
        where: { status: { in: ["CONFIRMED", "ACCEPTED"] } },
      },
    },
  });

  if (!request) return fail("Package request not found", 404);

  // Authorization check
  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isAssignedManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isAssignedManager) {
    if (ctx.user.role === "NRI_SERVICE_MANAGER") {
      return fail("You can only archive NRI requests assigned to you", 403);
    }
    return fail("Insufficient permissions to archive NRI requests", 403);
  }

  // Retention & Business Safety Checks
  if (request.status === "CONFIRMED" || request.confirmedQuotationId || request.quotations.length > 0) {
    return fail(
      "Active confirmed packages and confirmed quotations cannot be archived. They must be cancelled first through the official cancellation workflow.",
      400
    );
  }

  if (request.status === "ARCHIVED") {
    return fail("Request is already archived", 400);
  }

  const body = await req.json().catch(() => null);
  const reason = (body?.reason || "").trim();
  if (reason.length < 3) {
    return fail("A valid reason for archiving is required (minimum 3 characters)", 422);
  }

  // Execute archive transactionally
  const previousStatus = request.status;
  const actorName = ctx.user.name || (isSuperAdmin ? "Super Admin" : "NRI Service Manager");

  const [updated] = await db.$transaction([
    db.nriPackageRequest.update({
      where: { id },
      data: { status: "ARCHIVED" },
    }),
    db.nriStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: previousStatus,
        toStatus: "ARCHIVED",
        changedById: ctx.user.id,
        changedByName: actorName,
        reason,
      },
    }),
  ]);

  await audit({
    actorId: ctx.user.id,
    action: "NRI_REQUEST_ARCHIVE",
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: id,
    details: {
      referenceNumber: request.referenceNumber,
      previousStatus,
      newStatus: "ARCHIVED",
      reason,
      archivedByRole: ctx.user.role,
    },
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    message: "NRI request archived successfully",
    request: updated,
  });
});
