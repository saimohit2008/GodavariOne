// Godavari One — Centralized Automated Email Notification Service
// Implements Transactional Outbox Pattern, Resend API Delivery, Asia/Kolkata Scheduler & Idempotency.

import { db } from "./db";
import { getResendConfig } from "./resend";
import {
  renderEmail,
  type EmailEventType,
  type EmailLanguage,
  type BookingEmailPayload,
} from "./email-templates";

export interface QueueEmailOptions {
  eventType: EmailEventType;
  userId?: string | null;
  bookingId?: string | null;
  bookingReference?: string | null;
  bookingCategory?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  language?: EmailLanguage;
  subject?: string;
  payload: BookingEmailPayload;
  scheduledFor?: Date;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  sendImmediate?: boolean;
}

/**
 * Parses booking date ("YYYY-MM-DD") and optional time ("HH:MM") in Asia/Kolkata timezone (+05:30)
 */
export function parseKolkataDateTime(dateStr: string, timeStr?: string): Date {
  const cleanDate = dateStr.trim();
  const cleanTime = (timeStr || "06:00").trim();
  // Ensure HH:MM format
  const timeParts = cleanTime.split(":");
  const hours = (timeParts[0] || "06").padStart(2, "0");
  const minutes = (timeParts[1] || "00").slice(0, 2).padStart(2, "0");
  
  // Construct ISO-8601 with +05:30 offset
  const isoString = `${cleanDate}T${hours}:${minutes}:00+05:30`;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    // Fallback if parsing fails
    return new Date(`${cleanDate}T00:00:00Z`);
  }
  return d;
}

/**
 * Queues an email notification in the database outbox.
 * Guarantees that failure to send never rolls back the caller's database transaction.
 */
