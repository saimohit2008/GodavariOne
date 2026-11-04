import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { canManageGhatPriorityBookings } from "@/lib/priority-booking";
import { z } from "zod";

// POST /api/v1/priority-bookings/verify-qr — Verified entry check-in via QR scan or manual lookup
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSupervisor = role === "GHAT_SUPERVISOR";

  if (!isSuperAdmin && !isSupervisor) {
    return fail("Access denied. Only authorized ghat supervisors or administrators can verify entry.", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload.", 400);

  const schema = z.object({
    token: z.string().optional(),
    applicationNumber: z.string().optional(),
    manualNotes: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("Must provide either a valid QR pass token or application number.", 422);
  }

  const { token, applicationNumber, manualNotes } = parsed.data;

  if (!token && !applicationNumber) {
    return fail("A QR pass token or application number is required for entry verification.", 422);
  }

  // Parse token if raw JSON payload was scanned directly from QR
  let searchToken = token?.trim();
  let searchAppNum = applicationNumber?.trim();

  if (searchToken && searchToken.startsWith("{")) {
    try {
      const parsedPayload = JSON.parse(searchToken);
      if (parsedPayload.token) searchToken = parsedPayload.token;
      if (parsedPayload.ref) searchAppNum = parsedPayload.ref;
    } catch {
      // treat as raw string token
    }
  }

  // Find booking
  const booking = await db.priorityGhatBooking.findFirst({
    where: {
      OR: [
        searchToken ? { qrPassToken: searchToken } : undefined,
        searchAppNum ? { applicationNumber: searchAppNum } : undefined,
      ].filter(Boolean) as any[],
    },
    include: {
      ghat: {
        select: {
          id: true,
          name: true,
          town: true,
          district: true,
        },
      },
      timeSlot: true,
      checkedInBy: {
        select: {
          name: true,
          role: true,
        },
      },
    },
  });

  if (!booking) {
    return fail("No matching priority booking found for this pass.", 404);
  }

  // Strict Ghat access boundary: Supervisor must be assigned to this booking's ghat
  const isAuthorizedAtGhat = await canManageGhatPriorityBookings(ctx.user.id, role, booking.ghatId);
  if (!isAuthorizedAtGhat) {
    return fail(
      `Access denied. You are only authorized to check in visitors at your assigned ghats. This pass is issued for ${booking.ghat.name}.`,
      403
    );
  }

  // State checks
  if (booking.status === "CHECKED_IN") {
    const timeFormatted = booking.checkedInAt
      ? new Date(booking.checkedInAt).toLocaleString()
      : "earlier today";
    const staffName = booking.checkedInBy?.name || "Ghat Staff";
    return fail(
      `Duplicate entry attempt. This pass was already checked in at ${timeFormatted} by ${staffName}. Duplicate check-in rejected.`,
      409
    );
  }

  if (booking.status === "CANCELLED") {
    return fail("Entry rejected: This booking has been cancelled.", 400);
  }

  if (booking.status === "REJECTED") {
    return fail("Entry rejected: This application was rejected during review.", 400);
  }

  if (booking.status !== "SLOT_ASSIGNED") {
    return fail(
      `Pass is not valid for entry. Current application status is ${booking.status}. A confirmed time slot is required.`,
      400
    );
  }

  const checkedInMethod = token ? "QR_SCAN" : "MANUAL_VERIFICATION";
  const now = new Date();

  // Mark CHECKED_IN
  const updated = await db.priorityGhatBooking.update({
    where: { id: booking.id },
    data: {
      status: "CHECKED_IN",
      checkedInAt: now,
      checkedInById: ctx.user.id,
      checkedInMethod,
      updatedAt: now,
    },
    include: {
      timeSlot: true,
      ghat: true,
    },
  });

  // Record audit history
  await db.priorityBookingHistory.create({
    data: {
      bookingId: booking.id,
      fromStatus: "SLOT_ASSIGNED",
      toStatus: "CHECKED_IN",
      changedById: ctx.user.id,
      changedByName: ctx.user.name || "Ghat Supervisor",
      reason: `Entry verified via ${checkedInMethod}${manualNotes ? `: ${manualNotes}` : ""}`,
      metadata: JSON.stringify({
        checkedInAt: now.toISOString(),
        checkedInMethod,
        ghatId: booking.ghatId,
      }),
    },
  });

  // Notify applicant of successful entry check-in
  if (booking.userId) {
    await notify({
      userId: booking.userId,
      type: "PRIORITY_BOOKING_CHECKED_IN",
      title: "Ghat Entry Verified",
      message: `Your entry pass for ${booking.ghat.name} was successfully verified at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Welcome!`,
      link: "/bookings",
    });
  }

  // Audit log
  await audit({
    actorId: ctx.user.id,
    action: "PRIORITY_BOOKING_CHECKIN",
    targetType: "PRIORITY_GHAT_BOOKING",
    targetId: booking.id,
    details: {
      applicationNumber: booking.applicationNumber,
      ghatId: booking.ghatId,
      beneficiaryName: booking.beneficiaryName,
      category: booking.category,
      checkedInMethod,
      accompanyingCount: booking.accompanyingCount,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    message: "Ghat entry successfully verified and recorded.",
    booking: {
      id: updated.id,
      applicationNumber: updated.applicationNumber,
      beneficiaryName: updated.beneficiaryName,
      category: updated.category,
      accompanyingCount: updated.accompanyingCount,
      accessibilityNeeds: updated.accessibilityNeeds,
      ghatName: updated.ghat.name,
      visitDate: updated.visitDate,
      timeSlot: updated.timeSlot
        ? `${updated.timeSlot.startTime} - ${updated.timeSlot.endTime}`
        : null,
      checkedInAt: updated.checkedInAt,
      checkedInMethod,
      checkedInBy: ctx.user.name || "Supervisor",
    },
  });
});
