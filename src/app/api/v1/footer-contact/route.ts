import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

// Phone number validation schema
const phoneItemSchema = z.object({
  id: z.string().trim().optional(),
  number: z
    .string()
    .trim()
    .min(3, "Phone number must be at least 3 digits")
    .max(30, "Phone number cannot exceed 30 characters")
    .regex(
      /^[+]?[0-9\s\-()]+$/,
      "Phone number can only contain digits, spaces, hyphens, parentheses, and optional '+' prefix"
    ),
  label: z
    .string()
    .trim()
    .max(50, "Label cannot exceed 50 characters")
    .default("Helpline"),
  isEnabled: z.boolean().default(true),
});

// Footer contact settings payload schema
const footerContactSchema = z.object({
  isEnabled: z.boolean().optional(),
  email: z
    .string()
    .trim()
    .max(100, "Email cannot exceed 100 characters")
    .optional()
    .nullable()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: "Please enter a valid email address" }
    ),
  emailEnabled: z.boolean().optional(),
  phones: z.array(phoneItemSchema).optional(),
  address: z
    .string()
    .trim()
    .max(300, "Address cannot exceed 300 characters")
    .optional()
    .nullable(),
  addressEnabled: z.boolean().optional(),
});

export interface FooterPhoneItem {
  id: string;
  number: string;
  label: string;
  isEnabled: boolean;
}

export interface FooterContactSettingsData {
  email: string | null;
  emailEnabled: boolean;
  phones: FooterPhoneItem[];
  address: string | null;
  addressEnabled: boolean;
}

// GET /api/v1/footer-contact
// Public access: returns enabled contact information without administrative secrets
// Super Admin access: returns full configuration including disabled items and enable toggles
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  const isSuperAdmin = ctx?.user.role === "SUPER_ADMIN";

  const section = await db.homepageSection.findUnique({
    where: { id: "footer_contact" },
  });

  // Unconfigured state
  if (!section) {
    if (isSuperAdmin) {
      return ok({
        id: "footer_contact",
        name: "Footer Contact Settings",
        description: "Public footer contact details, helpline numbers, email, and address",
        isEnabled: true,
        email: null,
        emailEnabled: false,
        phones: [],
        address: null,
        addressEnabled: false,
        isConfigured: false,
      });
    }

    // Public view: unconfigured, so return empty/null fields
    return ok({
      isEnabled: true,
      email: null,
      phones: [],
      address: null,
    });
  }

  let settings: FooterContactSettingsData = {
    email: null,
    emailEnabled: false,
    phones: [],
    address: null,
    addressEnabled: false,
  };

  if (section.settings) {
    try {
      const parsed = JSON.parse(section.settings);
      settings = {
        email: parsed.email || null,
        emailEnabled: parsed.emailEnabled ?? (!!parsed.email),
        phones: Array.isArray(parsed.phones) ? parsed.phones : [],
        address: parsed.address || null,
        addressEnabled: parsed.addressEnabled ?? (!!parsed.address),
      };
    } catch {
      settings = {
        email: null,
        emailEnabled: false,
        phones: [],
        address: null,
        addressEnabled: false,
      };
    }
  }

  // Super Admin receives full configuration
  if (isSuperAdmin) {
    return ok({
      id: section.id,
      name: section.name,
      description: section.description,
      isEnabled: section.isEnabled,
      email: settings.email,
      emailEnabled: settings.emailEnabled,
      phones: settings.phones,
      address: settings.address,
      addressEnabled: settings.addressEnabled,
      updatedAt: section.updatedAt,
      isConfigured: true,
    });
  }

  // Public visitor view
  if (!section.isEnabled) {
    return ok({
      isEnabled: false,
      email: null,
      phones: [],
      address: null,
    });
  }

  const publicEmail = settings.emailEnabled && settings.email?.trim() ? settings.email.trim() : null;
  const publicPhones = Array.isArray(settings.phones)
    ? settings.phones
        .filter((p) => p && p.isEnabled && p.number && p.number.trim().length > 0)
        .map((p) => ({
          id: p.id,
          number: p.number.trim(),
          label: p.label?.trim() || "Helpline",
          isEnabled: true,
        }))
    : [];
  const publicAddress = settings.addressEnabled && settings.address?.trim() ? settings.address.trim() : null;

  return ok({
    isEnabled: true,
    email: publicEmail,
    phones: publicPhones,
    address: publicAddress,
  });
});

