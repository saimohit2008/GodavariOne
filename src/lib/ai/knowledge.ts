// Godavari One — Curated Knowledge Base & FAQ Engine
// Grounded domain knowledge for Godavari Pushkaralu 2027, traditions, ghat rules, and services.

export interface FAQEntry {
  id: string;
  category: string;
  keywords: string[];
  questionEn: string;
  questionTe: string;
  answerEn: string;
  answerTe: string;
}

export const OFFICIAL_EMERGENCY_HELPLINES = [
  { label: "Emergency Ambulance & Medical", labelTe: "అత్యవసర అంబులెన్స్ & వైద్యం", number: "108" },
  { label: "Police Control Room", labelTe: "పోలీస్ కంట్రోల్ రూమ్", number: "100" },
  { label: "Fire & Rescue Services", labelTe: "ఫైర్ & రెస్క్యూ సర్వీసెస్", number: "101" },
  { label: "State Disaster Management / Pushkara Helpline", labelTe: "రాష్ట్ర విపత్తు నిర్వహణ హెల్ప్‌లైన్", number: "1070" },
  { label: "Women Helpline", labelTe: "మహిళా హెల్ప్‌లైన్", number: "181" },
  { label: "Child Helpline", labelTe: "చైల్డ్ హెల్ప్‌లైన్", number: "1098" },
  { label: "Rajahmundry Municipal Corporation Pushkar Control", labelTe: "రాజమండ్రి మున్సిపల్ కార్పొరేషన్ పుష్కర కంట్రోల్", number: "0883-2471234" },
];

export const GENERAL_PUSHKARALU_KNOWLEDGE = {
  eventNameEn: "Godavari Maha Pushkaralu 2027",
  eventNameTe: "గోదావరి మహా పుష్కరాలు 2027",
  significanceEn:
    "Godavari Pushkaralu is a sacred festival occurring once every 12 years when Jupiter (Brihaspati) enters the zodiac sign of Leo (Simha Rasi). Taking a holy dip (Pushkara Snanam) in the sacred Godavari River cleanses past karmas and brings spiritual blessings.",
  significanceTe:
    "బృహస్పతి సింహరాశిలోకి ప్రవేశించినప్పుడు 12 సంవత్సరాలకు ఒకసారి జరిగే అత్యంత పవిత్రమైన ఉత్సవం గోదావరి పుష్కరాలు. పవిత్ర గోదావరి నదిలో పుష్కర స్నానం చేయడం ద్వారా పాపాలు తొలగి ఆధ్యాత్మిక పుణ్యం లభిస్తుందని భక్తుల ప్రగాఢ విశ్వాసం.",
  keyLocations: [
    { name: "Rajahmundry (Rajamahendravaram)", district: "East Godavari", highlights: "Kotilingala Ghat, Pushkar Ghat, Markandeya Ghat, Saraswati Ghat, VIP Ghat" },
    { name: "Bhadrachalam", district: "Bhadradri Kothagudem", highlights: "Sri Sita Ramachandra Swamy Temple, Godavari Snana Ghat" },
    { name: "Kovvur", district: "West Godavari", highlights: "Goshpada Kshetram, Gautama Ghat" },
    { name: "Antarvedi", district: "Dr. B.R. Ambedkar Konaseema", highlights: "Sri Lakshmi Narasimha Swamy Temple, Sagara Sangamam" },
    { name: "Pattiseema", district: "West Godavari", highlights: "Sri Veerabhadra Swamy Temple hill shrine on river island" },
    { name: "Kotipalli", district: "Dr. B.R. Ambedkar Konaseema", highlights: "Koti Someswara Swamy Kshetram" },
  ],
  importantRituals: [
    { name: "Pushkara Snanam", descEn: "Sacred holy bath chanting holy river stotrams.", descTe: "నదిలో పవిత్ర స్నానం ఆచరించడం." },
    { name: "Pinda Pradanam & Pitru Tarpanam", descEn: "Ancestral rites and offerings performed by certified purohits on designated ghats.", descTe: "పితృదేవతల ముక్తికై వేద పండితుల సమక్షంలో పిండ ప్రదానం మరియు తర్పణాలు చేయడం." },
    { name: "Godavari Harathi", descEn: "Grand evening river prayer and lighted lamps ceremony along Kotilingala and Pushkar Ghats.", descTe: "సాయంత్రం వేళ గోదావరి మాతకు నిర్వహించే దివ్య మహామంగళ హారతి." },
    { name: "Dāna Dharma (Charity)", descEn: "Donations of food (Annadanam), clothes, and sacred gifts to pilgrims and sadhus.", descTe: "అన్నదానం, వస్త్రదానం మరియు గోదానం వంటి సత్కార్యాలు." },
  ],
  ghatRulesEn: [
    "Always obey lifeguards, police personnel, and digital crowd signboards.",
    "Do not cross danger barricades in the deep river current.",
    "Use designated changing rooms and toilets; do not litter or use plastic soaps in the holy water.",
    "Senior citizens (65+) and persons with disabilities can apply for Priority Ghat Passes with wheelchair and ramp assistance.",
    "Free bathing is available across all marked general public ghats.",
  ],
  ghatRulesTe: [
    "లైఫ్‌గార్డులు, పోలీసు అధికారులు మరియు డిజిటల్ సైన్‌బోర్డుల సూచనలను తప్పక పాటించండి.",
    "లోతైన నీటిలోకి మరియు హెచ్చరిక బారికేడ్లను దాటి వెళ్లవద్దు.",
    "నదిలో సబ్బులు, ప్లాస్టిక్ వస్తువులు వేయకండి; ప్రత్యేక చేంజింగ్ రూమ్‌లను మాత్రమే ఉపయోగించండి.",
    "సీనియర్ సిటిజన్లు (65+) మరియు దివ్యాంగులు వీల్‌చైర్, ర్యాంప్ సదుపాయాల కోసం ప్రయారిటీ ఘాట్ పాస్ దరఖాస్తు చేసుకోవచ్చు.",
    "అన్ని ప్రభుత్వ పబ్లిక్ ఘాట్‌లలో స్నానం పూర్తిగా ఉచితం.",
  ],
};

