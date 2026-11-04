import { NextRequest } from "next/server";
import net from "net";
import { db, containsInsensitive } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { savePrivateDocument } from "@/lib/private-storage";
import {
  calculateAgeOnDate,
  generateApplicationNumber,
  getSupervisorAssignedGhatIds,
  type PriorityCategory,
} from "@/lib/priority-booking";
import { z } from "zod";
import { queueEmailNotification } from "@/lib/email-service";

// ---------------------------------------------------------------------------
// Rate Limiting for Anonymous Priority Booking Applications
// ---------------------------------------------------------------------------

interface AnonymousRateLimitRecord {
  count: number;
  firstRequestAt: number;
}

const anonymousRateLimits = new Map<string, AnonymousRateLimitRecord>();
const MAX_ANONYMOUS_BOOKINGS = 5; // Maximum 5 submissions per sliding window
const ANONYMOUS_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Resolves client IP securely without blindly trusting client-injected headers.
 * Validates that any IP extracted conforms to a valid IPv4 or IPv6 pattern.
 */
export function getValidatedClientIp(req: Request | NextRequest): string {
  // 1. NextRequest edge IP when set by runtime
  if ((req as any).ip && typeof (req as any).ip === "string" && net.isIP((req as any).ip)) {
    return (req as any).ip;
  }

  // 2. Reverse proxy headers set by edge CDN (Vercel / Nginx / Cloudflare)
  const headerKeys = ["x-real-ip", "x-vercel-ip", "cf-connecting-ip"];
  for (const key of headerKeys) {
    const val = req.headers.get(key)?.trim();
    if (val && net.isIP(val)) {
      return val;
    }
  }

  // 3. Fallback to leftmost IP from x-forwarded-for, strictly validated
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const candidate = fwd.split(",")[0].trim();
    if (net.isIP(candidate)) {
      return candidate;
    }
  }

  return "untrusted_ip";
}

