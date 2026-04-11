/**
 * ServicePreferenceSelector
 * Multi-select for service preferences (starch, perfume, delicate, etc.)
 * Gated by service_preferences_enabled feature flag when available.
 * Conflict resolution: uses is_incompatible_with; enforceCompatibility blocks or warns.
 *
 * Enhancements:
 * - Group by preference_category (washing, processing, finishing)
 * - Show extra_turnaround_minutes (e.g. "+3h")
 * - Show sustainability_score (eco points) when relevant
 * - Use icons from catalog or default icons
 */

'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useBilingual } from '@/lib/utils/bilingual';
import {
  Snowflake,
  Sparkles,
  Droplets,
  Heart,
  Flame,
  Shield,
  Hand,
  Ban,
  Leaf,
  type LucideIcon,
} from 'lucide-react';
import { CmxCheckbox } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import type { OrderItemServicePref } from '../../model/new-order-types';
import type { ServicePreference } from '@/lib/types/service-preferences';
import {
  SERVICE_PREF_DEFAULT_ICONS,
  SERVICE_PREF_CATEGORY_ICONS,
} from '@/lib/constants/service-preferences';

interface ServicePreferenceSelectorProps {
  selectedPrefs: OrderItemServicePref[];
  availablePrefs: ServicePreference[];
  onChange: (prefs: OrderItemServicePref[], totalCharge: number) => void;
  disabled?: boolean;
  maxPrefs?: number;
  /** When true, block incompatible prefs; when false, warn only. SERVICE_PREF_ENFORCE_COMPATIBILITY */
  enforceCompatibility?: boolean;
}

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Snowflake,
  Sparkles,
  Droplets,
  Heart,
  Flame,
  Shield,
  Hand,
  Ban,
  Leaf,
};

function getPrefIcon(pref: ServicePreference): LucideIcon | null {
  const iconName =
    pref.icon ||
    SERVICE_PREF_DEFAULT_ICONS[pref.code] ||
    SERVICE_PREF_CATEGORY_ICONS[pref.preference_category || 'processing'];
  if (!iconName || typeof iconName !== 'string') return null;
  return LUCIDE_ICON_MAP[iconName] ?? null;
}

function formatExtraTime(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    return `+${h}h`;
  }
  return `+${minutes}m`;
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

const CATEGORY_ORDER: Array<'washing' | 'processing' | 'finishing'> = [
  'washing',
  'processing',
  'finishing',
];

export function ServicePreferenceSelector({
  selectedPrefs,
  availablePrefs,
  onChange,
  disabled = false,
  maxPrefs = 5,
  enforceCompatibility = false,
}: ServicePreferenceSelectorProps) {
  const t = useTranslations('newOrder.preferences');
  const locale = useLocale();
  const { formatMoneyWithCode } = useTenantCurrency();
  const getBilingual = useBilingual();

  const selectedCodes = useMemo(
    () => new Set(selectedPrefs.map((p) => p.preference_code)),
    [selectedPrefs]
  );

  const groupedPrefs = useMemo(() => {
    const groups: Record<string, ServicePreference[]> = {
      washing: [],
      processing: [],
      finishing: [],
    };
    for (const pref of availablePrefs) {
      const cat = pref.preference_category || 'processing';
      if (groups[cat]) groups[cat].push(pref);
    }
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      prefs: groups[cat] || [],
    })).filter((g) => g.prefs.length > 0);
  }, [availablePrefs]);

  const handleToggle = (pref: ServicePreference, checked: boolean) => {
    if (checked) {
      const conflict = isIncompatibleWith(pref.code, selectedCodes, availablePrefs);
      if (conflict) {
        const conflictName =
          getBilingual(
            availablePrefs.find((p) => p.code === conflict)?.name,
            availablePrefs.find((p) => p.code === conflict)?.name2
          ) || conflict;
        const msg =
          t('incompatiblePref', { name: conflictName }) ||
          `Incompatible with ${conflictName}`;
        cmxMessage.warning(msg);
        if (enforceCompatibility) return;
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
    <div className="space-y-4">
      <span className="block text-sm font-semibold text-gray-700">
        {t('servicePrefs') || 'Service preferences'}
      </span>
      {groupedPrefs.map(({ category, prefs }) => (
        <section key={category} className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {t(`category${category.charAt(0).toUpperCase() + category.slice(1)}`) ||
              category}
          </span>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {prefs.map((pref) => {
              const isChecked = selectedCodes.has(pref.code);
              const isDisabled =
                disabled || (!isChecked && selectedPrefs.length >= maxPrefs);
              const label = getBilingual(pref.name, pref.name2) || pref.code;
              const extraPrice = Number(pref.default_extra_price ?? 0);
              const extraMins = pref.extra_turnaround_minutes ?? 0;
              const ecoScore = pref.sustainability_score ?? 0;
              const IconComponent = getPrefIcon(pref);

              return (
                <label
                  key={pref.code}
                  className={`flex min-h-16 items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                    isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/40'
                  } ${isChecked ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white'}`}
                >
                  <CmxCheckbox
                    checked={isChecked}
                    onChange={(e) => handleToggle(pref, e.target.checked)}
                    disabled={isDisabled}
                  />
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    {IconComponent && (
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                        <IconComponent className="h-4 w-4 shrink-0" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="block text-sm font-medium leading-5 text-gray-900">
                        {label}
                      </span>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {extraPrice > 0 && (
                          <span
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600"
                            lang={locale === 'ar' ? 'ar' : 'en'}
                          >
                            +{formatMoneyWithCode(extraPrice)}
                          </span>
                        )}
                        {extraMins > 0 && (
                          <span
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700"
                            title={
                              t('extraTimeTooltip') ||
                              'Adds time to ready-by estimate'
                            }
                          >
                            {formatExtraTime(extraMins)}
                          </span>
                        )}
                        {ecoScore > 0 && (
                          <span
                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"
                            title={t('ecoPoints') || 'Eco-friendly'}
                          >
                            🌱 +{ecoScore}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
