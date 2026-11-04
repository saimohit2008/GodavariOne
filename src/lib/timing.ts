// Godavari One — Timing & Operating Hours Calculation Engine
// Timezone: India Standard Time (Asia/Kolkata)

export interface OperatingInterval {
  open: string;  // "HH:MM" (24hr format)
  close: string; // "HH:MM" (24hr format)
  label?: string; // e.g. "Morning Session", "Dinner"
}

export interface SpecialHourRule {
  date: string;     // "YYYY-MM-DD"
  isClosed: boolean;
  open?: string;    // "HH:MM"
  close?: string;   // "HH:MM"
  note?: string;    // e.g. "Pushkaram Mahapuja", "Diwali"
}

export interface ListingScheduleData {
  id?: string;
  listingId?: string;
  open24Hours?: boolean;
  isTemporarilyClosed?: boolean;
  temporaryClosureReason?: string | null;
  temporaryClosureUntil?: string | Date | null;
  openingTime?: string | null;
  closingTime?: string | null;
  operatingDays?: string[] | string | null;
  closedDays?: string[] | string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  intervals?: OperatingInterval[] | string | null;
  specialHours?: SpecialHourRule[] | string | null;
  timezone?: string;
  updatedAt?: string | Date;
  lastUpdatedById?: string | null;
}

export type TimingStatusCode =
  | "OPEN_NOW"
  | "CLOSED_NOW"
  | "OPEN_24_HOURS"
  | "TEMPORARILY_CLOSED"
  | "HOURS_NOT_AVAILABLE";

export interface TimingStatusResult {
  code: TimingStatusCode;
  label: string;             // Short status: "Open now", "Closed now", etc.
  detail: string;            // Full line: "Open now · Closes at 10:00 PM"
  nextChangeTime?: string;   // "10:00 PM" or "Tomorrow at 7:00 AM"
  badgeVariant: "open" | "closed" | "warning" | "neutral";
  isOpen: boolean;
  isTemporarilyClosed: boolean;
  closureReason?: string;
  closureUntil?: string;
  timezone: string;
  todayScheduleText?: string;
}

export const DAYS_OF_WEEK = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Helper: Get current parts in IST (Asia/Kolkata)
export function getIstParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const find = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const year = parseInt(find("year"), 10);
  const month = parseInt(find("month"), 10);
  const day = parseInt(find("day"), 10);
  let hour = parseInt(find("hour"), 10);
  // Intl may return "24" for midnight hour in some environments
  if (hour === 24) hour = 0;
  const minute = parseInt(find("minute"), 10);
  const weekday = find("weekday").toUpperCase() as DayOfWeek;

  const yyyyMmDd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const minutesSinceMidnight = hour * 60 + minute;

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    yyyyMmDd,
    minutesSinceMidnight,
  };
}

// Convert "HH:MM" (24hr) to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.trim().split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert "HH:MM" (24hr) to readable 12hr IST string ("7:00 AM", "10:30 PM")
export function formatTime12h(timeStr?: string | null): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mFormatted = m === 0 ? "00" : String(m).padStart(2, "0");
  return `${h}:${mFormatted} ${ampm}`;
}

export function parseJsonField<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === "object") return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

