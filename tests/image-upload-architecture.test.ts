import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";
import { hashPassword, createSession } from "../src/lib/auth";
import { POST as uploadPost, GET as uploadGet, DELETE as uploadDelete } from "../src/app/api/v1/upload/route";
import { POST as carouselUploadPost } from "../src/app/api/v1/carousel/upload/route";
import { POST as heroImagesPost, GET as heroImagesGet } from "../src/app/api/v1/homepage-content/hero-images/route";
import { POST as listingImagesPost } from "../src/app/api/v1/images/route";

// Valid 1x1 PNG image buffer
const VALID_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d450000000049454e44ae426082",
  "hex"
);

// Valid 1x1 JPEG image buffer
const VALID_JPEG_BUFFER = Buffer.from(
  "ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9",
  "hex"
);

// Spoofed invalid image (plain text with image/png MIME)
const SPOOFED_TEXT_BUFFER = Buffer.from("<html><script>alert('malicious')</script></html>", "utf-8");

function createFormDataReq(
  url: string,
  sessionToken?: string,
  fields?: Record<string, string>,
  files?: Array<{ name: string; filename: string; buffer: Buffer; mimeType: string }>
): NextRequest {
  const boundary = "----WebKitFormBoundaryTest" + Math.random().toString(36).substring(2);
  const parts: Buffer[] = [];

  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
          "utf-8"
        )
      );
    }
  }

  if (files) {
    for (const f of files) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.mimeType}\r\n\r\n`,
          "utf-8"
        )
      );
      parts.push(f.buffer);
      parts.push(Buffer.from("\r\n", "utf-8"));
    }
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf-8"));
  const body = Buffer.concat(parts);

  const headers: Record<string, string> = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": body.length.toString(),
  };

  if (sessionToken) {
    headers["cookie"] = `godavari_session=${sessionToken}`;
  }

  return new NextRequest(url, {
    method: "POST",
    headers,
    body,
  });
}

describe("GODAVARI ONE — Image Upload Architecture & Security Suite", () => {
  let superAdminToken: string;
  let visitorToken: string;
  let testListingId: string;
  let superAdminId: string;
  let uploadedUrlsToCleanup: string[] = [];

  before(async () => {
    // 1. Create test super admin
    const adminUser = await db.user.upsert({
      where: { phone: "+919999900010" },
      update: { role: "SUPER_ADMIN" },
      create: {
        phone: "+919999900010",
        name: "Upload Test Super Admin",
        role: "SUPER_ADMIN",
        passwordHash: hashPassword("AdminUploadPass123!"),
      },
    });
    superAdminId = adminUser.id;
    const adminSession = await createSession(adminUser.id, "PASSWORD");
    superAdminToken = adminSession.token;

    // 2. Create test regular visitor
    const visitorUser = await db.user.upsert({
      where: { phone: "+919999900020" },
      update: { role: "VISITOR" },
      create: {
        phone: "+919999900020",
        name: "Upload Test Visitor",
        role: "VISITOR",
        passwordHash: hashPassword("VisitorUploadPass123!"),
      },
    });
    const visitorSession = await createSession(visitorUser.id, "PASSWORD");
    visitorToken = visitorSession.token;

    // 3. Create test business listing
    const listing = await db.listing.create({
      data: {
        name: "Godavari Grand Riverside Hotel",
        category: "HOTELS",
        description: "Luxury hotel overlooking the Godavari sacred river.",
        address: "Kotilingala Ghat Road, Rajahmundry",
        publicationStatus: "PUBLISHED",
        ownerId: adminUser.id,
      },
    });
    testListingId = listing.id;
  });

  after(async () => {
    // Cleanup listing & images
    if (testListingId) {
      await db.listingImage.deleteMany({ where: { listingId: testListingId } }).catch(() => {});
      await db.listing.delete({ where: { id: testListingId } }).catch(() => {});
    }
  });

  // 1. Successful carousel image upload
  it("1. Successfully uploads a carousel banner image via /api/v1/carousel/upload", async () => {
    const req = createFormDataReq(
      "http://localhost:3000/api/v1/carousel/upload",
      superAdminToken,
      {},
      [{ name: "file", filename: "banner-test.png", buffer: VALID_PNG_BUFFER, mimeType: "image/png" }]
    );

    const res = await carouselUploadPost(req);
    assert.equal(res.status, 200, "Must return HTTP 200");
    const json = await res.json();
    assert.equal(json.success, true, "Must indicate success");
    assert.match(json.url, /^\/uploads\/.+\.png$/, "Must return a persistent /uploads/ relative path");
    assert.equal(json.mimeType, "image/png");
    uploadedUrlsToCleanup.push(json.url);
  });

  // 2. Successful homepage hero image upload
  it("2. Successfully uploads a homepage hero statue image via /api/v1/upload", async () => {
    const req = createFormDataReq(
      "http://localhost:3000/api/v1/upload",
      superAdminToken,
      {},
      [{ name: "file", filename: "statue-devi.jpg", buffer: VALID_JPEG_BUFFER, mimeType: "image/jpeg" }]
    );

    const res = await uploadPost(req);
    assert.equal(res.status, 200, "Must return HTTP 200");
    const json = await res.json();
    assert.equal(json.success, true, "Must indicate success");
    assert.match(json.url, /^\/uploads\/.+\.jpg$/, "Must return a valid /uploads/ path for statue image");
    uploadedUrlsToCleanup.push(json.url);
  });

  // 3. Successful advertisement image upload
  it("3. Successfully uploads an advertisement banner image via /api/v1/carousel/upload", async () => {
    const req = createFormDataReq(
      "http://localhost:3000/api/v1/carousel/upload",
      superAdminToken,
      {},
      [{ name: "file", filename: "ad-pushkaralu.png", buffer: VALID_PNG_BUFFER, mimeType: "image/png" }]
    );

    const res = await carouselUploadPost(req);
    assert.equal(res.status, 200, "Must return HTTP 200");
    const json = await res.json();
    assert.match(json.url, /^\/uploads\/.+\.png$/);
    uploadedUrlsToCleanup.push(json.url);
  });

  // 4. Successful business listing image upload
  it("4. Successfully uploads a business listing gallery image via /api/v1/images", async () => {
    const req = createFormDataReq(
      `http://localhost:3000/api/v1/images?listingId=${testListingId}&primary=true`,
      superAdminToken,
      {},
      [{ name: "files", filename: "hotel-room.png", buffer: VALID_PNG_BUFFER, mimeType: "image/png" }]
    );

    const res = await listingImagesPost(req);
    assert.equal(res.status, 201, "Must return HTTP 201 Created");
    const json = await res.json();
    assert.ok(Array.isArray(json.images), "Must return array of created images");
    assert.equal(json.images.length, 1);
    assert.equal(json.images[0].isPrimary, true);
    assert.match(json.images[0].url, /^\/uploads\/.+\.png$/);
  });

  // 5. Invalid file format rejection
  it("5. Rejects unsupported file formats (e.g. text/plain or executable disguised as image)", async () => {
    // 5a. Unsupported MIME type
    const reqText = createFormDataReq(
      "http://localhost:3000/api/v1/upload",
      superAdminToken,
      {},
      [{ name: "file", filename: "notes.txt", buffer: Buffer.from("Hello world"), mimeType: "text/plain" }]
    );
    const resText = await uploadPost(reqText);
    assert.equal(resText.status, 400, "Must reject text/plain with HTTP 400");
    const jsonText = await resText.json();
    assert.match(jsonText.error, /Unsupported file format/i);

    // 5b. Spoofed MIME type: declared as image/png, but binary magic bytes are HTML
    const reqSpoof = createFormDataReq(
      "http://localhost:3000/api/v1/upload",
      superAdminToken,
      {},
      [{ name: "file", filename: "malicious.png", buffer: SPOOFED_TEXT_BUFFER, mimeType: "image/png" }]
    );
    const resSpoof = await uploadPost(reqSpoof);
    assert.equal(resSpoof.status, 500, "Must reject spoofed file signature via magic bytes");
  });

  // 6. Oversized file rejection
  it("6. Rejects oversized files exceeding the 5MB ceiling with HTTP 400", async () => {
    // Create a 5.2MB buffer
    const largeBuffer = Buffer.alloc(5.2 * 1024 * 1024, 0x00);
    // Write valid PNG header
    VALID_PNG_BUFFER.copy(largeBuffer, 0, 0, 8);

    const req = createFormDataReq(
      "http://localhost:3000/api/v1/upload",
      superAdminToken,
      {},
      [{ name: "file", filename: "huge-photo.png", buffer: largeBuffer, mimeType: "image/png" }]
    );

    const res = await uploadPost(req);
    assert.equal(res.status, 400, "Must reject oversized upload with HTTP 400");
    const json = await res.json();
    assert.match(json.error, /exceeds maximum size/i);
  });

  // 7. Unauthenticated upload rejection
  it("7. Rejects unauthenticated requests with HTTP 401 JSON response", async () => {
    const reqUpload = createFormDataReq(
      "http://localhost:3000/api/v1/upload",
      undefined, // no session cookie
      {},
      [{ name: "file", filename: "unauth.png", buffer: VALID_PNG_BUFFER, mimeType: "image/png" }]
    );
    const resUpload = await uploadPost(reqUpload);
    assert.equal(resUpload.status, 401, "Must return HTTP 401");
    const jsonUpload = await resUpload.json();
    assert.equal(jsonUpload.error, "Authentication required");

    const reqCarousel = createFormDataReq(
      "http://localhost:3000/api/v1/carousel/upload",
      undefined,
      {},
      [{ name: "file", filename: "unauth.png", buffer: VALID_PNG_BUFFER, mimeType: "image/png" }]
    );
    const resCarousel = await carouselUploadPost(reqCarousel);
    assert.equal(resCarousel.status, 401, "Carousel upload must reject unauthenticated with HTTP 401");
  });

  // 8. Unauthorized administrator rejection
  it("8. Rejects ordinary visitors with HTTP 403 Forbidden", async () => {
    const req = createFormDataReq(
      "http://localhost:3000/api/v1/upload",
      visitorToken,
      {},
      [{ name: "file", filename: "visitor.png", buffer: VALID_PNG_BUFFER, mimeType: "image/png" }]
    );
    const res = await uploadPost(req);
    assert.equal(res.status, 403, "Must return HTTP 403 for non-admin");
    const json = await res.json();
    assert.match(json.error, /Insufficient permissions/i);
  });

  // 9. Storage provider failure handling
  it("9. Handles empty or corrupted form submissions safely with HTTP 400 JSON errors", async () => {
    const reqEmpty = new NextRequest("http://localhost:3000/api/v1/upload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `godavari_session=${superAdminToken}`,
      },
      body: JSON.stringify({}),
    });

    const res = await uploadPost(reqEmpty);
    assert.equal(res.status, 400, "Must return HTTP 400 for invalid form data");
    const json = await res.json();
    assert.ok(json.error, "Must contain error message in JSON");
  });

  // 10. Invalid or missing upload endpoint handling
  it("10. Rejects invalid operations with clean JSON errors without leaking raw HTML", async () => {
    // Missing required file
    const reqNoFile = createFormDataReq(
      "http://localhost:3000/api/v1/carousel/upload",
      superAdminToken,
      { someOtherField: "value" },
      []
    );
    const resNoFile = await carouselUploadPost(reqNoFile);
    assert.equal(resNoFile.status, 400, "Must return 400 when no file provided");
    const json = await resNoFile.json();
    assert.match(json.error, /No image file provided/i);
    assert.equal(typeof json.error, "string", "Error must be string, not HTML");
  });

  // 11. Image replacement and persistence
  it("11. Replacing an active homepage hero statue image updates the configuration and persists to database", async () => {
    // Setup hero section with initial statue URL
    const initialUrl = "/uploads/initial-statue.png";
    await db.homepageSection.upsert({
      where: { id: "hero" },
      update: {
        settings: JSON.stringify({
          title: "Godavari Pushkaralu 2027",
          statueImageUrl: initialUrl,
          showStatue: true,
        }),
      },
      create: {
        id: "hero",
        name: "hero",
        orderIdx: 0,
        settings: JSON.stringify({
          title: "Godavari Pushkaralu 2027",
          statueImageUrl: initialUrl,
          showStatue: true,
        }),
      },
    });

    // Replace the statue image
    const reqReplace = createFormDataReq(
      "http://localhost:3000/api/v1/homepage-content/hero-images",
      superAdminToken,
      { targetImageUrl: initialUrl },
      [{ name: "file", filename: "new-statue.png", buffer: VALID_PNG_BUFFER, mimeType: "image/png" }]
    );

    const resReplace = await heroImagesPost(reqReplace);
    assert.equal(resReplace.status, 200, "Must return HTTP 200 for image replacement");
    const jsonReplace = await resReplace.json();
    assert.equal(jsonReplace.success, true);
    assert.equal(jsonReplace.isCurrentHero, true, "Must be flagged as current hero");
    assert.match(jsonReplace.url, /^\/uploads\/.+\.png$/);

    // Verify database record has updated to the replacement URL
    const updatedSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
    const updatedSettings = JSON.parse(updatedSection?.settings || "{}");
    assert.equal(updatedSettings.statueImageUrl, jsonReplace.url, "Database must store new replaced image URL");
  });

  // 12. Existing images remaining intact after failed uploads
  it("12. Failed uploads (e.g. invalid format) do not modify or corrupt existing database records", async () => {
    const beforeSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
    const beforeSettings = JSON.parse(beforeSection?.settings || "{}");
    const originalUrl = beforeSettings.statueImageUrl;

    // Attempt invalid replace
    const reqBad = createFormDataReq(
      "http://localhost:3000/api/v1/homepage-content/hero-images",
      superAdminToken,
      { targetImageUrl: originalUrl },
      [{ name: "file", filename: "corrupt.txt", buffer: Buffer.from("bad"), mimeType: "text/plain" }]
    );

    const resBad = await heroImagesPost(reqBad);
    assert.equal(resBad.status, 400, "Upload must fail with 400");

    // Verify existing database record remains completely intact
    const afterSection = await db.homepageSection.findUnique({ where: { id: "hero" } });
    const afterSettings = JSON.parse(afterSection?.settings || "{}");
    assert.equal(afterSettings.statueImageUrl, originalUrl, "Existing statue image URL must remain unaltered");
  });
});
