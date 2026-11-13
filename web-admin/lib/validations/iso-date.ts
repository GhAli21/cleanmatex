/**
 * A calendar date as `YYYY-MM-DD` that really exists (Service Speeds review B2).
 *
 * Why: a shape-only regex let `2027-02-30` through, and `new Date('2027-02-30')`
 * rolls it over to 2 March, so a holiday or rule was saved on the wrong day
 * (and `2026-13-45` became an Invalid Date → 500). The year is bounded to the
 * range the screens list (2000–2100).
 */
import { z } from 'zod';

/** First year a date field accepts. */
export const ISO_DATE_MIN_YEAR = 2000;
/** Last year a date field accepts. */
export const ISO_DATE_MAX_YEAR = 2100;

/**
 * True when the text is a real calendar day inside the supported years.
 * @param value `YYYY-MM-DD`
 * @returns whether it parses back to the same date
 */
export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < ISO_DATE_MIN_YEAR || year > ISO_DATE_MAX_YEAR) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Zod: a real `YYYY-MM-DD` date. */
export const isoDateSchema = z.string().refine(isRealIsoDate, 'YYYY-MM-DD');
