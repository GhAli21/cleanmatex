/**
 * Order Pieces Notes Section
 * "Edit Item Notes" tab — per-item cards with piece rows for notes only (preferences live on Edit Items Preferences tab).
 */

'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { Copy } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { OrderItem, PreSubmissionPiece } from '../model/new-order-types';

interface OrderPiecesNotesSectionProps {
  onCopyPieceToAll: (itemId: string, pieceId: string) => void;
  focusItemId?: string | null;
  onFocusItemHandled?: () => void;
}

interface ItemGroup {
  item: OrderItem;
  pieces: PreSubmissionPiece[];
}

/**
 *
 * @param root0
 * @param root0.onCopyPieceToAll
 * @param root0.focusItemId
 * @param root0.onFocusItemHandled
 */
export function OrderPiecesNotesSection({
  onCopyPieceToAll,
  focusItemId,
  onFocusItemHandled,
}: OrderPiecesNotesSectionProps) {
  const t = useTranslations('newOrder');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  const { state, updateItemPieces } = useNewOrderStateWithDispatch();

  const [showAllItems, setShowAllItems] = useState(false);
  const [filterItemId, setFilterItemId] = useState<string | null>(null);

  const itemCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!focusItemId) return;
    setFilterItemId(focusItemId);
    setTimeout(() => {
      const ref = itemCardRefs.current.get(focusItemId);
      if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onFocusItemHandled?.();
    }, 100);
  }, [focusItemId]);  

  const itemGroups = useMemo((): ItemGroup[] => {
    return state.items
      .map((item) => {
        const pieces: PreSubmissionPiece[] =
          item.pieces && item.pieces.length > 0
            ? item.pieces
            : Array.from({ length: item.quantity }, (_, i) => ({
                id: `temp-${item.productId}-${i + 1}`,
                itemId: item.productId,
                pieceSeq: i + 1,
              }));
        return { item, pieces };
      })
      .filter(({ item, pieces }) => {
        if (filterItemId) return item.productId === filterItemId;
        return showAllItems || pieces.length > 1;
      });
  }, [state.items, showAllItems, filterItemId]);

  const materializePieces = useCallback(
    (item: OrderItem): PreSubmissionPiece[] => {
      if (item.pieces && item.pieces.length > 0) return item.pieces;
      const generated: PreSubmissionPiece[] = Array.from({ length: item.quantity }, (_, i) => ({
        id: `temp-${item.productId}-${i + 1}`,
        itemId: item.productId,
        pieceSeq: i + 1,
      }));
      updateItemPieces(item.productId, generated);
      return generated;
    },
    [updateItemPieces]
  );

  const updatePieceField = useCallback(
    (item: OrderItem, pieceId: string, updates: Partial<PreSubmissionPiece>) => {
      const pieces = materializePieces(item);
      const updated = pieces.map((p) => (p.id === pieceId ? { ...p, ...updates } : p));
      updateItemPieces(item.productId, updated);
    },
    [materializePieces, updateItemPieces]
  );

  const handleNotesChange = useCallback(
    (item: OrderItem, pieceId: string, notes: string) => {
      updatePieceField(item, pieceId, { notes: notes || undefined });
    },
    [updatePieceField]
  );

  const commonInputClass =
    'block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring';

  return (
    <section aria-label={tPieces('editItemNotes') || 'Edit Item Notes'} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{tPieces('editItemNotes') || 'Edit Item Notes'}</h2>
        <CmxButton
          variant="outline"
          size="sm"
          onClick={() => {
            if (filterItemId) {
              setFilterItemId(null);
              setShowAllItems(false);
            } else {
              setShowAllItems((v) => !v);
            }
          }}
        >
          {filterItemId || !showAllItems ? tPieces('showAllItems') || 'Show All Items' : tPieces('showMultiPieceOnly') || 'Multi-Piece Only'}
        </CmxButton>
      </div>

      {itemGroups.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground space-y-3">
          <p className="text-sm">{tPieces('noPiecesToShow') || 'No multi-piece items. Toggle "Show All Items" to view all.'}</p>
          <CmxButton variant="outline" size="sm" onClick={() => { setFilterItemId(null); setShowAllItems(true); }}>
            {tPieces('showAllItems') || 'Show All Items'}
          </CmxButton>
        </div>
      ) : (
        <div className="space-y-3">
          {itemGroups.map(({ item, pieces }, groupIndex) => (
            <div
              key={item.productId}
              className="rounded-lg border border-border overflow-hidden"
              ref={(el) => {
                if (el) itemCardRefs.current.set(item.productId, el);
                else itemCardRefs.current.delete(item.productId);
              }}
            >
              <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                  {groupIndex + 1}
                </span>
                <span className="flex-1 text-base font-semibold text-foreground text-start">
                  {item.productName || '—'}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-info-text">
                  ×{pieces.length} {tPieces('pieces') || 'pcs'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" dir={isRTL ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-muted-foreground text-start">
                        {tPieces('piece') || '#'}
                      </th>
                      <th className="w-full px-3 py-3 text-sm font-semibold text-muted-foreground text-start">
                        {tPieces('notes') || 'Notes'}
                      </th>
                      <th className="px-2 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {pieces.map((piece) => (
                      <tr key={piece.id} className="border-b border-border last:border-b-0 hover:bg-muted">
                        <td className="px-3 py-3 align-middle text-start">
                          <span className="text-sm font-semibold text-muted-foreground">
                            {tPieces('pieceNumber', { number: piece.pieceSeq })}
                          </span>
                        </td>
                        <td className="w-full px-3 py-3 align-middle">
                          <input
                            type="text"
                            value={piece.notes ?? ''}
                            onChange={(e) => handleNotesChange(item, piece.id, e.target.value)}
                            placeholder={tPieces('notesPlaceholder') || 'Add notes...'}
                            className={commonInputClass}
                            aria-label={tPieces('notes') || 'Notes'}
                          />
                        </td>
                        <td className="px-2 py-2 align-middle text-center">
                          <button
                            type="button"
                            title={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                            aria-label={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyPieceToAll(item.productId, piece.id);
                            }}
                            className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground hover:text-primary-text hover:bg-info-bg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <span className="sr-only">{t('itemsGrid.item') || 'Item'}</span>
    </section>
  );
}
