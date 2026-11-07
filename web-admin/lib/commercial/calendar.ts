/**
 * Business calendar math for ready-by (Service Speeds PLAN.md §5, D4, D10).
 *
 * Why: ready-by must follow opening hours, weekends, public holidays, the
 * organization's own closures / short days and the cut-off time, in the
 * branch's time zone. Pure: the loader passes every fact; nothing is fetched.
 *
 * Times of day are local wall-clock minutes; instants are `Date`. Time-zone
 * conversion uses `Intl` (no dependency), so DST zones work.
 */

/** JS `getUTCDay()` order; the keys of `business_hours` JSON. */
export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
/** A `business_hours` key. */
export type Weekday = (typeof WEEKDAYS)[number];

/** One day's opening hours, `HH:MM`. */
export interface DayHours {
  open: string;
  close: string;
}
/** `org_tenants_mst.business_hours` / `org_branches_mst.business_hours`: null = closed. */
export type BusinessHours = Partial<Record<Weekday, DayHours | null>>;

/** One `org_holidays_cf` row. */
export interface HolidayOverride {
  /** `YYYY-MM-DD`. */
  date: string;
  isClosed: boolean;
  /** `HH:MM` when `isClosed` is false. */
  openTime: string | null;
  closeTime: string | null;
}

/** Calendar fields of an organization or a branch (branch NULL = organization's). */
export interface CalendarFields {
  timeZone: string | null;
  businessHours: BusinessHours | null;
  /** `HH:MM[:SS]`. */
  cutoffTime: string | null;
  readyTime: string | null;
}

/** Everything `resolveCalendar` merges. */
export interface CalendarInput {
  branch: CalendarFields | null;
  tenant: CalendarFields;
  /** Dates (`YYYY-MM-DD`) of active public holidays for the branch's country. */
  publicHolidayDates: readonly string[];
  /** Organization-wide `org_holidays_cf` rows (branch_id NULL). */
  tenantHolidays: readonly HolidayOverride[];
  /** This branch's `org_holidays_cf` rows; they win over organization rows. */
  branchHolidays: readonly HolidayOverride[];
}

/** One day's open window in local minutes, or closed. */
interface DayWindow {
  open: number;
  close: number;
}

/** The effective calendar of one branch. */
export interface ResolvedCalendar {
  timeZone: string;
  businessHours: BusinessHours;
  /** Local minutes, or null = no cut-off. */
  cutoffMinutes: number | null;
  /** Local minutes, or null = closing time. */
  readyMinutes: number | null;
  /** Date overrides: null = closed, a window = open those hours. */
  days: ReadonlyMap<string, DayWindow | null>;
}

/** Days scanned before giving up; a calendar with no opening for a year is broken. */
const MAX_SCAN_DAYS = 400;
const MINUTE_MS = 60_000;

/**
 * Parses `HH:MM` or `HH:MM:SS` into minutes after midnight.
 * @param value the time of day
 * @returns minutes (0–1440)
 * @throws Error when the value is not a time of day
 */
