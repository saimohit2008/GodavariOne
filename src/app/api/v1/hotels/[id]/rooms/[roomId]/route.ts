import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canManageHotel } from "@/lib/hotel-auth";
import { z } from "zod";

const roomUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  roomIdentifier: z.string().max(50).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  totalRooms: z.number().int().min(1).max(1000).optional(),
  maxAdults: z.number().int().min(1).max(50).optional(),
  maxChildren: z.number().int().min(0).max(50).optional(),
  maxGuests: z.number().int().min(1).max(100).optional(),
  basePrice: z.number().min(0).optional(),
  extraPersonPrice: z.number().min(0).optional(),
  amenities: z.array(z.string()).optional().nullable(),
  bedType: z.string().max(100).optional().nullable(),
  bedCount: z.number().int().min(1).optional(),
  images: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /api/v1/hotels/[id]/rooms/[roomId]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) => {
  const { id, roomId } = await params;
  const room = await db.hotelRoom.findUnique({
    where: { id: roomId },
    include: {
      listing: { select: { id: true, name: true, ownerId: true } },
      bookings: {
        where: { status: { in: ["PENDING", "APPROVED"] } },
        select: { id: true, checkIn: true, checkOut: true, rooms: true, status: true },
      },
    },
  });

  if (!room || room.listingId !== id) {
    return fail("Room type not found for this hotel", 404);
  }

  return ok({
    ...room,
    amenities: room.amenities ? JSON.parse(room.amenities) : [],
    images: room.images ? JSON.parse(room.images) : [],
    activeBookingsCount: room.bookings.length,
  });
});

// PATCH /api/v1/hotels/[id]/rooms/[roomId] — update room details
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) => {
  const { id, roomId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const auth = await canManageHotel(ctx.user.id, ctx.user.role, id);
  if (!auth.allowed) {
    return fail(auth.reason || "Insufficient permissions to manage hotel rooms", 403);
  }

  const room = await db.hotelRoom.findUnique({ where: { id: roomId } });
  if (!room || room.listingId !== id) {
    return fail("Room type not found for this hotel", 404);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = roomUpdateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const data = parsed.data;

  // Capacity validation checks against combined existing + updated values
  const maxAdults = data.maxAdults ?? room.maxAdults;
  const maxChildren = data.maxChildren ?? room.maxChildren;
  const maxGuests = data.maxGuests ?? room.maxGuests;

  if (maxGuests < maxAdults) {
    return fail("Total guest capacity cannot be less than adult capacity limit", 422);
  }
  if (maxGuests > maxAdults + maxChildren) {
    return fail("Total guest capacity cannot exceed the sum of adult and child limits", 422);
  }

  const updated = await db.hotelRoom.update({
    where: { id: roomId },
    data: {
      name: data.name ?? undefined,
      roomIdentifier: data.roomIdentifier !== undefined ? data.roomIdentifier : undefined,
      description: data.description !== undefined ? data.description : undefined,
      totalRooms: data.totalRooms ?? undefined,
      maxAdults: data.maxAdults ?? undefined,
      maxChildren: data.maxChildren ?? undefined,
      maxGuests: data.maxGuests ?? undefined,
      basePrice: data.basePrice ?? undefined,
      extraPersonPrice: data.extraPersonPrice ?? undefined,
      amenities: data.amenities !== undefined ? (data.amenities ? JSON.stringify(data.amenities) : null) : undefined,
      bedType: data.bedType !== undefined ? data.bedType : undefined,
      bedCount: data.bedCount ?? undefined,
      images: data.images !== undefined ? (data.images ? JSON.stringify(data.images) : null) : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
    },
  });

  // Keep total hotel room count updated
  const allRooms = await db.hotelRoom.findMany({ where: { listingId: id, isActive: true } });
  const totalHotelRooms = allRooms.reduce((s, r) => s + r.totalRooms, 0);
  await db.hotelDetails.upsert({
    where: { listingId: id },
    create: { listingId: id, numRooms: totalHotelRooms },
    update: { numRooms: totalHotelRooms },
  }).catch(() => undefined);

  await audit({
    actorId: ctx.user.id,
    action: "HOTEL_ROOM_UPDATE",
    targetType: "HOTEL_ROOM",
    targetId: roomId,
    details: {
      hotelId: id,
      roomName: updated.name,
      totalRooms: updated.totalRooms,
      isActive: updated.isActive,
      basePrice: updated.basePrice,
    },
    ip: getClientIp(req),
  });

  return ok({
    ...updated,
    amenities: updated.amenities ? JSON.parse(updated.amenities) : [],
    images: updated.images ? JSON.parse(updated.images) : [],
  });
});

// DELETE /api/v1/hotels/[id]/rooms/[roomId] — safe deletion or deactivation
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) => {
  const { id, roomId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const auth = await canManageHotel(ctx.user.id, ctx.user.role, id);
  if (!auth.allowed) {
    return fail(auth.reason || "Insufficient permissions to manage hotel rooms", 403);
  }

  const room = await db.hotelRoom.findUnique({
    where: { id: roomId },
    include: {
      bookings: {
        where: { status: { in: ["PENDING", "APPROVED"] } },
      },
    },
  });

  if (!room || room.listingId !== id) {
    return fail("Room type not found for this hotel", 404);
  }

  // If there are existing active bookings, disable instead of deleting to preserve relational integrity
  if (room.bookings.length > 0) {
    await db.hotelRoom.update({
      where: { id: roomId },
      data: { isActive: false },
    });

    await audit({
      actorId: ctx.user.id,
      action: "HOTEL_ROOM_DEACTIVATE",
      targetType: "HOTEL_ROOM",
      targetId: roomId,
      details: {
        hotelId: id,
        reason: "Deactivated because active bookings exist",
        activeBookingsCount: room.bookings.length,
      },
      ip: getClientIp(req),
    });

    return ok({
      ok: true,
      action: "DEACTIVATED",
      message: `Room type has ${room.bookings.length} active booking(s) and has been disabled from new bookings rather than deleted.`,
    });
  }

  // No active bookings: safe hard delete
  await db.hotelRoom.delete({ where: { id: roomId } });

  await audit({
    actorId: ctx.user.id,
    action: "HOTEL_ROOM_DELETE",
    targetType: "HOTEL_ROOM",
    targetId: roomId,
    details: { hotelId: id, roomName: room.name },
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    action: "DELETED",
    message: "Room type deleted successfully.",
  });
});
