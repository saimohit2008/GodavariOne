import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";
import { canViewModerationQueue } from "@/lib/review-auth";

// GET /api/v1/admin/reviews — moderation queue for Super Admin, Owners, and Supervisors
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const auth = await canViewModerationQueue(ctx.user.id, ctx.user.role);
  if (!auth.allowed) {
    return fail("You are not authorized to view the review moderation queue", 403);
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const filterParam = searchParams.get("filter");
  const filter = filterParam || (statusParam ? statusParam : "PENDING_REPORTS");
  const category = searchParams.get("category") || undefined;
  const listingId = searchParams.get("listingId") || undefined;

  // Build listing scope filter
  const listingWhere: Record<string, unknown> = {};
  if (!auth.isSuperAdmin && auth.allowedListingIds) {
    listingWhere.id = { in: auth.allowedListingIds };
  }
  if (category) listingWhere.category = category;
  if (listingId) {
    if (listingWhere.id && typeof listingWhere.id === "object" && "in" in (listingWhere.id as any)) {
      if (!(listingWhere.id as { in: string[] }).in.includes(listingId)) {
        return fail("Unauthorized listing filter", 403);
      }
    }
    listingWhere.id = listingId;
  }

  // Count totals for UI badges
  const [totalPendingReports, totalFlaggedReviews] = await Promise.all([
    db.reviewReport.count({
      where: {
        status: "PENDING",
        review: { listing: listingWhere },
      },
    }),
    db.review.count({
      where: {
        isFlagged: true,
        status: "PUBLISHED",
        listing: listingWhere,
      },
    }),
  ]);

  if (filter === "PENDING_REPORTS" || filter === "reports") {
    // Query pending reports
    const reportWhere: Record<string, unknown> = {
      status: "PENDING",
      review: { listing: listingWhere },
    };

    const reports = await db.reviewReport.findMany({
      where: reportWhere,
      include: {
        reporter: { select: { id: true, name: true, phone: true } },
        review: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
            listing: { select: { id: true, name: true, category: true, ownerId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const items = reports.map((rp) => ({
      id: rp.id,
      reportId: rp.id,
      reason: rp.reason,
      details: rp.details,
      status: rp.status,
      reportedAt: rp.createdAt,
      createdAt: rp.createdAt,
      reporter: {
        id: rp.reporter.id,
        name: rp.reporter.name || "User",
        phone: auth.isSuperAdmin ? rp.reporter.phone : undefined,
      },
      review: {
        id: rp.review.id,
        listingId: rp.review.listingId,
        listingName: rp.review.listing.name,
        category: rp.review.listing.category,
        rating: rp.review.rating,
        title: rp.review.title,
        content: rp.review.content,
        issueCategory: rp.review.issueCategory,
        photos: rp.review.photos ? JSON.parse(rp.review.photos) : [],
        status: rp.review.status,
        isFlagged: rp.review.isFlagged,
        flagReason: rp.review.flagReason,
        createdAt: rp.review.createdAt,
        reviewer: {
          id: rp.review.user.id,
          name: rp.review.user.name || "User",
          phone: auth.isSuperAdmin ? rp.review.user.phone : undefined,
        },
      },
    }));

    return ok({
      items,
      reports: items,
      reviews: [],
      totalReports: totalPendingReports,
      totalReviews: totalFlaggedReviews,
      count: items.length,
      filter,
    });
  }

  // Reviews query (FLAGGED, REMOVED, ALL, PUBLISHED, HIDDEN)
  const reviewWhere: Record<string, unknown> = {
    listing: listingWhere,
  };

  if (filter === "FLAGGED") {
    reviewWhere.isFlagged = true;
    reviewWhere.status = "PUBLISHED";
  } else if (filter === "REMOVED") {
    reviewWhere.status = "REMOVED";
  } else if (filter === "HIDDEN") {
    reviewWhere.status = "HIDDEN";
  } else if (filter === "PUBLISHED") {
    reviewWhere.status = "PUBLISHED";
  }

  const reviews = await db.review.findMany({
    where: reviewWhere,
    include: {
      listing: { select: { id: true, name: true, category: true, ownerId: true } },
      user: { select: { id: true, name: true, phone: true } },
      moderator: { select: { id: true, name: true, role: true } },
      reports: {
        include: { reporter: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const items = reviews.map((rev) => ({
    id: rev.id,
    listingId: rev.listingId,
    listingName: rev.listing.name,
    category: rev.listing.category,
    rating: rev.rating,
    title: rev.title,
    content: rev.content,
    issueCategory: rev.issueCategory,
    photos: rev.photos ? JSON.parse(rev.photos) : [],
    status: rev.status,
    isFlagged: rev.isFlagged,
    flagReason: rev.flagReason,
    moderator: rev.moderator ? { id: rev.moderator.id, name: rev.moderator.name, role: rev.moderator.role } : null,
    moderationReason: rev.moderationReason,
    moderatedAt: rev.moderatedAt,
    reportsCount: rev.reports.length,
    reports: rev.reports.map((r) => ({ id: r.id, reason: r.reason, details: r.details, status: r.status, createdAt: r.createdAt })),
    reviewer: {
      id: rev.user.id,
      name: rev.user.name || "User",
      phone: auth.isSuperAdmin ? rev.user.phone : undefined,
    },
    createdAt: rev.createdAt,
    updatedAt: rev.updatedAt,
  }));

  return ok({
    items,
    reviews: items,
    reports: [],
    totalReports: totalPendingReports,
    totalReviews: totalFlaggedReviews,
    count: items.length,
    filter,
  });
});
