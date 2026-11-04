import { db } from "./db";

// Helper to verify hotel room management authorization
// Super Admin can manage all hotels
// Business Owners can manage hotels they own
// Staff assigned to the hotel can manage their assigned hotel
// Booking Reviewers can review bookings, but CANNOT manage room inventory
export async function canManageHotel(
  userId: string,
  userRole: string,
  hotelId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (userRole === "SUPER_ADMIN") {
    return { allowed: true };
  }

  // Booking Reviewer explicitly excluded from room inventory management
  if (userRole === "BOOKING_REVIEWER") {
    return {
      allowed: false,
      reason: "Booking Reviewers have review permissions but cannot manage room inventory",
    };
  }

  if (userRole === "VISITOR") {
    return { allowed: false, reason: "Visitors cannot manage hotel inventory" };
  }

  const hotel = await db.listing.findUnique({
    where: { id: hotelId },
    select: { id: true, category: true, ownerId: true },
  });

  if (!hotel || hotel.category !== "HOTEL") {
    return { allowed: false, reason: "Hotel listing not found" };
  }

  if (userRole === "BUSINESS_OWNER" && hotel.ownerId === userId) {
    return { allowed: true };
  }

  // Check assignments (HOTEL_STAFF, LISTING_OWNER)
  const assignment = await db.assignment.findFirst({
    where: {
      userId,
      listingId: hotelId,
      type: { in: ["HOTEL_STAFF", "LISTING_OWNER"] },
    },
  });

  if (assignment) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "You are not authorized to manage rooms for this hotel",
  };
}
