import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

// Configure isolated test database
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession } from "../src/lib/auth";

// Public Listing & Directory Route Handlers
import { GET as getListings } from "../src/app/api/v1/listings/route";
import { GET as getListingDetail } from "../src/app/api/v1/listings/[id]/route";
import { GET as getPurohitList } from "../src/app/api/v1/ceremonies/purohits/route";
import { GET as getPurohitAvailability } from "../src/app/api/v1/ceremonies/purohits/[id]/availability/route";
import { GET as getNriConfig } from "../src/app/api/v1/nri/config/route";
import { GET as getNriContent } from "../src/app/api/v1/nri/content/route";

// Booking Creation Route Handlers
import { POST as createHotelBooking } from "../src/app/api/v1/bookings/hotel/route";
import { POST as createRestaurantBooking } from "../src/app/api/v1/bookings/restaurant/route";
import { POST as createAccommodationBooking } from "../src/app/api/v1/bookings/accommodation/route";
import { POST as createCeremonyBooking } from "../src/app/api/v1/ceremonies/bookings/route";
import { POST as createPriorityBooking } from "../src/app/api/v1/priority-bookings/route";
import { POST as createNriRequest } from "../src/app/api/v1/nri/requests/route";
import { POST as acceptNriQuotation } from "../src/app/api/v1/nri/quotations/[id]/accept/route";

// Email OTP Authentication Route Handlers
import { POST as requestOtpRoute } from "../src/app/api/v1/auth/otp/request/route";
import { POST as verifyOtpRoute } from "../src/app/api/v1/auth/otp/verify/route";

function createReq(method: string, url: string, sessionToken?: string, body?: any, isFormData = false): NextRequest {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["content-type"] = "application/json";
  }
  if (sessionToken) {
    headers["cookie"] = `godavari_session=${sessionToken}`;
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });
}

