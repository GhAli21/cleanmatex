/**
 * CmxUomSelect - picks a unit of measure from the Organization's units.
 * Takes the units as a prop (the caller loads them) so the shared UI stays free of data access.
 * Switched-off units are hidden unless one is the current value, so an old record still shows its unit.
 * @module ui/forms
 */
'use client';

import { useLocale } from 'next-intl';
import { CmxSelect } from '@ui/primitives/cmx-select';
import type { UomUnit } from '@/lib/types/uom';
import type { UomDimension } from '@/lib/constants/uom';

/** Props of {@link CmxUomSelect}. */
export interface CmxUomSelectProps {
  units: Pick<UomUnit, 'code' | 'name' | 'name2' | 'symbol' | 'symbol2' | 'dimension' | 'isActive'>[];
  value: string;
  onChange: (code: string) => void;
  /** Only units that measure this (e.g. MASS). */
  dimension?: UomDimension;
  placeholder?: string;
  label?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * @param props - {@link CmxUomSelectProps}
 * @returns A select listing `CODE — name (symbol)`
 */
export function CmxUomSelect({ units, value, onChange, dimension, ...rest }: CmxUomSelectProps) {
  const ar = useLocale() === 'ar';
  const options = units
    .filter((u) => (!dimension || u.dimension === dimension) && (u.isActive || u.code === value))
    .map((u) => ({
      value: u.code,
      label: `${u.code} — ${ar && u.name2 ? u.name2 : u.name} (${ar && u.symbol2 ? u.symbol2 : u.symbol})`,
    }));
  return <CmxSelect {...rest} value={value} options={options} onChange={(e) => onChange(e.target.value)} />;
}
