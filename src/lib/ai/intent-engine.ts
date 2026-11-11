// Godavari One — Intelligent Bilingual Intent Engine & Grounded Response Generator
// Supports English, Telugu (తెలుగు), and mixed Telugu-English queries.

import {
  searchListingsTool,
  getGhatStatusTool,
  getEmergencyHospitalsTool,
  getFreeAccommodationTool,
  getAnnadanamTool,
  getPurohitsTool,
  getBusinessListingStatsTool,
  getCategoryCountTool,
  getAllCategoryCountsTool,
  getPendingListingsStatsTool,
  getBusinessOwnersStatsTool,
  getPendingBookingsStatsTool,
  getOvercrowdedGhatsTool,
} from "./tools";
import { CURATED_FAQS, GENERAL_PUSHKARALU_KNOWLEDGE, OFFICIAL_EMERGENCY_HELPLINES } from "./knowledge";
import { getAIProvider } from "./provider";
import { getAISystemConfig } from "./config";
import { reserveAISpend, reconcileAISpend } from "./spending-guard";
import type {
  AIChatResponse,
  AIChatMessage,
  ListingCitation,
  SuggestedAction,
  SupportedLanguage,
} from "./types";

export type DatabaseQueryType =
  | "TOTAL_LISTINGS"
  | "CATEGORY_COUNT"
  | "CATEGORY_BREAKDOWN"
  | "PENDING_LISTINGS"
  | "BUSINESS_OWNERS"
  | "PENDING_BOOKINGS"
  | "OVERCROWDED_GHATS"
  | "UNAVAILABLE_INFO";

export interface IntentResult {
  category: string;
  isEmergency: boolean;
  isBooking: boolean;
  isGhatStatus: boolean;
  isDatabaseQuery: boolean;
  databaseQueryType?: DatabaseQueryType;
  targetCategory?: string;
  isExplicitNavigation: boolean;
  language: SupportedLanguage;
  extractedQuery: string;
  town?: string;
}

