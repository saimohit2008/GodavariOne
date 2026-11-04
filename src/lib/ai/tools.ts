// Godavari One — Safe Database Retrieval Tools for AI Assistant
// All queries use Prisma ORM with parameterized parameters; zero raw SQL.

import { db, containsInsensitive } from "../db";
import type { ListingCitation } from "./types";

export interface ToolSearchResult {
  citations: ListingCitation[];
  summaryText: string;
}

export async function searchListingsTool(opts: {
  category?: string;
  query?: string;
  town?: string;
  district?: string;
  limit?: number;
}): Promise<ToolSearchResult> {
  const limit = Math.min(opts.limit || 5, 10);
  const where: any = {
    publicationStatus: "PUBLISHED",
  };

  if (opts.category) {
    where.category = opts.category;
  }

  if (opts.town) {
    where.town = containsInsensitive(opts.town);
  }

  if (opts.district) {
    where.district = containsInsensitive(opts.district);
  }

  if (opts.query) {
    const q = opts.query.trim();
    where.OR = [
      { name: containsInsensitive(q) },
      { description: containsInsensitive(q) },
      { address: containsInsensitive(q) },
      { locality: containsInsensitive(q) },
    ];
  }

  const items = await db.listing.findMany({
    where,
    take: limit,
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      ghatDetails: true,
      hotelDetails: true,
      restaurantDetails: true,
      hospitalDetails: true,
      schedule: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const citations: ListingCitation[] = items.map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    address: l.address,
    town: l.town,
    district: l.district,
    phone: l.phone,
    mapsUrl: l.mapsUrl,
    primaryImage: l.images[0]?.url || null,
    crowdStatus: l.ghatDetails?.currentCrowdStatus || null,
    isTemporarilyClosed: Boolean(l.schedule?.isTemporarilyClosed),
    priceRange: l.hotelDetails?.priceRange || l.restaurantDetails?.priceRange || null,
    specialNotice: l.schedule?.isTemporarilyClosed ? (l.schedule.temporaryClosureReason || "Temporarily closed") : null,
  }));

  const summaryText = items.length === 0
    ? "No verified listings found matching the specified criteria."
    : items.map((l) => {
        const closed = l.schedule?.isTemporarilyClosed ? " [WARNING: TEMPORARILY CLOSED]" : "";
        const crowd = l.ghatDetails?.currentCrowdStatus ? ` (Crowd: ${l.ghatDetails.currentCrowdStatus})` : "";
        const price = l.hotelDetails?.priceRange || l.restaurantDetails?.priceRange ? ` - Price: ${l.hotelDetails?.priceRange || l.restaurantDetails?.priceRange}` : "";
        return `• ${l.name} (${l.category})${closed}${crowd}: ${l.address}, ${l.town || ""}${price}${l.phone ? ` (Phone: ${l.phone})` : ""}`;
      }).join("\n");

  return { citations, summaryText };
}

