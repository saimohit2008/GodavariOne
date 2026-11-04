// Godavari One — NRI Custom Package Workflow Constants & Types

export const NRI_MIN_GROUP_SIZE = 2;
export const NRI_MAX_GROUP_SIZE = 10;

export type NriRequestStatus =
  | "SUBMITTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "QUOTATION_DRAFT"
  | "QUOTATION_SENT"
  | "REVISION_REQUESTED"
  | "QUOTATION_ACCEPTED"
  | "AWAITING_FINAL_CONFIRMATION"
  | "CONFIRMED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"
  | "CLOSED";

export type NriQuotationStatus =
  | "DRAFT"
  | "SENT"
  | "REVISION_REQUESTED"
  | "ACCEPTED"
  | "DECLINED"
  | "WITHDRAWN"
  | "CONFIRMED"
  | "CLOSED";

export interface NriDaySchedule {
  day: number;
  date?: string;
  title: string;
  description: string;
  ghatVisits?: string;
  templeVisits?: string;
  mealsIncluded?: string;
}

export interface NriLineItemInput {
  id?: string;
  category: "ACCOMMODATION" | "TRANSPORT" | "MEALS" | "SIGHTSEEING_GUIDE" | "TAX_FEES" | "DISCOUNT" | "OTHER";
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  isOptional?: boolean;
}

// 10 Complete All-Inclusive Package Requirements (Prompt Requirement 3)
export const NRI_STANDARD_PACKAGE_SERVICES = [
  { id: "pickup_drop", label: "Airport or Railway Station Pickup and Drop-off", desc: "Private VIP vehicle coordination from RJA/VGA/VTZ/HYD or local railway stations" },
  { id: "accommodation", label: "Accommodation, Room Arrangement & Duration of Stay", desc: "Premium AC rooms/suites, heritage riverside resorts, or luxury hotel stays" },
  { id: "meals", label: "Food & Included Meals", desc: "Pure vegetarian, Satvik, South Indian traditional meals, and special dietary arrangements" },
  { id: "transport", label: "Local Transportation & Vehicle Arrangements", desc: "Dedicated AC chauffeur-driven Innova Crysta / Tempo Traveller for the complete stay" },
  { id: "ghat_visits", label: "Godavari Pushkaralu Ghat Visits", desc: "VIP/Pushkar Ghat, Kotilingala, and Saraswati Ghat holy bath & evening harathi priority assistance" },
  { id: "sightseeing", label: "Temple Visits & Local Sightseeing", desc: "Kotilingeshwara Swamy, Draksharamam, Annavaram, Dindi backwaters, and Pattiseema excursions" },
  { id: "guide", label: "Tour Guide & Language Assistance", desc: "Dedicated English, Telugu, and Hindi speaking cultural & spiritual pilgrimage guide" },
  { id: "coordination", label: "Arrival & Departure Coordination", desc: "24/7 dedicated local concierge, baggage assistance, and emergency logistics" },
  { id: "itinerary", label: "Complete Day-by-Day Itinerary", desc: "Structured sacred schedule customized to the group's pace, elders, and family preferences" },
  { id: "terms_pricing", label: "All Inclusions, Exclusions, Disclosed Charges & Terms", desc: "Transparent breakdown with no hidden fees, clear cancellation terms, and verified arrangements" },
] as const;

export const NRI_DEFAULT_INCLUSIONS = [
  "Air-conditioned private vehicle for the entire itinerary including tolls and parking",
  "Dedicated airport/railway station meet & greet with welcome garland",
  "All room accommodations with daily breakfast and dinner included",
  "Assisted VIP holy bath (Pushkara Snanam) pass and priest coordination",
  "Sightseeing excursions with licensed English/Telugu speaking guide",
  "Bottled mineral water and light traditional refreshments during travel",
  "24x7 local on-ground concierge support and coordination",
];

