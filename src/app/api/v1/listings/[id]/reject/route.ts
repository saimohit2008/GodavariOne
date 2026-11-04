import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { canPublishListings } from "@/lib/constants";

// POST /api/v1/listings/[id]/reject — reject a pending listing with reason
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canPublishListings(ctx.user.role as any)) return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => ({}));
  const reason = (body?.reason as string) || "Listing does not meet publication criteria.";

  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) return fail("Listing not found", 404);

  const updated = await db.listing.update({
    where: { id },
    data: {
      publicationStatus: "REJECTED",
      rejectionReason: reason,
      verifiedById: ctx.user.id,
      verifiedAt: new Date(),
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "LISTING_REJECT",
    targetType: "LISTING",
    targetId: id,
    details: { reason },
    ip: getClientIp(req),
  });

  if (listing.ownerId) {
    await notify({
      userId: listing.ownerId,
      type: "LISTING_REJECTED",
      title: "Listing rejected",
      message: `Your listing "${listing.name}" was rejected. Reason: ${reason}`,
      link: `listing:${id}`,
    });
  }

  return ok({ ok: true, listing: updated });
});
