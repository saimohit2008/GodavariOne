import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import {
  canManageGhatPriorityBookings,
  isValidStatusTransition,
  type PriorityBookingStatus,
} from "@/lib/priority-booking";
import { z } from "zod";
import { queueEmailNotification, cancelBookingReminders } from "@/lib/email-service";

// GET /api/v1/priority-bookings/[id] — Retrieve single application details
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const booking = await db.priorityGhatBooking.findUnique({
    where: { id },
    include: {
      ghat: {
        select: {
          id: true,
          name: true,
          town: true,
          district: true,
          locality: true,
          address: true,
          phone: true,
          mapsUrl: true,
        },
      },
      timeSlot: true,
      reviewer: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      history: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) {
    return fail("Priority booking application not found.", 404);
  }

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isOwner = booking.userId === ctx.user.id;
  const isAuthorizedSupervisor = await canManageGhatPriorityBookings(ctx.user.id, role, booking.ghatId);

  if (!isSuperAdmin && !isAuthorizedSupervisor && !isOwner) {
    return fail("Access denied. You do not have permission to view this application.", 403);
  }

  // Strip internal reviewer notes for normal visitors
  if (!isSuperAdmin && !isAuthorizedSupervisor) {
    const { reviewerNotes, superAdminOverrideReason, ...sanitized } = booking;
    return ok(sanitized);
  }

  return ok(booking);
});

