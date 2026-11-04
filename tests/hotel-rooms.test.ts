import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import { hashPassword, createSession } from "../src/lib/auth";
import { POST as createHotelRoom, GET as getHotelRooms } from "../src/app/api/v1/hotels/[id]/rooms/route";
import { PATCH as updateHotelRoom, DELETE as deleteHotelRoom } from "../src/app/api/v1/hotels/[id]/rooms/[roomId]/route";
import { POST as createHotelBooking } from "../src/app/api/v1/bookings/hotel/route";
import { PATCH as updateHotelBooking } from "../src/app/api/v1/bookings/hotel/[id]/route";
import { NextRequest } from "next/server";

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});

describe("Hotel Room & Capacity Management", () => {
  let superAdminUser: any;
  let hotelOwnerUser: any;
  let otherOwnerUser: any;
  let reviewerUser: any;
  let visitorUser: any;

  let superAdminSession: any;
  let hotelOwnerSession: any;
  let otherOwnerSession: any;
  let reviewerSession: any;
  let visitorSession: any;

  let testHotel: any;
  let testRoomType: any;

  before(async () => {
    // Clean up any previous test artifacts
    await prisma.hotelBooking.deleteMany({ where: { user: { phone: { startsWith: "918888" } } } });
    await prisma.hotelRoom.deleteMany({ where: { listing: { owner: { phone: { startsWith: "918888" } } } } });
    await prisma.listing.deleteMany({ where: { owner: { phone: { startsWith: "918888" } } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "918888" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "918888" } } });

    // Synthetic users
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9188880001",
        name: "Hotel Test SuperAdmin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("Admin123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    hotelOwnerUser = await prisma.user.create({
      data: {
        phone: "9188880002",
        name: "Hotel Test Owner",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("Owner123!"),
      },
    });
    hotelOwnerSession = await createSession(hotelOwnerUser.id, "PASSWORD");

    otherOwnerUser = await prisma.user.create({
      data: {
        phone: "9188880003",
        name: "Other Hotel Owner",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("Other123!"),
      },
    });
    otherOwnerSession = await createSession(otherOwnerUser.id, "PASSWORD");

    reviewerUser = await prisma.user.create({
      data: {
        phone: "9188880004",
        name: "Booking Reviewer",
        role: "BOOKING_REVIEWER",
        status: "ACTIVE",
        passwordHash: hashPassword("Reviewer123!"),
      },
    });
    reviewerSession = await createSession(reviewerUser.id, "PASSWORD");

    visitorUser = await prisma.user.create({
      data: {
        phone: "9188880005",
        name: "Test Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD");

    // Create synthetic hotel listing
    testHotel = await prisma.listing.create({
      data: {
        name: "Godavari Grand Residency",
        category: "HOTEL",
        description: "Luxury river-view hotel",
        address: "Pushkar Ghat Road, Rajahmundry",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        ownerId: hotelOwnerUser.id,
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
  });

  after(async () => {
    // Cleanup synthetic test records
    await prisma.hotelBooking.deleteMany({ where: { listingId: testHotel.id } });
    await prisma.hotelRoom.deleteMany({ where: { listingId: testHotel.id } });
    await prisma.hotelDetails.deleteMany({ where: { listingId: testHotel.id } });
    await prisma.listing.deleteMany({ where: { id: testHotel.id } });

    const testPhones = ["9188880001", "9188880002", "9188880003", "9188880004", "9188880005"];
    await prisma.session.deleteMany({ where: { user: { phone: { in: testPhones } } } });
    await prisma.user.deleteMany({ where: { phone: { in: testPhones } } });
    await prisma.$disconnect();
  });

  function makeReq(url: string, method: string, sessionToken?: string, body?: any) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (sessionToken) {
      headers["cookie"] = `godavari_session=${sessionToken}`;
    }
    return new NextRequest(new URL(url, "http://localhost:3000"), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("permits hotel owner to create a new room type", async () => {
    const req = makeReq(`http://localhost:3000/api/v1/hotels/${testHotel.id}/rooms`, "POST", hotelOwnerSession.token, {
      name: "Deluxe River View",
      roomIdentifier: "DRV-101",
      description: "King bed with private balcony overlooking the Godavari river",
      totalRooms: 5,
      maxAdults: 2,
      maxChildren: 1,
      maxGuests: 3,
      basePrice: 2500,
      extraPersonPrice: 500,
      amenities: ["AC", "WiFi", "Balcony", "Geyser", "Breakfast"],
      bedType: "1 King Bed",
      bedCount: 1,
      isActive: true,
    });

    const res = await createHotelRoom(req, { params: Promise.resolve({ id: testHotel.id }) });
    const json = await res.json();
    assert.equal(res.status, 201, `Failed to create room: ${JSON.stringify(json)}`);
    assert.equal(json.name, "Deluxe River View");
    assert.equal(json.totalRooms, 5);
    assert.equal(json.basePrice, 2500);
    testRoomType = json;
  });

  it("rejects unauthorized users from creating room inventory", async () => {
    // Other owner
    const reqOther = makeReq(`http://localhost:3000/api/v1/hotels/${testHotel.id}/rooms`, "POST", otherOwnerSession.token, {
      name: "Unauthorized Room",
      totalRooms: 2,
      maxAdults: 2,
      maxGuests: 2,
      basePrice: 1000,
    });
    const resOther = await createHotelRoom(reqOther, { params: Promise.resolve({ id: testHotel.id }) });
    assert.equal(resOther.status, 403);

    // Booking Reviewer
    const reqReviewer = makeReq(`http://localhost:3000/api/v1/hotels/${testHotel.id}/rooms`, "POST", reviewerSession.token, {
      name: "Reviewer Room",
      totalRooms: 2,
      maxAdults: 2,
      maxGuests: 2,
      basePrice: 1000,
    });
    const resReviewer = await createHotelRoom(reqReviewer, { params: Promise.resolve({ id: testHotel.id }) });
    assert.equal(resReviewer.status, 403);

    // Visitor
    const reqVisitor = makeReq(`http://localhost:3000/api/v1/hotels/${testHotel.id}/rooms`, "POST", visitorSession.token, {
      name: "Visitor Room",
      totalRooms: 2,
      maxAdults: 2,
      maxGuests: 2,
      basePrice: 1000,
    });
    const resVisitor = await createHotelRoom(reqVisitor, { params: Promise.resolve({ id: testHotel.id }) });
    assert.equal(resVisitor.status, 403);
  });

  it("enforces capacity and numeric validations on room creation", async () => {
    // Negative rooms
    const reqNeg = makeReq(`http://localhost:3000/api/v1/hotels/${testHotel.id}/rooms`, "POST", hotelOwnerSession.token, {
      name: "Invalid Room",
      totalRooms: -1,
      maxAdults: 2,
      maxGuests: 2,
      basePrice: 1000,
    });
    const resNeg = await createHotelRoom(reqNeg, { params: Promise.resolve({ id: testHotel.id }) });
    assert.equal(resNeg.status, 422);

    // Contradictory capacities: maxGuests < maxAdults
    const reqCap = makeReq(`http://localhost:3000/api/v1/hotels/${testHotel.id}/rooms`, "POST", hotelOwnerSession.token, {
      name: "Contradictory Room",
      totalRooms: 2,
      maxAdults: 4,
      maxChildren: 0,
      maxGuests: 2,
      basePrice: 1000,
    });
    const resCap = await createHotelRoom(reqCap, { params: Promise.resolve({ id: testHotel.id }) });
    assert.equal(resCap.status, 422);
  });

  it("allows visitors to view available rooms with live pricing and inventory", async () => {
    const req = makeReq(
      `http://localhost:3000/api/v1/hotels/${testHotel.id}/rooms?checkIn=2026-11-10&checkOut=2026-11-12&guests=2&rooms=1`,
      "GET"
    );
    const res = await getHotelRooms(req, { params: Promise.resolve({ id: testHotel.id }) });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.items.length, 1);
    assert.equal(json.items[0].availableRooms, 5);
    assert.equal(json.items[0].isAvailable, true);
    assert.equal(json.items[0].nights, 2);
    // 2 nights * 1 room * 2500 basePrice = 5000
    assert.equal(json.items[0].estimatedTotalPrice, 5000);
  });

  it("rejects booking when check-out date is not after check-in date", async () => {
    const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
      listingId: testHotel.id,
      roomId: testRoomType.id,
      checkIn: "2026-11-10",
      checkOut: "2026-11-10", // Same day
      guests: 2,
      rooms: 1,
    });
    const res = await createHotelBooking(req);
    assert.equal(res.status, 422);
  });

  it("prevents overbooking when requested rooms exceed remaining inventory for overlapping dates", async () => {
    // Room type has totalRooms = 5
    // Book 4 rooms for Nov 10 to Nov 13
    const req1 = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
      listingId: testHotel.id,
      roomId: testRoomType.id,
      checkIn: "2026-11-10",
      checkOut: "2026-11-13",
      guests: 8,
      rooms: 4,
    });
    const res1 = await createHotelBooking(req1);
    const json1 = await res1.json();
    assert.equal(res1.status, 201, `First booking failed: ${JSON.stringify(json1)}`);
    assert.equal(json1.rooms, 4);

    // Try booking 2 more rooms for Nov 11 to Nov 12 (overlapping dates)
    // 4 booked + 2 requested = 6 > 5 totalRooms -> must be rejected with 409
    const req2 = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
      listingId: testHotel.id,
      roomId: testRoomType.id,
      checkIn: "2026-11-11",
      checkOut: "2026-11-12",
      guests: 4,
      rooms: 2,
    });
    const res2 = await createHotelBooking(req2);
    assert.equal(res2.status, 409);

    // But booking 1 room for the overlapping dates should SUCCEED (4 + 1 = 5 <= 5)
    const req3 = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
      listingId: testHotel.id,
      roomId: testRoomType.id,
      checkIn: "2026-11-11",
      checkOut: "2026-11-12",
      guests: 2,
      rooms: 1,
    });
    const res3 = await createHotelBooking(req3);
    assert.equal(res3.status, 201);
    const json3 = await res3.json();

    // Now all 5 rooms are booked. Rejecting/cancelling booking releases inventory
    const cancelReq = makeReq(`http://localhost:3000/api/v1/bookings/hotel/${json3.id}`, "PATCH", visitorSession.token, {
      status: "CANCELLED",
    });
    const cancelRes = await updateHotelBooking(cancelReq, { params: Promise.resolve({ id: json3.id }) });
    assert.equal(cancelRes.status, 200);

    // After cancellation, inventory is released, so another 1 room booking succeeds!
    const reqAfterCancel = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
      listingId: testHotel.id,
      roomId: testRoomType.id,
      checkIn: "2026-11-11",
      checkOut: "2026-11-12",
      guests: 2,
      rooms: 1,
    });
    const resAfterCancel = await createHotelBooking(reqAfterCancel);
    assert.equal(resAfterCancel.status, 201);
  });

  describe("Hotel Booking Validation & Contract Verification Suite", () => {
    let laHospinListing: any;

    before(async () => {
      // Clean up any existing test records for LA HOSPIN in test.db
      await prisma.hotelBooking.deleteMany({ where: { listingId: "cmv7us6d90007u3ikka4eo424" } });
      await prisma.hotelDetails.deleteMany({ where: { listingId: "cmv7us6d90007u3ikka4eo424" } });
      await prisma.listing.deleteMany({ where: { id: "cmv7us6d90007u3ikka4eo424" } });

      laHospinListing = await prisma.listing.create({
        data: {
          id: "cmv7us6d90007u3ikka4eo424",
          name: "LA HOSPIN",
          category: "HOTEL",
          description: "Premier luxury stay in Rajahmundry",
          address: "Main Road, Rajahmundry",
          publicationStatus: "PUBLISHED",
          locationVerified: true,
          ownerId: hotelOwnerUser.id,
          hotelDetails: {
            create: {
              accommodationType: "Executive Hotel",
              numRooms: 20,
              checkInTime: "12:00",
              checkOutTime: "11:00",
            },
          },
        },
      });
    });

    after(async () => {
      await prisma.hotelBooking.deleteMany({ where: { listingId: "cmv7us6d90007u3ikka4eo424" } });
      await prisma.hotelDetails.deleteMany({ where: { listingId: "cmv7us6d90007u3ikka4eo424" } });
      await prisma.listing.deleteMany({ where: { id: "cmv7us6d90007u3ikka4eo424" } });
    });

    it("Scenario 1: 2 adults, 0 children -> guests = 2 (Proceeds to booking creation)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        rooms: 1,
        adults: 2,
        children: 0,
        guests: 2,
        specialRequest: "Non-smoking room",
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.guests, 2);
      assert.equal(json.adults, 2);
      assert.equal(json.children, 0);
      assert.equal(json.rooms, 1);
      assert.equal(json.status, "PENDING");
    });

    it("Scenario 2: 2 adults, 1 child -> guests = 3 (Proceeds to booking creation)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-18",
        checkOut: "2026-11-20",
        rooms: 1,
        adults: 2,
        children: 1,
        guests: 3,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.guests, 3);
      assert.equal(json.adults, 2);
      assert.equal(json.children, 1);
    });

    it("Scenario 3: 1 adult, 2 children -> guests = 3 (Proceeds to booking creation)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        checkIn: "2026-11-21",
        checkOut: "2026-11-23",
        rooms: 1,
        adults: 1,
        children: 2,
        guests: 3,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.guests, 3);
      assert.equal(json.adults, 1);
      assert.equal(json.children, 2);
    });

    it("Scenario 4: 0 adults, 0 children -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        rooms: 1,
        adults: 0,
        children: 0,
        guests: 0,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
      const json = await res.json();
      assert.equal(json.error, "Validation failed");
    });

    it("Scenario 5: Missing guests field -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        rooms: 1,
        adults: 2,
        children: 0,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
      const json = await res.json();
      assert.equal(json.error, "Validation failed");
      const guestsIssue = json.details.find((d: any) => d.path === "guests");
      assert.ok(guestsIssue, "Expected validation issue for guests path");
    });

    it("Scenario 6: Negative guest count -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        rooms: 1,
        guests: -2,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
    });

    it("Scenario 7: Decimal guest count -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        rooms: 1,
        guests: 2.5,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
    });

    it("Scenario 8: Missing listingId -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        roomId: testRoomType.id,
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        rooms: 1,
        guests: 2,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
    });

    it("Scenario 9: Invalid check-in date -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-13-45",
        checkOut: "2026-11-17",
        rooms: 1,
        guests: 2,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
    });

    it("Scenario 10: Check-out before check-in -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-11-17",
        checkOut: "2026-11-15",
        rooms: 1,
        guests: 2,
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
    });

    it("Scenario 11: Valid booking request -> Proceeds to booking creation logic (HTTP 201)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-12-01",
        checkOut: "2026-12-04",
        rooms: 1,
        adults: 2,
        children: 0,
        guests: 2,
        specialRequest: "High floor room preferred",
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.status, "PENDING");
      assert.equal(json.guests, 2);
      assert.equal(json.rooms, 1);
      assert.equal(json.specialRequest, "High floor room preferred");
    });

    it("Scenario 12: Inconsistent total guest count (guests != adults + children) -> Rejected (HTTP 422)", async () => {
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, {
        listingId: testHotel.id,
        roomId: testRoomType.id,
        checkIn: "2026-12-05",
        checkOut: "2026-12-07",
        rooms: 1,
        adults: 2,
        children: 1,
        guests: 2, // Should be 3
      });
      const res = await createHotelBooking(req);
      assert.equal(res.status, 422);
      const json = await res.json();
      assert.equal(json.error, "Validation failed");
    });

    it("Original Test Scenario Verification: LA HOSPIN (cmv7us6d90007u3ikka4eo424)", async () => {
      const payload = {
        listingId: "cmv7us6d90007u3ikka4eo424",
        checkIn: "2026-11-03",
        checkOut: "2026-11-06",
        rooms: 1,
        adults: 2,
        children: 0,
        guests: 2,
        specialRequest: "",
      };
      const req = makeReq(`http://localhost:3000/api/v1/bookings/hotel`, "POST", visitorSession.token, payload);
      const res = await createHotelBooking(req);
      const json = await res.json();
      assert.equal(res.status, 201, `Failed to create LA HOSPIN booking: ${JSON.stringify(json)}`);
      assert.equal(json.listingId, "cmv7us6d90007u3ikka4eo424");
      assert.equal(json.guests, 2);
      assert.equal(json.adults, 2);
      assert.equal(json.children, 0);
      assert.equal(json.rooms, 1);
      assert.equal(json.checkIn, "2026-11-03");
      assert.equal(json.checkOut, "2026-11-06");
      assert.equal(json.status, "PENDING");
    });
  });
});
