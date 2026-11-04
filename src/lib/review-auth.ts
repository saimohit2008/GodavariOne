import { db } from "./db";
import { type ModerationReason, MODERATION_REASONS } from "./reviews";

export interface ReviewModerationAuthResult {
  allowed: boolean;
  reason?: string;
  isOwner?: boolean;
  isSupervisor?: boolean;
  isSuperAdmin?: boolean;
}

// Check if an actor can moderate (hide, remove, restore) a review for a specific listing
export async function canModerateReview(
  actorId: string,
  actorRole: string,
  listingId: string,
  moderationReason?: string
): Promise<ReviewModerationAuthResult> {
  if (actorRole === "SUPER_ADMIN") {
    return { allowed: true, isSuperAdmin: true };
  }

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      category: true,
      ownerId: true,
      ghatDetails: { select: { supervisorId: true } },
    },
  });

  if (!listing) {
    return { allowed: false, reason: "Target listing not found" };
  }

  // Business Owner moderation guard
  if (actorRole === "BUSINESS_OWNER") {
    const isOwner = listing.ownerId === actorId;
    let isAssigned = false;
    if (!isOwner) {
      const assignment = await db.assignment.findFirst({
        where: { userId: actorId, listingId, type: { in: ["LISTING_OWNER", "HOTEL_STAFF"] } },
      });
      isAssigned = !!assignment;
    }

    if (!isOwner && !isAssigned) {
      return { allowed: false, reason: "Business owners can only moderate reviews for their own business listings" };
    }

    // Protection against suppressing legitimate negative criticism:
    // Business owner MUST supply an explicit valid policy violation reason
    if (!moderationReason || !MODERATION_REASONS.includes(moderationReason as ModerationReason)) {
      return {
        allowed: false,
        reason: "Business owners cannot remove or hide reviews without an explicit policy violation reason (abusive language, spam, sensitive information, harassment, or irrelevance). Legitimate criticism and negative feedback must remain visible.",
      };
    }

    return { allowed: true, isOwner: true };
  }

  // Ghat Supervisor moderation guard
  if (actorRole === "GHAT_SUPERVISOR") {
    if (listing.category !== "GHAT") {
      return { allowed: false, reason: "Ghat Supervisors can only moderate reviews for bathing ghats" };
    }

    const [assignment, isDirectSupervisor] = await Promise.all([
      db.assignment.findFirst({
        where: { userId: actorId, listingId, type: "GHAT_SUPERVISOR" },
      }),
      listing.ghatDetails?.supervisorId === actorId,
    ]);

    if (!assignment && !isDirectSupervisor) {
      return { allowed: false, reason: "You are not authorized to moderate reviews for this unassigned ghat" };
    }

    if (!moderationReason || !MODERATION_REASONS.includes(moderationReason as ModerationReason)) {
      return {
        allowed: false,
        reason: "Moderation requires an explicit policy violation reason (abusive language, spam, sensitive info, harassment, etc.).",
      };
    }

    return { allowed: true, isSupervisor: true };
  }

  // Directory editors, booking reviewers, ghat reporters and visitors cannot moderate
  return {
    allowed: false,
    reason: "Your role is not authorized to moderate reviews. You may report inappropriate reviews for administrator review.",
  };
}

// Check if an actor can view unmoderated / hidden reviews and moderation queue for a listing
export async function canViewModerationQueue(
  actorId: string,
  actorRole: string,
  listingId?: string
): Promise<{ allowed: boolean; allowedListingIds?: string[]; isSuperAdmin?: boolean }> {
  if (actorRole === "SUPER_ADMIN") {
    return { allowed: true, isSuperAdmin: true };
  }

  if (actorRole === "BUSINESS_OWNER") {
    const [owned, assigned] = await Promise.all([
      db.listing.findMany({ where: { ownerId: actorId }, select: { id: true } }),
      db.assignment.findMany({ where: { userId: actorId, type: { in: ["LISTING_OWNER", "HOTEL_STAFF"] } }, select: { listingId: true } }),
    ]);
    const allowedListingIds = [...new Set([...owned.map((l) => l.id), ...assigned.map((a) => a.listingId).filter(Boolean)])] as string[];
    if (listingId && !allowedListingIds.includes(listingId)) {
      return { allowed: false };
    }
    return { allowed: allowedListingIds.length > 0, allowedListingIds };
  }

  if (actorRole === "GHAT_SUPERVISOR") {
    const [assigned, direct] = await Promise.all([
      db.assignment.findMany({ where: { userId: actorId, type: "GHAT_SUPERVISOR" }, select: { listingId: true } }),
      db.ghatDetails.findMany({ where: { supervisorId: actorId }, select: { listingId: true } }),
    ]);
    const allowedListingIds = [...new Set([...assigned.map((a) => a.listingId), ...direct.map((d) => d.listingId)].filter(Boolean))] as string[];
    if (listingId && !allowedListingIds.includes(listingId)) {
      return { allowed: false };
    }
    return { allowed: allowedListingIds.length > 0, allowedListingIds };
  }

  return { allowed: false };
}