// Normalize a schedule model into structured representation
export function normalizeSchedule(raw?: ListingScheduleData | null): {
  open24Hours: boolean;
  isTemporarilyClosed: boolean;
  temporaryClosureReason?: string;
  temporaryClosureUntil?: string;
  openingTime?: string;
  closingTime?: string;
  operatingDays: DayOfWeek[];
  closedDays: DayOfWeek[];
  breakStart?: string;
  breakEnd?: string;
  intervals: OperatingInterval[];
  specialHours: SpecialHourRule[];
  timezone: string;
  hasSchedule: boolean;
  updatedAt?: string | Date;
} {
  if (!raw) {
    return {
      open24Hours: false,
      isTemporarilyClosed: false,
      operatingDays: [...DAYS_OF_WEEK],
      closedDays: [],
      intervals: [],
      specialHours: [],
      timezone: "Asia/Kolkata",
      hasSchedule: false,
    };
  }

  const open24Hours = !!raw.open24Hours;
  const isTemporarilyClosed = !!raw.isTemporarilyClosed;
  const temporaryClosureReason = raw.temporaryClosureReason || undefined;
  const temporaryClosureUntil = raw.temporaryClosureUntil
    ? new Date(raw.temporaryClosureUntil).toISOString()
    : undefined;

  const operatingDaysRaw = parseJsonField<string[]>(raw.operatingDays, []);
  const closedDaysRaw = parseJsonField<string[]>(raw.closedDays, []);
  const intervalsRaw = parseJsonField<OperatingInterval[]>(raw.intervals, []);
  const specialHoursRaw = parseJsonField<SpecialHourRule[]>(raw.specialHours, []);

  const openingTime = raw.openingTime?.trim() || undefined;
  const closingTime = raw.closingTime?.trim() || undefined;
  const breakStart = raw.breakStart?.trim() || undefined;
  const breakEnd = raw.breakEnd?.trim() || undefined;

  // Build resolved intervals
  let intervals: OperatingInterval[] = [];
  if (Array.isArray(intervalsRaw) && intervalsRaw.length > 0) {
    intervals = intervalsRaw.filter((it) => it.open && it.close);
  } else if (openingTime && closingTime) {
    if (breakStart && breakEnd) {
      intervals = [
        { open: openingTime, close: breakStart, label: "Morning Session" },
        { open: breakEnd, close: closingTime, label: "Evening Session" },
      ];
    } else {
      intervals = [{ open: openingTime, close: closingTime }];
    }
  }

  const operatingDays = (Array.isArray(operatingDaysRaw) && operatingDaysRaw.length > 0
    ? operatingDaysRaw.map((d) => d.toUpperCase() as DayOfWeek).filter((d) => DAYS_OF_WEEK.includes(d))
    : [...DAYS_OF_WEEK]) as DayOfWeek[];

  const closedDays = (Array.isArray(closedDaysRaw)
    ? closedDaysRaw.map((d) => d.toUpperCase() as DayOfWeek).filter((d) => DAYS_OF_WEEK.includes(d))
    : []) as DayOfWeek[];

  const hasSchedule =
    open24Hours ||
    isTemporarilyClosed ||
    intervals.length > 0 ||
    !!openingTime ||
    specialHoursRaw.length > 0;

  return {
    open24Hours,
    isTemporarilyClosed,
    temporaryClosureReason,
    temporaryClosureUntil,
    openingTime,
    closingTime,
    operatingDays,
    closedDays,
    breakStart,
    breakEnd,
    intervals,
    specialHours: Array.isArray(specialHoursRaw) ? specialHoursRaw : [],
    timezone: raw.timezone || "Asia/Kolkata",
    hasSchedule,
    updatedAt: raw.updatedAt,
  };
}

// Get the operating intervals for a specific day in IST
function getDayIntervals(
  day: DayOfWeek,
  dateStr: string,
  schedule: ReturnType<typeof normalizeSchedule>
): { isClosed: boolean; intervals: OperatingInterval[]; specialNote?: string } {
  // 1. Check special holiday / event rule for this exact date (YYYY-MM-DD)
  const special = schedule.specialHours.find((s) => s.date === dateStr);
  if (special) {
    if (special.isClosed) {
      return { isClosed: true, intervals: [], specialNote: special.note || "Special Closure" };
    }
    if (special.open && special.close) {
      return {
        isClosed: false,
        intervals: [{ open: special.open, close: special.close, label: special.note || "Special Event Hours" }],
        specialNote: special.note,
      };
    }
  }

  // 2. Check open 24 hours
  if (schedule.open24Hours) {
    return { isClosed: false, intervals: [{ open: "00:00", close: "23:59", label: "24 Hours" }] };
  }

  // 3. Check weekly closed days
  if (schedule.closedDays.includes(day) || !schedule.operatingDays.includes(day)) {
    return { isClosed: true, intervals: [] };
  }

  return { isClosed: false, intervals: schedule.intervals };
}

