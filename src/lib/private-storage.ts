import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Private secure storage for sensitive priority booking proof documents
// Files stored here are NEVER exposed under public/ or via direct HTTP URLs.
// Access is restricted to authenticated, authorized users via signed/guarded endpoints.

const PRIVATE_STORAGE_DIR = process.env.PRIVATE_STORAGE_DIR || path.join(process.cwd(), "private_documents");
const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || "godavari-private-documents";

export const ALLOWED_DOC_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const ALLOWED_DOC_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

export interface SavedPrivateDocument {
  relativePath: string;
  absolutePath: string;
  originalName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

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

export function isPrivateSupabaseActive(): boolean {
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production";
  const provider = (process.env.OBJECT_STORAGE_PROVIDER || "").toLowerCase().trim();
  const hasClient = Boolean(getSupabaseClient());

  // In production (Vercel / live deployment), Supabase is always required
  if (isProd) {
    return true;
  }

  // In development, require provider="supabase" and credentials
  return provider === "supabase" && hasClient;
}

/**
 * Validates magic bytes / file signatures to prevent mime-type spoofing
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  switch (mimeType) {
    case "application/pdf":
      // %PDF- (0x25 0x50 0x44 0x46)
      return buffer.subarray(0, 4).toString("ascii") === "%PDF";
    case "image/jpeg":
      // 0xFF 0xD8 0xFF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      // 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case "image/webp":
      // RIFF....WEBP
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
}

function getSafeExtension(originalName: string, mimeType: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (ALLOWED_DOC_EXTS.includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  switch (mimeType) {
    case "application/pdf": return ".pdf";
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "image/webp": return ".webp";
    default: return ".bin";
  }
}

/**
 * Saves a private supporting document in the secure private folder or Supabase private bucket
 */
export async function savePrivateDocument(
  buffer: Buffer,
  originalName: string,
  declaredMimeType: string
): Promise<SavedPrivateDocument> {
  const normalizedMime = declaredMimeType.toLowerCase().trim();

  if (!ALLOWED_DOC_MIMES.includes(normalizedMime)) {
    throw new Error(
      `Unsupported document format: ${declaredMimeType}. Allowed formats: PDF, JPEG, PNG, WebP.`
    );
  }

  if (buffer.length > MAX_DOC_BYTES) {
    throw new Error(
      `Document size exceeds maximum allowable limit of ${Math.round(MAX_DOC_BYTES / (1024 * 1024))}MB.`
    );
  }

  if (buffer.length === 0) {
    throw new Error("Cannot upload an empty document.");
  }

  if (!validateMagicBytes(buffer, normalizedMime)) {
    throw new Error("File content signature does not match declared document format.");
  }

  const ext = getSafeExtension(originalName, normalizedMime);

  if (isPrivateSupabaseActive()) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        "Supabase Storage configuration missing. Ensure SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are set in production."
      );
    }
    const bucket = process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || DEFAULT_PRIVATE_BUCKET;

    let targetFilename = `doc_${Date.now()}_${crypto.randomBytes(16).toString("hex")}${ext}`;
    let attempts = 0;
    const maxAttempts = 3;
    let uploadSuccess = false;

    while (!uploadSuccess && attempts < maxAttempts) {
      attempts++;
      const { error } = await client.storage.from(bucket).upload(targetFilename, buffer, {
        contentType: normalizedMime,
        upsert: false,
      });

      if (!error) {
        uploadSuccess = true;
        break;
      }

      const isDuplicate =
        error.message?.toLowerCase().includes("already exists") ||
        error.message?.toLowerCase().includes("duplicate") ||
        (error as any).statusCode === "409" ||
        (error as any).status === 409;

      if (isDuplicate && attempts < maxAttempts) {
        targetFilename = `doc_${Date.now()}_${crypto.randomBytes(20).toString("hex")}${ext}`;
        continue;
      }

      throw new Error(`Failed to upload document to private storage: ${error.message}`);
    }

    return {
      relativePath: targetFilename,
      absolutePath: `supabase-private://${bucket}/${targetFilename}`,
      originalName: path.basename(originalName).slice(0, 100),
      filename: targetFilename,
      mimeType: normalizedMime,
      sizeBytes: buffer.length,
    };
  }

  // Prevent local filesystem fallback in production
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production";
  if (isProd) {
    throw new Error(
      "Local filesystem storage is disabled in production. Supabase Storage is required."
    );
  }

  // Local filesystem fallback (offline local development)
  await fs.mkdir(PRIVATE_STORAGE_DIR, { recursive: true });

  let targetFilename = `doc_${Date.now()}_${crypto.randomBytes(16).toString("hex")}${ext}`;
  let absolutePath = path.join(PRIVATE_STORAGE_DIR, targetFilename);
  let attempts = 0;

  while (attempts < 3) {
    attempts++;
    // Path traversal guard
    const resolved = path.resolve(/*turbopackIgnore: true*/ absolutePath);
    if (!resolved.startsWith(path.resolve(/*turbopackIgnore: true*/ PRIVATE_STORAGE_DIR))) {
      throw new Error("Invalid destination path.");
    }

    try {
      await fs.writeFile(resolved, buffer, { flag: "wx" });
      break;
    } catch (err: any) {
      if (err.code === "EEXIST" && attempts < 3) {
        targetFilename = `doc_${Date.now()}_${crypto.randomBytes(20).toString("hex")}${ext}`;
        absolutePath = path.join(PRIVATE_STORAGE_DIR, targetFilename);
        continue;
      }
      throw err;
    }
  }

  const finalResolved = path.resolve(/*turbopackIgnore: true*/ absolutePath);
  return {
    relativePath: targetFilename,
    absolutePath: finalResolved,
    originalName: path.basename(originalName).slice(0, 100),
    filename: targetFilename,
    mimeType: normalizedMime,
    sizeBytes: buffer.length,
  };
}