export function checkAnonymousBookingRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMinutes?: number;
  remaining: number;
} {
  const now = Date.now();
  const record = anonymousRateLimits.get(ip);

  if (!record || now - record.firstRequestAt > ANONYMOUS_WINDOW_MS) {
    anonymousRateLimits.set(ip, { count: 1, firstRequestAt: now });
    return { allowed: true, remaining: MAX_ANONYMOUS_BOOKINGS - 1 };
  }

  if (record.count >= MAX_ANONYMOUS_BOOKINGS) {
    const remainingMs = ANONYMOUS_WINDOW_MS - (now - record.firstRequestAt);
    const retryAfterMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    return { allowed: false, retryAfterMinutes, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: MAX_ANONYMOUS_BOOKINGS - record.count };
}

export function resetAnonymousBookingRateLimits(): void {
  anonymousRateLimits.clear();
}

// POST /api/v1/priority-bookings — Submit a new priority ghat booking application
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);

  // Mandatory authentication enforcement for priority ghat bookings
  if (!ctx) {
    const clientIp = getValidatedClientIp(req);
    const rateLimit = checkAnonymousBookingRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return fail(
        `Too many anonymous booking applications submitted from this IP address. Please wait ${rateLimit.retryAfterMinutes} minute(s) before trying again.`,
        429,
        { retryAfterMinutes: rateLimit.retryAfterMinutes }
      );
    }
    return fail("Authentication required to apply for priority ghat booking", 401);
  }

  const formData = await req.formData().catch(() => null);

  if (!formData) {
    return fail("Invalid form submission. Multipart form data required.", 400);
  }

  const category = (formData.get("category") as string)?.trim() as PriorityCategory;
  const beneficiaryName = (formData.get("beneficiaryName") as string)?.trim();
  const beneficiaryDob = (formData.get("beneficiaryDob") as string)?.trim();
  const beneficiaryPhone = (formData.get("beneficiaryPhone") as string)?.trim();
  const beneficiaryEmail = (formData.get("beneficiaryEmail") as string)?.trim() || null;
  const ghatId = (formData.get("ghatId") as string)?.trim();
  const visitDate = (formData.get("visitDate") as string)?.trim();
  const accompanyingCountStr = (formData.get("accompanyingCount") as string)?.trim() || "0";
  const accessibilityNeeds = (formData.get("accessibilityNeeds") as string)?.trim() || null;

  const isCaregiverApplication = formData.get("isCaregiverApplication") === "true";
  const applicantName = (formData.get("applicantName") as string)?.trim() || null;
  const applicantPhone = (formData.get("applicantPhone") as string)?.trim() || null;
  const applicantRelationship = (formData.get("applicantRelationship") as string)?.trim() || null;

  const applicantDeclaration = formData.get("applicantDeclaration") === "true";
  const consentGiven = formData.get("consentGiven") === "true";

  const file = formData.get("file");

  // Validations
  if (!category || !["SENIOR_CITIZEN", "PERSON_WITH_DISABILITY"].includes(category)) {
    return fail("Eligibility category must be SENIOR_CITIZEN or PERSON_WITH_DISABILITY.", 422);
  }

  if (!beneficiaryName || beneficiaryName.length < 2) {
    return fail("Beneficiary full name is required (min 2 characters).", 422);
  }

  if (!beneficiaryPhone || !/^\+?[0-9]{10,13}$/.test(beneficiaryPhone.replace(/[\s-]/g, ""))) {
    return fail("A valid 10-digit contact phone number is required.", 422);
  }

  if (!ghatId) {
    return fail("Please select a valid destination ghat.", 422);
  }

  if (!visitDate || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
    return fail("A proposed visit date in YYYY-MM-DD format is required.", 422);
  }

  const accompanyingCount = parseInt(accompanyingCountStr, 10);
  if (isNaN(accompanyingCount) || accompanyingCount < 0 || accompanyingCount > 2) {
    return fail("Accompanying persons count must be between 0 and 2.", 422);
  }

  if (!applicantDeclaration) {
    return fail("The applicant declaration must be accepted.", 422);
  }

  if (!consentGiven) {
    return fail("Consent for secure document verification and processing is mandatory.", 422);
  }

  if (isCaregiverApplication && (!applicantName || !applicantPhone)) {
    return fail("Caregiver / family member name and phone number are required.", 422);
  }

  // Verify destination Ghat exists
  const ghat = await db.listing.findUnique({
    where: { id: ghatId },
    include: { ghatDetails: true },
  });

  if (!ghat || ghat.category !== "GHAT") {
    return fail("Selected destination ghat was not found or is invalid.", 404);
  }

  // Age eligibility verification for Senior Citizens
  let beneficiaryAge: number | null = null;
  if (category === "SENIOR_CITIZEN") {
    if (!beneficiaryDob || !/^\d{4}-\d{2}-\d{2}$/.test(beneficiaryDob)) {
      return fail("Date of birth is required for Senior Citizen priority booking.", 422);
    }

    try {
      beneficiaryAge = calculateAgeOnDate(beneficiaryDob, visitDate);
    } catch {
      return fail("Invalid date of birth provided.", 422);
    }

    if (beneficiaryAge < 65) {
      return fail(
        `Senior citizen priority booking requires the beneficiary to be 65 years of age or older on the visit date (${visitDate}). Calculated age is ${beneficiaryAge} years.`,
        422
      );
    }
  }

  // Document upload validation
  if (!file || !(file instanceof File)) {
    return fail("A supporting proof document (e.g. Age ID / Disability Certificate) is required.", 422);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let savedDoc;
  try {
    savedDoc = await savePrivateDocument(buffer, file.name, file.type);
  } catch (err: any) {
    return fail(err.message || "Failed to process supporting proof document.", 400);
  }

  const applicationNumber = generateApplicationNumber();

  // Create booking
  const booking = await db.priorityGhatBooking.create({
    data: {
      applicationNumber,
      ghatId,
      userId: ctx.user.id,
      category,
      beneficiaryName,
      beneficiaryDob: beneficiaryDob || null,
      beneficiaryAge,
      beneficiaryPhone,
      beneficiaryEmail,
      isCaregiverApplication,
      applicantName,
      applicantPhone,
      applicantRelationship,
      visitDate,
      accompanyingCount,
      accessibilityNeeds,
      documentPath: savedDoc.relativePath,
      documentOriginalName: savedDoc.originalName,
      documentMimeType: savedDoc.mimeType,
      documentSizeBytes: savedDoc.sizeBytes,
      status: "SUBMITTED",
      applicantDeclaration,
      consentGiven,
    },
  });

  // Create initial history record
  await db.priorityBookingHistory.create({
    data: {
      bookingId: booking.id,
      fromStatus: "NONE",
      toStatus: "SUBMITTED",
      changedById: ctx?.user.id || null,
      changedByName: ctx?.user.name || applicantName || beneficiaryName,
      reason: "Initial application submitted with supporting proof document",
    },
  });

  // Notify applicant if user account exists
  if (ctx?.user) {
    await notify({
      userId: ctx.user.id,
      type: "PRIORITY_BOOKING_SUBMITTED",
      title: "Priority Booking Application Received",
      message: `Your priority application (${applicationNumber}) for ${ghat.name} has been submitted and is awaiting human verification.`,
      link: "/bookings",
    });
  }

  // Notify assigned Ghat Supervisor(s)
  const supervisors = await db.assignment.findMany({
    where: {
      type: "GHAT_SUPERVISOR",
      listingId: ghatId,
    },
    select: { userId: true },
  });

  if (ghat.ghatDetails?.supervisorId) {
    supervisors.push({ userId: ghat.ghatDetails.supervisorId });
  }

  for (const s of supervisors) {
    await notify({
      userId: s.userId,
      type: "PRIORITY_BOOKING_PENDING_REVIEW",
      title: "New Priority Ghat Booking Awaiting Review",
      message: `A new ${category === "SENIOR_CITIZEN" ? "Senior Citizen" : "Disability"} priority application (${applicationNumber}) has been submitted for ${ghat.name}.`,
      link: "/dashboard",
    });
  }

  // Audit log (Notice: no certificate binary or contents recorded)
  await audit({
    actorId: ctx.user.id,
    action: "PRIORITY_BOOKING_SUBMIT",
    targetType: "PRIORITY_GHAT_BOOKING",
    targetId: booking.id,
    details: {
      applicationNumber,
      category,
      ghatId,
      visitDate,
      isCaregiverApplication,
      beneficiaryAge,
    },
    ip: getClientIp(req),
  });

  // Automated Email Notification
  if (ctx.user.email) {
    queueEmailNotification({
      eventType: "BOOKING_SUCCESSFUL",
      userId: ctx.user.id,
      bookingId: booking.id,
      bookingReference: applicationNumber,
      bookingCategory: "Ghat priority pass",
      recipientEmail: ctx.user.email,
      recipientName: ctx.user.name || booking.beneficiaryName,
      language: (ctx.user as any)?.language || "en",
      payload: {
        eventType: "BOOKING_SUCCESSFUL",
        customerName: booking.beneficiaryName,
        bookingReference: applicationNumber,
        bookingCategory: "Ghat priority pass",
        serviceName: `Priority Ghat Pass (${category === "SENIOR_CITIZEN" ? "Senior Citizen" : "Person with Disability"}) - ${ghat.name}`,
        bookingDate: booking.visitDate,
        bookingTime: "Slot allocation pending supervisor verification",
        location: `${ghat.name}, Rajahmundry`,
        guestsOrParticipants: `1 Beneficiary + ${booking.accompanyingCount} Companion(s)`,
        bookingStatus: "PENDING_REVIEW",
        cancellationInstructions: "You may cancel your application anytime from your account dashboard before slot allocation.",
        myBookingsUrl: "/bookings",
        supportContact: "support@godavari-one.org",
      },
    }).catch((err) => console.error("[PriorityBooking] Failed to queue email notification:", err));
  }

  return ok({
    success: true,
    bookingId: booking.id,
    applicationNumber,
    status: booking.status,
    category: booking.category,
    beneficiaryName: booking.beneficiaryName,
    ghatName: ghat.name,
    visitDate: booking.visitDate,
  });
});

