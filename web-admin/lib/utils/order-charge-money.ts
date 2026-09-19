/**
 * Which charge rows add to commercial `total_amount` / `total_charges_amount`.
 *
 * Item/piece preference extras live in line `total_price`. Only ORDER-level
 * PREFERENCE rows (plus real non-pref charges) are money addends.
 */

import { CHARGE_TYPES } from '@/lib/constants/order-financial';
import { PREFS_LEVEL } from '@/lib/constants/order-preferences';

function normalizeUpper(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const REAL_MONEY_CHARGE_TYPES = new Set<string>([
  CHARGE_TYPES.EXPRESS,
  'EXPRESS_CHARGE',
  CHARGE_TYPES.BULK_SURCHARGE,
  CHARGE_TYPES.SPECIAL_HANDLING,
  'SERVICE',
  'SERVICE_CHARGE',
  'DELIVERY',
  'DELIVERY_CHARGE',
]);

export type ChargeMoneyRow = {
  amount: unknown;
  charge_type: string;
  charge_source_id?: string | null;
};

/**
 * True when this active charge row should increase the order commercial total.
 */
export function isMoneyAddendCharge(
  charge: ChargeMoneyRow,
  preferenceLevelById: ReadonlyMap<string, string>,
): boolean {
  const type = normalizeUpper(charge.charge_type);
  if (type === CHARGE_TYPES.PREFERENCE) {
    if (!charge.charge_source_id) return false;
    return preferenceLevelById.get(charge.charge_source_id) === PREFS_LEVEL.ORDER;
  }
  return REAL_MONEY_CHARGE_TYPES.has(type);
}

/**
 * Sum of money-addend charges. ITEM/PIECE PREFERENCE rows are excluded even if still active.
 */
export function sumMoneyAddendCharges(
  charges: ChargeMoneyRow[],
  preferenceLevelById: ReadonlyMap<string, string>,
): number {
  return charges.reduce((sum, row) => {
    if (!isMoneyAddendCharge(row, preferenceLevelById)) return sum;
    return sum + toNumber(row.amount);
  }, 0);
}

export function mapPreferenceLevels(
  preferences: Array<{ id: string; prefs_level: string | null }>,
): Map<string, string> {
  return new Map(preferences.map((row) => [row.id, normalizeUpper(row.prefs_level)]));
}

/**
 * Active PREFERENCE charge that inflated historical totals: ITEM/PIECE
 * extras already inside line totals, or an orphan with no ORDER-level source.
 */
export function isContaminatingPreferenceCharge(
  charge: ChargeMoneyRow,
  preferenceLevelById: ReadonlyMap<string, string>,
): boolean {
  if (normalizeUpper(charge.charge_type) !== CHARGE_TYPES.PREFERENCE) return false;
  if (!charge.charge_source_id) return true;
  return preferenceLevelById.get(charge.charge_source_id) !== PREFS_LEVEL.ORDER;
}

export function sumContaminatingPreferenceCharges(
  charges: ChargeMoneyRow[],
  preferenceLevelById: ReadonlyMap<string, string>,
): number {
  return charges.reduce((sum, row) => {
    if (!isContaminatingPreferenceCharge(row, preferenceLevelById)) return sum;
    return sum + toNumber(row.amount);
  }, 0);
}
