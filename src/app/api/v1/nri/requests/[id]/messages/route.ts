import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";

const postMessageSchema = z.object({
  message: z.string().min(1, "Message content cannot be empty").max(2000, "Message too long"),
  requestRevision: z.boolean().default(false),
  attachments: z.string().optional().nullable(),
});

// GET /api/v1/nri/requests/[id]/messages
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

  if (!isSuperAdmin && !isVisitor && !isAssigned) {
    return fail("Unauthorized to view messages for this request", 403);
  }

  const messages = await db.nriMessage.findMany({
    where: { requestId: id },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok({ messages });
});

// POST /api/v1/nri/requests/[id]/messages
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          provider: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
      visitor: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isVisitor = ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone;
  const isAssigned = request.assignments.some((a) => a.providerId === ctx.user.id);

  if (!isSuperAdmin && !isVisitor && !isAssigned) {
    return fail("Unauthorized to post messages for this request", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = postMessageSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const senderRole = isSuperAdmin ? "SUPER_ADMIN" : isVisitor ? "VISITOR" : "BUSINESS_OWNER";
  const senderName = ctx.user.name || (isVisitor ? request.visitorName : "Service Partner");

  const newMessage = await db.nriMessage.create({
    data: {
      requestId: id,
      senderId: ctx.user.id,
      senderRole,
      senderName,
      message: parsed.data.message.trim(),
      attachments: parsed.data.attachments || null,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });

  // If visitor specifically asked for revisions or request is in QUOTATION_SENT
  if (isVisitor && (parsed.data.requestRevision || request.status === "QUOTATION_SENT")) {
    await db.nriPackageRequest.update({
      where: { id },
      data: { status: "REVISION_REQUESTED" },
    });

    await recordNriStatusChange({
      requestId: id,
      fromStatus: request.status,
      toStatus: "REVISION_REQUESTED",
      changedById: ctx.user.id,
      changedByName: senderName,
      reason: `Visitor requested quotation changes / asked questions: "${parsed.data.message.slice(0, 100)}"`,
      ip: getClientIp(req),
    });
  }

  // Send notifications to the counterparty
  if (isVisitor) {
    // Notify assigned business owners
    for (const assignment of request.assignments) {
      await sendNriWorkflowNotification({
        userId: assignment.providerId,
        recipientEmail: assignment.provider.email,
        recipientName: assignment.provider.name,
        type: "NRI_MESSAGE_RECEIVED",
        title: `Question from Visitor (${request.referenceNumber})`,
        message: `${request.visitorName}: "${parsed.data.message.slice(0, 140)}"`,
        link: "/owner-dashboard",
      });
    }
  } else {
    // Business owner or admin replied -> notify visitor
    await sendNriWorkflowNotification({
      userId: request.visitorId,
      recipientEmail: request.visitorEmail,
      recipientName: request.visitorName,
      type: "NRI_MESSAGE_RECEIVED",
      title: `Response from ${senderName} (${request.referenceNumber})`,
      message: `${senderName}: "${parsed.data.message.slice(0, 140)}"`,
      link: `/nri-access?ref=${request.referenceNumber}`,
    });
  }

  return created({
    ok: true,
    message: newMessage,
  });
});
