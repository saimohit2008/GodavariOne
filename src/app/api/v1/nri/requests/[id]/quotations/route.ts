import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import {
  generateQuotationNumber,
  calculateServerPricing,
  recordNriStatusChange,
  sendNriWorkflowNotification,
} from "@/lib/nri";

const lineItemSchema = z.object({
  category: z.enum(["ACCOMMODATION", "TRANSPORT", "MEALS", "SIGHTSEEING_GUIDE", "TAX_FEES", "DISCOUNT", "OTHER"]),
  description: z.string().min(2, "Description required"),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0, "Unit price must be >= 0"),
  totalPrice: z.number().min(0).optional(),
  isOptional: z.boolean().default(false),
});

const quotationInputSchema = z.object({
  title: z.string().min(3, "Package title required"),
  description: z.string().optional().nullable(),
  durationDays: z.number().int().min(1, "Duration must be at least 1 day"),
  checkInDate: z.string().min(8, "Check-in date required"),
  checkOutDate: z.string().min(8, "Check-out date required"),
  itinerary: z.union([z.string(), z.array(z.any())]),
  pickupDropDetails: z.string().optional().nullable(),
  vehicleType: z.string().optional().nullable(),
  vehicleCapacity: z.number().int().min(1).optional().nullable(),
  hotelName: z.string().optional().nullable(),
  roomType: z.string().optional().nullable(),
  numberOfRooms: z.number().int().min(1).default(1),
  accommodationDetails: z.string().optional().nullable(),
  mealPlan: z.string().optional().nullable(),
  guideServices: z.string().optional().nullable(),
  inclusions: z.union([z.string(), z.array(z.string())]),
  exclusions: z.union([z.string(), z.array(z.string())]),
  termsAndConditions: z.string().optional().nullable(),
  cancellationPolicy: z.string().optional().nullable(),
  accommodationCost: z.number().min(0).default(0),
  transportCost: z.number().min(0).default(0),
  foodCost: z.number().min(0).default(0),
  guideCost: z.number().min(0).default(0),
  ceremonyCost: z.number().min(0).default(0),
  otherCharges: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  additionalFeesExplanation: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  managerNotes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  manuallyAgreedTotal: z.number().optional().nullable(),
  pricingNotes: z.string().optional().nullable(),
  pricingExplanation: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).default([]),
  status: z.enum(["DRAFT", "SENT"]).default("SENT"),
});

