import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

const updateSectionSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  isEnabled: z.boolean().optional(),
  orderIdx: z.number().int().optional(),
  settings: z.record(z.string(), z.any()).or(z.string()).optional().nullable(),
});

// PATCH /api/v1/homepage-content/sections/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions to update homepage section settings", 403);
  }

  const { id } = await params;
  const existing = await db.homepageSection.findUnique({ where: { id } });
  if (!existing) return fail("Homepage section not found", 404);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = updateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues);
  }

  const data = parsed.data;
  const updateData: any = {
    lastEditedById: ctx.user.id,
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
  if (data.orderIdx !== undefined) updateData.orderIdx = data.orderIdx;

  if (data.settings !== undefined) {
    updateData.settings = typeof data.settings === "object" && data.settings !== null
      ? JSON.stringify(data.settings)
      : typeof data.settings === "string"
      ? data.settings
      : null;
  }

  const updated = await db.homepageSection.update({
    where: { id },
    data: updateData,
  });

  await audit({
    actorId: ctx.user.id,
    action: "HOMEPAGE_SECTION_UPDATE",
    targetType: "HOMEPAGE_SECTION",
    targetId: id,
    details: {
      name: updated.name,
      isEnabled: updated.isEnabled,
      orderIdx: updated.orderIdx,
      settingsChanged: data.settings !== undefined,
    },
    ip: getClientIp(req),
  });

  return ok(updated);
});
