import { NextRequest } from "next/server";
import { db, isPostgresDatabase, containsInsensitive } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import {
  ok,
  created,
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
import { canManageListings } from "@/lib/constants";

// GET /api/v1/listings — public directory
// Visitors only see PUBLISHED listings. Authenticated staff see based on role.
export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const q = searchParams.get("q") || undefined;
  const district = searchParams.get("district") || undefined;
  const town = searchParams.get("town") || undefined;
  const accessibility = searchParams.get("accessibility") || undefined;
  const crowdStatus = searchParams.get("crowdStatus") || undefined;
  const status = searchParams.get("status") || undefined;
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const limit = Math.min(Number(searchParams.get("limit") || 24), 100);
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const ctx = await getCurrentUser(req);
  const role = ctx?.user.role;

  const where: Record<string, unknown> = {};
  // Public visibility rules
  if (!role || role === "VISITOR") {
    where.publicationStatus = "PUBLISHED";
  } else if (status && status !== "ALL" && role !== "VISITOR") {
    where.publicationStatus = status;
  } else if (role !== "SUPER_ADMIN" && !status) {
    // Editors/owners see published + their own drafts/pending
    where.OR = [{ publicationStatus: "PUBLISHED" }, { ownerId: ctx!.user.id }];
  }

  if (category && category !== "ALL") where.category = category;
  if (district) where.district = district;
  if (town) where.town = town;
  if (q) {
    where.OR = [
      { name: containsInsensitive(q) },
      { description: containsInsensitive(q) },
      { address: containsInsensitive(q) },
      { locality: containsInsensitive(q) },
      { town: containsInsensitive(q) },
    ];
  }
  if (accessibility === "true") {
    where.NOT = { accessibility: null };
  }
  if (crowdStatus) {
    where.ghatDetails = { currentCrowdStatus: crowdStatus };
  }

  const allowedSortFields = ["name", "createdAt", "updatedAt", "publicationStatus"];
  const orderBy = allowedSortFields.includes(sortBy)
    ? { [sortBy]: sortOrder as "asc" | "desc" }
    : { createdAt: "desc" as const };

  const isVisitor = !role || role === "VISITOR";
  const isPg = isPostgresDatabase();

  const includeRelations: any = {
    images: {
      select: { id: true, url: true, isPrimary: true, orderIdx: true },
      orderBy: { orderIdx: "asc" },
    },
    owner: !isVisitor ? { select: { id: true, name: true, phone: true, email: true } } : false,
    restaurantDetails: !category || category === "ALL" || category === "RESTAURANT",
    hotelDetails: !category || category === "ALL" || category === "HOTEL",
    schedule: true,
    ghatDetails: !category || category === "ALL" || category === "GHAT",
    hospitalDetails: !category || category === "ALL" || category === "HOSPITAL",
    transportDetails: !category || category === "ALL" || category === "TRANSPORT",
    touristDetails: !category || category === "ALL" || category === "TOURIST_SPOT",
    freeAccommodationDetails: !category || category === "ALL" || category === "FREE_ACCOMMODATION",
    annadanamDetails: !category || category === "ALL" || category === "ANNADANAM",
  };

  let total: number;
  let items: any[];

  if (page === 1) {
    const queryOptions: any = {
      where,
      include: includeRelations,
      orderBy,
      take: limit + 1,
    };

    const fetched = await db.listing.findMany(queryOptions);
    if (fetched.length <= limit) {
      items = fetched;
      total = fetched.length;
    } else {
      items = fetched.slice(0, limit);
      total = await db.listing.count({ where });
    }
  } else {
    const queryOptions: any = {
      where,
      include: includeRelations,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    };

    const [countResult, itemsResult] = await Promise.all([
      db.listing.count({ where }),
      db.listing.findMany(queryOptions),
    ]);
    total = countResult;
    items = itemsResult;
  }

  const rows = items.map(serializeListing);

  return ok({ items: rows, total, page, limit });
});

