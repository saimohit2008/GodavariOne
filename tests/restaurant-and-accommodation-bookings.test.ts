import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
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
import { POST as createRestaurantBooking, GET as getRestaurantBookings } from "../src/app/api/v1/bookings/restaurant/route";
import { PATCH as updateRestaurantBooking } from "../src/app/api/v1/bookings/restaurant/[id]/route";
import { POST as createAccommodationBooking, GET as getAccommodationBookings, PATCH as updateAccommodationBooking } from "../src/app/api/v1/bookings/accommodation/route";

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

describe("Godavari One — Restaurant & Free Accommodation Booking Engines", () => {
  let superAdminUser: any;
  let superAdminSession: any;
  let restaurantOwnerUser: any;
  let restaurantOwnerSession: any;
  let accommodationOwnerUser: any;
  let accommodationOwnerSession: any;
  let visitorUser1: any;
  let visitorSession1: any;
  let visitorUser2: any;
  let visitorSession2: any;

  let testRestaurant: any;
  let noReservationRestaurant: any;
  let testAccommodation: any;

  const PHONE_PREFIX = "918777";

  before(async () => {
    // Cleanup prior test artifacts
    await prisma.restaurantBooking.deleteMany({ where: { user: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.freeAccommodationBooking.deleteMany({ where: { user: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.restaurantDetails.deleteMany({ where: { listing: { owner: { phone: { startsWith: PHONE_PREFIX } } } } });
    await prisma.freeAccommodationDetails.deleteMany({ where: { listing: { owner: { phone: { startsWith: PHONE_PREFIX } } } } });
    await prisma.listing.deleteMany({ where: { owner: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });

    // 1. Create Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        phone: `${PHONE_PREFIX}0001`,
        name: "Test Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("Admin123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "ADMIN");

    // 2. Create Restaurant Owner
    restaurantOwnerUser = await prisma.user.create({
      data: {
        phone: `${PHONE_PREFIX}0002`,
        name: "Sri Godavari Ruchulu Owner",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("Owner123!"),
      },
    });
    restaurantOwnerSession = await createSession(restaurantOwnerUser.id, "PASSWORD");

    // 3. Create Accommodation Owner
    accommodationOwnerUser = await prisma.user.create({
      data: {
        phone: `${PHONE_PREFIX}0003`,
        name: "Dharamsala Trust Manager",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("Owner123!"),
      },
    });
    accommodationOwnerSession = await createSession(accommodationOwnerUser.id, "PASSWORD");

    // 4. Create Visitors
    visitorUser1 = await prisma.user.create({
      data: {
        phone: `${PHONE_PREFIX}0011`,
        name: "Devotee Visitor One",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitorSession1 = await createSession(visitorUser1.id, "PASSWORD");

    visitorUser2 = await prisma.user.create({
      data: {
        phone: `${PHONE_PREFIX}0012`,
        name: "Devotee Visitor Two",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitorSession2 = await createSession(visitorUser2.id, "PASSWORD");

    // 5. Create Test Restaurant (Table capacity: 20)
    testRestaurant = await prisma.listing.create({
      data: {
        name: "Sri Godavari Traditional Ruchulu",
        category: "RESTAURANT",
        description: "Authentic Andhra meals and Godavari delicacies",
        address: "Main Road, Rajahmundry",
        ownerId: restaurantOwnerUser.id,
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        restaurantDetails: {
          create: {
            cuisine: "Andhra, South Indian",
            foodType: "BOTH",
            reservationAvailable: true,
            tableCapacity: 20,
            priceRange: "₹₹",
          },
        },
      },
    });

    // 6. Create Restaurant with reservations disabled
    noReservationRestaurant = await prisma.listing.create({
      data: {
        name: "Quick Bites Tiffin Center",
        category: "RESTAURANT",
        description: "Walk-in only tiffin service",
        address: "Pushkar Ghat Road, Rajahmundry",
        ownerId: restaurantOwnerUser.id,
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        restaurantDetails: {
          create: {
            cuisine: "Tiffins",
            foodType: "PURE_VEG",
            reservationAvailable: false,
            tableCapacity: 10,
          },
        },
      },
    });

    // 7. Create Free Accommodation Centre (Total capacity: 15, Max stay: 3 days)
    testAccommodation = await prisma.listing.create({
      data: {
        name: "Sri Rama Bhaktha Seva Dharamsala",
        category: "FREE_ACCOMMODATION",
        description: "Free dormitory and family stay for pilgrims",
        address: "Near Kotilingala Ghat, Rajahmundry",
        ownerId: accommodationOwnerUser.id,
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        freeAccommodationDetails: {
          create: {
            totalCapacity: 15,
            availableCapacity: 15,
            availableTypes: JSON.stringify(["FAMILY", "MEN", "WOMEN"]),
            maxStayDays: 3,
            amenities: JSON.stringify(["RO Water", "Mats", "Clean Bathrooms"]),
            rules: "Alcohol and tobacco strictly prohibited.",
          },
        },
      },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.restaurantBooking.deleteMany({ where: { user: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.freeAccommodationBooking.deleteMany({ where: { user: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.restaurantDetails.deleteMany({ where: { listing: { owner: { phone: { startsWith: PHONE_PREFIX } } } } });
    await prisma.freeAccommodationDetails.deleteMany({ where: { listing: { owner: { phone: { startsWith: PHONE_PREFIX } } } } });
    await prisma.listing.deleteMany({ where: { owner: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: PHONE_PREFIX } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
    await prisma.$disconnect();
  });

  describe("Part 1: Restaurant Reservation Engine", () => {
    let createdBookingId: string;

    it("1. Valid restaurant reservation is created successfully (HTTP 201)", async () => {
      const req = createReq("POST", "/api/v1/bookings/restaurant", visitorSession1.token, {
        listingId: testRestaurant.id,
        bookingDate: "2026-11-25",
        timeSlot: "13:00",
        peopleCount: 4,
        specialRequest: "Window table preferred, pure veg thali.",
      });

      const res = await createRestaurantBooking(req);
      assert.equal(res.status, 201, "Expected HTTP 201 Created");
      const json = await res.json();
      assert.ok(json.id, "Should return booking ID");
      assert.equal(json.listingId, testRestaurant.id);
      assert.equal(json.userId, visitorUser1.id);
      assert.equal(json.peopleCount, 4);
      assert.equal(json.status, "PENDING");
      createdBookingId = json.id;
    });

    it("2. Duplicate reservation for same user, listing, date and slot is rejected (HTTP 409)", async () => {
      const req = createReq("POST", "/api/v1/bookings/restaurant", visitorSession1.token, {
        listingId: testRestaurant.id,
        bookingDate: "2026-11-25",
        timeSlot: "13:00",
        peopleCount: 2,
      });

      const res = await createRestaurantBooking(req);
      assert.equal(res.status, 409, "Expected HTTP 409 Conflict for duplicate reservation");
      const json = await res.json();
      assert.match(json.error, /already have a pending or approved booking/i);
    });

    it("3. Reject reservation when restaurant does not accept reservations (HTTP 400)", async () => {
      const req = createReq("POST", "/api/v1/bookings/restaurant", visitorSession1.token, {
        listingId: noReservationRestaurant.id,
        bookingDate: "2026-11-25",
        timeSlot: "10:00",
        peopleCount: 2,
      });

      const res = await createRestaurantBooking(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /does not accept reservations/i);
    });

    it("4. Overbooking prevention rejects reservation when approved guests exceed table capacity (HTTP 409)", async () => {
      // First, restaurant owner approves the 4-person booking from Scenario 1
      const approveReq = createReq("PATCH", `/api/v1/bookings/restaurant/${createdBookingId}`, restaurantOwnerSession.token, {
        status: "APPROVED",
      });
      const approveRes = await updateRestaurantBooking(approveReq, { params: Promise.resolve({ id: createdBookingId }) });
      assert.equal(approveRes.status, 200);

      // Now visitor 2 attempts to book 18 people for the same slot (Capacity is 20, 4 already approved, 4 + 18 = 22 > 20)
      const overbookReq = createReq("POST", "/api/v1/bookings/restaurant", visitorSession2.token, {
        listingId: testRestaurant.id,
        bookingDate: "2026-11-25",
        timeSlot: "13:00",
        peopleCount: 18,
      });

      const overbookRes = await createRestaurantBooking(overbookReq);
      assert.equal(overbookRes.status, 409);
      const json = await overbookRes.json();
      assert.match(json.error, /fully booked/i);
    });

    it("5. Unauthenticated restaurant booking attempt is blocked (HTTP 401)", async () => {
      const req = createReq("POST", "/api/v1/bookings/restaurant", undefined, {
        listingId: testRestaurant.id,
        bookingDate: "2026-11-25",
        timeSlot: "19:00",
        peopleCount: 2,
      });

      const res = await createRestaurantBooking(req);
      assert.equal(res.status, 401);
    });

    it("6. Visitor can view only their own restaurant bookings (tenant isolation)", async () => {
      const req = createReq("GET", "/api/v1/bookings/restaurant", visitorSession1.token);
      const res = await getRestaurantBookings(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.items));
      assert.ok(json.items.length >= 1);
      assert.ok(json.items.every((b: any) => b.userId === visitorUser1.id));
    });

    it("7. Unauthorized visitor cannot cancel another user's restaurant booking (HTTP 403)", async () => {
      const req = createReq("PATCH", `/api/v1/bookings/restaurant/${createdBookingId}`, visitorSession2.token, {
        status: "CANCELLED",
      });
      const res = await updateRestaurantBooking(req, { params: Promise.resolve({ id: createdBookingId }) });
      assert.equal(res.status, 403);
    });

    it("8. Visitor can successfully cancel their own restaurant booking", async () => {
      const req = createReq("PATCH", `/api/v1/bookings/restaurant/${createdBookingId}`, visitorSession1.token, {
        status: "CANCELLED",
      });
      const res = await updateRestaurantBooking(req, { params: Promise.resolve({ id: createdBookingId }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, "CANCELLED");
    });
  });

  describe("Part 2: Free Accommodation Registration Engine", () => {
    let createdAccomBookingId: string;

    it("9. Valid free accommodation registration is created successfully (HTTP 201)", async () => {
      const req = createReq("POST", "/api/v1/bookings/accommodation", visitorSession1.token, {
        listingId: testAccommodation.id,
        checkInDate: "2026-11-20",
        checkOutDate: "2026-11-22",
        peopleCount: 4,
        groupType: "FAMILY",
        guestName: "Devotee Visitor One",
        guestPhone: `${PHONE_PREFIX}0011`,
        idProofType: "AADHAAR",
        idProofNumber: "XXXX-XXXX-1234",
        specialNotes: "Elderly pilgrim accompanying.",
      });

      const res = await createAccommodationBooking(req);
      assert.equal(res.status, 201, "Expected HTTP 201 Created");
      const json = await res.json();
      assert.ok(json.id);
      assert.equal(json.listingId, testAccommodation.id);
      assert.equal(json.userId, visitorUser1.id);
      assert.equal(json.peopleCount, 4);
      assert.equal(json.status, "CONFIRMED");
      createdAccomBookingId = json.id;
    });

    it("10. Reject registration when check-out date is not strictly after check-in date (HTTP 422)", async () => {
      const req = createReq("POST", "/api/v1/bookings/accommodation", visitorSession1.token, {
        listingId: testAccommodation.id,
        checkInDate: "2026-11-25",
        checkOutDate: "2026-11-25", // Same day check-out
        peopleCount: 2,
        guestName: "Devotee",
        guestPhone: `${PHONE_PREFIX}0011`,
      });

      const res = await createAccommodationBooking(req);
      assert.equal(res.status, 422);
      const json = await res.json();
      assert.match(json.error, /strictly after check-in/i);
    });

    it("11. Reject registration exceeding maximum stay limit (maxStayDays = 3) (HTTP 422)", async () => {
      const req = createReq("POST", "/api/v1/bookings/accommodation", visitorSession1.token, {
        listingId: testAccommodation.id,
        checkInDate: "2026-11-20",
        checkOutDate: "2026-11-26", // 6 days > 3 days limit
        peopleCount: 2,
        guestName: "Devotee",
        guestPhone: `${PHONE_PREFIX}0011`,
      });

      const res = await createAccommodationBooking(req);
      assert.equal(res.status, 422);
      const json = await res.json();
      assert.match(json.error, /maximum permitted stay/i);
    });

    it("12. Capacity bounds check prevents registration when centre capacity is exceeded (HTTP 422)", async () => {
      // testAccommodation capacity is 15. Scenario 9 registered 4 pilgrims.
      // Visitor 2 attempts to register 14 pilgrims for overlapping dates (4 + 14 = 18 > 15)
      const req = createReq("POST", "/api/v1/bookings/accommodation", visitorSession2.token, {
        listingId: testAccommodation.id,
        checkInDate: "2026-11-21",
        checkOutDate: "2026-11-23",
        peopleCount: 14,
        guestName: "Pilgrim Group",
        guestPhone: `${PHONE_PREFIX}0012`,
      });

      const res = await createAccommodationBooking(req);
      assert.equal(res.status, 422);
      const json = await res.json();
      assert.match(json.error, /remaining for the selected dates/i);
    });

    it("13. Unauthenticated accommodation registration is blocked (HTTP 401)", async () => {
      const req = createReq("POST", "/api/v1/bookings/accommodation", undefined, {
        listingId: testAccommodation.id,
        checkInDate: "2026-11-20",
        checkOutDate: "2026-11-22",
        peopleCount: 2,
        guestName: "Anon",
        guestPhone: `${PHONE_PREFIX}0011`,
      });

      const res = await createAccommodationBooking(req);
      assert.equal(res.status, 401);
    });

    it("14. Visitor can query their own accommodation registrations", async () => {
      const req = createReq("GET", "/api/v1/bookings/accommodation", visitorSession1.token);
      const res = await getAccommodationBookings(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.items));
      assert.ok(json.items.length >= 1);
      assert.ok(json.items.every((b: any) => b.userId === visitorUser1.id));
    });

    it("15. Visitor can cancel their own accommodation registration", async () => {
      const req = createReq("PATCH", "/api/v1/bookings/accommodation", visitorSession1.token, {
        bookingId: createdAccomBookingId,
        status: "CANCELLED",
      });

      const res = await updateAccommodationBooking(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.booking.status, "CANCELLED");
    });

    it("16. Visitor cannot arbitrarily transition registration to CONFIRMED (HTTP 403)", async () => {
      const req = createReq("PATCH", "/api/v1/bookings/accommodation", visitorSession1.token, {
        bookingId: createdAccomBookingId,
        status: "CONFIRMED",
      });

      const res = await updateAccommodationBooking(req);
      assert.equal(res.status, 403);
    });
  });
});
