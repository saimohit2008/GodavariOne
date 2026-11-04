import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { z } from "zod";
import { queueEmailNotification, scheduleBookingReminders, cancelBookingReminders } from "@/lib/email-service";

const accommodationBookingSchema = z.object({
  listingId: z.string().min(1, "Accommodation centre is required"),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date (YYYY-MM-DD)"),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date (YYYY-MM-DD)"),
  peopleCount: z.number().int().min(1, "At least 1 person is required").max(50, "Maximum 50 people per registration"),
  groupType: z.enum(["FAMILY", "MEN", "WOMEN", "MIXED"]).default("FAMILY"),
  guestName: z.string().min(2, "Guest name is required").max(100),
  guestPhone: z.string().min(10, "Valid contact phone is required").max(15),
  idProofType: z.string().max(50).optional().nullable(),
  idProofNumber: z.string().max(50).optional().nullable(),
  specialNotes: z.string().max(500).optional().nullable(),
});

// GET /api/v1/bookings/accommodation — view accommodation registrations
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const listingId = searchParams.get("listingId") || undefined;
  const date = searchParams.get("date") || undefined;

  const where: Record<string, unknown> = {};

  if (ctx.user.role === "VISITOR") {
    where.userId = ctx.user.id;
  } else if (ctx.user.role === "BUSINESS_OWNER") {
    const [owned, assigned] = await Promise.all([
      db.listing.findMany({ where: { ownerId: ctx.user.id, category: "FREE_ACCOMMODATION" }, select: { id: true } }),
      db.assignment.findMany({ where: { userId: ctx.user.id }, select: { listingId: true } }),
    ]);
    const allowedIds = [...new Set([...owned.map((l) => l.id), ...assigned.map((a) => a.listingId).filter(Boolean)])] as string[];
    where.listingId = { in: allowedIds };
  }

  if (listingId) {
    if (where.listingId && typeof where.listingId === "object" && "in" in (where.listingId as any)) {
      const allowed = (where.listingId as { in: string[] }).in;
      if (!allowed.includes(listingId)) {
        return fail("You are not authorized to view registrations for this accommodation centre", 403);
      }
    }
    where.listingId = listingId;
  }

  if (status) where.status = status;
  if (date) {
    where.checkInDate = { lte: date };
    where.checkOutDate = { gt: date };
  }

  const items = await db.freeAccommodationBooking.findMany({
    where,
    include: {
      listing: {
        select: {
          id: true,
          name: true,
          address: true,
          locality: true,
          phone: true,
          freeAccommodationDetails: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return ok({ items });
});

// POST /api/v1/bookings/accommodation — Register for free stay
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required to register for free accommodation", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = accommodationBookingSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const data = parsed.data;

  // Strict date validation
  const cinDate = new Date(data.checkInDate);
  const coutDate = new Date(data.checkOutDate);
  if (isNaN(cinDate.getTime()) || isNaN(coutDate.getTime()) || coutDate <= cinDate) {
    return fail("Check-out date must be strictly after check-in date", 422);
  }

  const stayDays = Math.ceil((coutDate.getTime() - cinDate.getTime()) / (1000 * 60 * 60 * 24));

  const listing = await db.listing.findUnique({
    where: { id: data.listingId },
    include: { freeAccommodationDetails: true },
  });

  if (!listing) return fail("Accommodation centre not found", 404);
  if (listing.category !== "FREE_ACCOMMODATION") {
    return fail("Booking is only applicable for Free Accommodation centres", 400);
  }
  if (listing.publicationStatus !== "PUBLISHED") {
    return fail("This accommodation centre is currently not accepting registrations", 400);
  }

  const details = listing.freeAccommodationDetails;
  if (details?.isTemporarilyUnavailable) {
    return fail("This accommodation centre is temporarily closed and not accepting registrations.", 422);
  }

  // Enforce maximum permitted stay
  const maxStay = details?.maxStayDays || 7;
  if (stayDays > maxStay) {
    return fail(`Maximum permitted stay at this centre is ${maxStay} day(s). Requested: ${stayDays} days.`, 422);
  }

  // Prevent double allocation and overbooking
  if (details?.totalCapacity && details.totalCapacity > 0) {
    const overlapping = await db.freeAccommodationBooking.findMany({
      where: {
        listingId: data.listingId,
        status: { in: ["PENDING", "CONFIRMED"] },
        checkInDate: { lt: data.checkOutDate },
        checkOutDate: { gt: data.checkInDate },
      },
      select: { peopleCount: true },
    });

    const alreadyBooked = overlapping.reduce((sum, b) => sum + b.peopleCount, 0);
    const availableSpots = details.totalCapacity - alreadyBooked;

    if (availableSpots < data.peopleCount) {
      return fail(
        availableSpots <= 0
          ? "This centre is completely full for the selected dates. Please choose different dates."
          : `Only ${availableSpots} place(s) remaining for the selected dates. You requested ${data.peopleCount}.`,
        422
      );
    }
  }

  const booking = await db.freeAccommodationBooking.create({
    data: {
      listingId: data.listingId,
      userId: ctx.user.id,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      peopleCount: data.peopleCount,
      groupType: data.groupType,
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      idProofType: data.idProofType || null,
      idProofNumber: data.idProofNumber || null,
      specialNotes: data.specialNotes || null,
      status: "CONFIRMED",
    },
    include: {
      listing: { select: { id: true, name: true, address: true, phone: true } },
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "ACCOMMODATION_BOOKING_CREATE",
    targetType: "BOOKING",
    targetId: booking.id,
    details: {
      listingName: listing.name,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      peopleCount: data.peopleCount,
    },
    ip: getClientIp(req),
  });

  await notify({
    userId: ctx.user.id,
    type: "BOOKING_CONFIRMED",
    title: "Free Stay Registration Confirmed",
    message: `Your registration at ${listing.name} from ${data.checkInDate} to ${data.checkOutDate} for ${data.peopleCount} pilgrim(s) is confirmed.`,
    link: `/dashboard/bookings`,
  });

  // Automated Email Notification
  if (ctx.user.email) {
    const bookingRef = `FA-${booking.id.slice(-8).toUpperCase()}`;
    queueEmailNotification({
      eventType: "BOOKING_SUCCESSFUL",
      userId: ctx.user.id,
      bookingId: booking.id,
      bookingReference: bookingRef,
      bookingCategory: "Free accommodation",
      recipientEmail: ctx.user.email,
      recipientName: ctx.user.name || data.guestName,
      language: (ctx.user as any)?.language || "en",
      payload: {
        eventType: "BOOKING_SUCCESSFUL",
        customerName: data.guestName,
        bookingReference: bookingRef,
        bookingCategory: "Free accommodation",
        serviceName: listing.name,
        bookingDate: `${data.checkInDate} to ${data.checkOutDate}`,
        bookingTime: "Check-in: 12:00 PM",
        location: `${listing.address}, ${listing.locality}`,
        guestsOrParticipants: `${data.peopleCount} Pilgrims (${data.groupType})`,
        bookingStatus: "CONFIRMED",
        cancellationInstructions: "You may cancel your stay through your Godavari One bookings panel.",
        myBookingsUrl: "/dashboard/bookings",
        supportContact: listing.phone || "support@godavari-one.org",
      },
    }).catch((err) => console.error("[Accommodation] Failed to queue email notification:", err));

    scheduleBookingReminders({
      bookingId: booking.id,
      bookingReference: bookingRef,
      bookingCategory: "Free accommodation",
      serviceName: listing.name,
      userId: ctx.user.id,
      recipientEmail: ctx.user.email,
      recipientName: ctx.user.name || data.guestName,
      language: (ctx.user as any)?.language || "en",
      bookingDate: data.checkInDate,
      bookingTime: "12:00",
      location: `${listing.address}, ${listing.locality}`,
    }).catch((err) => console.error("[Accommodation] Failed to schedule reminders:", err));
  }

  return created(booking);
});

// PATCH /api/v1/bookings/accommodation — update registration status (e.g. cancel, mark completed)
export const PATCH = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const body = await req.json().catch(() => null);
  if (!body || !body.bookingId) return fail("bookingId is required");

  const schema = z.object({
    bookingId: z.string().min(1),
    status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { bookingId, status } = parsed.data;

  const booking = await db.freeAccommodationBooking.findUnique({
    where: { id: bookingId },
    include: { listing: true, user: true },
  });

  if (!booking) return fail("Registration not found", 404);

  // Permission check
  const isVisitorOwner = booking.userId === ctx.user.id;
  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isListingOwner = booking.listing.ownerId === ctx.user.id;

  if (isVisitorOwner) {
    if (status !== "CANCELLED") {
      return fail("Visitors can only cancel their own registrations", 403);
    }
  } else if (!isSuperAdmin && !isListingOwner) {
    const isAssigned = await db.assignment.findFirst({
      where: { userId: ctx.user.id, listingId: booking.listingId },
    });
    if (!isAssigned) {
      return fail("You are not authorized to update this registration", 403);
    }
  }

  const updated = await db.freeAccommodationBooking.update({
    where: { id: bookingId },
    data: { status },
  });

  await audit({
    actorId: ctx.user.id,
    action: "ACCOMMODATION_BOOKING_STATUS",
    targetType: "BOOKING",
    targetId: bookingId,
    details: { oldStatus: booking.status, newStatus: status },
    ip: getClientIp(req),
  });

  // Automated Email Notifications
  const recipientEmail = booking.user?.email;
  const bookingRef = `FA-${booking.id.slice(-8).toUpperCase()}`;
  if (recipientEmail) {
    if (status === "CANCELLED") {
      queueEmailNotification({
        eventType: "BOOKING_CANCELLED",
        userId: booking.userId,
        bookingId: bookingId,
        bookingReference: bookingRef,
        bookingCategory: "Free accommodation",
        recipientEmail,
        recipientName: booking.guestName,
        language: (booking.user as any)?.language || "en",
        payload: {
          eventType: "BOOKING_CANCELLED",
          customerName: booking.guestName,
          bookingReference: bookingRef,
          bookingCategory: "Free accommodation",
          serviceName: booking.listing.name,
          originalBookingDate: `${booking.checkInDate} to ${booking.checkOutDate}`,
          cancellationTimestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          cancellationReason: isVisitorOwner ? "Cancelled by visitor" : "Cancelled by accommodation supervisor",
          refundStatus: "Free service. No refund applicable.",
          nextSteps: "You may register for another free stay centre anytime on Godavari One.",
          supportContact: booking.listing.phone || "support@godavari-one.org",
        },
      }).catch((err) => console.error("[Accommodation] Failed to queue cancellation email:", err));

      cancelBookingReminders(bookingId).catch((err) => console.error("[Accommodation] Failed to cancel reminders:", err));
    } else if (status === "CONFIRMED" && booking.status !== "CONFIRMED") {
      queueEmailNotification({
        eventType: "BOOKING_APPROVED",
        userId: booking.userId,
        bookingId: bookingId,
        bookingReference: bookingRef,
        bookingCategory: "Free accommodation",
        recipientEmail,
        recipientName: booking.guestName,
        language: (booking.user as any)?.language || "en",
        payload: {
          eventType: "BOOKING_APPROVED",
          customerName: booking.guestName,
          bookingReference: bookingRef,
          bookingCategory: "Free accommodation",
          serviceName: booking.listing.name,
          approvedDate: `${booking.checkInDate} to ${booking.checkOutDate}`,
          approvedTime: "Check-in from 12:00 PM",
          location: `${booking.listing.address}, ${booking.listing.locality}`,
          approvalStatus: "CONFIRMED",
          entryInstructions: "Please present your photo ID card at the front desk upon check-in.",
          supportContact: booking.listing.phone || "support@godavari-one.org",
        },
      }).catch((err) => console.error("[Accommodation] Failed to queue approval email:", err));

      scheduleBookingReminders({
        bookingId: booking.id,
        bookingReference: bookingRef,
        bookingCategory: "Free accommodation",
        serviceName: booking.listing.name,
        userId: booking.userId,
        recipientEmail,
        recipientName: booking.guestName,
        language: (booking.user as any)?.language || "en",
        bookingDate: booking.checkInDate,
        bookingTime: "12:00",
        location: `${booking.listing.address}, ${booking.listing.locality}`,
      }).catch((err) => console.error("[Accommodation] Failed to schedule reminders:", err));
    }
  }

  return ok({ ok: true, booking: updated });
});
