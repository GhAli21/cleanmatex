/**
 * Decimal money primitives for the commercial calculator (ADR-060 §3).
 *
 * Why: every figure the calculator produces is exact decimal arithmetic with
 * no intermediate rounding (L22a). Floats are never used: `0.1 + 0.2` and
 * `Number(x.toFixed(3))` produce the one-minor-unit drift pinned in P1-01
 * (FD-01..FD-04). decimal.js is imported directly, never through
 * `@prisma/client/runtime`, because this folder is Prisma-free (ESLint rule).
 */
import Decimal from 'decimal.js';

/**
 * A dedicated decimal.js constructor for money, so the calculator's precision
 * never depends on (or changes) the global Decimal settings other code uses.
 * 40 significant digits keeps intermediate products like
 * quantity × unit price × rate exact well beyond DECIMAL(19,4).
 */
export const MoneyDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** An exact decimal amount. Instances are immutable. */
export type Money = InstanceType<typeof MoneyDecimal>;

/** Values accepted where a money amount is expected. Strings keep full precision; numbers are parsed via their shortest string form. */
export type MoneyInput = Money | Decimal | string | number;

/** Exact zero. */
export const ZERO: Money = new MoneyDecimal(0);

/**
 * Parses a value into exact decimal money.
 * @param value amount as Money, decimal string, or number
 * @returns the exact decimal value
 * @throws Error when the value is not a finite number (NaN, Infinity, empty string)
 * @example
 * toMoney('3.3335').toString(); // '3.3335'
 */
export function toMoney(value: MoneyInput): Money {
  const money = new MoneyDecimal(value instanceof Decimal ? value.toString() : value);
  if (!money.isFinite()) {
    throw new Error(`Invalid money amount: ${String(value)}`);
  }
  return money;
}

/**
 * Sums amounts exactly.
 * @param values amounts to add
 * @returns the exact sum (ZERO for an empty list)
 */
export function sumMoney(values: readonly MoneyInput[]): Money {
  return values.reduce<Money>((total, value) => total.plus(toMoney(value)), ZERO);
}

/**
 * Formats an amount as a fixed-scale string for storage, without rounding.
 * Rounding is an explicit, separate step (rounding.ts); this function refuses
 * to silently drop digits.
 * @param value amount, already rounded to at most `scale` decimals
 * @param scale decimal places of the target column (4 for DECIMAL(19,4))
 * @returns e.g. '1.2000'
 * @throws Error when the value has more decimals than `scale`
 */
export function toStorageString(value: MoneyInput, scale = 4): string {
  const money = toMoney(value);
  if (money.decimalPlaces() > scale) {
    throw new Error(`Amount ${money.toString()} has more than ${scale} decimals; round it before storing.`);
  }
  return money.toFixed(scale);
}