export function parseTimeOfDay(value: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time of day: ${value}`);
  const [h, m, s] = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
  // 24:00 is allowed as an end-of-day closing time.
  if (h > 24 || m > 59 || s > 59 || (h === 24 && (m > 0 || s > 0))) throw new Error(`Invalid time of day: ${value}`);
  return h * 60 + m + s / 60;
}

const windowOf = (open: string | null | undefined, close: string | null | undefined): DayWindow | null => {
  if (!open || !close) return null;
  const w = { open: parseTimeOfDay(open), close: parseTimeOfDay(close) };
  return w.open < w.close ? w : null;
};

/**
 * Merges branch, organization and holiday facts into one calendar
 * (branch value → organization value, per field).
 * @param input branch and organization fields, public holidays and overrides
 * @returns the calendar, or null when no time zone or no open weekday is configured
 */
export function resolveCalendar(input: CalendarInput): ResolvedCalendar | null {
  const pick = <K extends keyof CalendarFields>(key: K): CalendarFields[K] => input.branch?.[key] ?? input.tenant[key];
  const timeZone = pick('timeZone');
  const businessHours = pick('businessHours');
  if (!timeZone || !businessHours) return null;
  if (!WEEKDAYS.some((d) => windowOf(businessHours[d]?.open, businessHours[d]?.close))) return null;

  const cutoff = pick('cutoffTime');
  const ready = pick('readyTime');
  const days = new Map<string, DayWindow | null>();
  for (const date of input.publicHolidayDates) days.set(date, null);
  // Organization rows replace public holidays; branch rows replace both.
  for (const h of [...input.tenantHolidays, ...input.branchHolidays]) {
    days.set(h.date, h.isClosed ? null : windowOf(h.openTime, h.closeTime));
  }
  return {
    timeZone,
    businessHours,
    cutoffMinutes: cutoff ? parseTimeOfDay(cutoff) : null,
    readyMinutes: ready ? parseTimeOfDay(ready) : null,
    days,
  };
}

// ---------------------------------------------------------------- time zones

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
};

/** Local date and minutes of an instant. */
export interface LocalTime {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Minutes after local midnight (fractional seconds kept). */
  minutes: number;
}

/**
 * The local date and time of an instant in a time zone.
 * @param instant the moment
 * @param timeZone IANA zone, e.g. `Asia/Muscat`
 * @returns local date and minutes
 */
export function toLocal(instant: Date, timeZone: string): LocalTime {
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  const ms = instant.getTime() % 1000;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute) + (Number(parts.second) + (ms < 0 ? ms + 1000 : ms) / 1000) / 60,
  };
}

const utcOfDate = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const offsetMs = (instant: number, timeZone: string): number => {
  const local = toLocal(new Date(instant), timeZone);
  return utcOfDate(local.date) + local.minutes * MINUTE_MS - instant;
};

/**
 * The instant of a local date and time in a time zone. In a DST gap the
 * result moves forward with the clock.
 * @param date `YYYY-MM-DD`
 * @param minutes minutes after local midnight
 * @param timeZone IANA zone
 * @returns the instant
 */
export function fromLocal(date: string, minutes: number, timeZone: string): Date {
  const naive = utcOfDate(date) + Math.round(minutes * MINUTE_MS);
  const first = naive - offsetMs(naive, timeZone);
  return new Date(naive - offsetMs(first, timeZone));
}

/**
 * Adds calendar days to a `YYYY-MM-DD` date.
 * @param date the date
 * @param days days to add (may be negative)
 * @returns the new date
 */
export function addDays(date: string, days: number): string {
  return new Date(utcOfDate(date) + days * 86_400_000).toISOString().slice(0, 10);
}

const weekdayOf = (date: string): Weekday => WEEKDAYS[new Date(utcOfDate(date)).getUTCDay()];

// ---------------------------------------------------------------- working time

/**
 * The open window of a local date: a date override wins, else the weekday hours.
 * @param cal the calendar
 * @param date `YYYY-MM-DD`
 * @returns the window, or null when closed
 */
export function openWindow(cal: ResolvedCalendar, date: string): DayWindow | null {
  if (cal.days.has(date)) return cal.days.get(date) ?? null;
  const hours = cal.businessHours[weekdayOf(date)];
  return windowOf(hours?.open, hours?.close);
}

/**
 * The first open moment at or after an instant.
 * @param cal the calendar
 * @param instant where to start
 * @returns the instant itself when open, else the next opening
 * @throws Error when no opening exists within the scan limit
 */
export function nextOpening(cal: ResolvedCalendar, instant: Date): Date {
  return addWorkingMinutes(cal, instant, 0);
}

/**
 * When counting starts for a drop-off: after the cut-off (or on a closed
 * day / after closing) it is the next day's opening.
 * @param cal the calendar
 * @param dropOff the drop-off instant
 * @param cutoffMinutes this speed's cut-off (local minutes); null = the calendar's
 * @returns the instant counting starts
 */
export function countingStart(cal: ResolvedCalendar, dropOff: Date, cutoffMinutes: number | null = null): Date {
  const cutoff = cutoffMinutes ?? cal.cutoffMinutes;
  const local = toLocal(dropOff, cal.timeZone);
  if (cutoff != null && local.minutes > cutoff) {
    return nextOpening(cal, fromLocal(addDays(local.date, 1), 0, cal.timeZone));
  }
  return nextOpening(cal, dropOff);
}

/**
 * Adds working minutes, counting only inside open windows.
 * @param cal the calendar
 * @param start where to start
 * @param minutes working minutes to add (0 = next opening)
 * @returns the instant the minutes run out
 * @throws Error on negative minutes or when no opening exists within the scan limit
 */
export function addWorkingMinutes(cal: ResolvedCalendar, start: Date, minutes: number): Date {
  if (minutes < 0) throw new Error('Working minutes cannot be negative.');
  let { date, minutes: at } = toLocal(start, cal.timeZone);
  let remaining = minutes;
  for (let i = 0; i < MAX_SCAN_DAYS; i += 1) {
    const w = openWindow(cal, date);
    if (w) {
      const from = Math.max(at, w.open);
      if (from < w.close) {
        if (remaining <= w.close - from) return fromLocal(date, from + remaining, cal.timeZone);
        remaining -= w.close - from;
      }
    }
    date = addDays(date, 1);
    at = 0;
  }
  throw new Error('Calendar has no opening within the scan limit.');
}

/**
 * Ready time N working days after a counting start: day 0 is the start's
 * own day; the time is the ready time, capped at that day's closing.
 * @param cal the calendar
 * @param start the counting start (an open moment, from `countingStart`)
 * @param days working days (0 = same day)
 * @returns the promised instant (never before `start`)
 * @throws Error on negative days or when no opening exists within the scan limit
 */
export function addWorkingDays(cal: ResolvedCalendar, start: Date, days: number): Date {
  if (days < 0 || !Number.isInteger(days)) throw new Error('Working days must be a whole number ≥ 0.');
  const local = toLocal(start, cal.timeZone);
  let date = local.date;
  let counted = 0;
  for (let i = 0; counted < days; i += 1) {
    if (i >= MAX_SCAN_DAYS) throw new Error('Calendar has no opening within the scan limit.');
    date = addDays(date, 1);
    if (openWindow(cal, date)) counted += 1;
  }
  const w = openWindow(cal, date);
  if (!w) return nextOpening(cal, start); // day 0 closed: start was not an open moment
  let target = Math.max(w.open, Math.min(cal.readyMinutes ?? w.close, w.close));
  if (date === local.date) target = Math.max(target, local.minutes);
  return fromLocal(date, target, cal.timeZone);
}
