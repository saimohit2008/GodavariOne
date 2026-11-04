import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { getStorage } from "@/lib/storage";
import { canManageListings } from "@/lib/constants";

// DELETE /api/v1/images/[id]
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (!canManageListings(ctx.user.role as any)) return fail("Insufficient permissions", 403);

  const img = await db.listingImage.findUnique({ where: { id }, include: { listing: true } });
  if (!img) return fail("Image not found", 404);

  if (ctx.user.role === "BUSINESS_OWNER" && img.listing.ownerId !== ctx.user.id) {
    return fail("You can only delete images on listings you own", 403);
  }

  // Only delete the file if no OTHER listing image references the same URL.
  const otherRefs = await db.listingImage.count({ where: { url: img.url, id: { not: id } } });
  if (otherRefs === 0) {
    await getStorage().delete(img.url);
  }
  await db.listingImage.delete({ where: { id } });

  // If we removed the primary image, promote the next one
  if (img.isPrimary) {
    const next = await db.listingImage.findFirst({ where: { listingId: img.listingId }, orderBy: { orderIdx: "asc" } });
    if (next) await db.listingImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  await audit({
    actorId: ctx.user.id,
    action: "IMAGE_DELETE",
    targetType: "LISTING",
    targetId: img.listingId,
    ip: getClientIp(req),
  });

  return ok({ ok: true });
});
