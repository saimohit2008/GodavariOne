import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { ok, created, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(2, "Task title is required"),
  description: z.string().optional().nullable(),
  category: z.enum(["ACCOMMODATION", "TRANSPORT", "VIP_PASS", "PUROHIT", "GUIDE", "MEALS", "GENERAL"]).default("GENERAL"),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  status: z.enum(["PENDING", "IN_PROGRESS", "CONFIRMED", "COMPLETED", "CANCELLED"]).default("PENDING"),
  confirmationRef: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

// GET /api/v1/nri/requests/[id]/tasks
export const GET = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({ where: { id } });
  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;
  const isVisitor = ctx.user.id === request.visitorId || ctx.user.phone === request.visitorPhone;

  if (!isSuperAdmin && !isManager && !isVisitor) {
    return fail("Unauthorized to view trip tasks", 403);
  }

  const tasks = await db.nriTripTask.findMany({
    where: { requestId: id },
    orderBy: { createdAt: "asc" },
  });

  const sanitized = isVisitor
    ? tasks.map(t => ({ ...t, internalNotes: null }))
    : tasks;

  return ok({ tasks: sanitized });
});

// POST /api/v1/nri/requests/[id]/tasks
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx) return fail("Authentication required", 401);

  const request = await db.nriPackageRequest.findUnique({ where: { id } });
  if (!request) return fail("Request not found", 404);

  const isSuperAdmin = ctx.user.role === "SUPER_ADMIN";
  const isManager = ctx.user.role === "NRI_SERVICE_MANAGER" && request.assignedManagerId === ctx.user.id;

  if (!isSuperAdmin && !isManager) {
    return fail("Only assigned NRI Service Manager or Super Admin can create tasks", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Invalid JSON payload", 400);

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const task = await db.nriTripTask.create({
    data: {
      requestId: id,
      ...parsed.data,
    },
  });

  await audit({
    actorId: ctx.user.id,
    action: "NRI_TRIP_TASK_CREATE",
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: id,
    details: { taskTitle: task.title, category: task.category },
    ip: getClientIp(req),
  });

  return created({ task });
});
