import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

// Configure isolated test database
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.RESEND_API_KEY = "re_test_mock_api_key_123456789";
process.env.CRON_SECRET = "test-cron-secret-secure";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession } from "../src/lib/auth";
import {
  renderEmailContent,
  escapeHtml,
  type EmailTemplateEvent,
} from "../src/lib/email-templates";
import {
  queueEmailNotification,
  dispatchNotification,
  processOutboxBatch,
  scheduleBookingReminders,
  cancelBookingReminders,
  parseKolkataDateTime,
} from "../src/lib/email-service";

// Handlers to test
import { POST as createHotelBooking } from "../src/app/api/v1/bookings/hotel/route";
import { PATCH as updateHotelBooking } from "../src/app/api/v1/bookings/hotel/[id]/route";
import { POST as createRestaurantBooking } from "../src/app/api/v1/bookings/restaurant/route";
import { PATCH as updateRestaurantBooking } from "../src/app/api/v1/bookings/restaurant/[id]/route";
import { PATCH as updateCeremonyBooking } from "../src/app/api/v1/ceremonies/bookings/[id]/route";
import { PATCH as updateGhatStatus } from "../src/app/api/v1/ghats/[id]/status/route";
import { GET as getAdminNotifications } from "../src/app/api/v1/admin/notifications/route";
import { POST as retryAdminNotification } from "../src/app/api/v1/admin/notifications/[id]/retry/route";
import { POST as runCronWorker } from "../src/app/api/v1/notifications/cron/route";

