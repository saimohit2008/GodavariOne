import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkAIRateLimit } from "@/lib/ai/rate-limiter";
import { processUserMessage } from "@/lib/ai/intent-engine";
import { getAISystemConfig } from "@/lib/ai/config";
import type { AIChatRequest } from "@/lib/ai/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Authoritative Persistent Killswitch Check (OPS-01)
    const config = await getAISystemConfig();
    if (!config.isEnabled || process.env.AI_SERVICE_ENABLED === "false") {
      return NextResponse.json(
        {
          error: "AI Assistant is temporarily disabled for scheduled maintenance.",
          reply: "Namaskaram! The AI Assistant is temporarily undergoing system maintenance. Please browse our directory categories directly.",
        },
        { status: 503 }
      );
    }

    // 2. Identify caller & apply shared atomic persistent rate limiting (SEC-01)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userSession = await getCurrentUser(req);
    const identifier = userSession ? `user:${userSession.user.id}` : `ip:${ip}`;

    const capacity = userSession ? 60 : (config.rateLimitPerMin || 30);
    const rateLimit = await checkAIRateLimit(identifier, capacity);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds} seconds before sending another message.`,
          retryAfter: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    // 3. Parse and validate body
    const body = (await req.json()) as AIChatRequest;
    if (!body || typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json(
        { error: "Message is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    const message = body.message.trim();
    if (message.length > 1000) {
      return NextResponse.json(
        { error: "Message length cannot exceed 1,000 characters." },
        { status: 400 }
      );
    }

    // 4. Process user query with grounding, persistent config & budget guard (FIN-01)
    const response = await processUserMessage(message, {
      conversationId: body.conversationId,
      language: body.language,
      messages: body.messages,
      context: body.context,
      userId: userSession?.user.id,
      userRole: userSession?.user.role,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("[AI Chat API Error]", error);
    return NextResponse.json(
      {
        reply: "We experienced a temporary issue processing your request. Please try again or select from the directory menu.",
        conversationId: "conv_fallback",
        language: "en",
        citations: [],
        suggestedQuestions: ["Which ghats are free?", "Where are vegetarian restaurants?"],
        suggestedActions: [],
        emergencyNotice: null,
      },
      { status: 500 }
    );
  }
}
