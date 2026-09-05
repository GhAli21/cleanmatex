'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CmxInput } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { CmxStatusBadge } from '@ui/feedback';
import type { OrgDriver } from '@/lib/types/drivers';

/**
 * Internal select value representing an intentionally unassigned route.
 * It cannot collide with persisted UUID driver identifiers and is converted to
 * `undefined` before the selection leaves this UI component.
 */
export const DRIVER_PICKER_UNASSIGNED_VALUE = '__unassigned__';

/**
 * Inputs for the shared, tenant-provided driver selection control.
 * Callers retain assignment authority; this component only communicates the
 * selected driver identifier or an explicit unassigned choice.
 */
export interface DriverPickerProps {
  drivers: OrgDriver[];
  /** The selected driver id, or undefined/DRIVER_PICKER_UNASSIGNED_VALUE for none. */
  value?: string;
  /** Receives a driver ID, or `undefined` when the operator chooses unassigned. */
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
  const [query, setQuery] = useState('');

  const matchingDrivers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return drivers;

    return drivers.filter((driver) =>
      [driver.name, driver.name2, driver.phone, driver.vehicle_plate_no]
        .filter((candidate): candidate is string => Boolean(candidate))
        .some((candidate) => candidate.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [drivers, query]);

  const handleChange = (next: string) => {
    onChange(next === DRIVER_PICKER_UNASSIGNED_VALUE ? undefined : next);
  };

  const selected = drivers.find((driver) => driver.id === value);
  const selectedLabel = selected
    ? [selected.name, selected.phone].filter(Boolean).join(' · ')
    : undefined;

  return (
    <div className="space-y-2">
      <CmxInput
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        label={t('picker.searchLabel')}
        placeholder={t('picker.searchPlaceholder')}
        leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
        disabled={disabled || isLoading}
      />
      <CmxSelectDropdown
        value={value ?? DRIVER_PICKER_UNASSIGNED_VALUE}
        onValueChange={handleChange}
        disabled={disabled}
        isLoading={isLoading}
        emptyLabel={query ? t('picker.noMatches') : t('picker.empty')}
        loadingLabel={t('picker.loading')}
      >
        <CmxSelectDropdownTrigger aria-label={t('picker.label')}>
          <CmxSelectDropdownValue
            placeholder={t('picker.placeholder')}
            displayValue={selectedLabel}
          />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          {allowUnassigned && (
            <CmxSelectDropdownItem value={DRIVER_PICKER_UNASSIGNED_VALUE}>
              {t('picker.unassigned')}
            </CmxSelectDropdownItem>
          )}
          {matchingDrivers.map((driver) => (
            <CmxSelectDropdownItem key={driver.id} value={driver.id}>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="min-w-0 text-start">
                  <span className="block truncate font-medium">{driver.name}</span>
                  {(driver.phone || driver.vehicle_plate_no) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[driver.phone, driver.vehicle_plate_no].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {driver.hasActiveRoute && (
                  <CmxStatusBadge label={t('picker.onRoute')} variant="warning" size="sm" />
                )}
              </span>
            </CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
      {selected?.hasActiveRoute && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('picker.activeRouteWarning')}
        </p>
      )}
    </div>
  );
}