// Calculate real-time status in Asia/Kolkata timezone
export function calculateTimingStatus(
  rawSchedule?: ListingScheduleData | null,
  referenceDate: Date = new Date()
): TimingStatusResult {
  const schedule = normalizeSchedule(rawSchedule);

  if (!schedule.hasSchedule) {
    return {
      code: "HOURS_NOT_AVAILABLE",
      label: "Hours not available",
      detail: "Hours not available",
      badgeVariant: "neutral",
      isOpen: false,
      isTemporarilyClosed: false,
      timezone: schedule.timezone,
    };
  }

  const ist = getIstParts(referenceDate);

  // 1. Check temporary closure
  if (schedule.isTemporarilyClosed) {
    let stillClosed = true;
    if (schedule.temporaryClosureUntil) {
      const untilDate = new Date(schedule.temporaryClosureUntil);
      if (!isNaN(untilDate.getTime()) && referenceDate > untilDate) {
        stillClosed = false; // Expired closure
      }
    }

    if (stillClosed) {
      const untilFormatted = schedule.temporaryClosureUntil
        ? new Date(schedule.temporaryClosureUntil).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            month: "short",
            day: "numeric",
          })
        : undefined;

      const detail = untilFormatted
        ? `Temporarily closed until ${untilFormatted}${schedule.temporaryClosureReason ? ` (${schedule.temporaryClosureReason})` : ""}`
        : `Temporarily closed${schedule.temporaryClosureReason ? `: ${schedule.temporaryClosureReason}` : ""}`;

      return {
        code: "TEMPORARILY_CLOSED",
        label: "Temporarily closed",
        detail,
        badgeVariant: "warning",
        isOpen: false,
        isTemporarilyClosed: true,
        closureReason: schedule.temporaryClosureReason,
        closureUntil: schedule.temporaryClosureUntil,
        timezone: schedule.timezone,
      };
    }
  }

  // 2. Open 24 Hours
  if (schedule.open24Hours) {
    // Check if there is an explicit special closure rule today
    const specialToday = schedule.specialHours.find((s) => s.date === ist.yyyyMmDd);
    if (specialToday?.isClosed) {
      return {
        code: "CLOSED_NOW",
        label: "Closed now",
        detail: `Closed today · ${specialToday.note || "Special Event"}`,
        badgeVariant: "closed",
        isOpen: false,
        isTemporarilyClosed: false,
        timezone: schedule.timezone,
      };
    }

    return {
      code: "OPEN_24_HOURS",
      label: "Open 24 hours",
      detail: "Open 24 hours",
      badgeVariant: "open",
      isOpen: true,
      isTemporarilyClosed: false,
      timezone: schedule.timezone,
    };
  }

  // 3. Evaluate Today and Yesterday (for overnight schedules)
  const currentMinutes = ist.minutesSinceMidnight;
  const todayRules = getDayIntervals(ist.weekday, ist.yyyyMmDd, schedule);

  // Check overnight intervals from yesterday:
  // E.g. Yesterday had an interval open at 19:00 and close at 02:00.
  // If currentMinutes < 02:00 (120 min), we are STILL open from yesterday's session!
  const yesterdayDate = new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayIst = getIstParts(yesterdayDate);
  const yesterdayRules = getDayIntervals(yesterdayIst.weekday, yesterdayIst.yyyyMmDd, schedule);

  for (const interval of yesterdayRules.intervals) {
    const openMin = timeToMinutes(interval.open);
    const closeMin = timeToMinutes(interval.close);
    const isOvernight = closeMin <= openMin; // Closes next day

    if (isOvernight && currentMinutes < closeMin) {
      return {
        code: "OPEN_NOW",
        label: "Open now",
        detail: `Open now · Closes at ${formatTime12h(interval.close)}`,
        nextChangeTime: formatTime12h(interval.close),
        badgeVariant: "open",
        isOpen: true,
        isTemporarilyClosed: false,
        timezone: schedule.timezone,
      };
    }
  }

  // If today is closed:
  if (todayRules.isClosed || todayRules.intervals.length === 0) {
    const nextOpen = findNextOpenTime(referenceDate, schedule);
    return {
      code: "CLOSED_NOW",
      label: "Closed today",
      detail: nextOpen ? `Closed today · Opens ${nextOpen}` : "Closed today",
      nextChangeTime: nextOpen,
      badgeVariant: "closed",
      isOpen: false,
      isTemporarilyClosed: false,
      timezone: schedule.timezone,
    };
  }

  // Check today's intervals
  // Sort intervals by opening time
  const sortedIntervals = [...todayRules.intervals].sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open));

  for (let i = 0; i < sortedIntervals.length; i++) {
    const it = sortedIntervals[i];
    const openMin = timeToMinutes(it.open);
    const closeMin = timeToMinutes(it.close);
    const isOvernight = closeMin <= openMin;

    if (isOvernight) {
      // Overnight interval starting today and closing tomorrow morning
      if (currentMinutes >= openMin) {
        return {
          code: "OPEN_NOW",
          label: "Open now",
          detail: `Open now · Closes at ${formatTime12h(it.close)}`,
          nextChangeTime: formatTime12h(it.close),
          badgeVariant: "open",
          isOpen: true,
          isTemporarilyClosed: false,
          timezone: schedule.timezone,
        };
      }
    } else {
      // Normal same-day interval
      if (currentMinutes >= openMin && currentMinutes < closeMin) {
        return {
          code: "OPEN_NOW",
          label: "Open now",
          detail: `Open now · Closes at ${formatTime12h(it.close)}`,
          nextChangeTime: formatTime12h(it.close),
          badgeVariant: "open",
          isOpen: true,
          isTemporarilyClosed: false,
          timezone: schedule.timezone,
        };
      }
    }

    // Check if we are currently BEFORE this interval (and after previous one if any)
    if (currentMinutes < openMin) {
      return {
        code: "CLOSED_NOW",
        label: "Closed now",
        detail: `Closed now · Opens at ${formatTime12h(it.open)}`,
        nextChangeTime: formatTime12h(it.open),
        badgeVariant: "closed",
        isOpen: false,
        isTemporarilyClosed: false,
        timezone: schedule.timezone,
      };
    }
  }

  // We are past all intervals for today
  const nextOpen = findNextOpenTime(referenceDate, schedule);
  return {
    code: "CLOSED_NOW",
    label: "Closed now",
    detail: nextOpen ? `Closed now · Opens ${nextOpen}` : "Closed now",
    nextChangeTime: nextOpen,
    badgeVariant: "closed",
    isOpen: false,
    isTemporarilyClosed: false,
    timezone: schedule.timezone,
  };
}

