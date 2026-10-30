/**
 * Rounding for the commercial calculator (ADR-060 §3, PLAN.md §9, L22).
 *
 * Why: the 7 modes mirror `sys_rounding_mode_cd` exactly (DB-mirror rule),
 * and an optional increment covers coin-step rules. Round once, at the end
 * (L22b): callers apply these only to figures that are stored, printed or
 * sent, never to intermediate values.
 */
import Decimal from 'decimal.js';
import { MoneyDecimal, toMoney, type Money, type MoneyInput } from './money';

/** `sys_rounding_mode_cd.code` values (DB-mirror). */
export const ROUNDING_MODES = {
  UP: 'UP',
  DOWN: 'DOWN',
  CEILING: 'CEILING',
  FLOOR: 'FLOOR',
  HALF_UP: 'HALF_UP',
  HALF_DOWN: 'HALF_DOWN',
  HALF_EVEN: 'HALF_EVEN',
} as const;
/** Derived union for `sys_rounding_mode_cd.code`. */
export type RoundingMode = (typeof ROUNDING_MODES)[keyof typeof ROUNDING_MODES];

// UP/DOWN are away from / towards zero; CEILING/FLOOR towards +/- infinity.
const DECIMAL_JS_MODE: Record<RoundingMode, Decimal.Rounding> = {
  UP: Decimal.ROUND_UP,
  DOWN: Decimal.ROUND_DOWN,
  CEILING: Decimal.ROUND_CEIL,
  FLOOR: Decimal.ROUND_FLOOR,
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_DOWN: Decimal.ROUND_HALF_DOWN,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
};

/** A complete rounding rule: decimals, mode and an optional coin step. */
export interface RoundingRule {
  /** Decimal places of the result, e.g. 3 for OMR, 2 for SAR. */
  decimalPlaces: number;
  mode: RoundingMode;
  /**
   * Optional step in minor units at `decimalPlaces` (5 at 2 decimals = 0.05).
   * Null or 1 means plain rounding to `decimalPlaces`.
   */
  incrementMinor?: number | null;
}

/**
 * Type guard for a `sys_rounding_mode_cd` code read from the DB.
 * @param value candidate code
 * @returns true when it is one of the 7 modes
 */
export function isRoundingMode(value: string): value is RoundingMode {
  return Object.prototype.hasOwnProperty.call(DECIMAL_JS_MODE, value);
}

/**
 * Rounds an amount by a rule.
 * @param value exact amount
 * @param rule decimals, mode and optional increment
 * @returns the rounded amount
 * @throws Error on negative decimals or a non-positive / non-integer increment
 * @example
 * roundMoney('9.99', { decimalPlaces: 2, mode: 'HALF_UP', incrementMinor: 5 }).toString(); // '10'
 */
export function roundMoney(value: MoneyInput, rule: RoundingRule): Money {
  const { decimalPlaces, mode } = rule;
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new Error(`Invalid decimal places: ${decimalPlaces}`);
  }
  const amount = toMoney(value);
  const rm = DECIMAL_JS_MODE[mode];
  const increment = rule.incrementMinor ?? 1;
  if (!Number.isInteger(increment) || increment <= 0) {
    throw new Error(`Invalid rounding increment: ${increment}`);
  }
  if (increment === 1) {
    return amount.toDecimalPlaces(decimalPlaces, rm);
  }
  // Step in major units, e.g. 5 minor units at 2 decimals = 0.05.
  const step = new MoneyDecimal(increment).dividedBy(new MoneyDecimal(10).pow(decimalPlaces));
  return amount.dividedBy(step).toDecimalPlaces(0, rm).times(step);
}
