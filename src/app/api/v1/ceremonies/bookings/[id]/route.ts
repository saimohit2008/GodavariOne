import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import { queueEmailNotification, cancelBookingReminders, scheduleBookingReminders } from "@/lib/email-service";

const updateBookingSchema = z.object({
  status: z.enum(["CONFIRMED", "DECLINED", "RESCHEDULE_REQUESTED", "CANCELLED", "COMPLETED"]).optional(),
  action: z.enum(["CONFIRM", "DECLINE", "RESCHEDULE_REQUEST", "CANCEL", "COMPLETE"]).optional(),
  reason: z.string().optional().nullable(),
  declineReason: z.string().optional().nullable(),
  cancellationReason: z.string().optional().nullable(),
  rescheduleReason: z.string().optional().nullable(),
  rescheduleProposedDate: z.string().optional().nullable(),
  rescheduleProposedTime: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

// GET /api/v1/ceremonies/bookings/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const booking = await db.ceremonyBooking.findUnique({
    where: { id },
    include: {
      purohit: true,
      visitor: {
        select: { id: true, name: true, phone: true, email: true },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) return fail("Ceremony booking not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isPurohit = booking.purohit.userId === ctx.user.id || (ctx.user.role === "PUROHIT" && booking.purohit.phone === ctx.user.phone);
  const isVisitor = booking.visitorId === ctx.user.id || booking.visitorPhone === ctx.user.phone;

  if (!isSuperAdmin && !isPurohit && !isVisitor) {
    return fail("Unauthorized to view this ceremony booking", 403);
  }

  // Hide internal notes from visitor
  const sanitized = isVisitor ? { ...booking, internalNotes: null } : booking;

  return ok({ booking: sanitized });
});

// PATCH /api/v1/ceremonies/bookings/[id] — lifecycle actions
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const booking = await db.ceremonyBooking.findUnique({
    where: { id },
    include: {
      purohit: true,
      visitor: true,
    },
  });

  if (!booking) return fail("Ceremony booking not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isPurohit = booking.purohit.userId === ctx.user.id || (ctx.user.role === "PUROHIT" && booking.purohit.phone === ctx.user.phone);
  const isVisitor = booking.visitorId === ctx.user.id || booking.visitorPhone === ctx.user.phone;

  if (!isSuperAdmin && !isPurohit && !isVisitor) {
    return fail("Unauthorized to update this ceremony booking", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = updateBookingSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const data = parsed.data;
  const action = data.action || (data.status as any);

  let newStatus = booking.status;
  const updateData: Record<string, unknown> = {};

  if (action === "CONFIRM" || action === "CONFIRMED") {
    if (!isSuperAdmin && !isPurohit) {
      return fail("Only the assigned Purohit or Super Admin can confirm this booking", 403);
    }
    newStatus = "CONFIRMED";
    updateData.status = "CONFIRMED";
    updateData.confirmedAt = new Date();
  } else if (action === "DECLINE" || action === "DECLINED") {
    if (!isSuperAdmin && !isPurohit) {
      return fail("Only the assigned Purohit or Super Admin can decline this booking", 403);
    }
    const decReason = data.declineReason || data.reason || "Purohit is unable to perform this ceremony";
    newStatus = "DECLINED";
    updateData.status = "DECLINED";
    updateData.declineReason = decReason;
  } else if (action === "RESCHEDULE_REQUEST" || action === "RESCHEDULE_REQUESTED") {
    if (!isSuperAdmin && !isPurohit) {
      return fail("Only the assigned Purohit or Super Admin can request rescheduling", 403);
    }
    const resReason = data.rescheduleReason || data.reason || "Purohit requested schedule adjustment";
    newStatus = "RESCHEDULE_REQUESTED";
    updateData.status = "RESCHEDULE_REQUESTED";
    updateData.rescheduleReason = resReason;
    if (data.rescheduleProposedDate) updateData.rescheduleProposedDate = data.rescheduleProposedDate;
    if (data.rescheduleProposedTime) updateData.rescheduleProposedTime = data.rescheduleProposedTime;
  } else if (action === "CANCEL" || action === "CANCELLED") {
    const cancReason = data.cancellationReason || data.reason || (isVisitor ? "Cancelled by visitor" : "Cancelled by purohit/admin");
    newStatus = "CANCELLED";
    updateData.status = "CANCELLED";
    updateData.cancellationReason = cancReason;
  } else if (action === "COMPLETE" || action === "COMPLETED") {
    if (!isSuperAdmin && !isPurohit) {
      return fail("Only the assigned Purohit or Super Admin can mark a ceremony as completed", 403);
    }
    newStatus = "COMPLETED";
    updateData.status = "COMPLETED";
    updateData.completedAt = new Date();
  }

  if (data.internalNotes && (isSuperAdmin || isPurohit)) {
    updateData.internalNotes = data.internalNotes;
  }

  const updatedBooking = await db.ceremonyBooking.update({
    where: { id },
    data: updateData,
    include: {
      purohit: { select: { id: true, fullName: true, phone: true } },
      visitor: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  // Record status history
  const reasonText = data.reason || data.declineReason || data.cancellationReason || data.rescheduleReason || `Status changed to ${newStatus}`;
  await db.ceremonyBookingStatusHistory.create({
    data: {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: newStatus,
      changedById: ctx.user.id,
      changedByName: ctx.user.name || (isPurohit ? `Purohit ${booking.purohit.fullName}` : isSuperAdmin ? "Administrator" : "Visitor"),
      reason: reasonText,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: `CEREMONY_BOOKING_${action}`,
    targetType: "CEREMONY_BOOKING",
    targetId: id,
    details: { fromStatus: booking.status, toStatus: newStatus, reason: reasonText },
    ip: getClientIp(req),
  });

  // Notify visitor if purohit or admin made change
  if ((isPurohit || isSuperAdmin) && booking.visitorId) {
    await notify({
      userId: booking.visitorId,
      type: `CEREMONY_${newStatus}`,
      title: `Ceremony Booking Update (${booking.bookingReference})`,
      message: `Your booking for ${booking.ceremonyType} with Purohit ${booking.purohit.fullName} is now ${newStatus}. Note: ${reasonText}`,
      link: "/bookings",
    });
  }

  // Notify purohit if visitor cancelled
  if (isVisitor && booking.purohit.userId) {
    await notify({
      userId: booking.purohit.userId,
      type: "CEREMONY_CANCELLED",
      title: `Ceremony Cancelled by Visitor (${booking.bookingReference})`,
      message: `${booking.visitorName} cancelled ceremony ${booking.ceremonyType} on ${booking.bookingDate} (${booking.startTime}). Reason: ${reasonText}`,
      link: "/admin",
    });
  }

  // Automated Email Notifications
  const recipientEmail = booking.visitorEmail || updatedBooking.visitor?.email;
  const visitorLanguage = (booking.visitor as any)?.language || "en";

  if (recipientEmail) {
    if (newStatus === "CONFIRMED") {
      queueEmailNotification({
        eventType: "BOOKING_APPROVED",
        userId: booking.visitorId,
        bookingId: id,
        bookingReference: booking.bookingReference,
        bookingCategory: "Ceremony",
        recipientEmail,
        recipientName: booking.visitorName,
        language: visitorLanguage,
        payload: {
          eventType: "BOOKING_APPROVED",
          customerName: booking.visitorName,
          bookingReference: booking.bookingReference,
          bookingCategory: "Ceremony",
          serviceName: `${booking.ceremonyType} Ceremony (Purohit ${booking.purohit.fullName})`,
          approvedDate: booking.bookingDate,
          approvedTime: `${booking.startTime} - ${booking.endTime}`,
          location: booking.locationAddress || "Rajahmundry Pushkaralu Ghats",
          approvalStatus: "CONFIRMED",
          entryInstructions: "Please arrive at the ghat 15 minutes prior to the muhurtham with required puja items.",
          qrPassUrl: `/bookings?ref=${booking.bookingReference}`,
          supportContact: "support@godavari-one.org",
        },
      }).catch((err) => console.error("[Ceremony] Failed to queue approval email:", err));

      // Schedule reminders
      scheduleBookingReminders({
        bookingId: id,
        bookingReference: booking.bookingReference,
        bookingCategory: "Ceremony",
        serviceName: `${booking.ceremonyType} Ceremony (Purohit ${booking.purohit.fullName})`,
        userId: booking.visitorId,
        recipientEmail,
        recipientName: booking.visitorName,
        language: visitorLanguage,
        bookingDate: booking.bookingDate,
        bookingTime: booking.startTime,
        location: booking.locationAddress || "Rajahmundry Pushkaralu Ghats",
      }).catch((err) => console.error("[Ceremony] Failed to schedule reminders:", err));
    } else if (newStatus === "DECLINED") {
      queueEmailNotification({
        eventType: "BOOKING_REJECTED",
        userId: booking.visitorId,
        bookingId: id,
        bookingReference: booking.bookingReference,
        bookingCategory: "Ceremony",
        recipientEmail,
        recipientName: booking.visitorName,
        language: visitorLanguage,
        payload: {
          eventType: "BOOKING_REJECTED",
          customerName: booking.visitorName,
          bookingReference: booking.bookingReference,
          bookingCategory: "Ceremony",
          serviceName: `${booking.ceremonyType} Ceremony (Purohit ${booking.purohit.fullName})`,
          rejectionStatus: "DECLINED",
          rejectionReason: data.declineReason || data.reason || "Purohit is unable to perform this ceremony on the requested date/time.",
          decisionDate: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
          supportContact: "support@godavari-one.org",
          nextSteps: "You may choose another available Purohit or request alternative auspicious dates.",
        },
      }).catch((err) => console.error("[Ceremony] Failed to queue rejection email:", err));

      cancelBookingReminders(id).catch((err) => console.error("[Ceremony] Failed to cancel reminders:", err));
    } else if (newStatus === "CANCELLED") {
      queueEmailNotification({
        eventType: "BOOKING_CANCELLED",
        userId: booking.visitorId,
        bookingId: id,
        bookingReference: booking.bookingReference,
        bookingCategory: "Ceremony",
        recipientEmail,
        recipientName: booking.visitorName,
        language: visitorLanguage,
        payload: {
          eventType: "BOOKING_CANCELLED",
          customerName: booking.visitorName,
          bookingReference: booking.bookingReference,
          bookingCategory: "Ceremony",
          serviceName: `${booking.ceremonyType} Ceremony (Purohit ${booking.purohit.fullName})`,
          originalBookingDate: booking.bookingDate,
          originalBookingTime: `${booking.startTime} - ${booking.endTime}`,
          cancellationTimestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          cancellationReason: data.cancellationReason || data.reason || "Cancelled by user request",
          refundStatus: "No online payment was collected for this reservation.",
          nextSteps: "You can schedule another ceremony anytime on Godavari One.",
          supportContact: "support@godavari-one.org",
        },
      }).catch((err) => console.error("[Ceremony] Failed to queue cancellation email:", err));

      cancelBookingReminders(id).catch((err) => console.error("[Ceremony] Failed to cancel reminders:", err));
    } else if (newStatus === "RESCHEDULE_REQUESTED") {
      queueEmailNotification({
        eventType: "BOOKING_RESCHEDULED",
        userId: booking.visitorId,
        bookingId: id,
        bookingReference: booking.bookingReference,
        bookingCategory: "Ceremony",
        recipientEmail,
        recipientName: booking.visitorName,
        language: visitorLanguage,
        payload: {
          eventType: "BOOKING_RESCHEDULED",
          customerName: booking.visitorName,
          bookingReference: booking.bookingReference,
          bookingCategory: "Ceremony",
          serviceName: `${booking.ceremonyType} Ceremony (Purohit ${booking.purohit.fullName})`,
          previousDate: booking.bookingDate,
          previousTime: `${booking.startTime} - ${booking.endTime}`,
          newDate: data.rescheduleProposedDate || booking.bookingDate,
          newTime: data.rescheduleProposedTime || booking.startTime,
          location: booking.locationAddress || "Rajahmundry Pushkaralu Ghats",
          updatedStatus: "RESCHEDULE_REQUESTED",
          instructions: `Purohit proposed a new schedule: ${data.rescheduleReason || "Adjustment requested"}. Please review in your bookings.`,
          supportContact: "support@godavari-one.org",
        },
      }).catch((err) => console.error("[Ceremony] Failed to queue reschedule email:", err));
    }
  }

  return ok({
    ok: true,
    booking: updatedBooking,
    message: `Ceremony booking updated to ${newStatus}`,
  });
});
