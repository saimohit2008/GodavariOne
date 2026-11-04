import { NextRequest } from "next/server";
import { db, isPostgresDatabase } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import {
  ok,
  fail,
  handler,
  listingSchema,
  zodError,
  serializeListing,
  isValidLat,
  isValidLng,
  isSafeUrl,
  getClientIp,
} from "@/lib/validation";
import { canManageListings, canPublishListings } from "@/lib/constants";

// GET /api/v1/listings/[id]
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(_req);
  const isPg = isPostgresDatabase();
  const queryOptions: any = {
    where: { id },
    include: {
      images: {
        select: { id: true, url: true, isPrimary: true, orderIdx: true },
        orderBy: { orderIdx: "asc" },
      },
      restaurantDetails: true,
      hotelDetails: true,
      hotelRooms: true,
      schedule: true,
      ghatDetails: true,
      hospitalDetails: true,
      transportDetails: true,
      touristDetails: true,
      freeAccommodationDetails: true,
      annadanamDetails: true,
      ghatReports: { orderBy: { createdAt: "desc" }, take: 10, include: { reporter: true } },
    },
  };
  if (isPg) {
    queryOptions.relationLoadStrategy = "join";
  }
  const listing = await db.listing.findUnique(queryOptions);
  if (!listing) return fail("Listing not found", 404);

  // Visibility: only published for visitors; owners/editors/admins see their scope
  if (listing.publicationStatus !== "PUBLISHED") {
    if (!ctx) return fail("Listing not found", 404);
    const role = ctx.user.role;
    const allowed =
      role === "SUPER_ADMIN" ||
      (role === "BUSINESS_OWNER" && listing.ownerId === ctx.user.id);
    if (!allowed) return fail("Listing not found", 404);
  }

  return ok(serializeListing(listing));
});

