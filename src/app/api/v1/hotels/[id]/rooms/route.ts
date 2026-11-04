import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canManageHotel } from "@/lib/hotel-auth";
import { z } from "zod";

const roomInputSchema = z.object({
  name: z.string().min(2, "Room type name must be at least 2 characters").max(100),
  roomIdentifier: z.string().max(50).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  totalRooms: z.number().int().min(1, "Total rooms must be at least 1").max(1000),
  maxAdults: z.number().int().min(1, "Maximum adults must be at least 1").max(50),
  maxChildren: z.number().int().min(0, "Maximum children cannot be negative").max(50).default(0),
  maxGuests: z.number().int().min(1, "Maximum guests must be at least 1").max(100),
  basePrice: z.number().min(0, "Base price cannot be negative"),
  extraPersonPrice: z.number().min(0, "Extra person price cannot be negative").default(0),
  amenities: z.array(z.string()).optional().nullable(),
  bedType: z.string().max(100).optional().nullable(),
  bedCount: z.number().int().min(1, "Bed count must be at least 1").default(1),
  images: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().default(true),
}).refine(
  (data) => data.maxGuests >= data.maxAdults,
  {
    message: "Total guest capacity cannot be less than adult capacity limit",
    path: ["maxGuests"],
  }
).refine(
  (data) => data.maxGuests <= data.maxAdults + data.maxChildren,
  {
    message: "Total guest capacity cannot exceed the sum of adult and child limits",
    path: ["maxGuests"],
  }
);

