import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  revokeRole: z.boolean().optional(),
});

// GET /api/v1/nri/service-managers/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN" && ctx.user.id !== id) {
    return fail("Insufficient permissions", 403);
  }

  const manager = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      managedNriRequests: {
        include: {
          quotations: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!manager) return fail("Manager not found", 404);
  return ok({ manager });
});

// PATCH /api/v1/nri/service-managers/[id]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const { status, name, email, revokeRole } = parsed.data;

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return fail("User not found", 404);

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (name) data.name = name;
  if (email !== undefined) data.email = email;
  if (revokeRole) {
    data.role = "VISITOR"; // Reverts to basic visitor account
  }

  const updated = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: revokeRole ? "ROLE_REVOKE" : "USER_UPDATE",
    targetType: "USER",
    targetId: updated.id,
    details: { changes: parsed.data },
    ip: getClientIp(req),
  });

  await notify({
    userId: updated.id,
    type: "ACCOUNT_STATUS_CHANGE",
    title: revokeRole ? "Role Revoked" : "Account Status Updated",
    message: revokeRole
      ? "Your NRI Service Manager role has been revoked by Super Admin."
      : `Your account status is now ${status || updated.status}.`,
  });

  return ok({ manager: updated });
});
