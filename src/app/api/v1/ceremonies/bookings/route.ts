import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp, ApiError, zodError, ceremonyBookingSchema } from "@/lib/validation";
import { queueEmailNotification, scheduleBookingReminders } from "@/lib/email-service";
import {
  generateCeremonyReference,
  timeToMinutes,
  minutesToTime,
  intervalsOverlap,
} from "@/lib/ceremonies";

const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// GET /api/v1/ceremonies/bookings
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const purohitId = searchParams.get("purohitId") || undefined;
  const date = searchParams.get("date") || undefined;
  const reference = searchParams.get("reference") || undefined;

  const where: Record<string, unknown> = {};

  if (status && status !== "ALL") {
    where.status = status;
  }
  if (date) {
    where.bookingDate = date;
  }
  if (reference) {
    where.bookingReference = reference;
  }

  // Role-based tenant scoping
  if (ctx.user.role === "SUPER_ADMIN") {
    if (purohitId) {
      where.purohitId = purohitId;
    }
  } else if (ctx.user.role === "PUROHIT") {
    // Purohit can ONLY see bookings assigned to their own profile!
    const myProfile = await db.purohitProfile.findUnique({
      where: { userId: ctx.user.id },
    });
    if (!myProfile) {
      // Check by phone
      const profileByPhone = await db.purohitProfile.findFirst({
        where: { phone: ctx.user.phone },
      });
      if (!profileByPhone) return ok({ items: [], count: 0 });
      where.purohitId = profileByPhone.id;
    } else {
      where.purohitId = myProfile.id;
    }
  } else {
    // Visitor: see only their own bookings
    where.OR = [
      { visitorId: ctx.user.id },
      { visitorPhone: ctx.user.phone },
      ...(ctx.user.email ? [{ visitorEmail: ctx.user.email }] : []),
    ];
  }

  const items = await db.ceremonyBooking.findMany({
    where,
    include: {
      purohit: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          profilePhotoUrl: true,
          serviceArea: true,
          baseFee: true,
          feeIncludes: true,
        },
      },
      visitor: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ bookingDate: "desc" }, { startTime: "asc" }],
  });

  return ok({ items, bookings: items, count: items.length });
});

