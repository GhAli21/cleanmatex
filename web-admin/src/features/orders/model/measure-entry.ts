/**
 * Entering a measure in another unit (lb on a kg product, a product's own pack) and an area as a size
 * (length × width in any length unit). The typed figures are converted here and shown to staff before
 * they save; the order line stores the measure in the product's unit (an area line also keeps the size
 * in metres) and the server prices that measure.
 * @module orders/model
 */
import { QUANTITY_DECIMALS, UOM_DIMENSIONS } from '@/lib/constants/uom';
import { MoneyDecimal, toMoney } from '@/lib/commercial/money';
import type { UomResolver } from '@/lib/uom/convert';
import type { UomUnit } from '@/lib/types/uom';
import type { OrderItemMeasure, OrderItemUom } from './new-order-types';

/** A unit staff may type in. */
export interface MeasureEntryUnit {
  code: string;
  symbol: string;
  symbol2: string | null;
  qtyDecimals: number;
  /** One of this unit in the line's unit (an area line's size: in metres). */
  rate: string;
}

const baseOf = (units: readonly UomUnit[], dimension: string) => units.find((u) => u.dimension === dimension && u.isBaseUnit);

/**
 * The units a measure can be typed in: first the line's own (an area line's size: metres), then every
 * active unit that converts to it for this product. An area line's size is typed in length units.
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
  const base = isArea ? baseOf(units, UOM_DIMENSIONS.LENGTH) : units.find((u) => u.code === uom.code);
  if (!base) return [];
  const others = units.flatMap((u) => {
    if (u.code === base.code || !u.isActive || (isArea && u.dimension !== UOM_DIMENSIONS.LENGTH)) return [];
    const rate = resolver.rate(u.code, base.code, productId);
    return rate ? [{ code: u.code, symbol: u.symbol, symbol2: u.symbol2, qtyDecimals: u.qtyDecimals, rate: rate.toString() }] : [];
  });
  return [{ code: base.code, symbol: base.symbol, symbol2: base.symbol2, qtyDecimals: base.qtyDecimals, rate: '1' }, ...others];
}

/**
 * One square metre in an area line's unit, so a size in metres gives the area.
 * @param resolver the Organization's units and conversions
 * @param units the Organization's units
 * @param uom the area line's unit
 * @param productId the product, so its own pairs apply
 * @returns the rate, or null when the unit has no path to square metres (then only the area can be typed)
 * @example squareMetreRate(resolver, units, { code: 'SQFT', dimension: 'AREA' }); // '10.76391041671'
 */
export function squareMetreRate(
  resolver: UomResolver, units: readonly UomUnit[], uom: Pick<OrderItemUom, 'code' | 'dimension'>, productId?: string | null,
): string | null {
  if (uom.dimension !== UOM_DIMENSIONS.AREA) return null;
  const base = baseOf(units, UOM_DIMENSIONS.AREA);
  if (!base) return null;
  return base.code === uom.code ? '1' : resolver.rate(base.code, uom.code, productId)?.toString() ?? null;
}

/**
 * Converts a single typed measure into the line's unit, rounded half-up. An empty or unfinished field
 * stays empty; a figure that rounds to nothing stays "0" so the dialog refuses it.
 * @param typed the measure as typed in the entry unit
 * @param rate the entry unit's {@link MeasureEntryUnit.rate}
 * @param qtyDecimals the line unit's decimals
 * @returns the measure in the line's unit
 * @example convertMeasure({ measuredQty: '2', length: '', width: '' }, '0.45359237', 3).measuredQty; // '0.907'
 */
export function convertMeasure(typed: OrderItemMeasure, rate: string, qtyDecimals: number): OrderItemMeasure {
  return {
    measuredQty: Number(typed.measuredQty) > 0
      ? toMoney(typed.measuredQty).times(toMoney(rate)).toDecimalPlaces(qtyDecimals, MoneyDecimal.ROUND_HALF_UP).toString()
      : '',
    length: '',
    width: '',
  };
}

/**
 * An area line's measure from a typed size: length and width in metres (6 decimals, exact for every
 * system length unit at its own decimals) and the area in the line's unit, rounded half-up.
 * @param typed length and width as typed in the entry unit
 * @param lengthRate one entry unit in metres
 * @param areaRate {@link squareMetreRate}
 * @param qtyDecimals the area unit's decimals
 * @returns the measure; the area stays empty until both sides are typed
 * @example sizeMeasure({ measuredQty: '', length: '2', width: '3' }, '1', '1.195990046301', 2).measuredQty; // '7.18'
 */
export function sizeMeasure(typed: OrderItemMeasure, lengthRate: string, areaRate: string, qtyDecimals: number): OrderItemMeasure {
  const metres = (text: string) => (Number(text) > 0
    ? toMoney(text).times(toMoney(lengthRate)).toDecimalPlaces(QUANTITY_DECIMALS, MoneyDecimal.ROUND_HALF_UP)
    : null);
  const length = metres(typed.length);
  const width = metres(typed.width);
  return {
    length: length?.toString() ?? '',
    width: width?.toString() ?? '',
    measuredQty: length && width
      ? length.times(width).times(toMoney(areaRate)).toDecimalPlaces(qtyDecimals, MoneyDecimal.ROUND_HALF_UP).toString()
      : '',
  };
}
