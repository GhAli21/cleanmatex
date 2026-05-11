/**
 * PackingPreferenceSelector
 * Single-select for packing preference (hang, fold, box, etc.)
 * Gated by packing_preferences_enabled feature flag when available.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useBilingual } from '@/lib/utils/bilingual';
import type { PackingPreference } from '@/lib/types/service-preferences';

interface PackingPreferenceSelectorProps {
  value: string | undefined;
  availablePrefs: PackingPreference[];
  onChange: (code: string | undefined, packingCfId?: string | null) => void;
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
  const { formatMoneyWithCode } = useTenantCurrency();

  if (availablePrefs.length === 0) return null;

  const options = [
    { value: '', label: t('none') || 'None' },
    ...availablePrefs.map((pref) => {
      const name = getBilingual(pref.name, pref.name2 ?? null) || pref.code;
      const extra = Number(pref.default_extra_price ?? 0);
      const label =
        extra > 0 && Number.isFinite(extra) ? `${name} +${formatMoneyWithCode(extra)}` : name;
      return { value: pref.code, label };
    }),
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        {t('packingPref') || 'Packing'}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) {
            onChange(undefined, undefined);
            return;
          }
          const pref = availablePrefs.find((p) => p.code === raw);
          onChange(raw, pref?.packing_cf_id ?? null);
        }}
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
