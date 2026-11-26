import { requireZone } from './internal.js';
import type { HourCycle } from './types.js';

export type NumberingSystem = 'latn' | 'arab';
export type ClockStyle = 'date' | 'time' | 'datetime' | 'dateLong' | 'datetimeLong';

export interface IntlOptionsInput {
  zone: string;
  hourCycle?: HourCycle;
  /** D12: Latin digits by default. */
  numberingSystem?: NumberingSystem;
  style?: ClockStyle;
}

/**
 * `Intl.DateTimeFormat` options that always carry the zone, the Gregorian calendar (Saudi Arabic
 * would otherwise show Hijri dates) and the digit system (D12, D13). Nothing formats a time
 * without going through here.
 */
export function buildIntlOptions(input: IntlOptionsInput): Intl.DateTimeFormatOptions {
  const base: Intl.DateTimeFormatOptions = {
    timeZone: requireZone(input.zone),
    calendar: 'gregory',
    numberingSystem: input.numberingSystem ?? 'latn',
  };
  const style = input.style ?? 'datetime';
  const date: Intl.DateTimeFormatOptions =
    style === 'dateLong' || style === 'datetimeLong'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
  const time: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...(input.hourCycle ? { hourCycle: input.hourCycle } : {}),
  };
  if (style === 'date' || style === 'dateLong') return { ...base, ...date };
  if (style === 'time') return { ...base, ...time };
  return { ...base, ...date, ...time };
}