// PATCH /api/v1/priority-bookings/[id] — Workflow status updates and reviewer actions
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const booking = await db.priorityGhatBooking.findUnique({
    where: { id },
    include: {
      ghat: true,
      timeSlot: true,
      user: true,
    },
  });

  if (!booking) {
    return fail("Priority booking application not found.", 404);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload.", 400);

  const schema = z.object({
    action: z.enum([
      "START_REVIEW",
      "APPROVE",
      "REJECT",
      "REQUEST_ADDITIONAL_PROOF",
      "CANCEL",
      "SUPER_ADMIN_OVERRIDE",
    ]),
    rejectionReason: z.string().optional(),
    additionalProofNotes: z.string().optional(),
    reviewerNotes: z.string().optional(),
    cancellationReason: z.string().optional(),
    overrideReason: z.string().optional(),
    targetStatus: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Validation failed", 422);
  }

  const {
    action,
    rejectionReason,
    additionalProofNotes,
    reviewerNotes,
    cancellationReason,
    overrideReason,
    targetStatus,
  } = parsed.data;

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAuthorizedSupervisor = await canManageGhatPriorityBookings(ctx.user.id, role, booking.ghatId);
  const isApplicant = booking.userId === ctx.user.id;

  // Authorization checking per action
  if (action === "SUPER_ADMIN_OVERRIDE") {
    if (!isSuperAdmin) {
      return fail("Only Super Administrators can perform administrative status overrides.", 403);
    }
    if (!overrideReason || overrideReason.trim().length < 5) {
      return fail("A mandatory documented reason (minimum 5 characters) is required for Super Admin override.", 422);
    }
    if (!targetStatus) {
      return fail("A valid target status is required for administrative override.", 422);
    }
  } else if (action === "CANCEL") {
    // Visitor can cancel own booking; Supervisor or Admin can cancel with reason
    if (!isApplicant && !isSuperAdmin && !isAuthorizedSupervisor) {
      return fail("You do not have permission to cancel this application.", 403);
    }
  } else {
    // Reviewer actions: START_REVIEW, APPROVE, REJECT, REQUEST_ADDITIONAL_PROOF
    if (!isSuperAdmin && !isAuthorizedSupervisor) {
      return fail("Only authorized Ghat Supervisors for this ghat or Super Administrators can review applications.", 403);
    }
  }

  let nextStatus: PriorityBookingStatus;
  let updateData: any = {};
  let historyReason = "";

  switch (action) {
    case "START_REVIEW":
      nextStatus = "UNDER_REVIEW";
      historyReason = "Application under human review by supervisor";
      updateData = {
        status: nextStatus,
        reviewerId: ctx.user.id,
        reviewerNotes: reviewerNotes || booking.reviewerNotes,
      };
      break;

    case "APPROVE":
      nextStatus = "APPROVED";
      historyReason = "Eligibility approved. Ready for time slot allocation.";
      updateData = {
        status: nextStatus,
        reviewerId: ctx.user.id,
        reviewerNotes: reviewerNotes || booking.reviewerNotes,
        rejectionReason: null,
      };
      break;

    case "REJECT":
      if (!rejectionReason || rejectionReason.trim().length < 5) {
        return fail("A mandatory reason (minimum 5 characters) is required to reject an application.", 422);
      }
      nextStatus = "REJECTED";
      historyReason = `Application rejected: ${rejectionReason}`;
      updateData = {
        status: nextStatus,
        reviewerId: ctx.user.id,
        rejectionReason: rejectionReason.trim(),
        reviewerNotes: reviewerNotes || booking.reviewerNotes,
      };
      break;

    case "REQUEST_ADDITIONAL_PROOF":
      if (!additionalProofNotes || additionalProofNotes.trim().length < 5) {
        return fail("Clear instructions describing the required additional proof must be provided.", 422);
      }
      nextStatus = "ADDITIONAL_PROOF_REQUIRED";
      historyReason = `Additional proof requested: ${additionalProofNotes}`;
      updateData = {
        status: nextStatus,
        reviewerId: ctx.user.id,
        additionalProofNotes: additionalProofNotes.trim(),
        reviewerNotes: reviewerNotes || booking.reviewerNotes,
      };
      break;

    case "CANCEL":
      nextStatus = "CANCELLED";
      historyReason = cancellationReason || (isApplicant ? "Cancelled by applicant" : "Cancelled by administrator");
      updateData = {
        status: nextStatus,
        rejectionReason: cancellationReason || null,
      };
      // If a time slot was previously allocated, decrement its allocated count safely
      if (booking.timeSlotId && booking.status === "SLOT_ASSIGNED") {
        await db.ghatTimeSlot.updateMany({
          where: { id: booking.timeSlotId, allocatedCount: { gt: 0 } },
          data: { allocatedCount: { decrement: booking.accompanyingCount + 1 } },
        });
      }
      break;

    case "SUPER_ADMIN_OVERRIDE":
      nextStatus = targetStatus as PriorityBookingStatus;
      historyReason = `Super Admin Override: ${overrideReason}`;
      updateData = {
        status: nextStatus,
        superAdminOverrideReason: (overrideReason || "").trim(),
        reviewerId: ctx.user.id,
      };
      break;

    default:
      return fail("Unsupported review action.", 400);
  }

  // Validate state transition
  const transitionCheck = isValidStatusTransition(
    booking.status as PriorityBookingStatus,
    nextStatus,
    role,
    action === "SUPER_ADMIN_OVERRIDE"
  );

  if (!transitionCheck.valid) {
    return fail(transitionCheck.reason || "Invalid status transition.", 400);
  }

  // Persist update
  const updated = await db.priorityGhatBooking.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
  });

  // Record audit history
  await db.priorityBookingHistory.create({
    data: {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: nextStatus,
      changedById: ctx.user.id,
      changedByName: ctx.user.name || (isSuperAdmin ? "Super Admin" : "Ghat Supervisor"),
      reason: historyReason,
    },
  });

  // Notify applicant of status change
  if (booking.userId) {
    let notifyTitle = "Priority Booking Update";
    let notifyMsg = `Your application (${booking.applicationNumber}) status is now ${nextStatus}.`;

    if (nextStatus === "APPROVED") {
      notifyTitle = "Priority Booking Eligibility Approved";
      notifyMsg = `Your eligibility for ${booking.ghat.name} has been verified and approved. An assigned time slot and QR pass will follow shortly.`;
    } else if (nextStatus === "ADDITIONAL_PROOF_REQUIRED") {
      notifyTitle = "Additional Supporting Proof Required";
      notifyMsg = `Reviewer requested additional proof for ${booking.applicationNumber}: ${additionalProofNotes}. Please upload a replacement document in My Bookings.`;
    } else if (nextStatus === "REJECTED") {
      notifyTitle = "Priority Booking Application Ineligible";
      notifyMsg = `Your application (${booking.applicationNumber}) could not be approved: ${rejectionReason}.`;
    } else if (nextStatus === "CANCELLED") {
      notifyTitle = "Priority Booking Cancelled";
      notifyMsg = `Your priority booking application (${booking.applicationNumber}) has been cancelled.`;
    }

    await notify({
      userId: booking.userId,
      type: `PRIORITY_BOOKING_${nextStatus}`,
      title: notifyTitle,
      message: notifyMsg,
      link: "/bookings",
    });
  }

  // Automated Email Notification
  const recipientEmail = booking.user?.email;
  const recipientLanguage = (booking.user as any)?.language || "en";
  if (recipientEmail) {
    if (nextStatus === "APPROVED") {
      queueEmailNotification({
        eventType: "BOOKING_APPROVED",
        userId: booking.userId,
        bookingId: id,
        bookingReference: booking.applicationNumber,
        bookingCategory: "Ghat priority pass",
        recipientEmail,
        recipientName: booking.user?.name || booking.beneficiaryName,
        language: recipientLanguage,
        payload: {
          eventType: "BOOKING_APPROVED",
          customerName: booking.beneficiaryName,
          bookingReference: booking.applicationNumber,
          bookingCategory: "Ghat priority pass",
          serviceName: `Priority Ghat Pass (${booking.category === "SENIOR_CITIZEN" ? "Senior Citizen" : "Person with Disability"}) - ${booking.ghat.name}`,
          approvedDate: booking.visitDate,
          approvedTime: booking.timeSlot ? `${booking.timeSlot.startTime} - ${booking.timeSlot.endTime}` : "Time slot allocated",
          location: `${booking.ghat.name}, Rajahmundry`,
          approvalStatus: "APPROVED",
          entryInstructions: "Please carry your original ID proof and valid medical/senior certificate for priority entry verification at the dedicated counter.",
          qrPassUrl: `/bookings?ref=${booking.applicationNumber}`,
          supportContact: "support@godavari-one.org",
        },
      }).catch((err) => console.error("[PriorityBooking] Failed to queue approval email:", err));
    } else if (nextStatus === "REJECTED") {
      queueEmailNotification({
        eventType: "BOOKING_REJECTED",
        userId: booking.userId,
        bookingId: id,
        bookingReference: booking.applicationNumber,
        bookingCategory: "Ghat priority pass",
        recipientEmail,
        recipientName: booking.user?.name || booking.beneficiaryName,
        language: recipientLanguage,
        payload: {
          eventType: "BOOKING_REJECTED",
          customerName: booking.beneficiaryName,
          bookingReference: booking.applicationNumber,
          bookingCategory: "Ghat priority pass",
          serviceName: `Priority Ghat Pass - ${booking.ghat.name}`,
          rejectionStatus: "REJECTED",
          rejectionReason: (rejectionReason || "Verification criteria could not be verified.").trim(),
          decisionDate: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
          supportContact: "support@godavari-one.org",
          nextSteps: "You may submit a new priority application with valid supporting documentation or use general ghat access.",
        },
      }).catch((err) => console.error("[PriorityBooking] Failed to queue rejection email:", err));

      cancelBookingReminders(id).catch((err) => console.error("[PriorityBooking] Failed to cancel reminders:", err));
    } else if (nextStatus === "CANCELLED") {
      queueEmailNotification({
        eventType: "BOOKING_CANCELLED",
        userId: booking.userId,
        bookingId: id,
        bookingReference: booking.applicationNumber,
        bookingCategory: "Ghat priority pass",
        recipientEmail,
        recipientName: booking.user?.name || booking.beneficiaryName,
        language: recipientLanguage,
        payload: {
          eventType: "BOOKING_CANCELLED",
          customerName: booking.beneficiaryName,
          bookingReference: booking.applicationNumber,
          bookingCategory: "Ghat priority pass",
          serviceName: `Priority Ghat Pass - ${booking.ghat.name}`,
          originalBookingDate: booking.visitDate,
          originalBookingTime: booking.timeSlot ? `${booking.timeSlot.startTime} - ${booking.timeSlot.endTime}` : "Visit Date",
          cancellationTimestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          cancellationReason: historyReason || "Application cancelled",
          refundStatus: "Free governmental pass. No fee was charged.",
          nextSteps: "You can submit a fresh application for another date if needed.",
          supportContact: "support@godavari-one.org",
        },
      }).catch((err) => console.error("[PriorityBooking] Failed to queue cancellation email:", err));

      cancelBookingReminders(id).catch((err) => console.error("[PriorityBooking] Failed to cancel reminders:", err));
    }
  }

  // Audit log
  await audit({
    actorId: ctx.user.id,
    action: action === "SUPER_ADMIN_OVERRIDE" ? "PRIORITY_BOOKING_ADMIN_OVERRIDE" : `PRIORITY_BOOKING_${action}`,
    targetType: "PRIORITY_GHAT_BOOKING",
    targetId: id,
    details: {
      fromStatus: booking.status,
      toStatus: nextStatus,
      applicationNumber: booking.applicationNumber,
      ghatId: booking.ghatId,
      overrideReason: action === "SUPER_ADMIN_OVERRIDE" ? overrideReason : undefined,
      rejectionReason: action === "REJECT" ? rejectionReason : undefined,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    bookingId: updated.id,
    applicationNumber: updated.applicationNumber,
    status: updated.status,
    reviewerId: updated.reviewerId,
    rejectionReason: updated.rejectionReason,
    additionalProofNotes: updated.additionalProofNotes,
  });
});
