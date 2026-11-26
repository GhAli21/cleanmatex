import { ClockError } from './errors.js';
import type { ZoneId } from './types.js';

/**
 * Zone-id rules (D16, D28, D32).
 * - IANA names only: no raw offsets, no abbreviations (`GST`, `EST`), no `Etc/GMT±N`,
 *   no `posix/` or `right/` prefixes, no single-word links (`Japan`, `GB`).
 * - `UTC` is the one canonical single-word id; the UTC family normalizes to it.
 * - Canonical = ECMA-402 primary identifier (every `zone.tab` name, every `zone1970.tab` name,
 *   and `UTC`). Country zones such as `Asia/Muscat`, `Asia/Kuwait`, `Asia/Bahrain` stay
 *   canonical; they are never merged into another country's zone. Only `backward` links whose
 *   name is not in `zone.tab` are aliases (`Asia/Calcutta` → `Asia/Kolkata`).
 * - The runtime truth is the `sys_timezone_cd` catalog (D28). This package receives it as a
 *   snapshot ({@link createZoneCatalog}); without one only the shape and runtime checks apply.
 */

/** Names that mean UTC and normalize to `UTC` (D32). */
export const UTC_ZONE_ALIASES: readonly string[] = [
  'Etc/UTC',
  'Etc/UCT',
  'Etc/Universal',
  'Etc/Zulu',
  'Etc/GMT',
  'Etc/GMT0',
  'Etc/GMT+0',
  'Etc/GMT-0',
  'Etc/Greenwich',
  'GMT',
  'GMT0',
  'GMT+0',
  'GMT-0',
  'Greenwich',
  'UCT',
  'Universal',
  'Zulu',
];

const AREA_LOCATION = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/;
const FORBIDDEN_PREFIX = /^(?:posix|right|SystemV)\//;

/** One row of the `sys_timezone_cd` snapshot (columns from `0842`). */
export interface ZoneCatalogRow {
  /** `sys_timezone_cd.code` (equals `iana_name`). */
  code: string;
  isCanonical: boolean;
  /** Canonical target for an alias; null for a canonical row. */
  linkTarget?: string | null;
  isActive: boolean;
  countryCodes?: readonly string[] | null;
}

/** A read-only view over the catalog snapshot. */
export interface ZoneCatalog {
  /** Canonical id for `zone` (itself, its link target, or `UTC`); null when unknown. */
  canonicalOf(zone: string): ZoneId | null;
  /** True when `zone` is a canonical row (or an alias of one) that is active. */
  isValid(zone: string): boolean;
  /** True when `zone` itself is a canonical row. */
  isCanonical(zone: string): boolean;
  /** Active canonical ids, sorted (picker list). */
  activeCanonicalZones(): ZoneId[];
}

function runtimeAccepts(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** True when the string has an allowed IANA shape (does not consult the catalog). */
export function hasIanaZoneShape(zone: string | null | undefined): zone is string {
  if (!zone || zone.length > 64) return false;
  if (zone === 'UTC') return true;
  if (FORBIDDEN_PREFIX.test(zone)) return false;
  if (/^Etc\//.test(zone)) return UTC_ZONE_ALIASES.includes(zone);
  return AREA_LOCATION.test(zone);
}

/**
 * Canonical id per D32. With a catalog: the row itself, its `linkTarget`, or null when unknown.
 * Without a catalog: the UTC family becomes `UTC`, any other well-shaped runtime zone is
 * returned unchanged (the runtime's own canonicalization is deliberately NOT used, because ICU
 * would turn `Asia/Muscat` into `Asia/Dubai`).
 */
export function canonicalZoneId(zone: string | null | undefined, catalog?: ZoneCatalog): ZoneId | null {
  if (!zone) return null;
  if (zone === 'UTC' || UTC_ZONE_ALIASES.includes(zone)) return 'UTC' as ZoneId;
  if (catalog) return catalog.canonicalOf(zone);
  if (!hasIanaZoneShape(zone) || !runtimeAccepts(zone)) return null;
  return zone as ZoneId;
}

/**
 * Validity rule (D16/D28/D32): IANA shape, the runtime can format it, and (with a catalog)
 * it is an active canonical row or an alias of one.
 */
export function isValidZoneId(zone: string | null | undefined, catalog?: ZoneCatalog): zone is string {
  if (!zone) return false;
  const utc = zone === 'UTC' || UTC_ZONE_ALIASES.includes(zone);
  if (!utc && !hasIanaZoneShape(zone)) return false;
  if (catalog) {
    if (!catalog.isValid(zone)) return false;
    const canonical = catalog.canonicalOf(zone);
    return canonical !== null && runtimeAccepts(canonical);
  }
  return runtimeAccepts(utc ? 'UTC' : zone);
}

/** Canonical {@link ZoneId} or `INVALID_TIME_ZONE`. */
export function parseZoneId(zone: string | null | undefined, catalog?: ZoneCatalog): ZoneId {
  if (!isValidZoneId(zone, catalog)) throw new ClockError('INVALID_TIME_ZONE', { zone: zone ?? null });
  const canonical = canonicalZoneId(zone, catalog);
  if (!canonical) throw new ClockError('INVALID_TIME_ZONE', { zone });
  return canonical;
}

/** True when `zone` is already the canonical id (no rewrite needed on save). */
export function isCanonicalZoneId(zone: string | null | undefined, catalog?: ZoneCatalog): boolean {
  if (!zone) return false;
  if (zone === 'UTC') return true;
  if (UTC_ZONE_ALIASES.includes(zone)) return false;
  if (catalog) return catalog.isCanonical(zone);
  return canonicalZoneId(zone) === zone;
}

/** Builds a {@link ZoneCatalog} from `sys_timezone_cd` rows (or a generated snapshot). */
export function createZoneCatalog(rows: readonly ZoneCatalogRow[]): ZoneCatalog {
  const byCode = new Map<string, ZoneCatalogRow>();
  for (const row of rows) byCode.set(row.code, row);
  const canonicalOf = (zone: string): ZoneId | null => {
    if (zone === 'UTC' || UTC_ZONE_ALIASES.includes(zone)) return 'UTC' as ZoneId;
    const row = byCode.get(zone);
    if (!row) return null;
    if (row.isCanonical) return row.code as ZoneId;
    const target = row.linkTarget ? byCode.get(row.linkTarget) : undefined;
    return target && target.isCanonical ? (target.code as ZoneId) : null;
  };
  const isValid = (zone: string): boolean => {
    const canonical = canonicalOf(zone);
    if (!canonical) return false;
    if (canonical === 'UTC' && !byCode.has('UTC')) return true;
    const row = byCode.get(canonical);
    return Boolean(row && row.isCanonical && row.isActive);
  };
  const isCanonical = (zone: string): boolean => Boolean(byCode.get(zone)?.isCanonical);
  const activeCanonicalZones = (): ZoneId[] =>
    [...byCode.values()]
      .filter((row) => row.isCanonical && row.isActive)
      .map((row) => row.code as ZoneId)
      .sort();
  return Object.freeze({ canonicalOf, isValid, isCanonical, activeCanonicalZones });
}
