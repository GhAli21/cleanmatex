/**
 * Reads the free-text `unit` column of a product CSV: a unit code (`PC`, `KG`) or an
 * older word (`piece`, `unit`, `liter` …). The database checks the Organization has the unit.
 */
import { UOM_CODE_PATTERN, UOM_DEFAULT_COUNT_CODE } from '@/lib/constants/uom';

const LEGACY: Readonly<Record<string, string>> = {
  PCS: 'PC', PIECE: 'PC', PIECES: 'PC', UNIT: 'PC', ITEM: 'PC',
  LITER: 'L', LITRE: 'L', LTR: 'L',
  KILOGRAM: 'KG', GRAM: 'G', GRAMS: 'G', BOTTLE: 'BTL',
};

/**
 * The unit code for a CSV unit text.
 * @param productUnit the text (null/empty = a piece)
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
