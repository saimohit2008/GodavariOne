import { NextRequest, NextResponse } from "next/server";
import { requireRole, audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAdminOperationalSummary } from "@/lib/ai/tools";
import { getAIProvider } from "@/lib/ai/provider";
import { getAISystemConfig } from "@/lib/ai/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate & authorize: only SUPER_ADMIN and GHAT_SUPERVISOR
    const { user } = await requireRole(["SUPER_ADMIN", "GHAT_SUPERVISOR"], req);

    const body = await req.json();
    const query = (body.message || "").trim();
    if (!query) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (query.length > 1000) {
      return NextResponse.json(
        { error: "Message length cannot exceed 1,000 characters." },
        { status: 400 }
      );
    }

    let operationalContext = "";

    // 2. Role-specific scoping
    if (user.role === "GHAT_SUPERVISOR") {
      // Find assigned ghats for this supervisor
      const assignments = await db.assignment.findMany({
        where: { userId: user.id, type: "GHAT_SUPERVISOR" },
        include: {
          listing: {
            include: {
              ghatDetails: true,
              schedule: true,
            },
          },
        },
      });

      const assignedGhatIds = assignments.map((a) => a.listingId).filter(Boolean) as string[];

      // Recent ground reports for assigned ghats
      const reports = await db.ghatReport.findMany({
        where: { listingId: { in: assignedGhatIds } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { reporter: { select: { name: true } }, listing: { select: { name: true } } },
      });

      operationalContext = [
        `SUPERVISOR SCOPED OPERATIONAL DATA:`,
        `Supervisor Name: ${user.name || "Ghat Supervisor"}`,
        `Assigned Ghats (${assignments.length}):`,
        ...assignments.map(
          (a) =>
            `- ${a.listing?.name}: Crowd=${a.listing?.ghatDetails?.currentCrowdStatus || "FREE"}, Closed=${a.listing?.schedule?.isTemporarilyClosed ? "YES" : "NO"}`
        ),
        `Recent Ground Reports:`,
        ...reports.map(
          (r) =>
            `- [${r.reviewStatus}] ${r.listing?.name}: ${r.crowdStatus} - ${r.notes || "No notes"} (By ${r.reporter?.name || "Reporter"})`
        ),
      ].join("\n");
    } else {
      // SUPER_ADMIN has global system scope
      operationalContext = await getAdminOperationalSummary();
    }

    // 3. System Prompt for Admin Assistant
    const systemPrompt = `You are the "Godavari One Administrative AI Copilot".
You assist authorized ${user.role === "SUPER_ADMIN" ? "Super Administrators" : "Ghat Supervisors"} with operational analytics.

RULES:
1. ONLY cite verified facts from the Operational Context below. NEVER fabricate statistics or booking numbers.
2. Maintain professional, concise, executive tone.
3. For supervisors, never mention or disclose records from unassigned ghats.
4. Summaries must state the exact numbers reported by the system.

Operational Context:
${operationalContext}`;

    const config = await getAISystemConfig();
    const provider = getAIProvider({
      provider: config.provider,
      model: config.model,
      forceMock: !config.isEnabled || process.env.AI_SERVICE_ENABLED === "false",
    });
    const result = await provider.generateCompletion({
      systemPrompt,
      messages: [{ role: "user", content: query }],
      temperature: 0.2,
      maxTokens: 600,
    });

    const reply = provider.name === "mock"
      ? `${result.text.trim()}\n\n${operationalContext}`
      : (result.text.trim() || operationalContext);

    await audit({
      actorId: user.id,
      action: "ADMIN_AI_COPILOT_QUERY",
      targetType: "AI_COPILOT",
      details: { role: user.role, scope: user.role === "GHAT_SUPERVISOR" ? "ASSIGNED_GHATS_ONLY" : "GLOBAL_ADMIN" },
    });

    return NextResponse.json({
      reply,
      role: user.role,
      scope: user.role === "GHAT_SUPERVISOR" ? "ASSIGNED_GHATS_ONLY" : "GLOBAL_ADMIN",
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[Admin AI Chat Error]", error);
    return NextResponse.json(
      { error: "Internal server error occurred processing administrative query." },
      { status: 500 }
    );
  }
}
