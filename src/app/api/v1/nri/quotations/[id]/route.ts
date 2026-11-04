import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import { calculateServerPricing, recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";

const updateQuotationSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  durationDays: z.number().int().min(1).optional(),
  checkInDate: z.string().min(8).optional(),
  checkOutDate: z.string().min(8).optional(),
  itinerary: z.union([z.string(), z.array(z.any())]).optional(),
  pickupDropDetails: z.string().optional().nullable(),
  vehicleType: z.string().optional().nullable(),
  vehicleCapacity: z.number().int().min(1).optional().nullable(),
  hotelName: z.string().optional().nullable(),
  roomType: z.string().optional().nullable(),
  numberOfRooms: z.number().int().min(1).optional(),
  accommodationDetails: z.string().optional().nullable(),
  mealPlan: z.string().optional().nullable(),
  guideServices: z.string().optional().nullable(),
  inclusions: z.union([z.string(), z.array(z.string())]).optional(),
  exclusions: z.union([z.string(), z.array(z.string())]).optional(),
  termsAndConditions: z.string().optional().nullable(),
  cancellationPolicy: z.string().optional().nullable(),
  accommodationCost: z.number().min(0).optional(),
  transportCost: z.number().min(0).optional(),
  foodCost: z.number().min(0).optional(),
  guideCost: z.number().min(0).optional(),
  otherCharges: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  manuallyAgreedTotal: z.number().optional().nullable(),
  pricingNotes: z.string().optional().nullable(),
  pricingExplanation: z.string().optional().nullable(),
  lineItems: z.array(z.any()).optional(),
  status: z.enum(["DRAFT", "SENT", "WITHDRAWN", "DECLINED"]).optional(),
  action: z.enum(["SAVE_DRAFT", "SEND", "WITHDRAW", "REVISE"]).optional(),
  changeSummary: z.string().optional(),
  withdrawalReason: z.string().optional(),
});

// GET /api/v1/nri/quotations/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const quotation = await db.nriQuotation.findUnique({
    where: { id },
    include: {
      lineItems: true,
      provider: { select: { id: true, name: true, phone: true, email: true } },
      request: {
        include: {
          visitor: { select: { id: true, name: true, phone: true, email: true } },
          assignments: true,
        },
      },
      versions: {
        orderBy: { version: "desc" },
      },
    },
  });

  if (!quotation) return fail("Quotation not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isOwner = quotation.providerId === ctx.user.id;
  const isVisitor = quotation.request.visitorId === ctx.user.id || quotation.request.visitorPhone === ctx.user.phone;

  if (!isSuperAdmin && !isOwner && !isVisitor) {
    return fail("Unauthorized to view this quotation", 403);
  }

  return ok({ quotation });
});

