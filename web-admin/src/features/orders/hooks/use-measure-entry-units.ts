/** The units staff may type a product's measure in (see model/measure-entry). */
import { useMemo } from 'react';
import { useUomConversions } from '@features/uom/hooks/use-uom-conversions';
import { createUomResolver } from '@/lib/uom/convert';
import type { UomUnit } from '@/lib/types/uom';
import { measureEntryUnits, type MeasureEntryUnit } from '../model/measure-entry';
import type { OrderItemUom } from '../model/new-order-types';

/**
 * Loads the conversions only while a measured product is being entered. Until they arrive (or if
 * the user may not read units) only the product's own unit is offered, so entry is never blocked.
 * @param units the Organization's units, already loaded by the order screen
 * @param productId the product being measured
 * @param uom its unit; undefined while no measure is being entered
 * @returns the entry units, the product's own first
 */
export function useMeasureEntryUnits(units: UomUnit[] | undefined, productId?: string | null, uom?: OrderItemUom): MeasureEntryUnit[] {
  const wanted = !!uom;
  const organization = useUomConversions(undefined, wanted);
  const product = useUomConversions(productId ?? undefined, wanted && !!productId);
  return useMemo(() => {
    if (!uom || !units) return [];
    const pairs = [...(organization.data ?? []), ...(productId ? product.data ?? [] : [])];
    return measureEntryUnits(createUomResolver(units, pairs), units, uom, productId);
  }, [units, uom, productId, organization.data, product.data]);
}
