import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import { hashPassword, createSession } from "../src/lib/auth";
import { GET as getTiming, PUT as updateTiming } from "../src/app/api/v1/listings/[id]/timing/route";
import { GET as getGhatStatus, PATCH as patchGhatStatus } from "../src/app/api/v1/ghats/[id]/status/route";
import { NextRequest } from "next/server";

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});

describe("Timing API & Authority Controls", () => {
  let superAdminUser: any;
  let supervisorUser: any;
  let unassignedSupervisorUser: any;
  let visitorUser: any;

  let superAdminSession: any;
  let supervisorSession: any;
  let unassignedSupervisorSession: any;
  let visitorSession: any;

  let testGhat: any;
  let testRestaurant: any;

  before(async () => {
    // Clean up any existing records
    await prisma.listingSchedule.deleteMany({});
    await prisma.assignment.deleteMany({ where: { user: { phone: { startsWith: "917777" } } } });
    await prisma.listing.deleteMany({ where: { name: { contains: "Test" } } });
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "917777" } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: "917777" } } });

    // 1. Create synthetic test users
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9177770001",
        name: "Timing SuperAdmin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminPass123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    supervisorUser = await prisma.user.create({
      data: {
        phone: "9177770002",
        name: "Assigned Ghat Supervisor",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    supervisorSession = await createSession(supervisorUser.id, "PASSWORD");

    unassignedSupervisorUser = await prisma.user.create({
      data: {
        phone: "9177770003",
        name: "Unassigned Ghat Supervisor",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    unassignedSupervisorSession = await createSession(unassignedSupervisorUser.id, "PASSWORD");

    visitorUser = await prisma.user.create({
      data: {
        phone: "9177770004",
        name: "Timing Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPass123!"),
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD");

    // 2. Create synthetic ghat listing and assign supervisorUser
    testGhat = await prisma.listing.create({
      data: {
        name: "VIP Pushkar Ghat (Timing Test)",
        category: "GHAT",
        description: "Official bathing ghat with authorized timings",
        address: "Gowthami Bund Road",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        ghatDetails: {
          create: {
            currentCrowdStatus: "MODERATE",
            statusUpdatedAt: new Date(),
            supervisorId: supervisorUser.id,
          },
        },
      },
    });

    await prisma.assignment.create({
      data: {
        userId: supervisorUser.id,
        listingId: testGhat.id,
        type: "GHAT_SUPERVISOR",
      },
    });

    // 3. Create synthetic restaurant listing
    testRestaurant = await prisma.listing.create({
      data: {
        name: "Godavari Breeze Restaurant",
        category: "RESTAURANT",
        description: "Riverfront multi-cuisine dining",
        address: "Bridge Road",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
        ownerId: superAdminUser.id,
      },
    });
  });

  after(async () => {
    await prisma.listingSchedule.deleteMany({ where: { listingId: { in: [testGhat.id, testRestaurant.id] } } });
    await prisma.assignment.deleteMany({ where: { listingId: testGhat.id } });
    await prisma.ghatDetails.deleteMany({ where: { listingId: testGhat.id } });
    await prisma.listing.deleteMany({ where: { id: { in: [testGhat.id, testRestaurant.id] } } });

    const phones = ["9177770001", "9177770002", "9177770003", "9177770004"];
    await prisma.session.deleteMany({ where: { user: { phone: { in: phones } } } });
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
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

  it("returns HOURS_NOT_AVAILABLE for newly created listing without schedule", async () => {
    const req = makeReq(`http://localhost:3000/api/v1/listings/${testGhat.id}/timing`, "GET");
    const res = await getTiming(req, { params: Promise.resolve({ id: testGhat.id }) });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.status.code, "HOURS_NOT_AVAILABLE");
    assert.equal(json.status.label, "Hours not available");
  });

  it("allows assigned Ghat Supervisor to update operating hours and closures of assigned ghat", async () => {
    const req = makeReq(`http://localhost:3000/api/v1/listings/${testGhat.id}/timing`, "PUT", supervisorSession.token, {
      openingTime: "05:00",
      closingTime: "22:00",
      breakStart: "12:30",
      breakEnd: "15:30",
      operatingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      isTemporarilyClosed: false,
    });

    const res = await updateTiming(req, { params: Promise.resolve({ id: testGhat.id }) });
    const json = await res.json();
    assert.equal(res.status, 200, `Update failed: ${JSON.stringify(json)}`);
    assert.equal(json.ok, true);
    assert.equal(json.schedule.openingTime, "05:00");
    assert.equal(json.schedule.closingTime, "22:00");
    assert.equal(json.schedule.breakStart, "12:30");
  });

  it("updating ghat operating hours does NOT overwrite or alter existing crowd status", async () => {
    const ghatDetailsBefore = await prisma.ghatDetails.findUnique({ where: { listingId: testGhat.id } });
    assert.equal(ghatDetailsBefore?.currentCrowdStatus, "MODERATE");

    // Supervisor sets temporary closure on operating hours
    const req = makeReq(`http://localhost:3000/api/v1/listings/${testGhat.id}/timing`, "PUT", supervisorSession.token, {
      openingTime: "05:00",
      closingTime: "22:00",
      isTemporarilyClosed: true,
      temporaryClosureReason: "Official Ghat Cleaning & Water Flow Inspection",
    });
    const res = await updateTiming(req, { params: Promise.resolve({ id: testGhat.id }) });
    assert.equal(res.status, 200);

    // Verify crowd status remained MODERATE
    const ghatDetailsAfter = await prisma.ghatDetails.findUnique({ where: { listingId: testGhat.id } });
    assert.equal(ghatDetailsAfter?.currentCrowdStatus, "MODERATE");
  });

  it("prohibits unassigned Ghat Supervisor from updating unassigned ghat", async () => {
    const req = makeReq(`http://localhost:3000/api/v1/listings/${testGhat.id}/timing`, "PUT", unassignedSupervisorSession.token, {
      open24Hours: true,
    });
    const res = await updateTiming(req, { params: Promise.resolve({ id: testGhat.id }) });
    assert.equal(res.status, 403);
  });

  it("prohibits public visitors from modifying operating hours", async () => {
    const req = makeReq(`http://localhost:3000/api/v1/listings/${testGhat.id}/timing`, "PUT", visitorSession.token, {
      open24Hours: true,
    });
    const res = await updateTiming(req, { params: Promise.resolve({ id: testGhat.id }) });
    assert.equal(res.status, 403);
  });

  it("records timing updates in AuditLog", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        targetId: testGhat.id,
        action: "LISTING_TIMING_UPDATE",
      },
    });
    assert.ok(auditLogs.length >= 1, "AuditLog should contain entries for timing changes");
  });
});
