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

import { hashPassword, createSession, verifyPassword } from "@/lib/auth";
import { NextRequest } from "next/server";
import { DELETE as deleteUser } from "@/app/api/v1/admin/users/[id]/route";
import { GET as listUsers } from "@/app/api/v1/admin/users/route";
import { POST as loginUser } from "@/app/api/v1/auth/login/route";
import { POST as registerUser } from "@/app/api/v1/auth/register/route";

describe("Issue 2: Permanent Staff Deletion and Clean Re-registration", () => {
  let superAdminUser: any;
  let superAdminSession: any;
  let superAdminUser2: any;
  let superAdminSession2: any;
  let syntheticStaffUser: any;
  let staffSession: any;
  let staffAssignment: any;
  let testGhat: any;
  let unauthorizedUser: any;
  let unauthorizedSession: any;

  const staffPhone = "9199990001";
  const staffEmail = "synthetic.staff@godavarione.test";
  const staffPassword = "StaffPassword123!";

  before(async () => {
    await prisma.session.deleteMany({ where: { user: { phone: { in: ["9199990099", "9199990098", "9199990002", "9199990001", "9199990003"] } } } });
    await prisma.assignment.deleteMany({ where: { user: { phone: { in: ["9199990099", "9199990098", "9199990002", "9199990001", "9199990003"] } } } });
    await prisma.user.deleteMany({ where: { phone: { in: ["9199990099", "9199990098", "9199990002", "9199990001", "9199990003"] } } });

    // 1. Create Super Admin accounts (2 active so self-deletion check is independent of last-admin check)
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9199990099",
        name: "Admin for Staff Deletion Test",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperAdminPass123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "ADMIN");

    superAdminUser2 = await prisma.user.create({
      data: {
        phone: "9199990098",
        name: "Second Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperAdminPass123!"),
      },
    });
    superAdminSession2 = await createSession(superAdminUser2.id, "ADMIN");

    // 2. Create an unauthorized visitor user
    unauthorizedUser = await prisma.user.create({
      data: {
        phone: "9199990088",
        name: "Regular Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPass123!"),
      },
    });
    unauthorizedSession = await createSession(unauthorizedUser.id, "PASSWORD");

    // 3. Create a test ghat
    testGhat = await prisma.listing.create({
      data: {
        name: "Godavari Snanam Ghat (Deletion Test)",
        category: "GHAT",
        description: "Bathing ghat for deletion test",
        address: "Riverbank Sector 4",
        publicationStatus: "PUBLISHED",
        locationVerified: true,
      },
    });

    // 4. Create synthetic staff member (Ghat Supervisor)
    syntheticStaffUser = await prisma.user.create({
      data: {
        phone: staffPhone,
        email: staffEmail,
        name: "Venkat Supervisor",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword(staffPassword),
      },
    });

    // 5. Create active session, assignment, and supervised ghat link for the staff member
    staffSession = await createSession(syntheticStaffUser.id, "PASSWORD");

    staffAssignment = await prisma.assignment.create({
      data: {
        userId: syntheticStaffUser.id,
        type: "GHAT_SUPERVISOR",
        listingId: testGhat.id,
      },
    });

    await prisma.ghatDetails.upsert({
      where: { listingId: testGhat.id },
      create: { listingId: testGhat.id, supervisorId: syntheticStaffUser.id },
      update: { supervisorId: syntheticStaffUser.id },
    });

    // 6. Record historical audit log for this staff member
    await prisma.auditLog.create({
      data: {
        actorId: syntheticStaffUser.id,
        action: "GHAT_INSPECTION",
        targetType: "GHAT",
        targetId: testGhat.id,
        details: JSON.stringify({ note: "Morning inspection completed" }),
      },
    });
  });

  after(async () => {
    // Clean up all remaining test accounts and listings
    await prisma.assignment.deleteMany({
      where: { listingId: testGhat?.id },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [superAdminUser?.id, unauthorizedUser?.id, syntheticStaffUser?.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { targetId: testGhat?.id },
    });
    if (testGhat?.id) {
      await prisma.listing.deleteMany({ where: { id: testGhat.id } });
    }
    await prisma.user.deleteMany({
      where: { phone: { in: [staffPhone, "9199990099", "9199990088"] } },
    });
    await prisma.$disconnect();
  });

  it("1. Unauthorized non-admin user cannot delete staff members", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${syntheticStaffUser.id}`, {
      method: "DELETE",
      headers: { cookie: `godavari_session=${unauthorizedSession.token}` },
    });
    const res = await deleteUser(req, { params: Promise.resolve({ id: syntheticStaffUser.id }) });
    assert.equal(res.status, 403, "Non-admin user must receive 403 Forbidden");

    // Verify staff member is still present
    const staffInDb = await prisma.user.findUnique({ where: { id: syntheticStaffUser.id } });
    assert.ok(staffInDb, "Staff user must not be deleted by unauthorized user");
  });

  it("2. Super Admin self-deletion is prevented", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${superAdminUser.id}`, {
      method: "DELETE",
      headers: { cookie: `godavari_session=${superAdminSession.token}` },
    });
    const res = await deleteUser(req, { params: Promise.resolve({ id: superAdminUser.id }) });
    assert.equal(res.status, 400, "Super Admin self-deletion must return 400");
    const json = await res.json();
    assert.match(json.error, /cannot delete your own/i);
  });

  it("3. Deletion of the last active Super Admin is prevented", async () => {
    // Suspend other Super Admins so superAdminUser is the sole active Super Admin
    await prisma.user.updateMany({
      where: { role: "SUPER_ADMIN", id: { not: superAdminUser.id } },
      data: { status: "SUSPENDED" },
    });

    try {
      const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${superAdminUser.id}`, {
        method: "DELETE",
        headers: { cookie: `godavari_session=${superAdminSession.token}` },
      });
      const res = await deleteUser(req, { params: Promise.resolve({ id: superAdminUser.id }) });
      assert.equal(res.status, 400, "Deleting last active Super Admin must return 400");
      const json = await res.json();
      assert.match(json.error, /last active Super Admin/i);
    } finally {
      // Restore other super admins to ACTIVE
      await prisma.user.updateMany({
        where: { role: "SUPER_ADMIN" },
        data: { status: "ACTIVE" },
      });
    }
  });

  it("4. Super Admin permanently deletes the synthetic staff member", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${syntheticStaffUser.id}`, {
      method: "DELETE",
      headers: { cookie: `godavari_session=${superAdminSession.token}` },
    });

    const res = await deleteUser(req, { params: Promise.resolve({ id: syntheticStaffUser.id }) });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.action, "DELETED", "Action must be DELETED, not DEACTIVATED");
    assert.match(json.message, /Account permanently deleted/i);
  });

  it("5. Account is completely removed from database and does not appear in staff lists", async () => {
    // Direct database check
    const userInDb = await prisma.user.findUnique({ where: { id: syntheticStaffUser.id } });
    assert.equal(userInDb, null, "User record must be completely deleted from the database");

    // Staff list API check
    const req = new NextRequest("http://localhost:3000/api/v1/admin/users?role=GHAT_SUPERVISOR", {
      headers: { cookie: `godavari_session=${superAdminSession.token}` },
    });
    const res = await listUsers(req);
    const json = await res.json();
    assert.equal(res.status, 200);

    const foundInList = json.items.some((u: any) => u.id === syntheticStaffUser.id || u.phone === staffPhone);
    assert.equal(foundInList, false, "Deleted account must not appear in staff lists");
  });

  it("6. Old sessions and assignments are deleted and rejected", async () => {
    // Check sessions deleted from DB
    const sessionInDb = await prisma.session.findUnique({ where: { token: staffSession.token } });
    assert.equal(sessionInDb, null, "Staff session must be removed from DB");

    // Check assignments deleted from DB
    const assignmentsInDb = await prisma.assignment.findMany({ where: { userId: syntheticStaffUser.id } });
    assert.equal(assignmentsInDb.length, 0, "Staff assignments must be deleted");

    // Check ghatDetails supervisor link was safely nullified
    const ghatDetails = await prisma.ghatDetails.findUnique({ where: { listingId: testGhat.id } });
    assert.equal(ghatDetails?.supervisorId, null, "Supervisor link must be nullified, not broken");
  });

  it("7. Attempting login with deleted account phone is safely rejected with anti-enumeration protection", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: staffPhone, password: staffPassword }),
    });

    const res = await loginUser(req);
    assert.equal(res.status, 401, "Login for deleted account must return 401");
    const json = await res.json();
    assert.match(json.error, /invalid mobile number or password/i);
  });

  it("8. Re-registration with same phone number creates a completely new account with default VISITOR role", async () => {
    // Register anew with the same phone number
    const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Venkat Re-registered",
        phone: staffPhone,
        password: "NewVisitorPassword456!",
        otpCode: "123456",
      }),
    });

    const res = await registerUser(req);
    const json = await res.json();

    assert.equal(res.status, 201, "Re-registration with same phone must succeed");
    assert.notEqual(json.id, syntheticStaffUser.id, "New account must have a fresh unique ID");
    assert.equal(json.role, "VISITOR", "New account must have default VISITOR role, NOT former staff role");
    assert.equal(json.phone, staffPhone);

    // Verify in database: new account has no assignments or previous staff privileges
    const newAssignments = await prisma.assignment.findMany({ where: { userId: json.id } });
    assert.equal(newAssignments.length, 0, "New account must have zero inherited assignments");

    // Clean up re-registered account
    await prisma.session.deleteMany({ where: { userId: json.id } });
    await prisma.user.delete({ where: { id: json.id } });
  });

  it("9. Historical audit entries are preserved safely with actorId nullified and audit log recorded", async () => {
    // Verify historical audit logs for testGhat still exist
    const historicalLogs = await prisma.auditLog.findMany({
      where: { targetType: "GHAT", targetId: testGhat.id, action: "GHAT_INSPECTION" },
    });
    assert.ok(historicalLogs.length > 0, "Historical audit logs must be preserved");
    assert.equal(historicalLogs[0].actorId, null, "Deleted actor foreign reference must be safely nullified");

    // Verify STAFF_DELETED audit log exists recording deletion
    const deletionLogs = await prisma.auditLog.findMany({
      where: { action: "STAFF_DELETED", targetType: "USER", targetId: syntheticStaffUser.id },
    });
    assert.ok(deletionLogs.length > 0, "STAFF_DELETED audit event must be logged");
    assert.equal(deletionLogs[0].actorId, superAdminUser.id);
    const details = JSON.parse(deletionLogs[0].details || "{}");
    assert.equal(details.method, "PERMANENT_DELETE");
    assert.equal(details.staffPhone, staffPhone);
    assert.equal(details.deletedUserId, syntheticStaffUser.id);
    // Verify no passwords or tokens stored in audit details
    assert.equal(details.passwordHash, undefined);
    assert.equal(details.token, undefined);
  });

  after(async () => {
    await prisma.session.deleteMany({ where: { user: { phone: { in: ["9199990099", "9199990098", "9199990088", "9199990001", "9199990002", "9199990003"] } } } });
    await prisma.assignment.deleteMany({ where: { user: { phone: { in: ["9199990099", "9199990098", "9199990088", "9199990001", "9199990002", "9199990003"] } } } });
    await prisma.user.deleteMany({ where: { phone: { in: ["9199990099", "9199990098", "9199990088", "9199990001", "9199990002", "9199990003"] } } });
    if (testGhat?.id) {
      await prisma.ghatDetails.deleteMany({ where: { listingId: testGhat.id } });
      await prisma.listing.deleteMany({ where: { id: testGhat.id } });
    }
    await prisma.$disconnect();
  });
});
