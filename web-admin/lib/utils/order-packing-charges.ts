/**
 * Packing surcharge totals for New Order cart lines (mirror of `org_packing_preference_cf.extra_price`).
 */

import type { PackingPreference } from '@/lib/types/service-preferences';
import type { OrderItem } from '@features/orders/model/new-order-types';

export function packingPreferencePriceMap(
  prefs: Pick<PackingPreference, 'code' | 'default_extra_price'>[]
): Map<string, number> {
  return new Map(prefs.map((p) => [p.code, p.default_extra_price ?? 0]));
}

/** Sum packing surcharges per line: per-piece code (falling back to item code) when pieces exist; else item-level packing. */
export function orderItemLinePackingCharge(
  item: Pick<OrderItem, 'packingPrefCode' | 'pieces'>,
  priceByCode: Map<string, number>
): number {
  const pieces = item.pieces;
  if (!pieces?.length) {
    return item.packingPrefCode ? priceByCode.get(item.packingPrefCode) ?? 0 : 0;
  }
  let sum = 0;
  for (const p of pieces) {
    const code = p.packingPrefCode ?? item.packingPrefCode;
    if (code) sum += priceByCode.get(code) ?? 0;
  }
  return sum;
}
