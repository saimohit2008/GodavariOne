// Godavari One — User Reviews, Feedback and Moderation Engine

export const ISSUE_CATEGORIES = [
  "CLEANLINESS",
  "OVERCROWDING",
  "SAFETY",
  "STAFF_BEHAVIOUR",
  "FACILITIES",
  "ACCESSIBILITY",
  "INACCURATE_HOURS",
  "UNAVAILABLE_ACCOMMODATION",
  "INCORRECT_DISTRIBUTION",
  "PRICING",
  "SERVICE_QUALITY",
  "GENERAL",
] as const;

export type IssueCategory = typeof ISSUE_CATEGORIES[number];

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, { label: string; teLabel: string }> = {
  CLEANLINESS: { label: "Cleanliness & Sanitation", teLabel: "పరిశుభ్రత & పారిశుధ్యం" },
  OVERCROWDING: { label: "Overcrowding & Congestion", teLabel: "రద్దీ & రద్దీ నియంత్రణ" },
  SAFETY: { label: "Safety & Security", teLabel: "భద్రత & రక్షణ" },
  STAFF_BEHAVIOUR: { label: "Staff Behaviour", teLabel: "సిబ్బంది ప్రవర్తన" },
  FACILITIES: { label: "Facilities & Amenities", teLabel: "సౌకర్యాలు & ఏర్పాట్లు" },
  ACCESSIBILITY: { label: "Accessibility & Special Assistance", teLabel: "అందుబాటు & ప్రత్యేక సహాయం" },
  INACCURATE_HOURS: { label: "Inaccurate Opening Hours", teLabel: "తప్పుడు ప్రారంభ వేళలు" },
  UNAVAILABLE_ACCOMMODATION: { label: "Unavailable Accommodation", teLabel: "వసతి లభ్యత సమస్య" },
  INCORRECT_DISTRIBUTION: { label: "Incorrect Meal / Annadanam Info", teLabel: "తప్పుడు అన్నదానం సమాచారం" },
  PRICING: { label: "Pricing & Fair Value", teLabel: "ధరలు & విలువ" },
  SERVICE_QUALITY: { label: "Service Quality", teLabel: "సేవా నాణ్యత" },
  GENERAL: { label: "General Experience", teLabel: "సాధారణ అనుభవం" },
};

export const MODERATION_REASONS = [
  "ABUSIVE_LANGUAGE",
  "SPAM",
  "PERSONAL_INFO",
  "HARASSMENT",
  "IRRELEVANT",
  "OTHER",
] as const;

export type ModerationReason = typeof MODERATION_REASONS[number];

export const MODERATION_REASON_LABELS: Record<ModerationReason, string> = {
  ABUSIVE_LANGUAGE: "Abusive or inappropriate language",
  SPAM: "Spam or promotional content",
  PERSONAL_INFO: "Personal or sensitive information",
  HARASSMENT: "Harassment or threats",
  IRRELEVANT: "Irrelevant content",
  OTHER: "Other policy violation",
};

// Mask user's full name into privacy-safe public alias (e.g. "Mohit Sai Kumar" -> "Mohit S.")
export function formatReviewerAlias(fullName?: string | null, phone?: string | null): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0];
    }
    const first = parts[0];
    const lastInitial = parts[parts.length - 1][0]?.toUpperCase();
    return `${first} ${lastInitial}.`;
  }
  if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length >= 4) {
      return `Pilgrim ...${cleaned.slice(-4)}`;
    }
  }
  return "Verified Visitor";
}

// Phone number regex (detects 10-digit Indian numbers, optional +91 or dashes/spaces)
const PHONE_REGEX = /(\+?91[\s-]?)?[6789]\d{9}|\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/;
// Email regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

// Prohibited / abusive keywords filter for automated early detection & flagging
// Note: Legitimate negative feedback ("bad", "terrible", "dirty", "overcrowded", "slow") is NEVER blocked
const ABUSIVE_PATTERNS = [
  /\b(bastard|bitch|asshole|motherfucker|fucker|dickhead|idiot|scoundrel)\b/i,
  /\b(kill you|threat|bomb|attack|murder)\b/i,
  /\b(cheat(?:ers|ing)?|fraud(?:ulent)?|scam(?:mers|ming)?)\s+alert\b/i,
  /\b(lanja|dengu|modda|puku|gudha)\b/i, // Telugu offensive slurs
  /\b(madarchod|bhenchod|chutiya|gaand)\b/i, // Hindi offensive slurs
];

export interface ContentInspectionResult {
  hasSensitiveInfo: boolean;
  hasAbusiveKeywords: boolean;
  shouldAutoFlag: boolean;
  flagReason?: string;
}

export function inspectReviewContent(text: string): ContentInspectionResult {
  if (!text) return { hasSensitiveInfo: false, hasAbusiveKeywords: false, shouldAutoFlag: false };

  let hasSensitiveInfo = false;
  let hasAbusiveKeywords = false;
  const flagReasons: string[] = [];

  if (PHONE_REGEX.test(text) || EMAIL_REGEX.test(text)) {
    hasSensitiveInfo = true;
    flagReasons.push("Contains personal contact numbers or email addresses");
  }

  for (const pattern of ABUSIVE_PATTERNS) {
    if (pattern.test(text)) {
      hasAbusiveKeywords = true;
      flagReasons.push("Contains potentially offensive or unparliamentary language");
      break;
    }
  }

  const shouldAutoFlag = hasSensitiveInfo || hasAbusiveKeywords;

  return {
    hasSensitiveInfo,
    hasAbusiveKeywords,
    shouldAutoFlag,
    flagReason: flagReasons.length > 0 ? flagReasons.join("; ") : undefined,
  };
}

export function calculateRatingSummary(reviews: Array<{ rating: number; status: string; issueCategory?: string | null }>) {
  const published = reviews.filter((r) => r.status === "PUBLISHED");
  const total = published.length;

  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const issueCounts: Record<string, number> = {};

  let sum = 0;
  for (const rev of published) {
    const r = Math.min(5, Math.max(1, rev.rating));
    ratingCounts[r] = (ratingCounts[r] || 0) + 1;
    sum += r;

    if (rev.issueCategory) {
      issueCounts[rev.issueCategory] = (issueCounts[rev.issueCategory] || 0) + 1;
    }
  }

  const averageRating = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

  return {
    averageRating,
    totalReviews: total,
    ratingCounts,
    breakdown: ratingCounts,
    issueCounts,
  };
}
