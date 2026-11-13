import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import { hashPassword, createSession } from "../src/lib/auth";
import { PATCH as updateReportStatus } from "../src/app/api/v1/ghats/reports/[id]/route";
import { GET as getReports, POST as createReport } from "../src/app/api/v1/ghats/reports/route";
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

describe("Godavari One — Ghat Monitoring: Acknowledge & Resolve Actions Suite", () => {
  let superAdminUser: any;
  let superAdminSession: any;

  let supervisorUser1: any;
  let supervisorSession1: any;

  let supervisorUser2: any;
  let supervisorSession2: any;

  let visitorUser: any;
  let visitorSession: any;

  let providerUser: any;
  let providerSession: any;

  let testGhat1: any;
  let testGhat2: any;

  let testReport1: any;
  let testReport2: any;

  before(async () => {
    // Clean up test data
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "918888" } } } });
    await prisma.assignment.deleteMany({ where: { user: { phone: { startsWith: "918888" } } } });
    await prisma.auditLog.deleteMany({ where: { actor: { phone: { startsWith: "918888" } } } });
    await prisma.ghatReport.deleteMany({ where: { reporter: { phone: { startsWith: "918888" } } } });
    await prisma.listing.deleteMany({ where: { name: { contains: "Ghat Monitoring Test Ghat" } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "918888" } } });

    // 1. Create Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9188880001",
        name: "Ghat Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminPass123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    // 2. Create Ghat Supervisor 1
    supervisorUser1 = await prisma.user.create({
      data: {
        phone: "9188880002",
        name: "Ghat Supervisor North",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    supervisorSession1 = await createSession(supervisorUser1.id, "PASSWORD");

    // 3. Create Ghat Supervisor 2
    supervisorUser2 = await prisma.user.create({
      data: {
        phone: "9188880003",
        name: "Ghat Supervisor South",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    supervisorSession2 = await createSession(supervisorUser2.id, "PASSWORD");

    // 4. Create Visitor
    visitorUser = await prisma.user.create({
      data: {
        phone: "9188880004",
        name: "Pilgrim Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPass123!"),
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD");

    // 5. Create Business Owner
    providerUser = await prisma.user.create({
      data: {
        phone: "9188880005",
        name: "Local Boat Provider",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("ProviderPass123!"),
      },
    });
    providerSession = await createSession(providerUser.id, "PASSWORD");

    // 6. Create Test Ghats
    testGhat1 = await prisma.listing.create({
      data: {
        name: "Ghat Monitoring Test Ghat 1",
        description: "Test ghat 1 description",
        category: "GHAT",
        publicationStatus: "PUBLISHED",
        town: "Rajahmundry",
        district: "East Godavari",
        address: "VIP Pushkar Ghat Road",
        phone: "9188880001",
        ghatDetails: {
          create: {
            currentCrowdStatus: "MODERATE",
            statusUpdatedAt: new Date(),
          },
        },
      },
    });

    testGhat2 = await prisma.listing.create({
      data: {
        name: "Ghat Monitoring Test Ghat 2",
        description: "Test ghat 2 description",
        category: "GHAT",
        publicationStatus: "PUBLISHED",
        town: "Rajahmundry",
        district: "East Godavari",
        address: "Kotilingala Ghat Road",
        phone: "9188880001",
        ghatDetails: {
          create: {
            currentCrowdStatus: "FREE",
            statusUpdatedAt: new Date(),
          },
        },
      },
    });

    // Assign supervisor 1 to testGhat1 only
    await prisma.assignment.create({
      data: {
        userId: supervisorUser1.id,
        listingId: testGhat1.id,
        type: "GHAT_SUPERVISOR",
      },
    });

    // Assign supervisor 2 to testGhat2 only
    await prisma.assignment.create({
      data: {
        userId: supervisorUser2.id,
        listingId: testGhat2.id,
        type: "GHAT_SUPERVISOR",
      },
    });

    // Create Initial Test Reports
    testReport1 = await prisma.ghatReport.create({
      data: {
        listingId: testGhat1.id,
        reporterId: supervisorUser1.id,
        crowdStatus: "CROWDED",
        notes: "Heavy pilgrim arrival near north steps",
        reviewStatus: "SUBMITTED",
      },
    });

    testReport2 = await prisma.ghatReport.create({
      data: {
        listingId: testGhat2.id,
        reporterId: supervisorUser2.id,
        crowdStatus: "OVERCROWDED",
        notes: "Medical volunteer requested at bathing area",
        incidentType: "MEDICAL_ASSISTANCE",
        reviewStatus: "SUBMITTED",
      },
    });
  });

  after(async () => {
    // Cleanup synthetic test records
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "918888" } } } });
    await prisma.assignment.deleteMany({ where: { user: { phone: { startsWith: "918888" } } } });
    await prisma.auditLog.deleteMany({ where: { actor: { phone: { startsWith: "918888" } } } });
    await prisma.ghatReport.deleteMany({ where: { reporter: { phone: { startsWith: "918888" } } } });
    await prisma.listing.deleteMany({ where: { name: { contains: "Ghat Monitoring Test Ghat" } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "918888" } } });
    await prisma.$disconnect();
  });

  // --- SECTION 1: Authentication & Authorization Safeguards ---

  it("1. Rejects unauthenticated PATCH request with HTTP 401", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, undefined, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.error, "Authentication required");
  });

  it("2. Rejects unauthorized visitor role with HTTP 403", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, visitorSession.token, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.ok(json.error.includes("Insufficient permissions"));
  });

  it("3. Rejects unauthorized provider (BUSINESS_OWNER) role with HTTP 403", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, providerSession.token, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 403);
  });

  // --- SECTION 2: Acknowledge Action & Status Compatibility ---

  it("4. Super Admin can Acknowledge report using frontend payload { status: 'ACKNOWLEDGED' } (fixes validation failure)", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, superAdminSession.token, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.reviewStatus, "ACKNOWLEDGED");
    assert.equal(json.acknowledgedById, superAdminUser.id);
    assert.ok(json.acknowledgedAt);

    // Verify database state
    const dbReport = await prisma.ghatReport.findUnique({ where: { id: testReport1.id } });
    assert.equal(dbReport?.reviewStatus, "ACKNOWLEDGED");
    assert.equal(dbReport?.acknowledgedById, superAdminUser.id);
  });

  it("5. Acknowledge action records audit log with actor ID, target, and timestamp", async () => {
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        targetType: "GHAT_REPORT",
        targetId: testReport1.id,
        action: "GHAT_REPORT_ACKNOWLEDGE",
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(auditEntry);
    assert.equal(auditEntry.actorId, superAdminUser.id);
    const details = JSON.parse(auditEntry.details || "{}");
    assert.equal(details.previousStatus, "SUBMITTED");
    assert.equal(details.newStatus, "ACKNOWLEDGED");
  });

  it("6. Duplicate Acknowledge request is idempotent and handled safely without throwing error", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, superAdminSession.token, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.reviewStatus, "ACKNOWLEDGED");
  });

  // --- SECTION 3: Resolve Action & Status Lifecycle ---

  it("7. Super Admin can Resolve report using frontend payload { status: 'RESOLVED' }", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, superAdminSession.token, {
      status: "RESOLVED",
      notes: "Additional staff deployed to clear north steps",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.reviewStatus, "RESOLVED");

    // Verify database state
    const dbReport = await prisma.ghatReport.findUnique({ where: { id: testReport1.id } });
    assert.equal(dbReport?.reviewStatus, "RESOLVED");
    assert.ok(dbReport?.notes?.includes("Additional staff deployed"));
  });

  it("8. Resolve action records audit log with actor ID, target, and timestamp", async () => {
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        targetType: "GHAT_REPORT",
        targetId: testReport1.id,
        action: "GHAT_REPORT_RESOLVE",
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(auditEntry);
    assert.equal(auditEntry.actorId, superAdminUser.id);
    const details = JSON.parse(auditEntry.details || "{}");
    assert.equal(details.previousStatus, "ACKNOWLEDGED");
    assert.equal(details.newStatus, "RESOLVED");
  });

  it("9. Rejects invalid backward transition from RESOLVED to ACKNOWLEDGED with HTTP 400", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, superAdminSession.token, {
      reviewStatus: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("Resolved reports cannot be moved back"));
  });

  it("10. Super Admin can Resolve a SUBMITTED report directly and sets acknowledged info atomically", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport2.id}`, superAdminSession.token, {
      reviewStatus: "RESOLVED",
      notes: "Ambulance dispatched and first aid administered",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport2.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.reviewStatus, "RESOLVED");
    assert.equal(json.acknowledgedById, superAdminUser.id);
    assert.ok(json.acknowledgedAt);
  });

  // --- SECTION 4: Ghat Supervisor Scoping Enforcement ---

  it("11. Assigned Ghat Supervisor can acknowledge a report for their assigned ghat", async () => {
    // Create new report on testGhat1 (assigned to supervisorUser1)
    const newReport = await prisma.ghatReport.create({
      data: {
        listingId: testGhat1.id,
        reporterId: visitorUser.id,
        crowdStatus: "MODERATE",
        notes: "Cleanliness checked",
        reviewStatus: "SUBMITTED",
      },
    });

    const req = createReq("PATCH", `/api/v1/ghats/reports/${newReport.id}`, supervisorSession1.token, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: newReport.id }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.reviewStatus, "ACKNOWLEDGED");
    assert.equal(json.acknowledgedById, supervisorUser1.id);
  });

  it("12. Ghat Supervisor CANNOT acknowledge or resolve reports for an unassigned ghat (HTTP 403)", async () => {
    // testGhat2 is assigned to supervisorUser2, NOT supervisorUser1
    const newReport = await prisma.ghatReport.create({
      data: {
        listingId: testGhat2.id,
        reporterId: visitorUser.id,
        crowdStatus: "FREE",
        notes: "Evening harathi crowd status",
        reviewStatus: "SUBMITTED",
      },
    });

    const req = createReq("PATCH", `/api/v1/ghats/reports/${newReport.id}`, supervisorSession1.token, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: newReport.id }) });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.ok(json.error.includes("not assigned to supervise this ghat"));
  });

  // --- SECTION 5: Error Handling & Payload Validation ---

  it("13. Rejects empty payload (neither status nor reviewStatus) with HTTP 422 and structured validation error", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, superAdminSession.token, {});
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 422);
    const json = await res.json();
    assert.equal(json.error, "Validation failed");
    assert.ok(Array.isArray(json.details));
  });

  it("14. Rejects invalid enum value with HTTP 422 and structured validation error", async () => {
    const req = createReq("PATCH", `/api/v1/ghats/reports/${testReport1.id}`, superAdminSession.token, {
      status: "NOT_A_VALID_STATUS",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: testReport1.id }) });
    assert.equal(res.status, 422);
    const json = await res.json();
    assert.equal(json.error, "Validation failed");
  });

  it("15. Rejects non-existent report ID with HTTP 404", async () => {
    const req = createReq("PATCH", "/api/v1/ghats/reports/non_existent_id", superAdminSession.token, {
      status: "ACKNOWLEDGED",
    });
    const res = await updateReportStatus(req, { params: Promise.resolve({ id: "non_existent_id" }) });
    assert.equal(res.status, 404);
  });
});
