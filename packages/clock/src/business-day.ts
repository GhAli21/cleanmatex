import { ClockError } from './errors.js';
import { civilOf, zonedAt } from './internal.js';
import { dtInstantAtZone } from './convert.js';
import { parseCivilDate, parseLocalTime } from './parse.js';
import type { CivilDate, InstantRange, LocalTime } from './types.js';

/** A cut-over must be `00:00`–`11:59` (D6). */
export function assertCutover(cutover: string): LocalTime {
  let time: LocalTime;
  try {
    time = parseLocalTime(cutover);
  } catch {
    throw new ClockError('CLOCK_SETTING_INVALID', { cutover });
  }
  if (time >= '12:00') throw new ClockError('CLOCK_SETTING_INVALID', { cutover });
  return time;
}

/**
 * Mirror of `fn_cmx_dt_business_date`: `((p_at AT TIME ZONE zone) - cutover)::date`.
 * Computed on the local wall clock, so a DST day needs no special case.
 */
export function dtBusinessDate(instant: Date, zone: string, cutover: string = '00:00'): CivilDate {
  const cut = assertCutover(cutover);
  const [h, m, s] = cut.split(':').map(Number);
  const wall = zonedAt(instant, zone).toPlainDateTime();
  return civilOf(wall.subtract({ hours: h, minutes: m, seconds: s ?? 0 })) as CivilDate;
}

/**
 * Mirror of `fn_cmx_dt_business_day_bounds`: `[ (from, cutover), (toExclusive, cutover) )`, each
 * resolved with `compatible` (a cut-over inside a DST gap moves to the later side).
 */
export function dtBusinessDayBounds(
  from: string,
  toExclusive: string,
  zone: string,
  cutover: string = '00:00',
): InstantRange {
  const cut = assertCutover(cutover);
  if (parseCivilDate(toExclusive) < parseCivilDate(from)) {
    throw new ClockError('INVALID_CIVIL_DATE', { from, toExclusive, reason: 'toExclusive before from' });
  }
  return {
    start: dtInstantAtZone(zone, from, cut, 'compatible'),
    end: dtInstantAtZone(zone, toExclusive, cut, 'compatible'),
  };
}
