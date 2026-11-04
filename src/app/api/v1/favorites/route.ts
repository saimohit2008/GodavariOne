import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, created, fail, handler } from "@/lib/validation";

// GET /api/v1/favorites — current user's favorites
export const GET = handler(async () => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  const items = await db.favorite.findMany({
    where: { userId: ctx.user.id },
    include: { listing: { include: { images: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok({ items: items.map((f) => f.listing) });
});

// POST /api/v1/favorites body { listingId }
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  const body = await req.json().catch(() => null);
  if (!body?.listingId) return fail("listingId required", 400);
  const fav = await db.favorite.create({ data: { userId: ctx.user.id, listingId: body.listingId } }).catch(() => null);
  if (!fav) return ok({ ok: true, existed: true });
  return created({ ok: true });
});

// DELETE /api/v1/favorites?listingId=...
export const DELETE = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  if (!listingId) return fail("listingId required", 400);
  await db.favorite.deleteMany({ where: { userId: ctx.user.id, listingId } });
  return ok({ ok: true });
});
