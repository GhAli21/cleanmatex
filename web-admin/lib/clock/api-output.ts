/**
 * Output side of the API time contract (§7.5, §7.15).
 *
 * - `toApiInstant`: every instant leaves the API as ISO 8601 UTC with milliseconds (`...Z`).
 *   Never a device-zone string, never `Date#toString()`.
 * - Export helpers: CSV/XLSX/PDF rows carry the instant in `Z` plus, when a zone is known,
 *   the local text in that zone and a "Time Zone" column/header naming it (D20: exports name the zone).
 *   Civil dates (`YYYY-MM-DD`) pass through unchanged; they have no zone.
 */
import { formatInstant, parseInstant } from '@cmx/clock';

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/** ISO `Z` text for an instant (Date, `Z`/offset string). Null for empty or invalid input; offset-less text is invalid. */
export function toApiInstant(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  try {
    const at = typeof value === 'string' ? parseInstant(value) : value;
    return Number.isNaN(at.getTime()) ? null : at.toISOString();
  } catch {
    return null;
  }
}

/** Copy of `row` with the listed instant fields rewritten by `toApiInstant` (Date or offset text in, `Z` out). */
export function withApiInstants<T extends Record<string, unknown>>(row: T, keys: readonly (keyof T)[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) {
    const v = row[k];
    if (v instanceof Date || typeof v === 'string') out[k as string] = toApiInstant(v);
  }
  return out as T;
}

/**
 * Local text of an instant for an export cell, in `zone`. Fixed `en` + Latin digits + 24h so
 * spreadsheets parse it. Empty when there is no zone (fail closed: never the server zone).
 */
export function exportLocalText(value: Date | string | null | undefined, zone: string | null | undefined): string {
  const iso = toApiInstant(value);
  if (!iso || !zone) return '';
  try {
    return formatInstant(new Date(iso), zone, 'en', { style: 'datetime', hourCycle: 'h23', numberingSystem: 'latn' });
  } catch {
    return '';
  }
}

/** Export cell for a stored value that is a civil date (kept as is) or an instant (`Z`). */
export function exportDateValue(value: Date | string | null | undefined): string {
  if (typeof value === 'string' && CIVIL.test(value)) return value;
  return toApiInstant(value) ?? '';
}

/** Header line naming the zone of local columns, e.g. `# Time Zone: Asia/Muscat`. */
export function exportZoneHeader(zone: string | null | undefined, label = 'Time Zone'): string {
  return `# ${label}: ${zone ?? 'not configured'}`;
}

/** File-name day: civil `YYYY-MM-DD` when known, else `fallback` (never the device or server day). */
export function exportFileDay(civilToday: string | null | undefined, fallback = 'export'): string {
  return civilToday && CIVIL.test(civilToday) ? civilToday : fallback;
}