// GET /api/v1/hotels/[id]/rooms — list room types with real inventory & availability
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  const { searchParams } = new URL(req.url);

  const checkIn = searchParams.get("checkIn") || undefined;
  const checkOut = searchParams.get("checkOut") || undefined;
  const guestsParam = searchParams.get("guests") ? parseInt(searchParams.get("guests")!, 10) : undefined;
  const roomsRequested = Math.max(1, searchParams.get("rooms") ? parseInt(searchParams.get("rooms")!, 10) : 1);

  const hotel = await db.listing.findUnique({
    where: { id },
    include: { hotelDetails: true },
  });

  if (!hotel || hotel.category !== "HOTEL") {
    return fail("Hotel not found", 404);
  }

  // Check if caller is authorized staff/manager
  let isManager = false;
  if (ctx) {
    const auth = await canManageHotel(ctx.user.id, ctx.user.role, id);
    isManager = auth.allowed;
  }

  const whereCondition: Record<string, unknown> = { listingId: id };
  if (!isManager) {
    whereCondition.isActive = true;
  }

  const rooms = await db.hotelRoom.findMany({
    where: whereCondition,
    orderBy: [{ isActive: "desc" }, { basePrice: "asc" }, { createdAt: "asc" }],
  });

  // Calculate live availability if dates are provided
  let nights = 1;
  let hasValidDates = false;
  if (checkIn && checkOut) {
    const cin = new Date(checkIn);
    const cout = new Date(checkOut);
    if (!isNaN(cin.getTime()) && !isNaN(cout.getTime()) && cout > cin) {
      nights = Math.max(1, Math.round((cout.getTime() - cin.getTime()) / (1000 * 60 * 60 * 24)));
      hasValidDates = true;
    }
  }

  let overlappingBookings: any[] = [];
  if (hasValidDates) {
    overlappingBookings = await db.hotelBooking.findMany({
      where: {
        listingId: id,
        status: { in: ["PENDING", "APPROVED"] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: {
        id: true,
        roomId: true,
        rooms: true,
        guests: true,
        status: true,
      },
    });
  }

  const items = rooms.map((room) => {
    let bookedRooms = 0;
    if (hasValidDates) {
      bookedRooms = overlappingBookings
        .filter((b) => b.roomId === room.id)
        .reduce((sum, b) => sum + b.rooms, 0);
    }

    const availableRooms = Math.max(0, room.totalRooms - bookedRooms);
    const capacityOk = !guestsParam || guestsParam <= room.maxGuests * roomsRequested;
    const isAvailable = room.isActive && availableRooms >= roomsRequested && capacityOk;

    // Price calculation
    const baseTotal = nights * roomsRequested * room.basePrice;
    let extraCharges = 0;
    if (guestsParam && guestsParam > roomsRequested * 2) {
      const extraGuests = guestsParam - (roomsRequested * 2);
      extraCharges = extraGuests * room.extraPersonPrice * nights;
    }
    const estimatedTotalPrice = baseTotal + extraCharges;

    return {
      id: room.id,
      listingId: room.listingId,
      name: room.name,
      roomIdentifier: room.roomIdentifier,
      description: room.description,
      totalRooms: room.totalRooms,
      bookedRooms: hasValidDates ? bookedRooms : undefined,
      availableRooms: hasValidDates ? availableRooms : room.totalRooms,
      isAvailable: hasValidDates ? isAvailable : room.isActive,
      maxAdults: room.maxAdults,
      maxChildren: room.maxChildren,
      maxGuests: room.maxGuests,
      basePrice: room.basePrice,
      extraPersonPrice: room.extraPersonPrice,
      amenities: room.amenities ? JSON.parse(room.amenities) : [],
      bedType: room.bedType,
      bedCount: room.bedCount,
      images: room.images ? JSON.parse(room.images) : [],
      isActive: room.isActive,
      nights: hasValidDates ? nights : 1,
      estimatedTotalPrice: hasValidDates ? estimatedTotalPrice : room.basePrice,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  });

  return ok({
    hotelId: id,
    hotelName: hotel.name,
    checkInTime: hotel.hotelDetails?.checkInTime || "12:00",
    checkOutTime: hotel.hotelDetails?.checkOutTime || "11:00",
    hasValidDates,
    nights: hasValidDates ? nights : undefined,
    items,
    isManager,
  });
});

// POST /api/v1/hotels/[id]/rooms — create new room type (Staff/Admin)
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const auth = await canManageHotel(ctx.user.id, ctx.user.role, id);
  if (!auth.allowed) {
    return fail(auth.reason || "Insufficient permissions to manage hotel rooms", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = roomInputSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const data = parsed.data;

  const room = await db.hotelRoom.create({
    data: {
      listingId: id,
      name: data.name,
      roomIdentifier: data.roomIdentifier || null,
      description: data.description || null,
      totalRooms: data.totalRooms,
      maxAdults: data.maxAdults,
      maxChildren: data.maxChildren,
      maxGuests: data.maxGuests,
      basePrice: data.basePrice,
      extraPersonPrice: data.extraPersonPrice,
      amenities: data.amenities ? JSON.stringify(data.amenities) : null,
      bedType: data.bedType || null,
      bedCount: data.bedCount,
      images: data.images ? JSON.stringify(data.images) : null,
      isActive: data.isActive,
    },
  });

  // Also update total room count on hotel details if applicable
  const allRooms = await db.hotelRoom.findMany({ where: { listingId: id, isActive: true } });
  const totalHotelRooms = allRooms.reduce((s, r) => s + r.totalRooms, 0);
  await db.hotelDetails.upsert({
    where: { listingId: id },
    create: { listingId: id, numRooms: totalHotelRooms },
    update: { numRooms: totalHotelRooms },
  }).catch(() => undefined);

  await audit({
    actorId: ctx.user.id,
    action: "HOTEL_ROOM_CREATE",
    targetType: "HOTEL_ROOM",
    targetId: room.id,
    details: {
      hotelId: id,
      roomName: room.name,
      totalRooms: room.totalRooms,
      basePrice: room.basePrice,
      maxGuests: room.maxGuests,
    },
    ip: getClientIp(req),
  });

  return created({
    ...room,
    amenities: data.amenities || [],
    images: data.images || [],
  });
});
