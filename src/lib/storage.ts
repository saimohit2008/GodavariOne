import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Storage abstraction supporting both local filesystem (for offline local development)
// and Supabase Storage (for production cloud deployment on Vercel/Serverless).

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "godavari-uploads";

export interface SavedFile {
  url: string; // relative URL path served statically or rewritten to Supabase
  filename: string;
  mimeType: string;
  sizeBytes: number;
  absPath: string;
}

export interface StorageAdapter {
  save(buffer: Buffer, originalName: string, mimeType: string): Promise<SavedFile>;
  delete(url: string): Promise<void>;
  listFiles?(): Promise<Array<{ url: string; name: string }>>;
}

function safeExt(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return ".bin";
  return ext;
}

/**
 * Validates binary magic bytes (file signatures) to prevent MIME-type spoofing and malicious file uploads
 */
export function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  switch (mimeType) {
    case "image/jpeg":
      // 0xFF 0xD8 0xFF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      // 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/webp":
      // RIFF....WEBP
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/gif":
      // GIF87a or GIF89a
      return (
        buffer.length >= 6 &&
        buffer.subarray(0, 3).toString("ascii") === "GIF" &&
        (buffer.subarray(3, 6).toString("ascii") === "87a" ||
          buffer.subarray(3, 6).toString("ascii") === "89a")
      );
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// 1. Local Filesystem Storage Adapter (Fallback for offline local development)
// ---------------------------------------------------------------------------

export const localStorage: StorageAdapter = {
  async save(buffer, originalName, mimeType) {
    const isProd =
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL === "1" ||
      process.env.VERCEL_ENV === "production";
    if (isProd) {
      throw new Error(
        "Local filesystem storage is disabled in production. Supabase Storage is required."
      );
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large. Max ${MAX_FILE_SIZE} bytes.`);
    }
    if (!validateImageMagicBytes(buffer, mimeType)) {
      throw new Error("File content signature does not match declared image format.");
    }
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = safeExt(originalName);

    let targetFilename = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`;
    let absPath = path.join(UPLOAD_DIR, targetFilename);
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        await fs.writeFile(absPath, buffer, { flag: "wx" });
        break;
      } catch (err: any) {
        if (err.code === "EEXIST" && attempts < 3) {
          targetFilename = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
          absPath = path.join(UPLOAD_DIR, targetFilename);
          continue;
        }
        throw err;
      }
    }
    const url = `/uploads/${targetFilename}`;
    return { url, filename: targetFilename, mimeType, sizeBytes: buffer.length, absPath };
  },
  async delete(url) {
    if (!url || !url.startsWith("/uploads/")) return;
    const filename = path.basename(url.split("?")[0]);
    const absPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, filename);
    try {
      await fs.unlink(absPath);
    } catch {
      // ignore missing file errors
    }
  },
  async listFiles() {
    try {
      const files = await fs.readdir(/*turbopackIgnore: true*/ UPLOAD_DIR);
      return files
        .filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
        .map((f) => ({ url: `/uploads/${f}`, name: f }));
    } catch {
      return [];
    }
  },
};

// ---------------------------------------------------------------------------
// 2. Supabase Cloud Storage Adapter (Production object storage)
// ---------------------------------------------------------------------------

let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabaseClient;
}

export const supabaseStorage: StorageAdapter = {
  async save(buffer, originalName, mimeType) {
    if (!ALLOWED_MIME.includes(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large. Max ${MAX_FILE_SIZE} bytes.`);
    }
    if (!validateImageMagicBytes(buffer, mimeType)) {
      throw new Error("File content signature does not match declared image format.");
    }

    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        "Supabase Storage configuration missing. Ensure SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are set."
      );
    }

    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    const ext = safeExt(originalName);

    let targetFilename = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`;
    let attempts = 0;
    const maxAttempts = 3;
    let uploadSuccess = false;

    while (!uploadSuccess && attempts < maxAttempts) {
      attempts++;
      const { error } = await client.storage
        .from(bucketName)
        .upload(targetFilename, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (!error) {
        uploadSuccess = true;
        break;
      }

      // Check if error is due to collision / existing resource
      const isDuplicate =
        error.message?.toLowerCase().includes("already exists") ||
        error.message?.toLowerCase().includes("duplicate") ||
        (error as any).statusCode === "409" ||
        (error as any).status === 409;

      if (isDuplicate && attempts < maxAttempts) {
        targetFilename = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
        continue;
      }

      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }

    // Keep the relative /uploads/ path format for complete backward compatibility
    // with existing database records, frontend validators, and Next.js rewrites.
    const url = `/uploads/${targetFilename}`;
    const { data: publicData } = client.storage.from(bucketName).getPublicUrl(targetFilename);
    const publicUrl = publicData?.publicUrl || url;

    return {
      url,
      filename: targetFilename,
      mimeType,
      sizeBytes: buffer.length,
      absPath: publicUrl,
    };
  },

  async delete(url) {
    if (!url) return;
    const client = getSupabaseClient();
    if (!client) return;

    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    const filename = path.basename(url.split("?")[0]);
    try {
      await client.storage.from(bucketName).remove([filename]);
    } catch {
      // ignore deletion errors
    }
  },
  async listFiles() {
    const client = getSupabaseClient();
    if (!client) return [];
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    try {
      const { data, error } = await client.storage.from(bucketName).list("", { limit: 100 });
      if (error || !data) return [];
      return data
        .filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))
        .map((f) => ({ url: `/uploads/${f.name}`, name: f.name }));
    } catch {
      return [];
    }
  },
};

// ---------------------------------------------------------------------------
// 3. Storage Factory
// ---------------------------------------------------------------------------

export function isSupabaseStorageActive(): boolean {
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production";
  const provider = (process.env.OBJECT_STORAGE_PROVIDER || "").toLowerCase().trim();
  const hasSupabase =
    !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !!(
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY
    );

  // In production (Vercel / live deployment), Supabase is always required
  if (isProd) {
    return true;
  }

  // In development, require provider="supabase" and credentials
  return provider === "supabase" && hasSupabase;
}

export function getStorage(): StorageAdapter {
  if (isSupabaseStorageActive()) {
    return supabaseStorage;
  }

  // Default to local filesystem for offline local development
  return localStorage;
}

export function getStorageProvider(): "supabase" | "local" {
  return isSupabaseStorageActive() ? "supabase" : "local";
}

export const UPLOAD_LIMITS = {
  maxGallery: 8,
  maxFileBytes: MAX_FILE_SIZE,
  allowedMime: ALLOWED_MIME,
};
