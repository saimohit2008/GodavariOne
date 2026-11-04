import { NextRequest } from "next/server";
import { db, isPostgresDatabase, containsInsensitive } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

const createPurohitSchema = z.object({
  userId: z.string().optional().nullable(),
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  profilePhotoUrl: z.string().optional().nullable(),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Valid email required").optional().nullable().or(z.literal("")),
  address: z.string().min(3).optional().default("Kotilingala Ghat Road, Rajahmundry"),
  serviceArea: z.string().min(2, "Service area is required"),
  languages: z.union([z.string(), z.array(z.string())]),
  ceremonies: z.union([z.string(), z.array(z.string())]),
  experienceYears: z.number().int().min(1).default(5),
  qualifications: z.string().optional().nullable(),
  customaryPractices: z.string().optional().nullable(),
  baseFee: z.number().min(0).default(1500),
  feeIncludes: z.string().optional().nullable(),
  includedServices: z.string().optional().nullable(),
  preferredContact: z.enum(["PHONE", "WHATSAPP", "EMAIL"]).default("PHONE"),
  workingDays: z.union([z.string(), z.array(z.string())]).default("[\"MONDAY\",\"TUESDAY\",\"WEDNESDAY\",\"THURSDAY\",\"FRIDAY\",\"SATURDAY\",\"SUNDAY\"]"),
  workingHoursStart: z.string().default("06:00"),
  workingHoursEnd: z.string().default("18:00"),
  breakStart: z.string().optional().nullable().default("12:30"),
  breakEnd: z.string().optional().nullable().default("14:00"),
  slotDurationMinutes: z.number().int().min(15).default(60),
  advanceBookingDays: z.number().int().min(1).default(60),
  cancellationHours: z.number().int().min(1).default(24),
  bio: z.string().optional().nullable(),
  supportingDocuments: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).default("VERIFIED"),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().default(true),
  isPublished: z.boolean().default(true),
});

import { CEREMONY_TYPES } from "@/lib/ceremonies";

export const dynamic = "force-dynamic";

// GET /api/v1/ceremonies/purohits — list purohits (Public directory + Super Admin management)
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || searchParams.get("search") || undefined;
  const area = searchParams.get("area") || undefined;
  const ceremony = searchParams.get("ceremony") || undefined;
  const language = searchParams.get("language") || undefined;
  const status = searchParams.get("status") || undefined;

  const isSuperAdmin = ctx?.user?.role === "SUPER_ADMIN";

  const andConditions: Record<string, unknown>[] = [];

  if (!isSuperAdmin) {
    // Public directory: only verified, active, published purohits
    andConditions.push({ verificationStatus: "VERIFIED" });
    andConditions.push({ isActive: true });
    andConditions.push({ isPublished: true });
  } else if (status && status !== "ALL") {
    andConditions.push({ verificationStatus: status });
  }

  if (area && area !== "ALL") {
    const areaGhat = area.split(",")[0].trim();
    if (areaGhat && areaGhat !== area) {
      andConditions.push({
        OR: [
          { serviceArea: containsInsensitive(area) },
          { serviceArea: containsInsensitive(areaGhat) },
        ],
      });
    } else {
      andConditions.push({ serviceArea: containsInsensitive(area) });
    }
  }
  if (ceremony && ceremony.toUpperCase() !== "ALL" && ceremony.toUpperCase() !== "CEREMONY") {
    const cMeta = CEREMONY_TYPES.find(
      (c) => c.id.toLowerCase() === ceremony.toLowerCase() || c.label.toLowerCase() === ceremony.toLowerCase() || c.id === ceremony
    );
    if (cMeta) {
      andConditions.push({
        OR: [
          { ceremonies: containsInsensitive(cMeta.id) },
          { ceremonies: containsInsensitive(cMeta.label) },
          { ceremonies: containsInsensitive(cMeta.label.split(" (")[0]) },
        ],
      });
    } else {
      andConditions.push({ ceremonies: containsInsensitive(ceremony) });
    }
  }
  if (language && language !== "ALL") {
    andConditions.push({ languages: containsInsensitive(language) });
  }
  if (q && q.trim()) {
    const query = q.trim();
    andConditions.push({
      OR: [
        { fullName: containsInsensitive(query) },
        { serviceArea: containsInsensitive(query) },
        { ceremonies: containsInsensitive(query) },
        { qualifications: containsInsensitive(query) },
      ],
    });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const isPg = isPostgresDatabase();
  const queryOptions: any = {
    where,
    include: {
      bookings: {
        select: {
          id: true,
          status: true,
          bookingDate: true,
        },
      },
      blockedPeriods: true,
    },
    orderBy: { createdAt: "desc" },
  };
  if (isPg) {
    queryOptions.relationLoadStrategy = "join";
  }

  const purohits: any[] = await db.purohitProfile.findMany(queryOptions);

  const formatted = purohits.map((p) => {
    let languagesArray: string[] = [];
    try {
      languagesArray = typeof p.languages === "string" ? JSON.parse(p.languages) : p.languages;
    } catch {
      languagesArray = [p.languages];
    }

    let ceremoniesArray: string[] = [];
    try {
      ceremoniesArray = typeof p.ceremonies === "string" ? JSON.parse(p.ceremonies) : p.ceremonies;
    } catch {
      ceremoniesArray = [p.ceremonies];
    }

    let workingDaysArray: string[] = [];
    try {
      workingDaysArray = typeof p.workingDays === "string" ? JSON.parse(p.workingDays) : p.workingDays;
    } catch {
      workingDaysArray = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    }

    const completedBookings = p.bookings.filter((b) => b.status === "COMPLETED").length;
    const totalBookings = p.bookings.length;

    // Public protection: hide supporting documents and private address from public directory
    return {
      id: p.id,
      userId: p.userId,
      fullName: p.fullName,
      profilePhotoUrl: p.profilePhotoUrl,
      profilePhoto: p.profilePhotoUrl,
      phone: isSuperAdmin ? p.phone : undefined, // restrict personal phone in public directory
      email: isSuperAdmin ? p.email : undefined,
      serviceArea: p.serviceArea,
      address: isSuperAdmin ? p.address : undefined,
      languages: languagesArray,
      ceremonies: ceremoniesArray,
      experienceYears: p.experienceYears,
      qualifications: p.qualifications,
      customaryPractices: p.customaryPractices,
      baseFee: p.baseFee,
      feeIncludes: p.feeIncludes,
      includedServices: p.feeIncludes,
      preferredContact: p.preferredContact,
      workingDays: workingDaysArray,
      workingHoursStart: p.workingHoursStart,
      workingHoursEnd: p.workingHoursEnd,
      breakStart: p.breakStart,
      breakEnd: p.breakEnd,
      slotDurationMinutes: p.slotDurationMinutes,
      advanceBookingDays: p.advanceBookingDays,
      cancellationHours: p.cancellationHours,
      verificationStatus: p.verificationStatus,
      isVerified: p.verificationStatus === "VERIFIED",
      isActive: p.isActive,
      isPublished: p.isPublished,
      supportingDocuments: isSuperAdmin ? p.supportingDocuments : undefined, // Restricted access
      bio: p.bio,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      completedBookings,
      totalBookings,
    };
  });

  const response = ok({ items: formatted, purohits: formatted, total: formatted.length });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
});

