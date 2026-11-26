/**
 * Zod primitives for the five kinds of time (`@cmx/clock/zod`). Kept in a separate entry so
 * consumers without Zod (cmx-api) do not load it.
 */
import { z } from 'zod';
import { isClockError } from './errors.js';
import { parseCivilDate, parseInstant, parseLocalTime } from './parse.js';
import { DATE_FORMATS, DISAMBIGUATIONS } from './types.js';
import { isValidZoneId } from './zones.js';

const issue = (error: unknown, fallback: string): string => (isClockError(error) ? error.code : fallback);

function refineWith(parse: (v: string) => unknown, code: string) {
  return z.string().superRefine((value, ctx) => {
    try {
      parse(value);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: issue(error, code) });
    }
  });
}

/** RFC 3339 instant with `Z` or an offset (`INSTANT_OFFSET_REQUIRED`). Output stays the string. */
export const zInstant = refineWith(parseInstant, 'INSTANT_OFFSET_REQUIRED');
/** `YYYY-MM-DD` that exists (`INVALID_CIVIL_DATE`). */
export const zCivilDate = refineWith(parseCivilDate, 'INVALID_CIVIL_DATE');
/** `HH:mm` or `HH:mm:ss` (`INVALID_LOCAL_TIME`). */
export const zLocalTime = refineWith(parseLocalTime, 'INVALID_LOCAL_TIME');
/** IANA zone id by shape and runtime (`INVALID_TIME_ZONE`). Catalog membership is checked server-side. */
export const zZoneId = z.string().refine((v) => isValidZoneId(v), { message: 'INVALID_TIME_ZONE' });
export const zDisambiguation = z.enum(DISAMBIGUATIONS as unknown as ['compatible', 'earlier', 'later', 'reject']);
export const zHourCycle = z.enum(['h12', 'h23']);
export const zIsoWeekday = z.number().int().min(1).max(7);
export const zDateFormat = z.enum(DATE_FORMATS as unknown as ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']);

/** A zoned appointment input (§1.1). `zone` is an echo only (D9: a mismatch is `409 ZONE_MISMATCH`). */
export const zZonedInput = z.object({
  date: zCivilDate,
  time: zLocalTime,
  disambiguation: zDisambiguation.optional(),
  zone: zZoneId.optional(),
});

/** Half-open civil range `[from, toExclusive)`. */
export const zCivilRange = z
  .object({ from: zCivilDate, toExclusive: zCivilDate })
  .refine((r) => r.from <= r.toExclusive, { message: 'INVALID_CIVIL_DATE', path: ['toExclusive'] });

/** The `clock` block (D21, D34). */
export const zClockBlock = z.object({
  zone: zZoneId.nullable(),
  businessDate: zCivilDate.nullable(),
  serverNow: zInstant,
  hourCycle: zHourCycle,
  weekStart: zIsoWeekday,
  tzdbVersion: z.string().nullable(),
  dateFormat: zDateFormat,
});

export type ZonedInput = z.infer<typeof zZonedInput>;
export type CivilRange = z.infer<typeof zCivilRange>;
