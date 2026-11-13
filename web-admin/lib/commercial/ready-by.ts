/**
 * Ready-by time per line and per order (PLAN.md §5.4, PF-13, owner Q1).
 *
 * Why: today Create stores the browser's estimate, and the server estimate
 * reads only the service category, then halves the express category hours a
 * second time (`order-service.ts` estimateReadyBy). Here one pure resolver
 * serves both ready-by services:
 * - standard speed: product `turnaround_hh` → category `turnaround_hh` → default;
 * - another speed: the speed rule's `turnaround_hh_speed` → the category's
 *   hours → default (12 h). A faster speed is never promised slower than
 *   STANDARD (capped at its hours); a speed ranked below STANDARD defaults to
 *   STANDARD's hours. No second halving.
 * Each line adds its own preference minutes; order-level preference minutes
 * apply to every line. The order is ready when its slowest line is, unless
 * the cashier entered a time (kept as today).
 *
 * NULL means "not configured" and falls through; 0 is a real value
 * (ready at once, e.g. retail items).
 */
import { SERVICE_SPEEDS, TURNAROUND_UNITS, type TurnaroundUnit } from '@/lib/constants/commercial';
import {
  CalendarScanLimitError, addWorkingDays, addWorkingMinutes, countingStart, parseTimeOfDay, type ResolvedCalendar,
} from './calendar';
import { toMoney, type MoneyInput } from './money';

/** Hours used when nothing is configured: today's estimateReadyBy defaults. */
export const DEFAULT_TURNAROUND_HOURS = {
  STANDARD: 24,
  OTHER_SPEED: 12,
} as const;

/** Where a line's turnaround came from, for the cart note and audit. */
export const TURNAROUND_SOURCES = {
  SPEED_RULE: 'SPEED_RULE',
  PRODUCT: 'PRODUCT',
  CATEGORY: 'CATEGORY',
  DEFAULT: 'DEFAULT',
  /** Order Edit kept the line's stored ready-by (its speed did not change, L24). */
  RECORDED: 'RECORDED',
} as const;
/** Derived union of turnaround sources. */
export type TurnaroundSource = (typeof TURNAROUND_SOURCES)[keyof typeof TURNAROUND_SOURCES];

/** One line's turnaround facts, gathered by the loader. */
export interface ReadyByLineInput {
  lineId: string;
  serviceSpeed: string;
  /** `resolveSpeedPricing(...).turnaroundHours` (non-standard speeds only). */
  speedRuleHours: MoneyInput | null;
  /** `resolveSpeedPricing(...).turnaroundUnit`; WORKING_DAYS uses `speedRuleDays`. */
  speedRuleUnit?: TurnaroundUnit | null;
  /** `resolveSpeedPricing(...).turnaroundDays` (0 = same day). */
  speedRuleDays?: number | null;
  /** `resolveSpeedPricing(...).cutoffTime` (`HH:MM`); null = the calendar's cut-off. */
  speedRuleCutoffTime?: string | null;
  /**
   * The speed ranks below STANDARD (e.g. ECONOMY). With no configured hours it
   * defaults to STANDARD's, never to the faster non-standard default.
   */
  slowerThanStandard?: boolean;
  /** `org_product_data_mst.turnaround_hh`: the item's own hours (STANDARD, and the fallback of a speed whose rule sets none). */
  productHours: MoneyInput | null;
  /** `sys_service_category_cd.turnaround_hh`: the last configured hours at any speed. */
  categoryHours: MoneyInput | null;
  /** Σ `extra_turnaround_min` of this line's item and piece preferences. */
  extraMinutes: number;
  /**
   * Order Edit: the line's stored `ready_by_at`, kept while its speed is
   * unchanged, so a later catalog change never moves a promised time.
   */
  recordedReadyByAt?: Date | null;
}

/** The order's ready-by inputs. */
export interface ReadyByInput {
  /** When the clock starts: the order's received time. */
  startAt: Date;
  lines: readonly ReadyByLineInput[];
  /** Σ `extra_turnaround_min` of order-level preferences; added to every line. */
  orderExtraMinutes: number;
  /** A time the cashier entered; it wins for the order, lines keep their own. */
  orderOverride: Date | null;
  /**
   * The branch calendar (`resolveCalendar`). Null / absent = clock hours from
   * `startAt` (today's behaviour) and a CALENDAR_NOT_CONFIGURED note.
   */
  calendar?: ResolvedCalendar | null;
}