// Find next opening time across the coming 7 days
function findNextOpenTime(fromDate: Date, schedule: ReturnType<typeof normalizeSchedule>): string | undefined {
  for (let d = 1; d <= 7; d++) {
    const nextDate = new Date(fromDate.getTime() + d * 24 * 60 * 60 * 1000);
    const ist = getIstParts(nextDate);
    const dayRules = getDayIntervals(ist.weekday, ist.yyyyMmDd, schedule);

    if (!dayRules.isClosed && dayRules.intervals.length > 0) {
      const firstIt = [...dayRules.intervals].sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open))[0];
      const timeStr = formatTime12h(firstIt.open);
      if (d === 1) return `tomorrow at ${timeStr}`;
      return `${ist.weekday.slice(0, 3)} at ${timeStr}`;
    }
  }
  return undefined;
}

export interface AnnadanamServingStatusResult {
  code: "SERVING_NOW" | "PAUSED" | "ENDED" | "UPCOMING" | "TEMPORARILY_UNAVAILABLE" | "NOT_CONFIRMED" | "SCHEDULE_NOT_AVAILABLE";
  label: string;
  detail: string;
  currentSessionName?: string;
  nextSessionText?: string;
  isServing: boolean;
  badgeVariant: "open" | "closed" | "warning" | "neutral";
  remainingServings?: number | null;
  queueWaitMinutes?: number | null;
}

