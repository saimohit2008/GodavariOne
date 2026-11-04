// Godavari One Mobile — Categories and metadata
// Kept in exact sync with backend definitions in src/lib/constants.ts

export type ListingCategory =
  | 'RESTAURANT'
  | 'HOTEL'
  | 'GHAT'
  | 'HOSPITAL'
  | 'TRANSPORT'
  | 'TOURIST_SPOT'
  | 'FREE_ACCOMMODATION'
  | 'ANNADANAM'
  | 'CEREMONY';

export type CrowdStatus = 'FREE' | 'MODERATE' | 'CROWDED' | 'CLOSED' | 'OVERCROWDED' | 'EMERGENCY';

export interface CategoryMetaItem {
  id: ListingCategory;
  label: string;
  teLabel: string;
  iconName: string;
  symbol: {
    ios: string;
    android: string;
    web: string;
  };
  color: string;
  lightBg: string;
  darkBg: string;
  description: string;
  teDescription: string;
}

export const CATEGORY_META: Record<ListingCategory, CategoryMetaItem> = {
  RESTAURANT: {
    id: 'RESTAURANT',
    label: 'Restaurants & Dining',
    teLabel: 'రెస్టారెంట్‌లు & భోజనం',
    iconName: 'UtensilsCrossed',
    symbol: { ios: 'fork.knife', android: 'restaurant', web: 'utensils' },
    color: '#D97706',
    lightBg: '#FEF3C7',
    darkBg: '#3F2C0E',
    description: 'Authentic Andhra dining, vegetarian meals, and verified restaurants near pushkara ghats.',
    teDescription: 'పుష్కర ఘాట్‌ల సమీపంలో ప్రామాణిక ఆంధ్ర భోజనం మరియు ధృవీకరించబడిన రెస్టారెంట్‌లు.',
  },
  HOTEL: {
    id: 'HOTEL',
    label: 'Hotels & Accommodation',
    teLabel: 'హోటళ్లు & వసతి',
    iconName: 'BedDouble',
    symbol: { ios: 'bed.double.fill', android: 'hotel', web: 'hotel' },
    color: '#0D9488',
    lightBg: '#CCFBF1',
    darkBg: '#133E3A',
    description: 'Verified hotels, lodges, and guest houses for pilgrims visiting Godavari Pushkaralu.',
    teDescription: 'గోదావరి పుష్కర యాత్రికుల కోసం ధృవీకరించబడిన హోటళ్లు, లాడ్జీలు మరియు వసతి గృహాలు.',
  },
  GHAT: {
    id: 'GHAT',
    label: 'Ghats',
    teLabel: 'ఘాట్‌లు',
    iconName: 'Waves',
    symbol: { ios: 'water.waves', android: 'water', web: 'waves' },
    color: '#0284C7',
    lightBg: '#E0F2FE',
    darkBg: '#143C53',
    description: 'Sacred bathing ghats along Godavari riverbanks with live crowd status and facility updates.',
    teDescription: 'ప్రత్యక్ష రద్దీ సమాచారం మరియు వసతులతో గోదావరి పవిత్ర పుష్కర స్నాన ఘాట్‌లు.',
  },
  HOSPITAL: {
    id: 'HOSPITAL',
    label: 'Hospitals & Medical',
    teLabel: 'ఆసుపత్రులు & వైద్యం',
    iconName: 'Stethoscope',
    symbol: { ios: 'cross.case.fill', android: 'local_hospital', web: 'cross' },
    color: '#E11D48',
    lightBg: '#FFE4E6',
    darkBg: '#4C1825',
    description: '24/7 medical centers, emergency hospitals, and first-aid health posts along the festival route.',
    teDescription: 'పుష్కర మార్గంలో 24/7 వైద్య కేంద్రాలు, అత్యవసర ఆసుపత్రులు మరియు ప్రథమ చికిత్స కేంద్రాలు.',
  },
  TRANSPORT: {
    id: 'TRANSPORT',
    label: 'Travel & Transport',
    teLabel: 'ప్రయాణం & రవాణా',
    iconName: 'Bus',
    symbol: { ios: 'bus.fill', android: 'directions_bus', web: 'bus' },
    color: '#7C3AED',
    lightBg: '#EDE9FE',
    darkBg: '#351F56',
    description: 'Special bus routes, auto services, private cabs, and vehicle rentals for smooth transit.',
    teDescription: 'యాత్రికుల సౌకర్యార్థం ప్రత్యేక బస్సు మార్గాలు, ఆటో సర్వీసులు, క్యాబ్‌లు మరియు వాహన అద్దె సేవలు.',
  },
  TOURIST_SPOT: {
    id: 'TOURIST_SPOT',
    label: 'Tourist Spots & Heritage',
    teLabel: 'పర్యాటక స్థలాలు',
    iconName: 'Landmark',
    symbol: { ios: 'building.columns.fill', android: 'temple_hindu', web: 'landmark' },
    color: '#059669',
    lightBg: '#D1FAE5',
    darkBg: '#133D2D',
    description: 'Historical temples, cultural heritage landmarks, and scenic destinations along the river.',
    teDescription: 'గోదావరి తీరంలో చారిత్రక దేవాలయాలు, సాంస్కృతిక వారసత్వ ప్రదేశాలు మరియు పర్యాటక కేంద్రాలు.',
  },
  FREE_ACCOMMODATION: {
    id: 'FREE_ACCOMMODATION',
    label: 'Free Accommodation',
    teLabel: 'ఉచిత వసతి కేంద్రాలు',
    iconName: 'Home',
    symbol: { ios: 'house.fill', android: 'home', web: 'home' },
    color: '#4F46E5',
    lightBg: '#E0E7FF',
    darkBg: '#232959',
    description: 'Free pilgrim satrams, government shelter camps, and community dormitories with basic amenities.',
    teDescription: 'ప్రాథమిక సౌకర్యాలతో ఉచిత యాత్రికుల సత్రాలు, ప్రభుత్వ వసతి శిబిరాలు మరియు కమ్యూనిటీ డార్మిటరీలు.',
  },
  ANNADANAM: {
    id: 'ANNADANAM',
    label: 'Free Annadanam & Prasadam',
    teLabel: 'ఉచిత అన్నదానం & ప్రసాదం',
    iconName: 'Soup',
    symbol: { ios: 'takeoutbag.and.cup.and.straw.fill', android: 'soup_kitchen', web: 'bowl-rice' },
    color: '#EA580C',
    lightBg: '#FFEDD5',
    darkBg: '#44220F',
    description: 'Daily free meal distribution centers and sacred Prasadam counters operating throughout the festival.',
    teDescription: 'పుష్కరాల సమయంలో నిరంతర ఉచిత భోజన వితరణ కేంద్రాలు మరియు పవిత్ర ప్రసాద కౌంటర్లు.',
  },
  CEREMONY: {
    id: 'CEREMONY',
    label: 'Ceremony Portal',
    teLabel: 'పూజా & వైదిక పోర్టల్',
    iconName: 'Flame',
    symbol: { ios: 'flame.fill', android: 'local_fire_department', web: 'fire' },
    color: '#B45309',
    lightBg: '#FEF3C7',
    darkBg: '#3F2C0E',
    description: 'Verified Vedic purohits for Pinda Pradanam, Pitru Tarpana, Asthi Visarjan, and pushkara pujas.',
    teDescription: 'పిండ ప్రదానం, పితృ తర్పణం, అస్థి విసర్జన మరియు పుష్కర పూజల కోసం ధృవీకరించబడిన వేద పురోహితులు.',
  },
};

