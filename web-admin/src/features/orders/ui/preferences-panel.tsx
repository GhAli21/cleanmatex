/**
 * Preferences Panel
 * Unified dynamic tabbed panel — tabs driven by preference kinds from DB.
 * PRD-010: Advanced Order Management
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { usePreferenceCatalog } from '../hooks/use-preference-catalog';
import { ServicePreferenceSelector } from './preferences/ServicePreferenceSelector';
import { StainConditionToggles } from './stain-condition-toggles';
import { CmxTextarea } from '@ui/primitives';
import { ShoppingCart } from 'lucide-react';
import type { PreSubmissionPiece } from '../model/new-order-types';
import type { PreferenceKind, ServicePreference } from '@/lib/types/service-preferences';
import { PREFERENCE_MAIN_TYPES } from '@/lib/types/service-preferences';

interface PreferencesPanelProps {
  selectedPieceId: string | null;
  selectedConditions: string[];
  onConditionToggle: (conditionCode: string) => void;
  enforcePrefCompatibility?: boolean;
}

export function PreferencesPanel({
  selectedPieceId,
  selectedConditions,
  onConditionToggle,
  enforcePrefCompatibility = false,
}: PreferencesPanelProps) {
  const t = useTranslations('newOrder.preferences');
  const tPieces = useTranslations('newOrder.pieces');
  const tPalette = useTranslations('newOrder.notesPalette');
  const isRTL = useRTL();
  const getBilingual = useBilingual();

  const [activeKindCode, setActiveKindCode] = useState<string | null>(null);

  const { state, updateItemPieces, updateItemServicePrefs, updateItemNotes } = useNewOrderStateWithDispatch();
  const {
    servicePrefs,
    packingPrefs,
    conditionCatalog,
    preferenceKinds,
    kindsLoading,
    prefsByKind,
  } = usePreferenceCatalog(state.branchId);

  // Set default tab to first kind once loaded
  useEffect(() => {
    if (!activeKindCode && preferenceKinds.length > 0) {
      setActiveKindCode(preferenceKinds[0].kind_code);
    }
  }, [preferenceKinds, activeKindCode]);

  const activeKind = preferenceKinds.find((k) => k.kind_code === activeKindCode) ?? null;

  const { item, piece, isItemLevel } = useMemo(() => {
    if (!selectedPieceId || state.items.length === 0) {
      return { item: null, piece: null, isItemLevel: false };
    }
    for (const i of state.items) {
      if (!i.pieces || i.pieces.length === 0) {
        if (selectedPieceId === `temp-${i.productId}-1`) {
          return { item: i, piece: null, isItemLevel: true };
        }
      } else {
        const p = i.pieces.find((x) => x.id === selectedPieceId);
        if (p) return { item: i, piece: p, isItemLevel: false };
      }
    }
    return { item: null, piece: null, isItemLevel: false };
  }, [selectedPieceId, state.items]);

  const handlePieceUpdate = (productId: string, pieceId: string, updates: Partial<PreSubmissionPiece>) => {
    const it = state.items.find((c) => c.productId === productId);
    if (!it) return;
    const existingPieces: PreSubmissionPiece[] = it.pieces ?? [];
    const updatedPieces = existingPieces.map((p) =>
      p.id === pieceId ? { ...p, ...updates } : p
    );
    updateItemPieces(productId, updatedPieces);

    if ('servicePrefs' in updates) {
      const pieceCharge = (pieces: PreSubmissionPiece[]) =>
        pieces.reduce(
          (sum, p) =>
            sum + (p.servicePrefs ?? []).reduce((s, pref) => s + (pref.extra_price ?? 0), 0),
          0
        );
      const newCharge = pieceCharge(updatedPieces);
      updateItemServicePrefs(productId, it.servicePrefs ?? [], newCharge);
    }
  };

  const hasItems = state.items.length > 0;
  const hasPieceSelected = !!selectedPieceId && !!(item && (piece || isItemLevel));

  if (!hasItems) return null;

  const pieceLabel = item
    ? `${item.productName || 'Item'}${piece ? ` — ${tPieces('pieceNumber', { number: piece.pieceSeq })}` : ''}`
    : '';

  function renderKindContent(kind: PreferenceKind) {
    const kindPrefs = prefsByKind.get(kind.kind_code) ?? [];

    switch (kind.main_type_code) {
      case PREFERENCE_MAIN_TYPES.PREFERENCES: {
        const prefsToShow: ServicePreference[] =
          kind.kind_code === 'packing_prefs'
            ? (packingPrefs as unknown as ServicePreference[])
            : kindPrefs.length > 0
              ? kindPrefs
              : servicePrefs;

        return (
          <>
            {isItemLevel && item ? (
              <ServicePreferenceSelector
                selectedPrefs={item.servicePrefs ?? []}
                availablePrefs={prefsToShow}
                onChange={(prefs, charge) =>
                  updateItemServicePrefs(item.productId, prefs, charge)
                }
                enforceCompatibility={enforcePrefCompatibility}
              />
            ) : piece && item ? (
              <ServicePreferenceSelector
                selectedPrefs={piece.servicePrefs ?? []}
                availablePrefs={prefsToShow}
                onChange={(prefs) =>
                  handlePieceUpdate(item.productId, piece.id, { servicePrefs: prefs })
                }
                maxPrefs={5}
                enforceCompatibility={enforcePrefCompatibility}
              />
            ) : null}
          </>
        );
      }

      case PREFERENCE_MAIN_TYPES.CONDITIONS: {
        // For stain/damage we keep the existing stainCatalog/damageCatalog split
        // For special + new kinds (pattern, material) we use prefsByKind directly
        if (kind.kind_code === 'condition_stain') {
          return (
            <StainConditionToggles
              selectedConditions={selectedConditions}
              onConditionToggle={onConditionToggle}
              disabled={false}
              defaultFilter="stain"
              hideFilterBar
              stainCatalog={conditionCatalog.stains}
              damageCatalog={[]}
            />
          );
        }
        if (kind.kind_code === 'condition_damag') {
          return (
            <StainConditionToggles
              selectedConditions={selectedConditions}
              onConditionToggle={onConditionToggle}
              disabled={false}
              defaultFilter="damage"
              hideFilterBar
              stainCatalog={[]}
              damageCatalog={conditionCatalog.damages}
            />
          );
        }
        // condition_special, condition_pattern, condition_material — generic chip grid
        return (
          <div className="flex flex-wrap gap-2">
            {kindPrefs.map((cond) => {
              const isSelected = selectedConditions.includes(cond.code);
              const label = getBilingual(cond.name, cond.name2 ?? null) || cond.name;
              return (
                <button
                  key={cond.code}
                  type="button"
                  onClick={() => onConditionToggle(cond.code)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                  }`}
                  aria-pressed={isSelected}
                >
                  {label}
                </button>
              );
            })}
            {kindPrefs.length === 0 && (
              <p className="text-xs text-gray-500 py-4 w-full text-center">
                {tPalette('noItemsAvailable') || 'No items available'}
              </p>
            )}
          </div>
        );
      }

      case PREFERENCE_MAIN_TYPES.COLOR: {
        const colors = prefsByKind.get('color') ?? conditionCatalog.colors;
        return (
          <div>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => {
                const isSelected = selectedConditions.includes(color.code);
                const label = getBilingual(color.name, color.name2 ?? null) || color.name;
                return (
                  <button
                    key={color.code}
                    type="button"
                    title={label}
                    onClick={() => onConditionToggle(color.code)}
                    className={`w-9 h-9 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-300 scale-110'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color.color_hex ?? '#e5e7eb' }}
                    aria-label={label}
                    aria-pressed={isSelected}
                  />
                );
              })}
            </div>
            {colors.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                {tPalette('colors') || 'No colors available'}
              </p>
            )}
          </div>
        );
      }

      case PREFERENCE_MAIN_TYPES.NOTES: {
        return (
          <>
            {piece && item && (
              <CmxTextarea
                value={piece.notes ?? ''}
                onChange={(e) =>
                  handlePieceUpdate(item.productId, piece.id, { notes: e.target.value })
                }
                placeholder={tPieces('notesPlaceholder') || 'Add notes for this piece...'}
                className="min-h-[80px] text-sm"
                rows={3}
              />
            )}
            {isItemLevel && item && (
              <CmxTextarea
                value={item.notes ?? ''}
                onChange={(e) => updateItemNotes(item.productId, e.target.value)}
                placeholder={tPieces('notesPlaceholder') || 'Add notes...'}
                className="min-h-[80px] text-sm"
                rows={3}
              />
            )}
          </>
        );
      }

      default:
        return null;
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {!hasPieceSelected ? (
        <div className={`flex flex-col items-center justify-center py-8 px-4 ${isRTL ? 'text-right' : 'text-center'}`}>
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <ShoppingCart className="w-7 h-7 text-gray-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            {t('selectPieceHint') || 'Select a piece from the cart to apply preferences'}
          </p>
          <p className="text-xs text-gray-500">
            {t('selectPieceFromCart') || 'Tap an item or piece in the cart to configure conditions and notes.'}
          </p>
        </div>
      ) : (
        <div>
          {/* Context header */}
          <div className={`px-4 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h3 className={`text-sm font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
              {pieceLabel}
            </h3>
            {isItemLevel && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {t('itemLevel') || 'Item'}
              </span>
            )}
          </div>

          {/* Dynamic Tab Bar */}
          {kindsLoading ? (
            <div className={`flex gap-1 px-3 pt-2 pb-1 border-b border-gray-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-7 w-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className={`flex gap-1 px-3 pt-2 border-b border-gray-100 overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
              {preferenceKinds.map((kind) => {
                const label = getBilingual(kind.name, kind.name2 ?? null) || kind.kind_code;
                const isActive = kind.kind_code === activeKindCode;
                return (
                  <button
                    key={kind.kind_code}
                    type="button"
                    onClick={() => setActiveKindCode(kind.kind_code)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors focus:outline-none flex-shrink-0 ${
                      isActive
                        ? 'text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    style={
                      isActive && kind.kind_bg_color
                        ? { backgroundColor: kind.kind_bg_color }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab Content */}
          <div className="p-4">
            {activeKind && renderKindContent(activeKind)}
          </div>
        </div>
      )}
    </div>
  );
}
