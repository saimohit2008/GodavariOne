import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import { hashPassword, createSession } from "../src/lib/auth";
import { POST as createRequest, GET as getRequests } from "../src/app/api/v1/nri/requests/route";
import { GET as getRequestById, PATCH as updateRequest } from "../src/app/api/v1/nri/requests/[id]/route";
import { POST as assignProvider } from "../src/app/api/v1/nri/requests/[id]/assign/route";
import { POST as createQuotation, GET as getQuotations } from "../src/app/api/v1/nri/requests/[id]/quotations/route";
import { GET as getQuotationById, PATCH as updateQuotation } from "../src/app/api/v1/nri/quotations/[id]/route";
import { POST as acceptQuotation } from "../src/app/api/v1/nri/quotations/[id]/accept/route";
import { POST as confirmQuotation } from "../src/app/api/v1/nri/quotations/[id]/confirm/route";
import { POST as postMessage, GET as getMessages } from "../src/app/api/v1/nri/requests/[id]/messages/route";
import { NextRequest } from "next/server";

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});

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

describe("Godavari One — NRI Custom Package & Quotation Workflow", () => {
  let superAdminUser: any;
  let superAdminSession: any;

  let providerUser1: any;
  let providerSession1: any;

  let providerUser2: any;
  let providerSession2: any;

  let visitorUser: any;
  let visitorSession: any;

  let unassignedProvider: any;
  let unassignedSession: any;

  let testRequestId: string;
  let testRefNumber: string;
  let testQuotationId1: string;
  let testQuotationId2: string;

  before(async () => {
    // Clean up any test artifacts with prefix 919876
    await prisma.nriMessage.deleteMany({ where: { sender: { phone: { startsWith: "919876" } } } });
    await prisma.nriQuotationLineItem.deleteMany({ where: { quotation: { provider: { phone: { startsWith: "919876" } } } } });
    await prisma.nriQuotationVersion.deleteMany({ where: { quotation: { provider: { phone: { startsWith: "919876" } } } } });
    await prisma.nriQuotation.deleteMany({ where: { provider: { phone: { startsWith: "919876" } } } });
    await prisma.nriRequestAssignment.deleteMany({ where: { provider: { phone: { startsWith: "919876" } } } });
    await prisma.nriStatusHistory.deleteMany({ where: { request: { visitorPhone: { startsWith: "919876" } } } });
    await prisma.nriPackageRequest.deleteMany({ where: { visitorPhone: { startsWith: "919876" } } });
    await prisma.listing.deleteMany({ where: { owner: { phone: { startsWith: "919876" } } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "919876" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "919876" } } });

    // 1. Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9198760001",
        name: "NRI Admin SuperUser",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminSecret!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    // 2. Business Owner 1 (Tours & Travels)
    providerUser1 = await prisma.user.create({
      data: {
        phone: "9198760002",
        name: "Godavari Divine Travels",
        email: "divine.travels@test.com",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("Owner123!"),
      },
    });
    providerSession1 = await createSession(providerUser1.id, "PASSWORD");

    // Link a TRANSPORT listing to Provider 1
    await prisma.listing.create({
      data: {
        name: "Godavari Divine Fleet",
        category: "TRANSPORT",
        description: "Luxury Innova & Tempo fleet",
        address: "Main Road, Rajahmundry",
        ownerId: providerUser1.id,
        publicationStatus: "PUBLISHED",
      },
    });

    // 3. Business Owner 2 (Riverside Hospitality)
    providerUser2 = await prisma.user.create({
      data: {
        phone: "9198760003",
        name: "Godavari River Heritage Resort",
        email: "river.heritage@test.com",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("Owner123!"),
      },
    });
    providerSession2 = await createSession(providerUser2.id, "PASSWORD");

    await prisma.listing.create({
      data: {
        name: "River Heritage Resort",
        category: "HOTEL",
        description: "5-Star Riverside Resort",
        address: "Godavari Bund, Rajahmundry",
        ownerId: providerUser2.id,
        publicationStatus: "PUBLISHED",
      },
    });

    // 4. Unassigned Business Owner (should not see requests not routed to them)
    unassignedProvider = await prisma.user.create({
      data: {
        phone: "9198760004",
        name: "Unassigned Cafe Owner",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("Owner123!"),
      },
    });
    unassignedSession = await createSession(unassignedProvider.id, "PASSWORD");

    // 5. Visitor (NRI traveling with family)
    visitorUser = await prisma.user.create({
      data: {
        phone: "9198760005",
        name: "Venkat Ramanathan",
        email: "venkat.nri@test.com",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD");
  });

  after(async () => {
    await prisma.nriMessage.deleteMany({ where: { sender: { phone: { startsWith: "919876" } } } });
    await prisma.nriQuotationLineItem.deleteMany({ where: { quotation: { provider: { phone: { startsWith: "919876" } } } } });
    await prisma.nriQuotationVersion.deleteMany({ where: { quotation: { provider: { phone: { startsWith: "919876" } } } } });
    await prisma.nriQuotation.deleteMany({ where: { provider: { phone: { startsWith: "919876" } } } });
    await prisma.nriRequestAssignment.deleteMany({ where: { provider: { phone: { startsWith: "919876" } } } });
    await prisma.nriStatusHistory.deleteMany({ where: { request: { visitorPhone: { startsWith: "919876" } } } });
    await prisma.nriPackageRequest.deleteMany({ where: { visitorPhone: { startsWith: "919876" } } });
    await prisma.listing.deleteMany({ where: { owner: { phone: { startsWith: "919876" } } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "919876" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "919876" } } });
    await prisma.$disconnect();
  });

  // 1. Group Size Validations
  it("rejects request when group size is less than 2 people", async () => {
    const req = createReq("POST", "/api/v1/nri/requests", visitorSession.token, {
      groupSize: 1, // Invalid: Minimum 2
      numAdults: 1,
      numChildren: 0,
      arrivalDate: "2027-07-15",
      departureDate: "2027-07-20",
      arrivalLocation: "Rajahmundry Airport (RJA)",
      departureLocation: "Rajahmundry Airport (RJA)",
      accommodationPreference: "LUXURY_RIVERSIDE",
      dietaryPreference: "PURE_VEG",
      visitorName: "Solo Traveler",
      visitorEmail: "solo@test.com",
      visitorPhone: "9198760005",
      countryOfResidence: "USA",
    });

    const res: any = await createRequest(req);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.match(body.error, /Minimum 2 people required/i);
  });

  it("rejects request when group size exceeds 10 people", async () => {
    const req = createReq("POST", "/api/v1/nri/requests", visitorSession.token, {
      groupSize: 11, // Invalid: Maximum 10
      numAdults: 8,
      numChildren: 3,
      arrivalDate: "2027-07-15",
      departureDate: "2027-07-20",
      arrivalLocation: "Rajahmundry Airport (RJA)",
      departureLocation: "Rajahmundry Airport (RJA)",
      accommodationPreference: "LUXURY_RIVERSIDE",
      dietaryPreference: "PURE_VEG",
      visitorName: "Large Group",
      visitorEmail: "large@test.com",
      visitorPhone: "9198760005",
      countryOfResidence: "USA",
    });

    const res: any = await createRequest(req);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.match(body.error, /Maximum 10 people allowed/i);
  });

  it("rejects request when adults + children does not match group size", async () => {
    const req = createReq("POST", "/api/v1/nri/requests", visitorSession.token, {
      groupSize: 4,
      numAdults: 2,
      numChildren: 1, // 2 + 1 = 3 != 4
      arrivalDate: "2027-07-15",
      departureDate: "2027-07-20",
      arrivalLocation: "Rajahmundry Airport (RJA)",
      departureLocation: "Rajahmundry Airport (RJA)",
      accommodationPreference: "LUXURY_RIVERSIDE",
      dietaryPreference: "PURE_VEG",
      visitorName: "Venkat Ramanathan",
      visitorEmail: "venkat.nri@test.com",
      visitorPhone: "9198760005",
      countryOfResidence: "USA",
    });

    const res: any = await createRequest(req);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.match(body.error, /equal the total group size/i);
  });

  // 2. Request Creation & Reference Number Generation
  it("creates valid package request for group of 4 and auto-routes to eligible business owners", async () => {
    const req = createReq("POST", "/api/v1/nri/requests", visitorSession.token, {
      groupSize: 4,
      numAdults: 3,
      numChildren: 1,
      arrivalDate: "2027-07-15",
      departureDate: "2027-07-20",
      arrivalLocation: "Rajahmundry Airport (RJA)",
      departureLocation: "Rajahmundry Airport (RJA)",
      accommodationPreference: "Luxury Riverside Resort & Cottages",
      numRooms: 2,
      dietaryPreference: "Pure Vegetarian (Satvik)",
      specialRequests: "Wheelchair assistance for elderly mother and VIP Pushkar Snanam passes",
      preferredItinerary: "Pushkar Ghat Harathi, Kotilingeshwara Darshan, Draksharamam Day Trip",
      budgetRange: "₹2,50,000 - ₹3,50,000",
      currency: "INR",
      visitorName: "Venkat Ramanathan",
      visitorEmail: "venkat.nri@test.com",
      visitorPhone: "9198760005",
      countryOfResidence: "United States",
    });

    const res: any = await createRequest(req);
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.ok(body.referenceNumber.startsWith("NRI-2027-"));
    assert.ok(body.assignedProvidersCount >= 2);

    testRequestId = body.request.id;
    testRefNumber = body.referenceNumber;

    // Verify in database
    const saved = await prisma.nriPackageRequest.findUnique({
      where: { id: testRequestId },
      include: { assignments: true },
    });
    assert.ok(saved);
    assert.strictEqual(saved.groupSize, 4);
    assert.strictEqual(saved.numAdults, 3);
    assert.strictEqual(saved.numChildren, 1);
    assert.strictEqual(saved.status, "ASSIGNED");
    assert.ok(saved.assignments.some((a) => a.providerId === providerUser1.id));
    assert.ok(saved.assignments.some((a) => a.providerId === providerUser2.id));
  });

  // 3. Provider Permission Scoping
  it("prevents unassigned business owner from viewing the request", async () => {
    const req = createReq("GET", `/api/v1/nri/requests/${testRequestId}`, unassignedSession.token);
    const res: any = await getRequestById(req, { params: Promise.resolve({ id: testRequestId }) });
    assert.strictEqual(res.status, 403);
  });

  it("permits assigned business owner to view request requirements and updates status to IN_PROGRESS", async () => {
    const req = createReq("GET", `/api/v1/nri/requests/${testRequestId}`, providerSession1.token);
    const res: any = await getRequestById(req, { params: Promise.resolve({ id: testRequestId }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.request.referenceNumber, testRefNumber);

    // Verify assignment marked as viewed / in_progress
    const assign = await prisma.nriRequestAssignment.findFirst({
      where: { requestId: testRequestId, providerId: providerUser1.id },
    });
    assert.ok(assign?.viewedAt);
  });

  // 4. Quotation Creation & Server-side Pricing Validation
  it("allows assigned business owner to prepare and send an all-inclusive quotation", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${testRequestId}/quotations`, providerSession1.token, {
      title: "5-Day Sacred Godavari Pushkaralu VIP Package",
      description: "Complete itinerary covering VIP Pushkara Snanam, private AC Innova, and luxury stay",
      durationDays: 5,
      checkInDate: "2027-07-15",
      checkOutDate: "2027-07-20",
      itinerary: [
        { day: 1, title: "Arrival & Pushkar Ghat Evening Harathi", description: "VIP pickup & harathi", ghatVisits: "Pushkar Ghat" },
        { day: 2, title: "Sacred Snanam & Kotilingeshwara Darshan", description: "Holy bath with priest", ghatVisits: "Kotilingala Ghat" },
      ],
      hotelName: "River Bay Resort",
      roomType: "2 Deluxe River View Rooms",
      numberOfRooms: 2,
      vehicleType: "Toyota Innova Crysta AC (7 Seater)",
      vehicleCapacity: 7,
      mealPlan: "All Breakfasts & Satvik Dinners Included",
      guideServices: "Dedicated English & Telugu Spiritual Guide",
      inclusions: ["AC vehicle", "2 Deluxe Rooms", "All Breakfasts & Dinners", "VIP Ghat Passes"],
      exclusions: ["Flight airfare", "Personal temple donations"],
      accommodationCost: 100000,
      transportCost: 45000,
      foodCost: 25000,
      guideCost: 15000,
      otherCharges: 5000,
      taxAmount: 9500,
      discountAmount: 4500,
      pricingNotes: "All inclusive of fuel, driver, tolls, and GST.",
      status: "SENT",
    });

    const res: any = await createQuotation(req, { params: Promise.resolve({ id: testRequestId }) });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.ok(body.quotation.quotationNumber.startsWith("QTE-2027-"));
    // Subtotal: 100000 + 45000 + 25000 + 15000 + 5000 = 190000 + 9500 - 4500 = 195000
    assert.strictEqual(body.quotation.totalPrice, 195000);
    // Price per person: 195000 / 4 = 48750
    assert.strictEqual(body.quotation.pricePerPerson, 48750);
    assert.strictEqual(body.quotation.version, 1);

    testQuotationId1 = body.quotation.id;

    // Check version snapshot
    const version1 = await prisma.nriQuotationVersion.findFirst({
      where: { quotationId: testQuotationId1, version: 1 },
    });
    assert.ok(version1);
  });

  // 5. Competing Provider Quotation
  it("allows second assigned business owner to submit competing quotation for same request", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${testRequestId}/quotations`, providerSession2.token, {
      title: "5-Day Heritage Resort & Private Excursions Package",
      description: "Heritage Godavari Riverside stay with dedicated tempo and priest",
      durationDays: 5,
      checkInDate: "2027-07-15",
      checkOutDate: "2027-07-20",
      itinerary: [
        { day: 1, title: "Arrival & Welcome", description: "Airport reception" },
      ],
      hotelName: "Godavari River Heritage Resort",
      roomType: "2 Heritage Villas",
      numberOfRooms: 2,
      vehicleType: "Force Urbania Luxury (10 Seater)",
      vehicleCapacity: 10,
      mealPlan: "Daily Breakfast & Satvik Meals",
      inclusions: ["Heritage Villa stay", "AC Transit", "All Meals"],
      exclusions: ["Flights"],
      accommodationCost: 120000,
      transportCost: 40000,
      foodCost: 30000,
      guideCost: 10000,
      otherCharges: 0,
      taxAmount: 10000,
      discountAmount: 0,
      status: "SENT",
    });

    const res: any = await createQuotation(req, { params: Promise.resolve({ id: testRequestId }) });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    testQuotationId2 = body.quotation.id;
    assert.strictEqual(body.quotation.totalPrice, 210000);
  });

  // 6. Quotation Revision & Versioning
  it("creates version 2 when business owner revises sent quotation", async () => {
    const req = createReq("PATCH", `/api/v1/nri/quotations/${testQuotationId1}`, providerSession1.token, {
      action: "REVISE",
      status: "SENT",
      discountAmount: 9500, // Extra ₹5000 discount
      changeSummary: "Added special discount of ₹5,000 upon visitor request",
    });

    const res: any = await updateQuotation(req, { params: Promise.resolve({ id: testQuotationId1 }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.quotation.version, 2);
    // 190000 + 9500 - 9500 = 190000
    assert.strictEqual(body.quotation.totalPrice, 190000);

    // Verify both versions exist in database
    const versions = await prisma.nriQuotationVersion.findMany({
      where: { quotationId: testQuotationId1 },
      orderBy: { version: "asc" },
    });
    assert.strictEqual(versions.length, 2);
    assert.strictEqual(versions[0].version, 1);
    assert.strictEqual(versions[1].version, 2);
  });

  // 7. Conversation Thread & Questions
  it("allows visitor to ask questions and request revisions in request conversation thread", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${testRequestId}/messages`, visitorSession.token, {
      message: "Can we ensure wheelchair assistance is provided right at the aircraft exit gate?",
      requestRevision: true,
    });

    const res: any = await postMessage(req, { params: Promise.resolve({ id: testRequestId }) });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.message.senderRole, "VISITOR");

    // Provider replies
    const replyReq = createReq("POST", `/api/v1/nri/requests/${testRequestId}/messages`, providerSession1.token, {
      message: "Yes Mr. Venkat, airport ramp coordinator and wheelchair escort are 100% arranged.",
    });
    const replyRes: any = await postMessage(replyReq, { params: Promise.resolve({ id: testRequestId }) });
    assert.strictEqual(replyRes.status, 201);

    // Check messages list
    const listReq = createReq("GET", `/api/v1/nri/requests/${testRequestId}/messages`, visitorSession.token);
    const listRes: any = await getMessages(listReq, { params: Promise.resolve({ id: testRequestId }) });
    const listBody = await listRes.json();
    assert.strictEqual(listBody.messages.length, 2);
  });

  // 8. Visitor Quotation Acceptance
  it("moves request to AWAITING_FINAL_CONFIRMATION when visitor accepts quotation and closes competing quotes", async () => {
    const req = createReq("POST", `/api/v1/nri/quotations/${testQuotationId1}/accept`, visitorSession.token, {
      referenceNumber: testRefNumber,
      visitorEmail: "venkat.nri@test.com",
    });

    const res: any = await acceptQuotation(req, { params: Promise.resolve({ id: testQuotationId1 }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.requestStatus, "AWAITING_FINAL_CONFIRMATION");
    assert.strictEqual(body.quotation.status, "ACCEPTED");

    // Verify competing quotation 2 was CLOSED
    const quote2 = await prisma.nriQuotation.findUnique({ where: { id: testQuotationId2 } });
    assert.strictEqual(quote2?.status, "CLOSED");

    // Verify request status in database
    const reqDb = await prisma.nriPackageRequest.findUnique({ where: { id: testRequestId } });
    assert.strictEqual(reqDb?.status, "AWAITING_FINAL_CONFIRMATION");
    assert.strictEqual(reqDb?.confirmedQuotationId, testQuotationId1);
  });

  // 9. Provider Final Service Verification & Confirmation
  it("moves status to CONFIRMED when business owner verifies room allocation and transit details", async () => {
    const req = createReq("POST", `/api/v1/nri/quotations/${testQuotationId1}/confirm`, providerSession1.token, {
      hotelConfirmationDetails: "River Bay Resort Voucher #RB-2027-994, 2 Deluxe Rooms",
      vehicleDetails: "Innova Crysta AP 05 QW 9988, Chauffeur: Satyanarayana (+91 98480 99887)",
      confirmationNotes: "VIP Snanam token registered. Purohit Sri Sharma confirmed.",
    });

    const res: any = await confirmQuotation(req, { params: Promise.resolve({ id: testQuotationId1 }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.request.status, "CONFIRMED");
    assert.strictEqual(body.quotation.status, "CONFIRMED");

    // Check database
    const finalReq = await prisma.nriPackageRequest.findUnique({ where: { id: testRequestId } });
    assert.strictEqual(finalReq?.status, "CONFIRMED");
    assert.ok(finalReq?.confirmedAt);
    assert.ok(finalReq?.confirmationNotes?.includes("River Bay Resort Voucher"));
  });

  // 10. Status History & Audit Log Integrity
  it("records chronological status history transitions and audit records", async () => {
    const history = await prisma.nriStatusHistory.findMany({
      where: { requestId: testRequestId },
      orderBy: { createdAt: "asc" },
    });

    assert.ok(history.length >= 3);
    const statuses = history.map((h) => h.toStatus);
    assert.ok(statuses.includes("ASSIGNED") || statuses.includes("SUBMITTED"));
    assert.ok(statuses.includes("QUOTATION_SENT"));
    assert.ok(statuses.includes("AWAITING_FINAL_CONFIRMATION"));
    assert.ok(statuses.includes("CONFIRMED"));
  });

  // 11. Super Admin Reassignment
  it("allows Super Admin to assign or reassign request to providers", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${testRequestId}/assign`, superAdminSession.token, {
      providerIds: [unassignedProvider.id],
      replaceExisting: false,
      reason: "Super Admin added backup provider",
    });

    const res: any = await assignProvider(req, { params: Promise.resolve({ id: testRequestId }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);

    const checkAssign = await prisma.nriRequestAssignment.findFirst({
      where: { requestId: testRequestId, providerId: unassignedProvider.id },
    });
    assert.ok(checkAssign);
  });
});
