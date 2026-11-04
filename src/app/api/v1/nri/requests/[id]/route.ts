import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";
import { isValidNriStatusTransition, type NriRequestStatus } from "@/lib/nri-constants";
import { queueEmailNotification } from "@/lib/email-service";

// GET /api/v1/nri/requests/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: {
      visitor: { select: { id: true, name: true, phone: true, email: true } },
      assignedManager: { select: { id: true, name: true, phone: true, email: true } },
      assignments: {
        include: {
          provider: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
      quotations: {
        include: {
          provider: { select: { id: true, name: true, phone: true, email: true } },
          lineItems: true,
          versions: {
            orderBy: { version: "desc" },
            take: 10,
          },
        },
        orderBy: { createdAt: "desc" },
      },
      tripItineraryItems: {
        orderBy: { dayNumber: "asc" },
      },
      tripTasks: {
        orderBy: { createdAt: "asc" },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!request) return fail("Package request not found", 404);

  // Scoping check
  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isVisitor = ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone || (ctx.user.email && ctx.user.email === request.visitorEmail);
  const assignment = request.assignments.find((a) => a.providerId === ctx.user.id);
  const isAssignedOwner = Boolean(assignment);
  const isAssignedManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isVisitor && !isAssignedOwner && !isAssignedManager) {
    return fail("You are not authorized to view this NRI request", 403);
  }

  // If Business Owner views it for the first time, mark assignment as viewed / in-progress
  if (isAssignedOwner && assignment && !assignment.viewedAt) {
    await db.nriRequestAssignment.update({
      where: { id: assignment.id },
      data: {
        viewedAt: new Date(),
        status: assignment.status === "ASSIGNED" ? "IN_PROGRESS" : assignment.status,
      },
    });

    if (request.status === "ASSIGNED") {
      await db.nriPackageRequest.update({
        where: { id: request.id },
        data: { status: "IN_PROGRESS" },
      });
      await recordNriStatusChange({
        requestId: request.id,
        fromStatus: "ASSIGNED",
        toStatus: "IN_PROGRESS",
        changedById: ctx.user.id,
        changedByName: ctx.user.name || "Business Owner",
        reason: "Provider viewed request requirements and began quotation preparation",
        ip: getClientIp(req),
      });
    }
  }

  // Filter quotations:
  // If business owner: only show their own quotation
  // If visitor: hide internalNotes
  let filteredQuotations = request.quotations;
  if (!isSuperAdmin && !isVisitor && !isAssignedManager && isAssignedOwner) {
    filteredQuotations = request.quotations.filter((q) => q.providerId === ctx.user.id);
  }

  // Privacy protection: for visitors, strip internalNotes from itinerary and tasks
  const sanitizedItinerary = isVisitor
    ? request.tripItineraryItems.map(item => ({ ...item, internalNotes: null }))
    : request.tripItineraryItems;

  const sanitizedTasks = isVisitor
    ? request.tripTasks.map(task => ({ ...task, internalNotes: null }))
    : request.tripTasks;

  const sanitizedQuotations = isVisitor
    ? filteredQuotations.map(q => ({ ...q, internalNotes: null }))
    : filteredQuotations;

  const sanitizedRequest = {
    ...request,
    quotations: sanitizedQuotations,
    tripItineraryItems: sanitizedItinerary,
    tripTasks: sanitizedTasks,
  };

  return ok({
    item: sanitizedRequest,
    request: sanitizedRequest,
  });
});

const patchSchema = z.object({
  status: z.string().optional(),
  reason: z.string().optional(),
  declineReason: z.string().optional(),
  rejectionReason: z.string().optional(),
  cancellationReason: z.string().optional(),
  specialRequests: z.string().optional(),
});

