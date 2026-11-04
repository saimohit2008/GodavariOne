import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { NextRequest } from "next/server";

// Configure isolated test database
const testDbPath = path.resolve(__dirname, "../db/test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession } from "@/lib/auth";
import { savePrivateDocument, readPrivateDocument } from "@/lib/private-storage";
import { calculateAgeOnDate, generateApplicationNumber } from "@/lib/priority-booking";
import { generateQrPassToken, generateQrSvg } from "@/lib/qr";
import { translations } from "@/lib/i18n";

import { POST as submitPriorityBooking, GET as listPriorityBookings } from "@/app/api/v1/priority-bookings/route";
import { GET as getPriorityBooking, PATCH as updatePriorityBooking } from "@/app/api/v1/priority-bookings/[id]/route";
import { GET as getDocument, POST as uploadReplacementDoc } from "@/app/api/v1/priority-bookings/[id]/document/route";
import { POST as assignTimeSlot } from "@/app/api/v1/priority-bookings/[id]/slot/route";
import { POST as verifyQrCheckIn } from "@/app/api/v1/priority-bookings/verify-qr/route";
import { GET as getGhatSlots, POST as createGhatSlot } from "@/app/api/v1/ghats/[id]/slots/route";
import { PATCH as updateGhatSlot } from "@/app/api/v1/ghats/[id]/slots/[slotId]/route";
import { POST as assignUserRole } from "@/app/api/v1/admin/users/[id]/assign/route";

describe("GODAVARI ONE — COMPLETE PRIORITY GHAT BOOKING SYSTEM (TESTS A - O)", () => {
  let superAdminUser: any;
  let superAdminSession: any;

  let supervisorGhat1: any;
  let supervisor1Session: any;

  let supervisorGhat2: any;
  let supervisor2Session: any;

  let visitorUser1: any;
  let visitor1Session: any;

  let visitorUser2: any;
  let visitor2Session: any;

  let testGhat1: any;
  let testGhat2: any;

  // Synthetic valid PDF buffer for testing
  const syntheticPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

  function makeAuthHeaders(token: string, contentType?: string): Headers {
    const headers = new Headers();
    headers.set("cookie", `godavari_session=${token}`);
    if (contentType) {
      headers.set("content-type", contentType);
    }
    return headers;
  }

  before(async () => {
    // Clean up any test fixtures from previous runs
    await prisma.priorityBookingHistory.deleteMany();
    await prisma.priorityGhatBooking.deleteMany();
    await prisma.ghatTimeSlot.deleteMany();
    await prisma.assignment.deleteMany({ where: { user: { phone: { startsWith: "920000" } } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "920000" } } } });
    await prisma.auditLog.deleteMany({ where: { actor: { phone: { startsWith: "920000" } } } });
    await prisma.listing.deleteMany({ where: { name: { contains: "Priority Test Ghat" } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "920000" } } });

    // 1. Create synthetic users
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9200000001",
        name: "Synthetic Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("Admin123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    supervisorGhat1 = await prisma.user.create({
      data: {
        phone: "9200000002",
        name: "Supervisor Kotilingala",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Super123!"),
      },
    });
    supervisor1Session = await createSession(supervisorGhat1.id, "PASSWORD");

    supervisorGhat2 = await prisma.user.create({
      data: {
        phone: "9200000003",
        name: "Supervisor Saraswati",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Super123!"),
      },
    });
    supervisor2Session = await createSession(supervisorGhat2.id, "PASSWORD");

    visitorUser1 = await prisma.user.create({
      data: {
        phone: "9200000004",
        name: "Pilgrim Applicant One",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitor1Session = await createSession(visitorUser1.id, "PASSWORD");

    visitorUser2 = await prisma.user.create({
      data: {
        phone: "9200000005",
        name: "Pilgrim Applicant Two",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitor2Session = await createSession(visitorUser2.id, "PASSWORD");

    // 2. Create test ghats
    testGhat1 = await prisma.listing.create({
      data: {
        name: "Kotilingala Priority Test Ghat",
        category: "GHAT",
        description: "Official sacred bathing ghat with accessibility ramps",
        address: "Rajahmundry Riverbank",
        district: "East Godavari",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        ghatDetails: {
          create: {
            currentCrowdStatus: "FREE",
            supervisorId: supervisorGhat1.id,
          },
        },
      },
      include: { ghatDetails: true },
    });

    testGhat2 = await prisma.listing.create({
      data: {
        name: "Saraswati Priority Test Ghat",
        category: "GHAT",
        description: "Downstream sacred pushkar ghat",
        address: "Godavari South Bank",
        district: "East Godavari",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        ghatDetails: {
          create: {
            currentCrowdStatus: "MODERATE",
            supervisorId: supervisorGhat2.id,
          },
        },
      },
      include: { ghatDetails: true },
    });

    // 3. Assign supervisor 1 to ghat 1, and supervisor 2 to ghat 2
    await prisma.assignment.create({
      data: {
        userId: supervisorGhat1.id,
        type: "GHAT_SUPERVISOR",
        listingId: testGhat1.id,
      },
    });

    await prisma.assignment.create({
      data: {
        userId: supervisorGhat2.id,
        type: "GHAT_SUPERVISOR",
        listingId: testGhat2.id,
      },
    });
  });

  after(async () => {
    // Cleanup synthetic fixtures
    await prisma.priorityBookingHistory.deleteMany();
    await prisma.priorityGhatBooking.deleteMany();
    await prisma.ghatTimeSlot.deleteMany();
    await prisma.assignment.deleteMany({ where: { user: { phone: { startsWith: "920000" } } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "920000" } } } });
    await prisma.auditLog.deleteMany({ where: { actor: { phone: { startsWith: "920000" } } } });
    await prisma.listing.deleteMany({ where: { name: { contains: "Priority Test Ghat" } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "920000" } } });
  });

  // -------------------------------------------------------------------------
  // TEST A — Senior Citizen Application
  // -------------------------------------------------------------------------
  let seniorBookingId: string;
  let seniorAppNumber: string;

  it("TEST A — Senior Citizen Application: Beneficiary aged >= 65 creates SUBMITTED application", async () => {
    const formData = new FormData();
    formData.append("category", "SENIOR_CITIZEN");
    formData.append("ghatId", testGhat1.id);
    formData.append("beneficiaryName", "Subba Rao (Senior)");
    formData.append("beneficiaryDob", "1955-08-15"); // 72 years old in 2027
    formData.append("beneficiaryPhone", "9876543210");
    formData.append("visitDate", "2027-07-20");
    formData.append("accompanyingCount", "1");
    formData.append("accessibilityNeeds", "Wheelchair assistance");
    formData.append("applicantDeclaration", "true");
    formData.append("consentGiven", "true");

    const file = new File([syntheticPdfBuffer], "synthetic_senior_id.pdf", { type: "application/pdf" });
    formData.append("file", file);

    const req = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
      method: "POST",
      headers: makeAuthHeaders(visitor1Session.token),
      body: formData,
    });

    const res = await submitPriorityBooking(req);
    const body = await res.json();

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.equal(body.status, "SUBMITTED");
    assert.ok(body.bookingId);
    assert.ok(body.applicationNumber.startsWith("PGB-2027-"));

    seniorBookingId = body.bookingId;
    seniorAppNumber = body.applicationNumber;

    // Verify in DB
    const stored = await prisma.priorityGhatBooking.findUnique({
      where: { id: seniorBookingId },
    });
    assert.ok(stored);
    assert.equal(stored.category, "SENIOR_CITIZEN");
    assert.equal(stored.status, "SUBMITTED");
    assert.equal(stored.beneficiaryAge, 71); // on 2027-07-20
  });

  // Verify under-65 age rejection
  it("TEST A.2 — Rejects Senior Citizen submission if beneficiary is under 65 on visit date", async () => {
    const formData = new FormData();
    formData.append("category", "SENIOR_CITIZEN");
    formData.append("ghatId", testGhat1.id);
    formData.append("beneficiaryName", "Under Age Applicant");
    formData.append("beneficiaryDob", "1970-01-01"); // 57 years old in 2027
    formData.append("beneficiaryPhone", "9876543210");
    formData.append("visitDate", "2027-07-20");
    formData.append("applicantDeclaration", "true");
    formData.append("consentGiven", "true");

    const file = new File([syntheticPdfBuffer], "synthetic_id.pdf", { type: "application/pdf" });
    formData.append("file", file);

    const req = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
      method: "POST",
      headers: makeAuthHeaders(visitor1Session.token),
      body: formData,
    });

    const res = await submitPriorityBooking(req);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.ok(body.error.includes("65 years of age or older"));
  });

  // -------------------------------------------------------------------------
  // TEST B — Disability Application
  // -------------------------------------------------------------------------
  let disabilityBookingId: string;
  let disabilityAppNumber: string;

  it("TEST B — Disability Application: Submits accepted document, requires human verification", async () => {
    const formData = new FormData();
    formData.append("category", "PERSON_WITH_DISABILITY");
    formData.append("ghatId", testGhat1.id);
    formData.append("beneficiaryName", "Venkatesh (PwD)");
    formData.append("beneficiaryPhone", "9848012345");
    formData.append("visitDate", "2027-07-22");
    formData.append("accompanyingCount", "1");
    formData.append("accessibilityNeeds", "Ramp Access, Battery Vehicle");
    formData.append("isCaregiverApplication", "true");
    formData.append("applicantName", "Lakshmi (Caregiver)");
    formData.append("applicantPhone", "9848099999");
    formData.append("applicantRelationship", "Daughter");
    formData.append("applicantDeclaration", "true");
    formData.append("consentGiven", "true");

    const file = new File([syntheticPdfBuffer], "udid_disability_cert.pdf", { type: "application/pdf" });
    formData.append("file", file);

    const req = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
      method: "POST",
      headers: makeAuthHeaders(visitor1Session.token),
      body: formData,
    });

    const res = await submitPriorityBooking(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.status, "SUBMITTED");
    disabilityBookingId = body.bookingId;
    disabilityAppNumber = body.applicationNumber;

    const stored = await prisma.priorityGhatBooking.findUnique({
      where: { id: disabilityBookingId },
    });
    assert.ok(stored);
    assert.equal(stored.isCaregiverApplication, true);
    assert.equal(stored.applicantRelationship, "Daughter");
  });

  // -------------------------------------------------------------------------
  // TEST C — Supervisor Approval
  // -------------------------------------------------------------------------
  it("TEST C — Supervisor Approval: Assigned supervisor reviews and approves eligibility", async () => {
    // 1. Mark under review
    const reviewReq = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${seniorBookingId}`, {
      method: "PATCH",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ action: "START_REVIEW" }),
    });
    const reviewRes = await updatePriorityBooking(reviewReq, { params: Promise.resolve({ id: seniorBookingId }) });
    assert.equal(reviewRes.status, 200);

    // 2. Approve eligibility
    const approveReq = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${seniorBookingId}`, {
      method: "PATCH",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ action: "APPROVE", reviewerNotes: "Age verified against uploaded proof." }),
    });
    const approveRes = await updatePriorityBooking(approveReq, { params: Promise.resolve({ id: seniorBookingId }) });
    const approveBody = await approveRes.json();

    assert.equal(approveRes.status, 200);
    assert.equal(approveBody.status, "APPROVED");

    const inDb = await prisma.priorityGhatBooking.findUnique({ where: { id: seniorBookingId } });
    assert.equal(inDb?.status, "APPROVED");
    assert.equal(inDb?.reviewerId, supervisorGhat1.id);
  });

  // -------------------------------------------------------------------------
  // TEST D — Supervisor Slot Assignment
  // -------------------------------------------------------------------------
  let slotGhat1: any;
  let qrPassToken: string;

  it("TEST D — Supervisor Slot Assignment: Allocates available slot, produces SLOT_ASSIGNED and QR pass", async () => {
    // Create an active time slot on testGhat1
    const createSlotReq = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat1.id}/slots`, {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({
        slotDate: "2027-07-20",
        startTime: "06:00",
        endTime: "08:00",
        maxCapacity: 10,
        accessibilityNotes: "Wheelchair assistance available at ramp entry",
      }),
    });
    const slotRes = await createGhatSlot(createSlotReq, { params: Promise.resolve({ id: testGhat1.id }) });
    const slotBody = await slotRes.json();
    assert.equal(slotRes.status, 200);
    slotGhat1 = slotBody.slot;

    // Allocate slot to seniorBookingId
    const assignReq = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${seniorBookingId}/slot`, {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ timeSlotId: slotGhat1.id }),
    });
    const assignRes = await assignTimeSlot(assignReq, { params: Promise.resolve({ id: seniorBookingId }) });
    const assignBody = await assignRes.json();

    assert.equal(assignRes.status, 200, `Slot assignment failed: ${JSON.stringify(assignBody)}`);
    assert.equal(assignBody.status, "SLOT_ASSIGNED");
    assert.ok(assignBody.qrPassToken, "QR pass token must be generated");
    qrPassToken = assignBody.qrPassToken;

    const inDb = await prisma.priorityGhatBooking.findUnique({ where: { id: seniorBookingId } });
    assert.equal(inDb?.status, "SLOT_ASSIGNED");
    assert.equal(inDb?.timeSlotId, slotGhat1.id);

    // Verify slot capacity incremented (1 beneficiary + 1 accompanying = 2 seats)
    const updatedSlot = await prisma.ghatTimeSlot.findUnique({ where: { id: slotGhat1.id } });
    assert.equal(updatedSlot?.allocatedCount, 2);
  });

  // -------------------------------------------------------------------------
  // TEST E — Unauthorized Ghat Access
  // -------------------------------------------------------------------------
  it("TEST E — Unauthorized Ghat Access: Supervisor 2 CANNOT access or list applications for Ghat 1", async () => {
    // Supervisor 2 attempts to view application belonging to Ghat 1
    const req = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${seniorBookingId}`, {
      method: "GET",
      headers: makeAuthHeaders(supervisor2Session.token),
    });
    const res = await getPriorityBooking(req, { params: Promise.resolve({ id: seniorBookingId }) });
    assert.equal(res.status, 403, "Backend must deny supervisor access to unassigned ghat application");

    // Supervisor 2 attempts to filter by Ghat 1
    const listReq = new NextRequest(`http://localhost:3000/api/v1/priority-bookings?ghatId=${testGhat1.id}`, {
      method: "GET",
      headers: makeAuthHeaders(supervisor2Session.token),
    });
    const listRes = await listPriorityBookings(listReq);
    assert.equal(listRes.status, 403);
  });

  // -------------------------------------------------------------------------
  // TEST F — Unauthorized Approval
  // -------------------------------------------------------------------------
  it("TEST F — Unauthorized Approval: Ordinary visitor user CANNOT approve applications", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${disabilityBookingId}`, {
      method: "PATCH",
      headers: makeAuthHeaders(visitor1Session.token, "application/json"),
      body: JSON.stringify({ action: "APPROVE" }),
    });
    const res = await updatePriorityBooking(req, { params: Promise.resolve({ id: disabilityBookingId }) });
    assert.equal(res.status, 403, "Backend must reject approval attempt by ordinary user");

    const inDb = await prisma.priorityGhatBooking.findUnique({ where: { id: disabilityBookingId } });
    assert.equal(inDb?.status, "SUBMITTED", "Status must remain unchanged");
  });

  // -------------------------------------------------------------------------
  // TEST G — Insufficient Proof
  // -------------------------------------------------------------------------
  it("TEST G — Insufficient Proof: Reviewer requests additional proof -> ADDITIONAL_PROOF_REQUIRED", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${disabilityBookingId}`, {
      method: "PATCH",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({
        action: "REQUEST_ADDITIONAL_PROOF",
        additionalProofNotes: "Certificate image is unclear. Please upload an official UDID card with clear barcode.",
      }),
    });
    const res = await updatePriorityBooking(req, { params: Promise.resolve({ id: disabilityBookingId }) });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.status, "ADDITIONAL_PROOF_REQUIRED");

    // Verify user notification created
    const notif = await prisma.notification.findFirst({
      where: {
        userId: visitorUser1.id,
        type: "PRIORITY_BOOKING_ADDITIONAL_PROOF_REQUIRED",
      },
    });
    assert.ok(notif, "Applicant must receive notification regarding additional proof request");
  });

  // -------------------------------------------------------------------------
  // TEST H — Rejection
  // -------------------------------------------------------------------------
  it("TEST H — Rejection: Ineligible application is rejected with mandatory reason and cannot receive slots", async () => {
    // Create an ineligible test booking
    const testRejectBooking = await prisma.priorityGhatBooking.create({
      data: {
        applicationNumber: generateApplicationNumber(),
        ghatId: testGhat1.id,
        category: "SENIOR_CITIZEN",
        beneficiaryName: "Ineligible Applicant",
        beneficiaryPhone: "9000000000",
        visitDate: "2027-07-25",
        documentPath: "doc_test_reject.pdf",
        documentOriginalName: "id.pdf",
        documentMimeType: "application/pdf",
        documentSizeBytes: 1024,
        status: "UNDER_REVIEW",
      },
    });

    // Reject with reason
    const req = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${testRejectBooking.id}`, {
      method: "PATCH",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({
        action: "REJECT",
        rejectionReason: "ID proof details do not match the applicant identity.",
      }),
    });
    const res = await updatePriorityBooking(req, { params: Promise.resolve({ id: testRejectBooking.id }) });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, "REJECTED");

    // Attempting to assign a slot to REJECTED booking must fail
    const assignReq = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${testRejectBooking.id}/slot`, {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ timeSlotId: slotGhat1.id }),
    });
    const assignRes = await assignTimeSlot(assignReq, { params: Promise.resolve({ id: testRejectBooking.id }) });
    assert.equal(assignRes.status, 400, "Rejected applications cannot receive a confirmed slot");
  });

  // -------------------------------------------------------------------------
  // TEST I — Overbooking & Concurrency Safeguards
  // -------------------------------------------------------------------------
  it("TEST I — Overbooking Concurrency: Prevents slot allocation when capacity is full", async () => {
    // Create a time slot with maxCapacity = 2
    const tightSlot = await prisma.ghatTimeSlot.create({
      data: {
        ghatId: testGhat1.id,
        slotDate: "2027-07-28",
        startTime: "16:00",
        endTime: "18:00",
        maxCapacity: 2,
        allocatedCount: 0,
        status: "ACTIVE",
      },
    });

    // Create 2 approved bookings, each needing 2 seats (1 beneficiary + 1 accompanying)
    const bookingA = await prisma.priorityGhatBooking.create({
      data: {
        applicationNumber: generateApplicationNumber(),
        ghatId: testGhat1.id,
        category: "SENIOR_CITIZEN",
        beneficiaryName: "Beneficiary A",
        beneficiaryPhone: "9111111111",
        visitDate: "2027-07-28",
        accompanyingCount: 1, // 2 seats total
        documentPath: "doc_a.pdf",
        documentOriginalName: "a.pdf",
        documentMimeType: "application/pdf",
        documentSizeBytes: 1024,
        status: "APPROVED",
      },
    });

    const bookingB = await prisma.priorityGhatBooking.create({
      data: {
        applicationNumber: generateApplicationNumber(),
        ghatId: testGhat1.id,
        category: "SENIOR_CITIZEN",
        beneficiaryName: "Beneficiary B",
        beneficiaryPhone: "9222222222",
        visitDate: "2027-07-28",
        accompanyingCount: 1, // 2 seats total
        documentPath: "doc_b.pdf",
        documentOriginalName: "b.pdf",
        documentMimeType: "application/pdf",
        documentSizeBytes: 1024,
        status: "APPROVED",
      },
    });

    // 1st allocation takes all 2 seats
    const req1 = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${bookingA.id}/slot`, {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ timeSlotId: tightSlot.id }),
    });
    const res1 = await assignTimeSlot(req1, { params: Promise.resolve({ id: bookingA.id }) });
    assert.equal(res1.status, 200);

    // 2nd allocation attempts to allocate but slot is now full
    const req2 = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${bookingB.id}/slot`, {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ timeSlotId: tightSlot.id }),
    });
    const res2 = await assignTimeSlot(req2, { params: Promise.resolve({ id: bookingB.id }) });
    assert.equal(res2.status, 409, "Second allocation must be rejected due to capacity limit");

    // Verify allocatedCount did not exceed maxCapacity
    const checkSlot = await prisma.ghatTimeSlot.findUnique({ where: { id: tightSlot.id } });
    assert.equal(checkSlot?.allocatedCount, 2, "Allocated count must exactly equal maxCapacity (no overbooking)");
  });

  // -------------------------------------------------------------------------
  // TEST J — Duplicate QR Check-in
  // -------------------------------------------------------------------------
  it("TEST J — Duplicate QR Check-in: First check-in succeeds; second scan is rejected", async () => {
    // First scan: Valid entry check-in
    const scanReq1 = new NextRequest("http://localhost:3000/api/v1/priority-bookings/verify-qr", {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ token: qrPassToken }),
    });
    const scanRes1 = await verifyQrCheckIn(scanReq1);
    const scanBody1 = await scanRes1.json();

    assert.equal(scanRes1.status, 200, `First scan failed: ${JSON.stringify(scanBody1)}`);
    assert.equal(scanBody1.success, true);
    assert.equal(scanBody1.booking.beneficiaryName, "Subba Rao (Senior)");

    // Second scan: Duplicate scan rejection
    const scanReq2 = new NextRequest("http://localhost:3000/api/v1/priority-bookings/verify-qr", {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({ token: qrPassToken }),
    });
    const scanRes2 = await verifyQrCheckIn(scanReq2);
    const scanBody2 = await scanRes2.json();

    assert.equal(scanRes2.status, 409, "Duplicate scan must return 409 Conflict");
    assert.ok(scanBody2.error.includes("Duplicate entry attempt"));
  });

  // -------------------------------------------------------------------------
  // TEST K — Supervisor Permission Boundary
  // -------------------------------------------------------------------------
  it("TEST K — Supervisor Permission Boundary: Supervisor cannot elevate own role or modify assignments", async () => {
    // Supervisor attempts to assign themselves SUPER_ADMIN or assign new ghats via admin API
    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${supervisorGhat1.id}/assign`, {
      method: "POST",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({
        type: "GHAT_SUPERVISOR",
        listingId: testGhat2.id,
      }),
    });
    const res = await assignUserRole(req, { params: Promise.resolve({ id: supervisorGhat1.id }) });
    assert.equal(res.status, 403, "Supervisor cannot assign or modify resources");

    // Verify user role in DB remained GHAT_SUPERVISOR
    const userDb = await prisma.user.findUnique({ where: { id: supervisorGhat1.id } });
    assert.equal(userDb?.role, "GHAT_SUPERVISOR");
  });

  // -------------------------------------------------------------------------
  // TEST L — Super Admin Override
  // -------------------------------------------------------------------------
  it("TEST L — Super Admin Override: Super Admin overrides decision with mandatory recorded reason", async () => {
    // Create rejected booking to test administrative override
    const overrideTarget = await prisma.priorityGhatBooking.create({
      data: {
        applicationNumber: generateApplicationNumber(),
        ghatId: testGhat1.id,
        category: "PERSON_WITH_DISABILITY",
        beneficiaryName: "Special Case Beneficiary",
        beneficiaryPhone: "9333333333",
        visitDate: "2027-07-29",
        documentPath: "doc_special.pdf",
        documentOriginalName: "cert.pdf",
        documentMimeType: "application/pdf",
        documentSizeBytes: 2048,
        status: "REJECTED",
        rejectionReason: "Initial document unclear",
      },
    });

    const overrideReq = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${overrideTarget.id}`, {
      method: "PATCH",
      headers: makeAuthHeaders(superAdminSession.token, "application/json"),
      body: JSON.stringify({
        action: "SUPER_ADMIN_OVERRIDE",
        targetStatus: "APPROVED",
        overrideReason: "Manual verification conducted at district pushkaralu cell. Physical UDID card verified by medical officer.",
      }),
    });
    const overrideRes = await updatePriorityBooking(overrideReq, { params: Promise.resolve({ id: overrideTarget.id }) });
    const overrideBody = await overrideRes.json();

    assert.equal(overrideRes.status, 200);
    assert.equal(overrideBody.status, "APPROVED");

    // Verify audit log has the override recorded
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        targetId: overrideTarget.id,
        action: "PRIORITY_BOOKING_ADMIN_OVERRIDE",
      },
    });
    assert.ok(auditRecord, "Super Admin override must be recorded in AuditLog");
  });

  // -------------------------------------------------------------------------
  // TEST M — Privacy Protection
  // -------------------------------------------------------------------------
  it("TEST M — Privacy Protection: Unauthorized visitor CANNOT download or access another user's proof", async () => {
    // Visitor 2 attempts to download document of seniorBookingId (which was submitted by Visitor 1)
    const req = new NextRequest(`http://localhost:3000/api/v1/priority-bookings/${seniorBookingId}/document`, {
      method: "GET",
      headers: makeAuthHeaders(visitor2Session.token),
    });
    const res = await getDocument(req, { params: Promise.resolve({ id: seniorBookingId }) });

    assert.equal(res.status, 403, "Access to private document must be denied to unauthorized users");
  });

  // -------------------------------------------------------------------------
  // TEST N — Ghat / Slot Temporary Closure
  // -------------------------------------------------------------------------
  it("TEST N — Ghat Closure: Closing a slot identifies affected bookings and notifies applicants", async () => {
    // Create slot and allocate booking
    const closingSlot = await prisma.ghatTimeSlot.create({
      data: {
        ghatId: testGhat1.id,
        slotDate: "2027-07-30",
        startTime: "08:00",
        endTime: "10:00",
        maxCapacity: 10,
        allocatedCount: 1,
        status: "ACTIVE",
      },
    });

    const affectedBooking = await prisma.priorityGhatBooking.create({
      data: {
        applicationNumber: generateApplicationNumber(),
        ghatId: testGhat1.id,
        timeSlotId: closingSlot.id,
        userId: visitorUser1.id,
        category: "SENIOR_CITIZEN",
        beneficiaryName: "Flood Alert Senior",
        beneficiaryPhone: "9444444444",
        visitDate: "2027-07-30",
        documentPath: "doc_flood.pdf",
        documentOriginalName: "id.pdf",
        documentMimeType: "application/pdf",
        documentSizeBytes: 1024,
        status: "SLOT_ASSIGNED",
      },
    });

    // Supervisor closes slot due to high river flow
    const closeReq = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat1.id}/slots/${closingSlot.id}`, {
      method: "PATCH",
      headers: makeAuthHeaders(supervisor1Session.token, "application/json"),
      body: JSON.stringify({
        status: "CLOSED",
        closureReason: "Temporary river flow surge. Ghat bathing paused for safety.",
      }),
    });
    const closeRes = await updateGhatSlot(closeReq, {
      params: Promise.resolve({ id: testGhat1.id, slotId: closingSlot.id }),
    });
    const closeBody = await closeRes.json();

    assert.equal(closeRes.status, 200);
    assert.equal(closeBody.slot.status, "CLOSED");
    assert.equal(closeBody.affectedBookingsCount, 1);

    // Verify user received closure notification
    const closureNotif = await prisma.notification.findFirst({
      where: {
        userId: visitorUser1.id,
        type: "PRIORITY_BOOKING_SLOT_CLOSED",
      },
    });
    assert.ok(closureNotif, "Affected user must receive notification regarding slot closure");
  });

  // -------------------------------------------------------------------------
  // TEST O — Bilingual Translation and Accessibility Integrity
  // -------------------------------------------------------------------------
  it("TEST O — Bilingual Accessibility: Verifies key parity and Telugu script for all priority booking UI chrome", () => {
    const requiredKeys = [
      "priorityBooking",
      "priorityBookingTitle",
      "priorityBookingSubtitle",
      "seniorCitizen",
      "personWithDisability",
      "beneficiaryDetails",
      "beneficiaryName",
      "beneficiaryDob",
      "beneficiaryPhone",
      "visitDate",
      "selectedGhat",
      "accompanyingPersons",
      "accessibilityRequirements",
      "caregiverApplication",
      "supportingDocument",
      "applicantDeclaration",
      "consentProcessing",
      "submitApplication",
      "applicationNumber",
      "applicationStatus",
      "myPriorityBookings",
      "supervisorReviewManagement",
    ] as const;

    const teluguRegex = /[\u0C00-\u0C7F]/;

    for (const key of requiredKeys) {
      const enVal = (translations.en as any)[key];
      const teVal = (translations.te as any)[key];

      assert.ok(enVal, `English key '${key}' missing`);
      assert.ok(teVal, `Telugu key '${key}' missing`);
      assert.ok(teluguRegex.test(teVal), `Telugu translation for '${key}' must contain valid Telugu script: "${teVal}"`);
    }
  });
});
