import type { Clock } from './clock.js';
import { dtBusinessDate } from './business-day.js';
import { toHourCycle } from './settings.js';
import type { CivilDate, DateFormat, HourCycle, IsoWeekday, ZoneId } from './types.js';

/**
 * The `clock` block every screen endpoint returns (D21, D34). The screen never guesses the zone
 * or "today" from the browser. A missing zone gives `zone: null` and `businessDate: null`
 * (fail closed: no clock is shown).
 */
export interface ClockBlock {
  zone: ZoneId | null;
  businessDate: CivilDate | null;
  /** RFC 3339 UTC, millisecond precision, `Z`. */
  serverNow: string;
  hourCycle: HourCycle;
  /** ISO weekday, Mon = 1 … Sun = 7. */
  weekStart: IsoWeekday;
  /** Runtime tz database version (Node `process.versions.tz`), null when unknown. */
  tzdbVersion: string | null;
  dateFormat: DateFormat;
}

/** The public (anon) subset: display preferences only, never other tenant settings (§7.16). */
export type PublicClockBlock = Pick<ClockBlock, 'zone' | 'serverNow' | 'hourCycle' | 'dateFormat'>;

/** The runtime tz database version, or null in a browser / unknown runtime. */
export function tzdbVersion(): string | null {
  const proc = (globalThis as { process?: { versions?: Record<string, string | undefined> } }).process;
  return proc?.versions?.tz ?? null;
}

export interface BuildClockBlockInput {
  clock: Clock;
  zone: string | null;
  /** Resolved cut-over (D6/D33); `00:00` when the caller already resolved the platform value to midnight. */
  cutover: string;
  hourCycle: HourCycle | string;
  weekStart: IsoWeekday;
  dateFormat: DateFormat;
  tzdbVersion?: string | null;
}

/** Builds the block from resolved settings (one place maps `24h`/`H23` to `h23`). */
export function buildClockBlock(input: BuildClockBlockInput): ClockBlock {
  const now = input.clock.now();
  return {
    zone: (input.zone ?? null) as ZoneId | null,
    businessDate: input.zone ? dtBusinessDate(now, input.zone, input.cutover) : null,
    serverNow: now.toISOString(),
    hourCycle: toHourCycle(input.hourCycle),
    weekStart: input.weekStart,
    tzdbVersion: input.tzdbVersion === undefined ? tzdbVersion() : input.tzdbVersion,
    dateFormat: input.dateFormat,
  };
}

/** The public subset of a block. */
export function toPublicClockBlock(block: ClockBlock): PublicClockBlock {
  return { zone: block.zone, serverNow: block.serverNow, hourCycle: block.hourCycle, dateFormat: block.dateFormat };
}