/** Facts the UI explains next to the ready-by time. */
export const READY_BY_NOTES = {
  /** No business hours / time zone: clock hours were used, ignoring closed days. */
  CALENDAR_NOT_CONFIGURED: 'CALENDAR_NOT_CONFIGURED',
  /** A line asks for more working time than the calendar offers in a year: that line used clock hours. */
  CALENDAR_UNRESOLVABLE: 'CALENDAR_UNRESOLVABLE',
} as const;
/** Derived union of ready-by notes. */
export type ReadyByNote = (typeof READY_BY_NOTES)[keyof typeof READY_BY_NOTES];

/** A line's turnaround: working hours or working days. */
export interface TurnaroundSpec {
  unit: TurnaroundUnit;
  /** HOURS: the hours. WORKING_DAYS: days × 24, the clock fallback without a calendar. */
  hours: number;
  /** WORKING_DAYS only. */
  days: number | null;
  source: TurnaroundSource;
}

/** One line's ready-by. */
export interface ReadyByLineResult {
  lineId: string;
  /** See `TurnaroundSpec.hours`. */
  hours: number;
  unit: TurnaroundUnit;
  days: number | null;
  source: TurnaroundSource;
  extraMinutes: number;
  readyByAt: Date;
}

/** Ready-by per line and for the order. */
export interface ReadyByResult {
  lines: ReadyByLineResult[];
  /** The latest line ready-by, or the cashier's time; `startAt` + default when there are no lines. */
  orderReadyBy: Date;
  isOverride: boolean;
  notes: ReadyByNote[];
}

const hoursOf = (value: MoneyInput | null): number | null => {
  if (value == null) return null;
  const hours = toMoney(value);
  if (hours.isNegative()) throw new Error(`Turnaround hours cannot be negative: ${hours.toString()}`);
  return hours.toNumber();
};

/**
 * Picks one line's turnaround hours and where they came from.
 * @param line the line's speed and configured hours
 * @returns hours and source
 */
export function resolveTurnaround(line: ReadyByLineInput): { hours: number; source: TurnaroundSource } {
  const standard = line.serviceSpeed === SERVICE_SPEEDS.STANDARD;
  const product: [number | null, TurnaroundSource] = [hoursOf(line.productHours), TURNAROUND_SOURCES.PRODUCT];
  const category: [number | null, TurnaroundSource] = [hoursOf(line.categoryHours), TURNAROUND_SOURCES.CATEGORY];
  const standardTurnaround = (): { hours: number; source: TurnaroundSource } => {
    for (const [hours, source] of [product, category]) if (hours != null) return { hours, source };
    return { hours: DEFAULT_TURNAROUND_HOURS.STANDARD, source: TURNAROUND_SOURCES.DEFAULT };
  };
  if (standard) return standardTurnaround();

  const rule = hoursOf(line.speedRuleHours);
  if (rule != null) return { hours: rule, source: TURNAROUND_SOURCES.SPEED_RULE };
  // A speed ranked below STANDARD with no hours is never promised faster than STANDARD.
  if (line.slowerThanStandard) return category[0] != null ? { hours: category[0], source: category[1] } : standardTurnaround();
  // A faster speed with no hours uses the category's hours, else the default, but never more than STANDARD would take.
  const fallback = category[0] != null
    ? { hours: category[0], source: category[1] }
    : { hours: DEFAULT_TURNAROUND_HOURS.OTHER_SPEED, source: TURNAROUND_SOURCES.DEFAULT };
  const standardFor = standardTurnaround();
  return fallback.hours > standardFor.hours ? standardFor : fallback;
}

/**
 * A line's turnaround with its unit: a WORKING_DAYS speed rule gives days,
 * everything else gives hours (`resolveTurnaround`).
 * @param line the line's speed and configured turnaround
 * @returns unit, hours, days and source
 */
