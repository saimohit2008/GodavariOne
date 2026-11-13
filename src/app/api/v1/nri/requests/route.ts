import { NextRequest } from "next/server";
import { db, isPostgresDatabase } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import {
  generateReferenceNumber,
  getEligibleBusinessOwners,
  recordNriStatusChange,
  sendNriWorkflowNotification,
} from "@/lib/nri";
import { NRI_MIN_GROUP_SIZE, NRI_MAX_GROUP_SIZE } from "@/lib/nri-constants";
import { queueEmailNotification } from "@/lib/email-service";

const createRequestSchema = z.object({
  groupSize: z.number().int().min(NRI_MIN_GROUP_SIZE, `Minimum ${NRI_MIN_GROUP_SIZE} people required`).max(NRI_MAX_GROUP_SIZE, `Maximum ${NRI_MAX_GROUP_SIZE} people allowed`),
  numAdults: z.number().int().min(1, "At least 1 adult required"),
  numChildren: z.number().int().min(0, "Children count cannot be negative").default(0),
  arrivalDate: z.string().min(8, "Arrival date is required"),
  departureDate: z.string().min(8, "Departure date is required"),
  arrivalLocation: z.string().min(2, "Arrival location is required"),
  departureLocation: z.string().min(2, "Departure location is required"),
  accommodationPreference: z.string().min(2, "Accommodation preference is required"),
  numRooms: z.number().int().min(1).default(1),
  dietaryPreference: z.string().min(2, "Dietary preference is required"),
  specialRequests: z.string().optional().nullable(),
  preferredItinerary: z.string().optional().nullable(),
  budgetRange: z.string().optional().nullable(),
  currency: z.string().default("INR"),
  visitorName: z.string().min(2, "Visitor name is required"),
  visitorEmail: z.string().email("Valid email is required"),
  visitorPhone: z.string().min(7, "Valid contact number is required"),
  countryOfResidence: z.string().min(2, "Country of residence is required"),
  targetProviderId: z.string().optional().nullable(),
  // Enhanced Trip & Visitor Details (Prompt 1.2)
  preferredCommunication: z.string().default("WHATSAPP"),
  accessibilityRequirements: z.string().optional().nullable(),
  daysCount: z.number().int().min(1).optional().nullable(),
  nightsCount: z.number().int().min(0).optional().nullable(),
  placesToVisit: z.string().optional().nullable(),
  preferredGhats: z.string().optional().nullable(),
  preferredTemples: z.string().optional().nullable(),
  preferredRoomType: z.string().optional().nullable(),
  transportRequirements: z.string().optional().nullable(),
  localGuideRequired: z.boolean().optional().default(false),
  guideLanguage: z.string().optional().nullable(),
  ceremonyRequirements: z.string().optional().nullable(),
  packageTypePreference: z.string().optional().nullable(),
  additionalInstructions: z.string().optional().nullable(),
});

