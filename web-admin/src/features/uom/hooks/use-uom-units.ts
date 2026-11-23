/** Query for the Organization's units; shared by the Units page, pickers and the Measure dialog. */
import { useQuery } from '@tanstack/react-query';
import { uomApi } from '../api/uom-api';

export const UOM_UNITS_KEY = ['uom', 'units'] as const;

/**
 * Loads the Organization's units.
 * @param activeOnly false also returns switched-off units (the Units page)
 */
export function useUomUnits(activeOnly = true) {
  return useQuery({ queryKey: [...UOM_UNITS_KEY, activeOnly], queryFn: () => uomApi.listUnits(activeOnly), staleTime: 5 * 60_000 });
}
