/**
 * One card per piece: kind action bar + preference chips + copy-all.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBilingual } from '@/lib/utils/bilingual';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives/cmx-button';
import { PREFERENCE_MAIN_TYPES } from '@/lib/types/service-preferences';
import type { PackingPreference, PreferenceKind, ServicePreference } from '@/lib/types/service-preferences';
import type { PreSubmissionPiece } from '@/src/features/orders/model/new-order-types';
import type { SelectedPreference } from '@/src/features/orders/lib/selected-piece-preference';
import { PreferenceChip } from './preference-chip';
import { PieceKindPickerDialog } from './piece-kind-picker-dialog';

interface ConditionCatalog {
  stains: Array<{ code: string; name: string; name2?: string | null }>;
  damages: Array<{ code: string; name: string; name2?: string | null }>;
  colors: Array<{ code: string; name: string; name2?: string | null }>;
}

function chipLabel(
  pref: SelectedPreference,
  getBilingual: (a: string | null | undefined, b: string | null | undefined) => string,
  nameByCode: Map<string, string>
): string {
  const fromMap = nameByCode.get(pref.preference_code);
  if (fromMap) return fromMap;
  return pref.preference_code;
}

function chipKindClass(kind: string): string | undefined {
  if (kind === 'condition_stain' || kind === 'condition_damag') return 'border-rose-200 bg-rose-50 text-rose-900';
  if (kind === 'service_prefs') return 'border-blue-200 bg-blue-50 text-blue-900';
  if (kind === 'packing_prefs') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (kind === 'color') return 'border-violet-200 bg-violet-50 text-violet-900';
  return undefined;
}

/** Map DB kind_bg_color (e.g. tailwind classes) onto tab button / chip ring */
function PREFERENCE_KIND_INACTIVE_TAB_CLASS(kindBg: string | null | undefined): string | undefined {
  if (!kindBg || !kindBg.trim()) return undefined;
  const t = kindBg.trim();
  if (/^(bg-|text-|border-)/.test(t)) return t;
  return undefined;
}

export interface PiecePreferenceCardProps {
  categoryLabel?: string;
  itemTitle: string;
  piece: PreSubmissionPiece;
  preferences: SelectedPreference[];
  preferenceKinds: PreferenceKind[];
  prefsByKind: Map<string, ServicePreference[]>;
  packingPrefs: PackingPreference[];
  servicePrefsFallback: ServicePreference[];
  conditionCatalog: ConditionCatalog;
  currencyCode: string;
  kindsLoading: boolean;
  enforcePrefCompatibility?: boolean;
  siblingPieceIds: string[];
  copyAllTooltip: string;
  onRemovePreference: (uiId: string) => void;
  onCopyPreferenceToPieces: (uiId: string, targetIds: string[]) => void;
  onCopyAllToPieces: (targetIds: string[]) => void;
  updatePieceFields: (pieceId: string, updates: Partial<PreSubmissionPiece>) => void;
}

