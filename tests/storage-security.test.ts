import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import {
  validateImageMagicBytes,
  localStorage,
  isSupabaseStorageActive,
  getStorageProvider,
} from "@/lib/storage";
import {
  validateMagicBytes,
  savePrivateDocument,
  isPrivateSupabaseActive,
} from "@/lib/private-storage";
import {
  POST as submitPriorityBooking,
  getValidatedClientIp,
  checkAnonymousBookingRateLimit,
  resetAnonymousBookingRateLimits,
} from "@/app/api/v1/priority-bookings/route";

describe("GODAVARI ONE — STORAGE SECURITY & PRODUCTION HARDENING TEST SUITE", () => {
  // Valid binary fixtures for testing
  const validPngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAEAST+AAAAAElFTkSuQmCC",
    "base64"
  );
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validGifBuffer = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00", "binary");
  const validWebpBuffer = Buffer.from("RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00", "binary");
  const validPdfBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

  // Invalid / Spoofed fixtures
  const fakeHtmlImageBuffer = Buffer.from("<html><script>alert('xss')</script></html>");
  const fakeExeBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00");
  const randomCorruptBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44]);

  beforeEach(() => {
    resetAnonymousBookingRateLimits();
  });

  // -------------------------------------------------------------------------
  // 1. Binary Magic Bytes Validation Tests
  // -------------------------------------------------------------------------
  describe("1. Binary Magic Bytes Validation", () => {
    it("accepts authentic PNG image buffers", () => {
      assert.equal(validateImageMagicBytes(validPngBuffer, "image/png"), true);
    });

    it("accepts authentic JPEG image buffers", () => {
      assert.equal(validateImageMagicBytes(validJpgBuffer, "image/jpeg"), true);
    });

    it("accepts authentic GIF image buffers", () => {
      assert.equal(validateImageMagicBytes(validGifBuffer, "image/gif"), true);
    });

    it("accepts authentic WebP image buffers", () => {
      assert.equal(validateImageMagicBytes(validWebpBuffer, "image/webp"), true);
    });

    it("rejects buffers smaller than 4 bytes", () => {
      assert.equal(validateImageMagicBytes(Buffer.from([0xff, 0xd8]), "image/jpeg"), false);
      assert.equal(validateImageMagicBytes(Buffer.alloc(0), "image/png"), false);
    });

    it("rejects arbitrary binary or corrupted buffers", () => {
      assert.equal(validateImageMagicBytes(randomCorruptBuffer, "image/png"), false);
      assert.equal(validateImageMagicBytes(randomCorruptBuffer, "image/jpeg"), false);
      assert.equal(validateImageMagicBytes(randomCorruptBuffer, "image/webp"), false);
      assert.equal(validateImageMagicBytes(randomCorruptBuffer, "image/gif"), false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. MIME Type Spoofing Defense
  // -------------------------------------------------------------------------
  describe("2. MIME Type Spoofing Defense", () => {
    it("rejects HTML disguised with image/png MIME type", async () => {
      assert.equal(validateImageMagicBytes(fakeHtmlImageBuffer, "image/png"), false);
      await assert.rejects(
        () => localStorage.save(fakeHtmlImageBuffer, "malicious.png", "image/png"),
        /File content signature does not match declared image format/
      );
    });

    it("rejects executable disguised with image/jpeg MIME type", async () => {
      assert.equal(validateImageMagicBytes(fakeExeBuffer, "image/jpeg"), false);
      await assert.rejects(
        () => localStorage.save(fakeExeBuffer, "payload.jpg", "image/jpeg"),
        /File content signature does not match declared image format/
      );
    });

    it("rejects PDF file disguised as image/png", async () => {
      assert.equal(validateImageMagicBytes(validPdfBuffer, "image/png"), false);
      await assert.rejects(
        () => localStorage.save(validPdfBuffer, "fake.png", "image/png"),
        /File content signature does not match declared image format/
      );
    });

    it("rejects JPEG buffer declared with mismatched MIME type image/png", () => {
      assert.equal(validateImageMagicBytes(validJpgBuffer, "image/png"), false);
    });

    it("private-storage validates genuine PDF and rejects spoofed HTML/EXE", async () => {
      assert.equal(validateMagicBytes(validPdfBuffer, "application/pdf"), true);
      assert.equal(validateMagicBytes(validPngBuffer, "image/png"), true);
      assert.equal(validateMagicBytes(validJpgBuffer, "image/jpeg"), true);
      assert.equal(validateMagicBytes(fakeHtmlImageBuffer, "application/pdf"), false);
      assert.equal(validateMagicBytes(fakeExeBuffer, "application/pdf"), false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Storage Provider Consistency & Production Safeguards
  // -------------------------------------------------------------------------
  describe("3. Storage Provider Consistency", () => {
    const originalEnv = { ...process.env };

    it("guarantees Supabase storage is active in production mode for both public and private storage", () => {
      try {
        (process.env as any).NODE_ENV = "production";
        delete process.env.OBJECT_STORAGE_PROVIDER;

        assert.equal(isSupabaseStorageActive(), true);
        assert.equal(isPrivateSupabaseActive(), true);
        assert.equal(getStorageProvider(), "supabase");
      } finally {
        (process.env as any).NODE_ENV = originalEnv.NODE_ENV;
        if (originalEnv.OBJECT_STORAGE_PROVIDER) {
          process.env.OBJECT_STORAGE_PROVIDER = originalEnv.OBJECT_STORAGE_PROVIDER;
        } else {
          delete process.env.OBJECT_STORAGE_PROVIDER;
        }
      }
    });

    it("guarantees Supabase storage is active when VERCEL=1 is set", () => {
      try {
        process.env.VERCEL = "1";
        delete process.env.OBJECT_STORAGE_PROVIDER;

        assert.equal(isSupabaseStorageActive(), true);
        assert.equal(isPrivateSupabaseActive(), true);
        assert.equal(getStorageProvider(), "supabase");
      } finally {
        delete process.env.VERCEL;
      }
    });

    it("blocks local filesystem fallback in production for public uploads", async () => {
      try {
        (process.env as any).NODE_ENV = "production";
        await assert.rejects(
          () => localStorage.save(validPngBuffer, "test.png", "image/png"),
          /Local filesystem storage is disabled in production/
        );
      } finally {
        (process.env as any).NODE_ENV = originalEnv.NODE_ENV;
      }
    });

    it("blocks local filesystem fallback in production for private document uploads", async () => {
      try {
        (process.env as any).NODE_ENV = "production";
        // When client is absent or fails, it throws without writing to local disk
        const savedUrl = process.env.SUPABASE_URL;
        delete process.env.SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;

        await assert.rejects(
          () => savePrivateDocument(validPdfBuffer, "proof.pdf", "application/pdf"),
          /Supabase Storage configuration missing/
        );

        if (savedUrl) process.env.SUPABASE_URL = savedUrl;
      } finally {
        (process.env as any).NODE_ENV = originalEnv.NODE_ENV;
        if (originalEnv.SUPABASE_URL) process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
        if (originalEnv.NEXT_PUBLIC_SUPABASE_URL) process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 4. Client IP Validation & Anonymous Priority Booking Rate Limiting
  // -------------------------------------------------------------------------
  describe("4. Priority Booking Rate Limiting & Client IP Extraction", () => {
    it("securely resolves valid IPv4 and IPv6 addresses and rejects arbitrary spoofed headers", () => {
      // 1. Valid real IP header
      const req1 = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
        headers: { "x-real-ip": "203.0.113.195" },
      });
      assert.equal(getValidatedClientIp(req1), "203.0.113.195");

      // 2. Valid Cloudflare CF-Connecting-IP
      const req2 = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
        headers: { "cf-connecting-ip": "198.51.100.42" },
      });
      assert.equal(getValidatedClientIp(req2), "198.51.100.42");

      // 3. Valid IPv6 address
      const req3 = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
        headers: { "x-real-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334" },
      });
      assert.equal(getValidatedClientIp(req3), "2001:0db8:85a3:0000:0000:8a2e:0370:7334");

      // 4. Arbitrary client-injected garbage header is rejected
      const req4 = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
        headers: { "x-real-ip": "malicious_script_injection_or_bogus_text" },
      });
      assert.equal(getValidatedClientIp(req4), "untrusted_ip");
    });

    it("rate limits anonymous priority booking submissions after 5 attempts", () => {
      const testIp = "192.0.2.100";

      // Attempts 1 through 5 succeed
      for (let i = 1; i <= 5; i++) {
        const result = checkAnonymousBookingRateLimit(testIp);
        assert.equal(result.allowed, true, `Attempt ${i} should be allowed`);
        assert.equal(result.remaining, 5 - i);
      }

      // 6th attempt is blocked with 429 semantics
      const blockedResult = checkAnonymousBookingRateLimit(testIp);
      assert.equal(blockedResult.allowed, false);
      assert.equal(blockedResult.remaining, 0);
      assert.ok(blockedResult.retryAfterMinutes! >= 1);
    });

    it("returns HTTP 429 when anonymous submissions exceed rate limit via API route", async () => {
      const testIp = "198.51.100.88";

      // Exhaust rate limit for this test IP
      for (let i = 0; i < 5; i++) {
        checkAnonymousBookingRateLimit(testIp);
      }

      // 6th submission via NextRequest
      const req = new NextRequest("http://localhost:3000/api/v1/priority-bookings", {
        method: "POST",
        headers: { "x-real-ip": testIp },
        body: new FormData(),
      });

      const res = await submitPriorityBooking(req);
      assert.equal(res.status, 429, "Rate limited request must return HTTP 429");
      const body = await res.json();
      assert.ok(body.error.includes("Too many anonymous booking applications"));
      assert.ok(body.details.retryAfterMinutes >= 1);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Accidental Overwrite Protection
  // -------------------------------------------------------------------------
  describe("5. Accidental Overwrite Protection", () => {
    it("saves valid image to local storage and produces unique non-colliding files", async () => {
      const saved1 = await localStorage.save(validPngBuffer, "photo.png", "image/png");
      const saved2 = await localStorage.save(validPngBuffer, "photo.png", "image/png");

      assert.ok(saved1.filename);
      assert.ok(saved2.filename);
      assert.notEqual(saved1.filename, saved2.filename, "Successive saves must generate distinct unique filenames");

      // Verify files exist and have correct sizes
      const stat1 = await fs.stat(saved1.absPath);
      const stat2 = await fs.stat(saved2.absPath);
      assert.equal(stat1.size, validPngBuffer.length);
      assert.equal(stat2.size, validPngBuffer.length);

      // Cleanup test files
      await localStorage.delete(saved1.url);
      await localStorage.delete(saved2.url);
    });

    it("saves valid private document and produces unique non-colliding files", async () => {
      const saved1 = await savePrivateDocument(validPdfBuffer, "aadhaar_card.pdf", "application/pdf");
      const saved2 = await savePrivateDocument(validPdfBuffer, "aadhaar_card.pdf", "application/pdf");

      assert.ok(saved1.filename);
      assert.ok(saved2.filename);
      assert.notEqual(saved1.filename, saved2.filename, "Successive private document saves must not overwrite");

      // Cleanup test files if created on disk
      try {
        await fs.unlink(saved1.absolutePath);
        await fs.unlink(saved2.absolutePath);
      } catch {}
    });
  });
});
