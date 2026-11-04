import { db } from "./db";
import type { Role } from "./constants";

export * from "./priority-booking-utils";

/**
 * Strict backend authorization check for Ghat Supervisors
 * Supervisors are strictly restricted to ghats explicitly assigned to them.
 */
export async function canManageGhatPriorityBookings(
  userId: string,
  userRole: string,
  ghatId: string
): Promise<boolean> {
  if (userRole === "SUPER_ADMIN") {
    return true;
  }

  if (userRole !== "GHAT_SUPERVISOR") {
    return false;
  }

  // Check assignment in Assignment table or direct listing supervisor
  const [assignment, listing] = await Promise.all([
    db.assignment.findFirst({
      where: {
        userId,
        type: "GHAT_SUPERVISOR",
        listingId: ghatId,
      },
    }),
    db.listing.findUnique({
      where: { id: ghatId },
      include: { ghatDetails: true },
    }),
  ]);

  if (assignment) return true;
  if (listing?.ghatDetails?.supervisorId === userId) return true;

  return false;
}

/**
 * Retrieves all ghat IDs assigned to a specific supervisor
 */
export async function getSupervisorAssignedGhatIds(userId: string): Promise<string[]> {
  const [assignments, listings] = await Promise.all([
    db.assignment.findMany({
      where: {
        userId,
        type: "GHAT_SUPERVISOR",
      },
      select: { listingId: true },
    }),
    db.ghatDetails.findMany({
      where: { supervisorId: userId },
      select: { listingId: true },
    }),
  ]);

  const ids = new Set<string>();
  assignments.forEach((a) => {
    if (a.listingId) ids.add(a.listingId);
  });
  listings.forEach((l) => {
    if (l.listingId) ids.add(l.listingId);
  });

  return Array.from(ids);
}
