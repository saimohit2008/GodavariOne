import { NextRequest } from "next/server";
import { requireAdmin, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { getStorage, UPLOAD_LIMITS } from "@/lib/storage";

// POST /api/v1/carousel/upload
// multipart/form-data: file, image, or files
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireAdmin(req);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data", 400);

  const file = form.get("file") || form.get("image") || form.getAll("files")[0];
  if (!file || !(file instanceof File)) {
    return fail("No image file provided in form data under 'file'", 400);
  }

  if (!UPLOAD_LIMITS.allowedMime.includes(file.type)) {
    return fail(
      `Unsupported file format: ${file.type}. Allowed formats: JPEG, PNG, WebP, GIF.`,
      400
    );
  }

  if (file.size > UPLOAD_LIMITS.maxFileBytes) {
    return fail(
      `File exceeds maximum size of ${Math.round(UPLOAD_LIMITS.maxFileBytes / (1024 * 1024))}MB`,
      400
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const saved = await storage.save(buf, file.name, file.type);

  await audit({
    actorId: ctx.user.id,
    action: "CAROUSEL_IMAGE_UPLOAD",
    targetType: "CAROUSEL_BANNER",
    details: {
      filename: saved.filename,
      sizeBytes: saved.sizeBytes,
      mimeType: saved.mimeType,
      url: saved.url,
    },
    ip: getClientIp(req),
  });

  return ok({
    success: true,
    url: saved.url,
    filename: saved.filename,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
  });
});
