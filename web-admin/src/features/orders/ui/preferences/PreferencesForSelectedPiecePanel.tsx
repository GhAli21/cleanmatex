/**
 * PreferencesForSelectedPiecePanel
 * In-context panel on Select Items tab: Service Prefs + Conditions + Notes for selected piece.
 * Replaces StainConditionToggles when piece is selected.
 * Visible when items.length > 0; shows empty state when no piece selected.
 */

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { ServicePreferenceSelector } from './ServicePreferenceSelector';
import { StainConditionToggles } from '../stain-condition-toggles';
import { CmxTextarea } from '@ui/primitives';
import { ShoppingCart } from 'lucide-react';
import type { PreSubmissionPiece } from '../../model/new-order-types';

interface PreferencesForSelectedPiecePanelProps {
  selectedPieceId: string | null;
  selectedConditions: string[];
  onConditionToggle: (conditionCode: string) => void;
  enforcePrefCompatibility?: boolean;
}

export function PreferencesForSelectedPiecePanel({
  selectedPieceId,
  selectedConditions,
  onConditionToggle,
  enforcePrefCompatibility = false,
}: PreferencesForSelectedPiecePanelProps) {
  const t = useTranslations('newOrder.preferences');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  const { state, updateItemPieces, updateItemServicePrefs, updateItemNotes } = useNewOrderStateWithDispatch();
  const { servicePrefs } = usePreferenceCatalog(state.branchId);

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
            sum +
            (p.servicePrefs ?? []).reduce((s, pref) => s + (pref.extra_price ?? 0), 0),
          0
        );
      const newCharge = pieceCharge(updatedPieces);
      updateItemServicePrefs(productId, it.servicePrefs ?? [], newCharge);
    }
  };

  const hasItems = state.items.length > 0;
  const hasPieceSelected = !!selectedPieceId && !!(item && (piece || isItemLevel));

  if (!hasItems) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-[50vh] sm:max-h-[40vh] overflow-y-auto">
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
        <div className="space-y-4">
          <h3 className={`text-sm font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('forSelectedPiece') || 'Preferences for selected piece'}
            {item && (
              <span className="text-gray-500 font-normal ms-1">
                — {item.productName || 'Item'}
                {piece ? ` (${tPieces('pieceNumber', { number: piece.pieceSeq })})` : ''}
              </span>
            )}
          </h3>

          {servicePrefs.length > 0 && (
            <div>
              <label className={`block text-xs font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('servicePrefs') || 'Service Preferences'}
              </label>
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
            </div>
          )}

          <StainConditionToggles
            selectedConditions={selectedConditions}
            onConditionToggle={onConditionToggle}
            disabled={false}
          />

          {piece && item && (
            <div>
              <label className={`block text-xs font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tPieces('notes')}
              </label>
              <CmxTextarea
                value={piece.notes ?? ''}
                onChange={(e) =>
                  handlePieceUpdate(item.productId, piece.id, { notes: e.target.value })
                }
                placeholder={tPieces('notesPlaceholder') || 'Add notes for this piece...'}
                className="min-h-[80px] text-sm"
                rows={3}
              />
            </div>
          )}
          {isItemLevel && item && (
            <div>
              <label className={`block text-xs font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tPieces('notes')}
              </label>
              <CmxTextarea
                value={item.notes ?? ''}
                onChange={(e) => updateItemNotes(item.productId, e.target.value)}
                placeholder={tPieces('notesPlaceholder') || 'Add notes...'}
                className="min-h-[80px] text-sm"
                rows={3}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
