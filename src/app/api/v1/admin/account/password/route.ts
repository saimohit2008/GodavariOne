import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, hashPassword, audit, notify } from "@/lib/auth";
import { ok, fail, handler, getClientIp, passwordSchema, zodError } from "@/lib/validation";
import { z } from "zod";

// POST /api/v1/admin/account/password
// Securely change Super Admin password with current-password validation and scrypt hashing.
export const POST = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (ctx.user.role !== "SUPER_ADMIN") return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body", 400);

  const schema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  // Verify that new password and confirmation match
  if (newPassword !== confirmPassword) {
    return fail("New password and confirmation password do not match", 400);
  }

  // Fetch complete user record with stored passwordHash
  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
  });

  if (!user || !user.passwordHash) {
    return fail("Admin account has no password configured. Please contact support.", 500);
  }

  // Validate the current password on the server
  const isCurrentValid = verifyPassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    await audit({
      actorId: user.id,
      action: "ADMIN_PASSWORD_CHANGE_FAILED",
      targetType: "USER",
      targetId: user.id,
      ip: getClientIp(req),
      details: { reason: "INCORRECT_CURRENT_PASSWORD" },
    });
    return fail("Incorrect current password. Please verify and try again.", 400);
  }

  // Prevent reusing the exact same password
  if (currentPassword === newPassword) {
    return fail("New password cannot be identical to your current password.", 400);
  }

  // Securely hash the new password using scrypt
  const newPasswordHash = hashPassword(newPassword);

  // Update in database preserving all other fields
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });

  // Record audit log
  await audit({
    actorId: user.id,
    action: "ADMIN_PASSWORD_CHANGED",
    targetType: "USER",
    targetId: user.id,
    ip: getClientIp(req),
    details: { authMethod: "SCRYPT" },
  });

  // Create notification
  await notify({
    userId: user.id,
    type: "SECURITY_UPDATE",
    title: "Password Changed",
    message: "Your Super Admin password was successfully updated. Use this new password for all subsequent logins.",
  });

  return ok({
    ok: true,
    message: "Password updated successfully. Please use your new password for your next login.",
  });
});
