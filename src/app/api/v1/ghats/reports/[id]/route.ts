import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, zodError, getClientIp } from "@/lib/validation";
import { canSuperviseGhats } from "@/lib/constants";
import { z } from "zod";

// PATCH /api/v1/ghats/reports/[id] — supervisor acknowledges/escalates/resolves
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser();
  if (!ctx) return fail("Authentication required", 401);
  if (!canSuperviseGhats(ctx.user.role as any)) return fail("Insufficient permissions", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON body");
  const schema = z.object({
    reviewStatus: z.enum(["ACKNOWLEDGED", "ESCALATED", "RESOLVED"]),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const report = await db.ghatReport.findUnique({ where: { id } });
  if (!report) return fail("Report not found", 404);

  const updated = await db.ghatReport.update({
    where: { id },
    data: { reviewStatus: parsed.data.reviewStatus, acknowledgedById: ctx.user.id, acknowledgedAt: new Date() },
  });
  await audit({ actorId: ctx.user.id, action: `GHAT_REPORT_${parsed.data.reviewStatus}`, targetType: "GHAT_REPORT", targetId: id, ip: getClientIp(req) });
  return ok(updated);
});