// PATCH /api/v1/footer-contact
// Super Admin only: update footer contact settings
export const PATCH = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions to update footer contact settings", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON payload", 400);
  }

  const parsed = footerContactSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "Validation failed",
      422,
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }

  const data = parsed.data;

  // Retrieve existing section if available
  const existing = await db.homepageSection.findUnique({
    where: { id: "footer_contact" },
  });

  let currentSettings: any = {};
  if (existing?.settings) {
    try {
      currentSettings = JSON.parse(existing.settings);
    } catch {
      currentSettings = {};
    }
  }

  const newSettings = {
    email:
      data.email !== undefined
        ? data.email
          ? data.email.trim()
          : null
        : (currentSettings.email ?? null),
    emailEnabled:
      data.emailEnabled !== undefined
        ? data.emailEnabled
        : (currentSettings.emailEnabled ?? true),
    phones:
      data.phones !== undefined
        ? data.phones.map((p, idx) => ({
            id: p.id || `phone_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            number: p.number.trim(),
            label: p.label.trim() || "Helpline",
            isEnabled: p.isEnabled ?? true,
          }))
        : (currentSettings.phones ?? []),
    address:
      data.address !== undefined
        ? data.address
          ? data.address.trim()
          : null
        : (currentSettings.address ?? null),
    addressEnabled:
      data.addressEnabled !== undefined
        ? data.addressEnabled
        : (currentSettings.addressEnabled ?? true),
  };

  const isEnabled = data.isEnabled !== undefined ? data.isEnabled : (existing?.isEnabled ?? true);

  const updated = await db.homepageSection.upsert({
    where: { id: "footer_contact" },
    create: {
      id: "footer_contact",
      name: "Footer Contact Settings",
      description: "Public footer contact details, helpline numbers, email, and address",
      isEnabled,
      orderIdx: 999,
      settings: JSON.stringify(newSettings),
      lastEditedById: ctx.user.id,
    },
    update: {
      name: "Footer Contact Settings",
      description: "Public footer contact details, helpline numbers, email, and address",
      isEnabled,
      settings: JSON.stringify(newSettings),
      lastEditedById: ctx.user.id,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "FOOTER_CONTACT_UPDATE",
    targetType: "FOOTER_CONTACT",
    targetId: "footer_contact",
    details: {
      email: newSettings.email,
      emailEnabled: newSettings.emailEnabled,
      phoneCount: newSettings.phones.length,
      enabledPhoneCount: newSettings.phones.filter((p: any) => p.isEnabled).length,
      address: newSettings.address,
      addressEnabled: newSettings.addressEnabled,
      masterEnabled: isEnabled,
    },
    ip: getClientIp(req),
  });

  return ok({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    isEnabled: updated.isEnabled,
    ...newSettings,
    updatedAt: updated.updatedAt,
  });
});

// DELETE /api/v1/footer-contact
// Super Admin only: reset/clear footer contact settings
export const DELETE = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions to reset footer contact settings", 403);
  }

  const existing = await db.homepageSection.findUnique({
    where: { id: "footer_contact" },
  });

  if (existing) {
    await db.homepageSection.update({
      where: { id: "footer_contact" },
      data: {
        settings: JSON.stringify({
          email: null,
          emailEnabled: false,
          phones: [],
          address: null,
          addressEnabled: false,
        }),
        lastEditedById: ctx.user.id,
      },
    });

    await audit({
      actorId: ctx.user.id,
      action: "FOOTER_CONTACT_RESET",
      targetType: "FOOTER_CONTACT",
      targetId: "footer_contact",
      details: { reset: true },
      ip: getClientIp(req),
    });
  }

  return ok({ message: "Footer contact settings reset successfully" });
});
