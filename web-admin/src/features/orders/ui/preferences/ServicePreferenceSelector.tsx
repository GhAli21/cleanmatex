/**
 * ServicePreferenceSelector
 * Multi-select for service preferences (starch, perfume, delicate, etc.)
 * Gated by service_preferences_enabled feature flag when available.
 * Conflict resolution: uses is_incompatible_with; enforceCompatibility blocks or warns.
 */

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useBilingual } from '@/lib/utils/bilingual';
import { CmxCheckbox } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import type { OrderItemServicePref } from '../../model/new-order-types';
import type { ServicePreference } from '@/lib/types/service-preferences';

interface ServicePreferenceSelectorProps {
  selectedPrefs: OrderItemServicePref[];
  availablePrefs: ServicePreference[];
  onChange: (prefs: OrderItemServicePref[], totalCharge: number) => void;
  disabled?: boolean;
  maxPrefs?: number;
  /** When true, block incompatible prefs; when false, warn only. SERVICE_PREF_ENFORCE_COMPATIBILITY */
  enforceCompatibility?: boolean;
}

function isIncompatibleWith(
  code: string,
  selectedCodes: Set<string>,
  availablePrefs: ServicePreference[]
): string | null {
  const pref = availablePrefs.find((p) => p.code === code);
  const incompatible = pref?.is_incompatible_with;
  if (!incompatible?.length) return null;
  for (const c of selectedCodes) {
    if (incompatible.includes(c)) return c;
  }
  return null;
}

export function ServicePreferenceSelector({
  selectedPrefs,
  availablePrefs,
  onChange,
  disabled = false,
  maxPrefs = 5,
  enforceCompatibility = false,
}: ServicePreferenceSelectorProps) {
  const t = useTranslations('newOrder.preferences');
  const getBilingual = useBilingual();

  const selectedCodes = useMemo(
    () => new Set(selectedPrefs.map((p) => p.preference_code)),
    [selectedPrefs]
  );

  const handleToggle = (pref: ServicePreference, checked: boolean) => {
    if (checked) {
      const conflict = isIncompatibleWith(pref.code, selectedCodes, availablePrefs);
      if (conflict) {
        const conflictName = getBilingual(
          availablePrefs.find((p) => p.code === conflict)?.name,
          availablePrefs.find((p) => p.code === conflict)?.name2
        ) || conflict;
        const msg = t('incompatiblePref', { name: conflictName }) || `Incompatible with ${conflictName}`;
        cmxMessage.warning(msg);
        if (enforceCompatibility) return; // Block when enforce; else warn and continue
      }
      if (selectedPrefs.length >= maxPrefs) return;
    }

    const extraPrice = Number(pref.default_extra_price ?? 0);
    let newPrefs: OrderItemServicePref[];

    if (checked) {
      newPrefs = [
        ...selectedPrefs,
        {
          preference_code: pref.code,
          source: 'manual',
          extra_price: extraPrice,
        },
      ];
    } else {
      newPrefs = selectedPrefs.filter((p) => p.preference_code !== pref.code);
    }

    const totalCharge = newPrefs.reduce((sum, p) => sum + p.extra_price, 0);
    onChange(newPrefs, totalCharge);
  };

  if (availablePrefs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-medium text-gray-600 block">
        {t('servicePrefs') || 'Service preferences'}
      </span>
      <div className="flex flex-wrap gap-2">
        {availablePrefs.map((pref) => {
          const isChecked = selectedCodes.has(pref.code);
          const isDisabled =
            disabled || (!isChecked && selectedPrefs.length >= maxPrefs);
          const label = getBilingual(pref.name, pref.name2) || pref.code;
          const extraPrice = Number(pref.default_extra_price ?? 0);
          return (
            <label
              key={pref.code}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] cursor-pointer ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
              } ${isChecked ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            >
              <CmxCheckbox
                checked={isChecked}
                onChange={(e) => handleToggle(pref, e.target.checked)}
                disabled={isDisabled}
              />
              <span>{label}</span>
              {extraPrice > 0 && (
                <span className="text-gray-500 text-[10px]">
                  +{extraPrice.toFixed(3)}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
