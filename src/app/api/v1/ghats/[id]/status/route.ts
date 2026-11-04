import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { z } from "zod";
import type { CrowdStatus } from "@/lib/constants";
import { notifyGhatClosure, notifyGhatReopened } from "@/lib/email-service";

// GET /api/v1/ghats/[id]/status — get crowd status of a ghat
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const listing = await db.listing.findUnique({
    where: { id },
    include: { ghatDetails: true },
  });

  if (!listing || listing.category !== "GHAT") {
    return fail("Ghat listing not found", 404);
  }

  return ok({
    listingId: id,
    name: listing.name,
    currentCrowdStatus: (listing.ghatDetails?.currentCrowdStatus as CrowdStatus | null) ?? null,
    statusUpdatedAt: listing.ghatDetails?.statusUpdatedAt ?? null,
    supervisorId: listing.ghatDetails?.supervisorId ?? null,
  });
});

// PATCH /api/v1/ghats/[id]/status — update ghat crowd status
// Authorized for:
// - SUPER_ADMIN (any ghat)
// - GHAT_SUPERVISOR (only assigned ghats)
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSupervisor = role === "GHAT_SUPERVISOR";

  if (!isSuperAdmin && !isSupervisor) {
    return fail("Insufficient permissions to update ghat crowd status", 403);
  }

  // Verify ghat exists
  const listing = await db.listing.findUnique({
    where: { id },
    include: { ghatDetails: true },
  });

  if (!listing || listing.category !== "GHAT") {
    return fail("Ghat listing not found", 404);
  }

  // Authorization check for GHAT_SUPERVISOR: must be assigned to this ghat
  if (isSupervisor) {
    const [assignedRecord, isDirectSupervisor] = await Promise.all([
      db.assignment.findFirst({
        where: {
          userId: ctx.user.id,
          type: "GHAT_SUPERVISOR",
          listingId: id,
        },
      }),
      listing.ghatDetails?.supervisorId === ctx.user.id,
    ]);

    if (!assignedRecord && !isDirectSupervisor) {
      return fail("You are not authorized to update status for this unassigned ghat", 403);
    }
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const schema = z.object({
    crowdStatus: z.enum(["FREE", "MODERATE", "CROWDED", "CLOSED", "OVERCROWDED", "EMERGENCY"]),
    notes: z.string().max(1000).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { crowdStatus, notes } = parsed.data;
  const oldStatus = listing.ghatDetails?.currentCrowdStatus ?? null;
  const now = new Date();

  // Save changes to database
  const updatedGhatDetails = await db.ghatDetails.upsert({
    where: { listingId: id },
    create: {
      listingId: id,
      currentCrowdStatus: crowdStatus,
      statusUpdatedAt: now,
    },
    update: {
      currentCrowdStatus: crowdStatus,
      statusUpdatedAt: now,
    },
  });

  // Record an audit event with user, ghat, timestamp and old/new values
  await audit({
    actorId: ctx.user.id,
    action: "GHAT_STATUS_UPDATE",
    targetType: "GHAT",
    targetId: id,
    details: {
      ghatId: id,
      ghatName: listing.name,
      oldStatus,
      newStatus: crowdStatus,
      notes: notes || null,
      updatedAt: now.toISOString(),
      updatedByRole: role,
    },
    ip: getClientIp(req),
  });

  // Also record a resolved ground report so operational history captures the supervisor's action
  await db.ghatReport.create({
    data: {
      listingId: id,
      reporterId: ctx.user.id,
      crowdStatus,
      notes: notes || `Status updated to ${crowdStatus} by ${role.replace(/_/g, " ")}`,
      reviewStatus: "RESOLVED",
      acknowledgedById: ctx.user.id,
      acknowledgedAt: now,
    },
  }).catch(() => undefined);

  // If status is OVERCROWDED or EMERGENCY, send alerts to administrators
  if (crowdStatus === "OVERCROWDED" || crowdStatus === "EMERGENCY") {
    const admins = await db.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    await Promise.all(
      admins.map((admin) =>
        notify({
          userId: admin.id,
          type: "GHAT_ALERT",
          title: `Ghat Crowd Alert: ${crowdStatus}`,
          message: `${listing.name} is now reported as ${crowdStatus}.${notes ? ` Note: ${notes}` : ""}`,
        })
      )
    ).catch(() => undefined);
  }

  // Feature 7: Emergency Ghat Closure Notification for affected booking holders
  // Only officially triggers when status transitions to CLOSED. Routine crowd changes (OVERCROWDED/MODERATE/FREE) do not trigger emails.
  if (crowdStatus === "CLOSED" && oldStatus !== "CLOSED") {
    notifyGhatClosure({
      ghatId: id,
      ghatName: listing.name,
      closureReason: notes || "Temporary crowd safety closure declared by administration",
      officialInstructions: "Please avoid traveling to this ghat. Check alternative recommended ghats in your email or wait for reopening notification.",
      declaredById: ctx.user.id,
    }).catch((err) => console.error("[GhatClosure] Error dispatching closure notification:", err));
  } else if (crowdStatus !== "CLOSED" && oldStatus === "CLOSED") {
    // Official reopening notification
    notifyGhatReopened({
      ghatId: id,
      ghatName: listing.name,
      reopeningInstructions: `Ghat has resumed operations with crowd status: ${crowdStatus}.`,
      declaredById: ctx.user.id,
    }).catch((err) => console.error("[GhatReopened] Error dispatching reopening notification:", err));
  }

  return ok({
    ok: true,
    listingId: id,
    ghatName: listing.name,
    oldStatus,
    currentCrowdStatus: crowdStatus,
    statusUpdatedAt: now.toISOString(),
    message: `Ghat crowd status successfully updated to ${crowdStatus}.`,
  });
});