export function detectIntent(text: string, clientLang?: SupportedLanguage): IntentResult {
  const lower = text.toLowerCase().trim();
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
    /\b(book|reserve|reservation|booking)\b/i.test(lower) ||
    lower.includes("బుక్") ||
    lower.includes("రిజర్వేషన్") ||
    lower.includes("వసతి కావాలి");

  // Ghat status keywords
  const isGhatStatus =
    /\b(crowd|crowded|ghat\s*status|snanam|bath)\b/i.test(lower) ||
    lower.includes("రద్దీ") ||
    lower.includes("స్నానం");

  // Explicit navigation intent (asking to show, browse, or navigate somewhere)
  const isExplicitNavigation =
    /\b(browse|navigate|show\s+me|view\s+all|take\s+me\s+to|directions\s+to|explore)\b/i.test(lower) ||
    lower.includes("చూడండి") ||
    lower.includes("వెతకండి") ||
    lower.includes("దర్శించండి");

  // Database / Operational analytics intent detection
  let isDatabaseQuery = false;
  let databaseQueryType: DatabaseQueryType | undefined;
  let targetCategory: string | undefined;

  // 1. Check for unavailable external data queries (flights, trains, PNR, external weather)
  if (
    /\b(flight|flights|air\s*ticket|train\s*ticket|pnr|irctc|railway\s*schedule|train\s*schedule|cricket\s*score)\b/i.test(lower) ||
    lower.includes("రైలు టికెట్") ||
    lower.includes("ఫ్లైట్")
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "UNAVAILABLE_INFO";
  }
  // 2. Overcrowded ghats query
  else if (
    /\b(overcrowd|overcrowded|overcrowding)\b/i.test(lower) ||
    (/\b(which|any)\s+ghats?\b/i.test(lower) && /\b(crowd|crowded|rush)\b/i.test(lower)) ||
    lower.includes("రద్దీ ఎక్కువగా ఉన్న") ||
    lower.includes("రద్దీ ఘాట్లు") ||
    lower.includes("ఓవర్‌క్రౌడ్")
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "OVERCROWDED_GHATS";
  }
  // 3. Category breakdown
  else if (
    (/\b(each|every|all)\s+category\b/i.test(lower) && /\b(how\s+many|count|records|listings)\b/i.test(lower)) ||
    /\b(category\s+breakdown|breakdown\s+by\s+category|records\s+available\s+in\s+each\s+category)\b/i.test(lower) ||
    lower.includes("ప్రతి విభాగం") ||
    lower.includes("విభాగాల వారీగా")
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_BREAKDOWN";
  }
  // 4. Pending listings approval
  else if (
    /\b(pending\s+approval|pending\s+listings|listings\s+pending)\b/i.test(lower) ||
    (lower.includes("pending") && (lower.includes("approval") || lower.includes("listing"))) ||
    lower.includes("ఆమోదం కోసం పెండింగ్") ||
    lower.includes("పెండింగ్ లిస్టింగ్‌లు")
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "PENDING_LISTINGS";
  }
  // 5. Business owners count
  else if (
    /\b(business\s+owners?|registered\s+owners?)\b/i.test(lower) ||
    (lower.includes("how many") && lower.includes("owner")) ||
    lower.includes("వ్యాపార యజమానులు")
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "BUSINESS_OWNERS";
  }
  // 6. Pending bookings count
  else if (
    /\b(pending\s+bookings?|bookings?\s+pending|pending\s+reservations?)\b/i.test(lower) ||
    (lower.includes("how many") && lower.includes("booking") && lower.includes("pending")) ||
    lower.includes("పెండింగ్ బుకింగ్‌లు")
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "PENDING_BOOKINGS";
  }
  // 7. Specific category count inquiries
  else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని") || lower.includes("నమోదైన")) &&
    (/\b(restaurants?|dining|food)\b/i.test(lower) || lower.includes("రెస్టారెంట్"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "RESTAURANT";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని") || lower.includes("నమోదైన")) &&
    (/\b(hotels?|lodges?|resorts?)\b/i.test(lower) || lower.includes("హోట"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "HOTEL";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని") || lower.includes("అందుబాటులో ఉన్న")) &&
    (/\b(ghats?|bathing\s+ghats?)\b/i.test(lower) || lower.includes("ఘాట్"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "GHAT";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని")) &&
    (/\b(satrams?|choultries?|free\s+accommodation)\b/i.test(lower) || lower.includes("సత్ర"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "FREE_ACCOMMODATION";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని")) &&
    (/\b(annadanams?|free\s+meals?|prasadam)\b/i.test(lower) || lower.includes("అన్నదాన"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "ANNADANAM";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని")) &&
    (/\b(purohits?|pandits?|priests?)\b/i.test(lower) || lower.includes("పురోహితు"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "CEREMONY";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని")) &&
    (/\b(hospitals?|clinics?)\b/i.test(lower) || lower.includes("ఆసుపత్రి"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "HOSPITAL";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని")) &&
    (/\b(transports?|buses?|autos?|taxis?)\b/i.test(lower) || lower.includes("రవాణా"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "TRANSPORT";
  } else if (
    (/\b(how\s+many|count|number\s+of)\b/i.test(lower) || lower.includes("ఎన్ని")) &&
    (/\b(tourist\s+spots?|temples?)\b/i.test(lower) || lower.includes("దర్శనీయ") || lower.includes("ఆలయ"))
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "CATEGORY_COUNT";
    targetCategory = "TOURIST_SPOT";
  }
  // 8. Total business listings count
  else if (
    (/\b(how\s+many|total|count\s+of|number\s+of)\b/i.test(lower) && /\b(business\s+listings?|listings?|records?|businesses?)\b/i.test(lower)) ||
    lower.includes("how many business listings are currently registered") ||
    lower.includes("how many business listings") ||
    lower.includes("how many listings") ||
    lower.includes("వ్యాపార లిస్టింగ్‌లు") ||
    lower.includes("ఎన్ని లిస్టింగ్‌లు") ||
    lower.includes("మొత్తం లిస్టింగ్‌లు")
  ) {
    isDatabaseQuery = true;
    databaseQueryType = "TOTAL_LISTINGS";
  }

  // Category classification for standard queries (ONLY if not a total/generic database query)
  let category = "GENERAL";
  if (isEmergency) category = "HOSPITAL";
  else if (targetCategory) category = targetCategory;
  else if (!isDatabaseQuery) {
    if (lower.includes("hotel") || lower.includes("lodge") || lower.includes("resort") || lower.includes("హోట") || lower.includes("లాడ్జ్")) category = "HOTEL";
    else if (lower.includes("restaurant") || lower.includes("food") || lower.includes("tiffin") || lower.includes("veg") || lower.includes("రెస్టారెంట్") || lower.includes("భోజనం") || lower.includes("టిఫిన్")) category = "RESTAURANT";
    else if (lower.includes("satram") || lower.includes("dharmashala") || lower.includes("free stay") || lower.includes("free accommodation") || lower.includes("సత్ర") || lower.includes("వసతి")) category = "FREE_ACCOMMODATION";
    else if (lower.includes("annadanam") || lower.includes("prasadam") || lower.includes("free food") || lower.includes("అన్నదాన") || lower.includes("ప్రసాదం")) category = "ANNADANAM";
    else if (lower.includes("purohit") || lower.includes("pandit") || lower.includes("pinda") || lower.includes("tarpanam") || lower.includes("ceremony") || lower.includes("పూజారి") || lower.includes("పురోహితు") || lower.includes("పిండ ప్రదానం")) category = "CEREMONY";
    else if (lower.includes("ghat") || lower.includes("bath") || lower.includes("పుష్కర ఘాట్") || lower.includes("స్నానం")) category = "GHAT";
    else if (lower.includes("tourist") || lower.includes("temple") || lower.includes("visit") || lower.includes("దర్శనీయ") || lower.includes("ఆలయం") || lower.includes("గుడి")) category = "TOURIST_SPOT";
    else if (/\b(transport|bus|buses|rtc|apsrtc|tsrtc|auto|rickshaw|taxi|cab)\b/i.test(lower) || lower.includes("రవాణా") || lower.includes("బస్సు") || lower.includes("ఆటో")) category = "TRANSPORT";
  }

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
    isDatabaseQuery,
    databaseQueryType,
    targetCategory,
    isExplicitNavigation,
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
    messages?: AIChatMessage[];
    context?: Record<string, any>;
    userId?: string;
    userRole?: string;
  }
): Promise<AIChatResponse> {
  const intent = detectIntent(userQuery, options?.language);
  const conversationId = options?.conversationId || `conv_${Date.now()}`;

  // ---------------------------------------------------------------------------
  // A. DATABASE AND OPERATIONAL QUESTIONS (AUTHENTICATED & GROUNDED QUERIES)
  // ---------------------------------------------------------------------------
  if (intent.isDatabaseQuery) {
    if (intent.databaseQueryType === "TOTAL_LISTINGS") {
      const stats = await getBusinessListingStatsTool(options?.userRole);
      let reply = "";
      if (intent.language === "te") {
        reply = `గోదావరి వన్ డేటాబేస్‌లో ప్రస్తుతం ${stats.total} వ్యాపార లిస్టింగ్‌లు అందుబాటులో ఉన్నాయి.\n\nఈ సంఖ్యలో ${stats.statusesIncluded.join(", ")} లిస్టింగ్‌లు ఉన్నాయి.`;
      } else {
        reply = `Godavari One currently has ${stats.total} business listings in its database.\n\nThis count includes [${stats.statusesIncluded.join(", ")}] statuses.`;
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions:
          intent.language === "te"
            ? ["ఎన్ని రెస్టారెంట్లు ఉన్నాయి?", "ఎన్ని హోటళ్లు ఉన్నాయి?", "రద్దీ తక్కువగా ఉన్న ఘాట్లు ఏవి?"]
            : ["How many restaurants are registered?", "How many hotels are registered?", "Which ghats have reported overcrowding?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }

    if (intent.databaseQueryType === "CATEGORY_COUNT") {
      const target = intent.targetCategory || "RESTAURANT";
      const res = await getCategoryCountTool(target);
      let reply = "";
      if (intent.language === "te") {
        reply = `గోదావరి వన్ డేటాబేస్‌లో ప్రస్తుతం ${res.count} ${res.display} నమోదు చేయబడ్డాయి.\n\nఈ సంఖ్యలో ధృవీకరించబడిన (PUBLISHED) రికార్డులు ఉన్నాయి.`;
      } else {
        reply = `Godavari One currently has ${res.count} ${res.display.toLowerCase()} registered in its database.\n\nThis count includes PUBLISHED (active and verified) listings.`;
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions:
          intent.language === "te"
            ? ["మొత్తం ఎన్ని లిస్టింగ్‌లు ఉన్నాయి?", "ప్రతి విభాగం వారీగా ఎన్ని ఉన్నాయి?"]
            : ["How many business listings are currently registered in Godavari One?", "How many records are available in each category?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }

    if (intent.databaseQueryType === "CATEGORY_BREAKDOWN") {
      const counts = await getAllCategoryCountsTool();
      let reply = "";
      if (intent.language === "te") {
        reply = `గోదావరి వన్ డేటాబేస్‌లో అన్ని విభాగాల వారీగా క్రింది రికార్డులు అందుబాటులో ఉన్నాయి:\n\n${counts.map((c) => `• ${c.display}: ${c.count} లిస్టింగ్‌లు`).join("\n")}\n\nఈ సంఖ్యలో ధృవీకరించబడిన (PUBLISHED) లిస్టింగ్‌లు ఉన్నాయి.`;
      } else {
        reply = `Godavari One currently has the following verified records across all categories:\n\n${counts.map((c) => `• ${c.display}: ${c.count} listings`).join("\n")}\n\nThis count includes PUBLISHED (active and verified) listings in our database.`;
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions:
          intent.language === "te"
            ? ["ఎన్ని హోటళ్లు ఉన్నాయి?", "ఎన్ని రెస్టారెంట్లు ఉన్నాయి?"]
            : ["How many hotels are registered?", "How many restaurants are registered?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }

    if (intent.databaseQueryType === "PENDING_LISTINGS") {
      const res = await getPendingListingsStatsTool(options?.userRole);
      let reply = "";
      if (res.authorized) {
        if (intent.language === "te") {
          reply = `పరిపాలనా సమీక్ష కోసం ప్రస్తుతం ${res.count} వ్యాపార లిస్టింగ్‌లు పెండింగ్‌లో ఉన్నాయి.\n\nఈ సంఖ్యలో అడ్మినిస్ట్రేటర్ ధృవీకరణ కోసం వేచి ఉన్న (PENDING) లిస్టింగ్‌లు ఉన్నాయి.`;
        } else {
          reply = `There are currently ${res.count} business listings pending approval in the administrative review queue.\n\nThis count includes PENDING listings awaiting administrator verification.`;
        }
      } else {
        if (intent.language === "te") {
          reply = `అంతర్గత పరిపాలనా సమాచారం (పెండింగ్ లిస్టింగ్‌లు) పొందడానికి అధికారిక అడ్మినిస్ట్రేటర్ లాగిన్ అవసరం. పబ్లిక్ విజిటర్‌గా మీరు ప్రచురించబడిన లిస్టింగ్‌లను వీక్షించవచ్చు.`;
        } else {
          reply = `Access to internal administrative operational data (such as pending approval listings, registered business owner accounts, and pending bookings) requires authorized administrator sign-in. As a public visitor, you can query published listings, ghat crowd conditions, and festival services.`;
        }
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions: ["How many business listings are currently registered in Godavari One?", "Which ghats have reported overcrowding?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }

    if (intent.databaseQueryType === "BUSINESS_OWNERS") {
      const res = await getBusinessOwnersStatsTool(options?.userRole);
      let reply = "";
      if (res.authorized) {
        if (intent.language === "te") {
          reply = `గోదావరి వన్ డేటాబేస్‌లో ప్రస్తుతం ${res.count} మంది వ్యాపార యజమానులు నమోదు చేయబడ్డారు.\n\nఈ సంఖ్యలో యాక్టివ్‌గా ఉన్న BUSINESS_OWNER ఖాతాలు ఉన్నాయి.`;
        } else {
          reply = `Godavari One currently has ${res.count} business owners registered in its database.\n\nThis count includes active user accounts with the BUSINESS_OWNER role.`;
        }
      } else {
        if (intent.language === "te") {
          reply = `యూజర్ ఖాతాల రిజిస్ట్రీ మరియు పరిపాలనా సమాచారం అధికారిక అడ్మినిస్ట్రేటర్లకు మాత్రమే పరిమితం చేయబడింది. పబ్లిక్ విజిటర్లు మా డైరెక్టరీలో ధృవీకరించబడిన అన్ని వ్యాపార లిస్టింగ్‌లను చూడవచ్చు.`;
        } else {
          reply = `Access to user account registries and administrative data is restricted to authorized administrators. Public visitors can view all verified published business listings in our directory.`;
        }
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions: ["How many business listings are currently registered in Godavari One?", "How many restaurants are registered?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }

    if (intent.databaseQueryType === "PENDING_BOOKINGS") {
      const res = await getPendingBookingsStatsTool(options?.userRole);
      let reply = "";
      if (res.authorized) {
        if (intent.language === "te") {
          reply = `వ్యవస్థలో ప్రస్తుతం మొత్తం ${res.total} పెండింగ్ బుకింగ్‌లు ఉన్నాయి (హోటల్: ${res.hotel}, రెస్టారెంట్: ${res.restaurant}, పూజలు: ${res.ceremony}).\n\nఈ సంఖ్యలో నిర్ధారణ కోసం వేచి ఉన్న (PENDING) రిజర్వేషన్లు ఉన్నాయి.`;
        } else {
          reply = `There are currently ${res.total} bookings pending review in the system (${res.hotel} hotel, ${res.restaurant} restaurant, ${res.ceremony} ceremony).\n\nThis count includes PENDING reservations requiring confirmation.`;
        }
      } else {
        if (intent.language === "te") {
          reply = `సిస్టమ్-వైడ్ బుకింగ్ గణాంకాలు అధికారిక అడ్మినిస్ట్రేటర్లకు మాత్రమే పరిమితం చేయబడ్డాయి. మీ వ్యక్తిగత బుకింగ్‌ల వివరాల కోసం బుకింగ్ డ్యాష్‌బోర్డ్‌ని పరిశీలించండి.`;
        } else {
          reply = `Access to system-wide booking queues and operational statistics is restricted to authorized administrators. To check your own personal bookings, please view your booking dashboard.`;
        }
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions: ["How many hotels are registered?", "How many restaurants are registered?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }

    if (intent.databaseQueryType === "OVERCROWDED_GHATS") {
      const ghats = await getOvercrowdedGhatsTool();
      let reply = "";
      if (ghats.length > 0) {
        if (intent.language === "te") {
          reply = `క్రింది ఘాట్లలో ప్రస్తుతం ఎక్కువ రద్దీ నమోదైంది:\n\n${ghats.map((g) => `• ${g.name} (${g.town || "రాజమండ్రి"}): రద్దీ స్థాయి = ${g.crowdStatus}`).join("\n")}\n\nభక్తులు సురక్షిత పుష్కర స్నానం కోసం రద్దీ తక్కువగా ఉన్న ప్రత్యామ్నాయ ఘాట్‌లను ఎంచుకోవాలని సూచించడమైనది.`;
        } else {
          reply = `The following ghats have currently reported elevated crowd levels:\n\n${ghats.map((g) => `• ${g.name} (${g.town || "Rajahmundry"}): Status = ${g.crowdStatus}`).join("\n")}\n\nPilgrims are advised to consider less crowded alternative ghats for a safe holy dip.`;
        }
      } else {
        if (intent.language === "te") {
          reply = `ప్రస్తుతం ఏ ఘాట్‌లోనూ అధిక రద్దీ నమోదు కాలేదు. పర్యవేక్షించబడుతున్న అన్ని ఘాట్‌లు సాధారణ సామర్థ్యంతో (FREE లేదా MODERATE) పనిచేస్తున్నాయి.`;
        } else {
          reply = `Currently, no ghats have reported overcrowding. All monitored ghats in the Godavari One database are operating within normal capacity (FREE or MODERATE crowd levels).`;
        }
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions: ["How many ghats are available?", "Which ghats can I visit in Rajahmundry?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }

    if (intent.databaseQueryType === "UNAVAILABLE_INFO") {
      let reply = "";
      if (intent.language === "te") {
        reply = `ఈ సమాచారం ప్రస్తుత గోదావరి వన్ డేటాబేస్‌లో అందుబాటులో లేదు. గోదావరి పుష్కరాల ఘాట్‌లు, హోటళ్లు, భోజన శాలలు, ఉచిత సత్రాలు, అన్నదానం మరియు పురోహితుల వివరాలు మాత్రమే మా వద్ద అందుబాటులో ఉన్నాయి. ఇతర సేవల కోసం సంబంధిత అధికారిక పోర్టల్‌లను సంప్రదించండి.`;
      } else {
        reply = `This information is not available in the current Godavari One database. Godavari One provides verified information for Pushkar bathing ghats, hotels, restaurants, free satrams, Annadanam centres, emergency medical services, and certified Vedic purohits. For external railway and flight schedules, please consult official IRCTC or airline portals.`;
      }
      return {
        reply,
        conversationId,
        language: intent.language,
        citations: [],
        suggestedQuestions: ["How many business listings are currently registered in Godavari One?", "Which ghats are free right now?"],
        suggestedActions: [],
        emergencyNotice: null,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // B. GENERAL QUERIES & DIRECTORY RECOMMENDATIONS
  // ---------------------------------------------------------------------------
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
    if (intent.isExplicitNavigation) {
      suggestedActions.push({
        type: "NAVIGATE_CATEGORY",
        label: "View All Ghats",
        labelTe: "అన్ని ఘాట్‌లను చూడండి",
        payload: { category: "GHAT" },
      });
    }
  } else if (intent.category === "FREE_ACCOMMODATION") {
    const freeAccData = await getFreeAccommodationTool(intent.town);
    citations.push(...freeAccData.citations);
    dbContextText += `\nVerified Free Satrams & Dharmashalas:\n${freeAccData.summaryText}`;
    if (intent.isExplicitNavigation) {
      suggestedActions.push({
        type: "NAVIGATE_CATEGORY",
        label: "Browse Free Satrams",
        labelTe: "ఉచిత సత్రాలు చూడండి",
        payload: { category: "FREE_ACCOMMODATION" },
      });
    }
  } else if (intent.category === "ANNADANAM") {
    const annadanamData = await getAnnadanamTool(intent.town);
    citations.push(...annadanamData.citations);
    dbContextText += `\nVerified Free Annadanam Locations:\n${annadanamData.summaryText}`;
    if (intent.isExplicitNavigation) {
      suggestedActions.push({
        type: "NAVIGATE_CATEGORY",
        label: "View Annadanam Centres",
        labelTe: "అన్నదాన కేంద్రాలు చూడండి",
        payload: { category: "ANNADANAM" },
      });
    }
  } else if (intent.category === "CEREMONY") {
    const purohitData = await getPurohitsTool();
    citations.push(...purohitData.citations);
    dbContextText += `\nVerified Vedic Purohits:\n${purohitData.summaryText}`;
    if (intent.isExplicitNavigation) {
      suggestedActions.push({
        type: "NAVIGATE_CATEGORY",
        label: "Explore Ceremonies & Purohits",
        labelTe: "కర్మకాండలు & పురోహితుల వివరాలు",
        payload: { category: "CEREMONY" },
      });
    }
  } else if (intent.category !== "GENERAL") {
    const listingData = await searchListingsTool({
      category: intent.category,
      town: intent.town,
    });
    citations.push(...listingData.citations);
    dbContextText += `\nVerified ${intent.category} Listings:\n${listingData.summaryText}`;
    if (intent.isExplicitNavigation && citations.length > 0) {
      suggestedActions.push({
        type: "NAVIGATE_CATEGORY",
        label: `Browse ${intent.category}`,
        labelTe: `${intent.category} విభాగం చూడండి`,
        payload: { category: intent.category },
      });
    }
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
2. Directly answer the user's question first in simple, understandable language.
3. DO NOT begin your response with greetings like "Namaskaram!", "Hello!", or welcome intros. Greetings must never be repeated during a conversation.
4. Do not repeat the user's question.
5. Do not suggest unrelated categories or services.
6. If verified records are empty, explicitly state that no verified listing was found and direct the user to official helpdesks.
7. Language: Respond in ${intent.language === "te" ? "formal, polite Telugu (తెలుగు) using proper Telugu script" : "clear, warm, professional English"}.
8. Closed Ghat Safety: If any ghat is marked CLOSED or EMERGENCY, prominently warn the user NOT to visit it.
9. Booking Guidance: Explain that all bookings require verified Email OTP / Account sign-in for security.

Verified Database Context:
${dbContextText || "No specific database listings retrieved for this query."}

Curated Pushkaralu Knowledge:
- Event: ${GENERAL_PUSHKARALU_KNOWLEDGE.eventNameEn} (${GENERAL_PUSHKARALU_KNOWLEDGE.eventNameTe})
- ${GENERAL_PUSHKARALU_KNOWLEDGE.significanceEn}
${matchedFaq ? `\nRelevant FAQ Match:\nQ: ${matchedFaq.questionEn} / ${matchedFaq.questionTe}\nA: ${matchedFaq.answerEn}\n(Telugu: ${matchedFaq.answerTe})` : ""}`;

  // 6. CALL AI PROVIDER (WITH AUTOMATIC DETERMINISTIC FALLBACK & BUDGET GUARD)
  const config = await getAISystemConfig();

  let useDeterministicFallback = !config.isEnabled || process.env.AI_SERVICE_ENABLED === "false";
  let reservationId: string | undefined;

  if (!useDeterministicFallback) {
    const reservation = await reserveAISpend({
      conversationId,
      userId: options?.userId,
      userRole: options?.userRole,
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

  // Build conversation history
  const conversationMessages: AIChatMessage[] = [
    ...(options?.messages || []).slice(-6),
    { role: "user", content: userQuery },
  ];

  try {
    const result = await provider.generateCompletion({
      systemPrompt,
      messages: conversationMessages,
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

    // Graceful fallback to deterministic knowledge response without repeated greetings
    if (matchedFaq) {
      replyText = intent.language === "te" ? matchedFaq.answerTe : matchedFaq.answerEn;
    } else if (citations.length > 0) {
      if (intent.language === "te") {
        replyText = `మీ శోధనకు సంబంధించి క్రింది ధృవీకరించబడిన వివరాలు అందుబాటులో ఉన్నాయి:\n\n${citations.map((c) => `• ${c.name} (${c.address})`).join("\n")}\n\nదయచేసి పూర్తి వివరాల కోసం క్రింది కార్డులను పరిశీలించండి.`;
      } else {
        replyText = `Here are the verified listings found in our Godavari One records for your query:\n\n${citations.map((c) => `• ${c.name} (${c.address})`).join("\n")}\n\nPlease check the recommendation cards below for directions and details.`;
      }
    } else {
      if (intent.language === "te") {
        replyText = `మీ శోధనకు సరిపోయే ధృవీకరించబడిన వివరాలు గోదావరి వన్ డేటాబేస్‌లో కనుగొనబడలేదు. దయచేసి అధికారిక డైరెక్టరీ విభాగాల ద్వారా వెతకండి.`;
      } else {
        replyText = `No verified listings were found matching your specific query in the Godavari One database. Please check our verified directory categories or contact the official helpdesk.`;
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