// POST /api/v1/ceremonies/purohits — Register a Purohit profile (Super Admin only)
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") {
    return fail("Only Super Admin can register purohit profiles", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = createPurohitSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const data = parsed.data;

  const languagesStr = typeof data.languages === "string" ? data.languages : JSON.stringify(data.languages);
  const ceremoniesStr = typeof data.ceremonies === "string" ? data.ceremonies : JSON.stringify(data.ceremonies);
  const workingDaysStr = typeof data.workingDays === "string" ? data.workingDays : JSON.stringify(data.workingDays);
  const supportingDocsStr = data.supportingDocuments ? (typeof data.supportingDocuments === "string" ? data.supportingDocuments : JSON.stringify(data.supportingDocuments)) : null;

  // If userId provided, verify user exists
  let linkedUserId = data.userId || null;
  if (!linkedUserId && data.phone) {
    const existingUser = await db.user.findUnique({ where: { phone: data.phone } });
    if (existingUser) {
      linkedUserId = existingUser.id;
      // Upgrade role to PUROHIT if visitor
      if (existingUser.role === "VISITOR") {
        await db.user.update({
          where: { id: existingUser.id },
          data: { role: "PUROHIT" },
        });
      }
    }
  }

  const profile = await db.purohitProfile.create({
    data: {
      userId: linkedUserId,
      fullName: data.fullName.trim(),
      profilePhotoUrl: data.profilePhotoUrl || null,
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      address: data.address.trim(),
      serviceArea: data.serviceArea.trim(),
      languages: languagesStr,
      ceremonies: ceremoniesStr,
      experienceYears: data.experienceYears,
      qualifications: data.qualifications?.trim() || null,
      customaryPractices: data.customaryPractices?.trim() || null,
      baseFee: data.baseFee,
      feeIncludes: (data.feeIncludes || data.includedServices)?.trim() || null,
      preferredContact: data.preferredContact,
      workingDays: workingDaysStr,
      workingHoursStart: data.workingHoursStart,
      workingHoursEnd: data.workingHoursEnd,
      breakStart: data.breakStart || null,
      breakEnd: data.breakEnd || null,
      slotDurationMinutes: data.slotDurationMinutes,
      advanceBookingDays: data.advanceBookingDays,
      cancellationHours: data.cancellationHours,
      verificationStatus: data.isVerified === false ? "PENDING" : (data.verificationStatus || (data.isVerified ? "VERIFIED" : "PENDING")),
      isActive: data.isActive,
      isPublished: data.isPublished,
      supportingDocuments: supportingDocsStr,
      bio: data.bio?.trim() || null,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "PUROHIT_PROFILE_CREATE",
    targetType: "PUROHIT_PROFILE",
    targetId: profile.id,
    details: { fullName: profile.fullName, serviceArea: profile.serviceArea },
    ip: getClientIp(req),
  });

  if (linkedUserId) {
    await notify({
      userId: linkedUserId,
      type: "PUROHIT_REGISTERED",
      title: "Purohit Profile Registered",
      message: "Your Purohit profile has been registered and verified by Super Admin. You can now manage your sacred ceremony bookings.",
    });
  }

  const purohitObject = {
    ...profile,
    isVerified: profile.verificationStatus === "VERIFIED",
  };

  return created({ profile: purohitObject, purohit: purohitObject });
});