export async function queueEmailNotification(opts: QueueEmailOptions) {
  const normalizedEmail = (opts.recipientEmail || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    console.warn("[EmailService] Skipped queuing email: invalid recipient email", opts.recipientEmail);
    return null;
  }

  const lang: EmailLanguage = opts.language === "te" ? "te" : "en";
  const config = getResendConfig();
  const appBaseUrl = config?.appBaseUrl || "http://localhost:3000";

  // Render subject if not provided
  let subject = opts.subject;
  if (!subject) {
    const rendered = renderEmail(opts.eventType, opts.payload, lang, appBaseUrl);
    subject = rendered.subject;
  }

  try {
    // Ensure idempotencyKey is always present
    const idKey =
      opts.idempotencyKey ||
      `${opts.eventType}_${opts.bookingId || opts.userId || "anon"}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Check if notification already exists by idempotencyKey
    const existing = await db.emailNotification.findUnique({
      where: { idempotencyKey: idKey },
    });

    if (existing) {
      // Already queued or sent
      return existing;
    }

    const record = await db.emailNotification.create({
      data: {
        eventType: opts.eventType,
        userId: opts.userId || null,
        bookingId: opts.bookingId || null,
        bookingReference: opts.bookingReference || null,
        bookingCategory: opts.bookingCategory || null,
        recipientEmail: normalizedEmail,
        recipientName: opts.recipientName || opts.payload.customerName || null,
        language: lang,
        subject,
        payload: JSON.stringify(opts.payload),
        status: "PENDING",
        scheduledFor: opts.scheduledFor || new Date(),
        idempotencyKey: idKey,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    });

    // If scheduled for now and sendImmediate is requested (default true), attempt dispatch
    const shouldSendNow = (opts.sendImmediate ?? true) && (!opts.scheduledFor || opts.scheduledFor.getTime() <= Date.now() + 5000);
    if (shouldSendNow) {
      // Fire-and-forget: do not block caller
      dispatchNotification(record.id).catch((err) => {
        console.error(`[EmailService] Async dispatch failed for ${record.id}:`, err?.message);
      });
    }

    return record;
  } catch (err: any) {
    // If unique constraint violation race condition occurred, fetch the existing record
    if (err.code === "P2002" || err.message?.includes("idempotencyKey")) {
      const fallbackKey =
        opts.idempotencyKey ||
        `${opts.eventType}_${opts.bookingId || opts.userId || "anon"}`;
      return await db.emailNotification.findFirst({
        where: { idempotencyKey: { startsWith: fallbackKey } },
      });
    }
    console.error("[EmailService] Failed to queue email notification:", err);
    return null;
  }
}

/**
 * Checks if a booking is still active/eligible immediately before sending a reminder.
 */
export async function checkBookingReminderEligibility(category: string, bookingId: string): Promise<boolean> {
  try {
    switch (category) {
      case "HOTEL": {
        const b = await db.hotelBooking.findUnique({ where: { id: bookingId } });
        return Boolean(b && ["APPROVED", "CONFIRMED", "PENDING"].includes(b.status));
      }
      case "RESTAURANT": {
        const b = await db.restaurantBooking.findUnique({ where: { id: bookingId } });
        return Boolean(b && ["APPROVED", "CONFIRMED", "PENDING"].includes(b.status));
      }
      case "CEREMONY": {
        const b = await db.ceremonyBooking.findUnique({ where: { id: bookingId } });
        return Boolean(b && ["CONFIRMED", "PENDING"].includes(b.status));
      }
      case "GHAT_PRIORITY": {
        const b = await db.priorityGhatBooking.findUnique({ where: { id: bookingId } });
        return Boolean(b && ["APPROVED", "SLOT_ASSIGNED", "SUBMITTED"].includes(b.status));
      }
      case "FREE_ACCOMMODATION": {
        const b = await db.freeAccommodationBooking.findUnique({ where: { id: bookingId } });
        return Boolean(b && ["CONFIRMED", "PENDING"].includes(b.status));
      }
      case "NRI_PACKAGE": {
        const b = await db.nriPackageRequest.findUnique({ where: { id: bookingId } });
        return Boolean(b && !["CANCELLED", "DECLINED", "CLOSED"].includes(b.status));
      }
      default:
        return true;
    }
  } catch (err) {
    console.error("[EmailService] Error checking reminder eligibility:", err);
    return true;
  }
}

/**
 * Dispatches a single queued email notification using the official Resend API.
 */
export async function dispatchNotification(id: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const item = await db.emailNotification.findUnique({ where: { id } });
  if (!item) return { success: false, error: "Notification record not found" };

  if (item.status === "SENT") {
    return { success: true, messageId: item.providerMessageId || undefined };
  }
  if (item.status === "CANCELLED") {
    return { success: false, error: "Notification was cancelled" };
  }
  if (item.attemptCount >= item.maxAttempts) {
    return { success: false, error: `Exceeded maximum retry attempts (${item.maxAttempts})` };
  }

  // If this is an automated reminder, recheck booking status immediately before sending
  if (item.eventType.startsWith("BOOKING_REMINDER_") && item.bookingId && item.bookingCategory) {
    const isEligible = await checkBookingReminderEligibility(item.bookingCategory, item.bookingId);
    if (!isEligible) {
      await db.emailNotification.update({
        where: { id },
        data: {
          status: "CANCELLED",
          lastError: "Skipped sending reminder because underlying booking is no longer in an active or confirmed state.",
          updatedAt: new Date(),
        },
      });
      return { success: false, error: "Booking is no longer active" };
    }
  }

  // Atomically mark as PROCESSING
  await db.emailNotification.update({
    where: { id },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  const config = getResendConfig();
  if (!config) {
    const errorMsg = "Resend credentials are not configured (missing RESEND_API_KEY).";
    await db.emailNotification.update({
      where: { id },
      data: {
        status: "FAILED",
        lastError: errorMsg,
        updatedAt: new Date(),
      },
    });
    return { success: false, error: errorMsg };
  }

  try {
    const payload: BookingEmailPayload = JSON.parse(item.payload);
    const lang: EmailLanguage = item.language === "te" ? "te" : "en";
    const { subject, html, text } = renderEmail(item.eventType as EmailEventType, payload, lang, config.appBaseUrl);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [item.recipientEmail],
        subject,
        html,
        text,
        headers: {
          "X-Entity-Ref-ID": item.id,
          "X-Booking-Reference": item.bookingReference || "",
          "X-Event-Type": item.eventType,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.id) {
      const errorMsg = data.message || `Resend delivery failed with HTTP ${res.status}`;
      const newAttempts = item.attemptCount + 1;
      const isExhausted = newAttempts >= item.maxAttempts;

      // Exponential backoff: 2 min, 10 min, 30 min
      const backoffMinutes = Math.pow(newAttempts, 2) * 2;
      const nextScheduled = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await db.emailNotification.update({
        where: { id },
        data: {
          status: isExhausted ? "FAILED" : "PENDING",
          lastError: errorMsg,
          scheduledFor: isExhausted ? item.scheduledFor : nextScheduled,
          updatedAt: new Date(),
        },
      });

      return { success: false, error: errorMsg };
    }

    // Success
    await db.emailNotification.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: data.id,
        lastError: null,
        updatedAt: new Date(),
      },
    });

    return { success: true, messageId: data.id };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : "Network/Dispatch error contacting Resend API";
    const newAttempts = item.attemptCount + 1;
    const isExhausted = newAttempts >= item.maxAttempts;

    await db.emailNotification.update({
      where: { id },
      data: {
        status: isExhausted ? "FAILED" : "PENDING",
        lastError: errorMsg,
        updatedAt: new Date(),
      },
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Worker to process pending outbox notifications in controlled batches.
 * Also recovers stale processing notifications (stuck > 5 minutes).
 */
export async function processOutboxBatch(batchSize = 25): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // 1. Recover stale processing records
  await db.emailNotification.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: fiveMinutesAgo },
    },
    data: {
      status: "PENDING",
      lastError: "Recovered from stale PROCESSING state due to worker restart",
    },
  });

  // 2. Fetch eligible pending items
  const items = await db.emailNotification.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    const res = await dispatchNotification(item.id);
    if (res.success) sent++;
    else failed++;
  }

  return { processed: items.length, sent, failed };
}

/**
 * Schedules 24-hour and 2-hour automated reminders for active confirmed/approved bookings.
 */
export async function scheduleBookingReminders(booking: {
  id?: string;
  bookingId?: string;
  bookingReference?: string;
  category?: "HOTEL" | "RESTAURANT" | "CEREMONY" | "GHAT_PRIORITY" | "FREE_ACCOMMODATION" | "NRI_PACKAGE" | string;
  bookingCategory?: string;
  serviceName: string;
  customerName?: string;
  recipientName?: string;
  recipientEmail: string;
  userId?: string | null;
  bookingDate: string; // YYYY-MM-DD
  bookingTime?: string; // HH:MM
  locationAddress?: string;
  location?: string;
  qrPassToken?: string;
  language?: EmailLanguage;
}): Promise<{ count: number }> {
  let count = 0;
  const bookingId = booking.id || booking.bookingId;
  const category = (booking.category || booking.bookingCategory || "HOTEL").toUpperCase() as any;
  const customerName = booking.customerName || booking.recipientName || "Guest";
  const locationAddress = booking.locationAddress || booking.location || "Rajahmundry Pushkaralu Ghats";
  const normalizedEmail = (booking.recipientEmail || "").trim().toLowerCase();
  if (!bookingId || !normalizedEmail || !normalizedEmail.includes("@")) return { count: 0 };

  const eventStartTime = parseKolkataDateTime(booking.bookingDate, booking.bookingTime);
  const eventTimestamp = eventStartTime.getTime();
  const now = Date.now();

  // If event has already occurred, do not schedule reminders
  if (eventTimestamp <= now) return { count: 0 };

  const reminder24hTime = new Date(eventTimestamp - 24 * 60 * 60 * 1000);
  const reminder2hTime = new Date(eventTimestamp - 2 * 60 * 60 * 1000);

  const payload: BookingEmailPayload = {
    customerName,
    bookingReference: booking.bookingReference || bookingId,
    category,
    serviceName: booking.serviceName,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    locationAddress,
    status: "CONFIRMED",
    qrPassToken: booking.qrPassToken,
  };

  // Schedule 24H reminder only if the 24H window is in the future
  // (Prevents overdue 24H reminders if booked less than 24h before event)
  if (reminder24hTime.getTime() > now) {
    await queueEmailNotification({
      eventType: "BOOKING_REMINDER_24H",
      userId: booking.userId,
      bookingId,
      bookingReference: booking.bookingReference || bookingId,
      bookingCategory: category,
      recipientEmail: normalizedEmail,
      recipientName: customerName,
      language: booking.language || "en",
      payload,
      scheduledFor: reminder24hTime,
      idempotencyKey: `REMINDER_24H_${category}_${bookingId}`,
      sendImmediate: false,
    });
    count++;
  }

  // Schedule 2H reminder only if the 2H window is in the future
  if (reminder2hTime.getTime() > now) {
    await queueEmailNotification({
      eventType: "BOOKING_REMINDER_2H",
      userId: booking.userId,
      bookingId,
      bookingReference: booking.bookingReference || bookingId,
      bookingCategory: category,
      recipientEmail: normalizedEmail,
      recipientName: customerName,
      language: booking.language || "en",
      payload,
      scheduledFor: reminder2hTime,
      idempotencyKey: `REMINDER_2H_${category}_${bookingId}`,
      sendImmediate: false,
    });
    count++;
  }

  return { count };
}

/**
 * Cancels pending scheduled reminder emails for a cancelled or rejected booking.
 */
export async function cancelBookingReminders(bookingId: string) {
  try {
    await db.emailNotification.updateMany({
      where: {
        bookingId,
        eventType: { in: ["BOOKING_REMINDER_24H", "BOOKING_REMINDER_2H"] },
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        lastError: "Cancelled because the underlying booking was cancelled or rejected.",
      },
    });
  } catch (err) {
    console.error(`[EmailService] Failed to cancel reminders for booking ${bookingId}:`, err);
  }
}

/**
 * FEATURE 7: Urgent Ghat Closure Notifications
 * Identifies users with active bookings at the closed ghat and dispatches urgent notifications in batches.
 */
export async function notifyGhatClosure(params: {
  ghatId: string;
  ghatName: string;
  closureReason: string;
  officialInstructions?: string;
  alternativeGhats?: string[];
  effectiveTime?: string;
  emergencyPhone?: string;
  declaredById?: string;
}) {
  const { ghatId, ghatName, closureReason, officialInstructions, alternativeGhats, effectiveTime, emergencyPhone } = params;

  // 1. Find affected Priority Ghat Bookings (Status: APPROVED, SLOT_ASSIGNED, or SUBMITTED with future date)
  const todayStr = new Date().toISOString().split("T")[0];
  const affectedPriorityBookings = await db.priorityGhatBooking.findMany({
    where: {
      ghatId,
      status: { in: ["APPROVED", "SLOT_ASSIGNED", "SUBMITTED"] },
      visitDate: { gte: todayStr },
    },
    include: {
      user: { select: { id: true, name: true, email: true, emailVerified: true } },
      timeSlot: true,
    },
  });

  // 2. Find affected Ceremony Bookings scheduled at this ghat
  const affectedCeremonyBookings = await db.ceremonyBooking.findMany({
    where: {
      bookingDate: { gte: todayStr },
      status: { in: ["CONFIRMED", "PENDING"] },
      OR: [
        { locationAddress: { contains: ghatName } },
        { locationType: "GHAT" },
      ],
    },
    include: {
      visitor: { select: { id: true, name: true, email: true, emailVerified: true } },
    },
  });

  const queuedRecords: any[] = [];
  const closureTimestamp = effectiveTime || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // Queue closure notifications for Priority Ghat Bookings
  for (const b of affectedPriorityBookings) {
    const email = b.beneficiaryEmail || b.user?.email;
    if (!email) continue;

    const payload: BookingEmailPayload = {
      customerName: b.beneficiaryName || b.applicantName || "Pilgrim",
      bookingReference: b.applicationNumber,
      category: "GHAT_PRIORITY",
      serviceName: ghatName,
      ghatName,
      bookingDate: b.visitDate,
      bookingTime: b.timeSlot ? `${b.timeSlot.startTime} - ${b.timeSlot.endTime}` : undefined,
      locationAddress: ghatName,
      status: "TEMPORARILY_CLOSED",
      closureEffectiveTime: closureTimestamp,
      closureReason,
      officialInstructions,
      alternativeGhats,
      emergencyPhone: emergencyPhone || "108 / +91 883 2468000",
      emergencyHelpline: emergencyPhone || "108 / +91 883 2468000",
    };

    const idempotencyKey = `GHAT_CLOSURE_${ghatId}_${b.id}_${b.visitDate}`;
    const q = await queueEmailNotification({
      eventType: "GHAT_CLOSURE",
      userId: b.userId,
      bookingId: b.id,
      bookingReference: b.applicationNumber,
      bookingCategory: "GHAT_PRIORITY",
      recipientEmail: email,
      recipientName: b.beneficiaryName,
      payload,
      idempotencyKey,
      sendImmediate: true,
    });
    if (q) queuedRecords.push(q);
  }

  // Queue closure notifications for Ceremony Bookings
  for (const c of affectedCeremonyBookings) {
    const email = c.visitorEmail || c.visitor?.email;
    if (!email) continue;

    const payload: BookingEmailPayload = {
      customerName: c.visitorName,
      bookingReference: c.bookingReference,
      category: "CEREMONY",
      serviceName: `${c.ceremonyType} at ${ghatName}`,
      ghatName,
      bookingDate: c.bookingDate,
      bookingTime: `${c.startTime} - ${c.endTime}`,
      locationAddress: c.locationAddress,
      status: "TEMPORARILY_CLOSED",
      closureEffectiveTime: closureTimestamp,
      closureReason,
      officialInstructions,
      alternativeGhats,
      emergencyPhone: emergencyPhone || "108 / +91 883 2468000",
      emergencyHelpline: emergencyPhone || "108 / +91 883 2468000",
    };

    const idempotencyKey = `GHAT_CLOSURE_${ghatId}_${c.id}_${c.bookingDate}`;
    const q = await queueEmailNotification({
      eventType: "GHAT_CLOSURE",
      userId: c.visitorId,
      bookingId: c.id,
      bookingReference: c.bookingReference,
      bookingCategory: "CEREMONY",
      recipientEmail: email,
      recipientName: c.visitorName,
      payload,
      idempotencyKey,
      sendImmediate: true,
    });
    if (q) queuedRecords.push(q);
  }

  return { affectedCount: queuedRecords.length };
}

/**
 * Ghat Reopening Notifications
 */
export async function notifyGhatReopened(params: {
  ghatId: string;
  ghatName: string;
  instructions?: string;
  reopeningInstructions?: string;
  declaredById?: string;
}) {
  const { ghatId, ghatName } = params;
  const instructions = params.instructions || params.reopeningInstructions;
  const todayStr = new Date().toISOString().split("T")[0];

  const affectedPriorityBookings = await db.priorityGhatBooking.findMany({
    where: {
      ghatId,
      status: { in: ["APPROVED", "SLOT_ASSIGNED"] },
      visitDate: { gte: todayStr },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  for (const b of affectedPriorityBookings) {
    const email = b.beneficiaryEmail || b.user?.email;
    if (!email) continue;

    const payload: BookingEmailPayload = {
      customerName: b.beneficiaryName,
      bookingReference: b.applicationNumber,
      category: "GHAT_PRIORITY",
      serviceName: ghatName,
      ghatName,
      bookingDate: b.visitDate,
      locationAddress: ghatName,
      status: "REOPENED",
      officialInstructions: instructions,
    };

    const idempotencyKey = `GHAT_REOPENED_${ghatId}_${b.id}_${todayStr}`;
    await queueEmailNotification({
      eventType: "GHAT_REOPENED",
      userId: b.userId,
      bookingId: b.id,
      bookingReference: b.applicationNumber,
      bookingCategory: "GHAT_PRIORITY",
      recipientEmail: email,
      recipientName: b.beneficiaryName,
      payload,
      idempotencyKey,
      sendImmediate: true,
    });
  }
}
