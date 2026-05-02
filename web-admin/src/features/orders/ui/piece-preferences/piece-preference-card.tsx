/**
 * One card per piece: kind toolbar (segmented tabs) + preference chips grouped by kind + copy-all.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBilingual } from '@/lib/utils/bilingual';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxTextarea } from '@ui/primitives/cmx-textarea';
import { PREFERENCE_MAIN_TYPES } from '@/lib/types/service-preferences';
import type { PackingPreference, PreferenceKind, ServicePreference } from '@/lib/types/service-preferences';
import type { PreSubmissionPiece } from '@/src/features/orders/model/new-order-types';
import type { SelectedPreference } from '@/src/features/orders/lib/selected-piece-preference';
import { PreferenceChip } from './preference-chip';
import { PieceKindPickerDialog } from './piece-kind-picker-dialog';
import {
  kindChipAccentStyle,
  kindToolbarInactiveSurface,
  parseKindBgHex,
  isTailwindKindBgToken,
} from './piece-pref-kind-styles';

interface ConditionCatalog {
  stains: Array<{ code: string; name: string; name2?: string | null }>;
  damages: Array<{ code: string; name: string; name2?: string | null }>;
  colors: Array<{ code: string; name: string; name2?: string | null; color_hex?: string | null }>;
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

function chipFallbackClass(kind: string): string | undefined {
  if (kind === 'condition_stain' || kind === 'condition_damag' || kind === 'condition_special') {
    return 'border-rose-200 bg-rose-50 text-rose-900';
  }
  if (kind === 'service_prefs') return 'border-blue-200 bg-blue-50 text-blue-900';
  if (kind === 'packing_prefs') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (kind === 'color') return 'border-violet-200 bg-violet-50 text-violet-900';
  return undefined;
}

/** Legacy: DB sometimes stores tailwind class fragments */
function tailwindKindTokenClass(kindBg: string | null | undefined): string | undefined {
  if (!kindBg || !isTailwindKindBgToken(kindBg)) return undefined;
  return kindBg.trim();
}

