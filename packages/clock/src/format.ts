import { ClockError } from './errors.js';
import { requireZone, toEpochMs } from './internal.js';
import { buildIntlOptions, type ClockStyle, type NumberingSystem } from './intl-options.js';
import { parseCivilDate, parseLocalTime } from './parse.js';
import type { DateFormat, HourCycle } from './types.js';

export interface FormatOptions {
  style?: ClockStyle;
  hourCycle?: HourCycle;
  numberingSystem?: NumberingSystem;
}

const ARAB_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toDigits = (s: string, ns: NumberingSystem | undefined): string =>
  ns === 'arab' ? s.replace(/\d/g, (d) => ARAB_DIGITS[Number(d)]) : s;

/** An instant in a zone (the zone picks the wall clock; the locale picks words and order). */
export function formatInstant(instant: Date, zone: string, locale: string, opts: FormatOptions = {}): string {
  const ms = toEpochMs(instant);
  return new Intl.DateTimeFormat(locale, buildIntlOptions({ zone, ...opts })).format(new Date(ms));
}

/**
 * A civil date. With `dateFormat` (D34) the numeric tenant pattern is used; otherwise `Intl`
 * text (`style` `date` or `dateLong`). The date is never shifted by any zone.
 */
export function formatCivilDate(
  date: string,
  locale: string,
  opts: { dateFormat?: DateFormat; style?: 'date' | 'dateLong'; numberingSystem?: NumberingSystem } = {},
): string {
  const d = parseCivilDate(date);
  const [y, m, day] = d.split('-');
  if (opts.dateFormat) {
    const text =
      opts.dateFormat === 'YYYY-MM-DD' ? d : opts.dateFormat === 'DD/MM/YYYY' ? `${day}/${m}/${y}` : `${m}/${day}/${y}`;
    return toDigits(text, opts.numberingSystem);
  }
  const noonUtc = new Date(`${d}T12:00:00Z`);
  return new Intl.DateTimeFormat(
    locale,
    buildIntlOptions({ zone: 'UTC', style: opts.style ?? 'date', numberingSystem: opts.numberingSystem }),
  ).format(noonUtc);
}

/** A wall time of day (`HH:mm`) in the tenant hour cycle. No zone is involved. */
export function formatLocalTime(
  time: string,
  locale: string,
  opts: { hourCycle?: HourCycle; numberingSystem?: NumberingSystem } = {},
): string {
  const t = parseLocalTime(time);
  const at = new Date(`1970-01-01T${t.length === 5 ? `${t}:00` : t}Z`);
  return new Intl.DateTimeFormat(
    locale,
    buildIntlOptions({ zone: 'UTC', style: 'time', hourCycle: opts.hourCycle, numberingSystem: opts.numberingSystem }),
  ).format(at);
}

/** The short offset of a zone at an instant, e.g. `GMT+4` (uses the offset of the instant shown). */
export function zoneOffsetLabel(zone: string, instant: Date, locale = 'en', numberingSystem?: NumberingSystem): string {
  const id = requireZone(zone);
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: id,
    timeZoneName: 'shortOffset',
    calendar: 'gregory',
    numberingSystem: numberingSystem ?? 'latn',
  }).formatToParts(new Date(toEpochMs(instant)));
  const name = parts.find((p) => p.type === 'timeZoneName')?.value;
  if (!name) throw new ClockError('INVALID_TIME_ZONE', { zone });
  return name;
}

/** `Asia/Muscat (GMT+4)`: the IANA id plus the offset at that instant (§7.14). */
export function zoneLabel(zone: string, instant: Date, locale = 'en', numberingSystem?: NumberingSystem): string {
  return `${requireZone(zone)} (${zoneOffsetLabel(zone, instant, locale, numberingSystem)})`;
}
