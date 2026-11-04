import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canReportCrowd, canSuperviseGhats } from "@/lib/constants";
import { z } from "zod";

// GET /api/v1/ghats/reports?listingId=...&status=...
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  const status = searchParams.get("status") || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || 30), 100);

  // Public may see reports only for published ghats, and the latest approved status
  const where: Record<string, unknown> = {};
  if (listingId) where.listingId = listingId;
  if (status) where.reviewStatus = status;

  // If public (no auth / visitor), restrict to acknowledged/escalated/resolved only
  const isStaff = ctx && (canSuperviseGhats(ctx.user.role as any) || canReportCrowd(ctx.user.role as any));
  if (!isStaff) {
    where.reviewStatus = { in: ["ACKNOWLEDGED", "ESCALATED", "RESOLVED"] };
  }

  const items = await db.ghatReport.findMany({
    where,
    include: { listing: true, reporter: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return ok({ items });
});

// POST /api/v1/ghats/reports — ghat reporter submits a crowd observation
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (!canReportCrowd(ctx.user.role as any)) return fail("Insufficient permissions to report crowd", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const schema = z.object({
    listingId: z.string(),
    crowdStatus: z.enum(["FREE", "MODERATE", "CROWDED", "OVERCROWDED", "EMERGENCY"]),
    notes: z.string().max(1000).optional(),
    incidentType: z.enum(["BLOCKED_ACCESS", "MEDICAL_ASSISTANCE", "FACILITY_ISSUE", "NONE"]).default("NONE"),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { listingId, crowdStatus, notes, incidentType } = parsed.data;

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.category !== "GHAT") return fail("Ghat not found", 404);

  // Supervisor assignment enforcement: GHAT_SUPERVISOR may report for assigned ghats
  if (ctx.user.role === "GHAT_SUPERVISOR") {
    const hasAnyAssignment = await db.assignment.findFirst({
      where: { userId: ctx.user.id, type: "GHAT_SUPERVISOR" },
    });
    if (hasAnyAssignment) {
      const assigned = await db.assignment.findFirst({
        where: { userId: ctx.user.id, type: "GHAT_SUPERVISOR", listingId },
      });
      if (!assigned) return fail("You are not assigned to supervise this ghat", 403);
    }
  }

  const report = await db.ghatReport.create({
    data: { listingId, reporterId: ctx.user.id, crowdStatus, notes: notes || null, incidentType },
  });

  // Update ghat's current status mirror
  await db.ghatDetails.update({
    where: { listingId },
    data: { currentCrowdStatus: crowdStatus, statusUpdatedAt: new Date() },
  }).catch(() => undefined);

  await audit({
    actorId: ctx.user.id,
    action: "GHAT_REPORT_CREATE",
    targetType: "GHAT_REPORT",
    targetId: report.id,
    details: { listingId, crowdStatus, incidentType },
    ip: getClientIp(req),
  });

  // Notify supervisor + super admins if overcrowded/emergency
  if (crowdStatus === "OVERCROWDED" || crowdStatus === "EMERGENCY" || incidentType !== "NONE") {
    const supervisors = await db.user.findMany({ where: { role: "GHAT_SUPERVISOR", status: "ACTIVE" } });
    const admins = await db.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    await Promise.all(
      [...supervisors, ...admins].map((u) =>
        notify({ userId: u.id, type: "GHAT_ALERT", title: `Ghat alert: ${crowdStatus}`, message: `${listing.name}: ${crowdStatus}${notes ? " — " + notes : ""}` })
      )
    );
  }

  return created(report);
});
