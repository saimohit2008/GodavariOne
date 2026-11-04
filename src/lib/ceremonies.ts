
export const CEREMONY_TYPES = [
  { id: "pinda_pradanam", label: "Pinda Pradanam (Ancestral Food Offering)", teLabel: "పిండ ప్రదానం", duration: 90, defaultFee: 2500 },
  { id: "pitru_tarpana", label: "Pitru Tarpana & Pushkara Snanam", teLabel: "పితృ తర్పణం & పుష్కర స్నానం", duration: 60, defaultFee: 1500 },
  { id: "asthi_visarjan", label: "Asthi Visarjan & Sacred Immersion", teLabel: "అస్థి నిమజ్జనం", duration: 60, defaultFee: 2000 },
  { id: "shraddha_karma", label: "Shraddha Karma (Ancestral Rites)", teLabel: "శ్రాద్ధ కర్మ", duration: 120, defaultFee: 3500 },
  { id: "pushkara_snanam_pooja", label: "Pushkara Snanam Maha Sankalpam", teLabel: "పుష్కర స్నాన మహా సంకల్పం", duration: 45, defaultFee: 1100 },
  { id: "samoohika_pooja", label: "Samoohika Pushkara Pooja (Family)", teLabel: "సామూహిక పుష్కర పూజ", duration: 90, defaultFee: 3000 },
  { id: "godavari_harathi", label: "Maha Godavari Harathi Sankalpam", teLabel: "మహా గోదావరి హారతి సంకల్పం", duration: 45, defaultFee: 1200 },
] as const;

export const CEREMONY_LOCATIONS = [
  "Kotilingala Ghat, Rajahmundry",
  "Pushkar Ghat, Rajahmundry",
  "Saraswati Ghat, Rajahmundry",
  "Markandeya Ghat, Rajahmundry",
  "Goshpada Kshetram Ghat, Kovvur",
  "VIP / Pushkar Ghat, Rajahmundry",
  "Visitor Hotel / Private Residence",
] as const;

export const CEREMONY_LANGUAGES = [
  "Telugu",
  "Sanskrit",
  "Hindi",
  "English",
  "Tamil",
  "Kannada",
] as const;

export function generateCeremonyReference(): string {
  const bytes = new Uint8Array(3);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 3; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `CER-2027-${rand}`;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, minutes));
  const h = Math.floor(normalized / 60).toString().padStart(2, "0");
  const m = (normalized % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Returns true if two time intervals [startA, endA) and [startB, endB) overlap.
 */
export function intervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return Math.max(sA, sB) < Math.min(eA, eB);
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
}

export function computeDailySlots(params: {
  date: string; // YYYY-MM-DD
  workingHoursStart: string; // HH:MM
  workingHoursEnd: string; // HH:MM
  breakStart?: string | null;
  breakEnd?: string | null;
  slotDurationMinutes: number;
  blockedPeriods: { startTime?: string | null; endTime?: string | null; isAllDay?: boolean; reason?: string | null }[];
  existingBookings: { startTime: string; endTime: string; status: string }[];
}): AvailableSlot[] {
  const duration = Math.max(15, params.slotDurationMinutes || 60);
  const startM = timeToMinutes(params.workingHoursStart || "06:00");
  const endM = timeToMinutes(params.workingHoursEnd || "18:00");
  
  const slots: AvailableSlot[] = [];

  // If there's an all-day block for this date
  const allDayBlock = params.blockedPeriods.find(b => b.isAllDay || (!b.startTime && !b.endTime));
  if (allDayBlock) {
    return [];
  }

  const activeBookings = params.existingBookings.filter(b => 
    ["PENDING", "CONFIRMED", "RESCHEDULE_REQUESTED"].includes(b.status)
  );

  let current = startM;
  while (current + duration <= endM) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + duration);

    let isAvailable = true;
    let conflictReason: string | undefined = undefined;

    // Check break time
    if (params.breakStart && params.breakEnd) {
      if (intervalsOverlap(slotStart, slotEnd, params.breakStart, params.breakEnd)) {
        isAvailable = false;
        conflictReason = "Break Time";
      }
    }

    // Check blocked periods
    if (isAvailable) {
      for (const block of params.blockedPeriods) {
        if (block.startTime && block.endTime) {
          if (intervalsOverlap(slotStart, slotEnd, block.startTime, block.endTime)) {
            isAvailable = false;
            conflictReason = block.reason || "Purohit Unavailable";
            break;
          }
        }
      }
    }

    // Check existing active bookings
    if (isAvailable) {
      for (const booking of activeBookings) {
        if (intervalsOverlap(slotStart, slotEnd, booking.startTime, booking.endTime)) {
          isAvailable = false;
          conflictReason = "Already Booked";
          break;
        }
      }
    }

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      isAvailable,
      reason: conflictReason,
    });

    current += duration;
  }

  return slots;
}
