// Godavari One — Persistent AI Runtime Configuration
// Ensures global killswitch, provider/model settings, and budget limits persist across all serverless instances.

import { db } from "../db";
import { audit } from "../auth";

export interface AISystemConfigData {
  isEnabled: boolean;
  provider: "gemini" | "openai" | "groq" | "mock";
  model: string;
  monthlyBudgetCap: number;
  temperature: number;
  maxTokens: number;
  rateLimitPerMin: number;
  updatedAt?: string;
  updatedBy?: string | null;
}

export const SUPPORTED_MODELS: Record<string, string[]> = {
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  mock: ["godavari-local-v1", "godavari-intelligent-engine"],
};

const DEFAULT_CONFIG: AISystemConfigData = {
  isEnabled: process.env.AI_SERVICE_ENABLED !== "false",
  provider: (process.env.AI_PROVIDER as any) || "gemini",
  model: process.env.AI_MODEL || "gemini-1.5-flash",
  monthlyBudgetCap: Number(process.env.AI_MONTHLY_BUDGET_USD || 25.0),
  temperature: 0.3,
  maxTokens: 800,
  rateLimitPerMin: 30,
};

// Micro-cache (10 seconds) to prevent redundant DB reads during high-concurrency bursts
let cachedConfig: AISystemConfigData | null = null;
let cacheExpiresAt = 0;

export function invalidateConfigCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

/**
 * Fetches authoritative AI system configuration from database.
 * Auto-seeds default row if not present.
 */
export async function getAISystemConfig(): Promise<AISystemConfigData> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiresAt) {
    return cachedConfig;
  }

  try {
    let row = await db.aISystemConfig.findUnique({
      where: { id: "default" },
    });

    if (!row) {
      // Auto-initialize single-row configuration
      row = await db.aISystemConfig.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          isEnabled: DEFAULT_CONFIG.isEnabled,
          provider: DEFAULT_CONFIG.provider,
          model: DEFAULT_CONFIG.model,
          monthlyBudgetCap: DEFAULT_CONFIG.monthlyBudgetCap,
          temperature: DEFAULT_CONFIG.temperature,
          maxTokens: DEFAULT_CONFIG.maxTokens,
          rateLimitPerMin: DEFAULT_CONFIG.rateLimitPerMin,
        },
        update: {},
      });
    }

    cachedConfig = {
      isEnabled: row.isEnabled,
      provider: row.provider as any,
      model: row.model,
      monthlyBudgetCap: row.monthlyBudgetCap,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      rateLimitPerMin: row.rateLimitPerMin,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
    cacheExpiresAt = now + 10000; // 10-second TTL
    return cachedConfig;
  } catch (error) {
    console.error("[AISystemConfig] DB read failed, falling back to safe defaults:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Super Admin mutation to persist runtime changes across all instances.
 * Records audit log entry and invalidates memory cache.
 */
export async function updateAISystemConfig(
  updates: Partial<AISystemConfigData>,
  actorUserId?: string
): Promise<AISystemConfigData> {
  // Validate provider
  if (updates.provider && !["gemini", "openai", "groq", "mock"].includes(updates.provider)) {
    throw new Error(`Unsupported AI provider: ${updates.provider}. Must be gemini, openai, groq, or mock.`);
  }

  // Validate model if provider or model specified
  const targetProvider = updates.provider || (await getAISystemConfig()).provider;
  if (updates.model) {
    const validModels = SUPPORTED_MODELS[targetProvider] || [];
    if (!validModels.includes(updates.model)) {
      throw new Error(`Invalid model '${updates.model}' for provider '${targetProvider}'. Supported: ${validModels.join(", ")}`);
    }
  }

  if (updates.monthlyBudgetCap !== undefined && (typeof updates.monthlyBudgetCap !== "number" || updates.monthlyBudgetCap <= 0)) {
    throw new Error("Monthly budget cap must be a positive number.");
  }

  const dataToUpdate: any = {};
  if (typeof updates.isEnabled === "boolean") dataToUpdate.isEnabled = updates.isEnabled;
  if (updates.provider) dataToUpdate.provider = updates.provider;
  if (updates.model) dataToUpdate.model = updates.model;
  if (typeof updates.monthlyBudgetCap === "number") dataToUpdate.monthlyBudgetCap = updates.monthlyBudgetCap;
  if (typeof updates.temperature === "number") dataToUpdate.temperature = Math.max(0, Math.min(1, updates.temperature));
  if (typeof updates.maxTokens === "number") dataToUpdate.maxTokens = Math.max(100, Math.min(2000, updates.maxTokens));
  if (typeof updates.rateLimitPerMin === "number") dataToUpdate.rateLimitPerMin = Math.max(5, Math.min(120, updates.rateLimitPerMin));
  if (actorUserId) dataToUpdate.updatedBy = actorUserId;

  const row = await db.aISystemConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...DEFAULT_CONFIG,
      ...dataToUpdate,
    },
    update: dataToUpdate,
  });

  invalidateConfigCache();

  // Audit record for compliance
  if (actorUserId) {
    await audit({
      actorId: actorUserId,
      action: "UPDATE_AI_CONFIG",
      targetType: "AI_SYSTEM_CONFIG",
      targetId: "default",
      details: updates,
    });
  }

  return {
    isEnabled: row.isEnabled,
    provider: row.provider as any,
    model: row.model,
    monthlyBudgetCap: row.monthlyBudgetCap,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    rateLimitPerMin: row.rateLimitPerMin,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}
