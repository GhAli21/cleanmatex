/**
 * The decimals rule (D11): a quantity in a unit carries at most that unit's
 * `qty_decimals`; count units are whole numbers. Mirrors the database function
 * `fn_uom_assert_qty_scale` (0813) so forms reject what the database would.
 */
import { UOM_ERROR_CODES } from '@/lib/constants/uom';
import { toMoney, type MoneyInput } from '@/lib/commercial/money';
import { UomRuleError } from './errors';

/**
 * True when the quantity has no more decimals than the unit allows.
 * @param qty the quantity (decimal string, number or Decimal)
 * @param qtyDecimals the unit's `qty_decimals`
 * @returns whether the quantity fits the unit
 * @example
 * isQtyScaleValid('1.5', 0); // false — a piece count is whole
 */
export function isQtyScaleValid(qty: MoneyInput, qtyDecimals: number): boolean {
  return toMoney(qty).decimalPlaces() <= qtyDecimals;
}

/**
 * Throws when the quantity has more decimals than the unit allows.
 * @param qty the quantity
 * @param unit the unit's code and `qty_decimals`
 * @param label what the quantity is, for the message (e.g. "minimum billable")
 * @throws UomRuleError UOM_QTY_SCALE
 * @example
 * assertQtyScale('2.375', { code: 'KG', qtyDecimals: 3 }); // ok
 */
export function assertQtyScale(qty: MoneyInput, unit: { code: string; qtyDecimals: number }, label = 'quantity'): void {
  if (!isQtyScaleValid(qty, unit.qtyDecimals)) {
    throw new UomRuleError(UOM_ERROR_CODES.UOM_QTY_SCALE,
      `${label} in ${unit.code} allows ${unit.qtyDecimals} decimal place(s) (got ${toMoney(qty).toString()})`,
      { unit: unit.code, decimals: String(unit.qtyDecimals), value: toMoney(qty).toString(), label });
  }
}
