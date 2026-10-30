/**
 * Ready-by time per line and per order (PLAN.md §5.4, PF-13, owner Q1).
 *
 * Why: today Create stores the browser's estimate, and the server estimate
 * reads only the service category, then halves the express category hours a
 * second time (`order-service.ts` estimateReadyBy). Here one pure resolver
 * serves both ready-by services:
 * - standard speed: product `turnaround_hh` → category `turnaround_hh` → default;
 * - another speed: the speed rule's `turnaround_hh_speed` → the category's
 *   hours for that speed → default. No second halving.
 * Each line adds its own preference minutes; order-level preference minutes
 * apply to every line. The order is ready when its slowest line is, unless
 * the cashier entered a time (kept as today).
 *
 * NULL means "not configured" and falls through; 0 is a real value
 * (ready at once, e.g. retail items).
 */
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
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
  /** `org_product_data_mst.turnaround_hh` (standard speed). */
  productHours: MoneyInput | null;
  /** `sys_service_category_cd` hours for this line's speed (`turnaround_hh` or `turnaround_hh_express`). */
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
}

/** One line's ready-by. */
export interface ReadyByLineResult {
  lineId: string;
  hours: number;
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
  const chain: [number | null, TurnaroundSource][] = standard
    ? [[hoursOf(line.productHours), TURNAROUND_SOURCES.PRODUCT], [hoursOf(line.categoryHours), TURNAROUND_SOURCES.CATEGORY]]
    : [[hoursOf(line.speedRuleHours), TURNAROUND_SOURCES.SPEED_RULE], [hoursOf(line.categoryHours), TURNAROUND_SOURCES.CATEGORY]];
  for (const [hours, source] of chain) if (hours != null) return { hours, source };
  return {
    hours: standard ? DEFAULT_TURNAROUND_HOURS.STANDARD : DEFAULT_TURNAROUND_HOURS.OTHER_SPEED,
    source: TURNAROUND_SOURCES.DEFAULT,
  };
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Ready-by time for every line and for the order.
 * @param input the start time, the lines' turnaround facts, order preference minutes and any cashier time
 * @returns per-line results and the order's ready-by
 * @throws Error on negative hours or minutes
 * @example
 * resolveReadyBy({ startAt, lines: [line], orderExtraMinutes: 0, orderOverride: null }).orderReadyBy;
 */
export function resolveReadyBy(input: ReadyByInput): ReadyByResult {
  if (input.orderExtraMinutes < 0) throw new Error('Order preference minutes cannot be negative.');
  const start = input.startAt.getTime();
  const lines = input.lines.map((line) => {
    if (line.extraMinutes < 0) throw new Error(`Line ${line.lineId}: preference minutes cannot be negative.`);
    if (line.recordedReadyByAt) {
      return {
        lineId: line.lineId, hours: 0, source: TURNAROUND_SOURCES.RECORDED, extraMinutes: 0, readyByAt: line.recordedReadyByAt,
      };
    }
    const { hours, source } = resolveTurnaround(line);
    const extraMinutes = line.extraMinutes + input.orderExtraMinutes;
    return {
      lineId: line.lineId, hours, source, extraMinutes,
      readyByAt: new Date(start + Math.round(hours * HOUR_MS) + extraMinutes * MINUTE_MS),
    };
  });

  if (input.orderOverride) return { lines, orderReadyBy: input.orderOverride, isOverride: true };
  const latest = lines.length > 0
    ? new Date(Math.max(...lines.map((l) => l.readyByAt.getTime())))
    : new Date(start + DEFAULT_TURNAROUND_HOURS.STANDARD * HOUR_MS + input.orderExtraMinutes * MINUTE_MS);
  return { lines, orderReadyBy: latest, isOverride: false };
}
