import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canReviewBookings } from "@/lib/constants";
import { queueEmailNotification, scheduleBookingReminders, cancelBookingReminders } from "@/lib/email-service";
import { z } from "zod";

// PATCH /api/v1/bookings/hotel/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    status: z.enum(["APPROVED", "REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW"]).optional(),
    action: z.enum(["APPROVE", "REJECT", "CANCEL", "COMPLETE", "NO_SHOW"]).optional(),
    reason: z.string().max(500).optional(),
    rejectionReason: z.string().max(500).optional(),
    markCheckedIn: z.boolean().optional(),
    markCheckedOut: z.boolean().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  let status = parsed.data.status;
  if (!status && parsed.data.action) {
    if (parsed.data.action === "APPROVE") status = "APPROVED";
    else if (parsed.data.action === "REJECT") status = "REJECTED";
    else if (parsed.data.action === "CANCEL") status = "CANCELLED";
    else if (parsed.data.action === "COMPLETE") status = "COMPLETED";
    else if (parsed.data.action === "NO_SHOW") status = "NO_SHOW";
  }

  const rejectionReason = parsed.data.rejectionReason || parsed.data.reason;
  const { markCheckedIn, markCheckedOut } = parsed.data;

  const booking = await db.hotelBooking.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          hotelDetails: true,
        },
      },
      room: true,
    },
  });

  if (!booking) return fail("Booking not found", 404);

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isVisitor = role === "VISITOR";

  // Permission verification
  if (status === "CANCELLED" && !markCheckedIn && !markCheckedOut) {
    if (isVisitor && booking.userId !== ctx.user.id) {
      return fail("You can only cancel your own bookings", 403);
    }
  } else {
    if (isVisitor) {
      return fail("Visitors are not authorized to update booking status", 403);
    }

    if (!isSuperAdmin) {
      // Check if business owner owns this hotel
      const isOwner = role === "BUSINESS_OWNER" && booking.listing.ownerId === ctx.user.id;

      // Check if assigned to this hotel as staff
      const isAssigned = await db.assignment.findFirst({
        where: {
          userId: ctx.user.id,
          listingId: booking.listingId,
          type: { in: ["HOTEL_STAFF", "LISTING_OWNER"] },
        },
      });

      const isReviewer = canReviewBookings(role as any);

      if (!isOwner && !isAssigned && !isReviewer) {
        return fail("You are not authorized to manage bookings for this hotel", 403);
      }
    }
  }

  // Transaction-safe inventory revalidation when approving
  if (status === "APPROVED") {
    if (booking.roomId && booking.room) {
      const overlapping = await db.hotelBooking.findMany({
        where: {
          roomId: booking.roomId,
          status: "APPROVED",
          id: { not: id },
          checkIn: { lt: booking.checkOut },
          checkOut: { gt: booking.checkIn },
        },
      });
      const used = overlapping.reduce((s, b) => s + b.rooms, 0);
      if (used + booking.rooms > booking.room.totalRooms) {
        return fail(
          `Cannot approve: room inventory exceeded. (${used}/${booking.room.totalRooms} rooms already booked for these dates).`,
          409
        );
      }
    } else {
      const overlapping = await db.hotelBooking.findMany({
        where: {
          listingId: booking.listingId,
          status: "APPROVED",
          id: { not: id },
          checkIn: { lt: booking.checkOut },
          checkOut: { gt: booking.checkIn },
        },
      });
      const total = booking.listing.hotelDetails?.numRooms ?? 20;
      const used = overlapping.reduce((s, b) => s + b.rooms, 0);
      if (used + booking.rooms > total) {
        return fail("Cannot approve: not enough total hotel rooms available", 409);
      }
    }
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status;
    updateData.rejectionReason = status === "REJECTED" ? rejectionReason || null : null;
    if (status !== "CANCELLED") {
      updateData.reviewedById = ctx.user.id;
      updateData.reviewedAt = now;
    }
    if (status === "COMPLETED") {
      updateData.checkedOutAt = now;
    }
  }

  if (markCheckedIn) {
    updateData.checkedInAt = now;
  }
  if (markCheckedOut) {
    updateData.checkedOutAt = now;
    if (!status) updateData.status = "COMPLETED";
  }

  const updated = await db.hotelBooking.update({
    where: { id },
    data: updateData,
    include: {
      listing: { select: { id: true, name: true, address: true } },
      room: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  const actionName = status ? `HOTEL_BOOKING_${status}` : "HOTEL_BOOKING_CHECK_STATUS_UPDATE";

  await audit({
    actorId: ctx.user.id,
    action: actionName,
    targetType: "HOTEL_BOOKING",
    targetId: id,
    details: {
      status: updated.status,
      rejectionReason,
      checkedInAt: updated.checkedInAt,
      checkedOutAt: updated.checkedOutAt,
    },
    ip: getClientIp(req),
  });

  if (status && status !== "COMPLETED") {
    await notify({
      userId: booking.userId,
      type: `BOOKING_${status}`,
      title: `Hotel booking ${status.toLowerCase()}`,
      message: `Your booking at ${booking.listing.name} was marked ${status.toLowerCase()}.`,
    }).catch(() => undefined);

    // Automated Email Dispatch
    const recipientEmail = updated.user?.email;
    if (recipientEmail) {
      const customerName = updated.user?.name || "Guest";
      const payloadBase = {
        customerName,
        bookingReference: booking.id,
        category: "HOTEL",
        serviceName: updated.listing.name,
        bookingDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        locationAddress: updated.listing.address || booking.listing.address || "Rajahmundry",
        participantsOrRooms: `${booking.rooms} Room(s), ${booking.guests} Guest(s)`,
        status: updated.status,
      };

      if (status === "APPROVED") {
        await queueEmailNotification({
          eventType: "BOOKING_APPROVED",
          userId: booking.userId,
          bookingId: booking.id,
          bookingReference: booking.id,
          bookingCategory: "HOTEL",
          recipientEmail,
          recipientName: customerName,
          payload: payloadBase,
          idempotencyKey: `BOOKING_APPROVED_HOTEL_${booking.id}`,
        }).catch(() => {});

        // Ensure reminders are scheduled
        await scheduleBookingReminders({
          id: booking.id,
          bookingReference: booking.id,
          category: "HOTEL",
          serviceName: updated.listing.name,
          customerName,
          recipientEmail,
          userId: booking.userId,
          bookingDate: booking.checkIn,
          bookingTime: "12:00",
          locationAddress: updated.listing.address || "Rajahmundry",
        }).catch(() => {});
      } else if (status === "REJECTED") {
        await queueEmailNotification({
          eventType: "BOOKING_REJECTED",
          userId: booking.userId,
          bookingId: booking.id,
          bookingReference: booking.id,
          bookingCategory: "HOTEL",
          recipientEmail,
          recipientName: customerName,
          payload: {
            ...payloadBase,
            rejectionReason: rejectionReason || "Selected room type is not available for requested dates",
            rejectionDate: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
          },
          idempotencyKey: `BOOKING_REJECTED_HOTEL_${booking.id}`,
        }).catch(() => {});

        await cancelBookingReminders(booking.id).catch(() => {});
      } else if (status === "CANCELLED") {
        await queueEmailNotification({
          eventType: "BOOKING_CANCELLED",
          userId: booking.userId,
          bookingId: booking.id,
          bookingReference: booking.id,
          bookingCategory: "HOTEL",
          recipientEmail,
          recipientName: customerName,
          payload: {
            ...payloadBase,
            cancellationReason: rejectionReason || "Cancelled by user or administrator",
            cancellationTimestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          },
          idempotencyKey: `BOOKING_CANCELLED_HOTEL_${booking.id}`,
        }).catch(() => {});

        await cancelBookingReminders(booking.id).catch(() => {});
      }
    }
  }

  return ok(updated);
});