/**
 * Reads a private document by its relative path
 */
export async function readPrivateDocument(relativePath: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
} | null> {
  if (!relativePath || relativePath.includes("..") || relativePath.includes("/") || relativePath.includes("\\")) {
    return null;
  }

  const safeFilename = path.basename(relativePath);

  // If Supabase is active, attempt to download from private bucket
  if (isPrivateSupabaseActive()) {
    try {
      const client = getSupabaseClient()!;
      const bucket = process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || DEFAULT_PRIVATE_BUCKET;
      const { data, error } = await client.storage.from(bucket).download(safeFilename);
      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const ext = path.extname(safeFilename).toLowerCase();
        let mimeType = data.type || "application/octet-stream";
        if (!mimeType || mimeType === "application/octet-stream") {
          if (ext === ".pdf") mimeType = "application/pdf";
          else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
          else if (ext === ".png") mimeType = "image/png";
          else if (ext === ".webp") mimeType = "image/webp";
        }
        return { buffer, mimeType, sizeBytes: buffer.length };
      }
    } catch {
      // Fall through to local filesystem check
    }
  }

  const absolutePath = path.join(/*turbopackIgnore: true*/ PRIVATE_STORAGE_DIR, safeFilename);
  try {
    const buffer = await fs.readFile(/*turbopackIgnore: true*/ absolutePath);
    const ext = path.extname(safeFilename).toLowerCase();
    let mimeType = "application/octet-stream";
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";

    return { buffer, mimeType, sizeBytes: buffer.length };
  } catch {
    return null;
  }
}

/**
 * Generates a short-lived signed URL for authorized access to a private document
 */
export async function createSignedDocumentUrl(
  relativePath: string,
  expiresInSeconds = 300
): Promise<string | null> {
  if (!relativePath || relativePath.includes("..") || relativePath.includes("/") || relativePath.includes("\\")) {
    return null;
  }

  const safeFilename = path.basename(relativePath);
  const client = getSupabaseClient();
  if (!client) return null;

  const bucket = process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || DEFAULT_PRIVATE_BUCKET;
  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(safeFilename, expiresInSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Deletes a private document if exists
 */
export async function deletePrivateDocument(relativePath: string): Promise<void> {
  if (!relativePath || relativePath.includes("..")) return;
  const safeFilename = path.basename(relativePath);

  if (isPrivateSupabaseActive()) {
    try {
      const client = getSupabaseClient()!;
      const bucket = process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || DEFAULT_PRIVATE_BUCKET;
      await client.storage.from(bucket).remove([safeFilename]);
    } catch {
      // ignore
    }
  }

  const absolutePath = path.join(/*turbopackIgnore: true*/ PRIVATE_STORAGE_DIR, safeFilename);
  try {
    await fs.unlink(/*turbopackIgnore: true*/ absolutePath);
  } catch {
    // ignore
  }
}
