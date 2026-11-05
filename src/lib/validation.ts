import { NextResponse } from "next/server";
import net from "net";
import { z } from "zod";
import type { ZodError } from "zod";
import { calculateTimingStatus } from "./timing";

// Standard API response helpers + error handling

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;
  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function zodError(e: ZodError) {
  return fail("Validation failed", 422, e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
}

// Wrap a route handler with consistent error handling
export function handler<T extends (...args: never[]) => Promise<unknown>>(fn: T) {
  return (async (...args: Parameters<T>) => {
    try {
      const res = await fn(...args);
      return res as unknown as NextResponse;
    } catch (e: any) {
      if (e instanceof ApiError || (e && typeof e.statusCode === "number")) {
        return fail(e.message, e.statusCode, e.details);
      }
       
      console.error("[api error]", e);
      const isProd =
        process.env.NODE_ENV === "production" ||
        process.env.VERCEL === "1" ||
        process.env.VERCEL_ENV === "production";
      const msg = isProd ? "Internal server error" : (e instanceof Error ? e.message : "Internal server error");
      return fail(msg, 500);
    }
  }) as T;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

export const phoneSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .max(15, "Phone number too long")
  .regex(/^[0-9+\-\s()]+$/, "Invalid phone number");

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128);

export interface NormalizedPhone {
  raw: string;
  digits: string;
  national: string;
  e164: string;
  primary: string;
  isValid: boolean;
  error?: string;
}

/**
 * Normalizes mobile numbers with support for Indian mobile numbers (+91 / 0 / 10 digits)
 * and international E.164 formats (+...).
 */
export function normalizeMobileNumber(raw: string): NormalizedPhone {
  if (!raw || typeof raw !== "string") {
    return { raw: "", digits: "", national: "", e164: "", primary: "", isValid: false, error: "Mobile number is required" };
  }

  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 10) {
    return { raw: trimmed, digits, national: digits, e164: "", primary: digits, isValid: false, error: "Mobile number must be at least 10 digits" };
  }
  if (digits.length > 15) {
    return { raw: trimmed, digits, national: digits, e164: "", primary: digits, isValid: false, error: "Mobile number cannot exceed 15 digits" };
  }

  // International non-Indian numbers starting with '+' (e.g. NRI numbers)
  if (trimmed.startsWith("+") && !digits.startsWith("91")) {
    const e164 = `+${digits}`;
    return { raw: trimmed, digits, national: digits, e164, primary: e164, isValid: true };
  }

  // Indian numbers: normalize prefixes +91, 91, or leading 0 to 10-digit national number
  let national = digits;
  if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    national = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith("91")) {
    national = digits.slice(digits.length - 10);
  } else if (digits.length > 10) {
    national = digits.slice(-10);
  }

  const e164 = `+91${national}`;
  return {
    raw: trimmed,
    digits,
    national,
    e164,
    primary: national,
    isValid: true,
  };
}

/**
 * Builds Prisma OR query filter array to match stored phone numbers regardless of
 * whether they were saved with +91, national 10-digit, or raw digits format.
 */
export function buildPhoneQueryFilter(norm: NormalizedPhone) {
  const set = new Set<string>();
  if (norm.primary) set.add(norm.primary);
  if (norm.national) set.add(norm.national);
  if (norm.e164) set.add(norm.e164);
  if (norm.digits) set.add(norm.digits);
  if (norm.raw) set.add(norm.raw);
  return Array.from(set).filter(Boolean).map((p) => ({ phone: p }));
}

/**
 * Sensible password policy for new user registration:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - Must contain both letters and numbers
 */
export function validatePasswordPolicy(password: string): { isValid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { isValid: false, error: "Password is required" };
  }
  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters long" };
  }
  if (password.length > 128) {
    return { isValid: false, error: "Password cannot exceed 128 characters" };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { isValid: false, error: "Password must contain both letters and numbers" };
  }
  return { isValid: true };
}

export const roleSchema = z.enum([
  "SUPER_ADMIN",
  "VISITOR",
  "BUSINESS_OWNER",
  "BOOKING_REVIEWER",
  "GHAT_SUPERVISOR",
  "PUROHIT",
  "NRI_SERVICE_MANAGER",
]);

export const categorySchema = z.enum([
  "RESTAURANT",
  "HOTEL",
  "GHAT",
  "HOSPITAL",
  "TRANSPORT",
  "TOURIST_SPOT",
  "FREE_ACCOMMODATION",
  "ANNADANAM",
  "CEREMONY",
]);

export const crowdStatusSchema = z.enum([
  "FREE",
  "MODERATE",
  "CROWDED",
  "OVERCROWDED",
  "EMERGENCY",
]);

