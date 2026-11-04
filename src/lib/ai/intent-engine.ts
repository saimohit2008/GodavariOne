// Godavari One — Intelligent Bilingual Intent Engine & Grounded Response Generator
// Supports English, Telugu (తెలుగు), and mixed Telugu-English queries.

import {
  searchListingsTool,
  getGhatStatusTool,
  getEmergencyHospitalsTool,
  getFreeAccommodationTool,
  getAnnadanamTool,
  getPurohitsTool,
} from "./tools";
import { CURATED_FAQS, GENERAL_PUSHKARALU_KNOWLEDGE, OFFICIAL_EMERGENCY_HELPLINES } from "./knowledge";
import { getAIProvider } from "./provider";
import { getAISystemConfig } from "./config";
import { reserveAISpend, reconcileAISpend } from "./spending-guard";
import type {
  AIChatResponse,
  ListingCitation,
  SuggestedAction,
  SupportedLanguage,
} from "./types";

interface IntentResult {
  category: string;
  isEmergency: boolean;
  isBooking: boolean;
  isGhatStatus: boolean;
  language: SupportedLanguage;
  extractedQuery: string;
  town?: string;
}

export function detectIntent(text: string, clientLang?: SupportedLanguage): IntentResult {
  const lower = text.toLowerCase();
  const isTeluguScript = /[\u0C00-\u0C7F]/.test(text);
  const language: SupportedLanguage = clientLang || (isTeluguScript ? "te" : "en");

  // Emergency keywords
  const isEmergency =
    lower.includes("emergency") ||
    lower.includes("ambulance") ||
    lower.includes("hospital") ||
    lower.includes("doctor") ||
    lower.includes("accident") ||
    lower.includes("drowning") ||
    lower.includes("danger") ||
    lower.includes("police") ||
    lower.includes("108") ||
    lower.includes("ఆసుపత్రి") ||
    lower.includes("అత్యవసరం") ||
    lower.includes("అంబులెన్స్") ||
    lower.includes("వైద్యం") ||
    lower.includes("ప్రమాదం");

  // Booking keywords
  const isBooking =
    lower.includes("book") ||
    lower.includes("reserve") ||
    lower.includes("reservation") ||
    lower.includes("booking") ||
    lower.includes("stay") ||
    lower.includes("room") ||
    lower.includes("బుక్") ||
    lower.includes("రిజర్వేషన్") ||
    lower.includes("వసతి కావాలి");

  // Ghat status keywords
  const isGhatStatus =
    lower.includes("ghat") ||
    lower.includes("crowd") ||
    lower.includes("closed") ||
    lower.includes("open") ||
    lower.includes("kotilingala") ||
    lower.includes("pushkar ghat") ||
    lower.includes("snanam") ||
    lower.includes("bath") ||
    lower.includes("ఘాట్") ||
    lower.includes("రద్దీ") ||
    lower.includes("స్నానం");

  // Category classification
  let category = "GENERAL";
  if (isEmergency) category = "HOSPITAL";
  else if (lower.includes("hotel") || lower.includes("lodge") || lower.includes("resort") || lower.includes("హోట") || lower.includes("లాడ్జ్")) category = "HOTEL";
  else if (lower.includes("restaurant") || lower.includes("food") || lower.includes("tiffin") || lower.includes("veg") || lower.includes("రెస్టారెంట్") || lower.includes("భోజనం") || lower.includes("టిఫిన్")) category = "RESTAURANT";
  else if (lower.includes("satram") || lower.includes("dharmashala") || lower.includes("free stay") || lower.includes("free accommodation") || lower.includes("సత్ర") || lower.includes("వసతి")) category = "FREE_ACCOMMODATION";
  else if (lower.includes("annadanam") || lower.includes("prasadam") || lower.includes("free food") || lower.includes("అన్నదాన") || lower.includes("ప్రసాదం")) category = "ANNADANAM";
  else if (lower.includes("purohit") || lower.includes("pandit") || lower.includes("pinda") || lower.includes("tarpanam") || lower.includes("ceremony") || lower.includes("పూజారి") || lower.includes("పురోహితు") || lower.includes("పిండ ప్రదానం")) category = "CEREMONY";
  else if (lower.includes("ghat") || lower.includes("bath") || lower.includes("పుష్కర ఘాట్") || lower.includes("స్నానం")) category = "GHAT";
  else if (lower.includes("tourist") || lower.includes("temple") || lower.includes("visit") || lower.includes("దర్శనీయ") || lower.includes("ఆలయం") || lower.includes("గుడి")) category = "TOURIST_SPOT";
  else if (lower.includes("transport") || lower.includes("bus") || lower.includes("auto") || lower.includes("taxi") || lower.includes("రవాణా") || lower.includes("బస్సు") || lower.includes("ఆటో")) category = "TRANSPORT";

  // Location extraction
  let town: string | undefined;
  if (lower.includes("rajahmundry") || lower.includes("రాజమండ్రి")) town = "Rajahmundry";
  else if (lower.includes("bhadrachalam") || lower.includes("భద్రాచలం")) town = "Bhadrachalam";
  else if (lower.includes("kovvur") || lower.includes("కొవ్వూరు")) town = "Kovvur";

  return {
    category,
    isEmergency,
    isBooking,
    isGhatStatus,
    language,
    extractedQuery: text,
    town,
  };
}

