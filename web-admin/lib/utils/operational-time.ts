import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';

/**
 * Closed operation codes shared with the future SQL door `fn_ops_zone`.
 * The caller names which branch owns the action. Delivery, invoice, and ledger
 * rows do not store a timezone; they store `branch_id`, and that branch is the scope.
 */
export const OPERATIONAL_ZONE_OPERATIONS = [
  'accept_order',
  'ready_by',
  'pos_session',
  'delivery',
  'invoice',
  'ledger',
] as const;

export type OperationalZoneOperation = (typeof OPERATIONAL_ZONE_OPERATIONS)[number];

const INSTANT_WITH_OFFSET = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?)(Z|[+-]\d{2}:\d{2})$/;

export function isOperationalZoneOperation(value: string): value is OperationalZoneOperation {
  return (OPERATIONAL_ZONE_OPERATIONS as readonly string[]).includes(value);
}

/**
 * Branch zone when it is a valid active catalog code, otherwise the organization
 * zone on the same terms. A client-supplied zone is not an argument.
 */
export function selectOperationalZone(
  branchZone: string | null | undefined,
  organizationZone: string | null | undefined,
  activeCatalogCodes: ReadonlySet<string>,
): string | null {
  if (isActiveZone(branchZone, activeCatalogCodes)) return branchZone;
  if (isActiveZone(organizationZone, activeCatalogCodes)) return organizationZone;
  return null;
}

function isActiveZone(zone: string | null | undefined, activeCatalogCodes: ReadonlySet<string>): zone is string {
  return Boolean(zone) && activeCatalogCodes.has(zone as string) && isValidTimeZone(zone);
}

/**
 * Accepts an RFC 3339 instant with `Z` or a numeric offset.
 * A date-only string and a wall time with no offset are rejected.
 */
export function parseInstant(value: string): Date {
  const match = INSTANT_WITH_OFFSET.exec(value);
  if (!match) {
    throw new RangeError('INSTANT_OFFSET_REQUIRED');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError('INSTANT_OFFSET_REQUIRED');
  }
  return parsed;
}

/**
 * Formats an instant in the given IANA zone. The locale chooses digits and month names.
 * The zone chooses the clock and the calendar day.
 */
export function formatInstant(value: Date, zone: string, locale: string): string {
  if (!isValidTimeZone(zone)) {
    throw new RangeError('INVALID_TIME_ZONE');
  }
  return formatInZone(value, zone, locale);
}

/**
 * The same clock as {@link formatInstant}. A missing instant or zone is empty,
 * so a screen does not fall back to the machine zone.
 */
export function formatInstantOrEmpty(
  value: Date | string | null | undefined,
  zone: string | null | undefined,
  locale: string,
): string {
  if (!value || !zone || !isValidTimeZone(zone)) return '';
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  return formatInZone(instant, zone, locale);
}

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_INSTANT = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * A stored clock for the screen. A civil date stays the calendar string.
 * A string without an offset stays empty, because a naive timestamp is not a proven instant.
 * A real instant uses the operations zone. A missing zone stays empty.
 */
export function formatStoredClock(
  value: Date | string | null | undefined,
  zone: string | null | undefined,
  locale: string,
): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    if (CIVIL_DATE.test(value)) return value;
    if (!OFFSET_INSTANT.test(value)) return '';
  }
  return formatInstantOrEmpty(value, zone, locale);
}

