/**
 * LevelPreferenceCard — reusable "kind toolbar + dialog picker + chips" preference
 * entry for a non-piece scope (ORDER or ITEM). Mirrors PiecePreferenceCard's proven
 * interaction pattern (see piece-preferences/piece-preference-card.tsx) instead of
 * duplicating it — reuses the same PieceKindPickerDialog (already generic, takes
 * plain callbacks, not a piece object) and PreferenceChip.
 *
 * Why not reuse PiecePreferenceCard directly: it's typed around PreSubmissionPiece
 * (colors, conditions, copy-to-sibling-pieces) which don't apply at order/item
 * scope. This card only ever supports the kinds the caller passes in via
 * `preferenceKinds` — the caller decides what's applicable at each level.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useBilingual } from '@/lib/utils/bilingual';
import { useRTL } from '@/lib/hooks/useRTL';
import { PREFERENCE_MAIN_TYPES } from '@/lib/types/service-preferences';
import type { PackingPreference, PreferenceKind, ServicePreference } from '@/lib/types/service-preferences';
import type { OrderItemServicePref } from '@/src/features/orders/model/new-order-types';
import { PreferenceChip } from '../piece-preferences/preference-chip';
import { PieceKindPickerDialog } from '../piece-preferences/piece-kind-picker-dialog';
import {
  kindChipAccentStyle,
  kindToolbarInactiveSurface,
  parseKindBgHex,
  isTailwindKindBgToken,
} from '../piece-preferences/piece-pref-kind-styles';

function chipFallbackClass(kind: string): string | undefined {
  if (kind === 'service_prefs') return 'border-blue-200 bg-blue-50 text-blue-900';
  if (kind === 'packing_prefs') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return undefined;
}

function tailwindKindTokenClass(kindBg: string | null | undefined): string | undefined {
  if (!kindBg || !isTailwindKindBgToken(kindBg)) return undefined;
  return kindBg.trim();
}

interface LevelChip {
  id: string;
  kindCode: 'service_prefs' | 'packing_prefs';
  label: string;
  extraPrice: number;
}

/**
 *
 */
export interface LevelPreferenceCardProps {
  title: string;
  servicePrefs: OrderItemServicePref[];
  /** Omit when packing isn't applicable at this level (no `onPackingChange` supplied). */
  packingPrefCode?: string;
  /** Pre-filtered by the caller to the kinds applicable at this level (see PreferencesTabsSection). */
  preferenceKinds: PreferenceKind[];
  prefsByKind: Map<string, ServicePreference[]>;
  packingPrefs: PackingPreference[];
  servicePrefsFallback: ServicePreference[];
  currencyCode: string;
  kindsLoading: boolean;
  enforcePrefCompatibility?: boolean;
  onServicePrefsChange: (prefs: OrderItemServicePref[], charge: number) => void;
  /** Presence gates whether the packing_prefs kind can actually be used, independent of `preferenceKinds` filtering. */
  onPackingChange?: (code: string | undefined, packingCfId?: string | null) => void;
  /** Omit the card's own border/heading when nesting inside an already-titled/bordered container (e.g. an item row). */
  bare?: boolean;
}

const EMPTY_PREFS: OrderItemServicePref[] = [];

/**
 *
 * @param root0
 * @param root0.title
 * @param root0.servicePrefs
 * @param root0.packingPrefCode
 * @param root0.packingCfId
 * @param root0.preferenceKinds
 * @param root0.prefsByKind
 * @param root0.packingPrefs
 * @param root0.servicePrefsFallback
 * @param root0.currencyCode
 * @param root0.kindsLoading
 * @param root0.enforcePrefCompatibility
 * @param root0.onServicePrefsChange
 * @param root0.onPackingChange
 */