// POST /api/v1/listings — create a listing (SuperAdmin, DirectoryEditor, BusinessOwner)
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (!canManageListings(ctx.user.role as any)) return fail("Insufficient permissions to create listings", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const input = parsed.data;

  // Coordinate validation
  if (input.latitude != null && !isValidLat(input.latitude)) return fail("Latitude must be between -90 and 90", 422);
  if (input.longitude != null && !isValidLng(input.longitude)) return fail("Longitude must be between -180 and 180", 422);
  if (input.mapsUrl != null && input.mapsUrl !== "" && !isSafeUrl(input.mapsUrl))
    return fail("mapsUrl must be an http(s) URL", 422);
  const locationVerified =
    (input.latitude != null && input.longitude != null && isValidLat(input.latitude) && isValidLng(input.longitude)) ||
    (typeof input.mapsUrl === "string" && isSafeUrl(input.mapsUrl));

  // Backend authorizes the publication transition — visitors/owners cannot
  // directly publish. Only SUPER_ADMIN may set PUBLISHED.
  let pubStatus = input.publicationStatus || "DRAFT";
  if (pubStatus === "PUBLISHED" && ctx.user.role !== "SUPER_ADMIN") {
    pubStatus = "PENDING";
  }
  if (pubStatus === "PUBLISHED" && !locationVerified) {
    pubStatus = "PENDING";
  }

  const listing = await db.listing.create({
    data: {
      name: input.name,
      category: input.category,
      description: input.description,
      address: input.address,
      district: input.district || null,
      town: input.town || null,
      locality: input.locality || null,
      phone: input.phone || null,
      email: input.email || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      mapsUrl: input.mapsUrl || null,
      locationVerified,
      accessibility: input.accessibility ? JSON.stringify(input.accessibility) : null,
      facilities: input.facilities ? JSON.stringify(input.facilities) : null,
      publicationStatus: pubStatus,
      verificationStatus: "UNVERIFIED",
      ownerId: ctx.user.role === "BUSINESS_OWNER" ? ctx.user.id : (body?.ownerId || null),
      restaurantDetails: input.restaurant
        ? { create: {
            cuisine: input.restaurant.cuisine || null,
            foodType: input.restaurant.foodType || null,
            priceRange: input.restaurant.priceRange || null,
            openingHours: input.restaurant.openingHours || null,
            tableCapacity: input.restaurant.tableCapacity ?? null,
            reservationAvailable: input.restaurant.reservationAvailable ?? true,
            seatingAccessibility: input.restaurant.seatingAccessibility || null,
          } }
        : undefined,
      hotelDetails: input.hotel
        ? { create: {
            accommodationType: input.hotel.accommodationType || null,
            roomTypes: input.hotel.roomTypes || null,
            numRooms: input.hotel.numRooms ?? null,
            roomCapacity: input.hotel.roomCapacity ?? null,
            checkInTime: input.hotel.checkInTime || null,
            checkOutTime: input.hotel.checkOutTime || null,
            amenities: input.hotel.amenities || null,
            priceRange: input.hotel.priceRange || null,
            bookingContact: input.hotel.bookingContact || null,
          } }
        : undefined,
      ghatDetails: input.ghat
        ? { create: {
            accessRoutes: input.ghat.accessRoutes || null,
            facilities: input.ghat.facilities || null,
            accessibility: input.ghat.accessibility || null,
            medicalAssistance: input.ghat.medicalAssistance || null,
          } }
        : undefined,
      hospitalDetails: input.hospital
        ? { create: {
            facilityType: input.hospital.facilityType || null,
            emergencyAvailable: input.hospital.emergencyAvailable ?? false,
            services: input.hospital.services || null,
            operatingHours: input.hospital.operatingHours || null,
          } }
        : undefined,
      transportDetails: input.transport
        ? { create: {
            transportType: input.transport.transportType || null,
            serviceAreas: input.transport.serviceAreas || null,
            vehicleDetails: input.transport.vehicleDetails || null,
            pricing: input.transport.pricing || null,
            driverOption: input.transport.driverOption ?? false,
          } }
        : undefined,
      touristDetails: input.tourist
        ? { create: {
            openingHours: input.tourist.openingHours || null,
            entryFee: input.tourist.entryFee || null,
            facilities: input.tourist.facilities || null,
            accessibility: input.tourist.accessibility || null,
            directions: input.tourist.directions || null,
          } }
        : undefined,
      freeAccommodationDetails: input.freeAccommodation
        ? { create: {
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
          } }
        : undefined,
      annadanamDetails: input.annadanam
        ? { create: {
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
          } }
        : undefined,
    },
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

  // If a business owner created it, assign ownership explicitly.
  if (ctx.user.role === "BUSINESS_OWNER") {
    await db.assignment.create({
      data: { userId: ctx.user.id, listingId: listing.id, type: "LISTING_OWNER" },
    });
  }

  await audit({
    actorId: ctx.user.id,
    action: "LISTING_CREATE",
    targetType: "LISTING",
    targetId: listing.id,
    details: { name: listing.name, category: listing.category, publicationStatus: pubStatus },
    ip: getClientIp(req),
  });

  // Notify super admins of a new pending listing
  if (pubStatus === "PENDING") {
    const admins = await db.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    await Promise.all(
      admins.map((a) =>
        notify({
          userId: a.id,
          type: "LISTING_PENDING",
          title: "Listing pending review",
          message: `"${listing.name}" is pending review.`,
          link: `listing:${listing.id}`,
        })
      )
    );
  }

  return created(serializeListing(listing));
});
