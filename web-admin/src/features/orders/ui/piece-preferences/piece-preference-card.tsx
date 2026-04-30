/**
 * One card per piece: kind action bar + preference chips + copy-all.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBilingual } from '@/lib/utils/bilingual';
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

export interface PiecePreferenceCardProps {
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

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      aria-label={t('cardAriaLabel', { item: itemTitle, piece: piece.pieceSeq })}
    >
      <div className="flex flex-row items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {itemTitle} — {tPieces('pieceNumber', { number: piece.pieceSeq })}
        </h3>
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

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
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
        <div className="mt-3 flex flex-wrap gap-2">
          {preferences.map((pref) => (
            <PreferenceChip
              key={pref.id}
              label={chipLabel(pref, getBilingual, nameByCode)}
              extraPrice={pref.extra_price}
              currencyCode={currencyCode}
              kindClassName={chipKindClass(pref.preference_sys_kind)}
              onRemove={() => onRemovePreference(pref.id)}
              onCopy={() => {
                if (targetsForCopy.length > 0) {
                  onCopyPreferenceToPieces(pref.id, targetsForCopy);
                }
              }}
              removeLabel={t('removeChip')}
              copyLabel={t('copyChip')}
            />
          ))}
        </div>
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

/** Map DB kind_bg_color (e.g. tailwind classes) onto tab button */
function PREFERENCE_KIND_INACTIVE_TAB_CLASS(kindBg: string | null | undefined): string | undefined {
  if (!kindBg || !kindBg.trim()) return undefined;
  const t = kindBg.trim();
  if (/^(bg-|text-|border-)/.test(t)) return t;
  return undefined;
}
