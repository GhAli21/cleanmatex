/**
 * Money math helpers built on Prisma's Decimal.
 *
 * Why this exists:
 * CleanMateX stores monetary values as DECIMAL(19,4). JavaScript's native
 * number type loses precision once arithmetic crosses the 2^53 mantissa
 * boundary OR when 3-decimal currencies (OMR, BHD, KWD) interact with
 * 4-decimal storage. Reducing all money math to a Decimal pipeline removes
 * the drift entirely.
 *
 * Scale convention:
 * Storage is DECIMAL(19,4). UI may display fewer fractional digits per
 * currency (USD/EUR=2, JPY=0, KWD/BHD/OMR=3) but we keep computation at
 * scale 4 and round at the boundary. Callers that need a currency-specific
 * scale should pass it explicitly via the `scale` argument.
 *
 * Usage:
 * - Internal accumulators / comparisons → these helpers
 * - DB writes → pass the returned Decimal directly (Prisma accepts it)
 * - User-facing output → format with the currency's display scale
 */

import { Decimal } from '@prisma/client/runtime/library';

/** Canonical money scale matching the DB DECIMAL(19,4) columns. */
export const MONEY_SCALE = 4;

/** Numeric values acceptable as money input. */
export type MoneyInput = number | string | Decimal | null | undefined;

/**
 * Coerce any acceptable money input to a Decimal. `null` / `undefined` → 0.
 * Non-finite numbers (NaN, Infinity) throw — they're never valid money values.
 * @param value
 */
export function toDecimal(value: MoneyInput): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Money value must be finite (got ${value})`);
    }
    return new Decimal(value);
  }
  return new Decimal(value);
}

/**
 * Add two money inputs and round to MONEY_SCALE (default 4 decimal places).
 * @param a
 * @param b
 * @param scale
 */
export function addMoney(a: MoneyInput, b: MoneyInput, scale: number = MONEY_SCALE): Decimal {
  return toDecimal(a).plus(toDecimal(b)).toDecimalPlaces(scale);
}

/**
 * Subtract `b` from `a` and round to MONEY_SCALE.
 * @param a
 * @param b
 * @param scale
 */
export function subMoney(a: MoneyInput, b: MoneyInput, scale: number = MONEY_SCALE): Decimal {
  return toDecimal(a).minus(toDecimal(b)).toDecimalPlaces(scale);
}

/**
 * Multiply two money inputs and round to MONEY_SCALE.
 * @param a
 * @param b
 * @param scale
 */
export function mulMoney(a: MoneyInput, b: MoneyInput, scale: number = MONEY_SCALE): Decimal {
  return toDecimal(a).times(toDecimal(b)).toDecimalPlaces(scale);
}

/**
 * Round a money value to MONEY_SCALE (default 4 decimal places).
 * @param value
 * @param scale
 */
export function roundMoney(value: MoneyInput, scale: number = MONEY_SCALE): Decimal {
  return toDecimal(value).toDecimalPlaces(scale);
}

/**
 * Sum a list of money inputs into a single Decimal, rounded to MONEY_SCALE.
 * Empty array → 0. Used for leg totals, split-amount validation, and any
 * accumulator that would otherwise drift on plain `+`.
 * @param values
 * @param scale
 */
export function sumMoney(values: MoneyInput[], scale: number = MONEY_SCALE): Decimal {
  return values
    .reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0))
    .toDecimalPlaces(scale);
}

/**
 * Equality at MONEY_SCALE. Both sides are rounded to the same scale before
 * comparison, so `0.30000001` and `0.30000002` compare equal at scale 4 (they
 * round to the same 0.3000).
 * @param a
 * @param b
 * @param scale
 */
export function eqMoney(a: MoneyInput, b: MoneyInput, scale: number = MONEY_SCALE): boolean {
  return roundMoney(a, scale).equals(roundMoney(b, scale));
}

/**
 * Three-way comparison at MONEY_SCALE. Returns -1 if `a < b`, 0 if equal, 1 if `a > b`.
 * Useful for tolerance-aware checks where `>` / `<` on raw JS numbers would
 * surface 0.0000000001-style drift as a false mismatch.
 * @param a
 * @param b
 * @param scale
 */
export function compareMoney(a: MoneyInput, b: MoneyInput, scale: number = MONEY_SCALE): -1 | 0 | 1 {
  const ad = roundMoney(a, scale);
  const bd = roundMoney(b, scale);
  if (ad.lessThan(bd)) return -1;
  if (ad.greaterThan(bd)) return 1;
  return 0;
}

/**
 * Convert a Decimal to a JS number safely (Decimal precision is preserved at scale 4).
 * @param value
 */
export function decimalToNumber(value: MoneyInput): number {
  return toDecimal(value).toNumber();
}
