import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAISystemConfig, updateAISystemConfig } from "@/lib/ai/config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const config = await getAISystemConfig();
    const apiKeyConfigured = Boolean(
      process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
    );

    return NextResponse.json({
      config,
      apiKeyConfigured,
      apiKeyMasked: apiKeyConfigured
        ? "••••••••••••••••"
        : "Not Configured (Running Local Engine)",
      status: config.isEnabled ? "ACTIVE" : "DISABLED",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unauthorized" },
      { status: error.statusCode || 401 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json();

    const updatedConfig = await updateAISystemConfig(body, user.id);

    return NextResponse.json({
      message: "AI Configuration updated successfully",
      config: updatedConfig,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update AI configuration" },
      { status: error.statusCode || 400 }
    );
  }
}