// GET /api/v1/nri/requests/[id]/quotations
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: { assignments: true },
  });

  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isVisitor = ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone;
  const isAssigned = request.assignments.some((a) => a.providerId === ctx.user.id);
  const isAssignedManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isVisitor && !isAssigned && !isAssignedManager) {
    return fail("Unauthorized to view quotations for this request", 403);
  }

  const where: Record<string, unknown> = { requestId: id };
  if (isVisitor) {
    where.status = { in: ["SENT", "REVISION_REQUESTED", "ACCEPTED", "CONFIRMED"] };
  } else if (!isSuperAdmin && !isAssignedManager && isAssigned) {
    where.providerId = ctx.user.id;
  }

  const quotations = await db.nriQuotation.findMany({
    where,
    include: {
      provider: { select: { id: true, name: true, phone: true, email: true } },
      lineItems: true,
      versions: { orderBy: { version: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  const sanitized = isVisitor
    ? quotations.map(q => ({ ...q, internalNotes: null }))
    : quotations;

  return ok({ quotations: sanitized });
});

// POST /api/v1/nri/requests/[id]/quotations
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: { assignments: true },
  });

  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isAssigned = request.assignments.some((a) => a.providerId === ctx.user.id && a.status !== "DECLINED");
  const isAssignedManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isAssigned && !isAssignedManager) {
    return fail("Only assigned NRI Service Managers or Business Owners can submit quotations for this request", 403);
  }

  if (request.status === "CANCELLED" || request.status === "CLOSED") {
    return fail(`Cannot submit quotation for a ${request.status.toLowerCase()} request`, 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = quotationInputSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Validation failed", 422, parsed.error.issues);
  }

  const data = parsed.data;

  // Server-side calculated pricing
  const pricing = calculateServerPricing({
    groupSize: request.groupSize,
    lineItems: data.lineItems,
    accommodationCost: data.accommodationCost,
    transportCost: data.transportCost,
    foodCost: data.foodCost,
    guideCost: data.guideCost,
    otherCharges: data.otherCharges + (data.ceremonyCost || 0),
    taxAmount: data.taxAmount,
    discountAmount: data.discountAmount,
    manuallyAgreedTotal: data.manuallyAgreedTotal ?? undefined,
    pricingExplanation: data.pricingExplanation || data.pricingNotes || undefined,
  });

  const quotationNumber = generateQuotationNumber();
  const itineraryJson = typeof data.itinerary === "string" ? data.itinerary : JSON.stringify(data.itinerary);
  const inclusionsJson = typeof data.inclusions === "string" ? data.inclusions : JSON.stringify(data.inclusions);
  const exclusionsJson = typeof data.exclusions === "string" ? data.exclusions : JSON.stringify(data.exclusions);

  const quotation = await db.nriQuotation.create({
    data: {
      quotationNumber,
      requestId: id,
      providerId: ctx.user.id,
      version: 1,
      status: data.status,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      durationDays: data.durationDays,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      itinerary: itineraryJson,
      pickupDropDetails: data.pickupDropDetails?.trim() || null,
      vehicleType: data.vehicleType?.trim() || null,
      vehicleCapacity: data.vehicleCapacity || null,
      hotelName: data.hotelName?.trim() || null,
      roomType: data.roomType?.trim() || null,
      numberOfRooms: data.numberOfRooms || 1,
      accommodationDetails: data.accommodationDetails?.trim() || null,
      mealPlan: data.mealPlan?.trim() || null,
      guideServices: data.guideServices?.trim() || null,
      inclusions: inclusionsJson,
      exclusions: exclusionsJson,
      termsAndConditions: data.termsAndConditions?.trim() || null,
      cancellationPolicy: data.cancellationPolicy?.trim() || null,
      accommodationCost: data.accommodationCost,
      transportCost: data.transportCost,
      foodCost: data.foodCost,
      guideCost: data.guideCost,
      ceremonyCost: data.ceremonyCost,
      otherCharges: data.otherCharges,
      taxAmount: pricing.taxAmount,
      discountAmount: pricing.discountAmount,
      additionalFeesExplanation: data.additionalFeesExplanation?.trim() || null,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      managerNotes: data.managerNotes?.trim() || null,
      internalNotes: data.internalNotes?.trim() || null,
      totalPrice: pricing.totalPrice,
      pricePerPerson: pricing.pricePerPerson,
      currency: request.currency || "INR",
      pricingNotes: data.pricingNotes?.trim() || null,
      submittedAt: data.status === "SENT" ? new Date() : null,
      lineItems: {
        create: data.lineItems.map((item) => ({
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice !== undefined ? item.totalPrice : item.unitPrice * item.quantity,
          isOptional: Boolean(item.isOptional),
        })),
      },
    },
    include: {
      lineItems: true,
      provider: { select: { id: true, name: true, phone: true } },
    },
  });

  // Store version 1 snapshot
  await db.nriQuotationVersion.create({
    data: {
      quotationId: quotation.id,
      version: 1,
      snapshot: JSON.stringify(quotation),
      changeSummary: "Initial proposed package quotation created",
      createdById: ctx.user.id,
    },
  });

  // If quotation is sent, transition status and notify visitor
  if (data.status === "SENT") {
    await db.nriRequestAssignment.updateMany({
      where: { requestId: id, providerId: ctx.user.id },
      data: { status: "QUOTED", respondedAt: new Date() },
    });

    if (request.status === "ASSIGNED" || request.status === "IN_PROGRESS" || request.status === "SUBMITTED" || request.status === "REVISION_REQUESTED") {
      await db.nriPackageRequest.update({
        where: { id },
        data: { status: "QUOTATION_SENT" },
      });

      await recordNriStatusChange({
        requestId: id,
        fromStatus: request.status,
        toStatus: "QUOTATION_SENT",
        changedById: ctx.user.id,
        changedByName: ctx.user.name || "Business Owner",
        reason: `Quotation ${quotationNumber} sent by provider for ₹${pricing.totalPrice.toLocaleString("en-IN")}`,
        ip: getClientIp(req),
      });
    }

    // Notify visitor
    await sendNriWorkflowNotification({
      userId: request.visitorId,
      recipientEmail: request.visitorEmail,
      recipientName: request.visitorName,
      type: "NRI_QUOTATION_RECEIVED",
      title: `Complete Package Quotation Received (${quotationNumber})`,
      message: `A verified provider has prepared and sent an all-inclusive quotation "${data.title}" for ₹${pricing.totalPrice.toLocaleString("en-IN")} (₹${pricing.pricePerPerson.toLocaleString("en-IN")}/person). Review the day-by-day itinerary and breakdown.`,
      link: `/nri-access?ref=${request.referenceNumber}`,
    });
  }

  return created({
    ok: true,
    quotation,
    message: data.status === "SENT" ? "Quotation successfully sent to visitor" : "Draft quotation saved",
  });
});