export function calculateAnnadanamServingStatus(
  annadanam: {
    servingStatus?: string | null;
    sessions?: string | null | any[];
    queueWaitMinutes?: number | null;
    remainingServings?: number | null;
    servingsConfirmed?: boolean | null;
  } | null | undefined,
  refDate: Date = new Date()
): AnnadanamServingStatusResult {
  if (!annadanam) {
    return {
      code: "SCHEDULE_NOT_AVAILABLE",
      label: "Schedule not available",
      detail: "Distribution schedule has not been registered",
      isServing: false,
      badgeVariant: "neutral",
    };
  }

  const { servingStatus = "ACTIVE", queueWaitMinutes, remainingServings } = annadanam;

  if (servingStatus === "TEMPORARILY_UNAVAILABLE") {
    return {
      code: "TEMPORARILY_UNAVAILABLE",
      label: "Temporarily Unavailable",
      detail: "Meal distribution is temporarily suspended",
      isServing: false,
      badgeVariant: "warning",
      queueWaitMinutes,
      remainingServings,
    };
  }

  if (servingStatus === "PAUSED") {
    return {
      code: "PAUSED",
      label: "Distribution Paused",
      detail: "Staff reported distribution is temporarily paused",
      isServing: false,
      badgeVariant: "warning",
      queueWaitMinutes,
      remainingServings,
    };
  }

  if (servingStatus === "ENDED") {
    return {
      code: "ENDED",
      label: "Distribution Concluded",
      detail: "Meal service has ended for today",
      isServing: false,
      badgeVariant: "closed",
      queueWaitMinutes,
      remainingServings,
    };
  }

  // Parse sessions
  let sessionsList: Array<{ name: string; startTime: string; endTime: string }> = [];
  if (annadanam.sessions) {
    if (Array.isArray(annadanam.sessions)) {
      sessionsList = annadanam.sessions;
    } else if (typeof annadanam.sessions === "string") {
      try {
        sessionsList = JSON.parse(annadanam.sessions);
      } catch {
        sessionsList = [];
      }
    }
  }

  if (!sessionsList || sessionsList.length === 0) {
    if (servingStatus === "ACTIVE") {
      return {
        code: "NOT_CONFIRMED",
        label: "Current availability not confirmed",
        detail: "Service marked active, but detailed session times are not configured",
        isServing: false,
        badgeVariant: "neutral",
        queueWaitMinutes,
        remainingServings,
      };
    }
    return {
      code: "SCHEDULE_NOT_AVAILABLE",
      label: "Schedule not available",
      detail: "No active serving sessions configured",
      isServing: false,
      badgeVariant: "neutral",
    };
  }

  const ist = getIstParts(refDate);
  const currentMinutes = ist.minutesSinceMidnight;

  // Sort sessions chronologically
  const sorted = [...sessionsList].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Check if currently within any session
  for (const sess of sorted) {
    const sStart = timeToMinutes(sess.startTime);
    const sEnd = timeToMinutes(sess.endTime);

    if (currentMinutes >= sStart && currentMinutes < sEnd) {
      if (servingStatus === "ACTIVE") {
        const remainingStr = remainingServings != null ? ` · ~${remainingServings} servings left` : "";
        const queueStr = queueWaitMinutes != null && queueWaitMinutes > 0 ? ` · ~${queueWaitMinutes} min queue` : "";
        return {
          code: "SERVING_NOW",
          label: `Currently Serving ${sess.name || "Meals"}`,
          detail: `Serving until ${formatTime12h(sess.endTime)}${remainingStr}${queueStr}`,
          currentSessionName: sess.name,
          isServing: true,
          badgeVariant: "open",
          queueWaitMinutes,
          remainingServings,
        };
      }
    }

    if (currentMinutes < sStart) {
      return {
        code: "UPCOMING",
        label: `Next: ${sess.name || "Meals"} at ${formatTime12h(sess.startTime)}`,
        detail: `Upcoming session starts at ${formatTime12h(sess.startTime)} · until ${formatTime12h(sess.endTime)}`,
        nextSessionText: `${sess.name} at ${formatTime12h(sess.startTime)}`,
        isServing: false,
        badgeVariant: "closed",
        queueWaitMinutes,
        remainingServings,
      };
    }
  }

  // All sessions concluded for today
  return {
    code: "ENDED",
    label: "Distribution Ended For Today",
    detail: "All scheduled sessions have concluded for today",
    isServing: false,
    badgeVariant: "closed",
    queueWaitMinutes,
    remainingServings,
  };
}