export const CURATED_FAQS: FAQEntry[] = [
  {
    id: "faq-ghats-free",
    category: "GHAT",
    keywords: ["free ghat", "ghat fee", "ticket", "cost", "entry fee", "ఉచిత ఘాట్", "రుసుము"],
    questionEn: "Is there any entry fee for bathing at Godavari Pushkar Ghats?",
    questionTe: "గోదావరి పుష్కర ఘాట్లలో స్నానానికి ఏమైనా రుసుము చెల్లించాలా?",
    answerEn:
      "No. Bathing at public Godavari Pushkar Ghats is completely free for all pilgrims. Special priority queue passes for senior citizens (65+) and persons with disabilities are also provided free of cost by the administration through Godavari One.",
    answerTe:
      "లేదు. పవిత్ర గోదావరి పుష్కర ఘాట్లలో స్నానం చేయడం భక్తులందరికీ పూర్తిగా ఉచితం. సీనియర్ సిటిజన్లు (65+) మరియు దివ్యాంగుల కోసం ప్రత్యేక ప్రయారిటీ పాస్‌లు కూడా గోదావరి వన్ ద్వారా ఉచితంగా అందించబడతాయి.",
  },
  {
    id: "faq-free-accommodation",
    category: "FREE_ACCOMMODATION",
    keywords: ["free accommodation", "satram", "dharmashala", "free stay", "choultry", "ఉచిత వసతి", "సత్రం", "ధర్మశాల"],
    questionEn: "Where can pilgrims find free accommodation and satrams in Rajahmundry?",
    questionTe: "రాజమండ్రిలో భక్తులకు ఉచిత వసతి మరియు సత్రాలు ఎక్కడ లభిస్తాయి?",
    answerEn:
      "Godavari One lists verified free accommodation centers, satrams, and community dormitory halls across Rajahmundry and nearby pushkara zones. Most offer clean floor bedding, drinking water, and restrooms on a first-come, first-served basis. You can browse them under the 'Free Accommodation' category.",
    answerTe:
      "రాజమండ్రి మరియు పరిసర ప్రాంతాలలో ఉన్న ఉచిత వసతి కేంద్రాలు, సత్రాలు మరియు కమ్యూనిటీ డార్మిటరీల వివరాలు 'ఉచిత వసతి' విభాగంలో అందుబాటులో ఉన్నాయి. వీటిలో మంచినీరు, పరుపులు, విశ్రాంతి గదులు ఉచితంగా కల్పించబడతాయి.",
  },
  {
    id: "faq-annadanam",
    category: "ANNADANAM",
    keywords: ["annadanam", "free food", "prasadam", "meal", "lunch", "dinner", "అన్నదానం", "ఉచిత భోజనం", "ప్రసాదం"],
    questionEn: "Where is free Annadanam and Prasadam served during Pushkaralu?",
    questionTe: "పుష్కరాల సమయంలో ఉచిత అన్నదానం మరియు ప్రసాదం ఎక్కడ లభిస్తుంది?",
    answerEn:
      "Free Annadanam and sacred prasadam are served daily at major temple trusts, charitable organizations, and government pushkara centers around Kotilingala, Pushkar Ghat, and central bus stands. Check the 'Free Annadanam' section in Godavari One for live serving timings and queue wait times.",
    answerTe:
      "కోటిలింగాల, పుష్కర్ ఘాట్ మరియు ప్రధాన బస్టాండ్ల సమీపంలోని ప్రముఖ ఆలయాలు, సేవా సంస్థల ద్వారా నిరంతర అన్నదానం, ప్రసాద వితరణ జరుగుతుంది. లైవ్ సమయాల కోసం 'అన్నదానం' విభాగాన్ని చూడండి.",
  },
  {
    id: "faq-book-purohit",
    category: "CEREMONY",
    keywords: ["book purohit", "pinda pradanam", "tarpanam", "priest", "pandit", "పూజారి", "పురోహితుడు", "పిండ ప్రదానం"],
    questionEn: "How do I book a verified Purohit for Pinda Pradanam or rituals?",
    questionTe: "పిండ ప్రదానం లేదా పూజల కోసం పురోహితుడిని ఎలా బుక్ చేసుకోవాలి?",
    answerEn:
      "Under the 'Ceremonies & Purohits' category in Godavari One, you can browse verified purohits by specialization (e.g. Pinda Pradanam, Asthi Visarjanam, Rudrabhishekam), language proficiency, and assigned ghat. You can review transparent government dakshina guidelines, check real-time date/time slot availability, and submit an advance booking request.",
    answerTe:
      "'కర్మకాండలు & పురోహితులు' విభాగంలో ధృవీకరించబడిన వేద పండితుల వివరాలు ఉంటాయి. మీరు వారి ఘాట్, భాష, సమయాలు చూసి గోదావరి వన్ ద్వారా నేరుగా పూజా స్లాట్ బుక్ చేసుకోవచ్చు.",
  },
  {
    id: "faq-priority-ghat",
    category: "GHAT",
    keywords: ["priority ghat", "senior citizen", "wheelchair", "disability", "65+", "సీనియర్ సిటిజన్", "దివ్యాంగులు", "వీల్‌చైర్"],
    questionEn: "Who is eligible for Priority Ghat Bookings?",
    questionTe: "ప్రయారిటీ ఘాట్ బుకింగ్‌కు ఎవరికి అర్హత ఉంది?",
    answerEn:
      "Priority Ghat access is dedicated to Senior Citizens aged 65 years and above and Persons with Disabilities (PwD). Beneficiaries receive battery vehicle drop-off, ramped wheelchair access, dedicated safe bathing enclosures, and permission for 1 accompanying caregiver.",
    answerTe:
      "65 సంవత్సరాలు పైబడిన సీనియర్ సిటిజన్లు మరియు దివ్యాంగులకు ప్రయారిటీ ఘాట్ సదుపాయం కల్పించబడింది. వీరికి బ్యాటరీ వాహనాలు, వీల్‌చైర్ ర్యాంపులు మరియు సహాయకుడికి (ఒకరు) అనుమతి ఉంటుంది.",
  },
  {
    id: "faq-mandatory-auth",
    category: "BOOKING",
    keywords: ["login required", "sign in to book", "why login", "otp", "ఖాతా", "లాగిన్"],
    questionEn: "Why is authentication mandatory before booking hotels, tables, or purohits?",
    questionTe: "హోటళ్ళు లేదా పురోహితులను బుక్ చేయడానికి లాగిన్ ఎందుకు తప్పనిసరి?",
    answerEn:
      "To prevent automated scalping, ensure genuine pilgrim reservations, and provide instant booking confirmations and emergency alerts via email/SMS, all reservations require verified account sign-in via Email OTP or password. Public browsing remains completely free and open.",
    answerTe:
      "నకిలీ బుకింగ్స్ అరికట్టడానికి మరియు భక్తులకు పారదర్శక సేవలు అందించడానికి బుకింగ్ సమయంలో ఈమెయిల్ ఓటీపీతో ధృవీకరణ తప్పనిసరి. సమాచారం శోధించడం అందరికీ ఉచితం.",
  },
];
