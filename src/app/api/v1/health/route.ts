import { db } from "@/lib/db";
import { ok, handler } from "@/lib/validation";

// GET /api/v1/health
export const GET = handler(async () => {
  try {
    // touch the DB to confirm connectivity
    await db.user.count();
    return ok({ status: "ok", db: "connected", time: new Date().toISOString() });
  } catch (e) {
    return ok({ status: "degraded", db: "error", error: e instanceof Error ? e.message : "unknown" });
  }
});
