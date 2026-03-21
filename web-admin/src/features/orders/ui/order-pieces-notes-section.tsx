/**
 * Order Pieces Notes Section
 * "Edit Item Notes" tab — per-item cards, each with a piece table inside
 * PRD-010: Advanced Order Management
 */

'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { PreferencesPanel } from './preferences-panel';
import { Copy } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { OrderItem, PreSubmissionPiece, OrderItemServicePref } from '../model/new-order-types';
import type { ServicePreference } from '@/lib/types/service-preferences';

interface CatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  color_hex?: string | null;
}

interface ConditionCatalog {
  stains: CatalogEntry[];
  damages: CatalogEntry[];
  colors: CatalogEntry[];
}

interface OrderPiecesNotesSectionProps {
  conditionCatalog: ConditionCatalog;
  servicePrefs: ServicePreference[];
  enforcePrefCompatibility?: boolean;
  currencyCode?: string;
  onCopyPieceToAll: (itemId: string, pieceId: string) => void;
  focusItemId?: string | null;
  onFocusItemHandled?: () => void;
}

interface ItemGroup {
  item: OrderItem;
  pieces: PreSubmissionPiece[];
}

export function OrderPiecesNotesSection({
  conditionCatalog,
  servicePrefs,
  onCopyPieceToAll,
  focusItemId,
  onFocusItemHandled,
}: OrderPiecesNotesSectionProps) {
  const t = useTranslations('newOrder');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const { state, updateItemPieces, updatePieceConditions, updatePieceColor } = useNewOrderStateWithDispatch();

  const [showAllItems, setShowAllItems] = useState(false);
  const [filterItemId, setFilterItemId] = useState<string | null>(null);
  const [focusedPieceId, setFocusedPieceId] = useState<string | null>(null);

  const itemCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!focusItemId) return;
    // Filter to only the focused item
    setFilterItemId(focusItemId);
    // Find the target item and its first piece
    const targetItem = state.items.find((item) => item.productId === focusItemId);
    if (targetItem) {
      const firstPiece = targetItem.pieces?.[0];
      if (firstPiece) {
        setFocusedPieceId(firstPiece.id);
      } else {
        setFocusedPieceId(`temp-${targetItem.productId}-1`);
      }
    }
    // Scroll after next render
    setTimeout(() => {
      const ref = itemCardRefs.current.get(focusItemId);
      if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onFocusItemHandled?.();
    }, 100);
  }, [focusItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Upcharge prefs: service prefs with extra price > 0
  const upchargePrefs = useMemo(
    () => servicePrefs.filter((p) => p.default_extra_price > 0),
    [servicePrefs]
  );

  // Group items with their pieces
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

  // Focused piece conditions for bottom palette
  const focusedConditions = useMemo(() => {
    if (!focusedPieceId) return [];
    for (const item of state.items) {
      const piece = item.pieces?.find((p) => p.id === focusedPieceId);
      if (piece) return piece.conditions ?? [];
    }
    return [];
  }, [focusedPieceId, state.items]);

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

  const handleColorChange = useCallback(
    (item: OrderItem, pieceId: string, colorCode: string) => {
      if (item.pieces && item.pieces.some((p) => p.id === pieceId)) {
        updatePieceColor(pieceId, colorCode || undefined);
      } else {
        updatePieceField(item, pieceId, { color: colorCode || undefined });
      }
    },
    [updatePieceColor, updatePieceField]
  );

  const handleDamageChange = useCallback(
    (item: OrderItem, piece: PreSubmissionPiece, damageCode: string) => {
      const other = (piece.conditions ?? []).filter(
        (c) => !conditionCatalog.damages.some((d) => d.code === c)
      );
      const next = damageCode ? [...other, damageCode] : other;
      if (item.pieces && item.pieces.some((p) => p.id === piece.id)) {
        updatePieceConditions(piece.id, next);
      } else {
        updatePieceField(item, piece.id, { conditions: next });
      }
    },
    [conditionCatalog.damages, updatePieceConditions, updatePieceField]
  );

  const handleStainChange = useCallback(
    (item: OrderItem, piece: PreSubmissionPiece, stainCode: string) => {
      const other = (piece.conditions ?? []).filter(
        (c) => !conditionCatalog.stains.some((s) => s.code === c)
      );
      const next = stainCode ? [...other, stainCode] : other;
      if (item.pieces && item.pieces.some((p) => p.id === piece.id)) {
        updatePieceConditions(piece.id, next);
      } else {
        updatePieceField(item, piece.id, { conditions: next });
      }
    },
    [conditionCatalog.stains, updatePieceConditions, updatePieceField]
  );

  const handleUpchargeChange = useCallback(
    (item: OrderItem, piece: PreSubmissionPiece, prefCode: string) => {
      const pref = upchargePrefs.find((p) => p.code === prefCode);
      const newServicePrefs: OrderItemServicePref[] = pref
        ? [{ preference_code: pref.code, source: 'manual', extra_price: pref.default_extra_price }]
        : [];
      updatePieceField(item, piece.id, { servicePrefs: newServicePrefs });
    },
    [upchargePrefs, updatePieceField]
  );

  const handleNotesChange = useCallback(
    (item: OrderItem, pieceId: string, notes: string) => {
      updatePieceField(item, pieceId, { notes: notes || undefined });
    },
    [updatePieceField]
  );

  const handleConditionToggle = useCallback(
    (conditionCode: string) => {
      if (!focusedPieceId) return;
      const next = focusedConditions.includes(conditionCode)
        ? focusedConditions.filter((c) => c !== conditionCode)
        : [...focusedConditions, conditionCode];
      updatePieceConditions(focusedPieceId, next);
    },
    [focusedPieceId, focusedConditions, updatePieceConditions]
  );

  const commonSelectClass =
    'block w-full rounded border border-gray-200 bg-white py-1.5 px-2 text-xs text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[80px]';
  const commonInputClass =
    'block w-full rounded border border-gray-200 bg-white py-1.5 px-2 text-xs text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  return (
    <section aria-label={tPieces('editItemNotes') || 'Edit Item Notes'} className="space-y-4">
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-base font-semibold text-gray-900">{tPieces('editItemNotes') || 'Edit Item Notes'}</h2>
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

      {/* Empty state */}
      {itemGroups.length === 0 ? (
        <div className={`text-center py-10 text-gray-500 space-y-3 ${isRTL ? 'text-right' : ''}`}>
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
              className="rounded-lg border border-gray-200 overflow-hidden"
              ref={(el) => {
                if (el) itemCardRefs.current.set(item.productId, el);
                else itemCardRefs.current.delete(item.productId);
              }}
            >
              {/* Item header */}
              <div className={`flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Item number badge */}
                <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">
                  {groupIndex + 1}
                </span>
                {/* Item name */}
                <span className={`flex-1 font-semibold text-sm text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {getBilingual(item.productName, item.productName2) || '—'}
                </span>
                {/* Pieces count badge */}
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  ×{pieces.length} {tPieces('pieces') || 'pcs'}
                </span>
              </div>

              {/* Piece rows table */}
              <div className="overflow-x-auto">
                <table
                  className="w-full text-xs border-collapse"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className={`px-3 py-2 font-semibold text-gray-500 whitespace-nowrap w-16 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {tPieces('piece') || '#'}
                      </th>
                      <th className={`px-3 py-2 font-semibold text-gray-500 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                        {tPieces('color') || 'Color'}
                      </th>
                      <th className={`px-3 py-2 font-semibold text-gray-500 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                        {tPieces('damage') || 'Damage'}
                      </th>
                      <th className={`px-3 py-2 font-semibold text-gray-500 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                        {tPieces('stains') || 'Stains'}
                      </th>
                      {upchargePrefs.length > 0 && (
                        <th className={`px-3 py-2 font-semibold text-gray-500 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                          {tPieces('upcharge') || 'Upcharge'}
                        </th>
                      )}
                      <th className={`px-3 py-2 font-semibold text-gray-500 w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                        {tPieces('notes') || 'Notes'}
                      </th>
                      <th className="px-2 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {pieces.map((piece) => {
                      const isFocused = focusedPieceId === piece.id;
                      const selectedDamage =
                        (piece.conditions ?? []).find((c) =>
                          conditionCatalog.damages.some((d) => d.code === c)
                        ) ?? '';
                      const selectedStain =
                        (piece.conditions ?? []).find((c) =>
                          conditionCatalog.stains.some((s) => s.code === c)
                        ) ?? '';
                      const selectedUpcharge =
                        (piece.servicePrefs ?? []).find((sp) =>
                          upchargePrefs.some((u) => u.code === sp.preference_code)
                        )?.preference_code ?? '';
                      const colorHex =
                        conditionCatalog.colors.find((c) => c.code === piece.color)?.color_hex ?? null;

                      return (
                        <tr
                          key={piece.id}
                          onClick={() => setFocusedPieceId(isFocused ? null : piece.id)}
                          className={`border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors ${
                            isFocused
                              ? 'bg-blue-50 outline outline-2 outline-blue-400 outline-offset-[-2px]'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Piece number */}
                          <td className={`px-3 py-2 align-middle ${isRTL ? 'text-right' : 'text-left'}`}>
                            <span className={`text-xs font-semibold ${isFocused ? 'text-blue-600' : 'text-gray-500'}`}>
                              {tPieces('pieceNumber', { number: piece.pieceSeq })}
                            </span>
                          </td>

                          {/* Color */}
                          <td className="px-3 py-2 align-middle">
                            <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {colorHex ? (
                                <span
                                  className="inline-block w-3 h-3 rounded-full shrink-0 border border-gray-300"
                                  style={{ backgroundColor: colorHex }}
                                  aria-hidden
                                />
                              ) : piece.color ? (
                                <span className="inline-block w-3 h-3 rounded-full shrink-0 border border-gray-300 bg-gray-300" aria-hidden />
                              ) : null}
                              <select
                                value={piece.color ?? ''}
                                onChange={(e) => handleColorChange(item, piece.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={commonSelectClass}
                                aria-label={tPieces('color') || 'Color'}
                              >
                                <option value="">—</option>
                                {conditionCatalog.colors.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {getBilingual(c.name, c.name2) || c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Damage */}
                          <td className="px-3 py-2 align-middle">
                            <select
                              value={selectedDamage}
                              onChange={(e) => handleDamageChange(item, piece, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className={commonSelectClass}
                              aria-label={tPieces('damage') || 'Damage'}
                            >
                              <option value="">—</option>
                              {conditionCatalog.damages.map((d) => (
                                <option key={d.code} value={d.code}>
                                  {getBilingual(d.name, d.name2) || d.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Stains */}
                          <td className="px-3 py-2 align-middle">
                            <select
                              value={selectedStain}
                              onChange={(e) => handleStainChange(item, piece, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className={commonSelectClass}
                              aria-label={tPieces('stains') || 'Stains'}
                            >
                              <option value="">—</option>
                              {conditionCatalog.stains.map((s) => (
                                <option key={s.code} value={s.code}>
                                  {getBilingual(s.name, s.name2) || s.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Upcharge */}
                          {upchargePrefs.length > 0 && (
                            <td className="px-3 py-2 align-middle">
                              <select
                                value={selectedUpcharge}
                                onChange={(e) => handleUpchargeChange(item, piece, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={commonSelectClass}
                                aria-label={tPieces('upcharge') || 'Upcharge'}
                              >
                                <option value="">{tPieces('addUpcharge') || 'Add upcharge'}</option>
                                {upchargePrefs.map((p) => (
                                  <option key={p.code} value={p.code}>
                                    {getBilingual(p.name, p.name2) || p.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}

                          {/* Notes */}
                          <td className="px-3 py-2 align-middle w-full">
                            <input
                              type="text"
                              value={piece.notes ?? ''}
                              onChange={(e) => handleNotesChange(item, piece.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder={tPieces('notesPlaceholder') || 'Add notes...'}
                              className={commonInputClass}
                              aria-label={tPieces('notes') || 'Notes'}
                            />
                          </td>

                          {/* Copy */}
                          <td className="px-2 py-2 align-middle text-center">
                            <button
                              type="button"
                              title={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                              aria-label={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopyPieceToAll(item.productId, piece.id);
                              }}
                              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom condition palette — always mounted so data is pre-fetched; shows hint when no piece focused */}
      {itemGroups.length > 0 && (
        <div className={`rounded-lg border transition-colors ${focusedPieceId ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-white'}`}>
          {focusedPieceId && (
            <p className={`text-xs text-blue-600 font-medium px-3 pt-3 pb-0 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tPieces('focusPieceHint') || 'Click a row to edit its conditions in the palette below'}
            </p>
          )}
          <PreferencesPanel
            selectedPieceId={focusedPieceId}
            selectedConditions={focusedConditions}
            onConditionToggle={handleConditionToggle}
            enforcePrefCompatibility={false}
          />
        </div>
      )}

      {/* i18n key reference — used for menu label */}
      <span className="sr-only">{t('itemsGrid.item') || 'Item'}</span>
    </section>
  );
}
