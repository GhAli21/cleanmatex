/**
 * CmxUomSelect - picks a unit of measure from the Organization's units: searchable by code, name or
 * symbol in either language, grouped by what the unit measures, custom and customized units tagged.
 * Takes the units as a prop (the caller loads them) so the shared UI stays free of data access.
 * Switched-off units are hidden unless one is the current value, so an old record still shows its unit.
 * @module ui/forms
 */
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CmxCombobox } from './cmx-combobox';
import { UOM_DIMENSION_ORDER, type UomDimension } from '@/lib/constants/uom';
import type { UomUnit } from '@/lib/types/uom';

/** A unit the picker can list. */
export type CmxUomSelectUnit = Pick<UomUnit, 'code' | 'name' | 'name2' | 'symbol' | 'symbol2' | 'dimension' | 'isActive'>
  & Partial<Pick<UomUnit, 'origin'>>;

/** Props of {@link CmxUomSelect}. */
export interface CmxUomSelectProps {
  units: readonly CmxUomSelectUnit[];
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
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * @param props - {@link CmxUomSelectProps}
 * @returns A searchable list of `CODE — name (symbol)`, grouped by dimension
 */
export function CmxUomSelect({ units, dimension, ...rest }: CmxUomSelectProps) {
  const ar = useLocale() === 'ar';
  const t = useTranslations('uom');
  const options = units
    .filter((u) => (!dimension || u.dimension === dimension) && (u.isActive || u.code === rest.value))
    // Stable sort: the Organization's own order is kept inside each group.
    .sort((a, b) => UOM_DIMENSION_ORDER.indexOf(a.dimension) - UOM_DIMENSION_ORDER.indexOf(b.dimension))
    .map((u) => ({
      value: u.code,
      label: `${u.code} — ${ar && u.name2 ? u.name2 : u.name} (${ar && u.symbol2 ? u.symbol2 : u.symbol})`,
      keywords: `${u.name} ${u.name2 ?? ''} ${u.symbol} ${u.symbol2 ?? ''}`,
      group: t(`dimensions.${u.dimension}`),
      badge: u.origin && u.origin !== 'SYSTEM' ? t(`origin.${u.origin}`) : undefined,
    }));
  return <CmxCombobox {...rest} options={options} />;
}
