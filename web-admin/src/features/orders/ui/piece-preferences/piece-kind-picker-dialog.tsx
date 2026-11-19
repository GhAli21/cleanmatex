/**
 * Modal to pick one catalog entry for a preference kind (piece-level).
 */

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@/src/ui/overlays/cmx-dialog';
import { CmxButton } from '@ui/primitives';
import { useBilingual } from '@/lib/utils/bilingual';
import { isSafeMdiIconClass } from '@/lib/utils/mdi-icon';
import { PREFERENCE_MAIN_TYPES } from '@/lib/types/service-preferences';
import type { PackingPreference, PreferenceKind, ServicePreference } from '@/lib/types/service-preferences';
import { StainConditionToggles } from '@/src/features/orders/ui/stain-condition-toggles';
import { PackingPreferenceSelector } from '@/src/features/orders/ui/preferences/PackingPreferenceSelector';
import { ServicePreferenceSelector } from '@/src/features/orders/ui/preferences/ServicePreferenceSelector';
import type { OrderItemServicePref } from '@/src/features/orders/model/new-order-types';

interface ConditionCatalog {
  stains: Array<{ code: string; name: string; name2?: string | null }>;
  damages: Array<{ code: string; name: string; name2?: string | null }>;
}

interface PieceKindPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: PreferenceKind | null;
  /** Piece-level packing (single-select) */
  packingPrefCode?: string;
  /** Piece-level service prefs (for selector) */
  pieceServicePrefs: OrderItemServicePref[];
  /** Selected condition codes for toggles */
  selectedConditionCodes: string[];
  selectedColorCodes: string[];
  onColorsChange: (codes: string[], cfIds: (string | null)[]) => void;
  conditionCatalog: ConditionCatalog;
  packingPrefs: PackingPreference[];
  prefsForKind: ServicePreference[];
  servicePrefsFallback: ServicePreference[];
  enforcePrefCompatibility?: boolean;
  onPackingChange: (code: string | undefined, packingCfId?: string | null) => void;
  onServicePrefsChange: (prefs: OrderItemServicePref[]) => void;
  onConditionToggle: (code: string) => void;
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.kind
 * @param root0.packingPrefCode
 * @param root0.pieceServicePrefs
 * @param root0.selectedConditionCodes
 * @param root0.selectedColorCodes
 * @param root0.onColorsChange
 * @param root0.conditionCatalog
 * @param root0.packingPrefs
 * @param root0.prefsForKind
 * @param root0.servicePrefsFallback
 * @param root0.enforcePrefCompatibility
 * @param root0.onPackingChange
 * @param root0.onServicePrefsChange
 * @param root0.onConditionToggle
 */
