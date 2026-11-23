/**
 * Billed measure of a measured line (kg, m, m², L …) — PLAN §3.6a, D12, D13.
 *
 * Why: a measured line is priced on what is billed, not on what was weighed:
 *   billed = max(measured, minimum), rounded UP to the billing step.
 * Both the minimum and the step are optional. Rounding up commutes with max, so
 * the order of the two never changes the result. The database CHECK
 * `ck_oid_billed_qty` (0814) holds the same identity and refuses any other value;
 * this is the one place the application computes it.
 *
 * Area lines are entered as length × width (metres); the area is rounded half-up
 * to the unit's decimals, as `ck_oid_measure_area` requires.
 */
import { UOM_DIMENSIONS, QUANTITY_DECIMALS } from '@/lib/constants/uom';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from './errors';
import { MoneyDecimal, toMoney, type Money, type MoneyInput } from './money';

/** The measure facts of one line (from the order-line unit snapshot + what staff entered). */
export interface MeasureInput {
  /** The line unit's dimension; COUNT lines carry no measure. */
  dimension: string;
  /** The line unit's `qty_decimals`. */
  qtyDecimals: number;
  /** Non-area lines: the measured amount in the line unit. */
  measuredQty?: MoneyInput | null;
  /** Area lines: length and width in metres. */
  length?: MoneyInput | null;
  width?: MoneyInput | null;
  /** Optional minimum billed measure (product, snapshotted on the line). */
  minBillableQty?: MoneyInput | null;
  /** Optional billing step (product, snapshotted on the line). */
  billingIncrement?: MoneyInput | null;
}

/** The resolved measure: what was measured and what is billed. */
export interface BilledMeasure {
  measuredQty: Money;
  /** Area lines only. */
  length: Money | null;
  width: Money | null;
  /** The quantity money multiplies. */
  billedQty: Money;
  minBillableQty: Money | null;
  billingIncrement: Money | null;
  /** The minimum raised the measure (print "(minimum)"). */
  minimumApplied: boolean;
  /** The step raised the measure (print "(per 0.5 kg)"). */
  incrementApplied: boolean;
}

const rule = (code: keyof typeof COMMERCIAL_ERROR_CODES, message: string, details: Record<string, string> = {}) =>
  new CommercialRuleError(COMMERCIAL_ERROR_CODES[code], message, details);

const positive = (value: MoneyInput | null | undefined, label: string): Money | null => {
  if (value == null || value === '') return null;
  const money = toMoney(value);
  if (!money.greaterThan(0)) throw rule('MEASURE_REQUIRED', `${label} must be greater than zero (got ${money.toString()})`, { label });
  if (money.decimalPlaces() > QUANTITY_DECIMALS) {
    throw rule('UOM_QTY_SCALE', `${label} allows ${QUANTITY_DECIMALS} decimal place(s)`, { label, value: money.toString() });
  }
  return money;
};

/**
 * True when the line's unit is measured (not a piece count).
 * @param dimension the unit dimension
 * @returns whether the line is priced on a measure
 */
export function isMeasuredDimension(dimension: string | null | undefined): boolean {
  return dimension != null && dimension !== UOM_DIMENSIONS.COUNT;
}

/**
 * Resolves the billed measure of one measured line.
 * @param input the unit dimension and decimals, the entered measure, and the optional minimum and step
 * @returns measured and billed quantities, and which rule raised the bill
 * @throws CommercialRuleError MEASURE_NOT_ALLOWED (count unit), MEASURE_REQUIRED (missing or ≤ 0), UOM_QTY_SCALE (too many decimals)
 * @example
 * resolveBilledMeasure({ dimension: 'MASS', qtyDecimals: 3, measuredQty: '3.2',
 *   minBillableQty: '3', billingIncrement: '0.5' }).billedQty.toString(); // '3.5'
 */
export function resolveBilledMeasure(input: MeasureInput): BilledMeasure {
  if (!isMeasuredDimension(input.dimension)) {
    throw rule('MEASURE_NOT_ALLOWED', `A ${input.dimension} unit is counted, not measured.`, { dimension: input.dimension });
  }
  const isArea = input.dimension === UOM_DIMENSIONS.AREA;
  let length: Money | null = null;
  let width: Money | null = null;
  let measured: Money;

  if (isArea) {
    length = positive(input.length, 'length');
    width = positive(input.width, 'width');
    if (!length || !width) throw rule('MEASURE_REQUIRED', 'Enter both length and width.', { dimension: input.dimension });
    measured = length.times(width).toDecimalPlaces(input.qtyDecimals, MoneyDecimal.ROUND_HALF_UP);
    if (!measured.greaterThan(0)) throw rule('MEASURE_REQUIRED', 'The area rounds to zero.', { area: measured.toString() });
  } else {
    const value = positive(input.measuredQty, 'measure');
    if (!value) throw rule('MEASURE_REQUIRED', 'Enter the measured quantity.', { dimension: input.dimension });
    if (value.decimalPlaces() > input.qtyDecimals) {
      throw rule('UOM_QTY_SCALE', `The measure allows ${input.qtyDecimals} decimal place(s).`,
        { value: value.toString(), decimals: String(input.qtyDecimals) });
    }
    measured = value;
  }

  const minimum = positive(input.minBillableQty, 'minimum billable');
  const increment = positive(input.billingIncrement, 'billing step');
  const floored = minimum && minimum.greaterThan(measured) ? minimum : measured;
  const billed = increment ? floored.dividedBy(increment).ceil().times(increment) : floored;

  return {
    measuredQty: measured,
    length,
    width,
    billedQty: billed,
    minBillableQty: minimum,
    billingIncrement: increment,
    minimumApplied: floored.greaterThan(measured),
    incrementApplied: billed.greaterThan(floored),
  };
}
