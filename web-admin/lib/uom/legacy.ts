/**
 * Transitional: maps the legacy free-text `product_unit` (PC, piece, unit, kg, liter …)
 * to a unit code. Mirrors the database function `fn_uom_legacy_code` (0814). Product
 * writers send `base_uom_code` explicitly through this until the unit picker (P4) and
 * Migration B (P9) remove the text column; delete this file then.
 */
import { UOM_CODE_PATTERN, UOM_DEFAULT_COUNT_CODE } from '@/lib/constants/uom';

const LEGACY: Readonly<Record<string, string>> = {
  PCS: 'PC', PIECE: 'PC', PIECES: 'PC', UNIT: 'PC', ITEM: 'PC',
  LITER: 'L', LITRE: 'L', LTR: 'L',
  KILOGRAM: 'KG', GRAM: 'G', GRAMS: 'G', BOTTLE: 'BTL',
};

/**
 * The unit code for a legacy `product_unit` text.
 * @param productUnit the legacy text (null/empty = a piece)
 * @returns the unit code, or null when the text cannot be a unit code
 * @example
 * legacyUnitToUomCode('piece'); // 'PC'
 */
export function legacyUnitToUomCode(productUnit: string | null | undefined): string | null {
  const value = (productUnit ?? '').trim().toUpperCase();
  if (value === '') return UOM_DEFAULT_COUNT_CODE;
  if (LEGACY[value]) return LEGACY[value];
  return UOM_CODE_PATTERN.test(value) ? value : null;
}
