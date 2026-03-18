/**
 * Item Cart Item Component
 * Enhanced cart item with inline conditions summary and piece table
 * PRD-010: Advanced Order Management
 */

'use client';

import { useState, memo, useCallback } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { Pencil, Trash2, AlertCircle, ChevronDown, ChevronUp, Plus, Copy } from 'lucide-react';
import { STAIN_CONDITIONS } from '@/lib/types/order-creation';
import type { PreSubmissionPiece } from './pre-submission-pieces-manager';

// Fallback hardcoded color options when no catalog is provided
const PIECE_COLORS_FALLBACK = [
  { code: 'black', name: 'Black', name2: null, color_hex: null },
  { code: 'white', name: 'White', name2: null, color_hex: null },
  { code: 'gray', name: 'Gray', name2: null, color_hex: null },
  { code: 'blue', name: 'Blue', name2: null, color_hex: null },
  { code: 'red', name: 'Red', name2: null, color_hex: null },
  { code: 'green', name: 'Green', name2: null, color_hex: null },
  { code: 'yellow', name: 'Yellow', name2: null, color_hex: null },
  { code: 'brown', name: 'Brown', name2: null, color_hex: null },
  { code: 'orange', name: 'Orange', name2: null, color_hex: null },
  { code: 'purple', name: 'Purple', name2: null, color_hex: null },
  { code: 'pink', name: 'Pink', name2: null, color_hex: null },
  { code: 'beige', name: 'Beige', name2: null, color_hex: null },
  { code: 'navy', name: 'Navy', name2: null, color_hex: null },
  { code: 'striped', name: 'Striped', name2: null, color_hex: null },
  { code: 'patterned', name: 'Patterned', name2: null, color_hex: null },
  { code: 'multicolor', name: 'Multi-color', name2: null, color_hex: null },
];

interface ColorCatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  color_hex?: string | null;
}

interface ItemCartItemProps {
  itemNumber: number;
  itemId: string;
  productName: string;
  productName2?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  conditions?: string[];
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  pieces?: PreSubmissionPiece[];
  serviceCategoryCode?: string;
  serviceCategoryName?: string;
  serviceCategoryName2?: string;
  onPiecesChange?: (pieces: PreSubmissionPiece[]) => void;
  onCopyPieceToAll?: (pieceId: string) => void;
  trackByPiece?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  priceOverride?: number | null;
  overrideReason?: string | null;
  currencyCode?: string;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  colorCatalog?: ColorCatalogEntry[];
}

