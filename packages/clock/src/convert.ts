import { ClockError } from './errors.js';
import { civilOf, plainDateTime, requireZone, timeOf, zonedAt } from './internal.js';
import { parseCivilDate, parseLocalTime } from './parse.js';
import { temporal } from './temporal.js';
import type {
  CivilDate,
  Disambiguation,
  Instant,
  InstantRange,
  IsoWeekday,
  LocalDateTime,
  LocalParts,
  LocalTime,
} from './types.js';
import { DISAMBIGUATIONS } from './types.js';

/** Mirror of `fn_cmx_dt_local_parts(p_instant, p_zone)`. */
export function dtLocalParts(instant: Date, zone: string): LocalParts {
  const z = zonedAt(instant, zone);
  return {
    localDate: civilOf(z) as CivilDate,
    localTime: timeOf(z) as LocalTime,
    isoDow: z.dayOfWeek as IsoWeekday,
    hour: z.hour,
    minute: z.minute,
    utcOffsetMin: Math.round(z.offsetNanoseconds / 60_000_000_000),
  };
}

/** Mirror of `fn_cmx_dt_to_local(p_instant, p_zone)`: the wall date-time, `YYYY-MM-DDTHH:mm:ss`. */
export function dtToLocal(instant: Date, zone: string): LocalDateTime {
  const z = zonedAt(instant, zone);
  return `${civilOf(z)}T${timeOf(z)}` as LocalDateTime;
}

/** Whether a wall date-time is normal, inside a DST gap (does not exist) or an overlap (happens twice). */
export function localTimeKind(date: string, time: string, zone: string): 'normal' | 'gap' | 'overlap' {
  const id = requireZone(zone);
  const pdt = plainDateTime(parseCivilDate(date), parseLocalTime(time));
  const earlier = pdt.toZonedDateTime(id, { disambiguation: 'earlier' });
  const later = pdt.toZonedDateTime(id, { disambiguation: 'later' });
  if (!earlier.toPlainDateTime().equals(pdt)) return 'gap';
  return earlier.epochMilliseconds === later.epochMilliseconds ? 'normal' : 'overlap';
}

/**
 * Mirror of `fn_cmx_dt_instant_at_zone(p_zone, p_date, p_time, p_disambiguation)`.
 * `reject` (the default, for typed input) raises `LOCAL_TIME_NONEXISTENT` in a gap and
 * `LOCAL_TIME_AMBIGUOUS` in an overlap. `compatible` = later in a gap, earlier in an overlap.
 */
export function dtInstantAtZone(
  zone: string,
  date: string,
  time: string,
  disambiguation: Disambiguation = 'reject',
): Instant {
  if (!DISAMBIGUATIONS.includes(disambiguation)) {
    throw new ClockError('CLOCK_SETTING_INVALID', { disambiguation });
  }
  const id = requireZone(zone);
  let pdt;
  try {
    pdt = plainDateTime(parseCivilDate(date), parseLocalTime(time));
  } catch (error) {
    if (error instanceof ClockError) throw error;
    throw new ClockError('INVALID_CIVIL_DATE', { date, time });
  }
  if (disambiguation === 'reject') {
    const kind = localTimeKind(date, time, id);
    if (kind === 'gap') throw new ClockError('LOCAL_TIME_NONEXISTENT', { zone: id, date, time });
    if (kind === 'overlap') throw new ClockError('LOCAL_TIME_AMBIGUOUS', { zone: id, date, time });
  }
  const mode = disambiguation === 'reject' ? 'compatible' : disambiguation;
  return new Date(pdt.toZonedDateTime(id, { disambiguation: mode }).epochMilliseconds) as Instant;
}

/** Mirror of `fn_cmx_dt_at_local`: the shop's local date and time to an instant (zone already resolved). */
export function dtAtLocal(
  date: string,
  time: string,
  zone: string,
  disambiguation: Disambiguation = 'reject',
): Instant {
  return dtInstantAtZone(zone, date, time, disambiguation);
}

/** Start of a local day: the first valid instant (midnight, or the end of a midnight gap). */
export function dtStartOfDay(date: string, zone: string): Instant {
  const id = requireZone(zone);
  const pd = temporal().PlainDate.from(parseCivilDate(date), { overflow: 'reject' });
  return new Date(pd.toZonedDateTime({ timeZone: id }).epochMilliseconds) as Instant;
}

/**
 * Mirror of `fn_cmx_dt_day_bounds`: half-open UTC range `[start of from, start of toExclusive)`.
 * 23h/25h days and midnight-gap zones are handled by {@link dtStartOfDay}.
 */
export function dtDayBounds(from: string, toExclusive: string, zone: string): InstantRange {
  if (parseCivilDate(toExclusive) < parseCivilDate(from)) {
    throw new ClockError('INVALID_CIVIL_DATE', { from, toExclusive, reason: 'toExclusive before from' });
  }
  return { start: dtStartOfDay(from, zone), end: dtStartOfDay(toExclusive, zone) };
}
