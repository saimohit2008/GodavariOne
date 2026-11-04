import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { readPrivateDocument, savePrivateDocument } from "@/lib/private-storage";
import { canManageGhatPriorityBookings } from "@/lib/priority-booking";

// GET /api/v1/priority-bookings/[id]/document — Secure, authenticated access to proof documents
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const booking = await db.priorityGhatBooking.findUnique({
    where: { id },
  });

  if (!booking) {
    return fail("Priority booking application not found.", 404);
  }

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isOwner = booking.userId === ctx.user.id;
  const isAuthorizedSupervisor = await canManageGhatPriorityBookings(ctx.user.id, role, booking.ghatId);

  // Strict privacy control: only owner, super admin, or assigned supervisor can view documents
  if (!isSuperAdmin && !isAuthorizedSupervisor && !isOwner) {
    return fail("Access denied. You do not have permission to view this supporting document.", 403);
  }

  const fileData = await readPrivateDocument(booking.documentPath);
  if (!fileData) {
    return fail("Document file not found on secure storage.", 404);
  }

  // Record audit access for compliance (no content logged)
  await audit({
    actorId: ctx.user.id,
    action: "PRIORITY_BOOKING_DOCUMENT_ACCESSED",
    targetType: "PRIORITY_GHAT_BOOKING",
    targetId: id,
    details: {
      applicationNumber: booking.applicationNumber,
      documentOriginalName: booking.documentOriginalName,
      viewerRole: role,
    },
    ip: getClientIp(req),
  });

  return new Response(new Uint8Array(fileData.buffer), {
    status: 200,
    headers: {
      "Content-Type": fileData.mimeType,
      "Content-Length": String(fileData.sizeBytes),
      "Content-Disposition": `inline; filename="${booking.documentOriginalName}"`,
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    },
  });
});

// POST /api/v1/priority-bookings/[id]/document — Upload replacement document when additional proof is required
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const booking = await db.priorityGhatBooking.findUnique({
    where: { id },
    include: { ghat: true },
  });

  if (!booking) {
    return fail("Priority booking application not found.", 404);
  }

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isOwner = booking.userId === ctx.user.id;

  if (!isSuperAdmin && !isOwner) {
    return fail("Only the applicant or administrator can submit a replacement document.", 403);
  }

  if (booking.status !== "ADDITIONAL_PROOF_REQUIRED" && !isSuperAdmin) {
    return fail("A replacement document can only be submitted when additional proof has been requested.", 400);
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return fail("Invalid form data.", 400);

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return fail("Please provide a valid replacement document file.", 422);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let savedDoc;
  try {
    savedDoc = await savePrivateDocument(buffer, file.name, file.type);
  } catch (err: any) {
    return fail(err.message || "Failed to process replacement document.", 400);
  }

  // Update booking record and reset status to SUBMITTED for re-evaluation
  const updated = await db.priorityGhatBooking.update({
    where: { id },
    data: {
      documentPath: savedDoc.relativePath,
      documentOriginalName: savedDoc.originalName,
      documentMimeType: savedDoc.mimeType,
      documentSizeBytes: savedDoc.sizeBytes,
      documentUploadedAt: new Date(),
      status: "SUBMITTED",
      additionalProofNotes: null,
      updatedAt: new Date(),
    },
  });

  // Record audit history
  await db.priorityBookingHistory.create({
    data: {
      bookingId: id,
      fromStatus: "ADDITIONAL_PROOF_REQUIRED",
      toStatus: "SUBMITTED",
      changedById: ctx.user.id,
      changedByName: ctx.user.name || "Applicant",
      reason: "Replacement supporting proof document uploaded by applicant",
    },
  });

  // Notify assigned Ghat Supervisors
  const supervisors = await db.assignment.findMany({
    where: {
      type: "GHAT_SUPERVISOR",
      listingId: booking.ghatId,
    },
    select: { userId: true },
  });

  for (const s of supervisors) {
    await notify({
      userId: s.userId,
      type: "PRIORITY_BOOKING_ADDITIONAL_PROOF_SUBMITTED",
      title: "Replacement Document Submitted",
      message: `Replacement proof document submitted for ${booking.applicationNumber} at ${booking.ghat.name}. Ready for re-review.`,
      link: "/dashboard",
    });
  }

  // Audit log
  await audit({
    actorId: ctx.user.id,
    action: "PRIORITY_BOOKING_REPLACEMENT_DOC_UPLOAD",
    targetType: "PRIORITY_GHAT_BOOKING",
    targetId: id,
    details: {
      applicationNumber: booking.applicationNumber,
      documentOriginalName: savedDoc.originalName,
      sizeBytes: savedDoc.sizeBytes,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    applicationNumber: updated.applicationNumber,
    status: updated.status,
    message: "Replacement proof document uploaded successfully. Application status reset to SUBMITTED.",
  });
});
