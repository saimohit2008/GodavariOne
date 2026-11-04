import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updatePurohitSchema = z.object({
  userId: z.string().optional().nullable(),
  fullName: z.string().min(2).optional(),
  profilePhotoUrl: z.string().optional().nullable(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().min(3).optional(),
  serviceArea: z.string().min(2).optional(),
  languages: z.union([z.string(), z.array(z.string())]).optional(),
  ceremonies: z.union([z.string(), z.array(z.string())]).optional(),
  experienceYears: z.number().int().min(1).optional(),
  qualifications: z.string().optional().nullable(),
  customaryPractices: z.string().optional().nullable(),
  baseFee: z.number().min(0).optional(),
  feeIncludes: z.string().optional().nullable(),
  preferredContact: z.enum(["PHONE", "WHATSAPP", "EMAIL"]).optional(),
  workingDays: z.union([z.string(), z.array(z.string())]).optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  breakStart: z.string().optional().nullable(),
  breakEnd: z.string().optional().nullable(),
  slotDurationMinutes: z.number().int().min(15).optional(),
  advanceBookingDays: z.number().int().min(1).optional(),
  cancellationHours: z.number().int().min(1).optional(),
  bio: z.string().optional().nullable(),
  supportingDocuments: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

// GET /api/v1/ceremonies/purohits/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);

  const purohit = await db.purohitProfile.findUnique({
    where: { id },
    include: {
      blockedPeriods: true,
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "COMPLETED", "PENDING"] },
        },
        select: {
          id: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      },
    },
  });

  if (!purohit) return fail("Purohit profile not found", 404);

  const isSuperAdmin = ctx?.user?.role === "SUPER_ADMIN";
  const isOwner = ctx?.user?.id === purohit.userId;

  let languagesArray: string[] = [];
  try {
    languagesArray = typeof purohit.languages === "string" ? JSON.parse(purohit.languages) : purohit.languages;
  } catch {
    languagesArray = [purohit.languages];
  }

  let ceremoniesArray: string[] = [];
  try {
    ceremoniesArray = typeof purohit.ceremonies === "string" ? JSON.parse(purohit.ceremonies) : purohit.ceremonies;
  } catch {
    ceremoniesArray = [purohit.ceremonies];
  }

  let workingDaysArray: string[] = [];
  try {
    workingDaysArray = typeof purohit.workingDays === "string" ? JSON.parse(purohit.workingDays) : purohit.workingDays;
  } catch {
    workingDaysArray = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  }

  // Format response, restricting private contact and document details for public users
  const formatted = {
    id: purohit.id,
    userId: purohit.userId,
    fullName: purohit.fullName,
    profilePhotoUrl: purohit.profilePhotoUrl,
    profilePhoto: purohit.profilePhotoUrl,
    phone: (isSuperAdmin || isOwner) ? purohit.phone : undefined,
    email: (isSuperAdmin || isOwner) ? purohit.email : undefined,
    serviceArea: purohit.serviceArea,
    address: (isSuperAdmin || isOwner) ? purohit.address : undefined,
    languages: languagesArray,
    ceremonies: ceremoniesArray,
    experienceYears: purohit.experienceYears,
    qualifications: purohit.qualifications,
    customaryPractices: purohit.customaryPractices,
    baseFee: purohit.baseFee,
    feeIncludes: purohit.feeIncludes,
    includedServices: purohit.feeIncludes,
    preferredContact: purohit.preferredContact,
    workingDays: workingDaysArray,
    workingHoursStart: purohit.workingHoursStart,
    workingHoursEnd: purohit.workingHoursEnd,
    breakStart: purohit.breakStart,
    breakEnd: purohit.breakEnd,
    slotDurationMinutes: purohit.slotDurationMinutes,
    advanceBookingDays: purohit.advanceBookingDays,
    cancellationHours: purohit.cancellationHours,
    verificationStatus: purohit.verificationStatus,
    isVerified: purohit.verificationStatus === "VERIFIED",
    isActive: purohit.isActive,
    isPublished: purohit.isPublished,
    supportingDocuments: (isSuperAdmin || isOwner) ? purohit.supportingDocuments : undefined,
    bio: purohit.bio,
    blockedPeriods: (isSuperAdmin || isOwner) ? purohit.blockedPeriods : undefined,
    createdAt: purohit.createdAt,
    updatedAt: purohit.updatedAt,
  };

  const response = ok({ purohit: formatted });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
});

