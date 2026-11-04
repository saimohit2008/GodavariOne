import { NextRequest } from "next/server";
import { db, containsInsensitive } from "@/lib/db";
import { getCurrentUser, hashPassword, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, phoneSchema, passwordSchema, zodError, getClientIp } from "@/lib/validation";
import { z } from "zod";

// GET /api/v1/nri/service-managers — List NRI Service Managers (Super Admin only)
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const q = searchParams.get("q") || undefined;

  const where: Record<string, unknown> = {
    role: "NRI_SERVICE_MANAGER",
  };
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { name: containsInsensitive(q) },
      { phone: containsInsensitive(q) },
      { email: containsInsensitive(q) },
    ];
  }

  const managers = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      phoneVerified: true,
      createdAt: true,
      updatedAt: true,
      managedNriRequests: {
        select: {
          id: true,
          status: true,
          referenceNumber: true,
        },
      },
    },
  });

  const formatted = managers.map(m => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    email: m.email,
    role: m.role,
    status: m.status,
    phoneVerified: m.phoneVerified,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    assignedCount: m.managedNriRequests.length,
    activeRequestsCount: m.managedNriRequests.filter(r => !["CONFIRMED", "CANCELLED", "DECLINED", "CLOSED"].includes(r.status)).length,
    completedRequestsCount: m.managedNriRequests.filter(r => r.status === "CONFIRMED").length,
  }));

  return ok({ items: formatted, total: formatted.length });
});

const createManagerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  fullName: z.string().min(2).max(100).optional(),
  phone: phoneSchema,
  email: z.string().email("Valid email required").optional().nullable().or(z.literal("")),
  password: passwordSchema,
}).refine(data => Boolean(data.name || data.fullName), {
  message: "Name is required",
  path: ["name"],
});

// POST /api/v1/nri/service-managers — Create an NRI Service Manager account (Super Admin only)
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = createManagerSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const resolvedName = (parsed.data.name || parsed.data.fullName)!;
  const { phone, email, password } = parsed.data;
  const name = resolvedName;

  // Check phone uniqueness
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    // If user exists, Super Admin can promote/assign role if not already
    if (existing.role === "NRI_SERVICE_MANAGER") {
      return fail("A user with this phone number is already an NRI Service Manager", 409);
    }
    const updated = await db.user.update({
      where: { id: existing.id },
      data: {
        role: "NRI_SERVICE_MANAGER",
        status: "ACTIVE",
        name: name || existing.name,
        email: email || existing.email,
      },
    });

    await audit({
      actorId: ctx.user.id,
      action: "ROLE_ASSIGN",
      targetType: "USER",
      targetId: updated.id,
      details: { previousRole: existing.role, newRole: "NRI_SERVICE_MANAGER" },
      ip: getClientIp(req),
    });

    await notify({
      userId: updated.id,
      type: "ROLE_ASSIGNED",
      title: "NRI Service Manager Role Assigned",
      message: "You have been assigned the NRI Service Manager role by Super Admin.",
      link: "/admin",
    });

    return created({
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      assignedCount: 0,
    });
  }

  // Create new user
  const user = await db.user.create({
    data: {
      name,
      phone,
      email: email || null,
      passwordHash: hashPassword(password),
      role: "NRI_SERVICE_MANAGER",
      status: "ACTIVE",
      phoneVerified: true,
      createdById: ctx.user.id,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "USER_CREATE",
    targetType: "USER",
    targetId: user.id,
    details: { name, phone, role: "NRI_SERVICE_MANAGER" },
    ip: getClientIp(req),
  });

  await notify({
    userId: user.id,
    type: "ACCOUNT_CREATED",
    title: "NRI Service Manager Account Created",
    message: "Your dedicated NRI Service Manager account has been established. You can now coordinate client pilgrimage requests.",
  });

  return created({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    assignedCount: 0,
  });
});
