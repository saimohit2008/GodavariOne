import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { getStorage, UPLOAD_LIMITS } from "@/lib/storage";
import { canManageListings } from "@/lib/constants";

// POST /api/v1/images?listingId=...&primary=true
// multipart/form-data: files[]
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canManageListings(ctx.user.role as any)) return fail("Insufficient permissions", 403);

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  const makePrimary = searchParams.get("primary") === "true";
  if (!listingId) return fail("listingId is required", 400);

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) return fail("Listing not found", 404);
  if (ctx.user.role === "BUSINESS_OWNER" && listing.ownerId !== ctx.user.id) {
    return fail("You can only upload images for listings you own", 403);
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail("No files uploaded", 400);

  const existingCount = await db.listingImage.count({ where: { listingId } });
  if (existingCount + files.length > UPLOAD_LIMITS.maxGallery) {
    return fail(`Maximum ${UPLOAD_LIMITS.maxGallery} images per listing.`, 400);
  }

  const storage = getStorage();
  const saved: any[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const savedFile = await storage.save(buf, file.name, file.type);
    const img = await db.listingImage.create({
      data: {
        listingId,
        url: savedFile.url,
        filename: savedFile.filename,
        mimeType: savedFile.mimeType,
        sizeBytes: savedFile.sizeBytes,
        isPrimary: false,
        orderIdx: existingCount + saved.length,
      },
    });
    saved.push(img);
  }

  if (makePrimary && saved.length > 0) {
    await db.listingImage.updateMany({ where: { listingId, id: { not: saved[0].id } }, data: { isPrimary: false } });
    await db.listingImage.update({ where: { id: saved[0].id }, data: { isPrimary: true } });
    saved[0].isPrimary = true;
  } else if (existingCount === 0 && saved.length > 0) {
    await db.listingImage.update({ where: { id: saved[0].id }, data: { isPrimary: true } });
    saved[0].isPrimary = true;
  }

  await audit({
    actorId: ctx.user.id,
    action: "IMAGE_UPLOAD",
    targetType: "LISTING",
    targetId: listingId,
    details: { count: saved.length },
    ip: getClientIp(req),
  });

  return created({ images: saved });
});
