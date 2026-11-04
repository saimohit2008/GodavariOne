import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

const updateItinerarySchema = z.object({
  dayNumber: z.number().int().min(1).optional(),
  date: z.string().min(8).optional(),
  timeSlot: z.string().optional().nullable(),
  activityTitle: z.string().min(2).optional(),
  location: z.string().optional().nullable(),
  accommodationDetails: z.string().optional().nullable(),
  transportDetails: z.string().optional().nullable(),
  assignedProvider: z.string().optional().nullable(),
  bookingConfirmationCode: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  visitorNotes: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "RESCHEDULED", "CANCELLED"]).optional(),
});

// PATCH /api/v1/nri/requests/[id]/itinerary/[itemId]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
  const { id, itemId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({ where: { id } });
  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isManager) {
    return fail("Unauthorized to update itinerary for this trip", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = updateItinerarySchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const updated = await db.nriTripItineraryItem.update({
    where: { id: itemId },
    data: parsed.data,
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_ITINERARY_ITEM_UPDATE",
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: id,
    details: { itemId, changes: parsed.data },
    ip: getClientIp(req),
  });

  return ok({ item: updated });
});

// DELETE /api/v1/nri/requests/[id]/itinerary/[itemId]
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
  const { id, itemId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({ where: { id } });
  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isManager) {
    return fail("Unauthorized to delete itinerary for this trip", 403);
  }

  await db.nriTripItineraryItem.delete({ where: { id: itemId } });

  return ok({ ok: true, message: "Itinerary item deleted" });
});
