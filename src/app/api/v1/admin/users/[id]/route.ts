import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

// GET /api/v1/admin/users/[id]
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, phone: true, email: true, role: true, status: true,
      phoneVerified: true, mfaEnabled: true, createdAt: true, updatedAt: true, notes: true,
      assignments: { include: { listing: { select: { id: true, name: true, category: true } } } },
    },
  });
  if (!user) return fail("User not found", 404);
  return ok({ user });
});

// PATCH /api/v1/admin/users/[id] — update user (status, role within creatable set, name, password)
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().nullable().or(z.literal("")).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
    role: z.enum(["BUSINESS_OWNER", "BOOKING_REVIEWER", "GHAT_SUPERVISOR", "PUROHIT", "NRI_SERVICE_MANAGER", "VISITOR"]).optional(),
    password: z.string().min(6).max(128).optional(),
    notes: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Validation failed", 422);
  const input = parsed.data;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return fail("User not found", 404);

  // Prevent modifying Super Admin system account role or assigning Super Admin here
  if ((input.role as string) === "SUPER_ADMIN") {
    return fail("Cannot assign Super Admin role through this endpoint", 403);
  }
  if (target.role === "SUPER_ADMIN" && input.role) {
    return fail("Cannot modify Super Admin system account role", 403);
  }

  const data: Record<string, unknown> = {};
  if (input.name) data.name = input.name;
  if (input.email !== undefined) data.email = input.email || null;
  if (input.status) data.status = input.status;
  if (input.role) data.role = input.role;
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.password) data.passwordHash = hashPassword(input.password);

  const updated = await db.user.update({ where: { id }, data });
  await audit({
    actorId: ctx.user.id,
    action: "USER_UPDATE",
    targetType: "USER",
    targetId: id,
    details: input,
    ip: getClientIp(req),
  });

  // If account was suspended/deactivated, revoke active sessions
  if (input.status && input.status !== "ACTIVE") {
    await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await notify({
      userId: id,
      type: "ACCOUNT_STATUS",
      title: "Account status updated",
      message: `Your account status is now ${input.status}.`,
    });
  }

  return ok({
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    email: updated.email,
    role: updated.role,
    status: updated.status,
  });
});

// DELETE /api/v1/admin/users/[id] — permanently delete staff member
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") {
    return fail("Insufficient permissions. Only Super Admins can delete staff members.", 403);
  }

  // 1. Locate target user
  const target = await db.user.findUnique({
    where: { id },
  });
  if (!target) return fail("Staff member not found", 404);

  // 2. Prevent deleting the last active Super Admin
  if (target.role === "SUPER_ADMIN" && target.status === "ACTIVE") {
    const activeSuperAdmins = await db.user.count({
      where: { role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    if (activeSuperAdmins <= 1) {
      return fail("Cannot delete the last active Super Admin account to prevent administrative lockout.", 400);
    }
  }

  // 3. Prevent self-deletion of currently logged-in Super Admin
  if (id === ctx.user.id) {
    return fail("You cannot delete your own logged-in Super Admin account.", 400);
  }

  const clientIp = getClientIp(req);

  // 4. Perform atomic permanent deletion and relational cleanup
  await db.$transaction(async (tx: any) => {
    // A. Invalidate and delete active sessions and authentication challenges
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.otpChallenge.deleteMany({ where: { userId: id } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: id } });

    // B. Revoke all operational assignments
    await tx.assignment.deleteMany({ where: { userId: id } });

    // C. Clean up any pending registrations matching this phone or email
    await tx.pendingRegistration.deleteMany({
      where: {
        OR: [
          { phone: target.phone },
          ...(target.email ? [{ email: target.email }] : []),
        ],
      },
    });

    // D. Anonymize/nullify operational foreign keys to preserve historical data integrity
    await tx.listing.updateMany({ where: { ownerId: id }, data: { ownerId: null } });
    await tx.listing.updateMany({ where: { verifiedById: id }, data: { verifiedById: null } });
    await tx.ghatDetails.updateMany({ where: { supervisorId: id }, data: { supervisorId: null } });
    await tx.user.updateMany({ where: { createdById: id }, data: { createdById: null } });

    // E. Remove personal account notifications and favorites
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.favorite.deleteMany({ where: { userId: id } });

    // F. Clean up bookings and reports created by this account
    await tx.restaurantBooking.deleteMany({ where: { userId: id } });
    await tx.hotelBooking.deleteMany({ where: { userId: id } });
    await tx.ghatReport.deleteMany({ where: { reporterId: id } });

    // G. Permanently delete the User record
    await tx.user.delete({ where: { id } });
  });

  // 5. Record an audit event preserving non-sensitive operational history
  await audit({
    actorId: ctx.user.id,
    action: "STAFF_DELETED",
    targetType: "USER",
    targetId: id,
    details: {
      method: "PERMANENT_DELETE",
      deletedUserId: id,
      staffName: target.name,
      staffPhone: target.phone,
      staffRole: target.role,
      deletedAt: new Date().toISOString(),
    },
    ip: clientIp,
  });

  return ok({
    ok: true,
    action: "DELETED",
    message: `Account permanently deleted: Staff member ${target.name || target.phone} (${target.role.replace(/_/g, " ")}) has been permanently removed.`,
    user: { id: target.id, name: target.name, phone: target.phone, role: target.role },
  });
});
