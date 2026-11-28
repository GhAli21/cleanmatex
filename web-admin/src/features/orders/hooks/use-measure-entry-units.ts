/** The units staff may type a product's measure in (see model/measure-entry). */
import { useMemo } from 'react';
import { useUomConversions } from '@features/uom/hooks/use-uom-conversions';
import { createUomResolver } from '@/lib/uom/convert';
import type { UomUnit } from '@/lib/types/uom';
import { measureEntryUnits, squareMetreRate, type MeasureEntryUnit } from '../model/measure-entry';
import type { OrderItemUom } from '../model/new-order-types';

/** What the measure window may offer. */
export interface MeasureEntryOptions {
  /** The units the measure (an area line: its size) may be typed in, the line's own first. */
  entryUnits: MeasureEntryUnit[];
  /** Area lines: one square metre in the line's unit; null = only the area itself can be typed. */
  areaRate: string | null;
}

const NONE: MeasureEntryOptions = { entryUnits: [], areaRate: null };

/**
 * Loads the conversions only while a measured product is being entered. Until they arrive (or if
 * the user may not read units) only the product's own unit is offered, so entry is never blocked.
 * @param units the Organization's units, already loaded by the order screen
 * @param productId the product being measured
 * @param uom its unit; undefined while no measure is being entered
 * @returns the entry units and, for an area line, the square-metre rate
 */
export function useMeasureEntryUnits(units: UomUnit[] | undefined, productId?: string | null, uom?: OrderItemUom): MeasureEntryOptions {
  const wanted = !!uom;
  const organization = useUomConversions(undefined, wanted);
  const product = useUomConversions(productId ?? undefined, wanted && !!productId);
  return useMemo(() => {
    if (!uom || !units) return NONE;
    const pairs = [...(organization.data ?? []), ...(productId ? product.data ?? [] : [])];
    const resolver = createUomResolver(units, pairs);
    return {
      entryUnits: measureEntryUnits(resolver, units, uom, productId),
      areaRate: squareMetreRate(resolver, units, uom, productId),
    };
  }, [units, uom, productId, organization.data, product.data]);
}