// GET /api/v1/priority-bookings — List priority booking applications with role-based scoping
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const url = new URL(req.url);
  const ghatId = url.searchParams.get("ghatId") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const visitDate = url.searchParams.get("visitDate") || undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * limit;

  const role = ctx.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSupervisor = role === "GHAT_SUPERVISOR";

  const whereClause: any = {};

  if (isSuperAdmin) {
    if (ghatId) whereClause.ghatId = ghatId;
  } else if (isSupervisor) {
    // Strictly restrict to supervisor's assigned ghats
    const assignedGhatIds = await getSupervisorAssignedGhatIds(ctx.user.id);
    if (assignedGhatIds.length === 0) {
      return ok({ items: [], total: 0, page, limit, totalPages: 0 });
    }

    if (ghatId) {
      if (!assignedGhatIds.includes(ghatId)) {
        return fail("Access denied. You are not assigned to supervise this ghat.", 403);
      }
      whereClause.ghatId = ghatId;
    } else {
      whereClause.ghatId = { in: assignedGhatIds };
    }
  } else {
    // Regular visitor can ONLY see their own applications
    whereClause.userId = ctx.user.id;
    if (ghatId) whereClause.ghatId = ghatId;
  }

  if (category) whereClause.category = category;
  if (status) whereClause.status = status;
  if (visitDate) whereClause.visitDate = visitDate;

  if (search) {
    whereClause.OR = [
      { applicationNumber: containsInsensitive(search) },
      { beneficiaryName: containsInsensitive(search) },
      { beneficiaryPhone: containsInsensitive(search) },
      { applicantName: containsInsensitive(search) },
    ];
  }

  const [items, total] = await Promise.all([
    db.priorityGhatBooking.findMany({
      where: whereClause,
      include: {
        ghat: {
          select: {
            id: true,
            name: true,
            town: true,
            district: true,
            locality: true,
          },
        },
        timeSlot: {
          select: {
            id: true,
            slotDate: true,
            startTime: true,
            endTime: true,
            status: true,
            accessibilityNotes: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.priorityGhatBooking.count({ where: whereClause }),
  ]);

  // Strip sensitive reviewer internal notes for regular visitors
  const sanitizedItems = items.map((b) => {
    if (!isSuperAdmin && !isSupervisor && b.userId === ctx.user.id) {
      const { reviewerNotes, ...publicFields } = b;
      return publicFields;
    }
    return b;
  });

  return ok({
    items: sanitizedItems,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});
