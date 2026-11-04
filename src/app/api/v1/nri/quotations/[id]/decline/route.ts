import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";
import { z } from "zod";

const declineSchema = z.object({
  reason: z.string().min(3, "Please provide a reason for declining"),
});

// POST /api/v1/nri/quotations/[id]/decline
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  const body = await req.json().catch(() => ({}));

  const parsed = declineSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const quotation = await db.nriQuotation.findUnique({
    where: { id },
    include: {
      request: true,
      provider: true,
    },
  });

  if (!quotation) return fail("Quotation not found", 404);

  const request = quotation.request;
  const isSuperAdmin = ctx?.user?.role === "SUPER_ADMIN";
  const isVisitor =
    (ctx && (ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone)) ||
    (body.referenceNumber === request.referenceNumber && body.visitorEmail?.toLowerCase() === request.visitorEmail.toLowerCase());

  if (!isSuperAdmin && !isVisitor) {
    return fail("Unauthorized to decline this quotation", 403);
  }

  // Update quotation status
  const updatedQuotation = await db.nriQuotation.update({
    where: { id },
    data: {
      status: "DECLINED",
      withdrawalReason: parsed.data.reason,
    },
  });

  // Check if other active quotations exist for this request
  const otherActive = await db.nriQuotation.count({
    where: {
      requestId: request.id,
      id: { not: id },
      status: { in: ["SENT", "REVISION_REQUESTED"] },
    },
  });

  const newRequestStatus = otherActive === 0 ? "DECLINED" : request.status;

  await db.nriPackageRequest.update({
    where: { id: request.id },
    data: { status: newRequestStatus },
  });

  await recordNriStatusChange({
    requestId: request.id,
    fromStatus: request.status,
    toStatus: newRequestStatus,
    changedById: ctx?.user?.id,
    changedByName: ctx?.user?.name || request.visitorName,
    reason: `Visitor declined quotation ${quotation.quotationNumber}: ${parsed.data.reason}`,
    ip: getClientIp(req),
  });

  const targetUserId = request.assignedManagerId || quotation.providerId;
  await sendNriWorkflowNotification({
    userId: targetUserId,
    type: "NRI_QUOTATION_DECLINED",
    title: `Quotation Declined (${quotation.quotationNumber})`,
    message: `${request.visitorName} declined quotation ${quotation.quotationNumber}. Reason: "${parsed.data.reason}".`,
    link: "/admin",
  });

  return ok({
    ok: true,
    quotation: updatedQuotation,
    message: "Quotation declined.",
  });
});
