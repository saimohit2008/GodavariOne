import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canReviewBookings } from "@/lib/constants";
import { queueEmailNotification, scheduleBookingReminders, cancelBookingReminders } from "@/lib/email-service";
import { z } from "zod";

// PATCH /api/v1/bookings/restaurant/[id] — approve/reject/cancel
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const schema = z.object({
    status: z.enum(["APPROVED", "REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW"]).optional(),
    action: z.enum(["CONFIRM", "APPROVE", "REJECT", "DECLINE", "CANCEL", "COMPLETE", "NO_SHOW"]).optional(),
    reason: z.string().max(500).optional(),
    rejectionReason: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  let status = parsed.data.status;
  if (!status && parsed.data.action) {
    if (parsed.data.action === "CONFIRM" || parsed.data.action === "APPROVE") status = "APPROVED";
    else if (parsed.data.action === "REJECT" || parsed.data.action === "DECLINE") status = "REJECTED";
    else if (parsed.data.action === "CANCEL") status = "CANCELLED";
    else if (parsed.data.action === "COMPLETE") status = "COMPLETED";
    else if (parsed.data.action === "NO_SHOW") status = "NO_SHOW";
  }
  if (!status) return fail("Missing status or action parameter", 422);

  const rejectionReason = parsed.data.rejectionReason || parsed.data.reason;

  const booking = await db.restaurantBooking.findUnique({
    where: { id },
    include: {
      listing: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!booking) return fail("Booking not found", 404);

  const role = ctx.user.role;

  if (status === "CANCELLED") {
    // Visitors may cancel their own pending/approved bookings
    if (role === "VISITOR" && booking.userId !== ctx.user.id) return fail("You can only cancel your own bookings", 403);
  } else {
    // Approve/reject require reviewer role + ownership scoping for BUSINESS_OWNER
    if (!canReviewBookings(role as any)) return fail("Insufficient permissions", 403);
    if (role === "BUSINESS_OWNER" && booking.listing.ownerId !== ctx.user.id) {
      return fail("You can only manage bookings for your own restaurant", 403);
    }
  }

  // Overbooking check on approve
  if (status === "APPROVED") {
    const restaurant = await db.listing.findUnique({ where: { id: booking.listingId }, include: { restaurantDetails: true } });
    const cap = restaurant?.restaurantDetails?.tableCapacity ?? 50;
    const sameSlot = await db.restaurantBooking.aggregate({
      _sum: { peopleCount: true },
      where: { listingId: booking.listingId, bookingDate: booking.bookingDate, timeSlot: booking.timeSlot, status: "APPROVED", id: { not: id } },
    });
    if ((sameSlot._sum.peopleCount ?? 0) + booking.peopleCount > cap) {
      return fail("Cannot approve: this would overbook the slot.", 409);
    }
  }

  const updated = await db.restaurantBooking.update({
    where: { id },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? rejectionReason || null : null,
      reviewedById: status !== "CANCELLED" ? ctx.user.id : booking.reviewedById,
      reviewedAt: status !== "CANCELLED" ? new Date() : booking.reviewedAt,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: `RESTAURANT_BOOKING_${status}`,
    targetType: "RESTAURANT_BOOKING",
    targetId: id,
    details: { rejectionReason },
    ip: getClientIp(req),
  });

  await notify({
    userId: booking.userId,
    type: `BOOKING_${status}`,
    title: `Booking ${status.toLowerCase()}`,
    message: `Your booking at ${booking.listing.name} was ${status.toLowerCase()}.`,
  });

  // Automated Email Notification Dispatch
  const recipientEmail = booking.user?.email;
  if (recipientEmail) {
    const customerName = booking.user?.name || "Guest";
    const payloadBase = {
      customerName,
      bookingReference: booking.id,
      category: "RESTAURANT",
      serviceName: booking.listing.name,
      bookingDate: booking.bookingDate,
      bookingTime: booking.timeSlot,
      locationAddress: booking.listing.address || "Rajahmundry",
      participantsOrRooms: `${booking.peopleCount} Guest(s)`,
      status: updated.status,
    };

    if (status === "APPROVED") {
      await queueEmailNotification({
        eventType: "BOOKING_APPROVED",
        userId: booking.userId,
        bookingId: booking.id,
        bookingReference: booking.id,
        bookingCategory: "RESTAURANT",
        recipientEmail,
        recipientName: customerName,
        payload: payloadBase,
        idempotencyKey: `BOOKING_APPROVED_RESTAURANT_${booking.id}`,
      }).catch(() => {});

      await scheduleBookingReminders({
        id: booking.id,
        bookingReference: booking.id,
        category: "RESTAURANT",
        serviceName: booking.listing.name,
        customerName,
        recipientEmail,
        userId: booking.userId,
        bookingDate: booking.bookingDate,
        bookingTime: booking.timeSlot,
        locationAddress: booking.listing.address || "Rajahmundry",
      }).catch(() => {});
    } else if (status === "REJECTED") {
      await queueEmailNotification({
        eventType: "BOOKING_REJECTED",
        userId: booking.userId,
        bookingId: booking.id,
        bookingReference: booking.id,
        bookingCategory: "RESTAURANT",
        recipientEmail,
        recipientName: customerName,
        payload: {
          ...payloadBase,
          rejectionReason: rejectionReason || "Restaurant is unable to accommodate tables for this slot",
          rejectionDate: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
        },
        idempotencyKey: `BOOKING_REJECTED_RESTAURANT_${booking.id}`,
      }).catch(() => {});

      await cancelBookingReminders(booking.id).catch(() => {});
    } else if (status === "CANCELLED") {
      await queueEmailNotification({
        eventType: "BOOKING_CANCELLED",
        userId: booking.userId,
        bookingId: booking.id,
        bookingReference: booking.id,
        bookingCategory: "RESTAURANT",
        recipientEmail,
        recipientName: customerName,
        payload: {
          ...payloadBase,
          cancellationReason: rejectionReason || "Reservation cancelled",
          cancellationTimestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        },
        idempotencyKey: `BOOKING_CANCELLED_RESTAURANT_${booking.id}`,
      }).catch(() => {});

      await cancelBookingReminders(booking.id).catch(() => {});
    }
  }

  return ok(updated);
});
