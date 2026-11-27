/**
 * S6 (MASTER_PLAN_v2 §6.3, §7.6): the one place API routes, server actions and validation
 * schemas take time input from. Route schemas import these instead of local regexes,
 * `z.string().datetime()` or `z.coerce.date()`.
 *
 * - Instants need `Z` or an offset (`INSTANT_OFFSET_REQUIRED`): a wall time without an offset
 *   would be read in the server's zone.
 * - Civil dates are `YYYY-MM-DD` days that exist (`INVALID_CIVIL_DATE`).
 */
import { z } from 'zod';
import { parseCivilDate, parseInstant } from '@cmx/clock';
import { zCivilDate, zInstant } from '@cmx/clock/zod';

export {
  zInstant,
  zCivilDate,
  zLocalTime,
  zZoneId,
  zZonedInput,
  zDisambiguation,
  zCivilRange,
  type ZonedInput,
} from '@cmx/clock/zod';

/** True for a `YYYY-MM-DD` day that exists. */
export function isCivilDateText(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    parseCivilDate(value);
    return true;
  } catch {
    return false;
  }
}

/** True for an RFC 3339 instant with `Z` or an offset. */
export function isInstantText(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    parseInstant(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The civil day at the start of a filter value: `2026-03-01` or `2026-03-01T…` gives
 * `2026-03-01`; anything else gives null. Replaces the prefix regexes of the report filters.
 */
export function leadingCivilDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return isCivilDateText(day) ? day : null;
}

/** Prisma `@db.Date` value of a civil day (UTC midnight, the storage convention). */
function civilToStorageDate(day: string): Date {
  return parseInstant(`${parseCivilDate(day)}T00:00:00.000Z`);
}

/** An instant with an offset, as a `Date`. A `Date` (server action argument) passes through. */
export const zInstantDate = z.union([z.date(), zInstant.transform((value) => parseInstant(value) as Date)]);

/**
 * A filter bound that may be a civil day or an instant (lists and archives). A civil day becomes
 * UTC midnight (what `z.coerce.date()` did for `YYYY-MM-DD`); an instant needs an offset; a wall
 * time without an offset is refused instead of being read in the server's zone.
 */
export const zCivilOrInstantDate = z.union([
  z.date(),
  zCivilDate.transform((value) => civilToStorageDate(value)),
  zInstant.transform((value) => parseInstant(value) as Date),
]);

/** A civil day stored as `@db.Date` (UTC midnight). */
export const zCivilStorageDate = z.union([z.date(), zCivilDate.transform((value) => civilToStorageDate(value))]);