export const CROWD_META: Record<
  CrowdStatus,
  { label: string; teLabel: string; color: string; bgColor: string; dotColor: string }
> = {
  FREE: {
    label: 'Free (Low Crowd)',
    teLabel: 'ఖాళీ (తక్కువ రద్దీ)',
    color: '#065F46',
    bgColor: '#D1FAE5',
    dotColor: '#10B981',
  },
  MODERATE: {
    label: 'Moderate Crowd',
    teLabel: 'మధ్యమ రద్దీ',
    color: '#92400E',
    bgColor: '#FEF3C7',
    dotColor: '#F59E0B',
  },
  CROWDED: {
    label: 'Crowded (High)',
    teLabel: 'రద్దీ (ఎక్కువ)',
    color: '#9A3412',
    bgColor: '#FFEDD5',
    dotColor: '#F97316',
  },
  CLOSED: {
    label: 'Temporarily Closed',
    teLabel: 'తాత్కాలికంగా మూసివేయబడింది',
    color: '#475569',
    bgColor: '#F1F5F9',
    dotColor: '#64748B',
  },
  OVERCROWDED: {
    label: 'Overcrowded',
    teLabel: 'చాలా రద్దీ',
    color: '#991B1B',
    bgColor: '#FEE2E2',
    dotColor: '#EF4444',
  },
  EMERGENCY: {
    label: 'Emergency Alert',
    teLabel: 'అత్యవసరం',
    color: '#FFFFFF',
    bgColor: '#DC2626',
    dotColor: '#FFFFFF',
  },
};

export interface EmergencyContact {
  name: string;
  teName: string;
  number: string;
  description: string;
  teDescription: string;
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    name: 'Police Emergency',
    teName: 'పోలీసు అత్యవసర సేవ',
    number: '100',
    description: 'Immediate local police assistance',
    teDescription: 'తక్షణ పోలీసు సహాయం',
  },
  {
    name: 'Ambulance & Medical',
    teName: 'అంబులెన్స్ & వైద్యం',
    number: '108',
    description: 'Emergency medical services & transit',
    teDescription: 'అత్యవసర వైద్య రవాణా సేవ',
  },
  {
    name: 'Fire Department',
    teName: 'అగ్నిమాపక సేవ',
    number: '101',
    description: 'Fire & rescue emergencies',
    teDescription: 'అగ్ని ప్రమాదాల రక్షణ దళం',
  },
  {
    name: 'Women Helpline',
    teName: 'మహిళా హెల్ప్‌లైన్',
    number: '1091',
    description: 'Dedicated women safety & support',
    teDescription: 'మహిళల భద్రత & రక్షణ సహాయం',
  },
  {
    name: 'Child Helpline',
    teName: 'శిశు హెల్ప్‌లైన్',
    number: '1098',
    description: 'Child assistance & missing child alerts',
    teDescription: 'పిల్లల సహాయం & తప్పిపోయిన సమాచారం',
  },
  {
    name: 'Disaster Management',
    teName: 'విపత్తు నిర్వహణ',
    number: '1070',
    description: 'State flood & crowd disaster response',
    teDescription: 'వరద & విపత్తు అత్యవసర స్పందన',
  },
];
