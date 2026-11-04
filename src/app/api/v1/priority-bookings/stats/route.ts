import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";
import { getSupervisorAssignedGhatIds } from "@/lib/priority-booking";

// GET /api/v1/priority-bookings/stats — Operational and analytical reporting
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSupervisor = role === "GHAT_SUPERVISOR";

  if (!isSuperAdmin && !isSupervisor) {
    return fail("Access denied. Administrator or Ghat Supervisor permissions required.", 403);
  }

  const url = new URL(req.url);
  const requestedGhatId = url.searchParams.get("ghatId") || undefined;

  let ghatFilter: any = undefined;

  if (isSupervisor) {
    const assignedIds = await getSupervisorAssignedGhatIds(ctx.user.id);
    if (requestedGhatId) {
      if (!assignedIds.includes(requestedGhatId)) {
        return fail("Access denied for this unassigned ghat.", 403);
      }
      ghatFilter = requestedGhatId;
    } else {
      ghatFilter = { in: assignedIds };
    }
  } else if (requestedGhatId) {
    ghatFilter = requestedGhatId;
  }

  const whereClause: any = ghatFilter ? { ghatId: ghatFilter } : {};

  const [
    totalApplications,
    seniorCount,
    disabilityCount,
    submittedCount,
    underReviewCount,
    additionalProofCount,
    approvedCount,
    slotAssignedCount,
    checkedInCount,
    rejectedCount,
    cancelledCount,
    totalSlots,
    activeSlots,
  ] = await Promise.all([
    db.priorityGhatBooking.count({ where: whereClause }),
    db.priorityGhatBooking.count({ where: { ...whereClause, category: "SENIOR_CITIZEN" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, category: "PERSON_WITH_DISABILITY" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "SUBMITTED" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "UNDER_REVIEW" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "ADDITIONAL_PROOF_REQUIRED" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "APPROVED" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "SLOT_ASSIGNED" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "CHECKED_IN" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "REJECTED" } }),
    db.priorityGhatBooking.count({ where: { ...whereClause, status: "CANCELLED" } }),
    db.ghatTimeSlot.count({ where: whereClause }),
    db.ghatTimeSlot.count({ where: { ...whereClause, status: "ACTIVE" } }),
  ]);

  return ok({
    totalApplications,
    categories: {
      seniorCitizens: seniorCount,
      personsWithDisabilities: disabilityCount,
    },
    workflow: {
      submitted: submittedCount,
      underReview: underReviewCount,
      additionalProofRequired: additionalProofCount,
      approvedPendingSlot: approvedCount,
      slotAssignedConfirmed: slotAssignedCount,
      checkedIn: checkedInCount,
      rejected: rejectedCount,
      cancelled: cancelledCount,
    },
    slots: {
      totalConfigured: totalSlots,
      activeSlots,
    },
    scopedToSupervisor: isSupervisor,
  });
});
