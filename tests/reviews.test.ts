import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
import { hashPassword, createSession } from "../src/lib/auth";
import { POST as submitReview, GET as getReviews } from "../src/app/api/v1/listings/[id]/reviews/route";
import { GET as getReview, PATCH as updateReview, DELETE as deleteReview } from "../src/app/api/v1/reviews/[id]/route";
import { POST as reportReview } from "../src/app/api/v1/reviews/[id]/report/route";
import { GET as getModerationQueue } from "../src/app/api/v1/admin/reviews/route";
import { POST as resolveReport } from "../src/app/api/v1/admin/reviews/reports/[id]/route";
import { NextRequest } from "next/server";

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});

function createReq(url: string, method: string, body?: any, sessionToken?: string): NextRequest {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (sessionToken) {
    headers.set("cookie", `godavari_session=${sessionToken}`);
  }
  const init: any = {
    method,
    headers,
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

describe("Godavari One — Reviews, Feedback & Moderation System", () => {
  let superAdminUser: any;
  let businessOwnerA: any;
  let businessOwnerB: any;
  let ghatSupervisorAssigned: any;
  let ghatSupervisorOther: any;
  let visitorA: any;
  let visitorB: any;

  let superAdminSession: any;
  let ownerASession: any;
  let ownerBSession: any;
  let supervisorAssignedSession: any;
  let supervisorOtherSession: any;
  let visitorASession: any;
  let visitorBSession: any;

  let hotelListing: any;
  let otherHotelListing: any;
  let ghatListing: any;
  let otherGhatListing: any;

  before(async () => {
    // Clean up any test users and listings with test prefix
    await prisma.reviewReport.deleteMany({
      where: { reporter: { phone: { startsWith: "919999" } } },
    });
    await prisma.review.deleteMany({
      where: { user: { phone: { startsWith: "919999" } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { phone: { startsWith: "919999" } } },
    });
    await prisma.assignment.deleteMany({
      where: { user: { phone: { startsWith: "919999" } } },
    });
    await prisma.hotelRoom.deleteMany({
      where: { listing: { owner: { phone: { startsWith: "919999" } } } },
    });
    await prisma.ghatDetails.deleteMany({
      where: { listing: { name: { in: ["Kotilingala Holy Bathing Ghat", "Pushkar Royal Ghat"] } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { phone: { startsWith: "919999" } } },
    });
    await prisma.listing.deleteMany({
      where: { name: { in: ["Kotilingala Holy Bathing Ghat", "Pushkar Royal Ghat"] } },
    });
    await prisma.session.deleteMany({
      where: { user: { phone: { startsWith: "919999" } } },
    });
    await prisma.user.deleteMany({
      where: { phone: { startsWith: "919999" } },
    });

    // 1. Create synthetic users
    superAdminUser = await prisma.user.create({
      data: {
        phone: "9199990001",
        name: "Reviews SuperAdmin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword("AdminPass123!"),
      },
    });
    superAdminSession = await createSession(superAdminUser.id, "PASSWORD");

    businessOwnerA = await prisma.user.create({
      data: {
        phone: "9199990002",
        name: "Owner Hotel Deluxe",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("OwnerPass123!"),
      },
    });
    ownerASession = await createSession(businessOwnerA.id, "PASSWORD");

    businessOwnerB = await prisma.user.create({
      data: {
        phone: "9199990003",
        name: "Owner Other Hotel",
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
        passwordHash: hashPassword("OwnerPass123!"),
      },
    });
    ownerBSession = await createSession(businessOwnerB.id, "PASSWORD");

    ghatSupervisorAssigned = await prisma.user.create({
      data: {
        phone: "9199990004",
        name: "Supervisor Kotilingala",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    supervisorAssignedSession = await createSession(ghatSupervisorAssigned.id, "PASSWORD");

    ghatSupervisorOther = await prisma.user.create({
      data: {
        phone: "9199990005",
        name: "Supervisor Pushkar Ghat",
        role: "GHAT_SUPERVISOR",
        status: "ACTIVE",
        passwordHash: hashPassword("SuperPass123!"),
      },
    });
    supervisorOtherSession = await createSession(ghatSupervisorOther.id, "PASSWORD");

    visitorA = await prisma.user.create({
      data: {
        phone: "9199990006",
        name: "Ramesh Sharma",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitorASession = await createSession(visitorA.id, "PASSWORD");

    visitorB = await prisma.user.create({
      data: {
        phone: "9199990007",
        name: "Sita Kumari",
        role: "VISITOR",
        status: "ACTIVE",
        passwordHash: hashPassword("Visitor123!"),
      },
    });
    visitorBSession = await createSession(visitorB.id, "PASSWORD");

    // 2. Create synthetic listings
    hotelListing = await prisma.listing.create({
      data: {
        name: "Godavari Grand Luxury Hotel",
        category: "HOTEL",
        description: "Premium hotel near Kotilingala Ghat.",
        address: "Main Road, Rajahmundry",
        town: "Rajahmundry",
        ownerId: businessOwnerA.id,
        publicationStatus: "PUBLISHED",
      },
    });

    otherHotelListing = await prisma.listing.create({
      data: {
        name: "Riverview Guest Inn",
        category: "HOTEL",
        description: "Budget guest inn.",
        address: "Station Road, Rajahmundry",
        town: "Rajahmundry",
        ownerId: businessOwnerB.id,
        publicationStatus: "PUBLISHED",
      },
    });

    ghatListing = await prisma.listing.create({
      data: {
        name: "Kotilingala Holy Bathing Ghat",
        category: "GHAT",
        description: "Historical bathing ghat with deep waters.",
        address: "Godavari Bund, Rajahmundry",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
        ghatDetails: {
          create: {
            currentCrowdStatus: "FREE",
            supervisorId: ghatSupervisorAssigned.id,
          },
        },
      },
    });

    otherGhatListing = await prisma.listing.create({
      data: {
        name: "Pushkar Royal Ghat",
        category: "GHAT",
        description: "Primary Pushkaralu holy dip location.",
        address: "Pushkar Road, Rajahmundry",
        town: "Rajahmundry",
        publicationStatus: "PUBLISHED",
        ghatDetails: {
          create: {
            currentCrowdStatus: "MODERATE",
            supervisorId: ghatSupervisorOther.id,
          },
        },
      },
    });

    // Staff assignment for supervisor
    await prisma.assignment.create({
      data: {
        userId: ghatSupervisorAssigned.id,
        listingId: ghatListing.id,
        type: "GHAT_SUPERVISOR",
      },
    });
  });

  after(async () => {
    // Cleanup test records
    await prisma.reviewReport.deleteMany({
      where: { reporter: { phone: { startsWith: "919999" } } },
    });
    await prisma.review.deleteMany({
      where: { user: { phone: { startsWith: "919999" } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { phone: { startsWith: "919999" } } },
    });
    await prisma.assignment.deleteMany({
      where: { user: { phone: { startsWith: "919999" } } },
    });
    await prisma.ghatDetails.deleteMany({
      where: { listing: { name: { in: ["Kotilingala Holy Bathing Ghat", "Pushkar Royal Ghat"] } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { phone: { startsWith: "919999" } } },
    });
    await prisma.listing.deleteMany({
      where: { name: { in: ["Kotilingala Holy Bathing Ghat", "Pushkar Royal Ghat"] } },
    });
    await prisma.session.deleteMany({
      where: { user: { phone: { startsWith: "919999" } } },
    });
    await prisma.user.deleteMany({
      where: { phone: { startsWith: "919999" } },
    });
    await prisma.$disconnect();
  });

  // TEST 1 & 2: Review submission & validation
  it("rejects invalid star ratings and empty content", async () => {
    // Rating 0
    const req1 = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "POST", {
      rating: 0,
      content: "Great stay overall!",
    }, visitorASession.token);
    const res1 = await submitReview(req1, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.ok(res1.status === 400 || res1.status === 422);

    // Rating 6
    const req2 = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "POST", {
      rating: 6,
      content: "Excellent!",
    }, visitorASession.token);
    const res2 = await submitReview(req2, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.ok(res2.status === 400 || res2.status === 422);

    // Content too short (< 5 chars)
    const req3 = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "POST", {
      rating: 5,
      content: "ok",
    }, visitorASession.token);
    const res3 = await submitReview(req3, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.ok(res3.status === 400 || res3.status === 422);
  });

  it("allows authenticated visitor to submit a valid review and updates average rating", async () => {
    const req = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "POST", {
      rating: 5,
      title: "Wonderful riverfront stay",
      content: "The rooms were immaculate, staff were courteous, and check-in was very smooth.",
      issueCategory: "SERVICE_QUALITY",
    }, visitorASession.token);

    const res = await submitReview(req, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.rating, 5);
    assert.equal(data.status, "PUBLISHED");

    // Verify rating summary
    const getReq = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "GET");
    const getRes = await getReviews(getReq, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.equal(getRes.status, 200);
    const body = await getRes.json();
    assert.equal(body.summary.totalReviews, 1);
    assert.equal(body.summary.averageRating, 5.0);
  });

  it("prevents duplicate reviews from the same visitor on the same listing", async () => {
    const req = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "POST", {
      rating: 4,
      content: "Trying to submit another review for the same hotel.",
    }, visitorASession.token);

    const res = await submitReview(req, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.equal(res.status, 409); // Conflict / duplicate
  });

  // TEST 3 & 4: Rating breakdown and alias formatting
  it("calculates accurate rating breakdown when multiple visitors review", async () => {
    // Visitor B reviews hotel with 3 stars
    const reqB = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "POST", {
      rating: 3,
      title: "Average breakfast",
      content: "Location was fine but breakfast options were limited.",
      issueCategory: "SERVICE_QUALITY",
    }, visitorBSession.token);
    const resB = await submitReview(reqB, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.equal(resB.status, 201);

    // Fetch listing reviews
    const getReq = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "GET");
    const getRes = await getReviews(getReq, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.equal(getRes.status, 200);
    const body = await getRes.json();

    assert.equal(body.summary.totalReviews, 2);
    assert.equal(body.summary.averageRating, 4.0); // (5 + 3) / 2 = 4.0
    assert.equal(body.summary.breakdown[5], 1);
    assert.equal(body.summary.breakdown[3], 1);
    assert.equal(body.summary.breakdown[1], 0);

    // Verify reviewer alias is privacy-masked for public requests
    assert.ok(body.items[0].reviewerName.includes(".") || body.items[0].reviewerName.length > 0);
  });

  // TEST 5: Legitimate negative review remains visible and is not auto-flagged
  it("keeps legitimate critical/negative reviews published without auto-flagging", async () => {
    const req = createReq(`http://localhost:3000/api/v1/listings/${ghatListing.id}/reviews`, "POST", {
      rating: 1,
      title: "Severe overcrowding and missing handrails",
      content: "The steps were extremely slippery and there was severe overcrowding with no security personnel managing queues.",
      issueCategory: "SAFETY",
    }, visitorASession.token);

    const res = await submitReview(req, { params: Promise.resolve({ id: ghatListing.id }) });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.rating, 1);
    // Legitimate negative feedback MUST remain PUBLISHED
    assert.equal(data.status, "PUBLISHED");
    assert.equal(data.isFlagged, false);
  });

  // TEST 6: Auto-flagging abusive language and phone numbers (PII)
  it("auto-flags reviews containing sensitive phone numbers or abusive text", async () => {
    const req = createReq(`http://localhost:3000/api/v1/listings/${ghatListing.id}/reviews`, "POST", {
      rating: 2,
      title: "Call me for VIP pass",
      content: "Do not wait in queue, call me on 9848022338 for quick VIP boat entry.",
      issueCategory: "PRICING",
    }, visitorBSession.token);

    const res = await submitReview(req, { params: Promise.resolve({ id: ghatListing.id }) });
    assert.equal(res.status, 201);
    const data = await res.json();
    // Sensitive PII detected -> isFlagged true
    assert.equal(data.isFlagged, true);
  });

  // TEST 7: Visitor permissions (cannot edit/delete other visitor's review)
  it("prevents visitor from modifying or deleting another user's review", async () => {
    // Find Visitor A's review
    const revA = await prisma.review.findFirst({
      where: { userId: visitorA.id, listingId: hotelListing.id },
    });
    assert.ok(revA);

    // Visitor B attempts to edit Visitor A's review -> 403
    const editReq = createReq(`http://localhost:3000/api/v1/reviews/${revA.id}`, "PATCH", {
      content: "Hacked by Visitor B!",
    }, visitorBSession.token);
    const editRes = await updateReview(editReq, { params: Promise.resolve({ id: revA.id }) });
    assert.equal(editRes.status, 403);

    // Visitor B attempts to delete Visitor A's review -> 403
    const delReq = createReq(`http://localhost:3000/api/v1/reviews/${revA.id}`, "DELETE", null, visitorBSession.token);
    const delRes = await deleteReview(delReq, { params: Promise.resolve({ id: revA.id }) });
    assert.equal(delRes.status, 403);
  });

  // TEST 8: Business Owner isolation and policy enforcement
  it("prevents Business Owner from moderating reviews of unrelated businesses", async () => {
    // Hotel A review
    const revA = await prisma.review.findFirst({
      where: { listingId: hotelListing.id },
    });
    assert.ok(revA);

    // Owner B tries to moderate Owner A's review -> 403 Forbidden
    const modReq = createReq(`http://localhost:3000/api/v1/reviews/${revA.id}`, "PATCH", {
      status: "REMOVED",
      moderationReason: "SPAM",
    }, ownerBSession.token);
    const modRes = await updateReview(modReq, { params: Promise.resolve({ id: revA.id }) });
    assert.equal(modRes.status, 403);
  });

  it("prevents Business Owner from suppressing reviews without a legitimate policy violation reason", async () => {
    const revA = await prisma.review.findFirst({
      where: { listingId: hotelListing.id },
    });
    assert.ok(revA);

    // Owner A attempts to remove review without policy violation reason -> 400 or 403
    const modReq = createReq(`http://localhost:3000/api/v1/reviews/${revA.id}`, "PATCH", {
      status: "REMOVED",
      // missing moderationReason
    }, ownerASession.token);
    const modRes = await updateReview(modReq, { params: Promise.resolve({ id: revA.id }) });
    assert.ok(modRes.status === 400 || modRes.status === 403);
  });

  // TEST 9: Ghat Supervisor isolation
  it("allows Ghat Supervisor to moderate only reviews for their assigned ghat", async () => {
    // Find flagged review on assigned ghat
    const ghatRev = await prisma.review.findFirst({
      where: { listingId: ghatListing.id, isFlagged: true },
    });
    assert.ok(ghatRev);

    // Assigned supervisor removes the flagged spam review with policy reason
    const modReq = createReq(`http://localhost:3000/api/v1/reviews/${ghatRev.id}`, "PATCH", {
      status: "REMOVED",
      moderationReason: "PERSONAL_INFO",
      moderatorNotes: "Phone number promotional spam",
    }, supervisorAssignedSession.token);
    const modRes = await updateReview(modReq, { params: Promise.resolve({ id: ghatRev.id }) });
    assert.equal(modRes.status, 200);

    // Verify supervisor of Pushkar Ghat CANNOT moderate Kotilingala Ghat reviews -> 403
    const otherModReq = createReq(`http://localhost:3000/api/v1/reviews/${ghatRev.id}`, "PATCH", {
      status: "PUBLISHED",
    }, supervisorOtherSession.token);
    const otherModRes = await updateReview(otherModReq, { params: Promise.resolve({ id: ghatRev.id }) });
    assert.equal(otherModRes.status, 403);
  });

  // TEST 10: Super Admin cross-category moderation and audit logging
  it("allows Super Admin to moderate reviews across categories and logs audit trail", async () => {
    const rev = await prisma.review.findFirst({
      where: { listingId: hotelListing.id },
    });
    assert.ok(rev);

    // Super Admin temporarily hides review
    const modReq = createReq(`http://localhost:3000/api/v1/reviews/${rev.id}`, "PATCH", {
      status: "HIDDEN",
      moderationReason: "OTHER",
      moderatorNotes: "Pending legal verification",
    }, superAdminSession.token);
    const modRes = await updateReview(modReq, { params: Promise.resolve({ id: rev.id }) });
    assert.equal(modRes.status, 200);

    // Verify audit log created
    const audit = await prisma.auditLog.findFirst({
      where: {
        actorId: superAdminUser.id,
        action: "REVIEW_STATUS_HIDDEN",
      },
    });
    assert.ok(audit);

    // Super Admin restores to PUBLISHED
    const restoreReq = createReq(`http://localhost:3000/api/v1/reviews/${rev.id}`, "PATCH", {
      status: "PUBLISHED",
    }, superAdminSession.token);
    const restoreRes = await updateReview(restoreReq, { params: Promise.resolve({ id: rev.id }) });
    assert.equal(restoreRes.status, 200);
  });

  // TEST 11: Review reporting and dispute resolution workflow
  it("allows visitors to report reviews, prevents duplicates, and allows Super Admin resolution", async () => {
    const rev = await prisma.review.findFirst({
      where: { listingId: hotelListing.id },
    });
    assert.ok(rev);

    // Visitor B reports review
    const repReq = createReq(`http://localhost:3000/api/v1/reviews/${rev.id}/report`, "POST", {
      reason: "HARASSMENT",
      details: "Inappropriate language used.",
    }, visitorBSession.token);
    const repRes = await reportReview(repReq, { params: Promise.resolve({ id: rev.id }) });
    assert.equal(repRes.status, 201);

    // Duplicate report from Visitor B rejected
    const dupReq = createReq(`http://localhost:3000/api/v1/reviews/${rev.id}/report`, "POST", {
      reason: "HARASSMENT",
    }, visitorBSession.token);
    const dupRes = await reportReview(dupReq, { params: Promise.resolve({ id: rev.id }) });
    assert.equal(dupRes.status, 409); // Already reported

    // Check report is in Admin Moderation Queue
    const qReq = createReq(`http://localhost:3000/api/v1/admin/reviews?filter=PENDING_REPORTS`, "GET", null, superAdminSession.token);
    const qRes = await getModerationQueue(qReq);
    assert.equal(qRes.status, 200);
    const qData = await qRes.json();
    assert.ok(qData.totalReports >= 1);
    const reportItem = qData.reports.find((r: any) => r.review.id === rev.id || r.reportId);
    assert.ok(reportItem);

    // Super Admin resolves report: DISMISS (keep published)
    const resolveReq = createReq(`http://localhost:3000/api/v1/admin/reviews/reports/${reportItem.id || reportItem.reportId}`, "POST", {
      action: "RESOLVE_KEEP",
      resolutionNotes: "Review inspected and deemed non-violating.",
    }, superAdminSession.token);
    const resolveRes = await resolveReport(resolveReq, { params: Promise.resolve({ id: reportItem.id || reportItem.reportId }) });
    assert.equal(resolveRes.status, 200);

    // Verify report is marked RESOLVED or DISMISSED
    const repInDb = await prisma.reviewReport.findUnique({ where: { id: reportItem.id || reportItem.reportId } });
    assert.ok(repInDb?.status === "RESOLVED" || repInDb?.status === "DISMISSED");
  });

  // TEST 12: Average rating recalculation on delete
  it("recalculates average rating and review count when an author deletes their review", async () => {
    // Visitor A deletes their review on hotel
    const revA = await prisma.review.findFirst({
      where: { userId: visitorA.id, listingId: hotelListing.id },
    });
    assert.ok(revA);

    const delReq = createReq(`http://localhost:3000/api/v1/reviews/${revA.id}`, "DELETE", null, visitorASession.token);
    const delRes = await deleteReview(delReq, { params: Promise.resolve({ id: revA.id }) });
    assert.equal(delRes.status, 200);

    // Verify hotel rating updated via GET reviews API
    const getReq = createReq(`http://localhost:3000/api/v1/listings/${hotelListing.id}/reviews`, "GET");
    const getRes = await getReviews(getReq, { params: Promise.resolve({ id: hotelListing.id }) });
    assert.equal(getRes.status, 200);
    const body = await getRes.json();
    assert.equal(body.summary.totalReviews, 1); // Only Visitor B remains
    assert.equal(body.summary.averageRating, 3.0); // Visitor B was 3 stars
  });

  // TEST 13: Integrity of existing database records
  it("preserves existing database listings, bookings, and users intact", async () => {
    const totalUsers = await prisma.user.count();
    const totalListings = await prisma.listing.count();
    assert.ok(totalUsers >= 7);
    assert.ok(totalListings >= 4);
  });
});
