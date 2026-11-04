import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";
import { canManageHotel } from "@/lib/hotel-auth";

// GET /api/v1/hotels/[id]/inventory — comprehensive staff room and capacity overview
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const auth = await canManageHotel(ctx.user.id, ctx.user.role, id);
  if (!auth.allowed) {
    return fail(auth.reason || "Insufficient permissions", 403);
  }

  const { searchParams } = new URL(req.url);
  const filterDate = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const roomIdFilter = searchParams.get("roomId") || undefined;
  const statusFilter = searchParams.get("status") || undefined;

  const hotel = await db.listing.findUnique({
    where: { id },
    include: {
      hotelRooms: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      },
    },
  });

  if (!hotel || hotel.category !== "HOTEL") {
    return fail("Hotel not found", 404);
  }

  // Get all bookings for this hotel
  const bookingWhere: Record<string, unknown> = { listingId: id };
  if (roomIdFilter) bookingWhere.roomId = roomIdFilter;
  if (statusFilter) bookingWhere.status = statusFilter;

  const bookings = await db.hotelBooking.findMany({
    where: bookingWhere,
    include: {
      room: { select: { id: true, name: true, roomIdentifier: true } },
      user: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Calculate current date inventory metrics
  const totalCapacityRooms = hotel.hotelRooms.reduce((acc, r) => acc + (r.isActive ? r.totalRooms : 0), 0);

  // Active bookings overlapping with filterDate
  const activeBookings = bookings.filter(
    (b) =>
      ["PENDING", "APPROVED"].includes(b.status) &&
      b.checkIn <= filterDate &&
      b.checkOut > filterDate
  );

  const occupiedRooms = activeBookings.filter((b) => b.status === "APPROVED").reduce((s, b) => s + b.rooms, 0);
  const reservedRooms = activeBookings.filter((b) => b.status === "PENDING").reduce((s, b) => s + b.rooms, 0);
  const totalBooked = occupiedRooms + reservedRooms;
  const availableRooms = Math.max(0, totalCapacityRooms - totalBooked);

  // Per-room type inventory breakdown
  const roomBreakdowns = hotel.hotelRooms.map((room) => {
    const roomActiveBookings = activeBookings.filter((b) => b.roomId === room.id);
    const roomOccupied = roomActiveBookings.filter((b) => b.status === "APPROVED").reduce((s, b) => s + b.rooms, 0);
    const roomReserved = roomActiveBookings.filter((b) => b.status === "PENDING").reduce((s, b) => s + b.rooms, 0);
    const roomTotalBooked = roomOccupied + roomReserved;
    const roomAvailable = Math.max(0, room.totalRooms - roomTotalBooked);

    return {
      roomId: room.id,
      name: room.name,
      roomIdentifier: room.roomIdentifier,
      isActive: room.isActive,
      totalRooms: room.totalRooms,
      occupiedRooms: roomOccupied,
      reservedRooms: roomReserved,
      availableRooms: roomAvailable,
      basePrice: room.basePrice,
      maxGuests: room.maxGuests,
      maxAdults: room.maxAdults,
      maxChildren: room.maxChildren,
    };
  });

  // Upcoming check-ins and check-outs for today and next 7 days
  const today = new Date().toISOString().slice(0, 10);
  const upcomingCheckIns = bookings.filter(
    (b) => ["PENDING", "APPROVED"].includes(b.status) && b.checkIn >= today
  ).slice(0, 10);

  const upcomingCheckOuts = bookings.filter(
    (b) => ["PENDING", "APPROVED"].includes(b.status) && b.checkOut >= today
  ).slice(0, 10);

  return ok({
    hotelId: id,
    hotelName: hotel.name,
    filterDate,
    summary: {
      totalCapacityRooms,
      occupiedRooms,
      reservedRooms,
      availableRooms,
      occupancyRate: totalCapacityRooms > 0 ? Math.round((totalBooked / totalCapacityRooms) * 100) : 0,
    },
    roomBreakdowns,
    upcomingCheckIns,
    upcomingCheckOuts,
    recentBookings: bookings.slice(0, 50),
  });
});
