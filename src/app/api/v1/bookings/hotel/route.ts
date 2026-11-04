import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, zodError, getClientIp, hotelBookingSchema } from "@/lib/validation";
import { queueEmailNotification, scheduleBookingReminders } from "@/lib/email-service";

// GET /api/v1/bookings/hotel
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const listingId = searchParams.get("listingId") || undefined;
  const roomId = searchParams.get("roomId") || undefined;
  const date = searchParams.get("date") || undefined;

  const where: Record<string, unknown> = {};

  if (ctx.user.role === "VISITOR") {
    where.userId = ctx.user.id;
  } else if (ctx.user.role === "BUSINESS_OWNER" || ctx.user.role === "BOOKING_REVIEWER") {
    const [owned, assigned] = await Promise.all([
      db.listing.findMany({ where: { ownerId: ctx.user.id, category: "HOTEL" }, select: { id: true } }),
      db.assignment.findMany({
        where: { userId: ctx.user.id, type: { in: ["HOTEL_STAFF", "LISTING_OWNER"] } },
        select: { listingId: true },
      }),
    ]);
    const allowedIds = [...new Set([...owned.map((l) => l.id), ...assigned.map((a) => a.listingId).filter(Boolean)])] as string[];
    where.listingId = { in: allowedIds };
  }

  if (listingId) {
    if (where.listingId && typeof where.listingId === "object" && "in" in (where.listingId as any)) {
      const allowed = (where.listingId as { in: string[] }).in;
      if (!allowed.includes(listingId)) {
        return fail("You are not authorized to view bookings for this hotel", 403);
      }
    }
    where.listingId = listingId;
  }

  if (roomId) where.roomId = roomId;
  if (status) where.status = status;
  if (date) {
    where.checkIn = { lte: date };
    where.checkOut = { gt: date };
  }

  const items = await db.hotelBooking.findMany({
    where,
    include: {
      listing: { select: { id: true, name: true, address: true } },
      room: { select: { id: true, name: true, roomIdentifier: true, basePrice: true, maxGuests: true } },
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return ok({ items });
});

// POST /api/v1/bookings/hotel
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = hotelBookingSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { listingId, roomId, checkIn, checkOut, guests, rooms, adults, children, specialRequest } = parsed.data;

  // Reject check-out dates that are not after check-in dates
  const cinDate = new Date(checkIn);
  const coutDate = new Date(checkOut);
  if (isNaN(cinDate.getTime()) || isNaN(coutDate.getTime()) || coutDate <= cinDate) {
    return fail("Check-out date must be strictly after check-in date", 422);
  }

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { hotelDetails: true },
  });

  if (!listing || listing.category !== "HOTEL" || listing.publicationStatus !== "PUBLISHED") {
    return fail("Hotel not available for bookings", 404);
  }

  const nights = Math.max(1, Math.round((coutDate.getTime() - cinDate.getTime()) / (1000 * 60 * 60 * 24)));

  let resolvedAdults = adults ?? Math.min(guests, rooms * 2);
  let resolvedChildren = children ?? Math.max(0, guests - resolvedAdults);

  // If a specific room type is requested, execute full room-type validation
  let roomRecord: any = null;
  if (roomId) {
    roomRecord = await db.hotelRoom.findUnique({ where: { id: roomId } });
    if (!roomRecord || roomRecord.listingId !== listingId) {
      return fail("Requested room type not found for this hotel", 404);
    }
    if (!roomRecord.isActive) {
      return fail("This room type is currently unavailable for new bookings", 400);
    }

    // Room capacity validation
    if (guests > roomRecord.maxGuests * rooms) {
      return fail(
        `Selected ${rooms} room(s) can accommodate at most ${roomRecord.maxGuests * rooms} guests total (${roomRecord.maxGuests} guests per room).`,
        422
      );
    }
    if (resolvedAdults > roomRecord.maxAdults * rooms) {
      return fail(
        `Selected ${rooms} room(s) can accommodate at most ${roomRecord.maxAdults * rooms} adults (${roomRecord.maxAdults} adults per room).`,
        422
      );
    }
    if (resolvedChildren > roomRecord.maxChildren * rooms) {
      return fail(
        `Selected ${rooms} room(s) can accommodate at most ${roomRecord.maxChildren * rooms} children (${roomRecord.maxChildren} children per room).`,
        422
      );
    }
  }

  // Calculate pricing server-side — never trust browser-supplied price
  let basePrice = roomRecord ? roomRecord.basePrice : 0;
  let extraCharges = 0;
  if (roomRecord) {
    const baseGuests = rooms * 2;
    if (guests > baseGuests) {
      const extraGuestsCount = guests - baseGuests;
      extraCharges = extraGuestsCount * roomRecord.extraPersonPrice * nights;
    }
  }
  const baseTotal = nights * rooms * basePrice;
  const totalPrice = baseTotal + extraCharges;

  // Concurrency safeguards using database transaction:
  // Re-validates inventory in isolation before inserting booking to prevent double bookings
  try {
    const booking = await db.$transaction(async (tx: any) => {
      if (roomId && roomRecord) {
        const overlapping = await tx.hotelBooking.findMany({
          where: {
            roomId,
            status: { in: ["PENDING", "APPROVED"] },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        });
        const reservedRooms = overlapping.reduce((s, b) => s + b.rooms, 0);
        if (reservedRooms + rooms > roomRecord.totalRooms) {
          throw new Error("INSUFFICIENT_ROOM_INVENTORY");
        }
      } else {
        // Fallback to overall hotel room capacity
        const totalRooms = listing.hotelDetails?.numRooms ?? 20;
        const overlapping = await tx.hotelBooking.findMany({
          where: {
            listingId,
            status: { in: ["PENDING", "APPROVED"] },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        });
        const reservedRooms = overlapping.reduce((s, b) => s + b.rooms, 0);
        if (reservedRooms + rooms > totalRooms) {
          throw new Error("INSUFFICIENT_HOTEL_INVENTORY");
        }
      }

      return tx.hotelBooking.create({
        data: {
          listingId,
          roomId: roomId || null,
          userId: ctx.user.id,
          checkIn,
          checkOut,
          guests,
          rooms,
          adults: resolvedAdults,
          children: resolvedChildren,
          basePrice,
          extraCharges,
          totalPrice,
          specialRequest: specialRequest || null,
          status: "PENDING",
        },
        include: {
          room: true,
          listing: { select: { id: true, name: true } },
        },
      });
    });

    await audit({
      actorId: ctx.user.id,
      action: "HOTEL_BOOKING_CREATE",
      targetType: "HOTEL_BOOKING",
      targetId: booking.id,
      details: {
        listingId,
        roomId,
        checkIn,
        checkOut,
        guests,
        rooms,
        totalPrice,
      },
      ip: getClientIp(req),
    });

    // Notify hotel owner and booking staff
    const recipients = new Set<string>();
    if (listing.ownerId) recipients.add(listing.ownerId);

    const staffAssignments = await db.assignment.findMany({
      where: { listingId, type: { in: ["HOTEL_STAFF", "LISTING_OWNER"] } },
      select: { userId: true },
    });
    staffAssignments.forEach((a) => recipients.add(a.userId));

    const reviewers = await db.user.findMany({ where: { role: "BOOKING_REVIEWER", status: "ACTIVE" } });
    reviewers.forEach((r) => recipients.add(r.id));

    await Promise.all(
      [...recipients].map((uId) =>
        notify({
          userId: uId,
          type: "BOOKING_REQUEST",
          title: "New hotel booking request",
          message: `Booking for ${listing.name} (${checkIn} → ${checkOut}, ${rooms} room(s)).`,
        })
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
        bookingCategory: "HOTEL",
        recipientEmail: userRecord.email,
        recipientName: userRecord.name || ctx.user.name,
        payload: {
          customerName: userRecord.name || ctx.user.name || "Guest",
          bookingReference: booking.id,
          category: "HOTEL",
          serviceName: listing.name,
          bookingDate: checkIn,
          checkOutDate: checkOut,
          locationAddress: listing.address,
          participantsOrRooms: `${rooms} Room(s), ${guests} Guest(s)`,
          status: booking.status,
          bookingStatus: booking.status,
          amount: totalPrice,
          currency: "INR",
        },
        idempotencyKey: `BOOKING_SUCCESSFUL_HOTEL_${booking.id}`,
      }).catch(() => {});

      await scheduleBookingReminders({
        id: booking.id,
        bookingReference: booking.id,
        category: "HOTEL",
        serviceName: listing.name,
        customerName: userRecord.name || ctx.user.name || "Guest",
        recipientEmail: userRecord.email,
        userId: ctx.user.id,
        bookingDate: checkIn,
        bookingTime: "12:00",
        locationAddress: listing.address,
      }).catch(() => {});
    }

    return created(booking);
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_ROOM_INVENTORY" || err.message === "INSUFFICIENT_HOTEL_INVENTORY") {
      return fail("Not enough rooms available for the selected dates. Please select different dates or fewer rooms.", 409);
    }
    throw err;
  }
});
