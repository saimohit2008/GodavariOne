import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

const updateTaskSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  confirmationRef: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

// PATCH /api/v1/nri/requests/[id]/tasks/[taskId]
export const PATCH = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) => {
  const { id, taskId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({ where: { id } });
  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isManager) {
    return fail("Unauthorized to update tasks for this trip", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const updated = await db.nriTripTask.update({
    where: { id: taskId },
    data: parsed.data,
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_TRIP_TASK_UPDATE",
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: id,
    details: { taskId, changes: parsed.data },
    ip: getClientIp(req),
  });

  return ok({ task: updated });
});

// DELETE /api/v1/nri/requests/[id]/tasks/[taskId]
export const DELETE = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) => {
  const { id, taskId } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({ where: { id } });
  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isManager) {
    return fail("Unauthorized to delete tasks for this trip", 403);
  }

  await db.nriTripTask.delete({ where: { id: taskId } });

  return ok({ ok: true, message: "Task deleted" });
});
