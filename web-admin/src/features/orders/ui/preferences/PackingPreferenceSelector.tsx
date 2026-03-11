/**
 * PackingPreferenceSelector
 * Single-select for packing preference (hang, fold, box, etc.)
 * Gated by packing_preferences_enabled feature flag when available.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useBilingual } from '@/lib/utils/bilingual';
import type { PackingPreference } from '@/lib/types/service-preferences';

interface PackingPreferenceSelectorProps {
  value: string | undefined;
  availablePrefs: PackingPreference[];
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function PackingPreferenceSelector({
  value,
  availablePrefs,
  onChange,
  disabled = false,
}: PackingPreferenceSelectorProps) {
  const t = useTranslations('newOrder.preferences');
  const getBilingual = useBilingual();

  if (availablePrefs.length === 0) return null;

  const options = [
    { value: '', label: t('none') || 'None' },
    ...availablePrefs.map((pref) => ({
      value: pref.code,
      label: getBilingual(pref.name, pref.name2) || pref.code,
    })),
  ];

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-gray-600 block">
        {t('packingPref') || 'Packing'}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-w-[100px] px-2 py-1.5 text-[11px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt.value || 'none'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