// PATCH /api/v1/ceremonies/purohits/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const purohit = await db.purohitProfile.findUnique({ where: { id } });
  if (!purohit) return fail("Purohit profile not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isOwner = ctx.user.id === purohit.userId;

  if (!isSuperAdmin && !isOwner) {
    return fail("Unauthorized to update this purohit profile", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = updatePurohitSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const data = parsed.data;

  // Strict tenant security: ONLY Super Admin can change verificationStatus
  if (data.verificationStatus && !isSuperAdmin) {
    return fail("Only Super Admin can change purohit verification status", 403);
  }
  if (data.isPublished && !isSuperAdmin && purohit.verificationStatus !== "VERIFIED") {
    return fail("Only verified purohits can be published to the public directory", 403);
  }

  const updatePayload: Record<string, unknown> = {};

  if (data.fullName !== undefined) updatePayload.fullName = data.fullName.trim();
  if (data.profilePhotoUrl !== undefined) updatePayload.profilePhotoUrl = data.profilePhotoUrl;
  if (data.phone !== undefined) updatePayload.phone = data.phone.trim();
  if (data.email !== undefined) updatePayload.email = data.email?.trim() || null;
  if (data.address !== undefined) updatePayload.address = data.address.trim();
  if (data.serviceArea !== undefined) updatePayload.serviceArea = data.serviceArea.trim();
  if (data.languages !== undefined) {
    updatePayload.languages = typeof data.languages === "string" ? data.languages : JSON.stringify(data.languages);
  }
  if (data.ceremonies !== undefined) {
    updatePayload.ceremonies = typeof data.ceremonies === "string" ? data.ceremonies : JSON.stringify(data.ceremonies);
  }
  if (data.experienceYears !== undefined) updatePayload.experienceYears = data.experienceYears;
  if (data.qualifications !== undefined) updatePayload.qualifications = data.qualifications?.trim() || null;
  if (data.customaryPractices !== undefined) updatePayload.customaryPractices = data.customaryPractices?.trim() || null;
  if (data.baseFee !== undefined) updatePayload.baseFee = data.baseFee;
  if (data.feeIncludes !== undefined) updatePayload.feeIncludes = data.feeIncludes?.trim() || null;
  if (data.preferredContact !== undefined) updatePayload.preferredContact = data.preferredContact;
  if (data.workingDays !== undefined) {
    updatePayload.workingDays = typeof data.workingDays === "string" ? data.workingDays : JSON.stringify(data.workingDays);
  }
  if (data.workingHoursStart !== undefined) updatePayload.workingHoursStart = data.workingHoursStart;
  if (data.workingHoursEnd !== undefined) updatePayload.workingHoursEnd = data.workingHoursEnd;
  if (data.breakStart !== undefined) updatePayload.breakStart = data.breakStart || null;
  if (data.breakEnd !== undefined) updatePayload.breakEnd = data.breakEnd || null;
  if (data.slotDurationMinutes !== undefined) updatePayload.slotDurationMinutes = data.slotDurationMinutes;
  if (data.advanceBookingDays !== undefined) updatePayload.advanceBookingDays = data.advanceBookingDays;
  if (data.cancellationHours !== undefined) updatePayload.cancellationHours = data.cancellationHours;
  if (data.bio !== undefined) updatePayload.bio = data.bio?.trim() || null;
  if (data.supportingDocuments !== undefined) {
    updatePayload.supportingDocuments = typeof data.supportingDocuments === "string" ? data.supportingDocuments : JSON.stringify(data.supportingDocuments);
  }
  if (isSuperAdmin && data.verificationStatus !== undefined) {
    updatePayload.verificationStatus = data.verificationStatus;
  }
  if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
  if (data.isPublished !== undefined) updatePayload.isPublished = data.isPublished;

  const updated = await db.purohitProfile.update({
    where: { id },
    data: updatePayload,
  });

  await audit({
    actorId: ctx.user.id,
    action: "PUROHIT_PROFILE_UPDATE",
    targetType: "PUROHIT_PROFILE",
    targetId: id,
    details: { changes: updatePayload },
    ip: getClientIp(req),
  });

  if (data.verificationStatus && purohit.userId) {
    await notify({
      userId: purohit.userId,
      type: "PUROHIT_VERIFICATION",
      title: "Verification Status Updated",
      message: `Your Purohit profile verification status is now ${data.verificationStatus}.`,
    });
  }

  return ok({ purohit: updated });
});

// DELETE /api/v1/ceremonies/purohits/[id]
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Only Super Admin can delete purohit profiles", 403);

  await db.purohitProfile.delete({ where: { id } });

  await audit({
    actorId: ctx.user.id,
    action: "PUROHIT_PROFILE_DELETE",
    targetType: "PUROHIT_PROFILE",
    targetId: id,
    ip: getClientIp(req),
  });

  return ok({ ok: true, message: "Purohit profile deleted" });
});
