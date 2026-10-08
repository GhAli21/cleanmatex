/**
 * Display-name resolution for bilingual `sys_*` code catalogs.
 *
 * The platform owns the English/Arabic names of system codes (HQ edits them), so screens resolve
 * a stored code to its catalog name instead of printing the raw code. Pure and framework-free so
 * the rule lives in one place and is unit-testable.
 */

/** The slice of a catalog row needed to label a code. */
export interface CatalogLabelEntry {
  code: string;
  name: string;
  name2?: string | null;
}

/**
 * Returns the display name for `code` in `locale`.
 *
 * - Arabic locale prefers `name2`, then `name`.
 * - Any other locale prefers `name`.
 * - A code absent from the catalog (not loaded yet, retired, or unknown) falls back to the code
 *   itself, so a label can never be empty and an unknown value stays visible and diagnosable.
 * - `null` / `undefined` / empty codes return `fallback` (default empty string).
 */
export function resolveCatalogLabel(
  entries: readonly CatalogLabelEntry[] | undefined,
  code: string | null | undefined,
  locale: string,
  fallback = '',
): string {
  if (!code) return fallback;
  const entry = entries?.find((e) => e.code === code);
  if (!entry) return code;
  const isArabic = locale === 'ar' || locale.startsWith('ar-');
  const preferred = isArabic ? entry.name2?.trim() : entry.name?.trim();
  return preferred || entry.name?.trim() || entry.name2?.trim() || code;
}
