import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";
import { z } from "zod";

const revisionSchema = z.object({
  notes: z.string().min(3).optional(),
  revisionNotes: z.string().min(3).optional(),
}).refine((data) => Boolean(data.notes || data.revisionNotes), {
  message: "Please provide details about the requested revisions",
  path: ["notes"],
});

// POST /api/v1/nri/quotations/[id]/request-revision
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  const body = await req.json().catch(() => ({}));

  const parsed = revisionSchema.safeParse(body);
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
    return fail("Unauthorized to request revision for this quotation", 403);
  }

  const resolvedNotes = (parsed.data.notes || parsed.data.revisionNotes)!;

  // Update quotation status and revision notes
  const updatedQuotation = await db.nriQuotation.update({
    where: { id },
    data: {
      status: "REVISION_REQUESTED",
      revisionNotes: resolvedNotes,
    },
  });

  // Update request status to REVISION_REQUESTED
  await db.nriPackageRequest.update({
    where: { id: request.id },
    data: {
      status: "REVISION_REQUESTED",
    },
  });

  await recordNriStatusChange({
    requestId: request.id,
    fromStatus: request.status,
    toStatus: "REVISION_REQUESTED",
    changedById: ctx?.user?.id,
    changedByName: ctx?.user?.name || request.visitorName,
    reason: `Visitor requested quotation revision: ${resolvedNotes}`,
    ip: getClientIp(req),
  });

  // Notify assigned manager or provider
  const targetUserId = request.assignedManagerId || quotation.providerId;
  await sendNriWorkflowNotification({
    userId: targetUserId,
    type: "NRI_QUOTATION_REVISION_REQUESTED",
    title: `Revision Requested for Quotation ${quotation.quotationNumber}`,
    message: `${request.visitorName} requested revisions for trip quotation (${quotation.quotationNumber}): "${resolvedNotes}". Please revise and resend.`,
    link: "/admin",
  });

  return ok({
    success: true,
    ok: true,
    quotation: updatedQuotation,
    message: "Revision request recorded. The manager has been notified to prepare an updated quotation.",
  });
});
