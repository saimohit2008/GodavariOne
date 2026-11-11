import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { NextRequest } from "next/server";

// Configure isolated test database
const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});
(globalThis as any).prisma = prisma;

import { hashPassword, createSession } from "../src/lib/auth";
import { POST as publicChatHandler } from "../src/app/api/v1/ai/chat/route";
import { processUserMessage, detectIntent } from "../src/lib/ai/intent-engine";

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

describe("GODAVARI ONE — AI Assistant Accuracy, Grounding & Conversation Quality Suite", () => {
  const TEST_PREFIX = "776655";
  let adminUser: any;
  let adminSession: string;
  let visitorUser: any;
  let visitorSession: string;

  let publishedListingsCount = 0;
  let publishedRestaurantsCount = 0;
  let publishedHotelsCount = 0;
  let publishedGhatsCount = 0;

  before(async () => {
    // 1. Seed Super Admin
    adminUser = await prisma.user.create({
      data: {
        phone: `${TEST_PREFIX}0001`,
        email: `admin_acc_${Date.now()}@godavari.test`,
        name: "Accuracy Test Admin",
        role: "SUPER_ADMIN",
        passwordHash: hashPassword("AdminSecret123!"),
      },
    });
    const s1 = await createSession(adminUser.id, "PASSWORD");
    adminSession = s1.token;

    // 2. Seed Visitor
    visitorUser = await prisma.user.create({
      data: {
        phone: `${TEST_PREFIX}0002`,
        email: `visitor_acc_${Date.now()}@godavari.test`,
        name: "Accuracy Test Visitor",
        role: "VISITOR",
        passwordHash: hashPassword("VisitorSecret123!"),
      },
    });
    const s2 = await createSession(visitorUser.id, "PASSWORD");
    visitorSession = s2.token;

    // 3. Seed Business Owner
    await prisma.user.create({
      data: {
        phone: `${TEST_PREFIX}0003`,
        email: `owner_acc_${Date.now()}@godavari.test`,
        name: "Registered Business Owner",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("OwnerSecret123!"),
      },
    });

    // 4. Seed test listings with various categories and statuses
    // Published Restaurant
    await prisma.listing.create({
      data: {
        name: "Godavari Ruchulu Veg Restaurant",
        category: "RESTAURANT",
        description: "Pure vegetarian traditional meals.",
        address: "Pushkar Ghat Road, Rajahmundry",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
      },
    });

    // Published Hotel
    await prisma.listing.create({
      data: {
        name: "Riverview Pushkar Residency",
        category: "HOTEL",
        description: "Comfortable hotel stay.",
        address: "River Road, Rajahmundry",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
      },
    });

    // Published Ghat
    await prisma.listing.create({
      data: {
        name: "Saraswati Sacred Pushkar Ghat",
        category: "GHAT",
        description: "Sacred bathing ghat.",
        address: "Ghat Area, Rajahmundry",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
        ghatDetails: {
          create: {
            currentCrowdStatus: "FREE",
          },
        },
      },
    });

    // Pending Approval Listing
    await prisma.listing.create({
      data: {
        name: "Pending Verification Lodge",
        category: "HOTEL",
        description: "Pending verification by administrator.",
        address: "Subhash Road, Rajahmundry",
        town: "Rajahmundry",
        publicationStatus: "PENDING",
      },
    });

    // Record baseline database counts
    publishedListingsCount = await prisma.listing.count({ where: { publicationStatus: "PUBLISHED" } });
    publishedRestaurantsCount = await prisma.listing.count({ where: { category: "RESTAURANT", publicationStatus: "PUBLISHED" } });
    publishedHotelsCount = await prisma.listing.count({ where: { category: "HOTEL", publicationStatus: "PUBLISHED" } });
    publishedGhatsCount = await prisma.listing.count({ where: { category: "GHAT", publicationStatus: "PUBLISHED" } });
  });

  after(async () => {
    // Teardown
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: TEST_PREFIX } } } });
    await prisma.listing.deleteMany({
      where: {
        name: {
          in: [
            "Godavari Ruchulu Veg Restaurant",
            "Riverview Pushkar Residency",
            "Saraswati Sacred Pushkar Ghat",
            "Pending Verification Lodge",
          ],
        },
      },
    });
    await prisma.user.deleteMany({ where: { phone: { startsWith: TEST_PREFIX } } });
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // 1. Initial greeting appears only once
  // -------------------------------------------------------------------------
  it("1. Initial greeting appears only once and is not prepended to direct answers", async () => {
    const res = await processUserMessage("How many business listings are currently registered in Godavari One?", {
      language: "en",
    });

    assert.ok(res.reply.length > 0);
    // Does NOT start with generic welcome message
    assert.ok(!res.reply.startsWith("Namaskaram! Welcome to Godavari One. I am your intelligent guide"));
    // Directly answers with the count
    assert.match(res.reply, /^Godavari One currently has \d+ business listings in its database/);
  });

  // -------------------------------------------------------------------------
  // 2. Subsequent messages do not repeat the greeting
  // -------------------------------------------------------------------------
  it("2. Subsequent messages in active conversation do not repeat the greeting", async () => {
    const conversationId = `conv_test_${Date.now()}`;

    // First user turn
    const turn1 = await processUserMessage("Find hotels in Rajahmundry", {
      conversationId,
      language: "en",
      messages: [],
    });

    // Second user turn with conversation history
    const turn2 = await processUserMessage("Which of those has rooms?", {
      conversationId,
      language: "en",
      messages: [
        { role: "user", content: "Find hotels in Rajahmundry" },
        { role: "assistant", content: turn1.reply },
      ],
    });

    // Verify turn 2 does NOT start with greeting
    assert.ok(!turn2.reply.startsWith("Namaskaram! Welcome to Godavari One"));
    assert.ok(!turn2.reply.startsWith("Namaskaram! I am your"));
  });

  // -------------------------------------------------------------------------
  // 3. Conversation history is preserved
  // -------------------------------------------------------------------------
  it("3. Conversation history and conversationId are preserved during active chat", async () => {
    const conversationId = `conv_history_${Date.now()}`;

    const req = createReq("POST", "/api/v1/ai/chat", undefined, {
      message: "Are there vegetarian meals available?",
      conversationId,
      language: "en",
      messages: [
        { role: "user", content: "Where can I eat in Rajahmundry?" },
        { role: "assistant", content: "We have verified pure vegetarian restaurants in Rajahmundry." },
      ],
    });

    const res = await publicChatHandler(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.conversationId, conversationId, "Conversation ID must be preserved");
    assert.ok(data.reply.length > 0);
  });

  // -------------------------------------------------------------------------
  // 4. Business listing count matches the database
  // -------------------------------------------------------------------------
  it("4. Business listing count matches the database and explains included statuses", async () => {
    const actualCount = await prisma.listing.count({ where: { publicationStatus: "PUBLISHED" } });

    const res = await processUserMessage("How many business listings are currently registered in Godavari One?", {
      language: "en",
    });

    // Check exact answer template
    const expectedPrefix = `Godavari One currently has ${actualCount} business listings in its database.`;
    assert.ok(
      res.reply.includes(expectedPrefix),
      `Reply must contain '${expectedPrefix}'. Got: ${res.reply}`
    );
    assert.match(res.reply, /This count includes/i, "Must explain included statuses");
    assert.match(res.reply, /PUBLISHED/i, "Must specify PUBLISHED status");
  });

  // -------------------------------------------------------------------------
  // 5. Category counts match the database
  // -------------------------------------------------------------------------
  it("5. Category counts match actual database counts for restaurants, hotels, ghats, and breakdown", async () => {
    // Restaurants
    const resRest = await processUserMessage("How many restaurants are registered?", { language: "en" });
    const currentRestaurants = await prisma.listing.count({ where: { category: "RESTAURANT", publicationStatus: "PUBLISHED" } });
    assert.ok(
      resRest.reply.includes(`Godavari One currently has ${currentRestaurants} restaurants & dining registered in its database`) ||
      resRest.reply.includes(`${currentRestaurants}`),
      `Restaurant count must match DB (${currentRestaurants}). Got: ${resRest.reply}`
    );

    // Hotels
    const resHotels = await processUserMessage("How many hotels are registered?", { language: "en" });
    const currentHotels = await prisma.listing.count({ where: { category: "HOTEL", publicationStatus: "PUBLISHED" } });
    assert.ok(
      resHotels.reply.includes(`${currentHotels}`),
      `Hotel count must match DB (${currentHotels}). Got: ${resHotels.reply}`
    );

    // Ghats
    const resGhats = await processUserMessage("How many ghats are available?", { language: "en" });
    const currentGhats = await prisma.listing.count({ where: { category: "GHAT", publicationStatus: "PUBLISHED" } });
    assert.ok(
      resGhats.reply.includes(`${currentGhats}`),
      `Ghat count must match DB (${currentGhats}). Got: ${resGhats.reply}`
    );

    // Category breakdown
    const resBreakdown = await processUserMessage("How many records are available in each category?", { language: "en" });
    assert.match(resBreakdown.reply, /Restaurants & Dining/i);
    assert.match(resBreakdown.reply, /Hotels & Lodges/i);
    assert.match(resBreakdown.reply, /Pushkar Bathing Ghats/i);
    assert.match(resBreakdown.reply, /This count includes PUBLISHED/i);
  });

  // -------------------------------------------------------------------------
  // 6. Unrelated category suggestions are not returned (NO "Browse TRANSPORT")
  // -------------------------------------------------------------------------
  it("6. Unrelated category suggestions like 'Browse TRANSPORT' are not returned for listing count questions", async () => {
    // Word "business" must not trigger "bus" transport classification
    const intent = detectIntent("How many business listings are currently registered in Godavari One?");
    assert.equal(intent.isDatabaseQuery, true, "Must be classified as database query");
    assert.notEqual(intent.category, "TRANSPORT", "Word 'business' must not be classified as TRANSPORT category");

    const res = await processUserMessage("How many business listings are currently registered in Godavari One?", {
      language: "en",
    });

    // Verification: NO suggestedActions with Browse TRANSPORT
    const hasTransportAction = res.suggestedActions.some(
      (a) => a.label?.toLowerCase().includes("transport") || (a.payload as any)?.category === "TRANSPORT"
    );
    assert.equal(hasTransportAction, false, "Must NOT return Browse TRANSPORT suggested action");
    assert.equal(res.suggestedActions.length, 0, "Database query should not return navigation category buttons");
  });

  // -------------------------------------------------------------------------
  // 7. Unavailable information is handled honestly
  // -------------------------------------------------------------------------
  it("7. Unavailable external information (e.g. flight tickets) is handled honestly without hallucination", async () => {
    const res = await processUserMessage("How many flight tickets are booked for Pushkaralu?", {
      language: "en",
    });

    assert.match(res.reply, /This information is not available in the current Godavari One database/i);
    assert.match(res.reply, /airline portals/i);
  });

  // -------------------------------------------------------------------------
  // 8. Telugu and English responses work
  // -------------------------------------------------------------------------
  it("8. Telugu and English responses both produce grounded accurate database answers", async () => {
    const actualCount = await prisma.listing.count({ where: { publicationStatus: "PUBLISHED" } });

    // Telugu query
    const resTe = await processUserMessage("గోదావరి వన్ లో ఎన్ని వ్యాపార లిస్టింగ్‌లు ఉన్నాయి?", {
      language: "te",
    });

    assert.equal(resTe.language, "te");
    assert.ok(/[\u0C00-\u0C7F]/.test(resTe.reply), "Telugu response must contain Telugu script");
    assert.ok(resTe.reply.includes(String(actualCount)), "Telugu response must include exact count");
    assert.match(resTe.reply, /వ్యాపార లిస్టింగ్‌లు/u);
  });

  // -------------------------------------------------------------------------
  // 9. API failures produce understandable error messages
  // -------------------------------------------------------------------------
  it("9. Invalid or empty requests produce understandable JSON error messages with status 400", async () => {
    const req = createReq("POST", "/api/v1/ai/chat", undefined, {
      message: "   ", // Blank message
    });

    const res = await publicChatHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Message is required and must be a non-empty string/i);
  });

  // -------------------------------------------------------------------------
  // 10. Unauthorized users cannot access protected operational data
  // -------------------------------------------------------------------------
  it("10. Unauthorized users cannot access protected operational data while authorized admins can", async () => {
    // 10a. Ordinary visitor asks for pending listings approval
    const visitorRes = await processUserMessage("How many listings are pending approval?", {
      userRole: "VISITOR",
      language: "en",
    });
    assert.match(visitorRes.reply, /Access to internal administrative operational data/i);
    assert.match(visitorRes.reply, /requires authorized administrator sign-in/i);

    // 10b. Super Admin asks for pending listings approval
    const pendingCount = await prisma.listing.count({ where: { publicationStatus: "PENDING" } });
    const adminRes = await processUserMessage("How many listings are pending approval?", {
      userRole: "SUPER_ADMIN",
      language: "en",
    });
    assert.ok(
      adminRes.reply.includes(`There are currently ${pendingCount} business listings pending approval in the administrative review queue`),
      `Admin must receive exact pending count (${pendingCount}). Got: ${adminRes.reply}`
    );

    // 10c. Ordinary visitor asks for registered business owners
    const visitorOwnerRes = await processUserMessage("How many business owners are registered?", {
      userRole: "VISITOR",
      language: "en",
    });
    assert.match(visitorOwnerRes.reply, /Access to user account registries and administrative data is restricted/i);

    // 10d. Super Admin asks for registered business owners
    const ownerCount = await prisma.user.count({ where: { role: "BUSINESS_OWNER", status: "ACTIVE" } });
    const adminOwnerRes = await processUserMessage("How many business owners are registered?", {
      userRole: "SUPER_ADMIN",
      language: "en",
    });
    assert.ok(
      adminOwnerRes.reply.includes(`Godavari One currently has ${ownerCount} business owners registered in its database`),
      `Admin must receive exact business owners count (${ownerCount}). Got: ${adminOwnerRes.reply}`
    );
  });
});
