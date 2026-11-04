import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { z } from "zod";

const availabilitySchema = z.object({
  // Free Accommodation fields
  totalCapacity: z.number().int().min(0).max(100000).optional().nullable(),
  availableCapacity: z.number().int().min(0).max(100000).optional().nullable(),
  capacityMen: z.number().int().min(0).max(50000).optional().nullable(),
  availableMen: z.number().int().min(0).max(50000).optional().nullable(),
  capacityWomen: z.number().int().min(0).max(50000).optional().nullable(),
  availableWomen: z.number().int().min(0).max(50000).optional().nullable(),
  capacityFamily: z.number().int().min(0).max(50000).optional().nullable(),
  availableFamily: z.number().int().min(0).max(50000).optional().nullable(),
  availabilityStatus: z.enum(["AVAILABLE", "FEW_LEFT", "FULL", "NOT_CONFIRMED", "UNAVAILABLE"]).optional(),
  isTemporarilyUnavailable: z.boolean().optional(),

  // Annadanam fields
  servingStatus: z.enum(["ACTIVE", "PAUSED", "ENDED", "TEMPORARILY_UNAVAILABLE"]).optional(),
  statusReason: z.string().max(300).optional().nullable(),
  queueWaitMinutes: z.number().int().min(0).max(360).optional().nullable(),
  remainingServings: z.number().int().min(0).max(100000).optional().nullable(),
  servingsConfirmed: z.boolean().optional(),
  seatingCapacity: z.number().int().min(0).max(10000).optional().nullable(),
});

// PATCH /api/v1/listings/[id]/availability — Authorized staff / Super Admin updates live availability
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      freeAccommodationDetails: true,
      annadanamDetails: true,
    },
  });

  if (!listing) return fail("Listing not found", 404);

  // Permission check
  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isOwner = listing.ownerId === ctx.user.id;

  let isAssignedStaff = false;
  if (!isSuperAdmin && !isOwner) {
    const assignment = await db.assignment.findFirst({
      where: {
        userId: ctx.user.id,
        listingId: id,
      },
    });
    isAssignedStaff = !!assignment;
  }

  if (!isSuperAdmin && !isOwner && !isAssignedStaff) {
    return fail("You are not authorized to update availability for this listing", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");

  const parsed = availabilitySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const data = parsed.data;

  const now = new Date();

  // 1. Handle Free Accommodation Updates
  if (listing.category === "FREE_ACCOMMODATION") {
    const current = listing.freeAccommodationDetails;
    const effectiveTotal = data.totalCapacity !== undefined ? data.totalCapacity : current?.totalCapacity;
    const effectiveAvailable = data.availableCapacity !== undefined ? data.availableCapacity : current?.availableCapacity;

    // Enforce that available capacity cannot exceed total capacity
    if (effectiveTotal != null && effectiveAvailable != null && effectiveAvailable > effectiveTotal) {
      return fail(`Available capacity (${effectiveAvailable}) cannot exceed recorded total capacity (${effectiveTotal})`, 422);
    }

    // Check gender capacities if specified
    const effMenCap = data.capacityMen !== undefined ? data.capacityMen : current?.capacityMen;
    const effMenAvail = data.availableMen !== undefined ? data.availableMen : current?.availableMen;
    if (effMenCap != null && effMenAvail != null && effMenAvail > effMenCap) {
      return fail(`Available capacity for men (${effMenAvail}) cannot exceed recorded capacity (${effMenCap})`, 422);
    }

    const effWomenCap = data.capacityWomen !== undefined ? data.capacityWomen : current?.capacityWomen;
    const effWomenAvail = data.availableWomen !== undefined ? data.availableWomen : current?.availableWomen;
    if (effWomenCap != null && effWomenAvail != null && effWomenAvail > effWomenCap) {
      return fail(`Available capacity for women (${effWomenAvail}) cannot exceed recorded capacity (${effWomenCap})`, 422);
    }

    // Determine automatic availability status if availableCapacity is 0
    let autoStatus = data.availabilityStatus;
    if (!autoStatus && effectiveAvailable != null) {
      if (effectiveAvailable === 0) autoStatus = "FULL";
      else if (effectiveTotal != null && effectiveAvailable <= Math.max(1, Math.floor(effectiveTotal * 0.1))) autoStatus = "FEW_LEFT";
      else autoStatus = "AVAILABLE";
    }

    const updatePayload: Record<string, unknown> = {
      lastAvailabilityUpdate: now,
      updatedById: ctx.user.id,
    };

    if (data.totalCapacity !== undefined) updatePayload.totalCapacity = data.totalCapacity;
    if (data.availableCapacity !== undefined) updatePayload.availableCapacity = data.availableCapacity;
    if (data.capacityMen !== undefined) updatePayload.capacityMen = data.capacityMen;
    if (data.availableMen !== undefined) updatePayload.availableMen = data.availableMen;
    if (data.capacityWomen !== undefined) updatePayload.capacityWomen = data.capacityWomen;
    if (data.availableWomen !== undefined) updatePayload.availableWomen = data.availableWomen;
    if (data.capacityFamily !== undefined) updatePayload.capacityFamily = data.capacityFamily;
    if (data.availableFamily !== undefined) updatePayload.availableFamily = data.availableFamily;
    if (autoStatus !== undefined) updatePayload.availabilityStatus = autoStatus;
    if (data.isTemporarilyUnavailable !== undefined) updatePayload.isTemporarilyUnavailable = data.isTemporarilyUnavailable;

    const updatedDetails = await db.freeAccommodationDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        ...updatePayload,
      },
      update: updatePayload,
    });

    await audit({
      actorId: ctx.user.id,
      action: "ACCOMMODATION_AVAILABILITY_UPDATE",
      targetType: "LISTING",
      targetId: id,
      details: {
        listingName: listing.name,
        availableCapacity: updatedDetails.availableCapacity,
        totalCapacity: updatedDetails.totalCapacity,
        availabilityStatus: updatedDetails.availabilityStatus,
      },
      ip: getClientIp(req),
    });

    return ok({
      ok: true,
      listingId: id,
      freeAccommodationDetails: updatedDetails,
      message: "Free accommodation availability updated successfully.",
    });
  }

  // 2. Handle Annadanam Updates
  if (listing.category === "ANNADANAM") {
    const updatePayload: Record<string, unknown> = {
      lastStatusUpdate: now,
      updatedById: ctx.user.id,
    };

    if (data.servingStatus !== undefined) updatePayload.servingStatus = data.servingStatus;
    if (data.queueWaitMinutes !== undefined) updatePayload.queueWaitMinutes = data.queueWaitMinutes;
    if (data.remainingServings !== undefined) updatePayload.remainingServings = data.remainingServings;
    if (data.seatingCapacity !== undefined) updatePayload.seatingCapacity = data.seatingCapacity;

    const updatedDetails = await db.annadanamDetails.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        ...updatePayload,
      },
      update: updatePayload,
    });

    await audit({
      actorId: ctx.user.id,
      action: "ANNADANAM_AVAILABILITY_UPDATE",
      targetType: "LISTING",
      targetId: id,
      details: {
        listingName: listing.name,
        servingStatus: updatedDetails.servingStatus,
        queueWaitMinutes: updatedDetails.queueWaitMinutes,
        remainingServings: updatedDetails.remainingServings,
      },
      ip: getClientIp(req),
    });

    return ok({
      ok: true,
      listingId: id,
      annadanamDetails: updatedDetails,
      message: "Annadanam serving status and queue details updated successfully.",
    });
  }

  return fail("Availability updates are only supported for Free Accommodation and Annadanam listings", 400);
});
