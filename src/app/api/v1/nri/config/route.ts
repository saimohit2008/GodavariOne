import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

function isValidHttpUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const nriConfigUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  heroTitle: z.string().trim().min(1, "Title is required").max(200, "Title cannot exceed 200 characters").optional(),
  heroDescription: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  welcomeMessage: z.string().trim().max(1000, "Welcome message cannot exceed 1000 characters").optional().nullable(),
  supportPhone: z.string().trim().max(100).optional().nullable(),
  supportEmail: z.string().trim().email("Invalid email format").optional().nullable().or(z.literal("")).optional().nullable(),
  supportInstructions: z.string().trim().max(1000).optional().nullable(),
  helplineHours: z.string().trim().max(100).optional().nullable(),
  externalGuideUrl: z.string().trim().max(500).optional().nullable().refine(isValidHttpUrl, {
    message: "External guide URL must be a valid http(s) URL",
  }),
  customLinks: z.string().optional().nullable(),
  visibilitySettings: z.string().optional().nullable(),
});

// GET /api/v1/nri/config
// Public access: returns the global NRI portal settings
export const GET = handler(async () => {
  let config = await db.nriConfig.findUnique({
    where: { id: "default" },
  });

  if (!config) {
    config = await db.nriConfig.create({
      data: {
        id: "default",
        isEnabled: true,
        heroTitle: "Curated All-Inclusive Pilgrimage Packages for Godavari Pushkaralu 2027",
        heroDescription: "Experience the divine Maha Pushkaralu without logistics stress. Receive transparent, itemized quotations covering private airport pickup, riverside luxury accommodation, and chauffeured transit.",
        welcomeMessage: "Welcome to the Godavari One NRI & International Pilgrims Portal. Our verified local hospitality partners are ready to craft a peaceful, bespoke pilgrimage experience for your family.",
        supportPhone: null,
        supportEmail: null,
        supportInstructions: null,
        helplineHours: null,
        externalGuideUrl: null,
        visibilitySettings: JSON.stringify({
          showHeaderLink: true,
          showHomepageBanner: true,
          showPackagesTab: true,
          showTrackingTab: true,
          showServicesGrid: true,
          showNotices: true,
        }),
      },
    });
  }

  return ok(config);
});

// PATCH /api/v1/nri/config
// Super Admin only: Update global NRI portal configuration
export const PATCH = handler(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = nriConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  const data = parsed.data;

  // Ensure default record exists
  const existing = await db.nriConfig.findUnique({ where: { id: "default" } });
  if (!existing) {
    await db.nriConfig.create({
      data: { id: "default", heroTitle: "Curated All-Inclusive Pilgrimage Packages for Godavari Pushkaralu 2027" },
    });
  }

  const updated = await db.nriConfig.update({
    where: { id: "default" },
    data: {
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.heroTitle !== undefined && { heroTitle: data.heroTitle }),
      ...(data.heroDescription !== undefined && { heroDescription: data.heroDescription || null }),
      ...(data.welcomeMessage !== undefined && { welcomeMessage: data.welcomeMessage || null }),
      ...(data.supportPhone !== undefined && { supportPhone: data.supportPhone || null }),
      ...(data.supportEmail !== undefined && { supportEmail: data.supportEmail || null }),
      ...(data.supportInstructions !== undefined && { supportInstructions: data.supportInstructions || null }),
      ...(data.helplineHours !== undefined && { helplineHours: data.helplineHours || null }),
      ...(data.externalGuideUrl !== undefined && { externalGuideUrl: data.externalGuideUrl || null }),
      ...(data.customLinks !== undefined && { customLinks: data.customLinks || null }),
      ...(data.visibilitySettings !== undefined && { visibilitySettings: data.visibilitySettings || null }),
      lastEditedById: ctx.user.id,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_CONFIG_UPDATE",
    targetType: "NRI_CONFIG",
    targetId: "default",
    details: {
      isEnabled: updated.isEnabled,
      heroTitle: updated.heroTitle,
      changedFields: Object.keys(data),
    },
    ip: getClientIp(req),
  });

  return ok(updated);
});
