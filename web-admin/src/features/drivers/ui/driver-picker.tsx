'use client';

import { useTranslations } from 'next-intl';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import type { OrgDriver } from '@/lib/types/drivers';

export const DRIVER_PICKER_UNASSIGNED_VALUE = '__unassigned__';

export interface DriverPickerProps {
  drivers: OrgDriver[];
  /** The selected driver id, or undefined/DRIVER_PICKER_UNASSIGNED_VALUE for none. */
  value?: string;
  onChange: (driverId: string | undefined) => void;
  disabled?: boolean;
  isLoading?: boolean;
  /** Show the unassigned/no-driver option. Defaults to true. */
  allowUnassigned?: boolean;
}

/**
 * Shared driver combobox — the one place a driver is picked, reused across
 * route creation and route reassignment. Flags a driver already running an
 * active route inline; picking them is still allowed (non-blocking warning,
 * surfaced again by the server response after selection).
 */
export function DriverPicker({ drivers, value, onChange, disabled, isLoading, allowUnassigned = true }: DriverPickerProps) {
  const t = useTranslations('drivers');

  const handleChange = (next: string) => {
    onChange(next === DRIVER_PICKER_UNASSIGNED_VALUE ? undefined : next);
  };

  const selected = drivers.find((d) => d.id === value);

  return (
    <CmxSelectDropdown
      value={value ?? DRIVER_PICKER_UNASSIGNED_VALUE}
      onValueChange={handleChange}
      disabled={disabled}
      isLoading={isLoading}
      emptyLabel={t('picker.empty')}
      loadingLabel={t('picker.loading')}
    >
      <CmxSelectDropdownTrigger aria-label={t('picker.label')}>
        <CmxSelectDropdownValue
          placeholder={t('picker.placeholder')}
          displayValue={selected ? selected.name : undefined}
        />
      </CmxSelectDropdownTrigger>
      <CmxSelectDropdownContent>
        {allowUnassigned && (
          <CmxSelectDropdownItem value={DRIVER_PICKER_UNASSIGNED_VALUE}>
            {t('picker.unassigned')}
          </CmxSelectDropdownItem>
        )}
        {drivers.map((driver) => (
          <CmxSelectDropdownItem key={driver.id} value={driver.id}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate">{driver.name}</span>
              {driver.hasActiveRoute && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {t('picker.onRoute')}
                </span>
              )}
            </span>
          </CmxSelectDropdownItem>
        ))}
      </CmxSelectDropdownContent>
    </CmxSelectDropdown>
  );
}