export async function getGhatStatusTool(town?: string): Promise<ToolSearchResult> {
  const where: any = {
    category: "GHAT",
    publicationStatus: "PUBLISHED",
  };
  if (town) where.town = containsInsensitive(town);

  const ghats = await db.listing.findMany({
    where,
    include: {
      ghatDetails: true,
      schedule: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    take: 10,
  });

  const citations: ListingCitation[] = ghats.map((g) => ({
    id: g.id,
    name: g.name,
    category: "GHAT",
    address: g.address,
    town: g.town,
    district: g.district,
    phone: g.phone,
    mapsUrl: g.mapsUrl,
    primaryImage: g.images[0]?.url || null,
    crowdStatus: g.ghatDetails?.currentCrowdStatus || "MODERATE",
    isTemporarilyClosed: Boolean(g.schedule?.isTemporarilyClosed),
    specialNotice: g.schedule?.isTemporarilyClosed
      ? `CLOSED: ${g.schedule.temporaryClosureReason || "Safety maintenance"}`
      : `Live Crowd: ${g.ghatDetails?.currentCrowdStatus || "FREE"} (Updated: ${g.ghatDetails?.statusUpdatedAt ? new Date(g.ghatDetails.statusUpdatedAt).toLocaleTimeString() : "Recent"})`,
  }));

  const summaryText = ghats.map((g) => {
    const isClosed = g.schedule?.isTemporarilyClosed;
    const status = isClosed ? "CLOSED" : (g.ghatDetails?.currentCrowdStatus || "FREE");
    return `• ${g.name}: Status=${status}, Location=${g.town || "Rajahmundry"}, Updated=${g.ghatDetails?.statusUpdatedAt ? new Date(g.ghatDetails.statusUpdatedAt).toLocaleTimeString() : "Live"}`;
  }).join("\n");

  return { citations, summaryText };
}

export async function getEmergencyHospitalsTool(town?: string): Promise<ToolSearchResult> {
  const where: any = {
    category: "HOSPITAL",
    publicationStatus: "PUBLISHED",
  };
  if (town) where.town = containsInsensitive(town);

  const hospitals = await db.listing.findMany({
    where,
    include: {
      hospitalDetails: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    take: 8,
  });

  const citations: ListingCitation[] = hospitals.map((h) => ({
    id: h.id,
    name: h.name,
    category: "HOSPITAL",
    address: h.address,
    town: h.town,
    district: h.district,
    phone: h.phone,
    mapsUrl: h.mapsUrl,
    primaryImage: h.images[0]?.url || null,
    specialNotice: h.hospitalDetails?.emergencyAvailable ? "24/7 Emergency Casualty Available" : "OPD & Medical Facility",
  }));

  const summaryText = hospitals.map((h) =>
    `• ${h.name} (${h.town || "Rajahmundry"}): Emergency=${h.hospitalDetails?.emergencyAvailable ? "YES (24/7)" : "Standard"}, Phone=${h.phone || "108 (Helpline)"}, Address=${h.address}`
  ).join("\n");

  return { citations, summaryText };
}

export async function getFreeAccommodationTool(town?: string): Promise<ToolSearchResult> {
  const where: any = {
    category: "FREE_ACCOMMODATION",
    publicationStatus: "PUBLISHED",
  };
  if (town) where.town = containsInsensitive(town);

  const satrams = await db.listing.findMany({
    where,
    include: {
      freeAccommodationDetails: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    take: 6,
  });

  const citations: ListingCitation[] = satrams.map((s) => ({
    id: s.id,
    name: s.name,
    category: "FREE_ACCOMMODATION",
    address: s.address,
    town: s.town,
    district: s.district,
    phone: s.phone,
    mapsUrl: s.mapsUrl,
    primaryImage: s.images[0]?.url || null,
    specialNotice: s.freeAccommodationDetails?.availableTypes || "Free Dormitory & Rest Halls",
  }));

  const summaryText = satrams.map((s) =>
    `• ${s.name} (${s.town || "Rajahmundry"}): Capacity=${s.freeAccommodationDetails?.totalCapacity || "Open Hall"}, Status=${s.freeAccommodationDetails?.availabilityStatus || "AVAILABLE"}, Phone=${s.phone || "N/A"}`
  ).join("\n");

  return { citations, summaryText };
}

export async function getAnnadanamTool(town?: string): Promise<ToolSearchResult> {
  const where: any = {
    category: "ANNADANAM",
    publicationStatus: "PUBLISHED",
  };
  if (town) where.town = containsInsensitive(town);

  const centres = await db.listing.findMany({
    where,
    include: {
      annadanamDetails: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    take: 6,
  });

  const citations: ListingCitation[] = centres.map((c) => ({
    id: c.id,
    name: c.name,
    category: "ANNADANAM",
    address: c.address,
    town: c.town,
    district: c.district,
    phone: c.phone,
    mapsUrl: c.mapsUrl,
    primaryImage: c.images[0]?.url || null,
    specialNotice: `Serving Status: ${c.annadanamDetails?.servingStatus || "ACTIVE"}, Wait time: ~${c.annadanamDetails?.queueWaitMinutes || 10} mins`,
  }));

  const summaryText = centres.map((c) =>
    `• ${c.name} (${c.town || "Rajahmundry"}): Serving=${c.annadanamDetails?.servingStatus || "ACTIVE"}, Type=${c.annadanamDetails?.dietaryInfo || "PURE_VEG Satvik Meals"}`
  ).join("\n");

  return { citations, summaryText };
}

export async function getPurohitsTool(ceremonyType?: string): Promise<ToolSearchResult> {
  const where: any = {
    isActive: true,
  };

  const purohits = await db.purohitProfile.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
    take: 6,
  });

  const citations: ListingCitation[] = purohits.map((p) => ({
    id: p.id,
    name: p.fullName || p.user?.name || "Vedic Purohit",
    category: "CEREMONY",
    address: `${p.serviceArea || "Rajahmundry Pushkar Ghats"}`,
    town: p.serviceArea || "Rajahmundry",
    phone: p.phone || p.user?.phone,
    specialNotice: `Languages: ${p.languages || "Telugu, Sanskrit"} | Experience: ${p.experienceYears || 10} yrs`,
  }));

  const summaryText = purohits.map((p) =>
    `• ${p.fullName || p.user?.name || "Vedic Priest"}: Area=${p.serviceArea || "Rajahmundry"}, Languages=${p.languages || "Telugu"}, Experience=${p.experienceYears || 10} yrs`
  ).join("\n");

  return { citations, summaryText };
}

export async function getAdminOperationalSummary(): Promise<string> {
  const [
    hotelBookingsCount,
    restaurantBookingsCount,
    ceremonyBookingsCount,
    freeAccBookingsCount,
    priorityBookingsCount,
    failedEmailsCount,
    closedGhatsCount,
  ] = await Promise.all([
    db.hotelBooking.count({ where: { status: "PENDING" } }),
    db.restaurantBooking.count({ where: { status: "PENDING" } }),
    db.ceremonyBooking.count({ where: { status: "PENDING" } }),
    db.freeAccommodationBooking.count({ where: { status: "CONFIRMED" } }),
    db.priorityGhatBooking.count({ where: { status: "SUBMITTED" } }),
    db.emailNotification.count({ where: { status: "FAILED" } }),
    db.listingSchedule.count({ where: { isTemporarilyClosed: true } }),
  ]);

  return [
    `ADMIN OPERATIONAL SUMMARY (Ground Truth Data):`,
    `- Pending Hotel Bookings: ${hotelBookingsCount}`,
    `- Pending Restaurant Bookings: ${restaurantBookingsCount}`,
    `- Pending Ceremony Bookings: ${ceremonyBookingsCount}`,
    `- Confirmed Free Accommodation Bookings: ${freeAccBookingsCount}`,
    `- Submitted Priority Ghat Bookings (65+ & PwD): ${priorityBookingsCount}`,
    `- Failed Email Notifications (Requiring Review): ${failedEmailsCount}`,
    `- Officially Closed Ghats: ${closedGhatsCount}`,
  ].join("\n");
}
