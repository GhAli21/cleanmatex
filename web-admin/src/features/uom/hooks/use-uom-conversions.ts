/** Queries for an Organization's conversions; shared by the conversion screens and the Measure dialog. */
import { useQuery } from '@tanstack/react-query';
import { uomApi } from '../api/uom-api';

/** Cache key of one scope: a product's own pairs, or the Organization-wide ones. */
export const uomConversionsKey = (productId?: string) => ['uom', 'conversions', productId ?? 'organization'] as const;

/**
 * Loads one scope of conversions.
 * @param productId the product, or undefined for the Organization-wide pairs
 * @param enabled false skips the request
 */
export function useUomConversions(productId?: string, enabled = true) {
  return useQuery({
    queryKey: uomConversionsKey(productId),
    queryFn: () => uomApi.listConversions(productId),
    enabled,
    staleTime: 5 * 60_000,
  });
}