export function resolveTurnaroundSpec(line: ReadyByLineInput): TurnaroundSpec {
  const days = line.speedRuleDays;
  if (line.serviceSpeed !== SERVICE_SPEEDS.STANDARD && line.speedRuleUnit === TURNAROUND_UNITS.WORKING_DAYS && days != null) {
    if (days < 0 || !Number.isInteger(days)) throw new Error(`Line ${line.lineId}: working days must be a whole number ≥ 0.`);
    return { unit: TURNAROUND_UNITS.WORKING_DAYS, hours: days * 24, days, source: TURNAROUND_SOURCES.SPEED_RULE };
  }
  return { ...resolveTurnaround(line), unit: TURNAROUND_UNITS.HOURS, days: null };
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const onCalendar = (cal: ResolvedCalendar, start: Date, line: ReadyByLineInput, spec: TurnaroundSpec, extraMinutes: number): Date => {
  // Ready at once (e.g. retail items): the calendar does not delay it.
  if (spec.unit === TURNAROUND_UNITS.HOURS && spec.hours === 0 && extraMinutes === 0) return start;
  const begin = countingStart(cal, start, line.speedRuleCutoffTime ? parseTimeOfDay(line.speedRuleCutoffTime) : null);
  const at = spec.unit === TURNAROUND_UNITS.WORKING_DAYS
    ? addWorkingDays(cal, begin, spec.days ?? 0)
    : addWorkingMinutes(cal, begin, Math.round(spec.hours * 60));
  return extraMinutes > 0 ? addWorkingMinutes(cal, at, extraMinutes) : at;
};

/**
 * Ready-by time for every line and for the order.
 *
 * With a calendar: counting starts at the drop-off, or at the next opening
 * when after the cut-off (the speed rule's, else the branch's) or closed;
 * HOURS add working minutes inside opening hours; WORKING_DAYS N is the Nth
 * working day at the ready time (capped at closing); holidays and short days
 * apply; preference minutes are working minutes. Without one: clock hours.
 * @param input the start time, the lines' turnaround facts, order preference minutes, any cashier time and the calendar
 * @returns per-line results, the order's ready-by and notes
 * @throws Error on negative hours, days or minutes
 * @example
 * resolveReadyBy({ startAt, lines: [line], orderExtraMinutes: 0, orderOverride: null }).orderReadyBy;
 */
export function resolveReadyBy(input: ReadyByInput): ReadyByResult {
  if (input.orderExtraMinutes < 0) throw new Error('Order preference minutes cannot be negative.');
  const start = input.startAt.getTime();
  const cal = input.calendar ?? null;
  const notes: ReadyByNote[] = cal ? [] : [READY_BY_NOTES.CALENDAR_NOT_CONFIGURED];
  const lines = input.lines.map((line): ReadyByLineResult => {
    if (line.extraMinutes < 0) throw new Error(`Line ${line.lineId}: preference minutes cannot be negative.`);
    if (line.recordedReadyByAt) {
      return {
        lineId: line.lineId, hours: 0, unit: TURNAROUND_UNITS.HOURS, days: null,
        source: TURNAROUND_SOURCES.RECORDED, extraMinutes: 0, readyByAt: line.recordedReadyByAt,
      };
    }
    const spec = resolveTurnaroundSpec(line);
    const extraMinutes = line.extraMinutes + input.orderExtraMinutes;
    const clockHours = () => new Date(start + Math.round(spec.hours * HOUR_MS) + extraMinutes * MINUTE_MS);
    let readyByAt: Date;
    if (!cal) readyByAt = clockHours();
    else {
      try {
        readyByAt = onCalendar(cal, input.startAt, line, spec, extraMinutes);
      } catch (error) {
        // An unreachable promise must not block the order: this line falls back to clock hours, flagged.
        if (!(error instanceof CalendarScanLimitError)) throw error;
        readyByAt = clockHours();
        if (!notes.includes(READY_BY_NOTES.CALENDAR_UNRESOLVABLE)) notes.push(READY_BY_NOTES.CALENDAR_UNRESOLVABLE);
      }
    }
    return { lineId: line.lineId, hours: spec.hours, unit: spec.unit, days: spec.days, source: spec.source, extraMinutes, readyByAt };
  });

  if (input.orderOverride) return { lines, orderReadyBy: input.orderOverride, isOverride: true, notes };
  const latest = lines.length > 0
    ? new Date(Math.max(...lines.map((l) => l.readyByAt.getTime())))
    : new Date(start + DEFAULT_TURNAROUND_HOURS.STANDARD * HOUR_MS + input.orderExtraMinutes * MINUTE_MS);
  return { lines, orderReadyBy: latest, isOverride: false, notes };
}
