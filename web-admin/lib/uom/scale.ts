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

/**
 * What a quantity field keeps of typed text: digits and one decimal point, cut to the unit's
 * decimals, so a value the server would refuse cannot be entered. A comma counts as the point.
 * @param raw the typed text
 * @param qtyDecimals the unit's `qty_decimals`
 * @returns the text to keep
 * @example
 * typedQtyText('2,3755 kg', 3); // '2.375'
 */
export function typedQtyText(raw: string, qtyDecimals: number): string {
  const text = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const [int, ...rest] = text.split('.');
  return rest.length === 0 || qtyDecimals === 0 ? int : `${int}.${rest.join('').slice(0, qtyDecimals)}`;
}

/**
 * One keypad press on a quantity field, with the same rule as typing.
 * @param value the field's current text
 * @param key a digit, `.` or `backspace`
 * @param qtyDecimals the unit's `qty_decimals`
 * @returns the new text; unchanged when the key would add what the unit does not allow
 * @example
 * applyKeypadKey('2.3', '7', 1); // '2.3'
 */
export function applyKeypadKey(value: string, key: string, qtyDecimals: number): string {
  if (key === 'backspace') return value.slice(0, -1);
  if (key === '.') return qtyDecimals === 0 || value.includes('.') ? value : `${value || '0'}.`;
  return typedQtyText(value === '0' ? key : `${value}${key}`, qtyDecimals);
}
