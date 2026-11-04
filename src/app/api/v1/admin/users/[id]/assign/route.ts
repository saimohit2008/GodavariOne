import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

// POST /api/v1/admin/users/[id]/assign — assign a resource to a user
// Body: { type: "LISTING_OWNER" | "GHAT_REPORTER" | "GHAT_SUPERVISOR" | "CATEGORY_EDITOR" | "BOOKING_REVIEWER", listingId?, category?, district? }
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const schema = z.object({
    type: z.enum(["LISTING_OWNER", "GHAT_SUPERVISOR", "BOOKING_REVIEWER"]),
    listingId: z.string().optional(),
    category: z.string().optional(),
    district: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Validation failed", 422);
  const { type, listingId, category, district } = parsed.data;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return fail("User not found", 404);

  if (type === "LISTING_OWNER" && !listingId) return fail("listingId required for LISTING_OWNER assignment", 400);

  const assignment = await db.assignment.create({
    data: { userId: id, type, listingId: listingId || null, category: category || null, district: district || null },
  });

  // If assigning a business owner, also update the listing's direct ownerId
  if (listingId && type === "LISTING_OWNER") {
    await db.listing.update({
      where: { id: listingId },
      data: { ownerId: id },
    });
  }

  // If assigning a ghat supervisor, also set the listing's ghat supervisor
  if (listingId && type === "GHAT_SUPERVISOR") {
    await db.ghatDetails.upsert({
      where: { listingId },
      create: { listingId, supervisorId: type === "GHAT_SUPERVISOR" ? id : null },
      update: type === "GHAT_SUPERVISOR" ? { supervisorId: id } : {},
    });
  }

  await audit({
    actorId: ctx.user.id,
    action: "USER_ASSIGN",
    targetType: "USER",
    targetId: id,
    details: { type, listingId, category, district },
    ip: getClientIp(req),
  });

  return ok({ assignment });
});

// GET /api/v1/admin/users/[id]/assign — list assignments
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);
  const assignments = await db.assignment.findMany({
    where: { userId: id },
    include: { listing: { select: { id: true, name: true, category: true } } },
  });
  return ok({ items: assignments });
});

// DELETE /api/v1/admin/users/[id]/assign — remove an assignment
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");
  if (!assignmentId) return fail("assignmentId query parameter required", 400);

  const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return fail("Assignment not found", 404);
  if (assignment.userId !== id) return fail("Assignment does not belong to this user", 400);

  // If this assignment was LISTING_OWNER, clear ownerId from listing if it still points to this user
  if (assignment.type === "LISTING_OWNER" && assignment.listingId) {
    await db.listing.updateMany({
      where: { id: assignment.listingId, ownerId: id },
      data: { ownerId: null },
    });
  }

  // If this assignment was GHAT_SUPERVISOR, clear supervisorId from ghatDetails if it still points to this user
  if (assignment.type === "GHAT_SUPERVISOR" && assignment.listingId) {
    await db.ghatDetails.updateMany({
      where: { listingId: assignment.listingId, supervisorId: id },
      data: { supervisorId: null },
    });
  }

  await db.assignment.delete({ where: { id: assignmentId } });

  await audit({
    actorId: ctx.user.id,
    action: "USER_UNASSIGN",
    targetType: "USER",
    targetId: id,
    details: { assignmentId, type: assignment.type, listingId: assignment.listingId },
    ip: getClientIp(req),
  });

  return ok({ ok: true, removed: true });
});