// PATCH /api/v1/nri/quotations/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const quotation = await db.nriQuotation.findUnique({
    where: { id },
    include: {
      request: true,
      lineItems: true,
    },
  });

  if (!quotation) return fail("Quotation not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isOwner = quotation.providerId === ctx.user.id;

  if (!isSuperAdmin && !isOwner) {
    return fail("Only the quotation provider can modify this quotation", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateQuotationSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const data = parsed.data;

  // Handle withdrawal
  if (data.action === "WITHDRAW" || data.status === "WITHDRAWN") {
    const reason = data.withdrawalReason || "Provider withdrew quotation";
    const updated = await db.nriQuotation.update({
      where: { id },
      data: {
        status: "WITHDRAWN",
        withdrawalReason: reason,
      },
    });

    await db.nriQuotationVersion.create({
      data: {
        quotationId: id,
        version: quotation.version + 1,
        snapshot: JSON.stringify(updated),
        changeSummary: `Quotation withdrawn: ${reason}`,
        createdById: ctx.user.id,
      },
    });

    await recordNriStatusChange({
      requestId: quotation.requestId,
      fromStatus: quotation.request.status,
      toStatus: quotation.request.status,
      changedById: ctx.user.id,
      changedByName: ctx.user.name || "Business Owner",
      reason: `Quotation ${quotation.quotationNumber} withdrawn by provider: ${reason}`,
      ip: getClientIp(req),
    });

    await sendNriWorkflowNotification({
      userId: quotation.request.visitorId,
      recipientEmail: quotation.request.visitorEmail,
      recipientName: quotation.request.visitorName,
      type: "NRI_QUOTATION_WITHDRAWN",
      title: `Quotation Withdrawn (${quotation.quotationNumber})`,
      message: `The provider has withdrawn quotation ${quotation.quotationNumber} (${reason}). Other providers can still submit proposals.`,
      link: `/nri-access?ref=${quotation.request.referenceNumber}`,
    });

    return ok({ ok: true, quotation: updated, message: "Quotation withdrawn successfully" });
  }

  // Calculate updated pricing
  const newItems = data.lineItems ?? quotation.lineItems;
  const pricing = calculateServerPricing({
    groupSize: quotation.request.groupSize,
    lineItems: newItems,
    accommodationCost: data.accommodationCost ?? quotation.accommodationCost,
    transportCost: data.transportCost ?? quotation.transportCost,
    foodCost: data.foodCost ?? quotation.foodCost,
    guideCost: data.guideCost ?? quotation.guideCost,
    otherCharges: data.otherCharges ?? quotation.otherCharges,
    taxAmount: data.taxAmount ?? quotation.taxAmount,
    discountAmount: data.discountAmount ?? quotation.discountAmount,
    manuallyAgreedTotal: data.manuallyAgreedTotal ?? undefined,
    pricingExplanation: data.pricingExplanation || data.pricingNotes || undefined,
  });

  const nextVersion = quotation.status === "SENT" || data.action === "REVISE" ? quotation.version + 1 : quotation.version;
  const targetStatus = data.action === "SEND" || data.status === "SENT" ? "SENT" : (data.status || quotation.status);

  // Update line items if provided
  if (data.lineItems) {
    await db.nriQuotationLineItem.deleteMany({ where: { quotationId: id } });
    await db.nriQuotationLineItem.createMany({
      data: data.lineItems.map((item: any) => ({
        quotationId: id,
        category: item.category,
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice !== undefined ? item.totalPrice : item.unitPrice * (item.quantity || 1),
        isOptional: Boolean(item.isOptional),
      })),
    });
  }

  const updated = await db.nriQuotation.update({
    where: { id },
    data: {
      version: nextVersion,
      status: targetStatus,
      title: data.title ?? quotation.title,
      description: data.description !== undefined ? data.description : quotation.description,
      durationDays: data.durationDays ?? quotation.durationDays,
      checkInDate: data.checkInDate ?? quotation.checkInDate,
      checkOutDate: data.checkOutDate ?? quotation.checkOutDate,
      itinerary: data.itinerary ? (typeof data.itinerary === "string" ? data.itinerary : JSON.stringify(data.itinerary)) : quotation.itinerary,
      pickupDropDetails: data.pickupDropDetails !== undefined ? data.pickupDropDetails : quotation.pickupDropDetails,
      vehicleType: data.vehicleType !== undefined ? data.vehicleType : quotation.vehicleType,
      vehicleCapacity: data.vehicleCapacity !== undefined ? data.vehicleCapacity : quotation.vehicleCapacity,
      hotelName: data.hotelName !== undefined ? data.hotelName : quotation.hotelName,
      roomType: data.roomType !== undefined ? data.roomType : quotation.roomType,
      numberOfRooms: data.numberOfRooms ?? quotation.numberOfRooms,
      accommodationDetails: data.accommodationDetails !== undefined ? data.accommodationDetails : quotation.accommodationDetails,
      mealPlan: data.mealPlan !== undefined ? data.mealPlan : quotation.mealPlan,
      guideServices: data.guideServices !== undefined ? data.guideServices : quotation.guideServices,
      inclusions: data.inclusions ? (typeof data.inclusions === "string" ? data.inclusions : JSON.stringify(data.inclusions)) : quotation.inclusions,
      exclusions: data.exclusions ? (typeof data.exclusions === "string" ? data.exclusions : JSON.stringify(data.exclusions)) : quotation.exclusions,
      termsAndConditions: data.termsAndConditions !== undefined ? data.termsAndConditions : quotation.termsAndConditions,
      cancellationPolicy: data.cancellationPolicy !== undefined ? data.cancellationPolicy : quotation.cancellationPolicy,
      accommodationCost: pricing.accommodationCost,
      transportCost: pricing.transportCost,
      foodCost: pricing.foodCost,
      guideCost: pricing.guideCost,
      otherCharges: pricing.otherCharges,
      taxAmount: pricing.taxAmount,
      discountAmount: pricing.discountAmount,
      totalPrice: pricing.totalPrice,
      pricePerPerson: pricing.pricePerPerson,
      pricingNotes: data.pricingNotes !== undefined ? data.pricingNotes : quotation.pricingNotes,
      submittedAt: targetStatus === "SENT" && !quotation.submittedAt ? new Date() : quotation.submittedAt,
    },
    include: {
      lineItems: true,
      provider: { select: { id: true, name: true, phone: true } },
    },
  });

  // Store version snapshot whenever updated or re-sent
  await db.nriQuotationVersion.create({
    data: {
      quotationId: id,
      version: nextVersion,
      snapshot: JSON.stringify(updated),
      changeSummary: data.changeSummary || `Version ${nextVersion} saved (${targetStatus})`,
      createdById: ctx.user.id,
    },
  });

  if (targetStatus === "SENT") {
    // Notify visitor of quotation revision
    await sendNriWorkflowNotification({
      userId: quotation.request.visitorId,
      recipientEmail: quotation.request.visitorEmail,
      recipientName: quotation.request.visitorName,
      type: "NRI_QUOTATION_REVISED",
      title: `Revised Package Quotation (${quotation.quotationNumber} v${nextVersion})`,
      message: `The provider updated package quotation "${updated.title}" with total ₹${pricing.totalPrice.toLocaleString("en-IN")}. Please review the updated itinerary and price breakdown.`,
      link: `/nri-access?ref=${quotation.request.referenceNumber}`,
    });
  }

  return ok({ ok: true, quotation: updated });
});
