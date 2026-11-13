import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import { hashPassword, createSession } from "../src/lib/auth";
import { POST as archiveRequest } from "../src/app/api/v1/nri/requests/[id]/archive/route";
import { POST as restoreRequest } from "../src/app/api/v1/nri/requests/[id]/restore/route";
import { DELETE as deleteRequest } from "../src/app/api/v1/nri/requests/[id]/route";
import { GET as getRequests } from "../src/app/api/v1/nri/requests/route";
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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Godavari One — NRI Request Archive & Deletion Management Suite", () => {
  let superAdminUser: any;
  let superAdminSession: any;

  let managerUser1: any;
  let managerSession1: any;

  let managerUser2: any;
  let managerSession2: any;

  let providerUser: any;
  let providerSession: any;

  let visitorUser: any;
  let visitorSession: any;

  let request1: any;
  let request2: any;
  let confirmedRequest: any;

  before(async () => {
    // Cleanup any existing test data
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "917777" } } } });
    await prisma.nriQuotationLineItem.deleteMany({ where: { quotation: { request: { visitorPhone: { startsWith: "917777" } } } } });
    await prisma.nriQuotationVersion.deleteMany({ where: { quotation: { request: { visitorPhone: { startsWith: "917777" } } } } });
    await prisma.nriQuotation.deleteMany({ where: { request: { visitorPhone: { startsWith: "917777" } } } });
    await prisma.nriRequestAssignment.deleteMany({ where: { request: { visitorPhone: { startsWith: "917777" } } } });
    await prisma.nriStatusHistory.deleteMany({ where: { request: { visitorPhone: { startsWith: "917777" } } } });
    await prisma.nriPackageRequest.deleteMany({ where: { visitorPhone: { startsWith: "917777" } } });
    await prisma.auditLog.deleteMany({ where: { actor: { phone: { startsWith: "917777" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "917777" } } });

    // 1. Create Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9177770001",
        name: "NRI Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminPass123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    // 2. Create NRI Service Manager 1
    managerUser1 = await prisma.user.create({
      data: {
        phone: "9177770002",
        name: "NRI Coordinator USA",
        role: "NRI_SERVICE_MANAGER",
        status: "ACTIVE",
        passwordHash: hashPassword("ManagerPass123!"),
      },
    });
    managerSession1 = await createSession(managerUser1.id, "PASSWORD");

    // 3. Create NRI Service Manager 2
    managerUser2 = await prisma.user.create({
      data: {
        phone: "9177770003",
        name: "NRI Coordinator UK",
        role: "NRI_SERVICE_MANAGER",
        status: "ACTIVE",
        passwordHash: hashPassword("ManagerPass123!"),
      },
    });
    managerSession2 = await createSession(managerUser2.id, "PASSWORD");

    // 4. Create Business Owner / Provider
    providerUser = await prisma.user.create({
      data: {
        phone: "9177770004",
        name: "Godavari Tours & Resorts",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("ProviderPass123!"),
      },
    });
    providerSession = await createSession(providerUser.id, "PASSWORD");

    // 5. Create Visitor
    visitorUser = await prisma.user.create({
      data: {
        phone: "9177770005",
        name: "NRI Pilgrim Family",
        email: "pilgrim7777@gmail.com",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPass123!"),
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD");

    // 6. Create Test Request 1 (assigned to Manager 1)
    request1 = await prisma.nriPackageRequest.create({
      data: {
        referenceNumber: "NRI-TEST-7771",
        visitorName: "Srikanth Rao",
        visitorEmail: "srikanth.rao777@gmail.com",
        visitorPhone: "9177771111",
        countryOfResidence: "United States",
        groupSize: 4,
        numAdults: 4,
        numChildren: 0,
        arrivalDate: "2027-07-15",
        departureDate: "2027-07-20",
        arrivalLocation: "Rajahmundry Airport",
        departureLocation: "Rajahmundry Airport",
        accommodationPreference: "Heritage Riverfront Resort",
        dietaryPreference: "Pure Satvik Vegetarian",
        status: "IN_PROGRESS",
        assignedManagerId: managerUser1.id,
      },
    });

    // 7. Create Test Request 2 (assigned to Manager 2)
    request2 = await prisma.nriPackageRequest.create({
      data: {
        referenceNumber: "NRI-TEST-7772",
        visitorName: "Madhav Sharma",
        visitorEmail: "madhav.sharma777@gmail.com",
        visitorPhone: "9177772222",
        countryOfResidence: "United Kingdom",
        groupSize: 6,
        numAdults: 4,
        numChildren: 2,
        arrivalDate: "2027-08-01",
        departureDate: "2027-08-07",
        arrivalLocation: "Vijayawada Airport",
        departureLocation: "Rajahmundry Railway Station",
        accommodationPreference: "5-Star AC Hotel Suites",
        dietaryPreference: "South Indian Traditional",
        status: "SUBMITTED",
        assignedManagerId: managerUser2.id,
      },
    });

    // 8. Create Confirmed Request (Protected against deletion and archival)
    confirmedRequest = await prisma.nriPackageRequest.create({
      data: {
        referenceNumber: "NRI-TEST-CONFIRMED",
        visitorName: "Venkat Raghavan",
        visitorEmail: "venkat.raghavan777@gmail.com",
        visitorPhone: "9177773333",
        countryOfResidence: "Singapore",
        groupSize: 2,
        numAdults: 2,
        numChildren: 0,
        arrivalDate: "2027-07-10",
        departureDate: "2027-07-14",
        arrivalLocation: "Rajahmundry",
        departureLocation: "Rajahmundry",
        accommodationPreference: "Riverside Resort",
        dietaryPreference: "Satvik",
        status: "CONFIRMED",
        confirmedQuotationId: "QTE-2027-CONFIRMED",
        assignedManagerId: managerUser1.id,
        statusHistory: {
          create: {
            fromStatus: "AWAITING_FINAL_CONFIRMATION",
            toStatus: "CONFIRMED",
            changedById: superAdminUser.id,
            changedByName: "Super Admin",
            reason: "Package verified and confirmed",
          },
        },
      },
    });
  });

  after(async () => {
    // Cleanup synthetic test records
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "917777" } } } });
    await prisma.nriQuotationLineItem.deleteMany({ where: { quotation: { request: { visitorPhone: { startsWith: "917777" } } } } });
    await prisma.nriQuotationVersion.deleteMany({ where: { quotation: { request: { visitorPhone: { startsWith: "917777" } } } } });
    await prisma.nriQuotation.deleteMany({ where: { request: { visitorPhone: { startsWith: "917777" } } } });
    await prisma.nriRequestAssignment.deleteMany({ where: { request: { visitorPhone: { startsWith: "917777" } } } });
    await prisma.nriStatusHistory.deleteMany({ where: { request: { visitorPhone: { startsWith: "917777" } } } });
    await prisma.nriPackageRequest.deleteMany({ where: { visitorPhone: { startsWith: "917777" } } });
    await prisma.auditLog.deleteMany({ where: { actor: { phone: { startsWith: "917777" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "917777" } } });
    await prisma.$disconnect();
  });

  // --- SECTION 1: Authentication & Authorization Safeguards ---

  it("1. Rejects unauthenticated archive request with HTTP 401", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request1.id}/archive`, undefined, {
      reason: "Postponed",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 401);
  });

  it("2. Rejects unauthorized visitor role from archiving request with HTTP 403", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request1.id}/archive`, visitorSession.token, {
      reason: "Visitor cannot archive",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 403);
  });

  it("3. Rejects business owner / provider role from archiving request with HTTP 403", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request1.id}/archive`, providerSession.token, {
      reason: "Provider cannot archive",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 403);
  });

  // --- SECTION 2: Archiving Safeguards & Business Integrity ---

  it("4. Archive requires mandatory reason (HTTP 422 if empty or too short)", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request1.id}/archive`, superAdminSession.token, {
      reason: "no",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 422);
    const json = await res.json();
    assert.ok(json.error.includes("minimum 3 characters"));
  });

  it("5. Confirmed package protection: Cannot archive an active CONFIRMED request (HTTP 400)", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${confirmedRequest.id}/archive`, superAdminSession.token, {
      reason: "Attempt to archive confirmed package",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: confirmedRequest.id }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("confirmed packages and confirmed quotations cannot be archived"));
  });

  it("6. NRI Service Manager CANNOT archive another manager's request (HTTP 403)", async () => {
    // request2 is assigned to managerUser2, NOT managerUser1
    const req = createReq("POST", `/api/v1/nri/requests/${request2.id}/archive`, managerSession1.token, {
      reason: "Unauthorized manager archive attempt",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request2.id }) });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.ok(json.error.includes("only archive NRI requests assigned to you"));
  });

  it("7. NRI Service Manager can archive a request assigned to them (HTTP 200)", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request1.id}/archive`, managerSession1.token, {
      reason: "Client postponed Pushkaralu travel to winter 2027",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.request.status, "ARCHIVED");

    // Verify database state
    const dbReq = await prisma.nriPackageRequest.findUnique({ where: { id: request1.id } });
    assert.equal(dbReq?.status, "ARCHIVED");

    // Verify status history
    const history = await prisma.nriStatusHistory.findFirst({
      where: { requestId: request1.id, toStatus: "ARCHIVED" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(history);
    assert.equal(history.fromStatus, "IN_PROGRESS");
    assert.equal(history.changedById, managerUser1.id);
    assert.equal(history.reason, "Client postponed Pushkaralu travel to winter 2027");
  });

  it("8. Cannot archive an already archived request (HTTP 400)", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request1.id}/archive`, superAdminSession.token, {
      reason: "Duplicate archive attempt",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("already archived"));
  });

  it("9. Super Admin can archive any unconfirmed request (HTTP 200)", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request2.id}/archive`, superAdminSession.token, {
      reason: "Administrative cleanup of duplicate submission",
    });
    const res = await archiveRequest(req, { params: Promise.resolve({ id: request2.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.request.status, "ARCHIVED");
  });

  // --- SECTION 3: Restoration Workflow & State Preservation ---

  it("10. Restore requires request to be in ARCHIVED status (HTTP 400 if active)", async () => {
    // confirmedRequest is in CONFIRMED status
    const req = createReq("POST", `/api/v1/nri/requests/${confirmedRequest.id}/restore`, superAdminSession.token, {
      reason: "Attempt to restore active request",
    });
    const res = await restoreRequest(req, { params: Promise.resolve({ id: confirmedRequest.id }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("Request is not archived"));
  });

  it("11. NRI Service Manager CANNOT restore another manager's request (HTTP 403)", async () => {
    // request2 is assigned to managerUser2, NOT managerUser1
    const req = createReq("POST", `/api/v1/nri/requests/${request2.id}/restore`, managerSession1.token, {
      reason: "Unauthorized manager restore attempt",
    });
    const res = await restoreRequest(req, { params: Promise.resolve({ id: request2.id }) });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.ok(json.error.includes("within your permitted scope"));
  });

  it("12. NRI Service Manager can restore their assigned archived request back to previous status (HTTP 200)", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request1.id}/restore`, managerSession1.token, {
      reason: "Client resumed pilgrimage planning",
    });
    const res = await restoreRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.restoredStatus, "IN_PROGRESS");
    assert.equal(json.request.status, "IN_PROGRESS");

    // Verify database state
    const dbReq = await prisma.nriPackageRequest.findUnique({ where: { id: request1.id } });
    assert.equal(dbReq?.status, "IN_PROGRESS");
  });

  it("13. Super Admin can restore any archived request back to previous status (HTTP 200)", async () => {
    const req = createReq("POST", `/api/v1/nri/requests/${request2.id}/restore`, superAdminSession.token, {
      reason: "Super Admin reactivated inquiry",
    });
    const res = await restoreRequest(req, { params: Promise.resolve({ id: request2.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.restoredStatus, "SUBMITTED");
  });

  // --- SECTION 4: Permanent Deletion Safeguards & Legal Compliance ---

  it("14. Permanent deletion is strictly forbidden for NRI Service Manager (HTTP 403)", async () => {
    const req = createReq("DELETE", `/api/v1/nri/requests/${request1.id}`, managerSession1.token, {
      reason: "Manager attempting permanent deletion",
      confirmReference: request1.referenceNumber,
    });
    const res = await deleteRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.ok(json.error.includes("restricted to Super Admin only"));
  });

  it("15. Active non-archived request CANNOT be permanently deleted (HTTP 400)", async () => {
    // request1 is currently active (IN_PROGRESS)
    const req = createReq("DELETE", `/api/v1/nri/requests/${request1.id}`, superAdminSession.token, {
      reason: "Deletion attempt without prior archival",
      confirmReference: request1.referenceNumber,
    });
    const res = await deleteRequest(req, { params: Promise.resolve({ id: request1.id }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("Only archived requests can be permanently deleted"));
  });

  it("16. Permanent deletion requires explicit reference confirmation matching referenceNumber (HTTP 422)", async () => {
    // Archive request2 first
    await prisma.nriPackageRequest.update({ where: { id: request2.id }, data: { status: "ARCHIVED" } });

    const req = createReq("DELETE", `/api/v1/nri/requests/${request2.id}`, superAdminSession.token, {
      reason: "Valid compliance deletion reason",
      confirmReference: "WRONG-REFERENCE-NUMBER",
    });
    const res = await deleteRequest(req, { params: Promise.resolve({ id: request2.id }) });
    assert.equal(res.status, 422);
    const json = await res.json();
    assert.ok(json.error.includes("Explicit confirmation failed"));
  });

  it("17. Permanent deletion requires mandatory detailed reason (minimum 10 chars) (HTTP 422)", async () => {
    const req = createReq("DELETE", `/api/v1/nri/requests/${request2.id}`, superAdminSession.token, {
      reason: "short",
      confirmReference: request2.referenceNumber,
    });
    const res = await deleteRequest(req, { params: Promise.resolve({ id: request2.id }) });
    assert.equal(res.status, 422);
    const json = await res.json();
    assert.ok(json.error.includes("minimum 10 characters"));
  });

  it("18. Confirmed packages CANNOT be permanently deleted under any circumstances (HTTP 400)", async () => {
    // Put confirmedRequest in ARCHIVED directly in DB to test retention gate
    await prisma.nriPackageRequest.update({ where: { id: confirmedRequest.id }, data: { status: "ARCHIVED" } });

    const req = createReq("DELETE", `/api/v1/nri/requests/${confirmedRequest.id}`, superAdminSession.token, {
      reason: "Attempting to delete confirmed package",
      confirmReference: confirmedRequest.referenceNumber,
    });
    const res = await deleteRequest(req, { params: Promise.resolve({ id: confirmedRequest.id }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("confirmed packages or accepted quotations"));
  });

  it("19. Super Admin can permanently delete an archived unconfirmed request and creates pre-deletion audit trail", async () => {
    const req = createReq("DELETE", `/api/v1/nri/requests/${request2.id}`, superAdminSession.token, {
      reason: "Formal GDPR Right to Erasure request from visitor Madhav Sharma",
      confirmReference: request2.referenceNumber,
    });
    const res = await deleteRequest(req, { params: Promise.resolve({ id: request2.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.deletedReference, request2.referenceNumber);

    // Verify permanently purged from database
    const dbReq = await prisma.nriPackageRequest.findUnique({ where: { id: request2.id } });
    assert.equal(dbReq, null);

    // Verify audit log exists
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        targetType: "NRI_PACKAGE_REQUEST",
        targetId: request2.id,
        action: "NRI_REQUEST_PERMANENT_DELETE",
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(auditEntry);
    assert.equal(auditEntry.actorId, superAdminUser.id);
  });

  // --- SECTION 5: List Filtering & Role Segregation ---

  it("20. GET /api/v1/nri/requests returns active requests by default (excludes archived)", async () => {
    // Archive request1
    await prisma.nriPackageRequest.update({ where: { id: request1.id }, data: { status: "ARCHIVED" } });

    const req = createReq("GET", "/api/v1/nri/requests", superAdminSession.token);
    const res = await getRequests(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    const foundArchived = json.items.find((i: any) => i.id === request1.id);
    assert.equal(foundArchived, undefined, "Archived request must not appear in default active list");
  });

  it("21. GET /api/v1/nri/requests?archived=true returns archived requests with archive metadata", async () => {
    const req = createReq("GET", "/api/v1/nri/requests?archived=true", superAdminSession.token);
    const res = await getRequests(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    const foundArchived = json.items.find((i: any) => i.id === request1.id);
    assert.ok(foundArchived, "Archived request must appear in archived list");
    assert.equal(foundArchived.status, "ARCHIVED");
    assert.ok(Array.isArray(foundArchived.statusHistory));
  });

  it("22. Business Owner query never receives archived requests", async () => {
    const req = createReq("GET", "/api/v1/nri/requests?archived=true", providerSession.token);
    const res = await getRequests(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.items.length, 0, "Business owner must never see archived requests");
  });
});
