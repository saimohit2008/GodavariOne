import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "crypto";
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
import { GET as getFooterContact, PATCH as updateFooterContact, DELETE as resetFooterContact } from "@/app/api/v1/footer-contact/route";

describe("GODAVARI ONE — FOOTER CONTACT MANAGEMENT VERIFICATION SUITE", () => {
  let superAdminUser: any;
  let superAdminSession: any;
  let visitorUser: any;
  let visitorSession: any;

  function makeHeaders(sessionToken?: string, contentType = "application/json"): Headers {
    const headers = new Headers();
    if (sessionToken) {
      headers.set("cookie", `godavari_session=${sessionToken}`);
    }
    headers.set("content-type", contentType);
    return headers;
  }

  before(async () => {
    // 0. Ensure table exists in test database
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HomepageSection" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "isEnabled" BOOLEAN NOT NULL DEFAULT 1,
        "orderIdx" INTEGER NOT NULL DEFAULT 0,
        "settings" TEXT,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastEditedById" TEXT
      );
    `);

    // 1. Clean up any existing footer_contact record from prior runs
    await prisma.homepageSection.deleteMany({
      where: { id: "footer_contact" },
    });

    // 2. Create Super Admin test user
    const adminPhone = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;
    superAdminUser = await prisma.user.create({
      data: {
        phone: adminPhone,
        email: "superadmin.contact.test@godavari.gov.in",
        name: "Super Admin Tester",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminSecretPassword!2027"),
        phoneVerified: true,
        emailVerified: true,
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    // 3. Create regular Visitor test user
    const visitorPhone = `+9188888${Math.floor(10000 + Math.random() * 90000)}`;
    visitorUser = await prisma.user.create({
      data: {
        phone: visitorPhone,
        email: "visitor.contact.test@example.com",
        name: "Visitor Tester",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("VisitorPassword!2027"),
        phoneVerified: true,
        emailVerified: true,
      },
    });
    visitorSession = await createSession(visitorUser.id, "PASSWORD");
  });

  after(async () => {
    // Clean up test users and session
    if (superAdminUser) {
      await prisma.user.deleteMany({
        where: { id: { in: [superAdminUser.id, visitorUser?.id].filter(Boolean) } },
      });
    }
    // Clean up footer_contact test record
    await prisma.homepageSection.deleteMany({
      where: { id: "footer_contact" },
    });
    await prisma.$disconnect();
  });

  describe("1. Unconfigured State & Absence of Hardcoded Values", () => {
    it("public GET returns null/empty contact details when not configured", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
      });

      const res = await getFooterContact(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.email, null, "Email must be null when unconfigured");
      assert.deepEqual(data.phones, [], "Phones must be empty array when unconfigured");
      assert.equal(data.address, null, "Address must be null when unconfigured");
      assert.equal(data.isEnabled, true, "Master enabled defaults to true");
      // Must not return dummy phone or email
      assert.notEqual(data.email, "help@godavarione.ap.gov.in");
    });

    it("admin GET indicates isConfigured: false when unconfigured", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
        headers: makeHeaders(superAdminSession.token),
      });

      const res = await getFooterContact(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.isConfigured, false);
      assert.equal(data.email, null);
      assert.deepEqual(data.phones, []);
    });
  });

  describe("2. Security, Authentication & Role-Based Access Control", () => {
    it("rejects unauthenticated PATCH requests with 401 or 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(), // No session
        body: JSON.stringify({ email: "unauthorized@test.com" }),
      });

      const res = await updateFooterContact(req);
      assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
    });

    it("rejects non-admin (VISITOR) PATCH requests with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(visitorSession.token),
        body: JSON.stringify({ email: "hacker@test.com" }),
      });

      const res = await updateFooterContact(req);
      assert.equal(res.status, 403, "Visitors must not be able to update contact settings");

      const body = await res.json();
      assert.ok(body.error?.includes("Insufficient permissions"));
    });

    it("rejects non-admin (VISITOR) DELETE requests with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "DELETE",
        headers: makeHeaders(visitorSession.token),
      });

      const res = await resetFooterContact(req);
      assert.equal(res.status, 403);
    });
  });

  describe("3. Strict Backend Input Validation", () => {
    it("rejects invalid email formats with 422 Unprocessable Entity", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({ email: "not-a-valid-email" }),
      });

      const res = await updateFooterContact(req);
      assert.equal(res.status, 422);

      const body = await res.json();
      assert.ok(JSON.stringify(body).includes("Please enter a valid email address"));
    });

    it("rejects phone numbers containing illegal characters with 422", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({
          phones: [{ id: "phone_1", number: "14500-CALL-NOW", label: "Helpline", isEnabled: true }],
        }),
      });

      const res = await updateFooterContact(req);
      assert.equal(res.status, 422);

      const body = await res.json();
      assert.ok(JSON.stringify(body).includes("Phone number can only contain digits"));
    });

    it("rejects phone numbers with fewer than 3 digits with 422", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({
          phones: [{ id: "phone_1", number: "12", label: "Helpline", isEnabled: true }],
        }),
      });

      const res = await updateFooterContact(req);
      assert.equal(res.status, 422);
    });
  });

  describe("4. Administrator Configuration & Publication", () => {
    it("allows Super Admin to add email, multiple phones with custom labels, and address", async () => {
      const payload = {
        isEnabled: true,
        email: "official-help@godavarione.ap.gov.in",
        emailEnabled: true,
        phones: [
          { id: "phone_helpline", number: "14500", label: "Helpline", isEnabled: true },
          { id: "phone_control_room", number: "+91 883 2450000", label: "Pushkara Control Room", isEnabled: true },
          { id: "phone_emergency", number: "108", label: "Emergency", isEnabled: true },
        ],
        address: "Godavari Pushkaralu Central Command Center, Rajahmundry, Andhra Pradesh, India",
        addressEnabled: true,
      };

      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify(payload),
      });

      const res = await updateFooterContact(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.email, "official-help@godavarione.ap.gov.in");
      assert.equal(body.phones.length, 3);
      assert.equal(body.phones[0].label, "Helpline");
      assert.equal(body.phones[1].label, "Pushkara Control Room");
      assert.equal(body.address, "Godavari Pushkaralu Central Command Center, Rajahmundry, Andhra Pradesh, India");
    });

    it("creates an AuditLog entry when contact information is modified", async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          targetType: "FOOTER_CONTACT",
          targetId: "footer_contact",
          action: "FOOTER_CONTACT_UPDATE",
        },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(auditLog, "Audit log must be created");
      assert.equal(auditLog.actorId, superAdminUser.id);
      const details = JSON.parse(auditLog.details || "{}");
      assert.equal(details.email, "official-help@godavarione.ap.gov.in");
      assert.equal(details.phoneCount, 3);
    });

    it("public GET reflects the administrator's newly configured details", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
      });

      const res = await getFooterContact(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.email, "official-help@godavarione.ap.gov.in");
      assert.equal(data.phones.length, 3);
      assert.equal(data.phones[0].number, "14500");
      assert.equal(data.phones[0].label, "Helpline");
      assert.equal(data.address, "Godavari Pushkaralu Central Command Center, Rajahmundry, Andhra Pradesh, India");
    });
  });

  describe("5. Selective Enabling, Disabling & Removal", () => {
    it("disabling email hides it from public visitors while preserving it for admins", async () => {
      // 1. Admin disables email
      const reqPatch = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({ emailEnabled: false }),
      });
      const patchRes = await updateFooterContact(reqPatch);
      assert.equal(patchRes.status, 200);

      // 2. Public visitor sees email: null
      const reqPublic = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
      });
      const publicRes = await getFooterContact(reqPublic);
      const publicData = await publicRes.json();
      assert.equal(publicData.email, null, "Disabled email must be hidden from public");

      // 3. Admin still sees email with emailEnabled: false
      const reqAdmin = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
        headers: makeHeaders(superAdminSession.token),
      });
      const adminRes = await getFooterContact(reqAdmin);
      const adminData = await adminRes.json();
      assert.equal(adminData.email, "official-help@godavarione.ap.gov.in");
      assert.equal(adminData.emailEnabled, false);
    });

    it("disabling an individual phone number hides only that number from public visitors", async () => {
      // Admin disables the 2nd phone number (Pushkara Control Room)
      const reqPatch = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({
          phones: [
            { id: "phone_helpline", number: "14500", label: "Helpline", isEnabled: true },
            { id: "phone_control_room", number: "+91 883 2450000", label: "Pushkara Control Room", isEnabled: false },
            { id: "phone_emergency", number: "108", label: "Emergency", isEnabled: true },
          ],
        }),
      });
      await updateFooterContact(reqPatch);

      // Public visitor only receives the 2 enabled numbers
      const reqPublic = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
      });
      const publicRes = await getFooterContact(reqPublic);
      const publicData = await publicRes.json();

      assert.equal(publicData.phones.length, 2, "Only enabled phones must be returned to public");
      assert.ok(!publicData.phones.some((p: any) => p.number === "+91 883 2450000"));
      assert.ok(publicData.phones.some((p: any) => p.number === "14500"));
      assert.ok(publicData.phones.some((p: any) => p.number === "108"));
    });

    it("removing a phone number completely deletes it from public view", async () => {
      // Admin removes 108
      const reqPatch = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({
          phones: [
            { id: "phone_helpline", number: "14500", label: "Helpline", isEnabled: true },
          ],
        }),
      });
      await updateFooterContact(reqPatch);

      // Public visitor receives only the 1 remaining phone
      const reqPublic = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
      });
      const publicRes = await getFooterContact(reqPublic);
      const publicData = await publicRes.json();
      assert.equal(publicData.phones.length, 1);
      assert.equal(publicData.phones[0].number, "14500");
    });

    it("master visibility toggle hides the entire contact info block from public view", async () => {
      // Turn master visibility off
      const reqPatch = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({ isEnabled: false }),
      });
      await updateFooterContact(reqPatch);

      // Public view returns all null/empty
      const reqPublic = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "GET",
      });
      const publicRes = await getFooterContact(reqPublic);
      const publicData = await publicRes.json();
      assert.equal(publicData.isEnabled, false);
      assert.equal(publicData.email, null);
      assert.deepEqual(publicData.phones, []);
      assert.equal(publicData.address, null);
    });
  });

  describe("6. Database Persistence & Restart Invariance", () => {
    it("persists settings in the database across client reconnections", async () => {
      // Re-enable master and re-enable email
      const reqPatch = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "PATCH",
        headers: makeHeaders(superAdminSession.token),
        body: JSON.stringify({
          isEnabled: true,
          email: "persisted@godavarione.ap.gov.in",
          emailEnabled: true,
          phones: [
            { id: "persisted_phone_1", number: "+91 883 2000000", label: "Permanent Helpline", isEnabled: true },
          ],
          address: "District Collectorate, East Godavari, Kakinada & Rajahmundry, AP",
          addressEnabled: true,
        }),
      });
      await updateFooterContact(reqPatch);

      // Verify directly from the database using a fresh Prisma query
      const freshRecord = await prisma.homepageSection.findUnique({
        where: { id: "footer_contact" },
      });

      assert.ok(freshRecord, "Database record must exist");
      assert.equal(freshRecord.id, "footer_contact");
      assert.equal(freshRecord.isEnabled, true);

      const parsedSettings = JSON.parse(freshRecord.settings || "{}");
      assert.equal(parsedSettings.email, "persisted@godavarione.ap.gov.in");
      assert.equal(parsedSettings.emailEnabled, true);
      assert.equal(parsedSettings.phones.length, 1);
      assert.equal(parsedSettings.phones[0].label, "Permanent Helpline");
      assert.equal(parsedSettings.address, "District Collectorate, East Godavari, Kakinada & Rajahmundry, AP");
      assert.equal(parsedSettings.addressEnabled, true);
    });

    it("DELETE endpoint resets settings and audits the operation", async () => {
      const reqDel = new NextRequest("http://localhost:3000/api/v1/footer-contact", {
        method: "DELETE",
        headers: makeHeaders(superAdminSession.token),
      });

      const res = await resetFooterContact(reqDel);
      assert.equal(res.status, 200);

      // Verify db is cleared
      const record = await prisma.homepageSection.findUnique({
        where: { id: "footer_contact" },
      });
      const settings = JSON.parse(record?.settings || "{}");
      assert.equal(settings.email, null);
      assert.deepEqual(settings.phones, []);
      assert.equal(settings.address, null);

      // Verify reset audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          targetType: "FOOTER_CONTACT",
          action: "FOOTER_CONTACT_RESET",
        },
      });
      assert.ok(auditLog);
    });
  });
});
