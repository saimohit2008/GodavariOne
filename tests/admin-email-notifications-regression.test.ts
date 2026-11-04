import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

// 1. Configure isolated test database (guaranteeing no touch to production database)
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.RESEND_API_KEY = "re_test_mock_api_key_123456789";
process.env.CRON_SECRET = "test-cron-secret-regression-123";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession } from "../src/lib/auth";
import { GET as getAdminNotifications } from "../src/app/api/v1/admin/notifications/route";
import { POST as runCronWorker } from "../src/app/api/v1/notifications/cron/route";

function createReq(method: string, url: string, sessionToken?: string, headersInit?: Record<string, string>, body?: any): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...headersInit,
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

// Reproduction of safeNumber and normalizeStats helpers from AdminEmailNotificationsPanel
const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const DEFAULT_STATS = Object.freeze({
  total: 0,
  sent: 0,
  pending: 0,
  processing: 0,
  failed: 0,
  cancelled: 0,
});

const normalizeStats = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_STATS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    total: safeNumber(obj.total, 0),
    sent: safeNumber(obj.sent, 0),
    pending: safeNumber(obj.pending, 0),
    processing: safeNumber(obj.processing, 0),
    failed: safeNumber(obj.failed, 0),
    cancelled: safeNumber(obj.cancelled, 0),
  };
};

