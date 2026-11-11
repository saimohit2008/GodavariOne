// Godavari One — AI Assistant Types & Interfaces

export type SupportedLanguage = "en" | "te";

export interface AIChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  metadata?: Record<string, any>;
}

export interface ListingCitation {
  id: string;
  name: string;
  category: string;
  address: string;
  town?: string | null;
  district?: string | null;
  phone?: string | null;
  mapsUrl?: string | null;
  rating?: number | null;
  primaryImage?: string | null;
  crowdStatus?: string | null;
  isTemporarilyClosed?: boolean;
  priceRange?: string | null;
  specialNotice?: string | null;
}

export interface SuggestedAction {
  type: "VIEW_LISTING" | "NAVIGATE_CATEGORY" | "BOOK_LISTING" | "CALL_EMERGENCY" | "DIRECTIONS";
  label: string;
  labelTe?: string;
  payload: Record<string, any>;
}

export interface AIChatRequest {
  message: string;
  conversationId?: string;
  language?: SupportedLanguage;
  messages?: AIChatMessage[];
  context?: {
    currentView?: string;
    listingId?: string;
    category?: string;
  };
}

export interface AIChatResponse {
  reply: string;
  conversationId: string;
  language: SupportedLanguage;
  citations: ListingCitation[];
  suggestedQuestions: string[];
  suggestedActions: SuggestedAction[];
  emergencyNotice?: {
    isEmergency: boolean;
    helplines: { label: string; number: string }[];
    notice: string;
  } | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
    provider: string;
    model: string;
  };
}

export interface AIProviderConfig {
  provider: "gemini" | "openai" | "groq" | "mock";
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  monthlyBudgetCapUsd: number;
}

export interface AICompletionOptions {
  systemPrompt: string;
  messages: AIChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
  provider: string;
  finishReason?: string;
}

export interface AIProvider {
  name: string;
  generateCompletion(options: AICompletionOptions): Promise<AICompletionResult>;
}
