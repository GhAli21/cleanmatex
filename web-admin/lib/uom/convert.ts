/**
 * Unit conversion resolver — the TypeScript mirror of `fn_uom_convert` (0813).
 *
 * Why: screens preview conversions and services convert many quantities per
 * request; one indexed, in-memory resolver per Organization avoids a query per
 * line (PLAN §3.12). The rules are the database's, step for step:
 * 1. same unit → the quantity;
 * 2. direct pair, most specific first: the product's pair, then the
 *    Organization-wide pair; either direction (the reverse uses `divideRate`);
 * 3. two legs through a base unit (the source dimension's, then the target's);
 * 4. else UOM_CONVERSION_MISSING.
 * At most two stored rates are multiplied, so bad data can never loop. A count
 * target must come out whole unless the caller asks for the raw value.
 */
import { QUANTITY_DECIMALS, UOM_DIMENSIONS, UOM_ERROR_CODES } from '@/lib/constants/uom';
import type { UomConversionFacts, UomUnitFacts } from '@/lib/types/uom';
import { toMoney, type Money, type MoneyInput } from '@/lib/commercial/money';
import { UomRuleError } from './errors';

/** Options for one conversion. */
export interface UomConvertOptions {
  /** The product whose own pairs apply first; null/omitted = Organization-wide only. */
  productId?: string | null;
  /** False returns a fractional count result instead of throwing (display only). Default true. */
  requireWhole?: boolean;
}

/** An Organization's units and conversions, indexed once. */
export interface UomResolver {
  /** The unit with this code, or undefined. */
  unit(code: string): UomUnitFacts | undefined;
  /** The base unit code of a dimension, or undefined. */
  baseOf(dimension: string): string | undefined;
  /** The direct rate from → to (qty_to = qty_from × rate), or null. Mirrors `fn_uom_conv_rate`. */
  directRate(from: string, to: string, productId?: string | null): Money | null;
  /** The rate from → to through the resolver steps, or null when no path exists. */
  rate(from: string, to: string, productId?: string | null): Money | null;
  /**
   * Converts a quantity; the result is not rounded (callers round to the target decimals).
   * @throws UomRuleError UOM_CONVERSION_MISSING, UOM_QTY_NOT_WHOLE
   */
  convert(qty: MoneyInput, from: string, to: string, options?: UomConvertOptions): Money;
}

interface StoredRate {
  multiply: Money;
  divide: Money;
}

const pairKey = (productId: string | null, from: string, to: string) => `${productId ?? ''}|${from}|${to}`;

/**
 * Indexes an Organization's units and conversions for fast, repeated conversion.
 * @param units the Organization's units (`org_uom_cf`)
 * @param conversions the Organization's conversions (`org_uom_conv_cf`); inactive rows are ignored
 * @returns the resolver
 * @example
 * const uom = createUomResolver(units, conversions);
 * uom.convert('2', 'LB', 'KG').toString(); // '0.90718474'
 */
export function createUomResolver(
  units: readonly UomUnitFacts[],
  conversions: readonly UomConversionFacts[],
): UomResolver {
  const unitByCode = new Map(units.map((u) => [u.code, u] as const));
  const baseByDimension = new Map(units.filter((u) => u.isBaseUnit).map((u) => [u.dimension as string, u.code] as const));
  const pairs = new Map<string, StoredRate>();
  for (const c of conversions) {
    if (!c.isActive) continue;
    pairs.set(pairKey(c.productId, c.fromCode, c.toCode), { multiply: toMoney(c.multiplyRate), divide: toMoney(c.divideRate) });
  }

  const directRate = (from: string, to: string, productId?: string | null): Money | null => {
    const scopes = productId ? [productId, null] : [null];
    for (const scope of scopes) {
      const forward = pairs.get(pairKey(scope, from, to));
      if (forward) return forward.multiply;
      const reverse = pairs.get(pairKey(scope, to, from));
      if (reverse) return reverse.divide;
    }
    return null;
  };

  const rate = (from: string, to: string, productId?: string | null): Money | null => {
    if (from === to) return toMoney(1);
    const direct = directRate(from, to, productId);
    if (direct) return direct;
    const bases = [unitByCode.get(from), unitByCode.get(to)]
      .map((u) => (u ? baseByDimension.get(u.dimension) : undefined))
      .filter((b): b is string => b !== undefined && b !== from && b !== to);
    for (const base of new Set(bases)) {
      const leg1 = directRate(from, base, productId);
      const leg2 = directRate(base, to, productId);
      if (leg1 && leg2) return leg1.times(leg2);
    }
    return null;
  };

  const convert = (qty: MoneyInput, from: string, to: string, options: UomConvertOptions = {}): Money => {
    const value = toMoney(qty);
    const r = rate(from, to, options.productId);
    if (!r) {
      throw new UomRuleError(UOM_ERROR_CODES.UOM_CONVERSION_MISSING, `no conversion from ${from} to ${to}`, { from, to });
    }
    const result = value.times(r);
    const target = unitByCode.get(to);
    if ((options.requireWhole ?? true) && target?.dimension === UOM_DIMENSIONS.COUNT) {
      // A stored 12-decimal reciprocal leaves noise (24 × 0.083333333333 = 1.999999999992):
      // judge at the QUANTITY scale and return the clean whole number (same as fn_uom_convert, 0817).
      const whole = result.toDecimalPlaces(QUANTITY_DECIMALS);
      if (!whole.isInteger()) {
        throw new UomRuleError(UOM_ERROR_CODES.UOM_QTY_NOT_WHOLE,
          `${value.toString()} ${from} is ${result.toString()} ${to}, not a whole number`,
          { from, to, value: value.toString(), result: result.toString() });
      }
      return whole;
    }
    return result;
  };

  return {
    unit: (code) => unitByCode.get(code),
    baseOf: (dimension) => baseByDimension.get(dimension),
    directRate,
    rate,
    convert,
  };
}

/**
 * The reciprocal of a rate at RATE precision, for pre-filling the "Divide rate" field.
 * @param rate a positive multiply rate
 * @param decimals decimals to keep (12 = RATE class)
 * @returns 1 / rate, rounded half-up
 * @example
 * reciprocalRate('0.45359237').toString(); // '2.204622621849'
 */
export function reciprocalRate(rate: MoneyInput, decimals = 12): Money {
  const value = toMoney(rate);
  if (!value.greaterThan(0)) throw new Error(`Rate must be positive: ${value.toString()}`);
  return toMoney(1).dividedBy(value).toDecimalPlaces(decimals);
}

/**
 * True when the two rates are reciprocal within the database tolerance (CHECK ck_ouomc_rates).
 * @param multiplyRate the stored multiply rate
 * @param divideRate the stored divide rate
 * @param tolerance allowed |m × d − 1|
 * @returns whether the database will accept the pair
 */
export function areRatesReciprocal(multiplyRate: MoneyInput, divideRate: MoneyInput, tolerance: MoneyInput = '0.000001'): boolean {
  const m = toMoney(multiplyRate);
  const d = toMoney(divideRate);
  return m.greaterThan(0) && d.greaterThan(0) && m.times(d).minus(1).abs().lessThanOrEqualTo(toMoney(tolerance));
}
