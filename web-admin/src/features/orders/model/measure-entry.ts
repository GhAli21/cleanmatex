/**
 * Entering a measure in another unit (lb on a kg product, feet on a rug, a product's own pack).
 * The typed figure is converted here into the product's unit and shown to staff before they save;
 * the order line stores the product's unit and the server prices that figure.
 * @module orders/model
 */
import { areaSideUnit, UOM_DIMENSIONS } from '@/lib/constants/uom';
import { MoneyDecimal, toMoney } from '@/lib/commercial/money';
import type { UomResolver } from '@/lib/uom/convert';
import type { UomUnit } from '@/lib/types/uom';
import type { OrderItemMeasure, OrderItemUom } from './new-order-types';

/** Decimals kept for a converted length or width (a tenth of a millimetre in metres). */
export const CONVERTED_LENGTH_DECIMALS = 4;

/** A unit staff may type in. */
export interface MeasureEntryUnit {
  code: string;
  symbol: string;
  symbol2: string | null;
  qtyDecimals: number;
  /** One of this unit in the line's unit (area lines: in the side unit). */
  rate: string;
}

/**
 * The units a measure can be typed in: first the line's own (area lines: the side unit, metres for m²
 * and feet for ft²), then every active unit that converts to it for this product. Area lines offer
 * length units only.
 * @param resolver the Organization's units and conversions, including the product's own
 * @param units the Organization's units
 * @param uom the measured line's unit
 * @param productId the product, so its own pairs apply
 * @returns at least the line's own unit once it is known; empty while it is not
 */
export function measureEntryUnits(
  resolver: UomResolver, units: readonly UomUnit[], uom: Pick<OrderItemUom, 'code' | 'dimension'>, productId?: string | null,
): MeasureEntryUnit[] {
  const isArea = uom.dimension === UOM_DIMENSIONS.AREA;
  const baseCode = isArea ? areaSideUnit(uom.code) : uom.code;
  const base = units.find((u) => u.code === baseCode);
  if (!base) return [];
  const others = units.flatMap((u) => {
    if (u.code === base.code || !u.isActive || (isArea && u.dimension !== UOM_DIMENSIONS.LENGTH)) return [];
    const rate = resolver.rate(u.code, base.code, productId);
    return rate ? [{ code: u.code, symbol: u.symbol, symbol2: u.symbol2, qtyDecimals: u.qtyDecimals, rate: rate.toString() }] : [];
  });
  return [{ code: base.code, symbol: base.symbol, symbol2: base.symbol2, qtyDecimals: base.qtyDecimals, rate: '1' }, ...others];
}

/**
 * Converts what was typed into the line's unit, rounded half-up. An empty or unfinished field
 * stays empty; a figure that rounds to nothing stays "0" so the dialog refuses it.
 * @param typed the fields as typed in the entry unit
 * @param rate the entry unit's {@link MeasureEntryUnit.rate}
 * @param qtyDecimals the line unit's decimals (single measure); lengths keep {@link CONVERTED_LENGTH_DECIMALS}
 * @returns the measure in the line's unit
 * @example convertMeasure({ measuredQty: '2', length: '', width: '' }, '0.45359237', 3).measuredQty; // '0.907'
 */
export function convertMeasure(typed: OrderItemMeasure, rate: string, qtyDecimals: number): OrderItemMeasure {
  const to = (text: string, decimals: number) => (Number(text) > 0
    ? toMoney(text).times(toMoney(rate)).toDecimalPlaces(decimals, MoneyDecimal.ROUND_HALF_UP).toString()
    : '');
  return {
    measuredQty: to(typed.measuredQty, qtyDecimals),
    length: to(typed.length, CONVERTED_LENGTH_DECIMALS),
    width: to(typed.width, CONVERTED_LENGTH_DECIMALS),
  };
}
