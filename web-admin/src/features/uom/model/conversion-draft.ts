/** The rules of the conversion dialog, so staff cannot build a pair the database would refuse. */
import { areRatesReciprocal, reciprocalRate } from '@/lib/uom/convert';
import { RATE_DECIMALS, UOM_RATE_RECIPROCAL_TOLERANCE } from '@/lib/constants/uom';
import type { UomUnit } from '@/lib/types/uom';

/** A rate typed by a user: positive decimal text with at most the RATE decimals. */
const isRate = (v: string) => new RegExp(`^\\d+(\\.\\d{1,${RATE_DECIMALS}})?$`).test(v) && Number(v) > 0;

/**
 * @param multiplyRate the typed multiply rate
 * @returns 1 / multiply as text for the divide field, or null while the rate is unusable
 */
export function suggestedDivideRate(multiplyRate: string): string | null {
  if (!isRate(multiplyRate)) return null;
  const reciprocal = reciprocalRate(multiplyRate);
  return reciprocal.greaterThan(0) ? reciprocal.toFixed() : null;
}

/**
 * @returns `ok`; `incomplete` while a field is empty; `invalid` for a rate that is not a positive
 *   number; `mismatch` when multiply × divide is not 1 within the database tolerance
 */
export function checkRates(multiplyRate: string, divideRate: string): 'ok' | 'incomplete' | 'invalid' | 'mismatch' {
  if (!multiplyRate || !divideRate) return multiplyRate && !isRate(multiplyRate) ? 'invalid' : 'incomplete';
  if (!isRate(multiplyRate) || !isRate(divideRate)) return 'invalid';
  return areRatesReciprocal(multiplyRate, divideRate, UOM_RATE_RECIPROCAL_TOLERANCE) ? 'ok' : 'mismatch';
}

/** The multiply rate as the preview shows it ("1 LB = 0.45359237 KG"). */
export function previewRate(multiplyRate: string): string {
  return multiplyRate.includes('.') ? multiplyRate.replace(/\.?0+$/, '') : multiplyRate;
}

/**
 * The units each side of the dialog may offer. A product's own pair may join anything. An
 * Organization-wide pair joins two units of one measure, and no packaging unit (database rule).
 * @param units the Organization's units
 * @param fromCode the chosen "from" unit, if any
 * @param perProduct the pair belongs to a product
 */
export function conversionUnits<U extends Pick<UomUnit, 'code' | 'dimension' | 'isPackaging'>>(
  units: readonly U[], fromCode: string, perProduct: boolean,
): { from: U[]; to: U[] } {
  const allowed = perProduct ? [...units] : units.filter((u) => !u.isPackaging);
  const from = allowed.find((u) => u.code === fromCode);
  const to = allowed.filter((u) => u.code !== fromCode && (perProduct || !from || u.dimension === from.dimension));
  return { from: allowed, to };
}