// PUT /api/v1/listings/[id]
export const PUT = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canManageListings(ctx.user.role as any)) return fail("Insufficient permissions", 403);

  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) return fail("Listing not found", 404);

  // Owner isolation: business owners may only edit their own listings
  if (ctx.user.role === "BUSINESS_OWNER" && listing.ownerId !== ctx.user.id) {
    return fail("You can only edit listings you own", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const parsed = listingSchema.partial().safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const input = parsed.data;

  if (input.latitude != null && !isValidLat(input.latitude)) return fail("Invalid latitude", 422);
  if (input.longitude != null && !isValidLng(input.longitude)) return fail("Invalid longitude", 422);
  if (input.mapsUrl != null && input.mapsUrl !== "" && !isSafeUrl(input.mapsUrl)) return fail("Invalid mapsUrl", 422);

  const lat = input.latitude ?? listing.latitude;
  const lng = input.longitude ?? listing.longitude;
  const maps = input.mapsUrl ?? listing.mapsUrl;
  const locationVerified =
    (lat != null && lng != null && isValidLat(lat) && isValidLng(lng)) ||
    (typeof maps === "string" && maps !== "" && isSafeUrl(maps));

  // Publication transition authorization
  let pubStatus = input.publicationStatus ?? listing.publicationStatus;
  if (pubStatus === "PUBLISHED" && !canPublishListings(ctx.user.role as any)) {
    pubStatus = "PENDING";
  }
  if (pubStatus === "PUBLISHED" && !locationVerified) pubStatus = "PENDING";

  const updated = await db.listing.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      description: input.description,
      address: input.address,
      district: input.district,
      town: input.town,
      locality: input.locality,
      phone: input.phone,
      email: input.email,
      latitude: input.latitude,
      longitude: input.longitude,
      mapsUrl: input.mapsUrl,
      locationVerified,
      accessibility: input.accessibility ? JSON.stringify(input.accessibility) : undefined,
      facilities: input.facilities ? JSON.stringify(input.facilities) : undefined,
      publicationStatus: pubStatus,
    },
    include: {
      images: true,
      restaurantDetails: true,
      hotelDetails: true,
      hotelRooms: true,
      schedule: true,
      ghatDetails: true,
      hospitalDetails: true,
      transportDetails: true,
      touristDetails: true,
      freeAccommodationDetails: true,
      annadanamDetails: true,
    },
  });

  // Sync category-specific details
  if (input.restaurant) {
    await db.restaurantDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        cuisine: input.restaurant.cuisine || null,
        foodType: input.restaurant.foodType || null,
        priceRange: input.restaurant.priceRange || null,
        openingHours: input.restaurant.openingHours || null,
        tableCapacity: input.restaurant.tableCapacity ?? null,
        reservationAvailable: input.restaurant.reservationAvailable ?? true,
        seatingAccessibility: input.restaurant.seatingAccessibility || null,
      },
      update: {
        cuisine: input.restaurant.cuisine || null,
        foodType: input.restaurant.foodType || null,
        priceRange: input.restaurant.priceRange || null,
        openingHours: input.restaurant.openingHours || null,
        tableCapacity: input.restaurant.tableCapacity ?? null,
        reservationAvailable: input.restaurant.reservationAvailable ?? true,
        seatingAccessibility: input.restaurant.seatingAccessibility || null,
      },
    });
  }
  if (input.hotel) {
    await db.hotelDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        accommodationType: input.hotel.accommodationType || null,
        roomTypes: input.hotel.roomTypes || null,
        numRooms: input.hotel.numRooms ?? null,
        roomCapacity: input.hotel.roomCapacity ?? null,
        checkInTime: input.hotel.checkInTime || null,
        checkOutTime: input.hotel.checkOutTime || null,
        amenities: input.hotel.amenities || null,
        priceRange: input.hotel.priceRange || null,
        bookingContact: input.hotel.bookingContact || null,
      },
      update: {
        accommodationType: input.hotel.accommodationType || null,
        roomTypes: input.hotel.roomTypes || null,
        numRooms: input.hotel.numRooms ?? null,
        roomCapacity: input.hotel.roomCapacity ?? null,
        checkInTime: input.hotel.checkInTime || null,
        checkOutTime: input.hotel.checkOutTime || null,
        amenities: input.hotel.amenities || null,
        priceRange: input.hotel.priceRange || null,
        bookingContact: input.hotel.bookingContact || null,
      },
    });
  }
  if (input.ghat) {
    await db.ghatDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        accessRoutes: input.ghat.accessRoutes || null,
        facilities: input.ghat.facilities || null,
        accessibility: input.ghat.accessibility || null,
        medicalAssistance: input.ghat.medicalAssistance || null,
      },
      update: {
        accessRoutes: input.ghat.accessRoutes || null,
        facilities: input.ghat.facilities || null,
        accessibility: input.ghat.accessibility || null,
        medicalAssistance: input.ghat.medicalAssistance || null,
      },
    });
  }
  if (input.hospital) {
    await db.hospitalDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        facilityType: input.hospital.facilityType || null,
        emergencyAvailable: input.hospital.emergencyAvailable ?? false,
        services: input.hospital.services || null,
        operatingHours: input.hospital.operatingHours || null,
      },
      update: {
        facilityType: input.hospital.facilityType || null,
        emergencyAvailable: input.hospital.emergencyAvailable ?? false,
        services: input.hospital.services || null,
        operatingHours: input.hospital.operatingHours || null,
      },
    });
  }
  if (input.transport) {
    await db.transportDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        transportType: input.transport.transportType || null,
        serviceAreas: input.transport.serviceAreas || null,
        vehicleDetails: input.transport.vehicleDetails || null,
        pricing: input.transport.pricing || null,
        driverOption: input.transport.driverOption ?? false,
      },
      update: {
        transportType: input.transport.transportType || null,
        serviceAreas: input.transport.serviceAreas || null,
        vehicleDetails: input.transport.vehicleDetails || null,
        pricing: input.transport.pricing || null,
        driverOption: input.transport.driverOption ?? false,
      },
    });
  }
  if (input.tourist) {
    await db.touristDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        openingHours: input.tourist.openingHours || null,
        entryFee: input.tourist.entryFee || null,
        facilities: input.tourist.facilities || null,
        accessibility: input.tourist.accessibility || null,
        directions: input.tourist.directions || null,
      },
      update: {
        openingHours: input.tourist.openingHours || null,
        entryFee: input.tourist.entryFee || null,
        facilities: input.tourist.facilities || null,
        accessibility: input.tourist.accessibility || null,
        directions: input.tourist.directions || null,
      },
    });
  }

  if (input.freeAccommodation) {
    const freeAccData = {
      accommodationType: input.freeAccommodation.accommodationType || null,
      availableTypes: input.freeAccommodation.availableTypes ? (typeof input.freeAccommodation.availableTypes === "string" ? input.freeAccommodation.availableTypes : JSON.stringify(input.freeAccommodation.availableTypes)) : null,
      totalCapacity: input.freeAccommodation.totalCapacity ?? null,
      availableCapacity: input.freeAccommodation.availableCapacity ?? null,
      capacityMen: input.freeAccommodation.capacityMen ?? null,
      availableMen: input.freeAccommodation.availableMen ?? null,
      capacityWomen: input.freeAccommodation.capacityWomen ?? null,
      availableWomen: input.freeAccommodation.availableWomen ?? null,
      capacityFamily: input.freeAccommodation.capacityFamily ?? null,
      availableFamily: input.freeAccommodation.availableFamily ?? null,
      checkInTime: input.freeAccommodation.checkInTime || null,
      checkOutTime: input.freeAccommodation.checkOutTime || null,
      maxStayDays: input.freeAccommodation.maxStayDays ?? 3,
      rules: input.freeAccommodation.rules || null,
      eligibilityCriteria: input.freeAccommodation.eligibilityCriteria || null,
      amenities: input.freeAccommodation.amenities ? (typeof input.freeAccommodation.amenities === "string" ? input.freeAccommodation.amenities : JSON.stringify(input.freeAccommodation.amenities)) : null,
      requiresRegistration: input.freeAccommodation.requiresRegistration ?? false,
      registrationUrl: input.freeAccommodation.registrationUrl || null,
      registrationContact: input.freeAccommodation.registrationContact || null,
      isTemporarilyUnavailable: input.freeAccommodation.isTemporarilyUnavailable ?? false,
      availabilityStatus: input.freeAccommodation.availabilityStatus || "AVAILABLE",
      lastAvailabilityUpdate: new Date(),
      updatedById: ctx.user.id,
    };
    await db.freeAccommodationDetails.upsert({
      where: { listingId: id },
      create: { listingId: id, ...freeAccData },
      update: freeAccData,
    });
  }
  if (input.annadanam) {
    const annadanamData = {
      organizationName: input.annadanam.organizationName || null,
      distributionType: input.annadanam.distributionType || "ALL",
      dietaryInfo: input.annadanam.dietaryInfo || "PURE_VEG",
      servingStatus: input.annadanam.servingStatus || "ACTIVE",
      sessions: input.annadanam.sessions ? (typeof input.annadanam.sessions === "string" ? input.annadanam.sessions : JSON.stringify(input.annadanam.sessions)) : null,
      seatingCapacity: input.annadanam.seatingCapacity ?? null,
      queueWaitMinutes: input.annadanam.queueWaitMinutes ?? null,
      remainingServings: input.annadanam.remainingServings ?? null,
      eligibilityRules: input.annadanam.eligibilityRules || null,
      specialDates: input.annadanam.specialDates || null,
      lastStatusUpdate: new Date(),
      updatedById: ctx.user.id,
    };
    await db.annadanamDetails.upsert({
      where: { listingId: id },
      create: { listingId: id, ...annadanamData },
      update: annadanamData,
    });
  }

  const refreshed = await db.listing.findUnique({
    where: { id },
    include: {
      images: true,
      restaurantDetails: true,
      hotelDetails: true,
      ghatDetails: true,
      hospitalDetails: true,
      transportDetails: true,
      touristDetails: true,
      freeAccommodationDetails: true,
      annadanamDetails: true,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "LISTING_UPDATE",
    targetType: "LISTING",
    targetId: id,
    details: { name: refreshed?.name, publicationStatus: pubStatus },
    ip: getClientIp(req),
  });

  return ok(serializeListing(refreshed!));
});

