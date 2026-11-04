import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";
import { queueEmailNotification, scheduleBookingReminders } from "@/lib/email-service";

const confirmSchema = z.object({
  hotelConfirmationDetails: z.string().min(3, "Hotel room verification details required"),
  vehicleDetails: z.string().min(3, "Vehicle and driver assignment details required"),
  guideCoordinatorDetails: z.string().optional(),
  mealArrangementDetails: z.string().optional(),
  confirmationNotes: z.string().optional(),
});

// POST /api/v1/nri/quotations/[id]/confirm
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const quotation = await db.nriQuotation.findUnique({
    where: { id },
    include: {
      request: true,
      provider: true,
    },
  });

  if (!quotation) return fail("Quotation not found", 404);

  const request = quotation.request;

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isOwner = quotation.providerId === ctx.user.id;

  if (!isSuperAdmin && !isOwner) {
    return fail("Only the assigned Business Owner can confirm service arrangements", 403);
  }

  if (quotation.status !== "ACCEPTED") {
    return fail(`Cannot confirm quotation with status "${quotation.status}". Visitor must accept the quotation first.`, 400);
  }

  if (request.status !== "AWAITING_FINAL_CONFIRMATION" && request.status !== "QUOTATION_ACCEPTED") {
    return fail(`Request is currently "${request.status}", not awaiting final confirmation.`, 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const {
    hotelConfirmationDetails,
    vehicleDetails,
    guideCoordinatorDetails,
    mealArrangementDetails,
    confirmationNotes,
  } = parsed.data;

  const fullConfirmationLog = JSON.stringify({
    confirmedAt: new Date().toISOString(),
    confirmedBy: ctx.user.name || ctx.user.phone,
    providerPhone: quotation.provider.phone,
    hotel: hotelConfirmationDetails,
    vehicle: vehicleDetails,
    guide: guideCoordinatorDetails || "Standard pilgrimage guide assigned",
    meals: mealArrangementDetails || quotation.mealPlan || "Meals confirmed per package",
    notes: confirmationNotes || null,
  });

  // 1. Update quotation status to CONFIRMED
  const updatedQuotation = await db.nriQuotation.update({
    where: { id },
    data: {
      status: "CONFIRMED",
    },
  });

  // 2. Update request status to CONFIRMED
  const updatedRequest = await db.nriPackageRequest.update({
    where: { id: request.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmationNotes: fullConfirmationLog,
    },
  });

  // 3. Record status history & audit log
  await recordNriStatusChange({
    requestId: request.id,
    fromStatus: request.status,
    toStatus: "CONFIRMED",
    changedById: ctx.user.id,
    changedByName: ctx.user.name || "Business Owner",
    reason: `Provider confirmed all services (Hotel, Vehicle, Meals & Ghat visits). Package is 100% locked and verified.`,
    ip: getClientIp(req),
  });

  // 4. Send notification to visitor
  await sendNriWorkflowNotification({
    userId: request.visitorId,
    recipientEmail: request.visitorEmail,
    recipientName: request.visitorName,
    type: "NRI_PACKAGE_CONFIRMED",
    title: `Trip Package CONFIRMED! (${request.referenceNumber})`,
    message: `Great news! Provider ${quotation.provider.name || "Verified Partner"} has verified and locked in all arrangements (Hotel: ${hotelConfirmationDetails}, Vehicle: ${vehicleDetails}) for your Godavari Pushkaralu pilgrimage.`,
    link: `/nri-access?ref=${request.referenceNumber}`,
  });

  // Automated Email Notification (Approved / Locked)
  queueEmailNotification({
    eventType: "BOOKING_APPROVED",
    userId: request.visitorId,
    bookingId: request.id,
    bookingReference: request.referenceNumber,
    bookingCategory: "NRI custom packages",
    recipientEmail: request.visitorEmail,
    recipientName: request.visitorName,
    language: "en",
    payload: {
      eventType: "BOOKING_APPROVED",
      customerName: request.visitorName,
      bookingReference: request.referenceNumber,
      bookingCategory: "NRI custom packages",
      serviceName: `NRI Custom Package (${request.groupSize} Travelers, Arranged by ${quotation.provider.name || "Regional Partner"})`,
      approvedDate: `${request.arrivalDate} to ${request.departureDate}`,
      approvedTime: "Full Pilgrimage Tour",
      location: "Rajahmundry & Godavari Region",
      approvalStatus: "CONFIRMED",
      entryInstructions: `Hotel: ${hotelConfirmationDetails}. Vehicle: ${vehicleDetails}. Present your confirmation voucher upon arrival.`,
      supportContact: quotation.provider.phone || "support@godavari-one.org",
    },
  }).catch((err) => console.error("[NRI] Failed to queue approval email:", err));

  // Schedule Reminders
  scheduleBookingReminders({
    bookingId: request.id,
    bookingReference: request.referenceNumber,
    bookingCategory: "NRI custom packages",
    serviceName: `NRI Custom Pilgrimage Package`,
    userId: request.visitorId,
    recipientEmail: request.visitorEmail,
    recipientName: request.visitorName,
    language: "en",
    bookingDate: request.arrivalDate,
    bookingTime: "09:00",
    location: "Rajahmundry & Godavari Region",
  }).catch((err) => console.error("[NRI] Failed to schedule reminders:", err));

  // 5. Send notification to provider
  await sendNriWorkflowNotification({
    userId: ctx.user.id,
    recipientEmail: quotation.provider.email,
    recipientName: quotation.provider.name,
    type: "NRI_PROVIDER_CONFIRMED",
    title: `Confirmation Recorded (${request.referenceNumber})`,
    message: `You successfully confirmed all required hospitality, transport, and ghat services for group of ${request.groupSize} (${request.visitorName}).`,
    link: "/owner-dashboard",
  });

  return ok({
    ok: true,
    request: updatedRequest,
    quotation: updatedQuotation,
    message: "Service arrangements verified and package successfully confirmed!",
  });
});
