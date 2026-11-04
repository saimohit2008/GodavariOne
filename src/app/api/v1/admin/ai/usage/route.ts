import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAIMonthlyUsageMetrics } from "@/lib/ai/spending-guard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const analytics = await getAIMonthlyUsageMetrics();

    return NextResponse.json({
      metrics: {
        totalRequests: analytics.totalRequests,
        successfulRequests: analytics.successfulRequests,
        failedRequests: analytics.failedRequests,
        rateLimitedRequests: analytics.rateLimitedRequests,
        estimatedTotalTokens: analytics.estimatedTotalTokens,
        estimatedCostUsd: analytics.estimatedCostUsd,
        monthlyBudgetUsd: analytics.monthlyBudgetUsd,
        activeProvider: analytics.activeProvider,
        activeModel: analytics.activeModel,
      },
      recentEvents: analytics.recentEvents,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unauthorized" },
      { status: error.statusCode || 401 }
    );
  }
}