/** Moves a civil date by a number of calendar days. The shift does not use the machine zone. */
export function shiftCivilDate(civilDate: string, days: number): string {
  if (!CIVIL_DATE.test(civilDate) || !Number.isInteger(days)) {
    throw new RangeError('CIVIL_DATE_REQUIRED');
  }
  const [year, month, day] = civilDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Inclusive UTC bounds of a civil range in a zone. The end is the last millisecond
 * of the end date so existing `lte` filters keep the whole civil day.
 */
export function civilRangeQuery(
  startCivil: string,
  endCivil: string,
  zone: string | null | undefined,
): { start: string; end: string } | null {
  if (!zone || !isValidTimeZone(zone)) return null;
  try {
    const start = civilDayBounds(startCivil, zone).start;
    const endExclusive = civilDayBounds(endCivil, zone).end;
    return { start: start.toISOString(), end: new Date(endExclusive.getTime() - 1).toISOString() };
  } catch {
    return null;
  }
}

/** Civil calendar day of an instant in a zone. A date-only string stays that day. */
export function civilDateInZone(
  value: Date | string | null | undefined,
  zone: string | null | undefined,
): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && CIVIL_DATE.test(value)) return value;
  if (typeof value === 'string' && !OFFSET_INSTANT.test(value)) return '';
  if (!zone || !isValidTimeZone(zone)) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return businessDateForTimezone(zone, date);
}

/**
 * Prisma `@db.Date` arrives as UTC midnight. The civil day is that UTC calendar date.
 * Do not format it in the machine zone.
 */
export function prismaDateToCivil(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Civil year of an instant in a zone. The year is the first four characters of that civil day. */
export function civilYearInZone(value: Date, zone: string): number {
  const day = civilDateInZone(value, zone);
  if (!CIVIL_DATE.test(day)) {
    throw new RangeError('CIVIL_DATE_REQUIRED');
  }
  return Number(day.slice(0, 4));
}

/** Locale label for a civil date. The calendar day does not move with the machine zone. */
export function formatCivilDate(civilDate: string, locale: string): string {
  if (!CIVIL_DATE.test(civilDate)) return '';
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatInZone(value: Date, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(value);
}

/**
 * Half-open UTC range of one civil day in a zone: start inclusive, end exclusive.
 */
export function civilDayBounds(civilDate: string, zone: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civilDate)) {
    throw new RangeError('CIVIL_DATE_REQUIRED');
  }
  if (!isValidTimeZone(zone)) {
    throw new RangeError('INVALID_TIME_ZONE');
  }
  return {
    start: utcFromCivilDateTime(`${civilDate}T00:00:00`, zone),
    end: utcFromCivilDateTime(`${nextCivilDate(civilDate)}T00:00:00`, zone),
  };
}

function nextCivilDate(civilDate: string): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  return cursor.toISOString().slice(0, 10);
}

/** Instant for a civil date and HH:mm in a zone. A gap uses the corrected offset. */
export function instantFromCivilDateTime(civilDate: string, time: string, zone: string): Date {
  if (!CIVIL_DATE.test(civilDate) || !/^\d{2}:\d{2}$/.test(time) || !isValidTimeZone(zone)) {
    throw new RangeError('CIVIL_DATE_TIME_REQUIRED');
  }
  return utcFromCivilDateTime(`${civilDate}T${time}:00`, zone);
}

/** HH:mm of an instant in a zone. */
export function civilTimeInZone(value: Date | string, zone: string | null | undefined): string {
  if (!zone || !isValidTimeZone(zone)) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const hour = parts.find((item) => item.type === 'hour')?.value ?? '00';
  const minute = parts.find((item) => item.type === 'minute')?.value ?? '00';
  return `${hour === '24' ? '00' : hour}:${minute}`;
}

/**
 * Calendar day of a picker date built with local year, month, and day.
 * Those fields are the day the person selected, not an instant.
 */
export function civilDateFromPickerDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function utcFromCivilDateTime(civilDateTime: string, zone: string): Date {
  const [datePart, timePart] = civilDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const corrected = new Date(guess.getTime() - zoneOffsetMs(guess, zone));
  return new Date(guess.getTime() - zoneOffsetMs(corrected, zone));
}

function zoneOffsetMs(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  let year = part('year');
  let month = part('month');
  let day = part('day');
  let hour = part('hour');
  if (hour === 24) {
    hour = 0;
    const next = new Date(Date.UTC(year, month - 1, day));
    next.setUTCDate(next.getUTCDate() + 1);
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  return Date.UTC(year, month - 1, day, hour, part('minute'), part('second')) - instant.getTime();
}
