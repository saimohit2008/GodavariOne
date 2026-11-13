import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canSuperviseGhats } from "@/lib/constants";
import { z } from "zod";

const updateReportSchema = z
  .object({
    reviewStatus: z.enum(["ACKNOWLEDGED", "ESCALATED", "RESOLVED"]).optional(),
    status: z.enum(["ACKNOWLEDGED", "ESCALATED", "RESOLVED"]).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => Boolean(data.reviewStatus || data.status), {
    message: "Either 'reviewStatus' or 'status' must be provided ('ACKNOWLEDGED', 'ESCALATED', or 'RESOLVED')",
    path: ["reviewStatus"],
  });

// PATCH /api/v1/ghats/reports/[id] — supervisor acknowledges/escalates/resolves
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canSuperviseGhats(ctx.user.role as any)) return fail("Insufficient permissions to supervise ghat reports", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const parsed = updateReportSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const targetStatus = (parsed.data.reviewStatus || parsed.data.status)!;

  const report = await db.ghatReport.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, name: true } },
    },
  });
  if (!report) return fail("Ghat report not found", 404);

  // Supervisor assignment scope check
  if (ctx.user.role === "GHAT_SUPERVISOR") {
    const hasAnyAssignment = await db.assignment.findFirst({
      where: { userId: ctx.user.id, type: "GHAT_SUPERVISOR" },
    });
    if (hasAnyAssignment) {
      const assigned = await db.assignment.findFirst({
        where: { userId: ctx.user.id, type: "GHAT_SUPERVISOR", listingId: report.listingId },
      });
      if (!assigned) {
        return fail("You are not assigned to supervise this ghat", 403);
      }
    }
  }

  // Idempotent check
  if (report.reviewStatus === targetStatus) {
    return ok(report);
  }

  // Status transition validation
  if (report.reviewStatus === "RESOLVED" && targetStatus === "ACKNOWLEDGED") {
    return fail("Resolved reports cannot be moved back to acknowledged status", 400);
  }

  const previousStatus = report.reviewStatus;
  const updateData: {
    reviewStatus: string;
    acknowledgedById?: string;
    acknowledgedAt?: Date;
    notes?: string;
  } = {
    reviewStatus: targetStatus,
  };

  // Record acknowledgement timestamp & actor if acknowledging, or if resolving without prior acknowledgement
  if (targetStatus === "ACKNOWLEDGED" || !report.acknowledgedAt) {
    updateData.acknowledgedById = ctx.user.id;
    updateData.acknowledgedAt = new Date();
  }

  if (parsed.data.notes) {
    updateData.notes = report.notes ? `${report.notes}\n[Update]: ${parsed.data.notes}` : parsed.data.notes;
  }

  const updated = await db.ghatReport.update({
    where: { id },
    data: updateData,
  });

  const auditAction =
    targetStatus === "ACKNOWLEDGED"
      ? "GHAT_REPORT_ACKNOWLEDGE"
      : targetStatus === "RESOLVED"
      ? "GHAT_REPORT_RESOLVE"
      : "GHAT_REPORT_ESCALATE";

  await audit({
    actorId: ctx.user.id,
    action: auditAction,
    targetType: "GHAT_REPORT",
    targetId: id,
    details: {
      listingId: report.listingId,
      listingName: report.listing?.name,
      previousStatus,
      newStatus: targetStatus,
      notes: parsed.data.notes,
    },
    ip: getClientIp(req),
  });

  return ok(updated);
});
