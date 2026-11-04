import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { canManageGhatPriorityBookings } from "@/lib/priority-booking";
import { z } from "zod";

// GET /api/v1/ghats/[id]/slots — List priority booking time slots for a ghat
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || undefined;
  const status = url.searchParams.get("status") || undefined;

  const whereClause: any = { ghatId: id };
  if (date) whereClause.slotDate = date;
  if (status) whereClause.status = status;

  const slots = await db.ghatTimeSlot.findMany({
    where: whereClause,
    orderBy: [
      { slotDate: "asc" },
      { startTime: "asc" },
    ],
  });

  return ok({ items: slots });
});

// POST /api/v1/ghats/[id]/slots — Create a new time slot
// Authorized for: Super Admin or assigned Ghat Supervisor
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAuthorized = await canManageGhatPriorityBookings(ctx.user.id, role, id);

  if (!isSuperAdmin && !isAuthorized) {
    return fail("Access denied. You are not authorized to create time slots for this ghat.", 403);
  }

  // Verify ghat exists
  const ghat = await db.listing.findUnique({
    where: { id },
  });

  if (!ghat || ghat.category !== "GHAT") {
    return fail("Ghat listing not found.", 404);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload.", 400);

  const schema = z.object({
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "slotDate must be YYYY-MM-DD"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM"),
    maxCapacity: z.number().int().min(1).max(1000).default(50),
    accessibilityNotes: z.string().optional(),
    maxAccompanying: z.number().int().min(0).max(2).default(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Validation failed", 422);
  }

  const { slotDate, startTime, endTime, maxCapacity, accessibilityNotes, maxAccompanying } = parsed.data;

  const slot = await db.ghatTimeSlot.create({
    data: {
      ghatId: id,
      slotDate,
      startTime,
      endTime,
      maxCapacity,
      allocatedCount: 0,
      status: "ACTIVE",
      accessibilityNotes: accessibilityNotes?.trim() || null,
      maxAccompanying,
      createdById: ctx.user.id,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "GHAT_TIME_SLOT_CREATE",
    targetType: "GHAT_TIME_SLOT",
    targetId: slot.id,
    details: {
      ghatId: id,
      slotDate,
      startTime,
      endTime,
      maxCapacity,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    slot,
  });
});
