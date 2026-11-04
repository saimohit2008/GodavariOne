export type PriorityCategory = "SENIOR_CITIZEN" | "PERSON_WITH_DISABILITY";

export type PriorityBookingStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ADDITIONAL_PROOF_REQUIRED"
  | "APPROVED"
  | "SLOT_ASSIGNED"
  | "REJECTED"
  | "CANCELLED"
  | "CHECKED_IN";

export const PRIORITY_STATUSES: PriorityBookingStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ADDITIONAL_PROOF_REQUIRED",
  "APPROVED",
  "SLOT_ASSIGNED",
  "REJECTED",
  "CANCELLED",
  "CHECKED_IN",
];

export const VALID_STATUS_TRANSITIONS: Record<PriorityBookingStatus, PriorityBookingStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "ADDITIONAL_PROOF_REQUIRED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "ADDITIONAL_PROOF_REQUIRED", "REJECTED", "CANCELLED"],
  ADDITIONAL_PROOF_REQUIRED: ["SUBMITTED", "UNDER_REVIEW", "REJECTED", "CANCELLED"],
  APPROVED: ["SLOT_ASSIGNED", "CANCELLED", "UNDER_REVIEW"],
  SLOT_ASSIGNED: ["CHECKED_IN", "CANCELLED", "APPROVED"], // Reverting to APPROVED allows re-slotting
  REJECTED: [], // Rejected cannot receive slots or transition unless Super Admin overrides
  CANCELLED: [],
  CHECKED_IN: [], // Final terminal state
};

/**
 * Calculates exact age in full completed years on a specific target date
 */
export function calculateAgeOnDate(dobStr: string, targetDateStr: string): number {
  const birth = new Date(dobStr);
  const target = new Date(targetDateStr);

  if (isNaN(birth.getTime()) || isNaN(target.getTime())) {
    throw new Error("Invalid date format for birth date or visit date");
  }

  let age = target.getFullYear() - birth.getFullYear();
  const m = target.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && target.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Generates an opaque, human-friendly application number (e.g. PGB-2027-A8B9C2)
 */
export function generateApplicationNumber(): string {
  const bytes = new Uint8Array(3);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 3; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `PGB-2027-${rand}`;
}

/**
 * Validates whether a state transition is permitted based on actor role and current status
 */
export function isValidStatusTransition(
  fromStatus: PriorityBookingStatus,
  toStatus: PriorityBookingStatus,
  actorRole: string,
  isOverride = false
): { valid: boolean; reason?: string } {
  if (fromStatus === toStatus) {
    return { valid: true };
  }

  // Super Admin can override with a recorded reason
  if (actorRole === "SUPER_ADMIN" && isOverride) {
    if (fromStatus === "CHECKED_IN") {
      return { valid: false, reason: "Cannot override an application that has already completed entry check-in." };
    }
    return { valid: true };
  }

  const allowedNext = VALID_STATUS_TRANSITIONS[fromStatus] || [];
  if (!allowedNext.includes(toStatus)) {
    return {
      valid: false,
      reason: `Invalid status transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowedNext.join(", ") || "None"}.`,
    };
  }

  return { valid: true };
}