export function LevelPreferenceCard({
  title,
  servicePrefs,
  packingPrefCode,
  preferenceKinds,
  prefsByKind,
  packingPrefs,
  servicePrefsFallback,
  currencyCode,
  kindsLoading,
  enforcePrefCompatibility = false,
  onServicePrefsChange,
  onPackingChange,
  bare = false,
}: LevelPreferenceCardProps) {
  const t = useTranslations('newOrder.piecePreferences');
  const getBilingual = useBilingual();
  const isRTL = useRTL();
  const [pickerKind, setPickerKind] = useState<PreferenceKind | null>(null);

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of servicePrefsFallback) {
      m.set(p.code, getBilingual(p.name, p.name2 ?? null) || p.code);
    }
    for (const p of packingPrefs) {
      m.set(p.code, getBilingual(p.name, p.name2 ?? null) || p.code);
    }
    return m;
  }, [servicePrefsFallback, packingPrefs, getBilingual]);

  const kindsForBar = useMemo(
    () =>
      preferenceKinds
        .filter((k) => k.is_active && k.main_type_code === PREFERENCE_MAIN_TYPES.PREFERENCES)
        .filter((k) => k.kind_code !== 'packing_prefs' || !!onPackingChange)
        .sort((a, b) => (a.rec_order ?? 0) - (b.rec_order ?? 0)),
    [preferenceKinds, onPackingChange]
  );

  const kindVisualByCode = useMemo(() => {
    const m = new Map<string, { hex: string | null; tw?: string }>();
    for (const k of kindsForBar) {
      const tw = tailwindKindTokenClass(k.kind_bg_color);
      const hex = tw ? null : parseKindBgHex(k.kind_bg_color);
      m.set(k.kind_code, { hex, tw });
    }
    return m;
  }, [kindsForBar]);

  const chips = useMemo<LevelChip[]>(() => {
    const out: LevelChip[] = [];
    for (const sp of servicePrefs) {
      out.push({
        id: `service_prefs:${sp.preference_code}`,
        kindCode: 'service_prefs',
        label: nameByCode.get(sp.preference_code) ?? sp.preference_code,
        extraPrice: Number(sp.extra_price ?? 0),
      });
    }
    if (packingPrefCode) {
      const packExtra = packingPrefs.find((p) => p.code === packingPrefCode)?.default_extra_price ?? 0;
      out.push({
        id: `packing_prefs:${packingPrefCode}`,
        kindCode: 'packing_prefs',
        label: nameByCode.get(packingPrefCode) ?? packingPrefCode,
        extraPrice: Number(packExtra),
      });
    }
    return out;
  }, [servicePrefs, packingPrefCode, packingPrefs, nameByCode]);

  const prefsForPicker = pickerKind ? prefsByKind.get(pickerKind.kind_code) ?? [] : [];

  const chipPresentation = (kindCode: string) => {
    const v = kindVisualByCode.get(kindCode);
    const hex = v?.hex ?? null;
    const tw = v?.tw;
    const style = kindChipAccentStyle(hex);
    const tailClass = tw || (!hex && !tw ? chipFallbackClass(kindCode) : undefined);
    return { style, className: tailClass };
  };

  const removeChip = (chip: LevelChip) => {
    if (chip.kindCode === 'service_prefs') {
      const next = servicePrefs.filter((p) => p.preference_code !== chip.id.slice('service_prefs:'.length));
      const charge = next.reduce((sum, p) => sum + (p.extra_price ?? 0), 0);
      onServicePrefsChange(next, charge);
    } else if (chip.kindCode === 'packing_prefs') {
      onPackingChange?.(undefined);
    }
  };

  return (
    <div
      className={cn(
        !bare && 'rounded-xl border border-slate-300/80 bg-white p-3 shadow-sm ring-1 ring-slate-200/60'
      )}
    >
      {title && (
        <h3 className={cn('text-sm font-semibold leading-snug text-slate-900 mb-2', isRTL ? 'text-right' : 'text-left')}>
          {title}
        </h3>
      )}

      <div
        className="rounded-xl border border-slate-200 bg-slate-100/95 p-1.5 shadow-inner"
        role="toolbar"
        aria-label={t('kindToolbarAria')}
      >
        {kindsLoading ? (
          <span className="block px-2 py-2 text-sm text-gray-500">{t('loadingKinds')}</span>
        ) : (
          <div className={cn('flex flex-wrap gap-x-2 gap-y-2', isRTL ? 'flex-row-reverse justify-end' : '')}>
            {kindsForBar.map((kind) => {
              const hex = kindVisualByCode.get(kind.kind_code)?.hex ?? null;
              const tw = kindVisualByCode.get(kind.kind_code)?.tw;
              const inactiveSurf = kindToolbarInactiveSurface(hex);
              const inactiveClass = tw
                ? cn('border border-gray-200 bg-white text-gray-800 shadow-sm hover:brightness-[0.98]', tw)
                : cn(hex ? 'hover:brightness-[0.99]' : inactiveSurf.textClass, 'hover:brightness-[0.98]');
              return (
                <button
                  key={kind.kind_code}
                  type="button"
                  onClick={() => setPickerKind(kind)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
                    inactiveClass
                  )}
                  style={tw ? undefined : Object.keys(inactiveSurf.style).length > 0 ? inactiveSurf.style : undefined}
                >
                  {getBilingual(kind.name, kind.name2 ?? null) || kind.kind_code}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className={cn('mt-3 flex flex-wrap gap-2', isRTL ? 'flex-row-reverse' : '')}>
          {chips.map((chip) => {
            const pres = chipPresentation(chip.kindCode);
            return (
              <PreferenceChip
                key={chip.id}
                label={chip.label}
                extraPrice={chip.extraPrice}
                currencyCode={currencyCode}
                kindClassName={pres.className}
                accentStyle={pres.style}
                onRemove={() => removeChip(chip)}
                removeLabel={t('removeChip')}
              />
            );
          })}
        </div>
      )}

      <PieceKindPickerDialog
        open={pickerKind !== null}
        onOpenChange={(o) => !o && setPickerKind(null)}
        kind={pickerKind}
        packingPrefCode={packingPrefCode}
        pieceServicePrefs={servicePrefs.length > 0 ? servicePrefs : EMPTY_PREFS}
        selectedConditionCodes={[]}
        selectedColorCodes={[]}
        onColorsChange={() => {}}
        conditionCatalog={{ stains: [], damages: [] }}
        packingPrefs={packingPrefs}
        prefsForKind={prefsForPicker}
        servicePrefsFallback={servicePrefsFallback}
        enforcePrefCompatibility={enforcePrefCompatibility}
        onPackingChange={(code, cfId) => onPackingChange?.(code, cfId)}
        onServicePrefsChange={(prefs) => {
          const charge = prefs.reduce((sum, p) => sum + (p.extra_price ?? 0), 0);
          onServicePrefsChange(prefs, charge);
        }}
        onConditionToggle={() => {}}
      />
    </div>
  );
}
