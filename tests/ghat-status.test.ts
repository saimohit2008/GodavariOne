import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Configure isolated test database
const testDbPath = path.resolve(__dirname, "../db/test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { GET as getGhatStatus, PATCH as patchGhatStatus } from "@/app/api/v1/ghats/[id]/status/route";
import { GET as getListings } from "@/app/api/v1/listings/route";

describe("Issue 1: Ghat Crowd Status Visibility and Controls", () => {
  let superAdminUser: any;
  let supervisorUser: any;
  let otherSupervisorUser: any;
  let visitorUser: any;
  let testGhat1: any;
  let testGhat2: any;
  let superAdminSession: any;
  let supervisorSession: any;
  let otherSupervisorSession: any;
  let visitorSession: any;

  before(async () => {
    // Pre-cleanup in case previous run aborted
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "910000" } } } });
    await prisma.assignment.deleteMany({ where: { user: { phone: { startsWith: "910000" } } } });
    await prisma.auditLog.deleteMany({ where: { actor: { phone: { startsWith: "910000" } } } });
    await prisma.ghatReport.deleteMany({ where: { reporter: { phone: { startsWith: "910000" } } } });
    await prisma.listing.deleteMany({ where: { name: { contains: "Test Ghat" } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "910000" } } });

    // 1. Create synthetic users for testing
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9100000001",
        name: "Synthetic Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminPass123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    supervisorUser = await prisma.user.create({
      data: {
        phone: "9100000002",
        name: "Synthetic Ghat Supervisor 1",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    supervisorSession = await createSession(supervisorUser.id, "PASSWORD");

    otherSupervisorUser = await prisma.user.create({
      data: {
        phone: "9100000003",
        name: "Synthetic Ghat Supervisor 2",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    otherSupervisorSession = await createSession(otherSupervisorUser.id, "PASSWORD");

    visitorUser = await prisma.user.create({
      data: {
        phone: "9100000004",
        name: "Synthetic Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPass123!"),
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD");

    // 2. Create synthetic ghat listings
    testGhat1 = await prisma.listing.create({
      data: {
        name: "Kotilingala Ghat (Test)",
        category: "GHAT",
        description: "Historic bathing ghat on Godavari riverbank",
        address: "Kotilingala, Rajahmundry",
        district: "East Godavari",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        ghatDetails: {
          create: {
            currentCrowdStatus: null,
            statusUpdatedAt: null,
            supervisorId: null,
          },
        },
      },
      include: { ghatDetails: true },
    });

    testGhat2 = await prisma.listing.create({
      data: {
        name: "Saraswati Ghat (Test)",
        category: "GHAT",
        description: "Peaceful sacred bathing spot",
        address: "Near Godavari Bridge",
        district: "East Godavari",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        ghatDetails: {
          create: {
            currentCrowdStatus: null,
            statusUpdatedAt: null,
            supervisorId: null,
          },
        },
      },
      include: { ghatDetails: true },
    });

    // 3. Assign supervisorUser only to testGhat1
    await prisma.assignment.create({
      data: {
        userId: supervisorUser.id,
        type: "GHAT_SUPERVISOR",
        listingId: testGhat1.id,
      },
    });
    await prisma.ghatDetails.update({
      where: { listingId: testGhat1.id },
      data: { supervisorId: supervisorUser.id },
    });
  });

  after(async () => {
    // Clean up synthetic test records
    await prisma.assignment.deleteMany({
      where: { userId: { in: [superAdminUser.id, supervisorUser.id, otherSupervisorUser.id, visitorUser.id] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [superAdminUser.id, supervisorUser.id, otherSupervisorUser.id, visitorUser.id] } },
    });
    await prisma.ghatReport.deleteMany({
      where: { listingId: { in: [testGhat1.id, testGhat2.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: [testGhat1.id, testGhat2.id] } },
    });
    await prisma.listing.deleteMany({
      where: { id: { in: [testGhat1.id, testGhat2.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminUser.id, supervisorUser.id, otherSupervisorUser.id, visitorUser.id] } },
    });
    await prisma.$disconnect();
  });

  it("1. Missing status initially returns null (fallback: Status not yet reported)", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat1.id}/status`);
    const res = await getGhatStatus(req, { params: Promise.resolve({ id: testGhat1.id }) });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.currentCrowdStatus, null, "Should return null when status is not yet reported");
    assert.equal(json.statusUpdatedAt, null);
  });

  it("2. Super Admin can update status of every ghat to CROWDED and CLOSED", async () => {
    // Update testGhat1 to CROWDED
    const req1 = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat1.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `godavari_session=${superAdminSession.token}`,
      },
      body: JSON.stringify({ crowdStatus: "CROWDED", notes: "High afternoon rush" }),
    });

    const res1 = await patchGhatStatus(req1, { params: Promise.resolve({ id: testGhat1.id }) });
    const json1 = await res1.json();

    assert.equal(res1.status, 200);
    assert.equal(json1.ok, true);
    assert.equal(json1.currentCrowdStatus, "CROWDED");

    // Verify persistence in database
    const dbGhat1 = await prisma.ghatDetails.findUnique({ where: { listingId: testGhat1.id } });
    assert.equal(dbGhat1?.currentCrowdStatus, "CROWDED");
    assert.ok(dbGhat1?.statusUpdatedAt);

    // Update testGhat2 to CLOSED
    const req2 = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat2.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `godavari_session=${superAdminSession.token}`,
      },
      body: JSON.stringify({ crowdStatus: "CLOSED", notes: "Temporarily closed for maintenance" }),
    });

    const res2 = await patchGhatStatus(req2, { params: Promise.resolve({ id: testGhat2.id }) });
    const json2 = await res2.json();

    assert.equal(res2.status, 200);
    assert.equal(json2.ok, true);
    assert.equal(json2.currentCrowdStatus, "CLOSED");

    const dbGhat2 = await prisma.ghatDetails.findUnique({ where: { listingId: testGhat2.id } });
    assert.equal(dbGhat2?.currentCrowdStatus, "CLOSED");
  });

  it("3. Ghat Supervisor can update their assigned ghat to MODERATE", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat1.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `godavari_session=${supervisorSession.token}`,
      },
      body: JSON.stringify({ crowdStatus: "MODERATE", notes: "Crowd thinning out" }),
    });

    const res = await patchGhatStatus(req, { params: Promise.resolve({ id: testGhat1.id }) });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.currentCrowdStatus, "MODERATE");

    const dbGhat = await prisma.ghatDetails.findUnique({ where: { listingId: testGhat1.id } });
    assert.equal(dbGhat?.currentCrowdStatus, "MODERATE");
  });

  it("4. Ghat Supervisor CANNOT update an unassigned ghat (server authorization enforcement)", async () => {
    // supervisorUser is NOT assigned to testGhat2
    const req = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat2.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `godavari_session=${supervisorSession.token}`,
      },
      body: JSON.stringify({ crowdStatus: "FREE" }),
    });

    const res = await patchGhatStatus(req, { params: Promise.resolve({ id: testGhat2.id }) });
    assert.equal(res.status, 403, "Supervisor must be forbidden from updating unassigned ghat");

    // Confirm testGhat2 status was NOT changed
    const dbGhat2 = await prisma.ghatDetails.findUnique({ where: { listingId: testGhat2.id } });
    assert.equal(dbGhat2?.currentCrowdStatus, "CLOSED");
  });

  it("5. Visitor CANNOT update any ghat status", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/ghats/${testGhat1.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `godavari_session=${visitorSession.token}`,
      },
      body: JSON.stringify({ crowdStatus: "FREE" }),
    });

    const res = await patchGhatStatus(req, { params: Promise.resolve({ id: testGhat1.id }) });
    assert.equal(res.status, 403, "Visitor must be forbidden from updating ghat status");
  });

  it("6. Public listings directory returns the saved status and timestamp for visitors", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/listings?category=GHAT&limit=50");
    const res = await getListings(req);
    const json = await res.json();

    assert.equal(res.status, 200);
    const item1 = json.items.find((item: any) => item.id === testGhat1.id);
    assert.ok(item1, "testGhat1 must appear in public listings");
    assert.equal(item1.ghat?.currentCrowdStatus, "MODERATE");
    assert.ok(item1.ghat?.statusUpdatedAt, "Must include statusUpdatedAt timestamp");

    const item2 = json.items.find((item: any) => item.id === testGhat2.id);
    assert.ok(item2, "testGhat2 must appear in public listings");
    assert.equal(item2.ghat?.currentCrowdStatus, "CLOSED");
  });

  it("7. Status change is recorded in AuditLog with user, ghat, timestamp and old/new values", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetType: "GHAT", targetId: testGhat1.id, action: "GHAT_STATUS_UPDATE" },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(auditLogs.length > 0, "AuditLog entries must exist for ghat status updates");
    const latestAudit = auditLogs[0];
    assert.equal(latestAudit.actorId, supervisorUser.id);

    const details = JSON.parse(latestAudit.details || "{}");
    assert.equal(details.ghatId, testGhat1.id);
    assert.equal(details.oldStatus, "CROWDED");
    assert.equal(details.newStatus, "MODERATE");
    assert.ok(details.updatedAt);
  });
});
