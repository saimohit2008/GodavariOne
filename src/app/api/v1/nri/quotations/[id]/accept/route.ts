import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";

// POST /api/v1/nri/quotations/[id]/accept
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required to accept quotation", 401);

  const quotation = await db.nriQuotation.findUnique({
    where: { id },
    include: {
      request: {
        include: { assignments: true },
      },
      provider: true,
    },
  });

  if (!quotation) return fail("Quotation not found", 404);

  const request = quotation.request;

  // Authorization: visitor who created request, or visitor phone match, or super admin
  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isVisitor = ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone;

  if (!isSuperAdmin && !isVisitor) {
    return fail("Unauthorized to accept this quotation", 403);
  }

  if (quotation.status !== "SENT" && quotation.status !== "REVISION_REQUESTED") {
    return fail(`Cannot accept a quotation with status "${quotation.status}"`, 400);
  }

  // 1. Mark this quotation as ACCEPTED
  const updatedQuotation = await db.nriQuotation.update({
    where: { id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });

  // 2. Close competing quotations for this request
  await db.nriQuotation.updateMany({
    where: {
      requestId: request.id,
      id: { not: id },
      status: { in: ["SENT", "REVISION_REQUESTED", "DRAFT"] },
    },
    data: {
      status: "CLOSED",
    },
  });

  // 3. Move request status to AWAITING_FINAL_CONFIRMATION (Requirement 7)
  await db.nriPackageRequest.update({
    where: { id: request.id },
    data: {
      status: "AWAITING_FINAL_CONFIRMATION",
      confirmedQuotationId: id,
    },
  });

  // 4. Record status history & audit log
  await recordNriStatusChange({
    requestId: request.id,
    fromStatus: request.status,
    toStatus: "AWAITING_FINAL_CONFIRMATION",
    changedById: ctx.user.id,
    changedByName: ctx.user.name || request.visitorName,
    reason: `Visitor accepted quotation ${quotation.quotationNumber} from provider ${quotation.provider.name || quotation.provider.phone}. Awaiting final service verification.`,
    ip: getClientIp(req),
  });

  // 5. Notify the Business Owner that their quotation was accepted and needs service verification
  await sendNriWorkflowNotification({
    userId: quotation.providerId,
    recipientEmail: quotation.provider.email,
    recipientName: quotation.provider.name,
    type: "NRI_QUOTATION_ACCEPTED",
    title: `Quotation Accepted! (${quotation.quotationNumber})`,
    message: `Visitor ${request.visitorName} accepted your quotation "${quotation.title}" for ₹${quotation.totalPrice.toLocaleString("en-IN")}. Please verify room allocations, vehicle, and meals, and submit your final confirmation.`,
    link: "/owner-dashboard",
  });

  // 6. Notify visitor of next steps
  await sendNriWorkflowNotification({
    userId: request.visitorId,
    recipientEmail: request.visitorEmail,
    recipientName: request.visitorName,
    type: "NRI_QUOTATION_ACCEPTED_VISITOR",
    title: `Quotation Accepted — Service Verification in Progress`,
    message: `You accepted quotation ${quotation.quotationNumber}. The provider (${quotation.provider.name || "Verified Partner"}) has been notified to verify hotel room bookings, vehicle driver, and Pushkara snanam logistics. You will receive final confirmation once all arrangements are locked in.`,
    link: `/nri-access?ref=${request.referenceNumber}`,
  });

  return ok({
    ok: true,
    quotation: updatedQuotation,
    requestStatus: "AWAITING_FINAL_CONFIRMATION",
    message: "Quotation accepted. The package is now awaiting final service confirmation by the business owner.",
  });
});