export const NRI_DEFAULT_EXCLUSIONS = [
  "Domestic or international airfare to/from entry airport",
  "Personal pooja donations, dakshina, and special temple archanas",
  "Alcohol, room service orders, and laundry expenses",
  "Travel insurance and personal medical expenses",
];

export const NRI_STATUS_META: Record<NriRequestStatus, { label: string; color: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  SUBMITTED: { label: "Request Submitted", color: "bg-blue-100 text-blue-800 border-blue-200", badgeVariant: "secondary" },
  ASSIGNED: { label: "Assigned to Provider", color: "bg-purple-100 text-purple-800 border-purple-200", badgeVariant: "secondary" },
  IN_PROGRESS: { label: "Quotation in Preparation", color: "bg-amber-100 text-amber-800 border-amber-200", badgeVariant: "secondary" },
  QUOTATION_DRAFT: { label: "Draft Quotation", color: "bg-slate-100 text-slate-800 border-slate-200", badgeVariant: "outline" },
  QUOTATION_SENT: { label: "Quotation Sent", color: "bg-teal-100 text-teal-800 border-teal-200", badgeVariant: "default" },
  REVISION_REQUESTED: { label: "Revision Requested", color: "bg-orange-100 text-orange-800 border-orange-200", badgeVariant: "secondary" },
  QUOTATION_ACCEPTED: { label: "Quotation Accepted", color: "bg-emerald-100 text-emerald-800 border-emerald-200", badgeVariant: "default" },
  AWAITING_FINAL_CONFIRMATION: { label: "Awaiting Service Verification", color: "bg-cyan-100 text-cyan-800 border-cyan-200", badgeVariant: "secondary" },
  CONFIRMED: { label: "Package Confirmed", color: "bg-emerald-600 text-white border-emerald-700", badgeVariant: "default" },
  DECLINED: { label: "Declined", color: "bg-red-100 text-red-800 border-red-200", badgeVariant: "destructive" },
  EXPIRED: { label: "Expired", color: "bg-gray-100 text-gray-800 border-gray-200", badgeVariant: "outline" },
  CANCELLED: { label: "Cancelled", color: "bg-rose-100 text-rose-800 border-rose-200", badgeVariant: "destructive" },
  CLOSED: { label: "Closed", color: "bg-gray-200 text-gray-700 border-gray-300", badgeVariant: "outline" },
};

// Valid status lifecycle transitions
export const VALID_REQUEST_TRANSITIONS: Record<NriRequestStatus, NriRequestStatus[]> = {
  SUBMITTED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "QUOTATION_DRAFT", "QUOTATION_SENT", "DECLINED", "EXPIRED", "CANCELLED", "CLOSED"],
  IN_PROGRESS: ["QUOTATION_DRAFT", "QUOTATION_SENT", "DECLINED", "CANCELLED", "CLOSED"],
  QUOTATION_DRAFT: ["QUOTATION_SENT", "CANCELLED", "CLOSED"],
  QUOTATION_SENT: ["REVISION_REQUESTED", "QUOTATION_ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED", "CLOSED"],
  REVISION_REQUESTED: ["QUOTATION_SENT", "DECLINED", "CANCELLED", "CLOSED"],
  QUOTATION_ACCEPTED: ["AWAITING_FINAL_CONFIRMATION", "CANCELLED", "CLOSED"],
  AWAITING_FINAL_CONFIRMATION: ["CONFIRMED", "DECLINED", "CANCELLED", "CLOSED"],
  CONFIRMED: ["CLOSED", "CANCELLED"],
  DECLINED: ["ASSIGNED", "CLOSED"],
  EXPIRED: ["ASSIGNED", "CLOSED"],
  CANCELLED: ["CLOSED"],
  CLOSED: ["ASSIGNED"], // Super admin can reopen
};

export function isValidNriStatusTransition(from: NriRequestStatus, to: NriRequestStatus, role: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (from === to) return true;
  const allowed = VALID_REQUEST_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function formatNriCurrency(amount: number, currency = "INR"): string {
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