// PATCH /api/v1/listings/[id] — partial status update or ownership transfer
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canManageListings(ctx.user.role as any)) return fail("Insufficient permissions", 403);

  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) return fail("Listing not found", 404);

  if (ctx.user.role === "BUSINESS_OWNER" && listing.ownerId !== ctx.user.id) {
    return fail("You can only update listings you own", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const data: Record<string, unknown> = {};
  if (body.publicationStatus) {
    if (body.publicationStatus === "PUBLISHED" && !canPublishListings(ctx.user.role as any)) {
      return fail("Insufficient permissions to publish listings", 403);
    }
    data.publicationStatus = body.publicationStatus;
  }
  if (body.verificationStatus) {
    if (ctx.user.role !== "SUPER_ADMIN") {
      return fail("Only Super Admin can verify listings", 403);
    }
    data.verificationStatus = body.verificationStatus;
    data.verifiedById = ctx.user.id;
    data.verifiedAt = new Date();
  }
  if (body.rejectionReason !== undefined) {
    data.rejectionReason = body.rejectionReason || null;
  }
  if (body.ownerId !== undefined) {
    if (ctx.user.role !== "SUPER_ADMIN") {
      return fail("Only Super Admin can assign or transfer listing ownership", 403);
    }
    data.ownerId = body.ownerId || null;
  }

  const updated = await db.listing.update({
    where: { id },
    data,
    include: {
      images: true,
      owner: { select: { id: true, name: true, phone: true, email: true } },
      restaurantDetails: true,
      hotelDetails: true,
      ghatDetails: true,
      hospitalDetails: true,
      transportDetails: true,
      touristDetails: true,
      freeAccommodationDetails: true,
      annadanamDetails: true,
    },
  });

  // If ownership changed, ensure Assignment record is synced
  if (body.ownerId !== undefined) {
    if (body.ownerId) {
      const existingAssign = await db.assignment.findFirst({
        where: { listingId: id, type: "LISTING_OWNER" },
      });
      if (existingAssign) {
        await db.assignment.update({
          where: { id: existingAssign.id },
          data: { userId: body.ownerId },
        });
      } else {
        await db.assignment.create({
          data: { userId: body.ownerId, type: "LISTING_OWNER", listingId: id },
        });
      }
    } else {
      await db.assignment.deleteMany({
        where: { listingId: id, type: "LISTING_OWNER" },
      });
    }
  }

  await audit({
    actorId: ctx.user.id,
    action: "LISTING_PATCH",
    targetType: "LISTING",
    targetId: id,
    details: body,
    ip: getClientIp(req),
  });

  return ok(serializeListing(updated));
});