export function PieceKindPickerDialog({
  open,
  onOpenChange,
  kind,
  packingPrefCode,
  pieceServicePrefs,
  selectedConditionCodes,
  selectedColorCodes,
  onColorsChange,
  conditionCatalog,
  packingPrefs,
  prefsForKind,
  servicePrefsFallback,
  enforcePrefCompatibility = false,
  onPackingChange,
  onServicePrefsChange,
  onConditionToggle,
}: PieceKindPickerDialogProps) {
  const t = useTranslations('newOrder.piecePreferences');
  const getBilingual = useBilingual();

  if (!kind) return null;

  const title = getBilingual(kind.name, kind.name2 ?? null) || kind.kind_code;

  let body: ReactNode = null;

  switch (kind.main_type_code) {
    case PREFERENCE_MAIN_TYPES.PREFERENCES: {
      if (kind.kind_code === 'packing_prefs') {
        body = (
          <PackingPreferenceSelector
            value={packingPrefCode}
            availablePrefs={packingPrefs}
            onChange={(code, packingCfId) => onPackingChange(code ?? undefined, packingCfId)}
          />
        );
        break;
      }
      const prefsToShow = prefsForKind.length > 0 ? prefsForKind : servicePrefsFallback;
      body = (
        <ServicePreferenceSelector
          selectedPrefs={pieceServicePrefs}
          availablePrefs={prefsToShow}
          onChange={(prefs) => onServicePrefsChange(prefs)}
          maxPrefs={8}
          enforceCompatibility={enforcePrefCompatibility}
        />
      );
      break;
    }
    case PREFERENCE_MAIN_TYPES.CONDITIONS: {
      if (kind.kind_code === 'condition_stain') {
        body = (
          <StainConditionToggles
            selectedConditions={selectedConditionCodes}
            onConditionToggle={onConditionToggle}
            disabled={false}
            defaultFilter="stain"
            hideFilterBar
            stainCatalog={conditionCatalog.stains}
            damageCatalog={[]}
          />
        );
        break;
      }
      if (kind.kind_code === 'condition_damag') {
        body = (
          <StainConditionToggles
            selectedConditions={selectedConditionCodes}
            onConditionToggle={onConditionToggle}
            disabled={false}
            defaultFilter="damage"
            hideFilterBar
            stainCatalog={[]}
            damageCatalog={conditionCatalog.damages}
          />
        );
        break;
      }
      body = (
        <div className="flex flex-wrap gap-2.5">
          {prefsForKind.map((cond) => {
            const isSelected = selectedConditionCodes.includes(cond.code);
            const label = getBilingual(cond.name, cond.name2 ?? null) || cond.name;
            return (
              <CmxButton
                key={cond.code}
                type="button"
                variant="ghost"
                onClick={() => onConditionToggle(cond.code)}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground'
                    : 'border-border bg-muted text-foreground hover:border-muted-foreground hover:bg-card'
                )}
                aria-pressed={isSelected}
              >
                {isSafeMdiIconClass(cond.icon) ? (
                  <i
                    className={cn(
                      'mdi shrink-0 text-lg leading-none',
                      cond.icon,
                      isSelected ? 'text-on-solid' : 'text-muted-foreground'
                    )}
                    aria-hidden
                  />
                ) : null}
                <span>{label}</span>
              </CmxButton>
            );
          })}
          {prefsForKind.length === 0 && (
            <p className="w-full py-4 text-center text-sm text-muted-foreground">{t('noItemsForKind')}</p>
          )}
        </div>
      );
      break;
    }
    case PREFERENCE_MAIN_TYPES.COLOR: {
      const colors = prefsForKind;
      body = (
        <div className="flex flex-wrap gap-3">
          {colors.map((color) => {
            const isSelected = selectedColorCodes.includes(color.code);
            const label = getBilingual(color.name, color.name2 ?? null) || color.name;
            return (
              <div key={color.code} className="flex max-w-[5.5rem] flex-col items-center gap-1">
                {/* cmx-ds-ignore UI003: fallback neutral swatch color */}
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={label}
                  onClick={() => {
                    const nextCodes = selectedColorCodes.includes(color.code)
                      ? selectedColorCodes.filter((c) => c !== color.code)
                      : [...selectedColorCodes, color.code];
                    const nextCfIds = nextCodes.map(
                      (c) =>
                        prefsForKind.find((p) => p.code === c)?.preference_cf_id ?? null
                    );
                    onColorsChange(nextCodes, nextCfIds);
                  }}
                  className={cn(
                    'h-11 w-11 rounded-full border-2 p-0 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                    isSelected ? 'scale-110 border-primary ring-2 ring-ring' : 'border-border hover:border-muted-foreground'
                  )}
                  style={{ /* cmx-ds-ignore UI003: fallback neutral swatch */ backgroundColor: color.color_hex ?? '#e5e7eb' }}
                  aria-label={label}
                  aria-pressed={isSelected}
                />
                {!color.color_hex && (
                  <span className="line-clamp-2 text-center text-xs font-medium leading-snug text-muted-foreground">{label}</span>
                )}
              </div>
            );
          })}
          {colors.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t('noColors')}</p>}
        </div>
      );
      break;
    }
    case PREFERENCE_MAIN_TYPES.NOTES:
      body = <p className="text-sm text-muted-foreground">{t('notesOpenToolbar')}</p>;
      break;
    default:
      body = <p className="text-sm text-muted-foreground">{t('unsupportedKind')}</p>;
  }

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-lg p-0 sm:max-w-xl">
        <CmxDialogHeader className="border-b border-border px-4 py-3">
          <CmxDialogTitle>{title}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[min(70vh,520px)] overflow-y-auto px-4 py-4">{body}</div>
      </CmxDialogContent>
    </CmxDialog>
  );
}
