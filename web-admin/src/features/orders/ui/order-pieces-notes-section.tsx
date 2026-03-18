/**
 * Order Pieces Notes Section
 * "Edit Item Notes" tab — per-piece Color, Damage, Stains, Upcharge, Notes editor
 * PRD-010: Advanced Order Management
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { StainConditionToggles } from './stain-condition-toggles';
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
}

interface PieceRow {
  item: OrderItem;
  piece: PreSubmissionPiece;
  isFirst: boolean;
  itemRowSpan: number;
}

export function OrderPiecesNotesSection({
  conditionCatalog,
  servicePrefs,
  onCopyPieceToAll,
}: OrderPiecesNotesSectionProps) {
  const t = useTranslations('newOrder');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const { state, updateItemPieces, updatePieceConditions, updatePieceColor } = useNewOrderStateWithDispatch();

  const [showAllItems, setShowAllItems] = useState(false);
  const [focusedPieceId, setFocusedPieceId] = useState<string | null>(null);

  // Upcharge prefs: service prefs with extra price > 0
  const upchargePrefs = useMemo(
    () => servicePrefs.filter((p) => p.default_extra_price > 0),
    [servicePrefs]
  );

  // Derive display rows from order items
  const pieceRows = useMemo((): PieceRow[] => {
    const result: PieceRow[] = [];
    for (const item of state.items) {
      const pieces: PreSubmissionPiece[] =
        item.pieces && item.pieces.length > 0
          ? item.pieces
          : Array.from({ length: item.quantity }, (_, i) => ({
              id: `temp-${item.productId}-${i + 1}`,
              itemId: item.productId,
              pieceSeq: i + 1,
            }));

      // When showAllItems=false, skip items with only 1 piece
      if (!showAllItems && pieces.length === 1) continue;

      pieces.forEach((piece, idx) => {
        result.push({
          item,
          piece,
          isFirst: idx === 0,
          itemRowSpan: pieces.length,
        });
      });
    }
    return result;
  }, [state.items, showAllItems]);

  // Focused piece conditions for bottom palette
  const focusedConditions = useMemo(() => {
    if (!focusedPieceId) return [];
    for (const item of state.items) {
      const piece = item.pieces?.find((p) => p.id === focusedPieceId);
      if (piece) return piece.conditions ?? [];
    }
    return [];
  }, [focusedPieceId, state.items]);

  // Materialize pieces into state if not yet present (for virtual pieces from items without explicit pieces)
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

  // Update a single field on a piece
  const updatePieceField = useCallback(
    (item: OrderItem, pieceId: string, updates: Partial<PreSubmissionPiece>) => {
      const pieces = materializePieces(item);
      const updated = pieces.map((p) => (p.id === pieceId ? { ...p, ...updates } : p));
      updateItemPieces(item.productId, updated);
    },
    [materializePieces, updateItemPieces]
  );

  // Handle color change
  const handleColorChange = useCallback(
    (item: OrderItem, pieceId: string, colorCode: string) => {
      // If piece is already materialized, use the direct action; otherwise via updatePieceField
      if (item.pieces && item.pieces.some((p) => p.id === pieceId)) {
        updatePieceColor(pieceId, colorCode || undefined);
      } else {
        updatePieceField(item, pieceId, { color: colorCode || undefined });
      }
    },
    [updatePieceColor, updatePieceField]
  );

  // Handle damage change — replaces first damage slot in conditions[], preserves stains
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

  // Handle stain change — replaces first stain slot in conditions[], preserves damages
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

  // Handle upcharge change
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

  // Handle notes change
  const handleNotesChange = useCallback(
    (item: OrderItem, pieceId: string, notes: string) => {
      updatePieceField(item, pieceId, { notes: notes || undefined });
    },
    [updatePieceField]
  );

  // Handle bottom palette condition toggle for focused piece
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
    'block w-full rounded border border-gray-200 bg-white py-1.5 px-2 text-xs text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[90px]';
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
          onClick={() => setShowAllItems((v) => !v)}
        >
          {showAllItems ? tPieces('showMultiPieceOnly') || 'Multi-Piece Only' : tPieces('showAllItems') || 'Show All Items'}
        </CmxButton>
      </div>

      {/* Table */}
      {pieceRows.length === 0 ? (
        <div className={`text-center py-10 text-gray-500 space-y-3 ${isRTL ? 'text-right' : ''}`}>
          <p className="text-sm">{tPieces('noPiecesToShow') || 'No multi-piece items. Toggle "Show All Items" to view all.'}</p>
          <CmxButton variant="outline" size="sm" onClick={() => setShowAllItems(true)}>
            {tPieces('showAllItems') || 'Show All Items'}
          </CmxButton>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full text-xs border-collapse"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('itemsGrid.item') || 'Item'}
                  </th>
                  <th className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                    {tPieces('color') || 'Color'}
                  </th>
                  <th className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                    {tPieces('damage') || 'Damage'}
                  </th>
                  <th className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                    {tPieces('stains') || 'Stains'}
                  </th>
                  {upchargePrefs.length > 0 && (
                    <th className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                      {tPieces('upcharge') || 'Upcharge'}
                    </th>
                  )}
                  <th className={`px-3 py-2.5 font-semibold text-gray-600 w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                    {tPieces('notes') || 'Notes'}
                  </th>
                  <th className="px-3 py-2.5 w-10" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pieceRows.map(({ item, piece, isFirst, itemRowSpan }) => {
                  const isFocused = focusedPieceId === piece.id;
                  // Current selected damage (first damage code found in conditions)
                  const selectedDamage =
                    (piece.conditions ?? []).find((c) =>
                      conditionCatalog.damages.some((d) => d.code === c)
                    ) ?? '';
                  // Current selected stain
                  const selectedStain =
                    (piece.conditions ?? []).find((c) =>
                      conditionCatalog.stains.some((s) => s.code === c)
                    ) ?? '';
                  // Current upcharge pref
                  const selectedUpcharge =
                    (piece.servicePrefs ?? []).find((sp) =>
                      upchargePrefs.some((u) => u.code === sp.preference_code)
                    )?.preference_code ?? '';
                  // Color hex for swatch
                  const colorHex =
                    conditionCatalog.colors.find((c) => c.code === piece.color)?.color_hex ?? null;

                  return (
                    <tr
                      key={piece.id}
                      onClick={() => setFocusedPieceId(piece.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isFocused
                          ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Item column — only on first piece row */}
                      {isFirst && (
                        <td
                          rowSpan={itemRowSpan}
                          className={`px-3 py-2 align-top border-e border-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <div className="font-medium text-gray-900 leading-snug">
                            {getBilingual(item.productName, item.productName2) || '—'}
                          </div>
                          <div className="text-gray-400 text-[10px] mt-0.5">
                            {tPieces('pieceNumber', { number: piece.pieceSeq })}
                            {itemRowSpan > 1 && (
                              <span className="ms-1 text-gray-400">
                                ({itemRowSpan} {tPieces('pieces') || 'pcs'})
                              </span>
                            )}
                          </div>
                        </td>
                      )}

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
                        {/* Show additional selected damages as badges */}
                        {(() => {
                          const allDamages = (piece.conditions ?? []).filter((c) =>
                            conditionCatalog.damages.some((d) => d.code === c)
                          );
                          const extra = allDamages.slice(1);
                          if (extra.length === 0) return null;
                          return (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {extra.map((code) => {
                                const entry = conditionCatalog.damages.find((d) => d.code === code);
                                return (
                                  <span
                                    key={code}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px]"
                                  >
                                    {getBilingual(entry?.name, entry?.name2) || code}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Stains */}
                      <td className="px-3 py-2 align-middle">
                        <select
                          value={selectedStain}
                          onChange={(e) => handleStainChange(item, piece, e.target.value)}
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
                        {/* Show additional selected stains as badges */}
                        {(() => {
                          const allStains = (piece.conditions ?? []).filter((c) =>
                            conditionCatalog.stains.some((s) => s.code === c)
                          );
                          const extra = allStains.slice(1);
                          if (extra.length === 0) return null;
                          return (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {extra.map((code) => {
                                const entry = conditionCatalog.stains.find((s) => s.code === code);
                                return (
                                  <span
                                    key={code}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px]"
                                  >
                                    {getBilingual(entry?.name, entry?.name2) || code}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Upcharge */}
                      {upchargePrefs.length > 0 && (
                        <td className="px-3 py-2 align-middle">
                          <select
                            value={selectedUpcharge}
                            onChange={(e) => handleUpchargeChange(item, piece, e.target.value)}
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
                          placeholder={tPieces('notesPlaceholder') || 'Add notes...'}
                          className={commonInputClass}
                          aria-label={tPieces('notes') || 'Notes'}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>

                      {/* Copy button */}
                      <td className="px-2 py-2 align-middle text-center">
                        <button
                          type="button"
                          title={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                          aria-label={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyPieceToAll(item.productId, piece.id);
                          }}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
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
      )}

      {/* Bottom condition palette for focused piece */}
      {focusedPieceId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <p className="text-xs text-blue-600 font-medium mb-2">
            {tPieces('focusPieceHint') || 'Click a row to edit conditions in the palette below'}
          </p>
          <StainConditionToggles
            selectedConditions={focusedConditions}
            onConditionToggle={handleConditionToggle}
            stainCatalog={conditionCatalog.stains}
            damageCatalog={conditionCatalog.damages}
          />
        </div>
      )}
      {!focusedPieceId && pieceRows.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {tPieces('focusPieceHint') || 'Click a row to edit its conditions in the palette below'}
        </p>
      )}
    </section>
  );
}
