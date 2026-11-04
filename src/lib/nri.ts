import crypto from "crypto";
import { db } from "./db";
import { notify, audit } from "./auth";
import { sendEmail } from "./email";
import type { NriRequestStatus, NriLineItemInput } from "./nri-constants";

export function generateReferenceNumber(): string {
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `NRI-2027-${rand}`;
}

export function generateQuotationNumber(): string {
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `QTE-2027-${rand}`;
}

/**
 * Identify active, authorized Business Owners eligible to provide complete packages
 * (travel, accommodation, transport, pilgrimage services).
 */
export async function getEligibleBusinessOwners(targetProviderId?: string | null) {
  if (targetProviderId) {
    const specific = await db.user.findFirst({
      where: {
        id: targetProviderId,
        role: "BUSINESS_OWNER",
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        listingsOwned: {
          select: { id: true, name: true, category: true },
        },
      },
    });
    return specific ? [specific] : [];
  }

  // Find all active Business Owners who own published listings in relevant travel/stay/transport categories
  const relevantCategories = ["HOTEL", "TRANSPORT", "TOURIST_SPOT", "RESTAURANT"];

  const owners = await db.user.findMany({
    where: {
      role: "BUSINESS_OWNER",
      status: "ACTIVE",
      listingsOwned: {
        some: {
          category: { in: relevantCategories },
          publicationStatus: "PUBLISHED",
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      listingsOwned: {
        select: { id: true, name: true, category: true },
      },
    },
    take: 50,
  });

  return owners;
}

/**
 * Server-side calculation and verification of quotation totals from line items.
 */
export function calculateServerPricing(params: {
  groupSize: number;
  lineItems: NriLineItemInput[];
  accommodationCost?: number;
  transportCost?: number;
  foodCost?: number;
  guideCost?: number;
  otherCharges?: number;
  taxAmount?: number;
  discountAmount?: number;
  manuallyAgreedTotal?: number;
  pricingExplanation?: string;
}) {
  const groupSize = Math.max(1, params.groupSize || 1);

  // Calculate sum from line items if provided
  let lineItemSum = 0;
  for (const item of params.lineItems) {
    const qty = Math.max(1, item.quantity || 1);
    const unit = Math.max(0, item.unitPrice || 0);
    const total = item.totalPrice !== undefined ? item.totalPrice : unit * qty;
    lineItemSum += total;
  }

  const accommodationCost = Math.max(0, params.accommodationCost ?? 0);
  const transportCost = Math.max(0, params.transportCost ?? 0);
  const foodCost = Math.max(0, params.foodCost ?? 0);
  const guideCost = Math.max(0, params.guideCost ?? 0);
  const otherCharges = Math.max(0, params.otherCharges ?? 0);
  const taxAmount = Math.max(0, params.taxAmount ?? 0);
  const discountAmount = Math.max(0, params.discountAmount ?? 0);

  const subtotalCategories = accommodationCost + transportCost + foodCost + guideCost + otherCharges;
  const computedTotal = Math.max(0, subtotalCategories + taxAmount - discountAmount);

  let finalTotal = computedTotal;
  // If line items were supplied and total differs, prioritize validated item sum
  if (lineItemSum > 0 && Math.abs(lineItemSum - computedTotal) > 1 && subtotalCategories === 0) {
    finalTotal = Math.max(0, lineItemSum + taxAmount - discountAmount);
  }

  // If a provider entered a manually agreed total, validate and record it
  if (params.manuallyAgreedTotal !== undefined && params.manuallyAgreedTotal > 0) {
    if (!params.pricingExplanation || params.pricingExplanation.trim().length < 5) {
      throw new Error("A pricing explanation is required when entering a manually agreed package total.");
    }
    finalTotal = Math.max(0, params.manuallyAgreedTotal);
  }

  const pricePerPerson = Math.round(finalTotal / groupSize);

  return {
    accommodationCost,
    transportCost,
    foodCost,
    guideCost,
    otherCharges,
    taxAmount,
    discountAmount,
    totalPrice: finalTotal,
    pricePerPerson,
  };
}

/**
 * Record a status change in audit and status history
 */
export async function recordNriStatusChange(opts: {
  requestId: string;
  fromStatus: string;
  toStatus: string;
  changedById?: string;
  changedByName?: string;
  reason?: string;
  ip?: string;
}) {
  await db.nriStatusHistory.create({
    data: {
      requestId: opts.requestId,
      fromStatus: opts.fromStatus,
      toStatus: opts.toStatus,
      changedById: opts.changedById || null,
      changedByName: opts.changedByName || "System",
      reason: opts.reason || null,
    },
  });

  await audit({
    actorId: opts.changedById,
    action: `NRI_REQUEST_STATUS_${opts.toStatus}`,
    targetType: "NRI_PACKAGE_REQUEST",
    targetId: opts.requestId,
    details: {
      fromStatus: opts.fromStatus,
      toStatus: opts.toStatus,
      reason: opts.reason,
    },
    ip: opts.ip,
  });
}

/**
 * Send in-app and email notifications for NRI workflow events
 */
export async function sendNriWorkflowNotification(opts: {
  userId?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  // 1. In-app notification if user is registered
  if (opts.userId) {
    await notify({
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link,
    });
  }

  // 2. Email delivery if recipient email is available
  if (opts.recipientEmail) {
    try {
      await sendEmail({
        to: opts.recipientEmail,
        subject: `[Godavari One] ${opts.title}`,
        text: `${opts.message}\n\nView details: ${process.env.APP_BASE_URL || "http://localhost:3000"}${opts.link || "/nri-access"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0f2fe; border-radius: 8px;">
            <div style="background: linear-gradient(135deg, #0f766e, #0891b2); padding: 16px; border-radius: 6px; color: white; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">Godavari One — Pushkaralu 2027</h2>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">NRI & Global Pilgrimage Desk</p>
            </div>
            <div style="padding: 20px 0;">
              <h3 style="color: #0f766e; margin-top: 0;">${opts.title}</h3>
              <p style="color: #334155; line-height: 1.6; font-size: 15px;">${opts.message}</p>
              ${
                opts.link
                  ? `<div style="text-align: center; margin: 24px 0;">
                      <a href="${process.env.APP_BASE_URL || "http://localhost:3000"}${opts.link}" style="background: #0f766e; color: white; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Package Request</a>
                    </div>`
                  : ""
              }
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 12px; color: #64748b; text-align: center;">
              Godavari One · Official Pushkaralu 2027 Digital Platform · Rajahmundry, Andhra Pradesh
            </div>
          </div>
        `,
      });
    } catch {
      // Email failure should never break request flow
    }
  }
}