describe("GODAVARI ONE — Public Browsing & Mandatory Booking Authentication Suite", () => {
  const TEST_PREFIX = "998877";
  let userA: any;
  let sessionTokenA: string;
  let userB: any;
  let sessionTokenB: string;

  let hotelListing: any;
  let hotelRoom: any;
  let restaurantListing: any;
  let ghatListing: any;
  let freeAccListing: any;
  let purohitProfile: any;

  before(async () => {
    // Clean up any stale records
    await prisma.hotelBooking.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.restaurantBooking.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.freeAccommodationBooking.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.ceremonyBooking.deleteMany({ where: { visitorPhone: { startsWith: TEST_PREFIX } } });
    await prisma.priorityGhatBooking.deleteMany({ where: { beneficiaryPhone: { startsWith: TEST_PREFIX } } });
    await prisma.nriPackageRequest.deleteMany({ where: { visitorPhone: { startsWith: TEST_PREFIX } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.emailVerificationToken.deleteMany({ where: { email: { contains: TEST_PREFIX } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: TEST_PREFIX } } });

    // Create User A (Primary Authenticated Visitor)
    const passHash = await hashPassword("ValidPass123!");
    userA = await prisma.user.create({
      data: {
        phone: `${TEST_PREFIX}0001`,
        email: `usera_${TEST_PREFIX}@godavarione.test`,
        emailVerified: true,
        name: "Devotee User A",
        passwordHash: passHash,
        role: "VISITOR",
      },
    });
    const sA = await createSession(userA.id, "PASSWORD");
    sessionTokenA = sA.token;

    // Create User B (Secondary Visitor for IDOR and OTP verification)
    userB = await prisma.user.create({
      data: {
        phone: `${TEST_PREFIX}0002`,
        email: `userb_${TEST_PREFIX}@godavarione.test`,
        emailVerified: false,
        name: "Devotee User B",
        passwordHash: passHash,
        role: "VISITOR",
      },
    });
    const sB = await createSession(userB.id, "PASSWORD");
    sessionTokenB = sB.token;

    // Find or seed listings for each category
    hotelListing = await prisma.listing.findFirst({
      where: { category: "HOTEL", publicationStatus: "PUBLISHED" },
      include: { hotelRooms: true },
    });
    if (hotelListing?.hotelRooms?.[0]) {
      hotelRoom = hotelListing.hotelRooms[0];
    }

    restaurantListing = await prisma.listing.findFirst({
      where: { category: "RESTAURANT", publicationStatus: "PUBLISHED" },
    });

    ghatListing = await prisma.listing.findFirst({
      where: { category: "GHAT", publicationStatus: "PUBLISHED" },
    });

    freeAccListing = await prisma.listing.findFirst({
      where: { category: "FREE_ACCOMMODATION", publicationStatus: "PUBLISHED" },
    });

    purohitProfile = await prisma.purohitProfile.findFirst({
      where: { isActive: true },
    });
  });

  after(async () => {
    // Cleanup created test records
    await prisma.hotelBooking.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.restaurantBooking.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.freeAccommodationBooking.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.ceremonyBooking.deleteMany({ where: { visitorPhone: { startsWith: TEST_PREFIX } } });
    await prisma.priorityGhatBooking.deleteMany({ where: { beneficiaryPhone: { startsWith: TEST_PREFIX } } });
    await prisma.nriPackageRequest.deleteMany({ where: { visitorPhone: { startsWith: TEST_PREFIX } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.emailVerificationToken.deleteMany({ where: { email: { contains: TEST_PREFIX } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: TEST_PREFIX } } });
  });

  // ==========================================================================
  // SECTION 1: PUBLIC VISITOR BROWSING (UNAUTHENTICATED ACCESS)
  // ==========================================================================
  describe("1. Public Visitor Browsing (Zero Authentication Required)", () => {
    it("allows unauthenticated visitor to browse all listings and categories", async () => {
      const req = createReq("GET", "/api/v1/listings?page=1&limit=10");
      const res = await getListings(req);
      assert.strictEqual(res.status, 200, "Public listings endpoint must be accessible without login");
      const body = await res.json();
      assert.ok(Array.isArray(body.items), "Returns array of items");
    });

    it("allows unauthenticated visitor to filter listings by category (all 9 approved categories)", async () => {
      for (const cat of ["GHAT", "HOTEL", "RESTAURANT", "FREE_ACCOMMODATION", "ANNADANAM", "HOSPITAL", "TRANSPORT", "TOURIST_SPOT", "CEREMONY"]) {
        const req = createReq("GET", `/api/v1/listings?category=${cat}`);
        const res = await getListings(req);
        assert.strictEqual(res.status, 200, `Category ${cat} must be publicly accessible`);
      }
    });

    it("allows unauthenticated visitor to view public listing details", async () => {
      if (!hotelListing) return;
      const req = createReq("GET", `/api/v1/listings/${hotelListing.id}`);
      const res = await getListingDetail(req, { params: Promise.resolve({ id: hotelListing.id }) });
      assert.strictEqual(res.status, 200, "Listing detail must be publicly viewable");
      const body = await res.json();
      assert.strictEqual(body.id, hotelListing.id);
    });

    it("allows unauthenticated visitor to explore ceremonies and purohit directory", async () => {
      const req = createReq("GET", "/api/v1/ceremonies/purohits");
      const res = await getPurohitList(req);
      assert.strictEqual(res.status, 200, "Purohit directory must be publicly accessible");
    });

    it("allows unauthenticated visitor to view purohit availability slots", async () => {
      if (!purohitProfile) return;
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const req = createReq("GET", `/api/v1/ceremonies/purohits/${purohitProfile.id}/availability?date=${tomorrow}&duration=60`);
      const res = await getPurohitAvailability(req, { params: Promise.resolve({ id: purohitProfile.id }) });
      assert.strictEqual(res.status, 200, "Availability slots must be publicly visible");
    });

    it("allows unauthenticated visitor to view NRI public advisory and content", async () => {
      const configRes = await getNriConfig();
      assert.strictEqual(configRes.status, 200, "NRI config must be public");

      const contentReq = createReq("GET", "/api/v1/nri/content");
      const contentRes = await getNriContent(contentReq);
      assert.strictEqual(contentRes.status, 200, "NRI content must be public");
    });
  });

  // ==========================================================================
  // SECTION 2: MANDATORY AUTHENTICATION BEFORE BOOKING (HTTP 401 ENFORCEMENT)
  // ==========================================================================
  describe("2. Mandatory Authentication Enforcement across ALL Booking Modules (HTTP 401)", () => {
    it("POST /api/v1/bookings/hotel rejects unauthenticated requests with HTTP 401", async () => {
      if (!hotelListing) return;
      const req = createReq("POST", "/api/v1/bookings/hotel", undefined, {
        listingId: hotelListing.id,
        checkIn: "2027-07-15",
        checkOut: "2027-07-17",
        rooms: 1,
        guests: 2,
        adults: 2,
        children: 0,
      });
      const res = await createHotelBooking(req);
      assert.strictEqual(res.status, 401, "Hotel booking must require authentication");
      const body = await res.json();
      assert.match(body.error, /authentication/i);
    });

    it("POST /api/v1/bookings/restaurant rejects unauthenticated requests with HTTP 401", async () => {
      if (!restaurantListing) return;
      const req = createReq("POST", "/api/v1/bookings/restaurant", undefined, {
        listingId: restaurantListing.id,
        bookingDate: "2027-07-16",
        timeSlot: "12:30",
        peopleCount: 2,
      });
      const res = await createRestaurantBooking(req);
      assert.strictEqual(res.status, 401, "Restaurant booking must require authentication");
      const body = await res.json();
      assert.match(body.error, /authentication/i);
    });

    it("POST /api/v1/bookings/accommodation rejects unauthenticated requests with HTTP 401", async () => {
      if (!freeAccListing) return;
      const req = createReq("POST", "/api/v1/bookings/accommodation", undefined, {
        listingId: freeAccListing.id,
        checkInDate: "2027-07-15",
        checkOutDate: "2027-07-17",
        peopleCount: 2,
        guestName: "Anonymous Visitor",
        guestPhone: "9988771122",
      });
      const res = await createAccommodationBooking(req);
      assert.strictEqual(res.status, 401, "Free accommodation registration must require authentication");
      const body = await res.json();
      assert.match(body.error, /authentication/i);
    });

    it("POST /api/v1/ceremonies/bookings rejects unauthenticated requests with HTTP 401", async () => {
      if (!purohitProfile) return;
      const req = createReq("POST", "/api/v1/ceremonies/bookings", undefined, {
        purohitId: purohitProfile.id,
        ceremonyType: "PINDA_PRADANAM",
        bookingDate: "2027-07-15",
        startTime: "09:00",
        durationMinutes: 60,
        visitorName: "Devotee Visitor",
        visitorPhone: `${TEST_PREFIX}9999`,
        ceremonyLocation: "Kotilingala Ghat",
        locationType: "GHAT",
      });
      const res = await createCeremonyBooking(req);
      assert.strictEqual(res.status, 401, "Ceremony booking must require authentication");
      const body = await res.json();
      assert.match(body.error, /authentication/i);
    });

    it("POST /api/v1/priority-bookings rejects unauthenticated requests with HTTP 401", async () => {
      if (!ghatListing) return;
      const formData = new FormData();
      formData.append("category", "SENIOR_CITIZEN");
      formData.append("ghatId", ghatListing.id);
      formData.append("beneficiaryName", "Senior Devotee");
      formData.append("beneficiaryPhone", `${TEST_PREFIX}8888`);
      formData.append("beneficiaryDob", "1955-01-01");
      formData.append("visitDate", "2027-07-15");
      formData.append("accompanyingCount", "1");
      formData.append("applicantDeclaration", "true");
      formData.append("consentGiven", "true");
      formData.append("file", new Blob(["fake-doc"], { type: "application/pdf" }), "proof.pdf");

      const req = createReq("POST", "/api/v1/priority-bookings", undefined, formData, true);
      const res = await createPriorityBooking(req);
      assert.strictEqual(res.status, 401, "Priority ghat booking must require authentication");
      const body = await res.json();
      assert.match(body.error, /authentication/i);
    });

    it("POST /api/v1/nri/requests rejects unauthenticated requests with HTTP 401", async () => {
      const req = createReq("POST", "/api/v1/nri/requests", undefined, {
        groupSize: 4,
        numAdults: 4,
        numChildren: 0,
        arrivalDate: "2027-07-15",
        departureDate: "2027-07-20",
        visitorName: "NRI Pilgrim",
        visitorEmail: "nri@example.com",
        visitorPhone: "+1 555 123 4567",
      });
      const res = await createNriRequest(req);
      assert.strictEqual(res.status, 401, "NRI custom package request must require authentication");
      const body = await res.json();
      assert.match(body.error, /authentication/i);
    });

    it("POST /api/v1/nri/quotations/:id/accept rejects unauthenticated requests with HTTP 401", async () => {
      const req = createReq("POST", "/api/v1/nri/quotations/fake-quote-id/accept", undefined, {});
      const res = await acceptNriQuotation(req, { params: Promise.resolve({ id: "fake-quote-id" }) });
      assert.strictEqual(res.status, 401, "Accepting quotation must require authentication");
      const body = await res.json();
      assert.match(body.error, /authentication/i);
    });
  });

  // ==========================================================================
  // SECTION 3: IDENTITY SPOOFING DEFENSE & RBAC INTEGRITY
  // ==========================================================================
  describe("3. Identity Spoofing Defense & Server Identity Derivation", () => {
    it("ignores forged userId in hotel booking payload and derives identity strictly from active session", async () => {
      if (!hotelListing) return;
      const forgedUserId = "malicious-user-id-9999";
      const req = createReq("POST", "/api/v1/bookings/hotel", sessionTokenA, {
        userId: forgedUserId, // Spoofed field
        listingId: hotelListing.id,
        roomId: hotelRoom?.id,
        checkIn: "2027-07-15",
        checkOut: "2027-07-17",
        rooms: 1,
        guests: 2,
        adults: 2,
        children: 0,
      });
      const res = await createHotelBooking(req);
      assert.strictEqual(res.status, 201, "Booking created successfully for authenticated user");
      const body = await res.json();
      const b = (body as any).booking || body;
      assert.strictEqual(b.userId, userA.id, "Booking MUST belong to session user A, not forged userId");
      assert.notStrictEqual(b.userId, forgedUserId);
    });

    it("ignores forged userId in restaurant booking payload and derives identity from session", async () => {
      if (!restaurantListing) return;
      const forgedUserId = "malicious-attacker-7777";
      const req = createReq("POST", "/api/v1/bookings/restaurant", sessionTokenA, {
        userId: forgedUserId,
        listingId: restaurantListing.id,
        bookingDate: "2027-07-16",
        timeSlot: "13:30",
        peopleCount: 2,
      });
      const res = await createRestaurantBooking(req);
      assert.strictEqual(res.status, 201);
      const body = await res.json();
      const b = (body as any).booking || body;
      assert.strictEqual(b.userId, userA.id, "Restaurant booking must belong to session user A");
    });

    it("enforces tenant isolation: User B cannot accept quotation belonging to User A", async () => {
      // Create an NRI request for user A
      const nriReq = await prisma.nriPackageRequest.create({
        data: {
          referenceNumber: `NRI-${TEST_PREFIX}-ISO`,
          visitorId: userA.id,
          visitorName: userA.name,
          visitorEmail: userA.email,
          visitorPhone: userA.phone,
          groupSize: 2,
          numAdults: 2,
          numChildren: 0,
          arrivalDate: "2027-07-15",
          departureDate: "2027-07-18",
          arrivalLocation: "Rajahmundry Airport (RJA)",
          departureLocation: "Rajahmundry Airport (RJA)",
          accommodationPreference: "Luxury Hotel",
          dietaryPreference: "Vegetarian",
          countryOfResidence: "United States",
          status: "QUOTED",
        },
      });

      const quote = await prisma.nriQuotation.create({
        data: {
          quotationNumber: `Q-${TEST_PREFIX}-01`,
          requestId: nriReq.id,
          providerId: userA.id,
          title: "Standard Pilgrimage Quotation",
          durationDays: 3,
          checkInDate: "2027-07-15",
          checkOutDate: "2027-07-18",
          itinerary: JSON.stringify([]),
          inclusions: JSON.stringify([]),
          exclusions: JSON.stringify([]),
          accommodationCost: 30000,
          transportCost: 10000,
          foodCost: 5000,
          guideCost: 5000,
          otherCharges: 0,
          totalPrice: 50000,
          pricePerPerson: 25000,
          currency: "INR",
          status: "SENT",
        },
      });

      // User B attempts to accept User A's quotation -> HTTP 403 Forbidden
      const reqB = createReq("POST", `/api/v1/nri/quotations/${quote.id}/accept`, sessionTokenB, {
        referenceNumber: nriReq.referenceNumber,
      });
      const resB = await acceptNriQuotation(reqB, { params: Promise.resolve({ id: quote.id }) });
      assert.strictEqual(resB.status, 403, "User B must not be permitted to accept User A's quotation");
      const bodyB = await resB.json();
      assert.match(bodyB.error, /unauthorized|forbidden|not authorized/i);

      // User A accepts their own quotation -> HTTP 200 OK
      const reqA = createReq("POST", `/api/v1/nri/quotations/${quote.id}/accept`, sessionTokenA, {
        referenceNumber: nriReq.referenceNumber,
      });
      const resA = await acceptNriQuotation(reqA, { params: Promise.resolve({ id: quote.id }) });
      assert.strictEqual(resA.status, 200, "User A can successfully accept their own quotation");

      // Cleanup
      await prisma.nriQuotation.delete({ where: { id: quote.id } });
      await prisma.nriPackageRequest.delete({ where: { id: nriReq.id } });
    });
  });

  // ==========================================================================
  // SECTION 4: EMAIL OTP AUTHENTICATION LIFECYCLE (RESEND INTEGRATION)
  // ==========================================================================
  describe("4. Email OTP Authentication Lifecycle via Resend", () => {
    it("requests an email OTP for registered email and enforces account existence check", async () => {
      // Non-existent account check
      const notFoundReq = createReq("POST", "/api/v1/auth/otp/request", undefined, {
        identifier: "nonexistent_account@example.com",
        purpose: "LOGIN",
      });
      const notFoundRes = await requestOtpRoute(notFoundReq);
      assert.strictEqual(notFoundRes.status, 404, "Unregistered account cannot request OTP");

      // Mock Resend delivery for registered user
      const originalFetch = globalThis.fetch;
      try {
        (globalThis as any).fetch = async (url: string, init?: any) => {
          if (typeof url === "string" && url.includes("resend.com")) {
            return new Response(JSON.stringify({ id: "msg_test_12345" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          return originalFetch(url, init);
        };
        process.env.RESEND_API_KEY = "re_test_mock_key";

        const req = createReq("POST", "/api/v1/auth/otp/request", undefined, {
          identifier: userB.email,
          purpose: "LOGIN",
        });
        const res = await requestOtpRoute(req);
        assert.strictEqual(res.status, 200, "OTP request must succeed for registered email");
        const body = await res.json();
        assert.strictEqual(body.ok, true);
        assert.ok(body.emailMasked, "Returns masked email for UX feedback");

        // Verify emailVerificationToken created in database
        const tokenRecord = await prisma.emailVerificationToken.findFirst({
          where: { email: userB.email.toLowerCase() },
          orderBy: { createdAt: "desc" },
        });
        assert.ok(tokenRecord, "Token record created in database");
        assert.ok(tokenRecord.tokenHash, "Token hash is stored securely");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("rejects invalid OTP submission and tracks attempt count", async () => {
      const req = createReq("POST", "/api/v1/auth/otp/verify", undefined, {
        identifier: userB.email,
        otpCode: "000000", // Invalid code
      });
      const res = await verifyOtpRoute(req);
      assert.strictEqual(res.status, 400, "Invalid OTP must be rejected with HTTP 400");
      const body = await res.json();
      assert.match(body.error, /invalid|incorrect|no active/i);
    });

    it("verifies valid OTP, establishes authenticated session, and verifies email status", async () => {
      const testCode = "778899";
      const tokenHash = crypto.createHash("sha256").update(testCode).digest("hex");

      // Insert active token record
      await prisma.emailVerificationToken.create({
        data: {
          email: userB.email.toLowerCase(),
          tokenHash,
          expiresAt: new Date(Date.now() + 900000),
          consumed: false,
          attempts: 0,
        },
      });

      const req = createReq("POST", "/api/v1/auth/otp/verify", undefined, {
        identifier: userB.email,
        otpCode: testCode,
      });
      const res = await verifyOtpRoute(req);
      assert.strictEqual(res.status, 200, "Valid OTP verification must succeed");
      const body = await res.json();
      assert.strictEqual(body.phone, userB.phone);

      // Verify user's emailVerified flag is automatically updated
      const updatedUserB = await prisma.user.findUnique({ where: { id: userB.id } });
      assert.strictEqual(updatedUserB?.emailVerified, true, "User emailVerified updated upon OTP verification");
    });
  });
});
