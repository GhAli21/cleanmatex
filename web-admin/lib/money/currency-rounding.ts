/**
 * Currency Rounding (B17)
 *
 * Applies the tenant-currency cash-rounding rule (`sys_currency_rounding_rules_cd`,
 * migration 0290) to a grand total. Resolution is by currency code alone (the
 * table has no tenant scope) and is a safe no-op whenever no active rule row
 * exists or `rounding_unit` is not a usable positive increment — this never
 * invents a rounding behavior, matching the B15 "resolve or zero, never
 * assume" policy already applied to tax rates and currency defaults.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';
import type { CurrencyRoundingMode } from '@/lib/constants/order-financial';

/** Resolved rounding rule for one currency. */
export interface CurrencyRoundingRule {
  roundingMethod: CurrencyRoundingMode;
  roundingUnit: number;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function applyRoundingMode(raw: number, mode: CurrencyRoundingMode): number {
  switch (mode) {
    case CURRENCY_ROUNDING_MODES.FLOOR:
      return Math.floor(raw);
    case CURRENCY_ROUNDING_MODES.HALF_UP:
      return Math.round(raw);
    case CURRENCY_ROUNDING_MODES.HALF_DOWN: {
      const fractional = raw - Math.floor(raw);
      return fractional > 0.5 ? Math.ceil(raw) : Math.floor(raw);
    }
    case CURRENCY_ROUNDING_MODES.CEIL:
    default:
      return Math.ceil(raw);
  }
}

/**
 * Round `value` to the nearest multiple of `increment` using `mode`.
 * No-op (returns `value` unchanged) when `increment` is not a usable
 * positive number — never invents a rounding behavior for a bad config row.
 * @param value
 * @param increment
 * @param mode
 */
export function roundToIncrement(
  value: number,
  increment: number,
  mode: CurrencyRoundingMode,
): number {
  if (!Number.isFinite(increment) || increment <= 0) {
    return value;
  }
  const steps = value / increment;
  const roundedSteps = applyRoundingMode(steps, mode);
  return round4(roundedSteps * increment);
}

/**
 * Resolve the active cash-rounding rule for a currency code.
 * Returns `null` when no active rule row exists — callers must treat this
 * as "no rounding applies," not as an error.
 * @param currencyCode
 */
export async function resolveCurrencyRoundingRule(
  currencyCode: string,
): Promise<CurrencyRoundingRule | null> {
  const row = await prisma.sys_currency_rounding_rules_cd.findFirst({
    where: { currency_code: currencyCode, is_active: true, rec_status: 1 },
  });
  if (!row) {
    return null;
  }
  const roundingUnit = Number(row.rounding_unit);
  if (!Number.isFinite(roundingUnit) || roundingUnit <= 0) {
    return null;
  }
  const validModes = new Set<string>(Object.values(CURRENCY_ROUNDING_MODES));
  const roundingMethod = validModes.has(row.rounding_method)
    ? (row.rounding_method as CurrencyRoundingMode)
    : CURRENCY_ROUNDING_MODES.HALF_UP;
  return { roundingMethod, roundingUnit };
}
