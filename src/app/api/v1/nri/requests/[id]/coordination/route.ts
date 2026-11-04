import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";
import { z } from "zod";

const createItinerarySchema = z.object({
  dayNumber: z.number().int().min(1),
  date: z.string().min(8),
  timeSlot: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  activityTitle: z.string().min(2, "Activity title is required").optional(),
  title: z.string().min(2).optional(),
  location: z.string().optional().nullable(),
  locationName: z.string().optional().nullable(),
  accommodationDetails: z.string().optional().nullable(),
  transportDetails: z.string().optional().nullable(),
  assignedProvider: z.string().optional().nullable(),
  serviceProvider: z.string().optional().nullable(),
  bookingConfirmationCode: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  internalStaffNotes: z.string().optional().nullable(),
  visitorNotes: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "RESCHEDULED", "CANCELLED"]).default("SCHEDULED"),
}).refine(d => Boolean(d.activityTitle || d.title), {
  message: "Activity title is required",
  path: ["activityTitle"],
});

// GET /api/v1/nri/requests/[id]/coordination — get trip itinerary and tasks
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: {
      assignedManager: { select: { id: true, name: true, phone: true, email: true } },
      visitor: { select: { id: true, name: true, phone: true, email: true } },
      tripItineraryItems: { orderBy: [{ dayNumber: "asc" }, { timeSlot: "asc" }] },
      tripTasks: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;
  const isVisitor = ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone;

  if (!isSuperAdmin && !isManager && !isVisitor) {
    return fail("Unauthorized to view coordination for this trip", 403);
  }

  // Sanitize internal notes for visitor
  const itinerary = isVisitor
    ? request.tripItineraryItems.map(item => ({ ...item, internalNotes: null }))
    : request.tripItineraryItems;

  const tasks = isVisitor
    ? request.tripTasks.map(task => ({ ...task, internalNotes: null }))
    : request.tripTasks;

  return ok({
    request: {
      id: request.id,
      referenceNumber: request.referenceNumber,
      status: request.status,
      arrivalDate: request.arrivalDate,
      departureDate: request.departureDate,
      groupSize: request.groupSize,
      assignedManager: request.assignedManager,
      visitor: request.visitor,
    },
    itinerary,
    tasks,
  });
});

// POST /api/v1/nri/requests/[id]/coordination — add an itinerary item (Manager or Super Admin only)
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
  });
  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isManager) {
    return fail("Only assigned NRI Service Manager or Super Admin can manage trip itinerary", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = createItinerarySchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const resolvedTitle = (parsed.data.activityTitle || parsed.data.title)!;
  const resolvedTimeSlot =
    parsed.data.timeSlot ||
    (parsed.data.startTime && parsed.data.endTime
      ? `${parsed.data.startTime} - ${parsed.data.endTime}`
      : parsed.data.startTime || null);
  const resolvedLocation = parsed.data.location || parsed.data.locationName || null;
  const resolvedProvider = parsed.data.assignedProvider || parsed.data.serviceProvider || null;
  const resolvedInternalNotes = parsed.data.internalNotes || parsed.data.internalStaffNotes || null;
  const resolvedVisitorNotes = parsed.data.visitorNotes || parsed.data.description || null;

  const item = await db.nriTripItineraryItem.create({
    data: {
      requestId: id,
      dayNumber: parsed.data.dayNumber,
      date: parsed.data.date,
      timeSlot: resolvedTimeSlot,
      activityTitle: resolvedTitle,
      location: resolvedLocation,
      accommodationDetails: parsed.data.accommodationDetails || null,
      transportDetails: parsed.data.transportDetails || null,
      assignedProvider: resolvedProvider,
      bookingConfirmationCode: parsed.data.bookingConfirmationCode || null,
      instructions: parsed.data.instructions || null,
      internalNotes: resolvedInternalNotes,
      visitorNotes: resolvedVisitorNotes,
      status: parsed.data.status,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_ITINERARY_ITEM_CREATE",
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: id,
    details: { dayNumber: item.dayNumber, activityTitle: item.activityTitle },
    ip: getClientIp(req),
  });

  // Notify visitor of itinerary schedule update
  await sendNriWorkflowNotification({
    userId: request.visitorId,
    recipientEmail: request.visitorEmail,
    recipientName: request.visitorName,
    type: "NRI_ITINERARY_UPDATED",
    title: `Trip Itinerary Update (${request.referenceNumber})`,
    message: `A new itinerary item "Day ${item.dayNumber}: ${item.activityTitle}" has been scheduled for your pushkaralu pilgrimage.`,
    link: `/nri-access?ref=${request.referenceNumber}`,
  });

  return created({ item });
});
