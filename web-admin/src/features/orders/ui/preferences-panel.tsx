/**
 * Preferences Panel
 * Unified tabbed panel: Stains / Damage / Special / Prefs / Notes for selected item/piece
 * PRD-010: Advanced Order Management
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { usePreferenceCatalog } from '../hooks/use-preference-catalog';
import { ServicePreferenceSelector } from './preferences/ServicePreferenceSelector';
import { StainConditionToggles } from './stain-condition-toggles';
import { CmxTextarea } from '@ui/primitives';
import { ShoppingCart } from 'lucide-react';
import type { PreSubmissionPiece } from '../model/new-order-types';

type ActiveTab = 'stain' | 'damage' | 'special' | 'prefs' | 'notes';

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('stain');
  const { state, updateItemPieces, updateItemServicePrefs, updateItemNotes } = useNewOrderStateWithDispatch();
  const { servicePrefs, conditionCatalog } = usePreferenceCatalog(state.branchId);

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

  const tabs: { id: ActiveTab; label: string; show: boolean }[] = [
    { id: 'stain', label: tPalette('stains'), show: true },
    { id: 'damage', label: tPalette('damage'), show: true },
    { id: 'special', label: tPalette('special'), show: true },
    { id: 'prefs', label: t('preferences'), show: servicePrefs.length > 0 },
    { id: 'notes', label: tPieces('notes'), show: true },
  ];

  const pieceLabel = item
    ? `${item.productName || 'Item'}${piece ? ` — ${tPieces('pieceNumber', { number: piece.pieceSeq })}` : ''}`
    : '';

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

          {/* Tab Bar */}
          <div className={`flex gap-1 px-3 pt-2 border-b border-gray-100 overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
            {tabs.filter((tab) => tab.show).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors focus:outline-none flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {(activeTab === 'stain' || activeTab === 'damage' || activeTab === 'special') && (
              <StainConditionToggles
                selectedConditions={selectedConditions}
                onConditionToggle={onConditionToggle}
                disabled={false}
                defaultFilter={activeTab}
                hideFilterBar
                stainCatalog={conditionCatalog.stains}
                damageCatalog={conditionCatalog.damages}
                specialCatalog={[]}
              />
            )}

            {activeTab === 'prefs' && servicePrefs.length > 0 && (
              <>
                {isItemLevel && item ? (
                  <ServicePreferenceSelector
                    selectedPrefs={item.servicePrefs ?? []}
                    availablePrefs={servicePrefs}
                    onChange={(prefs, charge) =>
                      updateItemServicePrefs(item.productId, prefs, charge)
                    }
                    enforceCompatibility={enforcePrefCompatibility}
                  />
                ) : piece && item ? (
                  <ServicePreferenceSelector
                    selectedPrefs={piece.servicePrefs ?? []}
                    availablePrefs={servicePrefs}
                    onChange={(prefs) =>
                      handlePieceUpdate(item.productId, piece.id, { servicePrefs: prefs })
                    }
                    maxPrefs={5}
                    enforceCompatibility={enforcePrefCompatibility}
                  />
                ) : null}
              </>
            )}

            {activeTab === 'notes' && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
