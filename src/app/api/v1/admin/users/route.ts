import { NextRequest } from "next/server";
import { db, containsInsensitive } from "@/lib/db";
import { getCurrentUser, hashPassword, createSession, audit, notify } from "@/lib/auth";
import { ok, created, fail, handler, phoneSchema, passwordSchema, roleSchema, zodError, getClientIp } from "@/lib/validation";
import { ADMIN_CREATABLE_ROLES, canCreateRole } from "@/lib/constants";
import { z } from "zod";

// GET /api/v1/admin/users — list users (Super Admin only)
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") || undefined;
  const status = searchParams.get("status") || undefined;
  const q = searchParams.get("q") || undefined;

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: containsInsensitive(q) },
      { phone: containsInsensitive(q) },
      { email: containsInsensitive(q) },
    ];
  }

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      phoneVerified: true,
      mfaEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const total = await db.user.count({ where });
  return ok({ items: users, total });
});

// POST /api/v1/admin/users — create an operational account (Super Admin only)
// Visitors CANNOT be created here — only the 5 operational roles.
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const schema = z.object({
    name: z.string().min(1).max(100),
    phone: phoneSchema,
    email: z.string().email().optional().nullable().or(z.literal("")),
    password: passwordSchema,
    role: roleSchema, // ONLY the 5 operational roles (Visitor excluded by schema)
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { name, phone, email, password, role } = parsed.data;

  // Double enforcement: backend rejects Visitor explicitly
  if ((role as string) === "VISITOR") {
    return fail("Visitors must self-register through the public registration flow", 403);
  }
  if (!canCreateRole(ctx.user.role as any, role)) {
    return fail(`Not permitted to create role: ${role}`, 403);
  }
  if (!ADMIN_CREATABLE_ROLES.includes(role)) {
    return fail(`Invalid role. Allowed: ${ADMIN_CREATABLE_ROLES.join(", ")}`, 400);
  }

  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) return fail("A user with this phone already exists", 409);

  const user = await db.user.create({
    data: {
      name,
      phone,
      email: email || null,
      role,
      status: "ACTIVE",
      passwordHash: hashPassword(password),
      phoneVerified: true,
      createdById: ctx.user.id,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "USER_CREATE",
    targetType: "USER",
    targetId: user.id,
    details: { name, phone, role },
    ip: getClientIp(req),
  });

  await notify({
    userId: user.id,
    type: "ACCOUNT_CREATED",
    title: "Welcome to Godavari One",
    message: `Your ${role.replace(/_/g, " ")} account was created by an administrator.`,
  });

  return created({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
  });
});
