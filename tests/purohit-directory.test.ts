import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { NextRequest } from "next/server";

// Configure isolated test database
const testDbPath = path.resolve(__dirname, "../db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession } from "@/lib/auth";
import { GET as getPurohits, POST as createPurohit } from "@/app/api/v1/ceremonies/purohits/route";
import { GET as getPurohitById, PATCH as updatePurohit } from "@/app/api/v1/ceremonies/purohits/[id]/route";
import { GET as getCeremonyBookings, POST as createCeremonyBooking } from "@/app/api/v1/ceremonies/bookings/route";

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

describe("Purohit Public Directory Visibility, Publishing & Privacy Lifecycle", () => {
  let superAdminUser: any;
  let superAdminSession: any;
  let visitorUser: any;
  let visitorSession: any;
  let visitorUser2: any;
  let visitorSession2: any;
  let testPurohitProfile: any;

  before(async () => {
    // Pre-cleanup in case of aborted runs
    await prisma.ceremonyBooking.deleteMany({ where: { visitorPhone: { startsWith: "910000" } } });
    await prisma.purohitBlockedSlot.deleteMany({ where: { purohit: { phone: { startsWith: "910000" } } } });
    await prisma.purohitProfile.deleteMany({ where: { phone: { startsWith: "910000" } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "910000" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "910000" } } });

    // 1. Create Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9100000010",
        name: "Test Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminPass123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD", true);

    // 2. Create Visitor User
    visitorUser = await prisma.user.create({
      data: {
        phone: "9100000011",
        name: "Test Pilgrim Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPass123!"),
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD", false);

    // 2b. Create Visitor User 2 (for tenant isolation tests)
    visitorUser2 = await prisma.user.create({
      data: {
        phone: "9100000013",
        name: "Test Pilgrim Visitor Two",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPass123!"),
      },
    });
    visitorSession2 = await createSession(visitorUser2.id, "PASSWORD", false);

    // 3. Create a Verified, Active, and Published Purohit Profile
    testPurohitProfile = await prisma.purohitProfile.create({
      data: {
        fullName: "Brahmasri Venkata Ramana Somayajula",
        phone: "9100000012",
        email: "shastri@godavari.pushkaralu.local",
        address: "Pushkar Ghat Road, Rajahmundry",
        serviceArea: "Pushkar Ghat, Kotilingala Ghat, Rajahmundry",
        languages: JSON.stringify(["Telugu", "Sanskrit", "Hindi"]),
        ceremonies: JSON.stringify([
          "Pinda Pradanam (Ancestral Food Offering)",
          "Pitru Tarpana & Pushkara Snanam",
        ]),
        experienceYears: 15,
        qualifications: "Rigveda Samhita Scholar",
        baseFee: 2500,
        verificationStatus: "VERIFIED",
        isActive: true,
        isPublished: true,
        supportingDocuments: JSON.stringify([{ name: "VedaPatra.pdf", url: "/docs/vedapatra.pdf" }]),
      },
    });
  });

  after(async () => {
    // Post-cleanup
    if (testPurohitProfile) {
      await prisma.ceremonyBooking.deleteMany({ where: { purohitId: testPurohitProfile.id } });
      await prisma.purohitBlockedSlot.deleteMany({ where: { purohitId: testPurohitProfile.id } });
      await prisma.purohitProfile.delete({ where: { id: testPurohitProfile.id } }).catch(() => {});
    }
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "910000" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "910000" } } });
    await prisma.$disconnect();
  });

  it("1. Public visitor can see verified, active, published purohit in public directory", async () => {
    const req = createReq("GET", "/api/v1/ceremonies/purohits");
    const res = await getPurohits(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(Array.isArray(body.purohits));

    const found = body.items.find((p: any) => p.id === testPurohitProfile.id);
    assert.ok(found, "Purohit should be present in public items");
    assert.equal(found.isVerified, true);
    assert.equal(found.isPublished, true);
    assert.equal(found.isActive, true);
  });

  it("2. Public directory strictly redacts sensitive personal contact and documents for privacy", async () => {
    const req = createReq("GET", "/api/v1/ceremonies/purohits");
    const res = await getPurohits(req);
    const body = await res.json();
    const found = body.items.find((p: any) => p.id === testPurohitProfile.id);

    assert.ok(found);
    assert.equal(found.phone, undefined, "Phone must be redacted for public visitors");
    assert.equal(found.email, undefined, "Email must be redacted for public visitors");
    assert.equal(found.address, undefined, "Address must be redacted for public visitors");
    assert.equal(found.supportingDocuments, undefined, "Documents must be redacted for public visitors");
  });

  it("3. Super Admin can inspect private contact and document details", async () => {
    const req = createReq("GET", `/api/v1/ceremonies/purohits/${testPurohitProfile.id}`, superAdminSession.token);
    const res = await getPurohitById(req, { params: Promise.resolve({ id: testPurohitProfile.id }) });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.purohit.phone, "9100000012");
    assert.equal(body.purohit.email, "shastri@godavari.pushkaralu.local");
    assert.ok(body.purohit.supportingDocuments);
  });

  it("4. Category query ceremony=CEREMONY does not break visibility", async () => {
    const req = createReq("GET", "/api/v1/ceremonies/purohits?ceremony=CEREMONY");
    const res = await getPurohits(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    const found = body.items.find((p: any) => p.id === testPurohitProfile.id);
    assert.ok(found, "Category enum 'CEREMONY' should not filter out verified purohits");
  });

  it("5. Specific ceremony type filtering works accurately", async () => {
    const reqPinda = createReq("GET", "/api/v1/ceremonies/purohits?ceremony=pinda_pradanam");
    const resPinda = await getPurohits(reqPinda);
    const bodyPinda = await resPinda.json();
    const foundPinda = bodyPinda.items.find((p: any) => p.id === testPurohitProfile.id);
    assert.ok(foundPinda, "Supported ritual pinda_pradanam must match");

    const reqHarathi = createReq("GET", "/api/v1/ceremonies/purohits?ceremony=godavari_harathi");
    const resHarathi = await getPurohits(reqHarathi);
    const bodyHarathi = await resHarathi.json();
    const foundHarathi = bodyHarathi.items.find((p: any) => p.id === testPurohitProfile.id);
    assert.equal(foundHarathi, undefined, "Unsupported ritual godavari_harathi must not match");
  });

  it("6. Area dropdown location matches multi-ghat service area string", async () => {
    const reqArea = createReq("GET", `/api/v1/ceremonies/purohits?area=${encodeURIComponent("Pushkar Ghat, Rajahmundry")}`);
    const resArea = await getPurohits(reqArea);
    const bodyArea = await resArea.json();
    const foundArea = bodyArea.items.find((p: any) => p.id === testPurohitProfile.id);
    assert.ok(foundArea, "Location dropdown 'Pushkar Ghat, Rajahmundry' should match service area");
  });

  it("7. Super Admin unpublishing removes Purohit from public directory", async () => {
    const patchReq = createReq(
      "PATCH",
      `/api/v1/ceremonies/purohits/${testPurohitProfile.id}`,
      superAdminSession.token,
      { isPublished: false }
    );
    const patchRes = await updatePurohit(patchReq, { params: Promise.resolve({ id: testPurohitProfile.id }) });
    assert.equal(patchRes.status, 200);

    const publicReq = createReq("GET", "/api/v1/ceremonies/purohits");
    const publicRes = await getPurohits(publicReq);
    const publicBody = await publicRes.json();
    const found = publicBody.items.find((p: any) => p.id === testPurohitProfile.id);
    assert.equal(found, undefined, "Unpublished purohit must not appear in public directory");
  });

  it("8. Visitors cannot book an unpublished purohit", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const bookReq = createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
      purohitId: testPurohitProfile.id,
      visitorName: "Test Pilgrim",
      visitorPhone: "9100000011",
      ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
      bookingDate: dateStr,
      startTime: "08:00",
      endTime: "09:30",
      locationAddress: "Pushkar Ghat, Rajahmundry",
    });
    const bookRes = await createCeremonyBooking(bookReq);
    assert.equal(bookRes.status, 400);

    const bookBody = await bookRes.json();
    assert.ok(bookBody.error.includes("not available for new public bookings"));
  });

  it("9. Super Admin re-publishing restores Purohit to public directory", async () => {
    const patchReq = createReq(
      "PATCH",
      `/api/v1/ceremonies/purohits/${testPurohitProfile.id}`,
      superAdminSession.token,
      { isPublished: true }
    );
    const patchRes = await updatePurohit(patchReq, { params: Promise.resolve({ id: testPurohitProfile.id }) });
    assert.equal(patchRes.status, 200);

    const publicReq = createReq("GET", "/api/v1/ceremonies/purohits");
    const publicRes = await getPurohits(publicReq);
    const publicBody = await publicRes.json();
    const found = publicBody.items.find((p: any) => p.id === testPurohitProfile.id);
    assert.ok(found, "Re-published purohit must immediately reappear in public directory");
  });

  it("10. Public directory enforces strict no-cache headers for visibility after refresh", async () => {
    const req = createReq("GET", "/api/v1/ceremonies/purohits");
    const res = await getPurohits(req);
    const cc = res.headers.get("cache-control") || "";
    assert.ok(cc.includes("no-store"), "Must contain no-store");
    assert.ok(cc.includes("no-cache"), "Must contain no-cache");
    assert.ok(cc.includes("must-revalidate"), "Must contain must-revalidate");
  });

  it("11. Unauthorized non-admin cannot alter purohit verification or publication", async () => {
    const patchReq = createReq(
      "PATCH",
      `/api/v1/ceremonies/purohits/${testPurohitProfile.id}`,
      visitorSession.token,
      { verificationStatus: "REJECTED" }
    );
    const patchRes = await updatePurohit(patchReq, { params: Promise.resolve({ id: testPurohitProfile.id }) });
    assert.equal(patchRes.status, 403);
  });

  describe("Godavari One Ceremony Booking Validation, Concurrency & Tenant Isolation Suite", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);
    const bookingDateStr = futureDate.toISOString().split("T")[0];

    it("Scenario 1: Valid Ghat ceremony booking with null/omitted locationAddress (Fixes HTTP 422 regression)", async () => {
      const req = createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: bookingDateStr,
        startTime: "09:00",
        durationMinutes: 60,
        ceremonyLocation: "Kotilingala Ghat, Rajahmundry",
        locationAddress: null, // previously rejected with 422 "Invalid input: expected string, received null"
        visitorName: "Test Pilgrim Visitor",
        visitorPhone: "9100000011",
        participantCount: 2,
      });
      const res = await createCeremonyBooking(req);
      assert.equal(res.status, 201, "Valid Ghat ceremony with null locationAddress must return 201");
      const body = await res.json();
      assert.ok(body.booking, "Should return booking object");
      assert.match(body.booking.bookingReference, /^CER-2027-[0-9A-F]{6}$/);
      assert.equal(body.booking.status, "CONFIRMED");

      // Verify DB persistence
      const saved = await prisma.ceremonyBooking.findUnique({
        where: { id: body.booking.id },
      });
      assert.ok(saved);
      assert.equal(saved.locationType, "GHAT");
      assert.equal(saved.locationAddress, "Kotilingala Ghat, Rajahmundry");
      assert.equal(saved.visitorPhone, "9100000011");
    });

    it("Scenario 2: Valid Hotel/Residence ceremony booking with custom address", async () => {
      const req = createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pitru Tarpana & Pushkara Snanam",
        bookingDate: bookingDateStr,
        startTime: "11:00",
        durationMinutes: 60,
        ceremonyLocation: "Visitor Hotel / Private Residence",
        locationType: "HOME_HOTEL",
        locationAddress: "River View Hotel, Room 302, Rajahmundry",
        visitorName: "Test Pilgrim Visitor",
        visitorPhone: "9100000011",
        participantCount: 3,
      });
      const res = await createCeremonyBooking(req);
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.booking.locationType, "HOME_HOTEL");
      assert.equal(body.booking.locationAddress, "River View Hotel, Room 302, Rajahmundry");
    });

    it("Scenario 3: Missing required fields rejected with HTTP 422", async () => {
      // Missing purohitId
      const res1 = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: bookingDateStr,
        startTime: "14:00",
      }));
      assert.equal(res1.status, 422);

      // Missing ceremonyType
      const res2 = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        bookingDate: bookingDateStr,
        startTime: "14:00",
      }));
      assert.equal(res2.status, 422);

      // Missing bookingDate
      const res3 = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        startTime: "14:00",
      }));
      assert.equal(res3.status, 422);

      // Missing startTime
      const res4 = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: bookingDateStr,
      }));
      assert.equal(res4.status, 422);
    });

    it("Scenario 4: Past booking date rejected with HTTP 422", async () => {
      const res = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: "2020-01-01",
        startTime: "09:00",
      }));
      assert.equal(res.status, 422);
      const body = await res.json();
      assert.ok(body.error.includes("past dates"));
    });

    it("Scenario 5: Invalid calendar date rejected with HTTP 422", async () => {
      const res = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: "2027-02-31",
        startTime: "09:00",
      }));
      assert.equal(res.status, 422);
    });

    it("Scenario 6: Invalid start time format rejected with HTTP 422", async () => {
      const res = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: bookingDateStr,
        startTime: "invalid-time",
      }));
      assert.equal(res.status, 422);
    });

    it("Scenario 7: Unauthenticated request rejected with HTTP 401", async () => {
      const res = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", undefined, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: bookingDateStr,
        startTime: "15:00",
      }));
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.ok(body.error.includes("Authentication required"));
    });

    it("Scenario 8: Duplicate slot / overlapping booking rejected with HTTP 409 Conflict", async () => {
      // Slot 09:00 - 10:00 is already booked in Scenario 1.
      // Try to book overlapping slot 09:30 - 10:30 on the same date for the same purohit.
      const res = await createCeremonyBooking(createReq("POST", "/api/v1/ceremonies/bookings", visitorSession2.token, {
        purohitId: testPurohitProfile.id,
        ceremonyType: "Pinda Pradanam (Ancestral Food Offering)",
        bookingDate: bookingDateStr,
        startTime: "09:30",
        durationMinutes: 60,
      }));
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.ok(body.error.includes("conflict") || body.error.includes("booked"));
    });

    it("Scenario 9: Tenant isolation: Visitor can only view their own bookings, while Super Admin views all", async () => {
      // Visitor 2 queries ceremony bookings -> sees 0 items
      const resV2 = await getCeremonyBookings(createReq("GET", "/api/v1/ceremonies/bookings", visitorSession2.token));
      assert.equal(resV2.status, 200);
      const bodyV2 = await resV2.json();
      assert.equal(bodyV2.items.length, 0);

      // Visitor 1 queries ceremony bookings -> sees their bookings
      const resV1 = await getCeremonyBookings(createReq("GET", "/api/v1/ceremonies/bookings", visitorSession.token));
      assert.equal(resV1.status, 200);
      const bodyV1 = await resV1.json();
      assert.ok(bodyV1.items.length >= 2);
      assert.ok(bodyV1.items.every((b: any) => b.visitorPhone === "9100000011"));

      // Super Admin queries ceremony bookings -> sees all bookings
      const resAdmin = await getCeremonyBookings(createReq("GET", "/api/v1/ceremonies/bookings", superAdminSession.token));
      assert.equal(resAdmin.status, 200);
      const bodyAdmin = await resAdmin.json();
      assert.ok(bodyAdmin.items.length >= 2);
    });
  });
});