// POST /api/v1/ceremonies/bookings — Concurrency-Safe Ceremony Booking
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = ceremonyBookingSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const data = parsed.data;

  const startMinutes = timeToMinutes(data.startTime);
  const endMinutes = startMinutes + data.durationMinutes;
  const calculatedEndTime = minutesToTime(endMinutes);

  // Check advance booking bounds (Asia/Kolkata date)
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  if (data.bookingDate < todayStr) {
    return fail("Cannot book ceremonies for past dates", 422);
  }

  // ATOMIC DATABASE TRANSACTION FOR CONCURRENCY-SAFE OVERLAP PREVENTION
  const booking = await db.$transaction(async (tx) => {
    let reference = generateCeremonyReference();
    let refAttempts = 0;
    while (refAttempts < 5) {
      const existingRef = await tx.ceremonyBooking.findUnique({ where: { bookingReference: reference } });
      if (!existingRef) break;
      reference = generateCeremonyReference();
      refAttempts++;
    }
    // 1. Fetch Purohit Profile
    const purohit = await tx.purohitProfile.findUnique({
      where: { id: data.purohitId },
      include: {
        blockedPeriods: {
          where: {
            startDate: { lte: data.bookingDate },
            endDate: { gte: data.bookingDate },
          },
        },
      },
    });

    if (!purohit) {
      throw new ApiError("Purohit profile not found", 404);
    }

    if (!purohit.isActive || !purohit.isPublished || purohit.verificationStatus !== "VERIFIED") {
      throw new ApiError("This purohit is currently not available for new public bookings", 400);
    }

    // 2. Check Day of Week
    const parsedDate = new Date(`${data.bookingDate}T00:00:00+05:30`);
    const dayName = DAYS_OF_WEEK[parsedDate.getDay()];
    let workingDays: string[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    if (purohit.workingDays) {
      try {
        const parsed = typeof purohit.workingDays === "string" ? JSON.parse(purohit.workingDays) : purohit.workingDays;
        if (Array.isArray(parsed) && parsed.length > 0) {
          workingDays = parsed;
        }
      } catch {
        workingDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
      }
    }

    if (!workingDays.includes(dayName)) {
      throw new ApiError(`The purohit is not available on ${dayName}s`, 400);
    }

    // 3. Check Working Hours Window
    const purohitStartStr = purohit.workingHoursStart || "06:00";
    const purohitEndStr = purohit.workingHoursEnd || "18:00";
    const purohitStartM = timeToMinutes(purohitStartStr);
    const purohitEndM = timeToMinutes(purohitEndStr);
    if (startMinutes < purohitStartM || endMinutes > purohitEndM) {
      throw new ApiError(
        `Ceremony window (${data.startTime} - ${calculatedEndTime}) must be within purohit working hours (${purohitStartStr} - ${purohitEndStr})`,
        400
      );
    }

    // 4. Check Daily Break Window
    if (purohit.breakStart && purohit.breakEnd) {
      if (intervalsOverlap(data.startTime, calculatedEndTime, purohit.breakStart, purohit.breakEnd)) {
        throw new ApiError(
          `The selected time slot overlaps with the purohit's customary break period (${purohit.breakStart} - ${purohit.breakEnd}). Please select a different slot.`,
          409
        );
      }
    }

    // 5. Check Blocked Dates & Blocked Periods
    for (const block of purohit.blockedPeriods) {
      if (block.isAllDay || (!block.startTime && !block.endTime)) {
        throw new ApiError(`The purohit is unavailable on ${data.bookingDate}: ${block.reason || "Blocked"}`, 409);
      }
      if (block.startTime && block.endTime) {
        if (intervalsOverlap(data.startTime, calculatedEndTime, block.startTime, block.endTime)) {
          throw new ApiError(
            `The requested time slot is blocked: ${block.reason || "Purohit unavailable during this time"}. Please choose another slot.`,
            409
          );
        }
      }
    }

    // 6. CRITICAL CONCURRENCY CHECK: Overlapping Active Bookings
    const existingActiveBookings = await tx.ceremonyBooking.findMany({
      where: {
        purohitId: data.purohitId,
        bookingDate: data.bookingDate,
        status: { in: ["PENDING", "CONFIRMED", "RESCHEDULE_REQUESTED"] },
      },
      select: {
        id: true,
        bookingReference: true,
        startTime: true,
        endTime: true,
        ceremonyType: true,
      },
    });

    for (const existing of existingActiveBookings) {
      if (intervalsOverlap(data.startTime, calculatedEndTime, existing.startTime, existing.endTime)) {
        throw new ApiError(
          `Scheduling conflict: The slot ${data.startTime} - ${calculatedEndTime} was just booked by another visitor (${existing.ceremonyType}). Please select a different available slot.`,
          409
        );
      }
    }

    // 7. Determine fee
    const resolvedFee = (data.serviceFee != null) ? data.serviceFee : (purohit.baseFee ?? 0);

    const resolvedVisitorName = (data.visitorName || ctx?.user?.name || "Devotee Visitor").trim();
    const resolvedVisitorPhone = (data.visitorPhone || ctx?.user?.phone || "+919999999999").trim();
    const resolvedVisitorEmail = (data.visitorEmail || ctx?.user?.email || null)?.trim().toLowerCase() || null;
    const resolvedParticipants = data.participantsCount || data.participantCount || 1;
    const resolvedLocationAddress = (data.locationAddress || data.ceremonyLocation || "Kotilingala Ghat, Rajahmundry").trim();
    const additionalRequirements = [
      data.customaryRequirements,
      data.visitorNotes ? `Notes: ${data.visitorNotes}` : null,
      data.gotra ? `Gotra: ${data.gotra}` : null,
      data.deceasedRelationship ? `Ritual for: ${data.deceasedRelationship}` : null,
    ].filter(Boolean).join(" | ") || null;

    // 8. Create CeremonyBooking
    const createdBooking = await tx.ceremonyBooking.create({
      data: {
        bookingReference: reference,
        purohitId: data.purohitId,
        visitorId: ctx.user.id,
        visitorName: resolvedVisitorName,
        visitorPhone: resolvedVisitorPhone,
        visitorEmail: resolvedVisitorEmail,
        ceremonyType: data.ceremonyType.trim(),
        bookingDate: data.bookingDate,
        startTime: data.startTime,
        endTime: calculatedEndTime,
        durationMinutes: data.durationMinutes,
        participantsCount: resolvedParticipants,
        locationType: data.locationType,
        locationAddress: resolvedLocationAddress,
        customaryRequirements: additionalRequirements,
        serviceFee: resolvedFee,
        currency: "INR",
        feeIncludes: purohit.feeIncludes || "Complete ceremony sankalpam, customary rituals and samagri guidance",
        status: "CONFIRMED", // auto-confirm slot upon successful booking
        confirmedAt: new Date(),
      },
      include: {
        purohit: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            phone: true,
            email: true,
            serviceArea: true,
          },
        },
      },
    });

    // 9. Record initial status history
    await tx.ceremonyBookingStatusHistory.create({
      data: {
        bookingId: createdBooking.id,
        fromStatus: "NONE",
        toStatus: "CONFIRMED",
        changedById: ctx?.user?.id || null,
        changedByName: ctx?.user?.name || data.visitorName,
        reason: `Initial booking confirmed for ${data.ceremonyType} on ${data.bookingDate} (${data.startTime} - ${calculatedEndTime})`,
      },
    });

    return createdBooking;
  });

  // Audit log
  await audit({
    actorId: ctx?.user?.id,
    action: "CEREMONY_BOOKING_CREATE",
    targetType: "CEREMONY_BOOKING",
    targetId: booking.id,
    details: {
      bookingReference: booking.bookingReference,
      purohitId: booking.purohitId,
      ceremonyType: booking.ceremonyType,
      date: booking.bookingDate,
      time: `${booking.startTime} - ${booking.endTime}`,
    },
    ip: getClientIp(req),
  });

  // Notify Purohit
  const bookingWithPurohit = booking as any;
  if (bookingWithPurohit?.purohit?.userId) {
    await notify({
      userId: bookingWithPurohit.purohit.userId,
      type: "CEREMONY_BOOKING_NEW",
      title: `New Ceremony Booking (${booking.bookingReference})`,
      message: `${booking.visitorName} booked ${booking.ceremonyType} for ${booking.bookingDate} from ${booking.startTime} to ${booking.endTime} at ${booking.locationAddress}. Contact: ${booking.visitorPhone}.`,
      link: "/admin",
    });
  }

  // Notify Visitor
  if (ctx?.user?.id) {
    const purohitDisplayName = bookingWithPurohit?.purohit?.fullName || "Vedic Purohit";
    await notify({
      userId: ctx.user.id,
      type: "CEREMONY_BOOKING_CONFIRMED",
      title: `Ceremony Booking Confirmed (${booking.bookingReference})`,
      message: `Your sacred ceremony (${booking.ceremonyType}) with Purohit ${purohitDisplayName} is scheduled for ${booking.bookingDate} at ${booking.startTime} (${booking.locationAddress}).`,
      link: "/bookings",
    });

    // Automated Email Dispatch (Booking Successful + Reminders)
    const visitorEmail = booking.visitorEmail || ctx.user.email;
    if (visitorEmail) {
      await queueEmailNotification({
        eventType: "BOOKING_SUCCESSFUL",
        userId: ctx.user.id,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        bookingCategory: "CEREMONY",
        recipientEmail: visitorEmail,
        recipientName: booking.visitorName,
        payload: {
          customerName: booking.visitorName,
          bookingReference: booking.bookingReference,
          category: "CEREMONY",
          serviceName: `${booking.ceremonyType} (Purohit: ${purohitDisplayName})`,
          bookingDate: booking.bookingDate,
          bookingTime: `${booking.startTime} - ${booking.endTime}`,
          locationAddress: booking.locationAddress,
          participantsOrRooms: `${booking.participantsCount} Participant(s)`,
          status: booking.status,
          amount: booking.serviceFee,
          currency: booking.currency || "INR",
        },
        idempotencyKey: `BOOKING_SUCCESSFUL_CEREMONY_${booking.id}`,
      }).catch(() => {});

      await scheduleBookingReminders({
        id: booking.id,
        bookingReference: booking.bookingReference,
        category: "CEREMONY",
        serviceName: `${booking.ceremonyType} with ${purohitDisplayName}`,
        customerName: booking.visitorName,
        recipientEmail: visitorEmail,
        userId: ctx.user.id,
        bookingDate: booking.bookingDate,
        bookingTime: booking.startTime,
        locationAddress: booking.locationAddress,
      }).catch(() => {});
    }
  }

  return created({
    ok: true,
    booking,
    bookingReference: booking.bookingReference,
    message: `Ceremony booking confirmed! Reference: ${booking.bookingReference}`,
  });
});
