import { NextRequest } from "next/server";
import { processOutboxBatch } from "@/lib/email-service";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";

// POST & GET /api/v1/notifications/cron — Process scheduled and pending automated email notifications
async function handleCron(req: NextRequest) {
  // Security verification
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || req.headers.get("x-cron-secret") || "";
  const isSecretMatch = Boolean(cronSecret && (authHeader === cronSecret || authHeader === `Bearer ${cronSecret}`));

  if (!isSecretMatch) {
    // Check if caller has an active SUPER_ADMIN session
    const ctx = await getCurrentUser(req);
    const isSuperAdmin = ctx?.user?.role === "SUPER_ADMIN";
    const isDevOrTest = process.env.NODE_ENV !== "production";

    if (!isSuperAdmin && !isDevOrTest) {
      return fail("Unauthorized cron trigger", 401);
    }
  }

  const batchSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 50)));
  const result = await processOutboxBatch(batchSize);

  return ok({
    ok: true,
    message: "Outbox processing complete",
    ...result,
    timestamp: new Date().toISOString(),
  });
}

export const GET = handler(handleCron);
export const POST = handler(handleCron);
