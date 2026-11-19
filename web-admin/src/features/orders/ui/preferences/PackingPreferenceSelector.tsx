/**
 * PackingPreferenceSelector
 * Single-select for packing preference (hang, fold, box, etc.)
 * Gated by packing_preferences_enabled feature flag when available.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useBilingual } from '@/lib/utils/bilingual';
import { CmxSelect, Label } from '@ui/primitives';
import type { PackingPreference } from '@/lib/types/service-preferences';

interface PackingPreferenceSelectorProps {
  value: string | undefined;
  availablePrefs: PackingPreference[];
  onChange: (code: string | undefined, packingCfId?: string | null) => void;
  disabled?: boolean;
}

/**
 *
 * @param root0
 * @param root0.value
 * @param root0.availablePrefs
 * @param root0.onChange
 * @param root0.disabled
 */
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
      <Label className="block text-sm font-semibold text-foreground">
        {t('packingPref') || 'Packing'}
      </Label>
      <CmxSelect
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
        className="min-w-[160px] rounded-xl"
        options={options}
      />
    </div>
  );
}