// PATCH /api/v1/nri/requests/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: {
      assignments: true,
      visitor: true,
    },
  });

  if (!request) return fail("Package request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isVisitor = ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone;
  const assignment = request.assignments.find((a) => a.providerId === ctx.user.id);
  const isAssignedOwner = Boolean(assignment);
  const isAssignedManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isVisitor && !isAssignedOwner && !isAssignedManager) {
    return fail("Unauthorized to update this request", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON", 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const { status, reason, declineReason, rejectionReason, cancellationReason } = parsed.data;

  // Handle provider declining assignment
  if (isAssignedOwner && assignment && (status === "DECLINED" || declineReason)) {
    await db.nriRequestAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "DECLINED",
        declineReason: declineReason || reason || "Provider unavailable for requested dates",
        respondedAt: new Date(),
      },
    });

    const activeAssignments = await db.nriRequestAssignment.count({
      where: { requestId: id, status: { not: "DECLINED" } },
    });

    const newRequestStatus = activeAssignments === 0 ? "DECLINED" : request.status;

    if (newRequestStatus !== request.status) {
      await db.nriPackageRequest.update({
        where: { id },
        data: { status: newRequestStatus },
      });
    }

    await recordNriStatusChange({
      requestId: id,
      fromStatus: request.status,
      toStatus: newRequestStatus,
      changedById: ctx.user.id,
      changedByName: ctx.user.name || "Business Owner",
      reason: `Provider declined: ${declineReason || reason || "Unavailable"}`,
      ip: getClientIp(req),
    });

    return ok({ ok: true, message: "Request declined by provider" });
  }

  // Handle manager or superadmin rejecting request with reason
  if ((isSuperAdmin || isAssignedManager) && (status === "DECLINED" || rejectionReason)) {
    const finalReason = rejectionReason || reason || "Requirements cannot be fulfilled for the selected dates";
    const updated = await db.nriPackageRequest.update({
      where: { id },
      data: {
        status: "DECLINED",
        rejectionReason: finalReason,
      },
    });

    await recordNriStatusChange({
      requestId: id,
      fromStatus: request.status,
      toStatus: "DECLINED",
      changedById: ctx.user.id,
      changedByName: ctx.user.name || "NRI Service Manager",
      reason: `Request rejected: ${finalReason}`,
      ip: getClientIp(req),
    });

    await sendNriWorkflowNotification({
      userId: request.visitorId,
      recipientEmail: request.visitorEmail,
      recipientName: request.visitorName,
      type: "NRI_REQUEST_DECLINED",
      title: `Trip Request Status Update (${request.referenceNumber})`,
      message: `Your trip request could not be accommodated. Reason: ${finalReason}`,
      link: `/nri-access?ref=${request.referenceNumber}`,
    });

    // Automated Email Notification
    queueEmailNotification({
      eventType: "BOOKING_REJECTED",
      userId: request.visitorId,
      bookingId: id,
      bookingReference: request.referenceNumber,
      bookingCategory: "NRI custom packages",
      recipientEmail: request.visitorEmail,
      recipientName: request.visitorName,
      language: "en",
      payload: {
        eventType: "BOOKING_REJECTED",
        customerName: request.visitorName,
        bookingReference: request.referenceNumber,
        bookingCategory: "NRI custom packages",
        serviceName: `NRI Custom Pilgrimage Package (${request.groupSize} Travelers)`,
        rejectionStatus: "DECLINED",
        rejectionReason: finalReason,
        decisionDate: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
        supportContact: "support@godavari-one.org",
        nextSteps: "You may submit a revised itinerary with alternative dates.",
      },
    }).catch((err) => console.error("[NRI] Failed to queue rejection email:", err));

    return ok({ ok: true, request: updated, message: "Request rejected with reason" });
  }

  // Handle visitor cancelling request with reason
  if (isVisitor && (status === "CANCELLED" || cancellationReason)) {
    const finalReason = cancellationReason || reason || "Visitor cancelled request";
    const updated = await db.nriPackageRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancellationReason: finalReason,
      },
    });

    await recordNriStatusChange({
      requestId: id,
      fromStatus: request.status,
      toStatus: "CANCELLED",
      changedById: ctx.user.id,
      changedByName: ctx.user.name || request.visitorName,
      reason: finalReason,
      ip: getClientIp(req),
    });

    // Automated Email Notification
    queueEmailNotification({
      eventType: "BOOKING_CANCELLED",
      userId: request.visitorId,
      bookingId: id,
      bookingReference: request.referenceNumber,
      bookingCategory: "NRI custom packages",
      recipientEmail: request.visitorEmail,
      recipientName: request.visitorName,
      language: "en",
      payload: {
        eventType: "BOOKING_CANCELLED",
        customerName: request.visitorName,
        bookingReference: request.referenceNumber,
        bookingCategory: "NRI custom packages",
        serviceName: `NRI Custom Pilgrimage Package (${request.groupSize} Travelers)`,
        originalBookingDate: `${request.arrivalDate} to ${request.departureDate}`,
        cancellationTimestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        cancellationReason: finalReason,
        refundStatus: "No advance payment had been processed.",
        nextSteps: "You are welcome to submit future pilgrimage requests on Godavari One.",
        supportContact: "support@godavari-one.org",
      },
    }).catch((err) => console.error("[NRI] Failed to queue cancellation email:", err));

    if (request.assignedManagerId) {
      await sendNriWorkflowNotification({
        userId: request.assignedManagerId,
        type: "NRI_REQUEST_CANCELLED",
        title: `Client Cancelled Request (${request.referenceNumber})`,
        message: `${request.visitorName} has cancelled their trip request (${request.referenceNumber}). Reason: ${finalReason}`,
        link: "/admin",
      });
    }

    return ok({ ok: true, request: updated, message: "Request cancelled by visitor" });
  }

  // Status transitions for Super Admin or assigned NRI Service Manager
  if (status && status !== request.status) {
    const updated = await db.nriPackageRequest.update({
      where: { id },
      data: { status },
    });

    await recordNriStatusChange({
      requestId: id,
      fromStatus: request.status,
      toStatus: status,
      changedById: ctx.user.id,
      changedByName: ctx.user.name || (isSuperAdmin ? "Administrator" : "NRI Service Manager"),
      reason: reason || "Status updated",
      ip: getClientIp(req),
    });

    return ok({ ok: true, request: updated });
  }

  return ok({ ok: true, request });
});
