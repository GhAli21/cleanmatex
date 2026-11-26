import { ClockError } from './errors.js';
import { temporal } from './temporal.js';
import type { CivilDate, Instant, LocalTime } from './types.js';

export { canonicalZoneId, isCanonicalZoneId, isValidZoneId, parseZoneId } from './zones.js';

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/**
 * RFC 3339 instant with `Z` or a numeric offset. A date-only string, a wall time without an
 * offset, and an impossible calendar day are rejected with `INSTANT_OFFSET_REQUIRED`.
 */
export function parseInstant(value: string): Instant {
  if (typeof value !== 'string' || !INSTANT.test(value)) {
    throw new ClockError('INSTANT_OFFSET_REQUIRED', { value });
  }
  try {
    const instant = temporal().Instant.from(value);
    return new Date(instant.epochMilliseconds) as Instant;
  } catch {
    throw new ClockError('INSTANT_OFFSET_REQUIRED', { value });
  }
}

/** `YYYY-MM-DD` that exists on the ISO calendar, or `INVALID_CIVIL_DATE`. */
export function parseCivilDate(value: string): CivilDate {
  if (typeof value !== 'string' || !CIVIL_DATE.test(value)) {
    throw new ClockError('INVALID_CIVIL_DATE', { value });
  }
  try {
    temporal().PlainDate.from(value, { overflow: 'reject' });
  } catch {
    throw new ClockError('INVALID_CIVIL_DATE', { value });
  }
  return value as CivilDate;
}

/** `HH:mm` or `HH:mm:ss` (24-hour), or `INVALID_LOCAL_TIME`. `24:00` is not a time of day. */
export function parseLocalTime(value: string): LocalTime {
  if (typeof value !== 'string' || !LOCAL_TIME.test(value)) {
    throw new ClockError('INVALID_LOCAL_TIME', { value });
  }
  return value as LocalTime;
}

/** True for a valid civil date string. */
export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== 'string') return false;
  try {
    parseCivilDate(value);
    return true;
  } catch {
    return false;
  }
}

/** True for a valid local time string. */
export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && LOCAL_TIME.test(value);
}

/** Seconds since local midnight for a {@link LocalTime}. */
export function localTimeToSeconds(value: string): number {
  const time = parseLocalTime(value);
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + (s ?? 0);
}
