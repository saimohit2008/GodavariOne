import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, zodError, getClientIp } from "@/lib/validation";
import {
  formatReviewerAlias,
  inspectReviewContent,
  calculateRatingSummary,
  ISSUE_CATEGORIES,
  type IssueCategory,
} from "@/lib/reviews";
import { canViewModerationQueue } from "@/lib/review-auth";
import { z } from "zod";

const createReviewSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  title: z.string().max(120, "Title cannot exceed 120 characters").optional().nullable(),
  content: z.string().min(10, "Review feedback must be at least 10 characters long").max(2000, "Review cannot exceed 2000 characters"),
  issueCategory: z.enum(ISSUE_CATEGORIES as unknown as [string, ...string[]]).optional().nullable(),
  photos: z.array(z.string().max(500)).max(6, "Maximum 6 photos allowed").optional().nullable(),
});

// GET /api/v1/listings/[id]/reviews — public reviews list & rating summary
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const sort = searchParams.get("sort") || "newest";
  const issueCategory = searchParams.get("issueCategory") || undefined;
  const ratingFilter = searchParams.get("rating") ? parseInt(searchParams.get("rating")!, 10) : undefined;

  const listing = await db.listing.findUnique({
    where: { id },
    select: { id: true, name: true, category: true, publicationStatus: true },
  });

  if (!listing) {
    return fail("Listing not found", 404);
  }

  // Check if caller has moderation view privileges (Super Admin, Owner, Supervisor)
  let isModerator = false;
  if (ctx) {
    const modCheck = await canViewModerationQueue(ctx.user.id, ctx.user.role, id);
    isModerator = modCheck.allowed;
  }

  // Compute overall summary across all published reviews
  const allListingReviews = await db.review.findMany({
    where: { listingId: id },
    select: { rating: true, status: true, issueCategory: true },
  });

  const summary = calculateRatingSummary(allListingReviews);

  // Build filter for paginated list
  const where: Record<string, unknown> = { listingId: id };
  if (!isModerator) {
    if (ctx) {
      // Normal visitors see all PUBLISHED reviews PLUS their own review (even if flagged/hidden)
      where.OR = [
        { status: "PUBLISHED" },
        { userId: ctx.user.id },
      ];
    } else {
      where.status = "PUBLISHED";
    }
  }

  if (issueCategory && ISSUE_CATEGORIES.includes(issueCategory as IssueCategory)) {
    where.issueCategory = issueCategory;
  }
  if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
    where.rating = ratingFilter;
  }

  let orderBy: any = { createdAt: "desc" };
  if (sort === "oldest") orderBy = { createdAt: "asc" };
  else if (sort === "highest_rating") orderBy = [{ rating: "desc" }, { createdAt: "desc" }];
  else if (sort === "lowest_rating") orderBy = [{ rating: "asc" }, { createdAt: "desc" }];

  const [totalFiltered, reviews, userReviewRecord] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        moderator: { select: { id: true, name: true, role: true } },
        _count: { select: { reports: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    ctx
      ? db.review.findFirst({
          where: { listingId: id, userId: ctx.user.id },
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        })
      : null,
  ]);

  const items = reviews.map((rev) => {
    const isAuthor = ctx ? ctx.user.id === rev.userId : false;
    const reviewerAlias = isAuthor ? (rev.user.name || "You") : formatReviewerAlias(rev.user.name, rev.user.phone);

    return {
      id: rev.id,
      listingId: rev.listingId,
      rating: rev.rating,
      title: rev.title,
      content: rev.content,
      issueCategory: rev.issueCategory,
      photos: rev.photos ? JSON.parse(rev.photos) : [],
      status: rev.status,
      isFlagged: rev.isFlagged,
      flagReason: isModerator || isAuthor ? rev.flagReason : undefined,
      moderatedAt: rev.moderatedAt,
      moderationReason: isModerator || isAuthor ? rev.moderationReason : undefined,
      reviewerName: reviewerAlias,
      isAuthor,
      reportsCount: isModerator ? rev._count.reports : undefined,
      createdAt: rev.createdAt,
      updatedAt: rev.updatedAt,
    };
  });

  return ok({
    listingId: id,
    listingName: listing.name,
    category: listing.category,
    summary,
    items,
    total: totalFiltered,
    page,
    limit,
    totalPages: Math.ceil(totalFiltered / limit) || 1,
    userReview: userReviewRecord
      ? {
          id: userReviewRecord.id,
          rating: userReviewRecord.rating,
          title: userReviewRecord.title,
          content: userReviewRecord.content,
          issueCategory: userReviewRecord.issueCategory,
          photos: userReviewRecord.photos ? JSON.parse(userReviewRecord.photos) : [],
          status: userReviewRecord.status,
          createdAt: userReviewRecord.createdAt,
        }
      : null,
  });
});

// POST /api/v1/listings/[id]/reviews — visitor review submission
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("You must be logged in to share a review", 401);

  const listing = await db.listing.findUnique({
    where: { id },
    select: { id: true, name: true, category: true, publicationStatus: true },
  });

  if (!listing) return fail("Listing not found", 404);

  // Check duplicate submission
  const existing = await db.review.findFirst({
    where: { listingId: id, userId: ctx.user.id },
  });

  if (existing) {
    return fail("You have already reviewed this listing. You can edit your existing review instead.", 409);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { rating, title, content, issueCategory, photos } = parsed.data;

  // Run automated content & prohibited language safety inspection
  const inspection = inspectReviewContent(`${title || ""} ${content}`);

  const review = await db.review.create({
    data: {
      listingId: id,
      userId: ctx.user.id,
      rating,
      title: title?.trim() || null,
      content: content.trim(),
      issueCategory: issueCategory || null,
      photos: photos && photos.length > 0 ? JSON.stringify(photos) : null,
      status: "PUBLISHED",
      isFlagged: inspection.shouldAutoFlag,
      flagReason: inspection.flagReason || null,
    },
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "REVIEW_CREATE",
    targetType: "REVIEW",
    targetId: review.id,
    details: {
      listingId: id,
      listingName: listing.name,
      rating,
      issueCategory,
      autoFlagged: inspection.shouldAutoFlag,
      flagReason: inspection.flagReason,
    },
    ip: getClientIp(req),
  });

  return created({
    id: review.id,
    listingId: review.listingId,
    rating: review.rating,
    title: review.title,
    content: review.content,
    issueCategory: review.issueCategory,
    photos: photos || [],
    status: review.status,
    isFlagged: review.isFlagged,
    reviewerName: formatReviewerAlias(review.user.name, review.user.phone),
    isAuthor: true,
    createdAt: review.createdAt,
    message: inspection.shouldAutoFlag
      ? "Your review was submitted. Note: it was flagged for moderator verification because it contains sensitive details."
      : "Thank you! Your review has been published.",
  });
});