/** DB kind row for notes: main_type_code `notes` and/or kind_code `note` */
function isNotesKindRow(k: PreferenceKind): boolean {
  return k.main_type_code === PREFERENCE_MAIN_TYPES.NOTES || k.kind_code === 'note';
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
  const [toolbarActiveKind, setToolbarActiveKind] = useState<string | null>(null);

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
    () => preferenceKinds.filter((k) => k.is_active).sort((a, b) => (a.rec_order ?? 0) - (b.rec_order ?? 0)),
    [preferenceKinds]
  );

  const colorHexByCode = useMemo(() => {
    const m = new Map<string, string | null | undefined>();
    for (const c of conditionCatalog.colors) {
      m.set(c.code, c.color_hex ?? null);
    }
    return m;
  }, [conditionCatalog.colors]);

  const notesToolbarActive =
    toolbarActiveKind != null &&
    kindsForBar.some((k) => k.kind_code === toolbarActiveKind && isNotesKindRow(k));

  const prefsForPicker = pickerKind ? prefsByKind.get(pickerKind.kind_code) ?? [] : [];

  const targetsForCopy = useMemo(
    () => siblingPieceIds.filter((id) => id !== piece.id),
    [siblingPieceIds, piece.id]
  );

  /** Per kind_code: hex (from DB) or tailwind token string for chips */
  const kindVisualByCode = useMemo(() => {
    const m = new Map<string, { hex: string | null; tw?: string }>();
    for (const k of kindsForBar) {
      const tw = tailwindKindTokenClass(k.kind_bg_color);
      const hex = tw ? null : parseKindBgHex(k.kind_bg_color);
      m.set(k.kind_code, { hex, tw });
    }
    return m;
  }, [kindsForBar]);

  const chipPresentation = useMemo(() => {
    return (kindCode: string) => {
      const v = kindVisualByCode.get(kindCode);
      const hex = v?.hex ?? null;
      const tw = v?.tw;
      const style = kindChipAccentStyle(hex);
      const tailClass = tw || (!hex && !tw ? chipFallbackClass(kindCode) : undefined);
      return { style, className: tailClass };
    };
  }, [kindVisualByCode]);

  const groupedPreferences = useMemo(() => {
    if (preferences.length === 0) return [];
    const byKind = new Map<string, SelectedPreference[]>();
    for (const p of preferences) {
      const k = p.preference_sys_kind;
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(p);
    }
    const ordered: { kindCode: string; sectionLabel: string; prefs: SelectedPreference[] }[] = [];
    const seen = new Set<string>();
    for (const k of kindsForBar) {
      const list = byKind.get(k.kind_code);
      if (list?.length) {
        ordered.push({
          kindCode: k.kind_code,
          sectionLabel: getBilingual(k.name, k.name2 ?? null) || k.kind_code,
          prefs: list,
        });
        seen.add(k.kind_code);
      }
    }
    for (const [kindCode, prefs] of byKind) {
      if (!seen.has(kindCode) && prefs.length > 0) {
        ordered.push({ kindCode, sectionLabel: kindCode, prefs });
      }
    }
    return ordered;
  }, [preferences, kindsForBar, getBilingual]);

  const pieceHeading = useMemo(() => {
    const pieceLabel = tPieces('pieceNumber', { number: piece.pieceSeq });
    if (categoryLabel?.trim()) {
      return `${categoryLabel.trim()} - ${itemTitle} - ${pieceLabel}`;
    }
    return `${itemTitle} - ${pieceLabel}`;
  }, [categoryLabel, itemTitle, piece.pieceSeq, tPieces]);

  return (
    <div
      className="rounded-xl border border-slate-300/80 bg-white p-3 shadow-sm ring-1 ring-slate-200/60"
      aria-label={t('cardAriaLabel', { item: itemTitle, piece: piece.pieceSeq })}
    >
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}
      >
        <div className="min-w-0 flex-1 rounded-lg border border-slate-300/70 bg-gradient-to-b from-slate-200/90 to-slate-100/95 px-3 py-2 shadow-sm">
          <h3 className="text-sm font-semibold leading-snug text-slate-900">{pieceHeading}</h3>
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
        className={cn(
          'mt-3 rounded-xl border border-slate-200 bg-slate-100/95 p-1.5 shadow-inner',
          isRTL && 'rtl'
        )}
        role="toolbar"
        aria-label={t('kindToolbarAria')}
      >
        {kindsLoading ? (
          <span className="block px-2 py-2 text-sm text-gray-500">{t('loadingKinds')}</span>
        ) : (
          <div
            className={cn(
              'flex flex-wrap gap-x-2 gap-y-2',
              isRTL ? 'flex-row-reverse justify-end' : ''
            )}
          >
            {kindsForBar.map((kind) => {
              const isActive = toolbarActiveKind === kind.kind_code;
              const hex = kindVisualByCode.get(kind.kind_code)?.hex ?? null;
              const tw = kindVisualByCode.get(kind.kind_code)?.tw;
              const inactiveSurf = kindToolbarInactiveSurface(hex);
              const inactiveClass = tw
                ? cn(
                    'border border-gray-200 bg-white text-gray-800 shadow-sm hover:brightness-[0.98]',
                    tw
                  )
                : cn(
                    hex ? 'hover:brightness-[0.99]' : inactiveSurf.textClass,
                    'hover:brightness-[0.98]'
                  );
              return (
                <button
                  key={kind.kind_code}
                  type="button"
                  onClick={() => {
                    setToolbarActiveKind(kind.kind_code);
                    if (isNotesKindRow(kind)) {
                      setPickerKind(null);
                    } else {
                      setPickerKind(kind);
                    }
                  }}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
                    isActive ? 'bg-blue-600 text-white shadow-md' : inactiveClass
                  )}
                  style={
                    isActive || tw
                      ? undefined
                      : Object.keys(inactiveSurf.style).length > 0
                        ? inactiveSurf.style
                        : undefined
                  }
                  aria-pressed={isActive}
                >
                  {getBilingual(kind.name, kind.name2 ?? null) || kind.kind_code}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {notesToolbarActive && (
        <div className={cn('mt-2 space-y-1.5', isRTL && 'text-right')}>
          <label
            htmlFor={`piece-pref-notes-${piece.id}`}
            className={cn(
              'block text-xs font-bold uppercase tracking-wide text-slate-600',
              isRTL ? 'text-right' : 'text-left'
            )}
          >
            {t('notesFieldLabel')}
          </label>
          <CmxTextarea
            id={`piece-pref-notes-${piece.id}`}
            dir={isRTL ? 'rtl' : 'ltr'}
            rows={3}
            maxLength={1000}
            className="min-h-[4.5rem] text-sm"
            value={piece.notes ?? ''}
            placeholder={t('notesFieldPlaceholder')}
            onChange={(e) =>
              updatePieceFields(piece.id, {
                notes: e.target.value.length > 0 ? e.target.value : undefined,
              })
            }
          />
          <p
            className={cn(
              'text-[11px] leading-snug text-slate-500',
              isRTL ? 'text-right' : 'text-left'
            )}
          >
            {t('notesFieldHint')}
          </p>
        </div>
      )}

      {preferences.length > 0 && (
        <>
          <div
            className="my-3 border-t border-slate-200 pt-3"
            role="separator"
            aria-hidden
          />
          <div className="space-y-2">
            {groupedPreferences.map((group) => (
              <div key={group.kindCode}>
                <p
                  className={cn(
                    'mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-600',
                    isRTL ? 'text-right' : 'text-left'
                  )}
                >
                  {group.sectionLabel}
                </p>
                <div className={cn('flex flex-wrap gap-2', isRTL ? 'flex-row-reverse' : '')}>
                  {group.prefs.map((pref) => {
                    const pres = chipPresentation(pref.preference_sys_kind);
                    const catalogHex =
                      pref.preference_sys_kind === 'color'
                        ? colorHexByCode.get(pref.preference_code)
                        : null;
                    const parsed = catalogHex ? parseKindBgHex(catalogHex) : null;
                    return (
                      <PreferenceChip
                        key={pref.id}
                        label={chipLabel(pref, getBilingual, nameByCode)}
                        extraPrice={pref.extra_price}
                        currencyCode={currencyCode}
                        kindClassName={parsed ? undefined : pres.className}
                        accentStyle={parsed ? undefined : pres.style}
                        catalogColorHex={catalogHex}
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
              </div>
            ))}
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