describe("GODAVARI ONE — Admin Email Notifications Regression Verification Suite", () => {
  let superAdminUser: any;
  let adminSessionToken: string;
  let visitorUser: any;
  let visitorSessionToken: string;
  const createdNotificationIds: string[] = [];

  before(async () => {
    const passwordHash = await hashPassword("RegressionPass123!");

    // Clean up any stale regression users
    const testPhones = ["91999990001", "91999990002"];
    const existing = await prisma.user.findMany({ where: { phone: { in: testPhones } }, select: { id: true } });
    if (existing.length > 0) {
      const ids = existing.map((u) => u.id);
      await prisma.emailNotification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }

    // 1. Create authenticated SUPER_ADMIN user & session
    superAdminUser = await prisma.user.create({
      data: {
        phone: "91999990001",
        email: "superadmin.regression@godavari-one.org",
        name: "Super Admin Regression Officer",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash,
        emailVerified: true,
      },
    });
    const adminSession = await createSession(superAdminUser.id, "PASSWORD");
    adminSessionToken = adminSession.token;

    // 2. Create authenticated VISITOR user & session
    visitorUser = await prisma.user.create({
      data: {
        phone: "91999990002",
        email: "visitor.regression@godavari-one.org",
        name: "Standard Visitor",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash,
        emailVerified: true,
      },
    });
    const visitorSession = await createSession(visitorUser.id, "PASSWORD");
    visitorSessionToken = visitorSession.token;

    // 3. Seed exact notifications for the 6 statuses:
    // 3 SENT, 2 PENDING, 1 PROCESSING, 2 FAILED, 1 CANCELLED -> Total 9
    const testItems = [
      { status: "SENT", count: 3, event: "BOOKING_SUCCESSFUL" },
      { status: "PENDING", count: 2, event: "BOOKING_REMINDER_24H" },
      { status: "PROCESSING", count: 1, event: "BOOKING_APPROVED" },
      { status: "FAILED", count: 2, event: "BOOKING_CANCELLED" },
      { status: "CANCELLED", count: 1, event: "BOOKING_REMINDER_2H" },
    ];

    for (const group of testItems) {
      for (let i = 0; i < group.count; i++) {
        const item = await prisma.emailNotification.create({
          data: {
            idempotencyKey: `reg-idem-${group.status.toLowerCase()}-${i}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
            user: { connect: { id: visitorUser.id } },
            recipientEmail: `reg_${group.status.toLowerCase()}_${i}@test.com`,
            recipientName: `Reg User ${group.status} ${i}`,
            eventType: group.event,
            status: group.status,
            bookingCategory: "HOTEL",
            bookingReference: `REG-${group.status}-${i}`,
            subject: `Regression Test ${group.status} ${i}`,
            payload: JSON.stringify({ index: i }),
            attemptCount: group.status === "FAILED" ? 3 : group.status === "SENT" ? 1 : 0,
            maxAttempts: 3,
            lastError: group.status === "FAILED" ? "Simulated downstream rejection" : null,
          },
        });
        createdNotificationIds.push(item.id);
      }
    }
  });

  after(async () => {
    if (createdNotificationIds.length > 0) {
      await prisma.emailNotification.deleteMany({ where: { id: { in: createdNotificationIds } } });
    }
    if (superAdminUser?.id) {
      await prisma.session.deleteMany({ where: { userId: superAdminUser.id } });
      await prisma.user.delete({ where: { id: superAdminUser.id } });
    }
    if (visitorUser?.id) {
      await prisma.session.deleteMany({ where: { userId: visitorUser.id } });
      await prisma.user.delete({ where: { id: visitorUser.id } });
    }
  });

  // --------------------------------------------------------------------------
  // Check 1: Authenticated admin access to notifications API
  // --------------------------------------------------------------------------
  describe("Check 1: Authenticated admin access to notifications API", () => {
    it("rejects unauthenticated requests with HTTP 403", async () => {
      const req = createReq("GET", "/api/v1/admin/notifications");
      const res = await getAdminNotifications(req);
      assert.strictEqual(res.status, 403, "Unauthenticated request must be denied with 403");
      const body = await res.json();
      assert.ok(body.error?.includes("System Administrator permissions required"));
    });

    it("rejects non-admin authenticated users (VISITOR) with HTTP 403", async () => {
      const req = createReq("GET", "/api/v1/admin/notifications", visitorSessionToken);
      const res = await getAdminNotifications(req);
      assert.strictEqual(res.status, 403, "Non-admin authenticated user must be denied with 403");
      const body = await res.json();
      assert.ok(body.error?.includes("System Administrator permissions required"));
    });

    it("authorizes valid SUPER_ADMIN session with HTTP 200", async () => {
      const req = createReq("GET", "/api/v1/admin/notifications", adminSessionToken);
      const res = await getAdminNotifications(req);
      assert.strictEqual(res.status, 200, "Super admin session must be granted 200");
      const body = await res.json();
      assert.strictEqual(body.ok, true);
      assert.ok(Array.isArray(body.items));
      assert.ok(body.stats);
      assert.ok(body.pagination);
    });
  });

  // --------------------------------------------------------------------------
  // Check 2: All six notification statistics
  // --------------------------------------------------------------------------
  describe("Check 2: All six notification statistics: total, sent, pending, processing, failed, cancelled", () => {
    it("returns all six statistics as defined, non-negative finite numbers", async () => {
      const req = createReq("GET", "/api/v1/admin/notifications?search=REG-", adminSessionToken);
      const res = await getAdminNotifications(req);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const stats = body.stats;

      assert.ok(stats, "Stats object must be returned");
      assert.strictEqual(typeof stats.total, "number", "stats.total must be a number");
      assert.strictEqual(typeof stats.sent, "number", "stats.sent must be a number");
      assert.strictEqual(typeof stats.pending, "number", "stats.pending must be a number");
      assert.strictEqual(typeof stats.processing, "number", "stats.processing must be a number");
      assert.strictEqual(typeof stats.failed, "number", "stats.failed must be a number");
      assert.strictEqual(typeof stats.cancelled, "number", "stats.cancelled must be a number");

      // Verify exact counts match what was seeded
      assert.strictEqual(stats.total, 9, "Total notifications should be 9");
      assert.strictEqual(stats.sent, 3, "Sent notifications should be 3");
      assert.strictEqual(stats.pending, 2, "Pending notifications should be 2");
      assert.strictEqual(stats.processing, 1, "Processing notifications should be 1");
      assert.strictEqual(stats.failed, 2, "Failed notifications should be 2");
      assert.strictEqual(stats.cancelled, 1, "Cancelled notifications should be 1");

      // Verify arithmetic equality: total = sent + pending + processing + failed + cancelled
      const sum = stats.sent + stats.pending + stats.processing + stats.failed + stats.cancelled;
      assert.strictEqual(sum, stats.total, "Sum of all 5 status counts must equal stats.total");

      // Verify the critical UI expression {safeNumber(stats.pending) + safeNumber(stats.processing)}
      const uiPendingScheduled = safeNumber(stats.pending) + safeNumber(stats.processing);
      assert.strictEqual(uiPendingScheduled, 3, "Pending + Processing KPI must equal 3");
      assert.strictEqual(Number.isNaN(uiPendingScheduled), false, "Must not be NaN");
      assert.strictEqual(Number.isFinite(uiPendingScheduled), true, "Must be finite");
    });
  });

  // --------------------------------------------------------------------------
  // Check 3: Correct handling of zero notifications
  // --------------------------------------------------------------------------
  describe("Check 3: Correct handling of zero notifications", () => {
    it("handles zero matching records with safe zero stats and empty items array", async () => {
      const nonExistentSearch = "NON_EXISTENT_GUID_99999999_ZERO_RESULTS";
      const req = createReq("GET", `/api/v1/admin/notifications?search=${nonExistentSearch}`, adminSessionToken);
      const res = await getAdminNotifications(req);
      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.ok, true);
      assert.ok(Array.isArray(body.items));
      assert.strictEqual(body.items.length, 0, "Items array must be empty []");

      const stats = body.stats;
      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.sent, 0);
      assert.strictEqual(stats.pending, 0);
      assert.strictEqual(stats.processing, 0);
      assert.strictEqual(stats.failed, 0);
      assert.strictEqual(stats.cancelled, 0);

      // Verify KPI arithmetic when all stats are 0
      const uiPendingScheduled = safeNumber(stats.pending) + safeNumber(stats.processing);
      assert.strictEqual(uiPendingScheduled, 0, "Pending + Processing KPI must be exactly 0 for zero records");
      assert.strictEqual(Number.isNaN(uiPendingScheduled), false);

      // Pagination with 0 results defaults totalPages to 1
      assert.strictEqual(body.pagination.total, 0);
      assert.strictEqual(body.pagination.totalPages, 1);
    });
  });

  // --------------------------------------------------------------------------
  // Check 4: Correct handling of missing or malformed statistics
  // --------------------------------------------------------------------------
  describe("Check 4: Correct handling of missing or malformed statistics", () => {
    it("safeNumber returns fallback (0) for undefined, null, NaN, strings, and non-finites", () => {
      assert.strictEqual(safeNumber(undefined), 0);
      assert.strictEqual(safeNumber(null), 0);
      assert.strictEqual(safeNumber(NaN), 0);
      assert.strictEqual(safeNumber(Infinity), 0);
      assert.strictEqual(safeNumber(-Infinity), 0);
      assert.strictEqual(safeNumber(""), 0);
      assert.strictEqual(safeNumber("   "), 0);
      assert.strictEqual(safeNumber("not_a_number"), 0);
      assert.strictEqual(safeNumber({}), 0);
      assert.strictEqual(safeNumber([]), 0);
      // Valid conversions
      assert.strictEqual(safeNumber(42), 42);
      assert.strictEqual(safeNumber("42"), 42);
      assert.strictEqual(safeNumber(0), 0);
      assert.strictEqual(safeNumber("0"), 0);
    });

    it("normalizeStats handles null, undefined, partial, or malformed API payloads without NaN", () => {
      // 1. null / undefined / empty object
      const fromNull = normalizeStats(null);
      assert.deepStrictEqual(fromNull, DEFAULT_STATS);
      assert.strictEqual(safeNumber(fromNull.pending) + safeNumber(fromNull.processing), 0);

      const fromUndef = normalizeStats(undefined);
      assert.deepStrictEqual(fromUndef, DEFAULT_STATS);

      const fromEmpty = normalizeStats({});
      assert.deepStrictEqual(fromEmpty, DEFAULT_STATS);

      // 2. Partial payload omitting 'processing' (the original regression trigger)
      const partialWithoutProcessing = normalizeStats({
        total: 10,
        sent: 5,
        pending: 3,
        failed: 2,
        cancelled: 0,
      });
      assert.strictEqual(partialWithoutProcessing.total, 10);
      assert.strictEqual(partialWithoutProcessing.sent, 5);
      assert.strictEqual(partialWithoutProcessing.pending, 3);
      assert.strictEqual(partialWithoutProcessing.processing, 0); // Normalized to safe 0!
      assert.strictEqual(partialWithoutProcessing.failed, 2);
      assert.strictEqual(partialWithoutProcessing.cancelled, 0);

      // Evaluating pending + processing on partial payload
      const sum = safeNumber(partialWithoutProcessing.pending) + safeNumber(partialWithoutProcessing.processing);
      assert.strictEqual(sum, 3);
      assert.strictEqual(Number.isNaN(sum), false, "Must never evaluate to NaN");

      // 3. String & malformed values in payload
      const malformed = normalizeStats({
        total: "25",
        sent: 10,
        pending: "invalid",
        processing: null,
        failed: NaN,
        cancelled: "5",
      });
      assert.strictEqual(malformed.total, 25);
      assert.strictEqual(malformed.sent, 10);
      assert.strictEqual(malformed.pending, 0);
      assert.strictEqual(malformed.processing, 0);
      assert.strictEqual(malformed.failed, 0);
      assert.strictEqual(malformed.cancelled, 5);
      assert.strictEqual(safeNumber(malformed.pending) + safeNumber(malformed.processing), 0);
    });
  });

  // --------------------------------------------------------------------------
  // Check 5: Pagination and notification listing
  // --------------------------------------------------------------------------
  describe("Check 5: Pagination and notification listing", () => {
    it("paginates notifications with correct limit, page, and totalPages metadata", async () => {
      // Page 1, limit 4 out of 9 seeded records
      const req1 = createReq("GET", "/api/v1/admin/notifications?search=REG-&page=1&limit=4", adminSessionToken);
      const res1 = await getAdminNotifications(req1);
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();

      assert.strictEqual(data1.items.length, 4, "Page 1 should have 4 items");
      assert.strictEqual(data1.pagination.page, 1);
      assert.strictEqual(data1.pagination.limit, 4);
      assert.strictEqual(data1.pagination.total, 9);
      assert.strictEqual(data1.pagination.totalPages, 3); // ceil(9/4) = 3

      // Page 2, limit 4
      const req2 = createReq("GET", "/api/v1/admin/notifications?search=REG-&page=2&limit=4", adminSessionToken);
      const res2 = await getAdminNotifications(req2);
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();

      assert.strictEqual(data2.items.length, 4, "Page 2 should have 4 items");
      assert.strictEqual(data2.pagination.page, 2);

      // Verify items are disjoint between page 1 and page 2
      const idsPage1 = new Set(data1.items.map((i: any) => i.id));
      for (const item of data2.items) {
        assert.strictEqual(idsPage1.has(item.id), false, "Page 2 items must not overlap with Page 1");
      }

      // Page 3, limit 4 -> remaining 1 item
      const req3 = createReq("GET", "/api/v1/admin/notifications?search=REG-&page=3&limit=4", adminSessionToken);
      const res3 = await getAdminNotifications(req3);
      const data3 = await res3.json();
      assert.strictEqual(data3.items.length, 1, "Page 3 should have remaining 1 item");

      // Verify item fields integrity
      const sampleItem = data1.items[0];
      assert.ok(sampleItem.id);
      assert.ok(sampleItem.recipientEmail);
      assert.ok(sampleItem.recipientName);
      assert.ok(sampleItem.eventType);
      assert.ok(sampleItem.status);
      assert.strictEqual(typeof sampleItem.attemptCount, "number");
      assert.strictEqual(typeof sampleItem.maxAttempts, "number");
      assert.ok(sampleItem.createdAt);
      assert.ok(sampleItem.userName, "userName must be resolved from user relation or recipientName");
    });
  });

  // --------------------------------------------------------------------------
  // Check 6: Notification status filters
  // --------------------------------------------------------------------------
  describe("Check 6: Notification status filters", () => {
    const statuses = [
      { status: "SENT", expectedCount: 3 },
      { status: "PENDING", expectedCount: 2 },
      { status: "PROCESSING", expectedCount: 1 },
      { status: "FAILED", expectedCount: 2 },
      { status: "CANCELLED", expectedCount: 1 },
    ];

    for (const s of statuses) {
      it(`filters by status=${s.status} and returns only matching records`, async () => {
        const req = createReq("GET", `/api/v1/admin/notifications?search=REG-&status=${s.status}`, adminSessionToken);
        const res = await getAdminNotifications(req);
        assert.strictEqual(res.status, 200);
        const data = await res.json();

        assert.strictEqual(data.items.length, s.expectedCount, `Expected ${s.expectedCount} records for status ${s.status}`);
        for (const item of data.items) {
          assert.strictEqual(item.status, s.status, `Item status must be ${s.status}`);
        }
      });
    }

    it("filters with status=ALL and returns all statuses", async () => {
      const req = createReq("GET", "/api/v1/admin/notifications?search=REG-&status=ALL", adminSessionToken);
      const res = await getAdminNotifications(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.items.length, 9);
    });
  });

  // --------------------------------------------------------------------------
  // Check 7: Cron trigger functionality
  // --------------------------------------------------------------------------
  describe("Check 7: Cron trigger functionality", () => {
    it("allows authenticated SUPER_ADMIN session to trigger cron worker via POST", async () => {
      const req = createReq("POST", "/api/v1/notifications/cron", adminSessionToken);
      const res = await runCronWorker(req);
      assert.strictEqual(res.status, 200, "Authenticated admin should trigger cron with 200");
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.message, "Outbox processing complete");
      assert.ok(typeof data.processed === "number" || typeof data.result?.processed === "number" || data.processed !== undefined);
    });

    it("allows CRON_SECRET header authorization to trigger cron worker", async () => {
      const req = createReq("POST", "/api/v1/notifications/cron", undefined, {
        "x-cron-secret": "test-cron-secret-regression-123",
      });
      const res = await runCronWorker(req);
      assert.strictEqual(res.status, 200, "CRON_SECRET should trigger cron with 200");
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.message, "Outbox processing complete");
    });
  });
});
