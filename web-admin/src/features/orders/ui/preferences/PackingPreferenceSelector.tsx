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
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        {t('packingPref') || 'Packing'}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-w-[160px] rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
