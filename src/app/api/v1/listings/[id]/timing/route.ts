import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { calculateTimingStatus, normalizeSchedule } from "@/lib/timing";
import { z } from "zod";

const timingInputSchema = z.object({
  open24Hours: z.boolean().optional(),
  isTemporarilyClosed: z.boolean().optional(),
  temporaryClosureReason: z.string().max(500).optional().nullable(),
  temporaryClosureUntil: z.string().optional().nullable(),
  openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal("")),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal("")),
  operatingDays: z.array(z.string()).optional().nullable(),
  closedDays: z.array(z.string()).optional().nullable(),
  breakStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal("")),
  breakEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal("")),
  intervals: z
    .array(
      z.object({
        open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        label: z.string().max(100).optional(),
      })
    )
    .optional()
    .nullable(),
  specialHours: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        isClosed: z.boolean(),
        open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        note: z.string().max(200).optional(),
      })
    )
    .optional()
    .nullable(),
  timezone: z.string().default("Asia/Kolkata"),
});

// GET /api/v1/listings/[id]/timing — get timing schedule & calculated status
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      schedule: true,
      ghatDetails: true,
    },
  });

  if (!listing) return fail("Listing not found", 404);

  const status = calculateTimingStatus(listing.schedule);

  return ok({
    listingId: listing.id,
    listingName: listing.name,
    category: listing.category,
    schedule: listing.schedule ? {
      ...listing.schedule,
      operatingDays: listing.schedule.operatingDays ? JSON.parse(listing.schedule.operatingDays) : null,
      closedDays: listing.schedule.closedDays ? JSON.parse(listing.schedule.closedDays) : null,
      intervals: listing.schedule.intervals ? JSON.parse(listing.schedule.intervals) : null,
      specialHours: listing.schedule.specialHours ? JSON.parse(listing.schedule.specialHours) : null,
    } : null,
    status,
    lastUpdated: listing.schedule?.updatedAt || null,
  });
});

// PUT /api/v1/listings/[id]/timing — update timing schedule & temporary closures
export const PUT = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      schedule: true,
      ghatDetails: true,
    },
  });

  if (!listing) return fail("Listing not found", 404);

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSupervisor = role === "GHAT_SUPERVISOR";
  const isOwner = role === "BUSINESS_OWNER";

  // Authorization checks
  if (isSuperAdmin) {
    // Super Admin has full permission
  } else if (listing.category === "GHAT" && isSupervisor) {
    // Ghat Supervisor must be assigned to this ghat
    const [assignedRecord, isDirectSupervisor] = await Promise.all([
      db.assignment.findFirst({
        where: {
          userId: ctx.user.id,
          type: "GHAT_SUPERVISOR",
          listingId: id,
        },
      }),
      listing.ghatDetails?.supervisorId === ctx.user.id,
    ]);

    if (!assignedRecord && !isDirectSupervisor) {
      return fail("You are not authorized to update timings for this unassigned ghat", 403);
    }
  } else if (isOwner) {
    const isOwnerOfListing = listing.ownerId === ctx.user.id;
    const isAssigned = await db.assignment.findFirst({
      where: {
        userId: ctx.user.id,
        listingId: id,
      },
    });
    if (!isOwnerOfListing && !isAssigned) {
      return fail("You can only manage timings for your own listings", 403);
    }
  } else {
    return fail("Insufficient permissions to update operating hours", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = timingInputSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const data = parsed.data;
  const now = new Date();

  const operatingDaysStr = data.operatingDays ? JSON.stringify(data.operatingDays) : null;
  const closedDaysStr = data.closedDays ? JSON.stringify(data.closedDays) : null;
  const intervalsStr = data.intervals ? JSON.stringify(data.intervals) : null;
  const specialHoursStr = data.specialHours ? JSON.stringify(data.specialHours) : null;
  const closureUntil = data.temporaryClosureUntil ? new Date(data.temporaryClosureUntil) : null;

  const schedule = await db.listingSchedule.upsert({
    where: { listingId: id },
    create: {
      listingId: id,
      open24Hours: data.open24Hours ?? false,
      isTemporarilyClosed: data.isTemporarilyClosed ?? false,
      temporaryClosureReason: data.temporaryClosureReason || null,
      temporaryClosureUntil: closureUntil,
      openingTime: data.openingTime || null,
      closingTime: data.closingTime || null,
      operatingDays: operatingDaysStr,
      closedDays: closedDaysStr,
      breakStart: data.breakStart || null,
      breakEnd: data.breakEnd || null,
      intervals: intervalsStr,
      specialHours: specialHoursStr,
      timezone: data.timezone || "Asia/Kolkata",
      lastUpdatedById: ctx.user.id,
      updatedAt: now,
    },
    update: {
      open24Hours: data.open24Hours ?? false,
      isTemporarilyClosed: data.isTemporarilyClosed ?? false,
      temporaryClosureReason: data.temporaryClosureReason || null,
      temporaryClosureUntil: closureUntil,
      openingTime: data.openingTime || null,
      closingTime: data.closingTime || null,
      operatingDays: operatingDaysStr,
      closedDays: closedDaysStr,
      breakStart: data.breakStart || null,
      breakEnd: data.breakEnd || null,
      intervals: intervalsStr,
      specialHours: specialHoursStr,
      timezone: data.timezone || "Asia/Kolkata",
      lastUpdatedById: ctx.user.id,
      updatedAt: now,
    },
  });

  const status = calculateTimingStatus(schedule);

  // Record audit log
  await audit({
    actorId: ctx.user.id,
    action: "LISTING_TIMING_UPDATE",
    targetType: "LISTING",
    targetId: id,
    details: {
      listingName: listing.name,
      category: listing.category,
      open24Hours: schedule.open24Hours,
      isTemporarilyClosed: schedule.isTemporarilyClosed,
      temporaryClosureReason: schedule.temporaryClosureReason,
      temporaryClosureUntil: schedule.temporaryClosureUntil,
      timingStatusCode: status.code,
      updatedByRole: role,
    },
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    listingId: id,
    schedule: {
      ...schedule,
      operatingDays: data.operatingDays || null,
      closedDays: data.closedDays || null,
      intervals: data.intervals || null,
      specialHours: data.specialHours || null,
    },
    status,
    message: "Operating hours and schedule updated successfully.",
  });
});
