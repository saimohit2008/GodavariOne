import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler, getClientIp } from "@/lib/validation";
import { z } from "zod";
import { recordNriStatusChange, sendNriWorkflowNotification } from "@/lib/nri";

const assignSchema = z.object({
  providerIds: z.array(z.string()).min(1, "At least one provider ID required"),
  replaceExisting: z.boolean().default(false),
  reason: z.string().optional(),
});

// POST /api/v1/nri/requests/[id]/assign
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Super Admin access required", 403);
  }

  const request = await db.nriPackageRequest.findUnique({
    where: { id },
    include: { assignments: true },
  });

  if (!request) return fail("Request not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return fail("Validation failed", 422, parsed.error.issues);

  const { providerIds, replaceExisting, reason } = parsed.data;

  // Validate providers exist and are active business owners
  const providers = await db.user.findMany({
    where: {
      id: { in: providerIds },
      role: "BUSINESS_OWNER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, phone: true, email: true },
  });

  if (providers.length === 0) {
    return fail("No valid, active Business Owners found from provided IDs", 400);
  }

  if (replaceExisting) {
    await db.nriRequestAssignment.deleteMany({
      where: { requestId: id },
    });
  }

  for (const provider of providers) {
    await db.nriRequestAssignment.upsert({
      where: {
        requestId_providerId: {
          requestId: id,
          providerId: provider.id,
        },
      },
      create: {
        requestId: id,
        providerId: provider.id,
        status: "ASSIGNED",
      },
      update: {
        status: "ASSIGNED",
        declineReason: null,
      },
    });

    // Notify provider
    await sendNriWorkflowNotification({
      userId: provider.id,
      recipientEmail: provider.email,
      recipientName: provider.name,
      type: "NRI_REQUEST_ASSIGNED",
      title: "Assigned NRI Package Request",
      message: `Administrator assigned custom package request (${request.referenceNumber}) for ${request.groupSize} travelers (${request.arrivalDate} to ${request.departureDate}) to your business account.`,
      link: "/owner-dashboard",
    });
  }

  // Update status to ASSIGNED if previously SUBMITTED or DECLINED
  if (request.status === "SUBMITTED" || request.status === "DECLINED") {
    await db.nriPackageRequest.update({
      where: { id },
      data: { status: "ASSIGNED" },
    });
  }

  await recordNriStatusChange({
    requestId: id,
    fromStatus: request.status,
    toStatus: "ASSIGNED",
    changedById: ctx.user.id,
    changedByName: ctx.user.name || "Administrator",
    reason: reason || `Assigned to ${providers.length} provider(s): ${providers.map((p) => p.name || p.phone).join(", ")}`,
    ip: getClientIp(req),
  });

  return ok({
    ok: true,
    assignedCount: providers.length,
    message: `Successfully assigned to ${providers.length} provider(s)`,
  });
});
