import { NextRequest } from "next/server";
import { db, isPostgresDatabase } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { canManageGhatPriorityBookings } from "@/lib/priority-booking";
import { generateQrPassToken } from "@/lib/qr";
import { z } from "zod";
import { queueEmailNotification, scheduleBookingReminders, cancelBookingReminders } from "@/lib/email-service";

// POST /api/v1/priority-bookings/[id]/slot — Assign or reassign an approved booking to a time slot
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAuthorizedSupervisor = await canManageGhatPriorityBookings(ctx.user.id, role, booking.ghatId);

  if (!isSuperAdmin && !isAuthorizedSupervisor) {
    return fail("Access denied. Only Super Admins or assigned Ghat Supervisors can assign time slots.", 403);
  }

  // Preconditions
  if (booking.status !== "APPROVED" && booking.status !== "SLOT_ASSIGNED") {
    return fail(
      `Cannot allocate time slot for application in ${booking.status} status. Only APPROVED applications can receive slots.`,
      400
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload.", 400);

  const schema = z.object({
    timeSlotId: z.string().min(1, "Time slot ID is required"),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Validation failed", 422);
  }

  const { timeSlotId, notes } = parsed.data;

  // Verify target slot
  const targetSlot = await db.ghatTimeSlot.findUnique({
    where: { id: timeSlotId },
  });

  if (!targetSlot) {
    return fail("Target time slot not found.", 404);
  }

  if (targetSlot.ghatId !== booking.ghatId) {
    return fail("Time slot belongs to a different ghat. Cross-ghat slot assignment is strictly prohibited.", 400);
  }

  if (targetSlot.status !== "ACTIVE") {
    return fail(`Time slot is currently ${targetSlot.status}. Only ACTIVE time slots can be assigned.`, 400);
  }

  // If already assigned to this exact slot, no-op
  if (booking.timeSlotId === targetSlot.id) {
    return ok({
      success: true,
      message: "Booking is already assigned to this time slot.",
      bookingId: booking.id,
      applicationNumber: booking.applicationNumber,
      slot: targetSlot,
    });
  }

  const totalSeats = 1 + booking.accompanyingCount;
  const isReassignment = Boolean(booking.timeSlotId && booking.status === "SLOT_ASSIGNED");
  const previousSlotId = booking.timeSlotId;

  // Concurrency-safe atomic seat allocation using tagged-template Prisma SQL
  // Automatically parameterizes for both PostgreSQL ($1, $2, ...) and SQLite (?1, ?2, ...)
  const updatedSlotRows = await db.$executeRaw`
    UPDATE "GhatTimeSlot"
    SET "allocatedCount" = "allocatedCount" + ${totalSeats}
    WHERE "id" = ${targetSlot.id}
      AND "allocatedCount" + ${totalSeats} <= "maxCapacity"
      AND "status" = 'ACTIVE'
  `;

  if (updatedSlotRows === 0) {
    // Re-check why update failed to provide precise, user-friendly feedback
    const freshSlot = await db.ghatTimeSlot.findUnique({ where: { id: targetSlot.id } });
    if (!freshSlot || freshSlot.status !== "ACTIVE") {
      return fail("This time slot is closed or no longer active.", 409);
    }
    const remaining = Math.max(0, freshSlot.maxCapacity - freshSlot.allocatedCount);
    return fail(
      `Time slot capacity exceeded. Requested ${totalSeats} pass(es) but only ${remaining} seat(s) remain available.`,
      409
    );
  }

  // If this was a reassignment, safely decrement the old slot's count
  // In PostgreSQL, GREATEST(0, ...) is required; in SQLite, MAX(0, ...) is used.
  if (isReassignment && previousSlotId) {
    if (isPostgresDatabase()) {
      await db.$executeRaw`
        UPDATE "GhatTimeSlot"
        SET "allocatedCount" = GREATEST(0, "allocatedCount" - ${totalSeats})
        WHERE "id" = ${previousSlotId}
      `;
    } else {
      await db.$executeRaw`
        UPDATE "GhatTimeSlot"
        SET "allocatedCount" = MAX(0, "allocatedCount" - ${totalSeats})
        WHERE "id" = ${previousSlotId}
      `;
    }
  }

  const qrPassToken = booking.qrPassToken || generateQrPassToken();

  const updatedBooking = await db.priorityGhatBooking.update({
    where: { id },
    data: {
      timeSlotId: targetSlot.id,
      status: "SLOT_ASSIGNED",
      slotAssignedAt: new Date(),
      visitDate: targetSlot.slotDate,
      qrPassToken,
      reviewerId: ctx.user.id,
      reviewerNotes: notes || booking.reviewerNotes,
      updatedAt: new Date(),
    },
    include: {
      timeSlot: true,
      ghat: true,
    },
  });

  // Record audit history
  const historyReason = isReassignment
    ? `Slot reassigned to ${targetSlot.slotDate} (${targetSlot.startTime} - ${targetSlot.endTime}) by supervisor`
    : `Slot assigned on ${targetSlot.slotDate} (${targetSlot.startTime} - ${targetSlot.endTime}) with QR pass generated`;

  await db.priorityBookingHistory.create({
    data: {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: "SLOT_ASSIGNED",
      changedById: ctx.user.id,
      changedByName: ctx.user.name || "Ghat Supervisor",
      reason: historyReason,
      metadata: JSON.stringify({
        slotId: targetSlot.id,
        slotDate: targetSlot.slotDate,
        startTime: targetSlot.startTime,
        endTime: targetSlot.endTime,
        seats: totalSeats,
        previousSlotId,
      }),
    },
  });

  // Notify beneficiary
  if (booking.userId) {
    await notify({
      userId: booking.userId,
      type: "PRIORITY_BOOKING_SLOT_ASSIGNED",
      title: isReassignment ? "Priority Ghat Time Slot Rescheduled" : "Priority Booking Confirmed · QR Pass Ready",
      message: `Your priority booking for ${booking.ghat.name} is scheduled for ${targetSlot.slotDate} between ${targetSlot.startTime} and ${targetSlot.endTime}. Your secure QR entry pass is ready.`,
      link: "/bookings",
    });
  }

  // Automated Email Notifications
  const recipientEmail = booking.user?.email;
  const recipientLanguage = (booking.user as any)?.language || "en";
  if (recipientEmail) {
    if (isReassignment) {
      queueEmailNotification({
        eventType: "BOOKING_RESCHEDULED",
        userId: booking.userId,
        bookingId: id,
        bookingReference: booking.applicationNumber,
        bookingCategory: "Ghat priority pass",
        recipientEmail,
        recipientName: booking.user?.name || booking.beneficiaryName,
        language: recipientLanguage,
        payload: {
          eventType: "BOOKING_RESCHEDULED",
          customerName: booking.beneficiaryName,
          bookingReference: booking.applicationNumber,
          bookingCategory: "Ghat priority pass",
          serviceName: `Priority Ghat Pass - ${booking.ghat.name}`,
          previousDate: booking.visitDate,
          previousTime: booking.timeSlot ? `${booking.timeSlot.startTime} - ${booking.timeSlot.endTime}` : "Previous Slot",
          newDate: targetSlot.slotDate,
          newTime: `${targetSlot.startTime} - ${targetSlot.endTime}`,
          location: `${booking.ghat.name}, Rajahmundry`,
          updatedStatus: "SLOT_ASSIGNED",
          instructions: "Your priority time slot has been successfully rescheduled. Please display your updated QR pass upon arrival at the priority counter.",
          supportContact: "support@godavari-one.org",
        },
      }).catch((err) => console.error("[PriorityBooking] Failed to queue reschedule email:", err));

      // Cancel previous reminders & schedule new reminders for the new slot
      cancelBookingReminders(id)
        .then(() =>
          scheduleBookingReminders({
            bookingId: id,
            bookingReference: booking.applicationNumber,
            bookingCategory: "Ghat priority pass",
            serviceName: `Priority Ghat Pass - ${booking.ghat.name}`,
            userId: booking.userId,
            recipientEmail,
            recipientName: booking.user?.name || booking.beneficiaryName,
            language: recipientLanguage,
            bookingDate: targetSlot.slotDate,
            bookingTime: targetSlot.startTime,
            location: `${booking.ghat.name}, Rajahmundry`,
          })
        )
        .catch((err) => console.error("[PriorityBooking] Failed to reschedule reminders:", err));
    } else {
      // First slot assignment = Booking Approved with QR Pass ready!
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
          serviceName: `Priority Ghat Pass - ${booking.ghat.name}`,
          approvedDate: targetSlot.slotDate,
          approvedTime: `${targetSlot.startTime} - ${targetSlot.endTime}`,
          location: `${booking.ghat.name}, Rajahmundry`,
          approvalStatus: "SLOT_ASSIGNED",
          entryInstructions: "Please arrive at the dedicated priority entrance 10 minutes prior to your slot. Present your QR entry pass and valid physical ID.",
          qrPassUrl: `/bookings?ref=${booking.applicationNumber}`,
          supportContact: "support@godavari-one.org",
        },
      }).catch((err) => console.error("[PriorityBooking] Failed to queue approval email:", err));

      scheduleBookingReminders({
        bookingId: id,
        bookingReference: booking.applicationNumber,
        bookingCategory: "Ghat priority pass",
        serviceName: `Priority Ghat Pass - ${booking.ghat.name}`,
        userId: booking.userId,
        recipientEmail,
        recipientName: booking.user?.name || booking.beneficiaryName,
        language: recipientLanguage,
        bookingDate: targetSlot.slotDate,
        bookingTime: targetSlot.startTime,
        location: `${booking.ghat.name}, Rajahmundry`,
      }).catch((err) => console.error("[PriorityBooking] Failed to schedule reminders:", err));
    }
  }

  // Audit log
  await audit({
    actorId: ctx.user.id,
    action: isReassignment ? "PRIORITY_BOOKING_SLOT_REASSIGN" : "PRIORITY_BOOKING_SLOT_ASSIGN",
    targetType: "PRIORITY_GHAT_BOOKING",
    targetId: id,
    details: {
      applicationNumber: booking.applicationNumber,
      ghatId: booking.ghatId,
      timeSlotId: targetSlot.id,
      slotDate: targetSlot.slotDate,
      startTime: targetSlot.startTime,
      endTime: targetSlot.endTime,
      totalSeats,
      previousSlotId,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    bookingId: updatedBooking.id,
    applicationNumber: updatedBooking.applicationNumber,
    status: updatedBooking.status,
    qrPassToken: updatedBooking.qrPassToken,
    visitDate: targetSlot.slotDate,
    timeSlot: {
      id: targetSlot.id,
      slotDate: targetSlot.slotDate,
      startTime: targetSlot.startTime,
      endTime: targetSlot.endTime,
      accessibilityNotes: targetSlot.accessibilityNotes,
    },
  });
});
