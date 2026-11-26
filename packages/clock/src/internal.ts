import { ClockError } from './errors.js';
import { temporal, type TemporalApi } from './temporal.js';
import { canonicalZoneId, hasIanaZoneShape, UTC_ZONE_ALIASES } from './zones.js';

type ZonedDateTime = InstanceType<TemporalApi['ZonedDateTime']>;
type PlainDateTime = InstanceType<TemporalApi['PlainDateTime']>;

const pad2 = (n: number): string => String(n).padStart(2, '0');
const pad4 = (n: number): string => (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(4, '0');

/** Zone to use for arithmetic. Missing → `TIMEZONE_NOT_CONFIGURED`; malformed → `INVALID_TIME_ZONE`. */
export function requireZone(zone: string | null | undefined): string {
  if (!zone) throw new ClockError('TIMEZONE_NOT_CONFIGURED');
  const utc = zone === 'UTC' || UTC_ZONE_ALIASES.includes(zone);
  if (!utc && !hasIanaZoneShape(zone)) throw new ClockError('INVALID_TIME_ZONE', { zone });
  const id = canonicalZoneId(zone);
  if (!id) throw new ClockError('INVALID_TIME_ZONE', { zone });
  return id;
}

export function toEpochMs(instant: Date): number {
  const ms = instant instanceof Date ? instant.getTime() : Number.NaN;
  if (Number.isNaN(ms)) throw new ClockError('INSTANT_OFFSET_REQUIRED', { value: String(instant) });
  return ms;
}

export function zonedAt(instant: Date, zone: string): ZonedDateTime {
  const id = requireZone(zone);
  try {
    return temporal().Instant.fromEpochMilliseconds(toEpochMs(instant)).toZonedDateTimeISO(id);
  } catch (error) {
    if (error instanceof ClockError) throw error;
    throw new ClockError('INVALID_TIME_ZONE', { zone });
  }
}

export function civilOf(p: { year: number; month: number; day: number }): string {
  return `${pad4(p.year)}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function timeOf(p: { hour: number; minute: number; second: number }): string {
  return `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

export function plainDateTime(date: string, time: string): PlainDateTime {
  const t = time.length === 5 ? `${time}:00` : time;
  return temporal().PlainDateTime.from(`${date}T${t}`, { overflow: 'reject' });
}
