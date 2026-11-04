import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import {
  inspectReviewContent,
  ISSUE_CATEGORIES,
  MODERATION_REASONS,
  type ModerationReason,
} from "@/lib/reviews";
import { canModerateReview } from "@/lib/review-auth";
import { z } from "zod";

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(120).optional().nullable(),
  content: z.string().min(10).max(2000).optional(),
  issueCategory: z.enum(ISSUE_CATEGORIES as unknown as [string, ...string[]]).optional().nullable(),
  photos: z.array(z.string().max(500)).max(6).optional().nullable(),
  // Moderator fields
  status: z.enum(["PUBLISHED", "HIDDEN", "REMOVED"]).optional(),
  moderationReason: z.enum(MODERATION_REASONS as unknown as [string, ...string[]]).optional().nullable(),
  flagReason: z.string().max(300).optional().nullable(),
});

// GET /api/v1/reviews/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const review = await db.review.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, name: true, category: true, ownerId: true } },
      user: { select: { id: true, name: true, phone: true } },
      moderator: { select: { id: true, name: true, role: true } },
    },
  });

  if (!review) return fail("Review not found", 404);

  return ok({
    ...review,
    photos: review.photos ? JSON.parse(review.photos) : [],
  });
});

// PATCH /api/v1/reviews/[id] — update review by author or moderator
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const review = await db.review.findUnique({
    where: { id },
    include: { listing: { select: { id: true, name: true, category: true, ownerId: true } } },
  });

  if (!review) return fail("Review not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = updateReviewSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const data = parsed.data;
  const isAuthor = review.userId === ctx.user.id;

  // Case A: Moderator updating review status / moderation reason
  if (data.status && data.status !== review.status) {
    const auth = await canModerateReview(ctx.user.id, ctx.user.role, review.listingId, data.moderationReason || undefined);
    if (!auth.allowed) {
      return fail(auth.reason || "You are not authorized to moderate this review", 403);
    }

    const updated = await db.review.update({
      where: { id },
      data: {
        status: data.status,
        moderatedById: ctx.user.id,
        moderationReason: data.moderationReason || null,
        moderatedAt: new Date(),
        // If restored to PUBLISHED, clear active flag
        ...(data.status === "PUBLISHED" ? { isFlagged: false, flagReason: null } : {}),
      },
    });

    await audit({
      actorId: ctx.user.id,
      action: `REVIEW_STATUS_${data.status}`,
      targetType: "REVIEW",
      targetId: id,
      details: {
        listingId: review.listingId,
        listingName: review.listing.name,
        previousStatus: review.status,
        newStatus: data.status,
        moderationReason: data.moderationReason,
        moderatorRole: ctx.user.role,
      },
      ip: getClientIp(req),
    });

    return ok({
      ok: true,
      review: {
        ...updated,
        photos: updated.photos ? JSON.parse(updated.photos) : [],
      },
      message: `Review marked as ${data.status.toLowerCase()}.`,
    });
  }

  // Case B: Author editing their own review content
  if (!isAuthor) {
    return fail("You cannot edit another user's review", 403);
  }

  const newContent = data.content !== undefined ? data.content.trim() : review.content;
  const newTitle = data.title !== undefined ? data.title?.trim() || null : review.title;
  const inspection = inspectReviewContent(`${newTitle || ""} ${newContent}`);

  const updated = await db.review.update({
    where: { id },
    data: {
      rating: data.rating !== undefined ? data.rating : review.rating,
      title: newTitle,
      content: newContent,
      issueCategory: data.issueCategory !== undefined ? data.issueCategory : review.issueCategory,
      photos: data.photos !== undefined ? (data.photos ? JSON.stringify(data.photos) : null) : review.photos,
      isFlagged: inspection.shouldAutoFlag ? true : review.isFlagged,
      flagReason: inspection.flagReason || review.flagReason,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "REVIEW_UPDATE",
    targetType: "REVIEW",
    targetId: id,
    details: {
      listingId: review.listingId,
      rating: updated.rating,
      autoFlagged: inspection.shouldAutoFlag,
    },
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    review: {
      ...updated,
      photos: updated.photos ? JSON.parse(updated.photos) : [],
    },
    message: "Your review has been updated successfully.",
  });
});

// DELETE /api/v1/reviews/[id] — delete review (author or authorized moderator)
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const review = await db.review.findUnique({
    where: { id },
    include: { listing: { select: { id: true, name: true, category: true, ownerId: true } } },
  });

  if (!review) return fail("Review not found", 404);

  const isAuthor = review.userId === ctx.user.id;

  if (!isAuthor) {
    const { searchParams } = new URL(req.url);
    const moderationReason = searchParams.get("reason") || undefined;

    const auth = await canModerateReview(ctx.user.id, ctx.user.role, review.listingId, moderationReason);
    if (!auth.allowed) {
      return fail(auth.reason || "You are not authorized to delete or moderate this review", 403);
    }

    // Preservation requirement: Moderators mark as REMOVED rather than hard-deleting
    // to preserve dispute audit history
    await db.review.update({
      where: { id },
      data: {
        status: "REMOVED",
        moderatedById: ctx.user.id,
        moderationReason: moderationReason || "OTHER",
        moderatedAt: new Date(),
      },
    });

    await audit({
      actorId: ctx.user.id,
      action: "REVIEW_MODERATE_REMOVE",
      targetType: "REVIEW",
      targetId: id,
      details: {
        listingId: review.listingId,
        moderationReason,
        moderatorRole: ctx.user.role,
      },
      ip: getClientIp(req),
    });

    return ok({
      ok: true,
      action: "REMOVED",
      message: "Review removed by moderator and archived in audit history.",
    });
  }

  // Author deleting their own review: clean hard delete
  await db.review.delete({ where: { id } });

  await audit({
    actorId: ctx.user.id,
    action: "REVIEW_DELETE_OWN",
    targetType: "REVIEW",
    targetId: id,
    details: { listingId: review.listingId },
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    action: "DELETED",
    message: "Your review was deleted successfully.",
  });
});
