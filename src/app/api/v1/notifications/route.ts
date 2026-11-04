import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";

// GET /api/v1/notifications — current user's notifications
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const where: Record<string, unknown> = { userId: ctx.user.id };
  if (unreadOnly) where.read = false;
  const items = await db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = await db.notification.count({ where: { userId: ctx.user.id, read: false } });
  return ok({ items, unread });
});

// PATCH /api/v1/notifications  body: { id?: string, all?: true }
export const PATCH = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  const body = await req.json().catch(() => ({}));
  if (body?.all) {
    await db.notification.updateMany({ where: { userId: ctx.user.id, read: false }, data: { read: true } });
    return ok({ ok: true, all: true });
  }
  if (body?.id) {
    await db.notification.updateMany({ where: { id: body.id, userId: ctx.user.id }, data: { read: true } });
    return ok({ ok: true });
  }
  return fail("Provide id or all=true", 400);
});
