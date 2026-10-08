/**
 * Display-name resolution for bilingual `sys_*` code catalogs (HQ-managed names).
 */
import { resolveCatalogLabel } from '@/lib/utils/catalog-label';

const CATALOG = [
  { code: 'OPEN', name: 'Open', name2: 'مفتوحة' },
  { code: 'PAUSED', name: 'Paused', name2: null },
  { code: 'CLOSED', name: 'Closed', name2: '   ' },
];

describe('resolveCatalogLabel', () => {
  it('prefers the Arabic name in an Arabic locale and the English name otherwise', () => {
    expect(resolveCatalogLabel(CATALOG, 'OPEN', 'ar')).toBe('مفتوحة');
    expect(resolveCatalogLabel(CATALOG, 'OPEN', 'ar-SA')).toBe('مفتوحة');
    expect(resolveCatalogLabel(CATALOG, 'OPEN', 'en')).toBe('Open');
  });

  it('falls back to the English name when the Arabic name is missing or blank', () => {
    expect(resolveCatalogLabel(CATALOG, 'PAUSED', 'ar')).toBe('Paused');
    expect(resolveCatalogLabel(CATALOG, 'CLOSED', 'ar')).toBe('Closed');
  });

  it('returns the raw code for a code the catalog does not know (retired, unknown, not loaded)', () => {
    expect(resolveCatalogLabel(CATALOG, 'ROLLOVER_PAUSE', 'en')).toBe('ROLLOVER_PAUSE');
    expect(resolveCatalogLabel(undefined, 'OPEN', 'ar')).toBe('OPEN');
    expect(resolveCatalogLabel([], 'OPEN', 'en')).toBe('OPEN');
  });

  it('returns the fallback for an empty code and never an empty label for a real one', () => {
    expect(resolveCatalogLabel(CATALOG, null, 'en')).toBe('');
    expect(resolveCatalogLabel(CATALOG, undefined, 'en', '—')).toBe('—');
    expect(resolveCatalogLabel(CATALOG, '', 'en', '—')).toBe('—');
    expect(resolveCatalogLabel([{ code: 'X', name: '  ', name2: null }], 'X', 'en')).toBe('X');
  });
});
