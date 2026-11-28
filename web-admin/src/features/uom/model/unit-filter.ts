/** Search and filters of the Units tab. The list is small (tens of rows), so it filters in the browser. */
import type { UomDimension } from '@/lib/constants/uom';
import type { UomUnit } from '@/lib/types/uom';

/** What the Units tab is narrowed by; empty strings mean "all". */
export interface UnitFilter {
  search: string;
  dimension: UomDimension | '';
  status: 'active' | 'inactive' | '';
}

/** No narrowing. */
export const NO_UNIT_FILTER: UnitFilter = { search: '', dimension: '', status: '' };

/**
 * @param units the Organization's units
 * @param filter search text (code, names, symbols, UN/ECE code; either language), dimension and on/off
 * @returns the matching units, in their original order
 * @example filterUnits(units, { search: 'kil', dimension: '', status: 'active' });
 */
export function filterUnits(units: readonly UomUnit[], filter: UnitFilter): UomUnit[] {
  const needle = filter.search.trim().toLocaleLowerCase();
  return units.filter((u) =>
    (!filter.dimension || u.dimension === filter.dimension)
    && (!filter.status || u.isActive === (filter.status === 'active'))
    && (!needle || [u.code, u.name, u.name2, u.symbol, u.symbol2, u.uneceCode]
      .some((text) => text?.toLocaleLowerCase().includes(needle))));
}
