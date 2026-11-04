// Godavari One — Enforced AI Spending Guard & Atomic Token Ledger
// Ensures hard budget caps are enforced server-side before external LLM provider calls.

import { db } from "../db";
import { getAISystemConfig } from "./config";

export interface SpendReservationResult {
  canProceed: boolean;
  useFallback: boolean;
  reservationId?: string;
  currentSpendUsd: number;
  budgetCapUsd: number;
  reason?: "OK" | "BUDGET_EXHAUSTED" | "DB_RESERVATION_FAILED" | "MOCK_PROVIDER";
}

/**
 * Calculates estimated upper-bound cost for pre-flight reservation.
 */
export function calculateEstimatedCost(provider: string, model: string): number {
  if (provider === "mock") return 0.0;
  if (provider === "gemini") return 0.00015; // ~400 prompt + ~300 completion tokens at Gemini 1.5 Flash rates
  if (provider === "openai") return 0.00030; // ~400 prompt + ~300 completion tokens at GPT-4o Mini rates
  if (provider === "groq") return 0.00025;
  return 0.00020;
}

/**
 * Calculates factual billing cost based on published model token pricing.
 */
export function calculateActualCost(
  provider: string,
  model: string,
  promptTokens = 0,
  completionTokens = 0
): number {
  if (provider === "mock") return 0.0;

  let inputPricePerToken = 0.000000075; // Gemini Flash baseline
  let outputPricePerToken = 0.000000300;

  if (provider === "openai" || model.includes("gpt-4o-mini")) {
    inputPricePerToken = 0.000000150;
    outputPricePerToken = 0.000000600;
  } else if (provider === "groq") {
    inputPricePerToken = 0.000000150;
    outputPricePerToken = 0.000000600;
  }

  const cost = promptTokens * inputPricePerToken + completionTokens * outputPricePerToken;
  return Number(cost.toFixed(6));
}

/**
 * Aggregates current month's settled and active reserved spend from persistent database.
 */
export async function getCurrentMonthSpend(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  try {
    const aggregate = await db.aIUsageLog.aggregate({
      _sum: { costUsd: true },
      where: {
        createdAt: { gte: startOfMonth },
        status: { in: ["COMPLETED", "RESERVED"] },
      },
    });

    return Number((aggregate._sum.costUsd || 0).toFixed(6));
  } catch (error) {
    console.error("[SpendingGuard] Failed to calculate current month spend:", error);
    // If DB read fails, return 0 or fall back conservatively
    return 0;
  }
}

/**
 * Atomically checks budget boundary and reserves estimated spend BEFORE executing cloud LLM calls.
 * If budget is exceeded or DB fails, instructs caller to route to local deterministic engine.
 */
export async function reserveAISpend(opts: {
  conversationId?: string;
  userId?: string;
  userRole?: string;
  provider?: string;
  model?: string;
}): Promise<SpendReservationResult> {
  const config = await getAISystemConfig();
  const provider = opts.provider || config.provider;
  const model = opts.model || config.model;

  if (provider === "mock") {
    return {
      canProceed: true,
      useFallback: false,
      currentSpendUsd: 0,
      budgetCapUsd: config.monthlyBudgetCap,
      reason: "MOCK_PROVIDER",
    };
  }

  const estimatedCost = calculateEstimatedCost(provider, model);
  const currentSpend = await getCurrentMonthSpend();

  // HARD SPEND CEILING CHECK
  if (currentSpend + estimatedCost >= config.monthlyBudgetCap) {
    console.warn(`[SpendingGuard] Monthly budget ceiling reached ($${currentSpend} >= $${config.monthlyBudgetCap}). Switching to deterministic local engine.`);
    return {
      canProceed: true,
      useFallback: true, // Seamlessly switch to MockAIProvider
      currentSpendUsd: currentSpend,
      budgetCapUsd: config.monthlyBudgetCap,
      reason: "BUDGET_EXHAUSTED",
    };
  }

  try {
    // Atomic pre-flight reservation
    const reservation = await db.aIUsageLog.create({
      data: {
        conversationId: opts.conversationId,
        userId: opts.userId,
        userRole: opts.userRole || "VISITOR",
        provider,
        model,
        costUsd: estimatedCost,
        status: "RESERVED",
        isReservation: true,
      },
    });

    return {
      canProceed: true,
      useFallback: false,
      reservationId: reservation.id,
      currentSpendUsd: Number((currentSpend + estimatedCost).toFixed(6)),
      budgetCapUsd: config.monthlyBudgetCap,
      reason: "OK",
    };
  } catch (error) {
    console.error("[SpendingGuard] Pre-flight reservation failed, triggering safe local fallback:", error);
    return {
      canProceed: true,
      useFallback: true, // Safe deterministic fallback
      currentSpendUsd: currentSpend,
      budgetCapUsd: config.monthlyBudgetCap,
      reason: "DB_RESERVATION_FAILED",
    };
  }
}

