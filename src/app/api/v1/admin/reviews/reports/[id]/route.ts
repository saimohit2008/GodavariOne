import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { MODERATION_REASONS } from "@/lib/reviews";
import { canModerateReview } from "@/lib/review-auth";
import { z } from "zod";

const resolveReportSchema = z.object({
  action: z.enum(["RESOLVE_REMOVE", "RESOLVE_KEEP"]),
  moderationReason: z.enum(MODERATION_REASONS as unknown as [string, ...string[]]).optional(),
  resolutionNotes: z.string().max(500).optional().nullable(),
});

// PATCH / POST /api/v1/admin/reviews/reports/[id] — resolve or dismiss review report
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const report = await db.reviewReport.findUnique({
    where: { id },
    include: {
      review: {
        include: {
          listing: { select: { id: true, name: true, category: true, ownerId: true } },
        },
      },
    },
  });

  if (!report) return fail("Report not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = resolveReportSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { action, moderationReason, resolutionNotes } = parsed.data;

  // Authorization check
  const auth = await canModerateReview(ctx.user.id, ctx.user.role, report.review.listingId, moderationReason);
  if (!auth.allowed) {
    return fail(auth.reason || "You are not authorized to moderate reports for this listing", 403);
  }

  const now = new Date();

  if (action === "RESOLVE_REMOVE") {
    // Hide or remove review and mark report as RESOLVED
    await db.$transaction([
      db.reviewReport.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolvedById: ctx.user.id,
          resolutionNotes: resolutionNotes || `Review removed for: ${moderationReason || report.reason}`,
          resolvedAt: now,
        },
      }),
      db.review.update({
        where: { id: report.reviewId },
        data: {
          status: "REMOVED",
          moderatedById: ctx.user.id,
          moderationReason: moderationReason || report.reason,
          moderatedAt: now,
        },
      }),
    ]);

    await audit({
      actorId: ctx.user.id,
      action: "REVIEW_REPORT_RESOLVED_REMOVE",
      targetType: "REVIEW_REPORT",
      targetId: id,
      details: {
        reviewId: report.reviewId,
        listingId: report.review.listingId,
        moderationReason: moderationReason || report.reason,
        resolutionNotes,
      },
      ip: getClientIp(req),
    });

    return ok({
      ok: true,
      message: "Report resolved: the review has been removed from public display.",
    });
  }

  // action === "RESOLVE_KEEP" — dismiss report and keep review published
  await db.$transaction([
    db.reviewReport.update({
      where: { id },
      data: {
        status: "DISMISSED",
        resolvedById: ctx.user.id,
        resolutionNotes: resolutionNotes || "Report reviewed and dismissed. Review remains published.",
        resolvedAt: now,
      },
    }),
    db.review.update({
      where: { id: report.reviewId },
      data: {
        isFlagged: false,
        flagReason: null,
      },
    }),
  ]);

  await audit({
    actorId: ctx.user.id,
    action: "REVIEW_REPORT_DISMISSED",
    targetType: "REVIEW_REPORT",
    targetId: id,
    details: {
      reviewId: report.reviewId,
      listingId: report.review.listingId,
      resolutionNotes,
    },
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    message: "Report dismissed: the review was verified as compliant and remains published.",
  });
});

export const POST = PATCH;
