import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { canPublishListings } from "@/lib/constants";

// POST /api/v1/listings/[id]/publish — authorized publication transition
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canPublishListings(ctx.user.role as any)) return fail("Insufficient permissions to publish", 403);

  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) return fail("Listing not found", 404);

  // Backend: a listing cannot be published without a verified location
  if (!listing.locationVerified) {
    return fail("Listing cannot be published without a verified location (valid coordinates or Maps URL)", 422);
  }

  const updated = await db.listing.update({
    where: { id },
    data: {
      publicationStatus: "PUBLISHED",
      verificationStatus: "VERIFIED",
      verifiedById: ctx.user.id,
      verifiedAt: new Date(),
      rejectionReason: null,
    },
    include: { images: true, restaurantDetails: true, hotelDetails: true, ghatDetails: true, hospitalDetails: true, transportDetails: true, touristDetails: true },
  });

  await audit({
    actorId: ctx.user.id,
    action: "LISTING_PUBLISH",
    targetType: "LISTING",
    targetId: id,
    ip: getClientIp(req),
  });

  // Notify owner if exists
  if (listing.ownerId && listing.ownerId !== ctx.user.id) {
    await db.notification.create({
      data: {
        userId: listing.ownerId,
        type: "LISTING_PUBLISHED",
        title: "Listing published",
        message: `Your listing "${listing.name}" is now published.`,
        link: `listing:${id}`,
      },
    });
  }

  return ok({ ok: true, listing: updated });
});