function ItemCartItemComponent({
  itemNumber,
  itemId,
  productName,
  productName2,
  quantity,
  price,
  totalPrice,
  conditions = [],
  hasStain = false,
  hasDamage = false,
  notes,
  pieces = [],
  serviceCategoryCode,
  serviceCategoryName,
  serviceCategoryName2,
  onPiecesChange,
  onCopyPieceToAll,
  trackByPiece = false,
  onEdit,
  onDelete,
  priceOverride,
  overrideReason,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  selectedPieceId = null,
  onSelectPiece,
  colorCatalog,
}: ItemCartItemProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tPieces = useTranslations('newOrder.pieces');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const displayName = getBilingual(productName, productName2) || 'Unknown Product';
  const displayCategory = getBilingual(serviceCategoryName, serviceCategoryName2) || serviceCategoryCode;
  const [piecesExpanded, setPiecesExpanded] = useState(false);

  const showPieces = trackByPiece && pieces.length > 0;
  const implicitPieceId = `temp-${itemId}-1`;
  const isSelected = selectedPieceId === implicitPieceId || (showPieces && pieces.some((p) => p.id === selectedPieceId));

  // Catalog-derived option lists (fallback to STAIN_CONDITIONS for backward compat)
  const colorOptions: ColorCatalogEntry[] =
    colorCatalog && colorCatalog.length > 0 ? colorCatalog : PIECE_COLORS_FALLBACK;

  const damageOptions = STAIN_CONDITIONS.filter((c) => c.category === 'damage');
  const stainOptions = STAIN_CONDITIONS.filter((c) => c.category === 'stain');

  // Aggregate conditions across all pieces for summary text
  const allConditions = showPieces
    ? Array.from(new Set(pieces.flatMap((p) => p.conditions ?? [])))
    : conditions;
  const allNotes = showPieces
    ? pieces.map((p) => p.notes).filter(Boolean).join('; ')
    : notes;

  const conditionLabels = allConditions
    .map((c) => STAIN_CONDITIONS.find((s) => s.code === c)?.label ?? c)
    .filter(Boolean);
  const inlineSummary = [...conditionLabels, allNotes].filter(Boolean).join(' · ');

  const handleSelectPiece = useCallback(
    (pieceId: string) => { onSelectPiece?.(pieceId); },
    [onSelectPiece]
  );

  const updatePiece = useCallback(
    (pieceId: string, updates: Partial<PreSubmissionPiece>) => {
      if (!onPiecesChange) return;
      onPiecesChange(pieces.map((p) => p.id === pieceId ? { ...p, ...updates } : p));
    },
    [pieces, onPiecesChange]
  );

  return (
    <div
      className={`flex items-start gap-3 py-3 border-b border-gray-100 transition-colors group ${isRTL ? 'flex-row-reverse' : ''} ${
        onSelectPiece ? 'cursor-pointer hover:bg-gray-50' : ''
      } ${isSelected ? 'ring-2 ring-orange-500 ring-inset rounded-lg bg-orange-50/50' : ''}`}
      onClick={
        onSelectPiece && !showPieces && quantity === 1
          ? () => handleSelectPiece(implicitPieceId)
          : undefined
      }
      role={onSelectPiece && !showPieces && quantity === 1 ? 'button' : undefined}
    >
      {/* Item Number */}
      <div className="shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-700">
        {itemNumber}
      </div>

      {/* Item Details */}
      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Product Name + Actions */}
        <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex-1 min-w-0">
            <h4 className={`font-medium text-gray-900 text-sm line-clamp-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {displayName}
            </h4>
            {displayCategory && (
              <p className={`text-xs text-gray-500 mt-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
                {displayCategory}
              </p>
            )}
            {/* Inline conditions summary */}
            {inlineSummary && (
              <p className={`text-xs text-gray-500 mt-0.5 truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                {inlineSummary}
              </p>
            )}
          </div>

          <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                aria-label={tCommon('edit')}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              aria-label={tCommon('delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quantity and Price */}
        <div className={`flex items-center gap-2 text-sm text-gray-600 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="font-semibold">{quantity}x</span>
          <span>@{price.toFixed(3)} {currencyCode}</span>
          {priceOverride !== null && priceOverride !== undefined && (
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded" title={overrideReason || 'Price overridden'}>
              Override
            </span>
          )}
          <span className="mx-1">•</span>
          <span className="font-bold text-gray-900">{totalPrice.toFixed(3)} {currencyCode}</span>
        </div>

        {/* Conditions badges (non-piece-tracked items) */}
        {!showPieces && (hasStain || hasDamage || conditions.length > 0) && (
          <div className={`flex items-center gap-1.5 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
            <div className={`flex flex-wrap gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {conditions.slice(0, 3).map((condition) => (
                <span key={condition} className="inline-block px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-md">
                  {condition.replace('_', ' ')}
                </span>
              ))}
              {conditions.length > 3 && (
                <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-md">
                  +{conditions.length - 3} {t('more')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Notes (non-piece-tracked) */}
        {!showPieces && notes && (
          <p className={`text-xs text-gray-500 mt-1 italic line-clamp-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('note')}: {notes}
          </p>
        )}

        {/* Add first piece CTA */}
        {trackByPiece && pieces.length === 0 && onPiecesChange && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPiecesChange([{ id: `temp-${itemId}-1`, itemId, pieceSeq: 1 }]);
              }}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 text-gray-600 hover:text-blue-700 transition-colors min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Plus className="w-4 h-4" aria-hidden />
              <span className="text-sm font-medium">{tPieces('addFirstPiece') || 'Add a piece to track color, conditions, and notes'}</span>
            </button>
          </div>
        )}

        {/* Piece Table — expandable */}
        {showPieces && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              onClick={(e) => { e.stopPropagation(); setPiecesExpanded(!piecesExpanded); }}
              className={`w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <span>{tPieces('viewPieces')} ({pieces.length})</span>
              {piecesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {piecesExpanded && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[400px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className={`px-2 py-1.5 font-medium text-gray-600 text-center w-10 ${isRTL ? 'text-right' : 'text-left'}`}>#</th>
                      <th className={`px-2 py-1.5 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('color')}</th>
                      <th className={`px-2 py-1.5 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('hasDamage')}</th>
                      <th className={`px-2 py-1.5 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('hasStain')}</th>
                      <th className={`px-2 py-1.5 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('notes')}</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieces.map((piece) => {
                      const pieceColor = piece.color ?? '';
                      const pieceDamage = (piece.conditions ?? []).find((c) =>
                        damageOptions.some((d) => d.code === c)
                      ) ?? '';
                      const pieceStain = (piece.conditions ?? []).find((c) =>
                        stainOptions.some((s) => s.code === c)
                      ) ?? '';

                      return (
                        <tr
                          key={piece.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${piece.id === selectedPieceId ? 'bg-orange-50' : ''}`}
                          onClick={(e) => { e.stopPropagation(); onSelectPiece?.(piece.id); }}
                        >
                          <td className="px-2 py-1.5 text-center text-gray-600 font-medium">{piece.pieceSeq}</td>
                          <td className="px-2 py-1.5">
                            <select
                              value={pieceColor}
                              onChange={(e) => { e.stopPropagation(); updatePiece(piece.id, { color: e.target.value || undefined }); }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs px-1.5 py-1 border border-gray-200 rounded bg-white w-full"
                              dir={isRTL ? 'rtl' : 'ltr'}
                            >
                              <option value="">—</option>
                              {colorOptions.map((c) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={pieceDamage}
                              onChange={(e) => {
                                e.stopPropagation();
                                const other = (piece.conditions ?? []).filter((c) => !damageOptions.some((d) => d.code === c));
                                const next = e.target.value ? [...other, e.target.value] : other;
                                updatePiece(piece.id, { conditions: next });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs px-1.5 py-1 border border-gray-200 rounded bg-white w-full"
                              dir={isRTL ? 'rtl' : 'ltr'}
                            >
                              <option value="">—</option>
                              {damageOptions.map((d) => (
                                <option key={d.code} value={d.code}>{d.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={pieceStain}
                              onChange={(e) => {
                                e.stopPropagation();
                                const other = (piece.conditions ?? []).filter((c) => !stainOptions.some((s) => s.code === c));
                                const next = e.target.value ? [...other, e.target.value] : other;
                                updatePiece(piece.id, { conditions: next });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs px-1.5 py-1 border border-gray-200 rounded bg-white w-full"
                              dir={isRTL ? 'rtl' : 'ltr'}
                            >
                              <option value="">—</option>
                              {stainOptions.map((s) => (
                                <option key={s.code} value={s.code}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={piece.notes ?? ''}
                              onChange={(e) => { e.stopPropagation(); updatePiece(piece.id, { notes: e.target.value || undefined }); }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="..."
                              className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded"
                              dir={isRTL ? 'rtl' : 'ltr'}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {onCopyPieceToAll && (
                              <button
                                type="button"
                                title={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                                onClick={(e) => { e.stopPropagation(); onCopyPieceToAll(piece.id); }}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ItemCartItem = memo(ItemCartItemComponent);
