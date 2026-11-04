import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canReviewBookings } from "@/lib/constants";
import { queueEmailNotification, scheduleBookingReminders } from "@/lib/email-service";
import { z } from "zod";

// GET /api/v1/bookings/restaurant — list bookings
// Visitor: own bookings. Owner/Reviewer/Admin: bookings for their scope.
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;

  const where: Record<string, unknown> = {};
  if (ctx.user.role === "VISITOR") {
    where.userId = ctx.user.id;
  } else if (ctx.user.role === "BUSINESS_OWNER") {
    const owned = await db.listing.findMany({ where: { ownerId: ctx.user.id, category: "RESTAURANT" }, select: { id: true } });
    where.listingId = { in: owned.map((l) => l.id) };
  }
  if (status) where.status = status;

  const items = await db.restaurantBooking.findMany({
    where,
    include: { listing: true, user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok({ items });
});

// POST /api/v1/bookings/restaurant — visitor creates a booking request
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const schema = z.object({
    listingId: z.string(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.string().min(3).max(20),
    peopleCount: z.number().int().min(1).max(50),
    specialRequest: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { listingId, bookingDate, timeSlot, peopleCount, specialRequest } = parsed.data;

  // Must be a published restaurant
  const listing = await db.listing.findUnique({ where: { id: listingId }, include: { restaurantDetails: true } });
  if (!listing || listing.category !== "RESTAURANT" || listing.publicationStatus !== "PUBLISHED") {
    return fail("Restaurant not available", 404);
  }
  if (listing.restaurantDetails && !listing.restaurantDetails.reservationAvailable) {
    return fail("This restaurant does not accept reservations", 400);
  }

  // Prevent duplicates: same user, same listing/date/time, pending or approved
  const dup = await db.restaurantBooking.findFirst({
    where: { userId: ctx.user.id, listingId, bookingDate, timeSlot, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (dup) return fail("You already have a pending or approved booking for this slot", 409);

  // Overbooking prevention: enforce a max concurrent bookings per slot based on table capacity.
  const tableCapacity = listing.restaurantDetails?.tableCapacity ?? 50;
  const sameSlot = await db.restaurantBooking.aggregate({
    _sum: { peopleCount: true },
    where: { listingId, bookingDate, timeSlot, status: "APPROVED" },
  });
  if ((sameSlot._sum.peopleCount ?? 0) + peopleCount > tableCapacity) {
    return fail("This time slot is fully booked. Please choose another time.", 409);
  }

  const booking = await db.restaurantBooking.create({
    data: { listingId, userId: ctx.user.id, bookingDate, timeSlot, peopleCount, specialRequest: specialRequest || null },
  });

  await audit({
    actorId: ctx.user.id,
    action: "RESTAURANT_BOOKING_CREATE",
    targetType: "RESTAURANT_BOOKING",
    targetId: booking.id,
    details: { listingId, bookingDate, timeSlot, peopleCount },
    ip: getClientIp(req),
  });

  // Notify owner / reviewers
  const recipients = new Set<string>();
  if (listing.ownerId) recipients.add(listing.ownerId);
  const reviewers = await db.user.findMany({ where: { role: "BOOKING_REVIEWER", status: "ACTIVE" } });
  reviewers.forEach((r) => recipients.add(r.id));
  await Promise.all(
    [...recipients].map((uId) =>
      notify({ userId: uId, type: "BOOKING_REQUEST", title: "New restaurant booking", message: `Booking request for ${listing.name} on ${bookingDate} ${timeSlot}.` })
    )
  );

  // Automated Email Notification (Booking Successful + Reminders)
  const userRecord = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: { email: true, name: true, emailVerified: true },
  });
  if (userRecord?.email) {
    await queueEmailNotification({
      eventType: "BOOKING_SUCCESSFUL",
      userId: ctx.user.id,
      bookingId: booking.id,
      bookingReference: booking.id,
      bookingCategory: "RESTAURANT",
      recipientEmail: userRecord.email,
      recipientName: userRecord.name || ctx.user.name,
      payload: {
        customerName: userRecord.name || ctx.user.name || "Guest",
        bookingReference: booking.id,
        category: "RESTAURANT",
        serviceName: listing.name,
        bookingDate,
        bookingTime: timeSlot,
        locationAddress: listing.address,
        participantsOrRooms: `${peopleCount} Guest(s)`,
        status: booking.status,
      },
      idempotencyKey: `BOOKING_SUCCESSFUL_RESTAURANT_${booking.id}`,
    }).catch(() => {});

    await scheduleBookingReminders({
      id: booking.id,
      bookingReference: booking.id,
      category: "RESTAURANT",
      serviceName: listing.name,
      customerName: userRecord.name || ctx.user.name || "Guest",
      recipientEmail: userRecord.email,
      userId: ctx.user.id,
      bookingDate,
      bookingTime: timeSlot,
      locationAddress: listing.address,
    }).catch(() => {});
  }

  return created(booking);
});
