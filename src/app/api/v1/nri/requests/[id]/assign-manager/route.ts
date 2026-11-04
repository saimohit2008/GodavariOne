import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";
import { z } from "zod";

const assignSchema = z.object({
  managerId: z.string().min(1, "Manager ID is required"),
  notes: z.string().optional().nullable(),
});

// POST /api/v1/nri/requests/[id]/assign-manager — Assign request to an NRI Service Manager (Super Admin only)
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Only Super Admin can assign requests to NRI Service Managers", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const { managerId, notes } = parsed.data;

  // Verify manager exists and has NRI_SERVICE_MANAGER role
  const manager = await db.user.findUnique({
    where: { id: managerId },
    select: { id: true, name: true, phone: true, email: true, role: true, status: true },
  });

  if (!manager) return fail("Manager user not found", 404);
  if (manager.role !== "NRI_SERVICE_MANAGER") return fail("Selected user is not an NRI Service Manager", 400);
  if (manager.status !== "ACTIVE") return fail("Selected NRI Service Manager account is not active", 400);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
  });
  if (!request) return fail("Request not found", 404);

  const prevManagerId = request.assignedManagerId;
  const newStatus = request.status === "SUBMITTED" ? "ASSIGNED" : request.status;

  const updated = await db.nriPackageRequest.update({
    where: { id },
    data: {
      assignedManagerId: manager.id,
      status: newStatus,
    },
    include: {
      assignedManager: { select: { id: true, name: true, phone: true, email: true } },
      visitor: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  // Record status change
  await recordNriStatusChange({
    requestId: id,
    fromStatus: request.status,
    toStatus: newStatus,
    changedById: ctx.user.id,
    changedByName: ctx.user.name || "Super Admin",
    reason: notes || `Assigned to NRI Service Manager: ${manager.name} (${manager.phone})`,
    ip: getClientIp(req),
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_REQUEST_ASSIGN_MANAGER",
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: id,
    details: {
      referenceNumber: request.referenceNumber,
      previousManagerId: prevManagerId,
      newManagerId: manager.id,
      managerName: manager.name,
      notes,
    },
    ip: getClientIp(req),
  });

  // Notify manager
  await sendNriWorkflowNotification({
    userId: manager.id,
    recipientEmail: manager.email,
    recipientName: manager.name,
    type: "NRI_MANAGER_ASSIGNED",
    title: `Assigned Trip Request (${request.referenceNumber})`,
    message: `Super Admin assigned request ${request.referenceNumber} (${request.visitorName}, ${request.groupSize} travelers) to you for full trip planning and quotation.`,
    link: "/admin",
  });

  // Notify visitor
  await sendNriWorkflowNotification({
    userId: request.visitorId,
    recipientEmail: request.visitorEmail,
    recipientName: request.visitorName,
    type: "NRI_MANAGER_ASSIGNED",
    title: `Trip Specialist Assigned (${request.referenceNumber})`,
    message: `Your sacred Pushkaralu trip request has been assigned to dedicated NRI Service Manager ${manager.name}. A custom quotation and itinerary are being prepared.`,
    link: `/nri-access?ref=${request.referenceNumber}`,
  });

  return ok({
    request: updated,
    message: `Successfully assigned request ${request.referenceNumber} to ${manager.name}`,
  });
});