// GET /api/v1/nri/requests
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const referenceNumber = searchParams.get("referenceNumber") || undefined;
  const managerId = searchParams.get("managerId") || undefined;
  const archived = searchParams.get("archived"); // "true", "only", "all"
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

  // Public reference lookup (for visitors checking via reference number without logging in)
  if (!ctx && referenceNumber) {
    const singleQueryOptions: any = {
      where: { referenceNumber },
      include: {
        assignedManager: { select: { id: true, name: true, phone: true, email: true } },
        quotations: {
          where: { status: { in: ["SENT", "REVISION_REQUESTED", "ACCEPTED", "CONFIRMED"] } },
          include: {
            provider: { select: { id: true, name: true, phone: true, email: true } },
            lineItems: true,
          },
        },
        assignments: {
          include: {
            provider: { select: { id: true, name: true, phone: true } },
          },
        },
        tripItineraryItems: { orderBy: { dayNumber: "asc" } },
        tripTasks: { orderBy: { createdAt: "asc" } },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    };
    const item = await db.nriPackageRequest.findUnique(singleQueryOptions);
    if (!item) return fail("Request not found", 404);
    return ok({ item });
  }

  if (!ctx) return fail("Authentication required", 401);

  const where: Record<string, unknown> = {};
  if (status === "ARCHIVED" || archived === "true" || archived === "only") {
    where.status = "ARCHIVED";
  } else if (archived === "all" || archived === "include") {
    if (status && status !== "ALL") {
      where.status = status;
    }
  } else {
    // Default: active non-archived requests
    if (status && status !== "ALL") {
      where.status = status;
    } else {
      where.status = { not: "ARCHIVED" };
    }
  }

  if (referenceNumber) {
    where.referenceNumber = referenceNumber;
  }

  // Scoping based on role
  if (ctx.user.role === "VISITOR") {
    where.OR = [
      { visitorId: ctx.user.id },
      { visitorEmail: ctx.user.email || "__never__" },
      { visitorPhone: ctx.user.phone },
    ];
    if (!where.status) {
      where.status = { not: "ARCHIVED" };
    }
  } else if (ctx.user.role === "BUSINESS_OWNER") {
    where.assignments = {
      some: {
        providerId: ctx.user.id,
      },
    };
    where.status = { not: "ARCHIVED" };
  } else if (ctx.user.role === "NRI_SERVICE_MANAGER") {
    // NRI Service Manager sees assigned requests
    where.assignedManagerId = ctx.user.id;
  } else if (ctx.user.role === "SUPER_ADMIN") {
    if (managerId) {
      where.assignedManagerId = managerId;
    }
  } else {
    return fail("Insufficient permissions to view NRI package requests", 403);
  }

  const listQueryOptions: any = {
    where,
    include: {
      visitor: { select: { id: true, name: true, phone: true, email: true } },
      assignedManager: { select: { id: true, name: true, phone: true, email: true } },
      assignments: {
        include: {
          provider: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
      quotations: {
        where: ctx.user.role === "BUSINESS_OWNER" ? { providerId: ctx.user.id } : undefined,
        include: {
          provider: { select: { id: true, name: true, phone: true } },
          lineItems: true,
        },
        orderBy: { createdAt: "desc" },
      },
      tripItineraryItems: { orderBy: { dayNumber: "asc" } },
      tripTasks: { orderBy: { createdAt: "asc" } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  };
  const items = await db.nriPackageRequest.findMany(listQueryOptions);

  return ok({ items, count: items.length });
});

// POST /api/v1/nri/requests
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required to submit NRI custom package request", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Validation failed", 422, parsed.error.issues);
  }

  const data = parsed.data;

  // Strict group size validation
  if (data.groupSize < NRI_MIN_GROUP_SIZE || data.groupSize > NRI_MAX_GROUP_SIZE) {
    return fail(`Group size must be between ${NRI_MIN_GROUP_SIZE} and ${NRI_MAX_GROUP_SIZE} people`, 422);
  }

  if (data.numAdults + data.numChildren !== data.groupSize) {
    return fail("Sum of adults and children must equal the total group size", 422);
  }

  // Date validation
  if (data.departureDate < data.arrivalDate) {
    return fail("Departure date cannot be earlier than arrival date", 422);
  }

  const referenceNumber = generateReferenceNumber();

  // 72 hour response SLA deadline
  const responseDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);

  // Check if an active NRI Service Manager is available for assignment
  const activeManager = await db.user.findFirst({
    where: { role: "NRI_SERVICE_MANAGER", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  const assignedManagerId = activeManager ? activeManager.id : null;

  // Find eligible business owners based on routing rules
  const eligibleOwners = await getEligibleBusinessOwners(data.targetProviderId);

  const initialStatus = (assignedManagerId || eligibleOwners.length > 0) ? "ASSIGNED" : "SUBMITTED";

  const request = await db.nriPackageRequest.create({
    data: {
      referenceNumber,
      visitorId: ctx.user.id,
      visitorName: data.visitorName.trim(),
      visitorEmail: data.visitorEmail.trim().toLowerCase(),
      visitorPhone: data.visitorPhone.trim(),
      countryOfResidence: data.countryOfResidence.trim(),
      groupSize: data.groupSize,
      numAdults: data.numAdults,
      numChildren: data.numChildren,
      arrivalDate: data.arrivalDate,
      departureDate: data.departureDate,
      arrivalLocation: data.arrivalLocation.trim(),
      departureLocation: data.departureLocation.trim(),
      accommodationPreference: data.accommodationPreference.trim(),
      numRooms: data.numRooms || 1,
      dietaryPreference: data.dietaryPreference.trim(),
      specialRequests: data.specialRequests?.trim() || null,
      preferredItinerary: data.preferredItinerary?.trim() || null,
      budgetRange: data.budgetRange?.trim() || null,
      currency: data.currency || "INR",
      targetProviderId: data.targetProviderId || null,
      preferredCommunication: data.preferredCommunication || "WHATSAPP",
      accessibilityRequirements: data.accessibilityRequirements?.trim() || null,
      daysCount: data.daysCount || null,
      nightsCount: data.nightsCount || null,
      placesToVisit: data.placesToVisit?.trim() || null,
      preferredGhats: data.preferredGhats?.trim() || null,
      preferredTemples: data.preferredTemples?.trim() || null,
      preferredRoomType: data.preferredRoomType?.trim() || null,
      transportRequirements: data.transportRequirements?.trim() || null,
      localGuideRequired: !!data.localGuideRequired,
      guideLanguage: data.guideLanguage?.trim() || null,
      ceremonyRequirements: data.ceremonyRequirements?.trim() || null,
      packageTypePreference: data.packageTypePreference?.trim() || null,
      additionalInstructions: data.additionalInstructions?.trim() || null,
      assignedManagerId,
      status: initialStatus,
      responseDeadline,
      assignments: {
        create: eligibleOwners.map((owner) => ({
          providerId: owner.id,
          status: "ASSIGNED",
        })),
      },
    },
    include: {
      assignedManager: { select: { id: true, name: true, phone: true, email: true } },
      assignments: {
        include: {
          provider: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });

  // Record initial status
  await recordNriStatusChange({
    requestId: request.id,
    fromStatus: "NONE",
    toStatus: initialStatus,
    changedById: ctx.user.id,
    changedByName: ctx.user.name || data.visitorName,
    reason: eligibleOwners.length > 0 ? `Auto-assigned to ${eligibleOwners.length} verified business owner(s)` : "Saved with no active provider available; awaiting admin review",
    ip: getClientIp(req),
  });

  // Notify assigned business owners
  for (const owner of eligibleOwners) {
    await sendNriWorkflowNotification({
      userId: owner.id,
      recipientEmail: owner.email,
      recipientName: owner.name,
      type: "NRI_REQUEST_ASSIGNED",
      title: "New NRI Package Quotation Request",
      message: `A new custom package request (${referenceNumber}) has arrived for ${data.groupSize} travelers from ${data.countryOfResidence} arriving on ${data.arrivalDate}. Please prepare a quotation.`,
      link: "/owner-dashboard",
    });
  }

  // Notify visitor of successful submission
  await sendNriWorkflowNotification({
    userId: ctx?.user?.id,
    recipientEmail: data.visitorEmail,
    recipientName: data.visitorName,
    type: "NRI_REQUEST_SUBMITTED",
    title: `Quotation Request Received (${referenceNumber})`,
    message: eligibleOwners.length > 0
      ? `Your custom package request for ${data.groupSize} travelers (${data.arrivalDate} to ${data.departureDate}) has been assigned to verified regional hospitality partners. You will receive customized quotations shortly.`
      : "Your custom quotation request has been securely recorded. Our team is coordinating with verified regional partners and you will be notified as soon as a customized quotation is prepared.",
    link: `/nri-access?ref=${referenceNumber}`,
  });

  // Automated Email Notification (Godavari One Branded)
  queueEmailNotification({
    eventType: "BOOKING_SUCCESSFUL",
    userId: ctx?.user?.id,
    bookingId: request.id,
    bookingReference: referenceNumber,
    bookingCategory: "NRI custom packages",
    recipientEmail: data.visitorEmail,
    recipientName: data.visitorName,
    language: (ctx?.user as any)?.language || "en",
    payload: {
      eventType: "BOOKING_SUCCESSFUL",
      customerName: data.visitorName,
      bookingReference: referenceNumber,
      bookingCategory: "NRI custom packages",
      serviceName: `NRI Custom Pilgrimage Package (${data.groupSize} Travelers from ${data.countryOfResidence})`,
      bookingDate: `${data.arrivalDate} to ${data.departureDate}`,
      bookingTime: "Full Pilgrimage Tour",
      location: "Rajahmundry & Godavari Region",
      guestsOrParticipants: `${data.numAdults} Adult(s), ${data.numChildren} Child(ren) · ${data.numRooms || 1} Room(s)`,
      bookingStatus: initialStatus,
      cancellationInstructions: "You may manage or cancel your quotation request through the NRI Portal with your reference number.",
      myBookingsUrl: `/nri-access?ref=${referenceNumber}`,
      supportContact: "support@godavari-one.org",
    },
  }).catch((err) => console.error("[NRI] Failed to queue email notification:", err));

  return created({
    ok: true,
    request,
    referenceNumber,
    assignedProvidersCount: eligibleOwners.length,
    eligibleProviderFound: eligibleOwners.length > 0,
    message: eligibleOwners.length > 0
      ? `Request ${referenceNumber} submitted and routed to ${eligibleOwners.length} verified service partner(s).`
      : "Request submitted successfully. Verified partner allocation is in progress.",
  });
});
