// Godavari One — roles, permissions, and constants

export type Role =
  | "SUPER_ADMIN"
  | "VISITOR"
  | "BUSINESS_OWNER"
  | "BOOKING_REVIEWER"
  | "GHAT_SUPERVISOR"
  | "PUROHIT"
  | "NRI_SERVICE_MANAGER";

export type ListingCategory =
  | "RESTAURANT"
  | "HOTEL"
  | "GHAT"
  | "HOSPITAL"
  | "TRANSPORT"
  | "TOURIST_SPOT"
  | "FREE_ACCOMMODATION"
  | "ANNADANAM"
  | "CEREMONY";

export type PublicationStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "SUSPENDED"
  | "ARCHIVED";

export type CrowdStatus = "FREE" | "MODERATE" | "CROWDED" | "CLOSED" | "OVERCROWDED" | "EMERGENCY";

export type BookingStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

// Roles the Super Admin is allowed to create/assign through the admin endpoint.
// Visitor is intentionally EXCLUDED — visitors self-register via the public flow.
export const ADMIN_CREATABLE_ROLES: Role[] = [
  "BUSINESS_OWNER",
  "BOOKING_REVIEWER",
  "GHAT_SUPERVISOR",
  "PUROHIT",
  "NRI_SERVICE_MANAGER",
];

export const ALL_ROLES: Role[] = [
  "SUPER_ADMIN",
  "VISITOR",
  ...ADMIN_CREATABLE_ROLES,
];

export const OPERATIONAL_ROLES: Role[] = [...ADMIN_CREATABLE_ROLES, "SUPER_ADMIN"];

export const CATEGORY_META: Record<
  ListingCategory,
  { label: string; teLabel: string; icon: string; color: string }
> = {
  RESTAURANT: { label: "Restaurants & Dining", teLabel: "రెస్టారెంట్‌లు & భోజనం", icon: "UtensilsCrossed", color: "amber" },
  HOTEL: { label: "Hotels & Accommodation", teLabel: "హోటళ్లు & వసతి", icon: "BedDouble", color: "teal" },
  GHAT: { label: "Ghats", teLabel: "ఘాట్‌లు", icon: "Waves", color: "sky" },
  HOSPITAL: { label: "Hospitals & Medical", teLabel: "ఆసుపత్రులు & వైద్యం", icon: "Stethoscope", color: "rose" },
  TRANSPORT: { label: "Travel & Transport", teLabel: "ప్రయాణం & రవాణా", icon: "Bus", color: "violet" },
  TOURIST_SPOT: { label: "Tourist Spots & Heritage", teLabel: "పర్యాటక స్థలాలు", icon: "Landmark", color: "emerald" },
  FREE_ACCOMMODATION: { label: "Free Accommodation", teLabel: "ఉచిత వసతి కేంద్రాలు", icon: "Home", color: "indigo" },
  ANNADANAM: { label: "Free Annadanam & Prasadam", teLabel: "ఉచిత అన్నదానం & ప్రసాదం", icon: "Soup", color: "orange" },
  CEREMONY: { label: "Ceremony Portal", teLabel: "పూజా & వైదిక పోర్టల్", icon: "Flame", color: "amber" },
};

export const CROWD_META: Record<CrowdStatus, { label: string; teLabel: string; color: string }> = {
  FREE: { label: "Free", teLabel: "ఖాళీ", color: "emerald" },
  MODERATE: { label: "Moderate", teLabel: "మధ్యమ", color: "amber" },
  CROWDED: { label: "Crowded", teLabel: "రద్దీ", color: "orange" },
  CLOSED: { label: "Closed", teLabel: "మూసివేయబడింది", color: "slate" },
  OVERCROWDED: { label: "Overcrowded", teLabel: "చాలా రద్దీ", color: "red" },
  EMERGENCY: { label: "Emergency", teLabel: "అత్యవసరం", color: "red" },
};

export const EMERGENCY_CONTACTS = [
  { name: "Police", teName: "పోలీసు", number: "100" },
  { name: "Ambulance", teName: "అంబులెన్స్", number: "108" },
  { name: "Fire Emergency", teName: "అగ్నిమాపన", number: "101" },
  { name: "Women Helpline", teName: "మహిళా హెల్ప్‌లైన్", number: "1091" },
  { name: "Child Helpline", teName: "శిశు హెల్ప్‌లైన్", number: "1098" },
  { name: "Disaster Management", teName: "విపత్తు నిర్వహణ", number: "1070" },
];

// Permission matrix — backend authoritative source.
export function canCreateRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole !== "SUPER_ADMIN") return false;
  return ADMIN_CREATABLE_ROLES.includes(targetRole);
}

export function canManageListings(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "BUSINESS_OWNER";
}

export function canPublishListings(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function canManageUsers(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function canReviewBookings(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "BOOKING_REVIEWER" || role === "BUSINESS_OWNER";
}

export function canReportCrowd(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "GHAT_SUPERVISOR";
}

export function canSuperviseGhats(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "GHAT_SUPERVISOR";
}

export function canViewAuditLogs(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function canAccessAdmin(role: Role): boolean {
  return OPERATIONAL_ROLES.includes(role);
}