export async function processUserMessage(
  userQuery: string,
  options?: {
    conversationId?: string;
    language?: SupportedLanguage;
    context?: Record<string, any>;
    userId?: string;
    userRole?: string;
  }
): Promise<AIChatResponse> {
  const intent = detectIntent(userQuery, options?.language);
  const conversationId = options?.conversationId || `conv_${Date.now()}`;
  const citations: ListingCitation[] = [];
  const suggestedActions: SuggestedAction[] = [];
  let dbContextText = "";
  let emergencyNotice: AIChatResponse["emergencyNotice"] = null;

  // 1. EMERGENCY HANDLING
  if (intent.isEmergency) {
    emergencyNotice = {
      isEmergency: true,
      helplines: OFFICIAL_EMERGENCY_HELPLINES.map((h) => ({
        label: intent.language === "te" ? h.labelTe : h.label,
        number: h.number,
      })),
      notice:
        intent.language === "te"
          ? "తక్షణ అత్యవసర వైద్య లేదా ప్రాణ రక్షణ సహాయం కోసం వెంటనే 108 లేదా 100 నంబర్లకు డయల్ చేయండి."
          : "For immediate medical or life-safety emergencies, please dial 108 (Ambulance) or 100 (Police) immediately.",
    };

    suggestedActions.push({
      type: "CALL_EMERGENCY",
      label: "Call Ambulance (108)",
      labelTe: "అంబులెన్స్ కాల్ చేయండి (108)",
      payload: { tel: "108" },
    });

    const hospitalData = await getEmergencyHospitalsTool(intent.town);
    citations.push(...hospitalData.citations);
    dbContextText += `\nVerified Emergency Hospitals:\n${hospitalData.summaryText}`;
  }

  // 2. RETRIEVAL BASED ON INTENT
  else if (intent.category === "GHAT" || intent.isGhatStatus) {
    const ghatData = await getGhatStatusTool(intent.town);
    citations.push(...ghatData.citations);
    dbContextText += `\nVerified Pushkar Ghats & Crowd Status:\n${ghatData.summaryText}`;
    suggestedActions.push({
      type: "NAVIGATE_CATEGORY",
      label: "View All Ghats",
      labelTe: "అన్ని ఘాట్‌లను చూడండి",
      payload: { category: "GHAT" },
    });
  } else if (intent.category === "FREE_ACCOMMODATION") {
    const freeAccData = await getFreeAccommodationTool(intent.town);
    citations.push(...freeAccData.citations);
    dbContextText += `\nVerified Free Satrams & Dharmashalas:\n${freeAccData.summaryText}`;
    suggestedActions.push({
      type: "NAVIGATE_CATEGORY",
      label: "Browse Free Satrams",
      labelTe: "ఉచిత సత్రాలు చూడండి",
      payload: { category: "FREE_ACCOMMODATION" },
    });
  } else if (intent.category === "ANNADANAM") {
    const annadanamData = await getAnnadanamTool(intent.town);
    citations.push(...annadanamData.citations);
    dbContextText += `\nVerified Free Annadanam Locations:\n${annadanamData.summaryText}`;
    suggestedActions.push({
      type: "NAVIGATE_CATEGORY",
      label: "View Annadanam Centres",
      labelTe: "అన్నదాన కేంద్రాలు చూడండి",
      payload: { category: "ANNADANAM" },
    });
  } else if (intent.category === "CEREMONY") {
    const purohitData = await getPurohitsTool();
    citations.push(...purohitData.citations);
    dbContextText += `\nVerified Vedic Purohits:\n${purohitData.summaryText}`;
    suggestedActions.push({
      type: "NAVIGATE_CATEGORY",
      label: "Explore Ceremonies & Purohits",
      labelTe: "కర్మకాండలు & పురోహితుల వివరాలు",
      payload: { category: "CEREMONY" },
    });
  } else if (intent.category !== "GENERAL") {
    const listingData = await searchListingsTool({
      category: intent.category,
      town: intent.town,
    });
    citations.push(...listingData.citations);
    dbContextText += `\nVerified ${intent.category} Listings:\n${listingData.summaryText}`;
    suggestedActions.push({
      type: "NAVIGATE_CATEGORY",
      label: `Browse ${intent.category}`,
      labelTe: `${intent.category} విభాగం చూడండి`,
      payload: { category: intent.category },
    });
  }

  // 3. BOOKING GUIDANCE ACTIONS
  if (intent.isBooking) {
    if (citations.length > 0) {
      suggestedActions.push({
        type: "BOOK_LISTING",
        label: `Book ${citations[0].name}`,
        labelTe: `${citations[0].name} బుకింగ్ ప్రారంభించండి`,
        payload: { listingId: citations[0].id, category: citations[0].category },
      });
    }
  }

  // 4. CURATED FAQ MATCHING
  const lowerQ = userQuery.toLowerCase();
  const matchedFaq = CURATED_FAQS.find((f) =>
    f.keywords.some((kw) => lowerQ.includes(kw.toLowerCase()))
  );

  // 5. CONSTRUCT SYSTEM PROMPT
  const systemPrompt = `You are "Godavari AI", the intelligent, courteous, and authoritative digital guide for Godavari One (Godavari Pushkaralu 2027 in Andhra Pradesh).

OPERATIONAL RULES:
1. Grounding in Truth: Answer ONLY using the provided Verified Database Context and Curated Pushkaralu Guidelines below. NEVER invent hotel names, phone numbers, pricing, timings, or crowd conditions.
2. If verified records are empty, explicitly state that no verified listing was found and direct the user to official helpdesks.
3. Language: Respond in ${intent.language === "te" ? "formal, polite Telugu (తెలుగు) using proper Telugu script" : "clear, warm, professional English"}.
4. Closed Ghat Safety: If any ghat is marked CLOSED or EMERGENCY, prominently warn the user NOT to visit it.
5. Booking Guidance: Explain that all bookings require verified Email OTP / Account sign-in for security.

Verified Database Context:
${dbContextText || "No specific database listings retrieved for this query."}

Curated Pushkaralu Knowledge:
- Event: ${GENERAL_PUSHKARALU_KNOWLEDGE.eventNameEn} (${GENERAL_PUSHKARALU_KNOWLEDGE.eventNameTe})
- ${GENERAL_PUSHKARALU_KNOWLEDGE.significanceEn}
${matchedFaq ? `\nRelevant FAQ Match:\nQ: ${matchedFaq.questionEn} / ${matchedFaq.questionTe}\nA: ${matchedFaq.answerEn}\n(Telugu: ${matchedFaq.answerTe})` : ""}`;

  // 6. CALL AI PROVIDER (WITH AUTOMATIC DETERMINISTIC FALLBACK & BUDGET GUARD)
  const config = await getAISystemConfig();

  // If globally disabled, bypass external cloud LLM entirely
  let useDeterministicFallback = !config.isEnabled || process.env.AI_SERVICE_ENABLED === "false";
  let reservationId: string | undefined;

  if (!useDeterministicFallback) {
    const reservation = await reserveAISpend({
      conversationId,
      userId: (options as any)?.userId,
      userRole: (options as any)?.userRole,
      provider: config.provider,
      model: config.model,
    });
    reservationId = reservation.reservationId;
    if (reservation.useFallback) {
      useDeterministicFallback = true;
    }
  }

  const provider = getAIProvider({
    provider: config.provider,
    model: config.model,
    forceMock: useDeterministicFallback,
  });

  let replyText = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let providerName = provider.name;
  let modelName = config.model;

  try {
    const result = await provider.generateCompletion({
      systemPrompt,
      messages: [{ role: "user", content: userQuery }],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    replyText = result.text.trim();
    promptTokens = result.promptTokens;
    completionTokens = result.completionTokens;
    providerName = result.provider;
    modelName = result.model;

    if (reservationId) {
      await reconcileAISpend({
        reservationId,
        actualPromptTokens: promptTokens,
        actualCompletionTokens: completionTokens,
        provider: providerName,
        model: modelName,
        success: true,
      });
    }
  } catch (err: any) {
    if (reservationId) {
      await reconcileAISpend({
        reservationId,
        success: false,
        errorMessage: err.message,
      });
    }

    // Graceful fallback to deterministic knowledge response
    if (matchedFaq) {
      replyText = intent.language === "te" ? matchedFaq.answerTe : matchedFaq.answerEn;
    } else if (citations.length > 0) {
      if (intent.language === "te") {
        replyText = `నమస్కారం! మీ శోధనకు సంబంధించి క్రింది ధృవీకరించబడిన వివరాలు అందుబాటులో ఉన్నాయి:\n\n${citations.map((c) => `• ${c.name} (${c.address})`).join("\n")}\n\nదయచేసి పూర్తి వివరాల కోసం క్రింది కార్డులను పరిశీలించండి.`;
      } else {
        replyText = `Namaskaram! Here are the verified listings found in our Godavari One records for your query:\n\n${citations.map((c) => `• ${c.name} (${c.address})`).join("\n")}\n\nPlease check the recommendation cards below for directions and details.`;
      }
    } else {
      if (intent.language === "te") {
        replyText = `నమస్కారం! గోదావరి వన్ డిజిటల్ గైడ్‌కి స్వాగతం. పవిత్ర గోదావరి పుష్కరాలు 2027 ఘాట్‌లు, ఉచిత వసతి, అన్నదానం, హోటళ్లు మరియు పురోహితుల సమాచారం కోసం మేము మీకు సహాయపడగలము. దయచేసి మీ ప్రశ్నను వివరంగా అడగండి.`;
      } else {
        replyText = `Namaskaram! Welcome to Godavari One. I am your intelligent guide for Godavari Pushkaralu 2027. I can help you find verified ghats, live crowd status, hotels, vegetarian dining, free satrams, Annadanam centres, and certified purohits. How can I assist you today?`;
      }
    }
  }

  // 7. SUGGESTED FOLLOW-UP QUESTIONS
  const suggestedQuestions =
    intent.language === "te"
      ? [
          "రాజమండ్రిలో ఉచిత సత్రాలు ఎక్కడ ఉన్నాయి?",
          "ప్రస్తుతం ఏ ఘాట్లలో రద్దీ తక్కువగా ఉంది?",
          "పిండ ప్రదానం కోసం పురోహితుడిని ఎలా బుక్ చేసుకోవాలి?",
          "అత్యవసర ఆసుపత్రులు మరియు హెల్ప్‌లైన్లు ఏమిటి?",
        ]
      : [
          "Which ghats have low crowd right now?",
          "Where can I find free accommodation and satrams?",
          "How do I book a certified Purohit for rituals?",
          "Find pure vegetarian restaurants in Rajahmundry",
        ];

  return {
    reply: replyText,
    conversationId,
    language: intent.language,
    citations,
    suggestedQuestions,
    suggestedActions,
    emergencyNotice,
    usage: {
      promptTokens,
      completionTokens,
      estimatedCostUsd: Number(((promptTokens * 0.000000075) + (completionTokens * 0.00000030)).toFixed(6)),
      provider: providerName,
      model: modelName,
    },
  };
}
