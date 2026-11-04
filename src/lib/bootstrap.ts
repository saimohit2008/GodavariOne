// Bootstrap: ensure an initial Super Admin exists from env config.
// Safe to call repeatedly — no-op if a super admin already exists.

import { db } from "./db";
import { hashPassword } from "./auth";

export async function ensureBootstrapAdmin() {
  const existing = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (existing) return { created: false };

  const phone = process.env.BOOTSTRAP_ADMIN_PHONE;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "Super Admin";

  if (!phone || !password) {
    return { created: false, reason: "no_bootstrap_credentials" };
  }

  const user = await db.user.create({
    data: {
      phone,
      name,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      phoneVerified: true,
      passwordHash: hashPassword(password),
    },
  });

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "BOOTSTRAP_SUPER_ADMIN",
      targetType: "USER",
      targetId: user.id,
      details: JSON.stringify({ phone }),
    },
  });

  return { created: true, userId: user.id };
}