// DELETE /api/v1/listings/[id] — SuperAdmin, Editor, or Owner
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canManageListings(ctx.user.role as any)) return fail("Insufficient permissions", 403);

  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) return fail("Listing not found", 404);

  if (ctx.user.role === "BUSINESS_OWNER" && listing.ownerId !== ctx.user.id) {
    return fail("You can only delete listings you own", 403);
  }

  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get("permanent") === "true" || searchParams.get("hard") === "true";

  // Permanent deletion when explicitly requested or if already archived
  if (permanent || listing.publicationStatus === "ARCHIVED") {
    // Check if there are active approved bookings that should prevent accidental hard delete
    const activeBookings = await db.restaurantBooking.count({
      where: { listingId: id, status: { in: ["PENDING", "APPROVED"] } },
    });
    const activeHotelBookings = await db.hotelBooking.count({
      where: { listingId: id, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (activeBookings > 0 || activeHotelBookings > 0) {
      return fail("Cannot permanently delete listing with active pending or approved bookings. Please cancel or resolve bookings first.", 409);
    }

    await db.listing.delete({ where: { id } });
    await audit({
      actorId: ctx.user.id,
      action: "LISTING_DELETE",
      targetType: "LISTING",
      targetId: id,
      details: { name: listing.name, permanent: true },
      ip: getClientIp(req),
    });
    return ok({ ok: true, deleted: true, permanent: true });
  }

  // Soft-delete / archive to preserve audit trail
  await db.listing.update({ where: { id }, data: { publicationStatus: "ARCHIVED" } });
  await audit({
    actorId: ctx.user.id,
    action: "LISTING_ARCHIVE",
    targetType: "LISTING",
    targetId: id,
    details: { name: listing.name },
    ip: getClientIp(req),
  });

  return ok({ ok: true, archived: true, deleted: true });
});
