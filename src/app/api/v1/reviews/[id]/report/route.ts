import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { MODERATION_REASONS } from "@/lib/reviews";
import { z } from "zod";

const reportSchema = z.object({
  reason: z.enum(MODERATION_REASONS as unknown as [string, ...string[]]),
  details: z.string().max(500, "Details cannot exceed 500 characters").optional().nullable(),
});

// POST /api/v1/reviews/[id]/report — report inappropriate review
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("You must be logged in to report a review", 401);

  const review = await db.review.findUnique({
    where: { id },
    include: { listing: { select: { id: true, name: true } } },
  });

  if (!review) return fail("Review not found", 404);

  // Prevent users from reporting their own review
  if (review.userId === ctx.user.id) {
    return fail("You cannot report your own review", 400);
  }

  // Duplicate report prevention
  const existingReport = await db.reviewReport.findUnique({
    where: { reviewId_reporterId: { reviewId: id, reporterId: ctx.user.id } },
  });

  if (existingReport) {
    return fail("You have already reported this review. Our moderation team is investigating it.", 409);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { reason, details } = parsed.data;

  // Create report record and auto-flag review
  const [report] = await db.$transaction([
    db.reviewReport.create({
      data: {
        reviewId: id,
        reporterId: ctx.user.id,
        reason,
        details: details?.trim() || null,
        status: "PENDING",
      },
    }),
    db.review.update({
      where: { id },
      data: {
        isFlagged: true,
        flagReason: `Reported by user for: ${reason}`,
      },
    }),
  ]);

  await audit({
    actorId: ctx.user.id,
    action: "REVIEW_REPORT",
    targetType: "REVIEW_REPORT",
    targetId: report.id,
    details: {
      reviewId: id,
      listingId: review.listingId,
      reason,
      details,
    },
    ip: getClientIp(req),
  });

  return created({
    ok: true,
    reportId: report.id,
    message: "Thank you for helping keep Godavari One safe. Your report has been submitted to the moderation team.",
  });
});
