import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { canManageGhatPriorityBookings } from "@/lib/priority-booking";
import { z } from "zod";
import { queueEmailNotification } from "@/lib/email-service";

// PATCH /api/v1/ghats/[id]/slots/[slotId] — Update capacity, status (e.g. temporary closure), or notes
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) => {
  const { id, slotId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAuthorized = await canManageGhatPriorityBookings(ctx.user.id, role, id);

  if (!isSuperAdmin && !isAuthorized) {
    return fail("Access denied. You are not authorized to manage slots for this ghat.", 403);
  }

  const slot = await db.ghatTimeSlot.findUnique({
    where: { id: slotId },
  });

  if (!slot || slot.ghatId !== id) {
    return fail("Time slot not found for this ghat.", 404);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload.", 400);

  const schema = z.object({
    status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]).optional(),
    maxCapacity: z.number().int().min(1).max(1000).optional(),
    accessibilityNotes: z.string().optional(),
    closureReason: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Validation failed", 422);
  }

  const { status, maxCapacity, accessibilityNotes, closureReason } = parsed.data;

  // If status is being set to CLOSED, identify affected bookings
  let affectedBookings: any[] = [];
  if (status === "CLOSED" && slot.status !== "CLOSED") {
    const [ghatListing, bookings] = await Promise.all([
      db.listing.findUnique({ where: { id }, select: { name: true } }),
      db.priorityGhatBooking.findMany({
        where: {
          timeSlotId: slot.id,
          status: "SLOT_ASSIGNED",
        },
        select: {
          id: true,
          applicationNumber: true,
          beneficiaryName: true,
          userId: true,
          user: {
            select: { email: true, name: true },
          },
        },
      }),
    ]);

    affectedBookings = bookings;
    const ghatName = ghatListing?.name || "Pushkaralu Ghat";

    // Notify affected users of slot closure / rescheduling need
    for (const b of affectedBookings) {
      if (b.userId) {
        await notify({
          userId: b.userId,
          type: "PRIORITY_BOOKING_SLOT_CLOSED",
          title: "Pushkaralu Ghat Slot Temporarily Closed",
          message: `Your scheduled visit on ${slot.slotDate} (${slot.startTime}-${slot.endTime}) has been affected by a temporary ghat/slot closure. An administrator will reschedule your slot.`,
          link: "/bookings",
        });
      }

      if (b.user?.email) {
        queueEmailNotification({
          eventType: "GHAT_CLOSURE",
          userId: b.userId,
          bookingId: b.id,
          bookingReference: b.applicationNumber,
          bookingCategory: "Ghat priority pass",
          recipientEmail: b.user.email,
          recipientName: b.user.name || b.beneficiaryName,
          language: (b.user as any)?.language || "en",
          idempotencyKey: `GHAT_SLOT_CLOSURE_${b.id}_${slot.id}`,
          payload: {
            eventType: "GHAT_CLOSURE",
            customerName: b.beneficiaryName,
            bookingReference: b.applicationNumber,
            ghatName,
            originalBookingDate: slot.slotDate,
            originalBookingTime: `${slot.startTime} - ${slot.endTime}`,
            closureEffectiveTime: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            closureReason: closureReason || "Pushkaralu safety and crowd management protocols",
            officialInstructions: "Please do not proceed to this ghat during this timeslot. An authorized administrator will reallocate your slot.",
            alternativeGhats: ["VIP Ghat", "Pushkar Ghat", "Saraswati Ghat"],
            supportContact: "support@godavari-one.org",
            emergencyHelpline: "1800-425-5155",
          },
        }).catch((err) => console.error("[SlotClosure] Failed to queue email notification:", err));
      }
    }
  }

  const updatedSlot = await db.ghatTimeSlot.update({
    where: { id: slotId },
    data: {
      status: status || slot.status,
      maxCapacity: maxCapacity != null ? maxCapacity : slot.maxCapacity,
      accessibilityNotes: accessibilityNotes !== undefined ? accessibilityNotes : slot.accessibilityNotes,
      updatedAt: new Date(),
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: status === "CLOSED" ? "GHAT_TIME_SLOT_CLOSED" : "GHAT_TIME_SLOT_UPDATE",
    targetType: "GHAT_TIME_SLOT",
    targetId: slot.id,
    details: {
      ghatId: id,
      slotDate: slot.slotDate,
      oldStatus: slot.status,
      newStatus: updatedSlot.status,
      affectedBookingsCount: affectedBookings.length,
      closureReason: closureReason || null,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    slot: updatedSlot,
    affectedBookingsCount: affectedBookings.length,
    affectedBookings,
  });
});