function createReq(method: string, url: string, sessionToken?: string, body?: any): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (sessionToken) {
    headers["cookie"] = `godavari_session=${sessionToken}`;
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GODAVARI ONE — Complete Automated Email Notification System Suite", () => {
  const originalFetch = globalThis.fetch;
  const dispatchedEmails: Array<{ url: string; payload: any }> = [];
  let shouldMockResendFail = false;

  // Test state
  let superAdminUser: any;
  let adminSession: string;
  let visitorUser: any;
  let visitorSession: string;
  let supervisorUser: any;
  let supervisorSession: string;
  let hotelListing: any;
  let testRoomType: any;
  let restaurantListing: any;
  let ghatListing: any;
  let purohitProfile: any;
  let ceremonyBookingId: string;

  before(async () => {
    // Intercept fetch for Resend API calls
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === "string" ? input : input.toString();
      if (urlStr.includes("api.resend.com/emails")) {
        if (shouldMockResendFail) {
          return new Response(JSON.stringify({ statusCode: 500, message: "Resend upstream service down" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const bodyJson = init?.body ? JSON.parse(init.body as string) : {};
        dispatchedEmails.push({ url: urlStr, payload: bodyJson });

        return new Response(JSON.stringify({ id: `msg_mock_${crypto.randomBytes(6).toString("hex")}` }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return originalFetch(input, init);
    };

    // Cleanup previous runs if any
    const testPhones = ["919888880001", "919888880002", "919888880003", "919888880099"];
    const existingUsers = await prisma.user.findMany({ where: { phone: { in: testPhones } }, select: { id: true } });
    const userIds = existingUsers.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.emailNotification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.hotelBooking.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.restaurantBooking.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.ceremonyBooking.deleteMany({ where: { visitorId: { in: userIds } } });
      await prisma.priorityGhatBooking.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.purohitProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.assignment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.listing.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    const passwordHash = await hashPassword("TestSecurePass123!");

    // Create Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        phone: "919888880001",
        email: "superadmin.notify@godavari-one.org",
        name: "Super Admin Officer",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash,
        emailVerified: true,
      },
    });
    adminSession = (await createSession(superAdminUser.id, "PASSWORD")).token;

    // Create Visitor
    visitorUser = await prisma.user.create({
      data: {
        phone: "919888880002",
        email: "pilgrim.verified@godavari-one.org",
        name: "Srikanth Sharma",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash,
        emailVerified: true,
      },
    });
    visitorSession = (await createSession(visitorUser.id, "PASSWORD")).token;

    // Create Supervisor
    supervisorUser = await prisma.user.create({
      data: {
        phone: "919888880003",
        email: "supervisor.pushkar@godavari-one.org",
        name: "Ramesh Supervisor",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash,
        emailVerified: true,
      },
    });
    supervisorSession = (await createSession(supervisorUser.id, "PASSWORD")).token;

    // Create Hotel Listing
    hotelListing = await prisma.listing.create({
      data: {
        name: "Godavari Grand Heritage Hotel",
        description: "Heritage luxury accommodation overlooking river Godavari",
        category: "HOTEL",
        address: "Main Road, River View Area",
        locality: "Kotilingala Ghat Road",
        town: "Rajahmundry",
        ownerId: superAdminUser.id,
        publicationStatus: "PUBLISHED",
        hotelDetails: {
          create: {
            accommodationType: "Hotel",
            numRooms: 10,
            checkInTime: "12:00",
            checkOutTime: "11:00",
          },
        },
      },
    });

    testRoomType = await prisma.hotelRoom.create({
      data: {
        listingId: hotelListing.id,
        name: "Deluxe River View",
        basePrice: 3500,
        maxAdults: 2,
        maxGuests: 2,
        totalRooms: 10,
        isActive: true,
      },
    });

    // Create Restaurant Listing
    restaurantListing = await prisma.listing.create({
      data: {
        name: "Godavari Ruchulu Authentic Mess",
        description: "Traditional Godavari Andhra meals and prasadams",
        category: "RESTAURANT",
        address: "Near Pushkar Ghat",
        locality: "Kotigumpu",
        town: "Rajahmundry",
        ownerId: superAdminUser.id,
        publicationStatus: "PUBLISHED",
        restaurantDetails: {
          create: {
            cuisine: "Andhra Special",
            foodType: "VEG",
            priceRange: "$$",
            reservationAvailable: true,
            tableCapacity: 50,
          },
        },
      },
    });

    // Create Ghat Listing
    ghatListing = await prisma.listing.create({
      data: {
        name: "Kotilingala Pushkar Ghat",
        description: "Historic sacred bathing ghat on the banks of Godavari river",
        category: "GHAT",
        address: "Kotilingala Temple Road",
        locality: "Rajahmundry Ghat Area",
        town: "Rajahmundry",
        ownerId: superAdminUser.id,
        publicationStatus: "PUBLISHED",
        ghatDetails: {
          create: {
            currentCrowdStatus: "FREE",
            supervisorId: supervisorUser.id,
          },
        },
      },
    });

    // Assign supervisor to ghat
    await prisma.assignment.create({
      data: {
        userId: supervisorUser.id,
        listingId: ghatListing.id,
        type: "GHAT_SUPERVISOR",
      },
    });

    // Create Purohit & Ceremony Booking
    purohitProfile = await prisma.purohitProfile.create({
      data: {
        userId: superAdminUser.id,
        fullName: "Sarma Vedula Shastri",
        phone: "919888880099",
        address: "Vaidika Agraharam, Rajahmundry",
        serviceArea: "Rajahmundry Pushkar Ghats",
        languages: JSON.stringify(["Telugu", "Sanskrit"]),
        ceremonies: JSON.stringify(["Pinda Pradanam", "Tarpanam"]),
        experienceYears: 22,
        verificationStatus: "VERIFIED",
        isActive: true,
        isPublished: true,
      },
    });

    const ceremonyBooking = await prisma.ceremonyBooking.create({
      data: {
        bookingReference: "CER-2026-TEST01",
        purohitId: purohitProfile.id,
        visitorId: visitorUser.id,
        visitorName: visitorUser.name,
        visitorPhone: visitorUser.phone,
        visitorEmail: visitorUser.email,
        ceremonyType: "Pinda Pradanam",
        bookingDate: "2026-11-20",
        startTime: "07:30",
        endTime: "09:00",
        locationAddress: ghatListing.name,
        serviceFee: 1500,
        status: "PENDING",
      },
    });
    ceremonyBookingId = ceremonyBooking.id;
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    // Clean up test records
    await prisma.emailNotification.deleteMany({
      where: {
        recipientEmail: {
          in: [
            "pilgrim.verified@godavari-one.org",
            "superadmin.notify@godavari-one.org",
            "supervisor.pushkar@godavari-one.org",
          ],
        },
      },
    });
    await prisma.hotelBooking.deleteMany({ where: { userId: visitorUser.id } });
    await prisma.restaurantBooking.deleteMany({ where: { userId: visitorUser.id } });
    await prisma.ceremonyBooking.deleteMany({ where: { visitorId: visitorUser.id } });
    await prisma.priorityGhatBooking.deleteMany({ where: { userId: visitorUser.id } });
    await prisma.purohitProfile.deleteMany({ where: { id: purohitProfile.id } });
    await prisma.assignment.deleteMany({ where: { userId: supervisorUser.id } });
    await prisma.hotelRoom.deleteMany({ where: { listingId: hotelListing.id } });
    await prisma.hotelDetails.deleteMany({ where: { listingId: hotelListing.id } });
    await prisma.restaurantDetails.deleteMany({ where: { listingId: restaurantListing.id } });
    await prisma.ghatDetails.deleteMany({ where: { listingId: ghatListing.id } });
    await prisma.listing.deleteMany({
      where: { id: { in: [hotelListing.id, restaurantListing.id, ghatListing.id] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [superAdminUser.id, visitorUser.id, supervisorUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminUser.id, visitorUser.id, supervisorUser.id] } },
    });
  });

  beforeEach(() => {
    dispatchedEmails.length = 0;
    shouldMockResendFail = false;
  });

  // --------------------------------------------------------------------------
  // 1. TEMPLATE ENGINE & LOCALIZATION UNIT TESTS
  // --------------------------------------------------------------------------
  describe("1. Template Engine & Security", () => {
    it("escapes malicious HTML injection in user-supplied strings", () => {
      const malicious = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      const clean = escapeHtml(malicious);
      assert.strictEqual(clean.includes("<script>"), false);
      assert.strictEqual(clean.includes("&lt;script&gt;"), true);
      assert.strictEqual(clean.includes("&quot;XSS&quot;"), true);
    });

    it("renders BOOKING_SUCCESSFUL in English and Telugu with fallbacks", () => {
      const payload: any = {
        eventType: "BOOKING_SUCCESSFUL",
        customerName: "Srikanth Sharma",
        bookingReference: "BK-HOTEL-1001",
        bookingCategory: "Hotel",
        serviceName: "Godavari Grand Heritage Hotel",
        bookingDate: "2026-11-20",
        bookingTime: "Check-in: 12:00 PM",
        location: "Kotilingala Ghat Road",
        guestsOrParticipants: "2 Guests · 1 Room",
        bookingStatus: "CONFIRMED",
        cancellationInstructions: "Cancel via your account panel.",
        myBookingsUrl: "/bookings",
        supportContact: "support@godavari-one.org",
      };

      const enRender = renderEmailContent("en", payload);
      assert.strictEqual(enRender.subject.includes("Booking Confirmed"), true);
      assert.strictEqual(enRender.html.includes("Srikanth Sharma"), true);
      assert.strictEqual(enRender.html.includes("BK-HOTEL-1001"), true);
      assert.strictEqual(enRender.text.includes("BK-HOTEL-1001"), true);

      const teRender = renderEmailContent("te", payload);
      assert.strictEqual(teRender.subject.includes("బుకింగ్ ధృవీకరించబడింది"), true);
      assert.strictEqual(teRender.html.includes("నమస్కారం"), true);
      assert.strictEqual(teRender.html.includes("BK-HOTEL-1001"), true);
    });

    it("correctly parses Asia/Kolkata date and time (+05:30)", () => {
      const date = parseKolkataDateTime("2026-11-20", "14:30");
      // Asia/Kolkata 14:30 is 09:00 UTC
      assert.strictEqual(date.toISOString(), "2026-11-20T09:00:00.000Z");
    });
  });

  // --------------------------------------------------------------------------
  // 2. FEATURE 1: BOOKING SUCCESSFUL
  // --------------------------------------------------------------------------
  describe("2. Feature 1: Booking Successful", () => {
    it("creates an email notification and dispatches to verified user on hotel booking creation", async () => {
      const checkIn = "2026-11-20";
      const checkOut = "2026-11-22";

      const req = createReq("POST", "/api/v1/bookings/hotel", visitorSession, {
        listingId: hotelListing.id,
        roomId: testRoomType.id,
        checkIn: checkIn,
        checkOut: checkOut,
        rooms: 1,
        guests: 2,
      });

      const res = await createHotelBooking(req);
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      const booking = data.booking || data;
      assert.ok(booking.id);

      // Allow background dispatch to complete
      await new Promise((r) => setTimeout(r, 200));

      const notification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: booking.id,
          eventType: "BOOKING_SUCCESSFUL",
        },
      });

      assert.ok(notification, "Email notification record must be created in outbox");
      assert.strictEqual(notification.recipientEmail, visitorUser.email);
      assert.strictEqual(notification.status, "SENT");
      assert.ok(notification.providerMessageId, "Provider message ID must be recorded");

      // Verify payload accuracy
      const payload = JSON.parse(notification.payload);
      assert.strictEqual(payload.bookingReference, booking.bookingReference || booking.id);
      assert.strictEqual(payload.customerName, visitorUser.name);
      assert.strictEqual(payload.serviceName, hotelListing.name);
      assert.strictEqual(payload.bookingStatus || payload.status, booking.status);

      // Verify Resend was called
      const dispatched = dispatchedEmails.find((d) => d.payload.to.includes(visitorUser.email));
      assert.ok(dispatched, "Resend API must have been called with verified email");
      assert.strictEqual(dispatched.payload.subject.includes(booking.bookingReference || booking.id), true);
    });

    it("does not create email notification for an unauthenticated request", async () => {
      const req = createReq("POST", "/api/v1/bookings/hotel", undefined, {
        listingId: hotelListing.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-20",
        checkOut: "2026-11-22",
        rooms: 1,
        guests: 2,
      });

      const res = await createHotelBooking(req);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(dispatchedEmails.length, 0);
    });

    it("enforces idempotency and prevents duplicate email creation", async () => {
      const idempotencyKey = `TEST_IDEMP_${crypto.randomBytes(4).toString("hex")}`;

      const item1 = await queueEmailNotification({
        eventType: "BOOKING_SUCCESSFUL",
        recipientEmail: visitorUser.email,
        recipientName: visitorUser.name,
        subject: "Duplicate Test 1",
        idempotencyKey,
        payload: {
          eventType: "BOOKING_SUCCESSFUL",
          customerName: visitorUser.name,
          bookingReference: "DUP-001",
          serviceName: "Test Hotel",
        },
      });

      const item2 = await queueEmailNotification({
        eventType: "BOOKING_SUCCESSFUL",
        recipientEmail: visitorUser.email,
        recipientName: visitorUser.name,
        subject: "Duplicate Test 2",
        idempotencyKey,
        payload: {
          eventType: "BOOKING_SUCCESSFUL",
          customerName: visitorUser.name,
          bookingReference: "DUP-001",
          serviceName: "Test Hotel",
        },
      });

      assert.strictEqual(item1!.id, item2!.id, "Second call must return existing notification without creating duplicate");
    });
  });

  // --------------------------------------------------------------------------
  // 3. FEATURE 2: BOOKING CANCELLED
  // --------------------------------------------------------------------------
  describe("3. Feature 2: Booking Cancelled", () => {
    it("dispatches cancellation confirmation and cancels pending reminders", async () => {
      // 1. Create a hotel booking first
      const createRes = await createHotelBooking(
        createReq("POST", "/api/v1/bookings/hotel", visitorSession, {
          listingId: hotelListing.id,
          roomId: testRoomType.id,
          checkIn: "2026-11-25",
          checkOut: "2026-11-27",
          rooms: 1,
          guests: 2,
        })
      );
      assert.strictEqual(createRes.status, 201);
      const createData = await createRes.json();
      const booking = createData.booking || createData;

      // Verify reminders were scheduled
      const reminders = await prisma.emailNotification.findMany({
        where: {
          bookingId: booking.id,
          eventType: { in: ["BOOKING_REMINDER_24H", "BOOKING_REMINDER_2H"] },
        },
      });
      assert.strictEqual(reminders.length >= 1, true, "Reminders should have been scheduled");

      // 2. Cancel the booking
      dispatchedEmails.length = 0;
      const cancelReq = createReq("PATCH", `/api/v1/bookings/hotel/${booking.id}`, visitorSession, {
        action: "CANCEL",
        reason: "Personal travel plans changed",
      });

      const cancelRes = await updateHotelBooking(cancelReq, { params: Promise.resolve({ id: booking.id }) });
      assert.strictEqual(cancelRes.status, 200);

      await new Promise((r) => setTimeout(r, 200));

      // 3. Verify cancellation notification was queued & sent
      const cancelNotification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: booking.id,
          eventType: "BOOKING_CANCELLED",
        },
      });
      assert.ok(cancelNotification);
      assert.strictEqual(cancelNotification.status, "SENT");

      const payload = JSON.parse(cancelNotification.payload);
      assert.strictEqual(payload.cancellationReason, "Personal travel plans changed");

      // 4. Verify reminders were cancelled
      const activeReminders = await prisma.emailNotification.findMany({
        where: {
          bookingId: booking.id,
          eventType: { in: ["BOOKING_REMINDER_24H", "BOOKING_REMINDER_2H"] },
          status: "PENDING",
        },
      });
      assert.strictEqual(activeReminders.length, 0, "All pending reminders must be cancelled");
    });
  });

  // --------------------------------------------------------------------------
  // 4. FEATURE 3 & 4: BOOKING APPROVED AND REJECTED
  // --------------------------------------------------------------------------
  describe("4. Features 3 & 4: Booking Approved and Rejected", () => {
    it("dispatches BOOKING_APPROVED when admin approves a restaurant reservation", async () => {
      // 1. Create a restaurant reservation
      const createRes = await createRestaurantBooking(
        createReq("POST", "/api/v1/bookings/restaurant", visitorSession, {
          listingId: restaurantListing.id,
          bookingDate: "2026-11-20",
          timeSlot: "19:30",
          peopleCount: 4,
        })
      );
      assert.strictEqual(createRes.status, 201);
      const createData = await createRes.json();
      const booking = createData.booking || createData;

      dispatchedEmails.length = 0;

      // 2. Unauthorized user cannot approve
      const unauthReq = createReq("PATCH", `/api/v1/bookings/restaurant/${booking.id}`, visitorSession, {
        action: "CONFIRM",
      });
      const unauthRes = await updateRestaurantBooking(unauthReq, { params: Promise.resolve({ id: booking.id }) });
      assert.strictEqual(unauthRes.status, 403);
      assert.strictEqual(dispatchedEmails.length, 0);

      // 3. Authorized Super Admin approves
      const approveReq = createReq("PATCH", `/api/v1/bookings/restaurant/${booking.id}`, adminSession, {
        action: "CONFIRM",
      });
      const approveRes = await updateRestaurantBooking(approveReq, { params: Promise.resolve({ id: booking.id }) });
      assert.strictEqual(approveRes.status, 200);

      await new Promise((r) => setTimeout(r, 200));

      const approveNotification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: booking.id,
          eventType: "BOOKING_APPROVED",
        },
      });
      assert.ok(approveNotification);
      assert.strictEqual(approveNotification.recipientEmail, visitorUser.email);
      assert.strictEqual(approveNotification.status, "SENT");
    });

    it("dispatches BOOKING_REJECTED with official reason and hides internal notes", async () => {
      // 1. Create a restaurant reservation
      const createRes = await createRestaurantBooking(
        createReq("POST", "/api/v1/bookings/restaurant", visitorSession, {
          listingId: restaurantListing.id,
          bookingDate: "2026-11-20",
          timeSlot: "20:00",
          peopleCount: 6,
        })
      );
      assert.strictEqual(createRes.status, 201);
      const createData = await createRes.json();
      const booking = createData.booking || createData;

      dispatchedEmails.length = 0;

      // 2. Reject by Super Admin
      const rejectReq = createReq("PATCH", `/api/v1/bookings/restaurant/${booking.id}`, adminSession, {
        action: "REJECT",
        reason: "Fully booked due to private VIP delegation",
      });
      const rejectRes = await updateRestaurantBooking(rejectReq, { params: Promise.resolve({ id: booking.id }) });
      assert.strictEqual(rejectRes.status, 200);

      await new Promise((r) => setTimeout(r, 200));

      const rejectNotification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: booking.id,
          eventType: "BOOKING_REJECTED",
        },
      });
      assert.ok(rejectNotification);
      assert.strictEqual(rejectNotification.recipientEmail, visitorUser.email);

      const payload = JSON.parse(rejectNotification.payload);
      assert.strictEqual(payload.rejectionReason, "Fully booked due to private VIP delegation");
      // Internal admin discussions/passwords must never exist in the payload
      assert.strictEqual("internalNotes" in payload, false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. FEATURE 5: BOOKING RESCHEDULED
  // --------------------------------------------------------------------------
  describe("5. Feature 5: Booking Rescheduled", () => {
    it("dispatches BOOKING_RESCHEDULED comparing previous and proposed dates", async () => {
      dispatchedEmails.length = 0;

      const rescheduleReq = createReq("PATCH", `/api/v1/ceremonies/bookings/${ceremonyBookingId}`, adminSession, {
        action: "RESCHEDULE_REQUEST",
        rescheduleReason: "Auspicious muhurtham adjustment recommended by purohit",
        rescheduleProposedDate: "2026-11-21",
        rescheduleProposedTime: "08:00",
      });

      const res = await updateCeremonyBooking(rescheduleReq, { params: Promise.resolve({ id: ceremonyBookingId }) });
      assert.strictEqual(res.status, 200);

      await new Promise((r) => setTimeout(r, 200));

      const reschedNotification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: ceremonyBookingId,
          eventType: "BOOKING_RESCHEDULED",
        },
      });
      assert.ok(reschedNotification, "Rescheduled email must be queued");
      assert.strictEqual(reschedNotification.status, "SENT");

      const payload = JSON.parse(reschedNotification.payload);
      assert.strictEqual(payload.previousDate, "2026-11-20");
      assert.strictEqual(payload.newDate, "2026-11-21");
      assert.strictEqual(payload.newTime, "08:00");
    });
  });

  // --------------------------------------------------------------------------
  // 6. FEATURE 6: AUTOMATIC BOOKING REMINDERS & SCHEDULER
  // --------------------------------------------------------------------------
  describe("6. Feature 6: Automatic Booking Reminders", () => {
    it("schedules 24h and 2h reminders with correct timestamps in Asia/Kolkata", async () => {
      const futureDate = "2026-12-01";
      const futureTime = "10:00";

      const testBookingId = `bk_rem_${crypto.randomBytes(4).toString("hex")}`;

      const { count } = await scheduleBookingReminders({
        bookingId: testBookingId,
        bookingReference: "BK-REM-TEST",
        bookingCategory: "Hotel",
        serviceName: "Godavari Grand Heritage Hotel",
        userId: visitorUser.id,
        recipientEmail: visitorUser.email,
        recipientName: visitorUser.name,
        language: "en",
        bookingDate: futureDate,
        bookingTime: futureTime,
        location: "Kotilingala Ghat Road",
      });

      assert.strictEqual(count, 2, "Both 24h and 2h reminders should be scheduled for a booking weeks away");

      const scheduled24h = await prisma.emailNotification.findFirst({
        where: { bookingId: testBookingId, eventType: "BOOKING_REMINDER_24H" },
      });
      const scheduled2h = await prisma.emailNotification.findFirst({
        where: { bookingId: testBookingId, eventType: "BOOKING_REMINDER_2H" },
      });

      assert.ok(scheduled24h?.scheduledFor);
      assert.ok(scheduled2h?.scheduledFor);

      // Verify the 24h reminder is exactly 22 hours before the 2h reminder
      const diffMs = new Date(scheduled2h.scheduledFor).getTime() - new Date(scheduled24h.scheduledFor).getTime();
      assert.strictEqual(diffMs, 22 * 60 * 60 * 1000);

      // Cleanup
      await prisma.emailNotification.deleteMany({ where: { bookingId: testBookingId } });
    });

    it("skips overdue 24h reminder if booking is created less than 24h prior to event", async () => {
      // Create a date 10 hours from now
      const target = new Date(Date.now() + 10 * 60 * 60 * 1000);
      const hours = String(target.getHours()).padStart(2, "0");
      const minutes = String(target.getMinutes()).padStart(2, "0");
      const yyyy = target.getFullYear();
      const mm = String(target.getMonth() + 1).padStart(2, "0");
      const dd = String(target.getDate()).padStart(2, "0");

      const testBookingId = `bk_short_${crypto.randomBytes(4).toString("hex")}`;

      const { count } = await scheduleBookingReminders({
        bookingId: testBookingId,
        bookingReference: "BK-SHORT-TEST",
        bookingCategory: "Restaurant",
        serviceName: "Godavari Ruchulu",
        userId: visitorUser.id,
        recipientEmail: visitorUser.email,
        recipientName: visitorUser.name,
        language: "en",
        bookingDate: `${yyyy}-${mm}-${dd}`,
        bookingTime: `${hours}:${minutes}`,
        location: "Kotigumpu",
      });

      assert.strictEqual(count, 1, "Only 2h reminder must be scheduled when booked <24h away");

      const reminder24h = await prisma.emailNotification.findFirst({
        where: { bookingId: testBookingId, eventType: "BOOKING_REMINDER_24H" },
      });
      assert.strictEqual(reminder24h, null, "Overdue 24h reminder must NOT be created");

      const reminder2h = await prisma.emailNotification.findFirst({
        where: { bookingId: testBookingId, eventType: "BOOKING_REMINDER_2H" },
      });
      assert.ok(reminder2h, "2h reminder must be created");

      // Cleanup
      await prisma.emailNotification.deleteMany({ where: { bookingId: testBookingId } });
    });

    it("processes pending reminders through cron endpoint", async () => {
      // Create a reminder scheduled in the past
      const pastReminder = await prisma.emailNotification.create({
        data: {
          eventType: "BOOKING_REMINDER_24H",
          recipientEmail: visitorUser.email,
          recipientName: visitorUser.name,
          language: "en",
          subject: "Upcoming Visit Reminder (24 Hours)",
          payload: JSON.stringify({
            eventType: "BOOKING_REMINDER_24H",
            customerName: visitorUser.name,
            bookingReference: "BK-PAST-01",
            serviceName: "Pushkaralu Ghat",
            bookingDate: "2026-11-20",
            bookingTime: "08:00",
            location: "Kotilingala Ghat",
          }),
          status: "PENDING",
          scheduledFor: new Date(Date.now() - 60000), // 1 minute in the past
          idempotencyKey: `TEST_PAST_REM_${crypto.randomBytes(4).toString("hex")}`,
        },
      });

      dispatchedEmails.length = 0;

      // Run cron worker via POST handler
      const cronReq = createReq("POST", "/api/v1/notifications/cron", undefined);
      cronReq.headers.set("x-cron-secret", "test-cron-secret-secure");

      const cronRes = await runCronWorker(cronReq);
      assert.strictEqual(cronRes.status, 200);

      const refreshed = await prisma.emailNotification.findUnique({
        where: { id: pastReminder.id },
      });
      assert.strictEqual(refreshed?.status, "SENT");
      assert.ok(refreshed?.sentAt);

      // Cleanup
      await prisma.emailNotification.delete({ where: { id: pastReminder.id } });
    });
  });

  // --------------------------------------------------------------------------
  // 7. FEATURE 7: GHAT CLOSURE NOTIFICATION
  // --------------------------------------------------------------------------
  describe("7. Feature 7: Ghat Closure and Public Safety", () => {
    it("dispatches emergency closure notification only to affected booking holders", async () => {
      // 1. Create a Priority Ghat Booking assigned to this ghat
      const priorityBooking = await prisma.priorityGhatBooking.create({
        data: {
          applicationNumber: `PB-GHAT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          userId: visitorUser.id,
          ghatId: ghatListing.id,
          beneficiaryName: visitorUser.name,
          beneficiaryPhone: visitorUser.phone,
          category: "SENIOR_CITIZEN",
          visitDate: "2026-11-20",
          status: "SLOT_ASSIGNED",
          accompanyingCount: 1,
          documentPath: "/uploads/proofs/senior_id.pdf",
          documentOriginalName: "senior_id.pdf",
          documentMimeType: "application/pdf",
          documentSizeBytes: 102400,
        },
      });

      dispatchedEmails.length = 0;

      // 2. Routine crowd update (FREE -> MODERATE) must NOT send closure emails
      const modReq = createReq("PATCH", `/api/v1/ghats/${ghatListing.id}/status`, adminSession, {
        crowdStatus: "MODERATE",
        notes: "Pilgrim influx picking up",
      });
      const modRes = await updateGhatStatus(modReq, { params: Promise.resolve({ id: ghatListing.id }) });
      assert.strictEqual(modRes.status, 200);
      assert.strictEqual(dispatchedEmails.length, 0, "Routine crowd update must not trigger closure emails");

      // 3. Official closure by authorized Supervisor
      const closeReq = createReq("PATCH", `/api/v1/ghats/${ghatListing.id}/status`, supervisorSession, {
        crowdStatus: "CLOSED",
        notes: "High water current and river safety barrier breach",
      });
      const closeRes = await updateGhatStatus(closeReq, { params: Promise.resolve({ id: ghatListing.id }) });
      assert.strictEqual(closeRes.status, 200);

      await new Promise((r) => setTimeout(r, 400));

      // 4. Verify closure notification was sent to affected user
      const closureNotification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: priorityBooking.id,
          eventType: "GHAT_CLOSURE",
        },
      });
      assert.ok(closureNotification, "Closure email must be dispatched to affected booking holder");
      assert.strictEqual(closureNotification.status, "SENT");

      const payload = JSON.parse(closureNotification.payload);
      assert.strictEqual(payload.ghatName, ghatListing.name);
      assert.strictEqual(payload.closureReason, "High water current and river safety barrier breach");
      assert.ok(payload.emergencyHelpline);

      // 5. Subsequent reopening
      dispatchedEmails.length = 0;
      const reopenReq = createReq("PATCH", `/api/v1/ghats/${ghatListing.id}/status`, supervisorSession, {
        crowdStatus: "FREE",
        notes: "Safety inspection completed. Water level normal.",
      });
      const reopenRes = await updateGhatStatus(reopenReq, { params: Promise.resolve({ id: ghatListing.id }) });
      assert.strictEqual(reopenRes.status, 200);

      await new Promise((r) => setTimeout(r, 400));

      const reopenNotification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: priorityBooking.id,
          eventType: "GHAT_REOPENED",
        },
      });
      assert.ok(reopenNotification, "Reopening email must be dispatched");
      assert.strictEqual(reopenNotification.status, "SENT");

      // Cleanup
      await prisma.priorityGhatBooking.delete({ where: { id: priorityBooking.id } });
    });
  });

  // --------------------------------------------------------------------------
  // 8. RELIABILITY, RESEND FAULT TOLERANCE & ADMIN DASHBOARD RETRY
  // --------------------------------------------------------------------------
  describe("8. Reliability, Fault Tolerance & Admin Dashboard Retry", () => {
    it("handles Resend provider failures gracefully without rolling back bookings", async () => {
      shouldMockResendFail = true; // Simulates Resend 500 error

      const createRes = await createHotelBooking(
        createReq("POST", "/api/v1/bookings/hotel", visitorSession, {
          listingId: hotelListing.id,
          roomId: testRoomType.id,
          checkIn: "2026-11-28",
          checkOut: "2026-11-30",
          rooms: 1,
          guests: 2,
        })
      );

      // Booking transaction MUST succeed even if email provider fails
      assert.strictEqual(createRes.status, 201);
      const data = await createRes.json();
      const booking = data.booking || data;
      assert.ok(booking.id);

      await new Promise((r) => setTimeout(r, 200));

      const failedNotification = await prisma.emailNotification.findFirst({
        where: {
          bookingId: booking.id,
          eventType: "BOOKING_SUCCESSFUL",
        },
      });

      assert.ok(failedNotification);
      assert.ok(
        failedNotification.status === "FAILED" || failedNotification.status === "PENDING",
        "Notification status must indicate retryable pending or failed"
      );
      assert.ok(failedNotification.lastError?.includes("Resend upstream service down"));

      // 2. Admin retries the failed notification
      shouldMockResendFail = false; // Upstream restored

      // Unauthorized visitor cannot retry
      const unauthRetryReq = createReq("POST", `/api/v1/admin/notifications/${failedNotification.id}/retry`, visitorSession);
      const unauthRetryRes = await retryAdminNotification(unauthRetryReq, {
        params: Promise.resolve({ id: failedNotification.id }),
      });
      assert.strictEqual(unauthRetryRes.status, 403);

      // Super Admin successfully retries
      const adminRetryReq = createReq("POST", `/api/v1/admin/notifications/${failedNotification.id}/retry`, adminSession);
      const adminRetryRes = await retryAdminNotification(adminRetryReq, {
        params: Promise.resolve({ id: failedNotification.id }),
      });
      assert.strictEqual(adminRetryRes.status, 200);

      const refreshed = await prisma.emailNotification.findUnique({
        where: { id: failedNotification.id },
      });
      assert.strictEqual(refreshed?.status, "SENT");
      assert.strictEqual(refreshed?.lastError, null);
    });

    it("allows administrators to filter, search, and paginate notification logs", async () => {
      const listReq = createReq("GET", "/api/v1/admin/notifications?status=SENT&limit=10", adminSession);
      const res = await getAdminNotifications(listReq);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.items));
      assert.ok(data.stats);
      assert.ok(data.pagination);
      assert.strictEqual(data.stats.total >= data.stats.sent, true);
    });
  });
});
