import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";

// GET /api/v1/stats — admin overview stats
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const [
    totalUsers,
    activeOperational,
    listingCounts,
    pendingRestaurant,
    pendingHotel,
    pendingAccommodation,
    activeAlerts,
    totalCarouselBanners,
    publishedCarouselBanners,
    totalHomepageItems,
    publishedHomepageItems,
    byCategory,
    recentActivity,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: { in: ["GHAT_SUPERVISOR", "BOOKING_REVIEWER", "BUSINESS_OWNER", "PUROHIT", "NRI_SERVICE_MANAGER"] }, status: "ACTIVE" } }),
    db.listing.groupBy({ by: ["publicationStatus"], _count: true }),
    db.restaurantBooking.count({ where: { status: "PENDING" } }),
    db.hotelBooking.count({ where: { status: "PENDING" } }),
    db.freeAccommodationBooking.count({ where: { status: "PENDING" } }),
    db.ghatReport.count({ where: { reviewStatus: { in: ["SUBMITTED", "ESCALATED"] } } }),
    db.carouselBanner.count(),
    db.carouselBanner.count({ where: { isEnabled: true, status: "PUBLISHED" } }),
    db.homepageContentItem.count(),
    db.homepageContentItem.count({ where: { isEnabled: true, status: "PUBLISHED" } }),
    db.listing.groupBy({ by: ["category"], _count: true }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true, role: true } } } }),
  ]);

  let totalListings = 0;
  let publishedListings = 0;
  let pendingListings = 0;
  let suspendedListings = 0;
  for (const item of listingCounts) {
    totalListings += item._count;
    if (item.publicationStatus === "PUBLISHED") publishedListings = item._count;
    else if (item.publicationStatus === "PENDING") pendingListings = item._count;
    else if (item.publicationStatus === "SUSPENDED") suspendedListings = item._count;
  }

  return ok({
    totalUsers,
    activeOperational,
    totalListings,
    publishedListings,
    pendingListings,
    suspendedListings,
    pendingRestaurant,
    pendingHotel,
    pendingAccommodation,
    activeAlerts,
    totalCarouselBanners,
    publishedCarouselBanners,
    totalHomepageItems,
    publishedHomepageItems,
    byCategory,
    recentActivity,
  });
});