export function PiecePreferenceCard({
  categoryLabel,
  itemTitle,
  piece,
  preferences,
  preferenceKinds,
  prefsByKind,
  packingPrefs,
  servicePrefsFallback,
  conditionCatalog,
  currencyCode,
  kindsLoading,
  enforcePrefCompatibility = false,
  siblingPieceIds,
  copyAllTooltip,
  onRemovePreference,
  onCopyPreferenceToPieces,
  onCopyAllToPieces,
  updatePieceFields,
}: PiecePreferenceCardProps) {
  const t = useTranslations('newOrder.piecePreferences');
  const tPieces = useTranslations('newOrder.pieces');
  const getBilingual = useBilingual();
  const isRTL = useRTL();
  const [pickerKind, setPickerKind] = useState<PreferenceKind | null>(null);

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of servicePrefsFallback) {
      m.set(p.code, getBilingual(p.name, p.name2 ?? null));
    }
    for (const p of packingPrefs) {
      m.set(p.code, getBilingual(p.name, p.name2 ?? null));
    }
    for (const c of conditionCatalog.stains) {
      m.set(c.code, getBilingual(c.name, c.name2 ?? null));
    }
    for (const c of conditionCatalog.damages) {
      m.set(c.code, getBilingual(c.name, c.name2 ?? null));
    }
    for (const c of conditionCatalog.colors) {
      m.set(c.code, getBilingual(c.name, c.name2 ?? null));
    }
    return m;
  }, [servicePrefsFallback, packingPrefs, conditionCatalog, getBilingual]);

  const kindsForBar = useMemo(
    () =>
      preferenceKinds.filter(
        (k) => k.is_active && k.main_type_code !== PREFERENCE_MAIN_TYPES.NOTES
      ),
    [preferenceKinds]
  );

  const prefsForPicker = pickerKind ? prefsByKind.get(pickerKind.kind_code) ?? [] : [];

  const targetsForCopy = useMemo(
    () => siblingPieceIds.filter((id) => id !== piece.id),
    [siblingPieceIds, piece.id]
  );

  const kindStyleByKindCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kindsForBar) {
      const cls =
        PREFERENCE_KIND_INACTIVE_TAB_CLASS(k.kind_bg_color) ||
        'border-gray-200 bg-gray-50 text-gray-800';
      m.set(k.kind_code, cls);
    }
    return m;
  }, [kindsForBar]);

  const pieceHeading = useMemo(() => {
    const pieceLabel = tPieces('pieceNumber', { number: piece.pieceSeq });
    if (categoryLabel?.trim()) {
      return `${categoryLabel.trim()} - ${itemTitle} - ${pieceLabel}`;
    }
    return `${itemTitle} - ${pieceLabel}`;
  }, [categoryLabel, itemTitle, piece.pieceSeq, tPieces]);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      aria-label={t('cardAriaLabel', { item: itemTitle, piece: piece.pieceSeq })}
    >
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}
      >
        <div className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <h3 className="text-sm font-semibold leading-snug text-gray-900">{pieceHeading}</h3>
        </div>
        {targetsForCopy.length > 0 && (
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => onCopyAllToPieces(targetsForCopy)}
            title={copyAllTooltip}
            aria-label={copyAllTooltip}
          >
            <Copy className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t('copyAll')}</span>
          </CmxButton>
        )}
      </div>

      <div
        className={`mt-3 flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
        role="toolbar"
        aria-label={t('kindToolbarAria')}
      >
        {kindsLoading ? (
          <span className="text-sm text-gray-400">{t('loadingKinds')}</span>
        ) : (
          kindsForBar.map((kind) => {
            const inactiveCls =
              PREFERENCE_KIND_INACTIVE_TAB_CLASS(kind.kind_bg_color) || 'bg-gray-100 text-gray-800';
            return (
              <button
                key={kind.kind_code}
                type="button"
                onClick={() => setPickerKind(kind)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                  inactiveCls
                )}
              >
                {getBilingual(kind.name, kind.name2 ?? null) || kind.kind_code}
              </button>
            );
          })
        )}
      </div>

      {preferences.length > 0 && (
        <>
          <div className="my-3 border-t border-gray-200" role="separator" aria-hidden />
          <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {preferences.map((pref) => {
              const fromKind = kindStyleByKindCode.get(pref.preference_sys_kind);
              const chipSurround = fromKind ?? chipKindClass(pref.preference_sys_kind);
              return (
                <PreferenceChip
                  key={pref.id}
                  label={chipLabel(pref, getBilingual, nameByCode)}
                  extraPrice={pref.extra_price}
                  currencyCode={currencyCode}
                  kindClassName={chipSurround}
                  onRemove={() => onRemovePreference(pref.id)}
                  onCopy={() => {
                    if (targetsForCopy.length > 0) {
                      onCopyPreferenceToPieces(pref.id, targetsForCopy);
                    }
                  }}
                  removeLabel={t('removeChip')}
                  copyLabel={t('copyChip')}
                />
              );
            })}
          </div>
        </>
      )}

      <PieceKindPickerDialog
        open={pickerKind !== null}
        onOpenChange={(o) => !o && setPickerKind(null)}
        kind={pickerKind}
        packingPrefCode={piece.packingPrefCode}
        pieceServicePrefs={piece.servicePrefs ?? []}
        selectedConditionCodes={piece.conditions ?? []}
        selectedColorCode={piece.color}
        onColorSelect={(code) => {
          updatePieceFields(piece.id, { color: code });
        }}
        conditionCatalog={{
          stains: conditionCatalog.stains,
          damages: conditionCatalog.damages,
        }}
        packingPrefs={packingPrefs}
        prefsForKind={prefsForPicker}
        servicePrefsFallback={servicePrefsFallback}
        enforcePrefCompatibility={enforcePrefCompatibility}
        onPackingChange={(code) => updatePieceFields(piece.id, { packingPrefCode: code })}
        onServicePrefsChange={(prefs) => updatePieceFields(piece.id, { servicePrefs: prefs })}
        onConditionToggle={(code) => {
          const cur = piece.conditions ?? [];
          const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
          updatePieceFields(piece.id, { conditions: next.length > 0 ? next : undefined });
        }}
      />
    </div>
  );
}