export const bookingStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
]);

export const publicationStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "SUSPENDED",
  "ARCHIVED",
]);

// Google Maps helpers — coordinate validation & directions URL

export function isValidLat(v: number): boolean {
  return typeof v === "number" && isFinite(v) && v >= -90 && v <= 90;
}
export function isValidLng(v: number): boolean {
  return typeof v === "number" && isFinite(v) && v >= -180 && v <= 180;
}

export function directionsUrl(lat?: number, lng?: number, mapsUrl?: string): string | null {
  if (typeof lat === "number" && typeof lng === "number" && isValidLat(lat) && isValidLng(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  // preserve a validated user-provided maps URL if protocol is https/http
  if (mapsUrl && /^https?:\/\//i.test(mapsUrl)) {
    return mapsUrl;
  }
  return null;
}

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// listing create/update schema
export const listingSchema = z.object({
  name: z.string().min(2).max(200),
  category: categorySchema,
  description: z.string().min(10).max(5000),
  address: z.string().min(5).max(500),
  district: z.string().optional().nullable(),
  town: z.string().optional().nullable(),
  locality: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  mapsUrl: z.string().optional().nullable(),
  locationVerified: z.boolean().optional(),
  accessibility: z.record(z.string(), z.boolean()).optional().nullable(),
  facilities: z.record(z.string(), z.union([z.boolean(), z.string()])).optional().nullable(),
  publicationStatus: publicationStatusSchema.optional(),
  // category-specific details
  restaurant: z
    .object({
      cuisine: z.string().optional().nullable(),
      foodType: z.string().optional().nullable(),
      priceRange: z.string().optional().nullable(),
      openingHours: z.string().optional().nullable(),
      tableCapacity: z.number().int().optional().nullable(),
      reservationAvailable: z.boolean().optional(),
      seatingAccessibility: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  hotel: z
    .object({
      accommodationType: z.string().optional().nullable(),
      roomTypes: z.string().optional().nullable(),
      numRooms: z.number().int().optional().nullable(),
      roomCapacity: z.number().int().optional().nullable(),
      checkInTime: z.string().optional().nullable(),
      checkOutTime: z.string().optional().nullable(),
      amenities: z.string().optional().nullable(),
      priceRange: z.string().optional().nullable(),
      bookingContact: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  ghat: z
    .object({
      accessRoutes: z.string().optional().nullable(),
      facilities: z.string().optional().nullable(),
      accessibility: z.string().optional().nullable(),
      medicalAssistance: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  hospital: z
    .object({
      facilityType: z.string().optional().nullable(),
      emergencyAvailable: z.boolean().optional(),
      services: z.string().optional().nullable(),
      operatingHours: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  transport: z
    .object({
      transportType: z.string().optional().nullable(),
      serviceAreas: z.string().optional().nullable(),
      vehicleDetails: z.string().optional().nullable(),
      pricing: z.string().optional().nullable(),
      driverOption: z.boolean().optional(),
    })
    .optional()
    .nullable(),
  tourist: z
    .object({
      openingHours: z.string().optional().nullable(),
      entryFee: z.string().optional().nullable(),
      facilities: z.string().optional().nullable(),
      accessibility: z.string().optional().nullable(),
      directions: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  freeAccommodation: z
    .object({
      accommodationType: z.string().optional().nullable(),
      availableTypes: z.union([z.string(), z.array(z.string())]).optional().nullable(),
      totalCapacity: z.number().int().min(0).optional().nullable(),
      availableCapacity: z.number().int().min(0).optional().nullable(),
      capacityMen: z.number().int().min(0).optional().nullable(),
      availableMen: z.number().int().min(0).optional().nullable(),
      capacityWomen: z.number().int().min(0).optional().nullable(),
      availableWomen: z.number().int().min(0).optional().nullable(),
      capacityFamily: z.number().int().min(0).optional().nullable(),
      availableFamily: z.number().int().min(0).optional().nullable(),
      checkInTime: z.string().optional().nullable(),
      checkOutTime: z.string().optional().nullable(),
      maxStayDays: z.number().int().min(1).max(30).optional().nullable(),
      rules: z.string().optional().nullable(),
      eligibilityCriteria: z.string().optional().nullable(),
      amenities: z.union([z.string(), z.array(z.string())]).optional().nullable(),
      requiresRegistration: z.boolean().optional(),
      registrationUrl: z.string().optional().nullable(),
      registrationContact: z.string().optional().nullable(),
      isTemporarilyUnavailable: z.boolean().optional(),
      availabilityStatus: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  annadanam: z
    .object({
      organizationName: z.string().optional().nullable(),
      distributionType: z.string().optional().nullable(),
      dietaryInfo: z.string().optional().nullable(),
      servingStatus: z.string().optional().nullable(),
      sessions: z.union([z.string(), z.array(z.any())]).optional().nullable(),
      seatingCapacity: z.number().int().min(0).optional().nullable(),
      queueWaitMinutes: z.number().int().min(0).optional().nullable(),
      remainingServings: z.number().int().min(0).optional().nullable(),
      eligibilityRules: z.string().optional().nullable(),
      specialDates: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  ceremony: z
    .object({
      ceremonyTypes: z.union([z.string(), z.array(z.string())]).optional().nullable(),
      serviceGhats: z.union([z.string(), z.array(z.string())]).optional().nullable(),
      customaryGuidelines: z.string().optional().nullable(),
      samagriProvided: z.boolean().optional(),
      basePriceRange: z.string().optional().nullable(),
      contactPerson: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type ListingInput = z.infer<typeof listingSchema>;

export function isValidDateString(dStr: string): boolean {
  if (typeof dStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return false;
  const [yStr, mStr, dStrPart] = dStr.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStrPart, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export const hotelBookingSchema = z
  .object({
    listingId: z.string().min(1, "Hotel listing is required"),
    roomId: z.string().optional().nullable(),
    checkIn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date format (YYYY-MM-DD)")
      .refine(isValidDateString, "Invalid check-in date"),
    checkOut: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date format (YYYY-MM-DD)")
      .refine(isValidDateString, "Invalid check-out date"),
    guests: z
      .number()
      .int("Guest count must be an integer")
      .min(1, "Guest count must be at least 1")
      .max(50, "Guest count cannot exceed 50"),
    rooms: z
      .number()
      .int("Room count must be an integer")
      .min(1, "Room count must be at least 1")
      .max(20, "Room count cannot exceed 20"),
    adults: z
      .number()
      .int("Adult count must be an integer")
      .min(1, "At least 1 adult is required")
      .max(50, "Adult count cannot exceed 50")
      .optional()
      .nullable(),
    children: z
      .number()
      .int("Children count must be an integer")
      .min(0, "Children count cannot be negative")
      .max(50, "Children count cannot exceed 50")
      .optional()
      .nullable(),
    specialRequest: z.string().max(500, "Special request cannot exceed 500 characters").optional().nullable(),
  })
  .refine(
    (data) => {
      const cin = new Date(data.checkIn);
      const cout = new Date(data.checkOut);
      return cout > cin;
    },
    {
      message: "Check-out date must be strictly after check-in date",
      path: ["checkOut"],
    }
  )
  .refine(
    (data) => {
      if (data.adults != null && data.children != null) {
        return data.adults + data.children === data.guests;
      }
      return true;
    },
    {
      message: "Total guest count must match the sum of adults and children",
      path: ["guests"],
    }
  )
  .refine(
    (data) => {
      if (data.adults != null && data.adults > data.guests) {
        return false;
      }
      return true;
    },
    {
      message: "Adult count cannot exceed total guest count",
      path: ["adults"],
    }
  )
  .refine(
    (data) => {
      if (data.children != null && data.children > data.guests) {
        return false;
      }
      return true;
    },
    {
      message: "Children count cannot exceed total guest count",
      path: ["children"],
    }
  );

export type HotelBookingInput = z.infer<typeof hotelBookingSchema>;

export const ceremonyBookingSchema = z.object({
  purohitId: z.string().min(1, "Purohit ID is required"),
  ceremonyType: z.string().min(2, "Ceremony type is required"),
  bookingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid booking date format (YYYY-MM-DD)")
    .refine(isValidDateString, "Invalid booking date"),
  startTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/, "Invalid start time format (HH:MM)"),
  durationMinutes: z.number().int("Duration must be an integer").min(15, "Duration must be at least 15 minutes").default(60),
  visitorName: z.string().min(2, "Name must be at least 2 characters").optional().nullable(),
  visitorPhone: z.string().min(7, "Phone number must be at least 7 characters").optional().nullable(),
  visitorEmail: z.string().email("Valid email required").optional().nullable().or(z.literal("")),
  participantsCount: z.number().int("Participant count must be an integer").min(1, "Participant count must be at least 1").optional().nullable(),
  participantCount: z.number().int("Participant count must be an integer").min(1, "Participant count must be at least 1").optional().nullable(),
  locationType: z.enum(["GHAT", "HOME_HOTEL", "TEMPLE"]).default("GHAT"),
  locationAddress: z.string().optional().nullable(),
  ceremonyLocation: z.string().optional().nullable(),
  customaryRequirements: z.string().max(1000, "Customary requirements too long").optional().nullable(),
  visitorNotes: z.string().max(1000, "Notes too long").optional().nullable(),
  deceasedRelationship: z.string().max(200, "Relationship description too long").optional().nullable(),
  gotra: z.string().max(100, "Gotra too long").optional().nullable(),
  serviceFee: z.number().min(0, "Service fee cannot be negative").optional().nullable(),
});

export type CeremonyBookingInput = z.infer<typeof ceremonyBookingSchema>;

// Strip a listing of private/internal fields for public API
export function serializeListing(l: any) {
  const dir = directionsUrl(l.latitude ?? undefined, l.longitude ?? undefined, l.mapsUrl ?? undefined);
  return {
    id: l.id,
    name: l.name,
    category: l.category,
    description: l.description,
    address: l.address,
    district: l.district,
    town: l.town,
    locality: l.locality,
    phone: l.phone,
    email: l.email,
    latitude: l.latitude,
    longitude: l.longitude,
    mapsUrl: l.mapsUrl,
    directionsUrl: dir,
    locationVerified: l.locationVerified,
    accessibility: l.accessibility ? safeJson(l.accessibility) : null,
    facilities: l.facilities ? safeJson(l.facilities) : null,
    publicationStatus: l.publicationStatus,
    verificationStatus: l.verificationStatus,
    rejectionReason: l.rejectionReason,
    ownerId: l.ownerId,
    owner: l.owner ? { id: l.owner.id, name: l.owner.name, phone: l.owner.phone, email: l.owner.email } : null,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    images: (l.images ?? [])
      .sort((a: any, b: any) => (a.orderIdx || 0) - (b.orderIdx || 0))
      .map((im: any) => ({
        id: im.id,
        url: im.url,
        isPrimary: im.isPrimary,
      })),
    primaryImage: (l.images ?? []).find((im: any) => im.isPrimary)?.url || (l.images ?? [])[0]?.url || null,
    schedule: l.schedule
      ? {
          ...l.schedule,
          operatingDays: safeJson(l.schedule.operatingDays),
          closedDays: safeJson(l.schedule.closedDays),
          intervals: safeJson(l.schedule.intervals),
          specialHours: safeJson(l.schedule.specialHours),
        }
      : null,
    timingStatus: calculateTimingStatus(l.schedule),
    hotelRooms: (l.hotelRooms ?? []).map((r: any) => ({
      ...r,
      amenities: safeJson(r.amenities),
      images: safeJson(r.images),
    })),
    restaurant: l.restaurantDetails || null,
    hotel: l.hotelDetails || null,
    ghat: l.ghatDetails
      ? {
          ...l.ghatDetails,
          accessRoutes: safeJson(l.ghatDetails.accessRoutes),
          facilities: safeJson(l.ghatDetails.facilities),
          accessibility: safeJson(l.ghatDetails.accessibility),
        }
      : null,
    hospital: l.hospitalDetails
      ? {
          ...l.hospitalDetails,
          services: safeJson(l.hospitalDetails.services),
        }
      : null,
    transport: l.transportDetails
      ? {
          ...l.transportDetails,
          serviceAreas: safeJson(l.transportDetails.serviceAreas),
        }
      : null,
    tourist: l.touristDetails
      ? {
          ...l.touristDetails,
          facilities: safeJson(l.touristDetails.facilities),
          accessibility: safeJson(l.touristDetails.accessibility),
        }
      : null,
    freeAccommodation: l.freeAccommodationDetails
      ? {
          ...l.freeAccommodationDetails,
          availableTypes: safeJson(l.freeAccommodationDetails.availableTypes),
          amenities: safeJson(l.freeAccommodationDetails.amenities),
        }
      : null,
    annadanam: l.annadanamDetails
      ? {
          ...l.annadanamDetails,
          sessions: safeJson(l.annadanamDetails.sessions),
        }
      : null,
  };
}

export function safeJson(v: unknown): any {
  if (v == null) return null;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function getClientIp(req: Request): string | undefined {
  if ((req as any).ip && typeof (req as any).ip === "string" && net.isIP((req as any).ip)) {
    return (req as any).ip;
  }
  const headerKeys = ["x-real-ip", "x-vercel-ip", "cf-connecting-ip"];
  for (const key of headerKeys) {
    const val = req.headers.get(key)?.trim();
    if (val && net.isIP(val)) {
      return val;
    }
  }
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const candidate = fwd.split(",")[0].trim();
    if (net.isIP(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
