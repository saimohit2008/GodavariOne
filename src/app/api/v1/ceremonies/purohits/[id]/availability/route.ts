import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { computeDailySlots } from "@/lib/ceremonies";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// GET /api/v1/ceremonies/purohits/[id]/availability?date=YYYY-MM-DD&duration=60
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const durationParam = searchParams.get("duration");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail("Valid date query param (YYYY-MM-DD) is required", 400);
  }

  const purohit = await db.purohitProfile.findUnique({
    where: { id },
    include: {
      blockedPeriods: {
        where: {
          startDate: { lte: date },
          endDate: { gte: date },
        },
      },
      bookings: {
        where: {
          bookingDate: date,
          status: { in: ["PENDING", "CONFIRMED", "RESCHEDULE_REQUESTED"] },
        },
        select: {
          startTime: true,
          endTime: true,
          status: true,
        },
      },
    },
  });

  if (!purohit) return fail("Purohit not found", 404);

  // Determine day of the week in Asia/Kolkata
  const parsedDate = new Date(`${date}T00:00:00+05:30`);
  const dayName = DAYS_OF_WEEK[parsedDate.getDay()];

  let workingDays: string[] = [];
  try {
    workingDays = typeof purohit.workingDays === "string" ? JSON.parse(purohit.workingDays) : purohit.workingDays;
  } catch {
    workingDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  }

  const isWorkingDay = workingDays.includes(dayName);
  const duration = durationParam ? Math.max(15, parseInt(durationParam, 10)) : purohit.slotDurationMinutes;

  if (!isWorkingDay) {
    return ok({
      date,
      dayName,
      isWorkingDay: false,
      reason: `Purohit is not available on ${dayName}s`,
      slots: [],
      availableSlots: [],
      availableSlotsCount: 0,
    });
  }

  const slots = computeDailySlots({
    date,
    workingHoursStart: purohit.workingHoursStart,
    workingHoursEnd: purohit.workingHoursEnd,
    breakStart: purohit.breakStart,
    breakEnd: purohit.breakEnd,
    slotDurationMinutes: duration,
    blockedPeriods: purohit.blockedPeriods,
    existingBookings: purohit.bookings,
  });

  return ok({
    date,
    dayName,
    isWorkingDay: true,
    workingHours: {
      start: purohit.workingHoursStart,
      end: purohit.workingHoursEnd,
      breakStart: purohit.breakStart,
      breakEnd: purohit.breakEnd,
    },
    durationMinutes: duration,
    slots,
    availableSlots: slots,
    availableSlotsCount: slots.filter((s) => s.isAvailable).length,
  });
});

const blockSlotSchema = z.object({
  startDate: z.string().min(8, "Start date required"),
  endDate: z.string().min(8, "End date required"),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  isAllDay: z.boolean().default(false),
  reason: z.string().optional().nullable(),
});

// POST /api/v1/ceremonies/purohits/[id]/availability — Block time periods or dates (Purohit self or Super Admin)
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const purohit = await db.purohitProfile.findUnique({ where: { id } });
  if (!purohit) return fail("Purohit not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isOwner = ctx.user.id === purohit.userId;

  if (!isSuperAdmin && !isOwner) {
    return fail("Unauthorized to modify schedule for this purohit", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = blockSlotSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const data = parsed.data;

  if (data.endDate < data.startDate) {
    return fail("End date cannot be earlier than start date", 422);
  }

  const blocked = await db.purohitBlockedSlot.create({
    data: {
      purohitId: id,
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      isAllDay: data.isAllDay,
      reason: data.reason?.trim() || "Purohit unavailable",
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "PUROHIT_SLOT_BLOCKED",
    targetType: "PUROHIT_PROFILE",
    targetId: id,
    details: { startDate: data.startDate, endDate: data.endDate, reason: data.reason },
    ip: getClientIp(req),
  });

  return created({ blockedSlot: blocked });
});