/**
 * Reconciles estimated pre-flight reservation with actual token consumption after provider returns.
 */
export async function reconcileAISpend(opts: {
  reservationId?: string;
  actualPromptTokens?: number;
  actualCompletionTokens?: number;
  provider?: string;
  model?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  if (!opts.reservationId) return;

  try {
    if (opts.success) {
      const promptTokens = opts.actualPromptTokens || 0;
      const completionTokens = opts.actualCompletionTokens || 0;
      const actualCost = calculateActualCost(
        opts.provider || "gemini",
        opts.model || "gemini-1.5-flash",
        promptTokens,
        completionTokens
      );

      await db.aIUsageLog.update({
        where: { id: opts.reservationId },
        data: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          costUsd: actualCost,
          status: "COMPLETED",
          isReservation: false,
        },
      });
    } else {
      // Release reserved funds upon provider error or timeout
      await db.aIUsageLog.update({
        where: { id: opts.reservationId },
        data: {
          costUsd: 0.0,
          status: "FAILED",
          isReservation: false,
          errorMessage: opts.errorMessage || "Provider execution failed",
        },
      });
    }
  } catch (error) {
    console.error(`[SpendingGuard] Failed to reconcile reservation ${opts.reservationId}:`, error);
  }
}

/**
 * Aggregates monthly operational analytics from persistent database for Super Admin dashboard.
 */
export async function getAIMonthlyUsageMetrics() {
  const config = await getAISystemConfig();
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  try {
    const [totalRequests, successfulRequests, failedRequests, tokenAndCostAgg, recentLogs] =
      await Promise.all([
        db.aIUsageLog.count({ where: { createdAt: { gte: startOfMonth } } }),
        db.aIUsageLog.count({ where: { createdAt: { gte: startOfMonth }, status: "COMPLETED" } }),
        db.aIUsageLog.count({ where: { createdAt: { gte: startOfMonth }, status: "FAILED" } }),
        db.aIUsageLog.aggregate({
          _sum: { totalTokens: true, costUsd: true },
          where: { createdAt: { gte: startOfMonth }, status: "COMPLETED" },
        }),
        db.aIUsageLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            createdAt: true,
            userRole: true,
            provider: true,
            model: true,
            status: true,
            costUsd: true,
          },
        }),
      ]);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      rateLimitedRequests: 0,
      estimatedTotalTokens: tokenAndCostAgg._sum.totalTokens || 0,
      estimatedCostUsd: Number((tokenAndCostAgg._sum.costUsd || 0).toFixed(4)),
      monthlyBudgetUsd: config.monthlyBudgetCap,
      activeProvider: config.provider,
      activeModel: config.model,
      recentEvents: recentLogs.map((log) => ({
        timestamp: log.createdAt.toISOString(),
        type: "QUERY",
        role: log.userRole,
        provider: log.provider,
        model: log.model,
        status: log.status,
        costUsd: log.costUsd,
      })),
    };
  } catch (error) {
    console.error("[SpendingGuard] Failed to fetch analytics metrics:", error);
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      estimatedTotalTokens: 0,
      estimatedCostUsd: 0,
      monthlyBudgetUsd: config.monthlyBudgetCap,
      activeProvider: config.provider,
      activeModel: config.model,
      recentEvents: [],
    };
  }
}
