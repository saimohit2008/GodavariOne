import { NextRequest } from "next/server";
import { db, containsInsensitive } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/validation";

// GET /api/v1/admin/notifications — Management listing and stats for email notifications
export const GET = handler(async (req: NextRequest) => {
  const ctx = await getCurrentUser(req);
  if (!ctx || ctx.user.role !== "SUPER_ADMIN") {
    return fail("Access denied. System Administrator permissions required.", 403);
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const status = (searchParams.get("status") || "ALL").toUpperCase();
  const eventType = searchParams.get("eventType") || "ALL";
  const search = (searchParams.get("search") || "").trim();

  const where: any = {};

  if (status !== "ALL") {
    where.status = status;
  }
  if (eventType !== "ALL") {
    where.eventType = eventType;
  }
  if (search) {
    where.OR = [
      { recipientEmail: containsInsensitive(search) },
      { bookingReference: containsInsensitive(search) },
      { subject: containsInsensitive(search) },
      { recipientName: containsInsensitive(search) },
    ];
  }

  const [total, sent, pending, failed, cancelled, items] = await Promise.all([
    db.emailNotification.count({ where }),
    db.emailNotification.count({ where: { ...where, status: "SENT" } }),
    db.emailNotification.count({ where: { ...where, status: "PENDING" } }),
    db.emailNotification.count({ where: { ...where, status: "FAILED" } }),
    db.emailNotification.count({ where: { ...where, status: "CANCELLED" } }),
    db.emailNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, phone: true, role: true } },
      },
    }),
  ]);

  const sanitizedItems = items.map((item) => {
    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(item.payload);
    } catch {
      parsedPayload = {};
    }

    return {
      id: item.id,
      eventType: item.eventType,
      userId: item.userId,
      userName: item.user?.name || item.recipientName,
      bookingId: item.bookingId,
      bookingReference: item.bookingReference,
      bookingCategory: item.bookingCategory,
      recipientEmail: item.recipientEmail,
      recipientName: item.recipientName,
      language: item.language,
      subject: item.subject,
      status: item.status,
      attemptCount: item.attemptCount,
      maxAttempts: item.maxAttempts,
      providerMessageId: item.providerMessageId,
      scheduledFor: item.scheduledFor,
      sentAt: item.sentAt,
      lastError: item.lastError,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      payloadSummary: {
        customerName: parsedPayload.customerName,
        serviceName: parsedPayload.serviceName,
        bookingDate: parsedPayload.bookingDate,
        bookingTime: parsedPayload.bookingTime,
        status: parsedPayload.status,
        rejectionReason: parsedPayload.rejectionReason,
        cancellationReason: parsedPayload.cancellationReason,
      },
    };
  });

  return ok({
    ok: true,
    items: sanitizedItems,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    stats: {
      total,
      sent,
      pending,
      failed,
      cancelled,
    },
  });
});
