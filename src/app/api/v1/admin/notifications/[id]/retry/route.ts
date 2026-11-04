import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, audit } from "@/lib/auth";
import { dispatchNotification } from "@/lib/email-service";
import { ok, fail, handler, getClientIp } from "@/lib/validation";

// POST /api/v1/admin/notifications/[id]/retry — Authorized manual retry of a failed notification
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Access denied. System Administrator permissions required.", 403);
  }

  const notification = await db.emailNotification.findUnique({
    where: { id },
  });

  if (!notification) {
    return fail("Notification record not found", 404);
  }

  // Reset retry attempts and status to PENDING
  await db.emailNotification.update({
    where: { id },
    data: {
      status: "PENDING",
      attemptCount: 0,
      scheduledFor: new Date(),
      lastError: null,
      updatedAt: new Date(),
    },
  });

  // Attempt dispatch immediately
  const result = await dispatchNotification(id);

  // Record audit log
  await audit({
    actorId: ctx.user.id,
    action: "ADMIN_NOTIFICATION_RETRY",
    targetType: "EMAIL_NOTIFICATION",
    targetId: id,
    details: {
      recipientEmail: notification.recipientEmail,
      eventType: notification.eventType,
      bookingReference: notification.bookingReference,
      retryResult: result,
    },
    ip: getClientIp(req),
  });

  if (!result.success) {
    return fail(`Retry attempted but delivery failed: ${result.error}`, 502);
  }

  return ok({
    ok: true,
    message: "Notification successfully retried and sent via Resend",
    messageId: result.messageId,
  });
});
