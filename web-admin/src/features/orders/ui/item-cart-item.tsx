/**
 * Item Cart Item Component
 * POS-style cart item: qty | name | price, conditions as teal slash-separated text
 * PRD-010: Advanced Order Management
 */

'use client';

import { memo, useCallback } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { Trash2, Plus, Copy } from 'lucide-react';
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
  price: _price,
  totalPrice,
  conditions = [],
  hasStain: _hasStain = false,
  hasDamage: _hasDamage = false,
  notes,
  pieces = [],
  serviceCategoryCode: _serviceCategoryCode,
  serviceCategoryName: _serviceCategoryName,
  serviceCategoryName2: _serviceCategoryName2,
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
  const tPieces = useTranslations('newOrder.pieces');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const displayName = getBilingual(productName, productName2) || 'Unknown Product';

  const showPieces = trackByPiece && pieces.length > 0;
  const implicitPieceId = `temp-${itemId}-1`;
  const isSelected = selectedPieceId === implicitPieceId || (showPieces && pieces.some((p) => p.id === selectedPieceId));

  const colorOptions: ColorCatalogEntry[] =
    colorCatalog && colorCatalog.length > 0 ? colorCatalog : PIECE_COLORS_FALLBACK;

  const damageOptions = STAIN_CONDITIONS.filter((c) => c.category === 'damage');
  const stainOptions = STAIN_CONDITIONS.filter((c) => c.category === 'stain');

  // Build per-piece condition lines (teal slash-separated)
  const pieceConditionLines: string[] = showPieces
    ? pieces.map((piece) => {
        const parts: string[] = [];
        if (piece.color) {
          const colorEntry = colorOptions.find((c) => c.code === piece.color);
          parts.push(colorEntry ? getBilingual(colorEntry.name, colorEntry.name2 ?? undefined) || colorEntry.name : piece.color);
        }
        (piece.conditions ?? []).forEach((code) => {
          const cond = STAIN_CONDITIONS.find((s) => s.code === code);
          parts.push(cond ? cond.label : code.replace(/_/g, ' '));
        });
        if (piece.notes) parts.push(piece.notes);
        return parts.join('/');
      }).filter(Boolean)
    : (() => {
        const parts: string[] = conditions.map((code) => {
          const cond = STAIN_CONDITIONS.find((s) => s.code === code);
          return cond ? cond.label : code.replace(/_/g, ' ');
        });
        if (notes) parts.push(notes);
        return parts.length > 0 ? [parts.join('/')] : [];
      })();

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
      className={`py-2 border-b border-gray-100 transition-colors ${isRTL ? '' : ''} ${
        onSelectPiece ? 'cursor-pointer' : ''
      } ${isSelected ? 'bg-orange-50/50' : 'hover:bg-gray-50'}`}
      onClick={
        onSelectPiece && !showPieces && quantity === 1
          ? () => handleSelectPiece(implicitPieceId)
          : undefined
      }
      role={onSelectPiece && !showPieces && quantity === 1 ? 'button' : undefined}
    >
      {/* Main row: qty | name | price | delete */}
      <div className={`flex items-center gap-2 px-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Item number / quantity */}
        <span className="shrink-0 w-5 text-sm font-bold text-gray-800 text-center">
          {quantity}
        </span>

        {/* Product name */}
        <span className={`flex-1 min-w-0 text-sm text-gray-800 truncate ${isRTL ? 'text-right' : 'text-left'}`}>
          {displayName}
          {priceOverride !== null && priceOverride !== undefined && (
            <span className="ml-1 text-xs text-orange-600" title={overrideReason || 'Price overridden'}>*</span>
          )}
        </span>

        {/* Total price */}
        <span className="shrink-0 text-sm font-semibold text-gray-900">
          {totalPrice.toFixed(2)}
        </span>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-red-500"
          aria-label={tCommon('delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Condition lines — teal, slash-separated, per piece */}
      {pieceConditionLines.length > 0 && (
        <div className={`px-2 mt-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
          {pieceConditionLines.map((line, i) => (
            <p key={i} className="text-xs text-teal-600 leading-tight truncate">
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Item number badge (small, subtle) */}
      <div className={`px-2 mt-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
        <span className="text-xs text-gray-400">{itemNumber}</span>
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="ml-2 text-xs text-blue-500 hover:text-blue-700 transition-colors"
            aria-label={tCommon('edit')}
          >
            {tCommon('edit')}
          </button>
        )}
      </div>

      {/* Add first piece CTA */}
      {trackByPiece && pieces.length === 0 && onPiecesChange && (
        <div className="mx-2 mt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPiecesChange([{ id: `temp-${itemId}-1`, itemId, pieceSeq: 1 }]);
            }}
            className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 text-gray-500 hover:text-blue-700 transition-colors text-xs ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-3 h-3" aria-hidden />
            <span>{tPieces('addFirstPiece') || 'Add piece'}</span>
          </button>
        </div>
      )}

      {/* Piece count indicator (no expand table — use Pieces tab for editing) */}
      {showPieces && (
        <div className="mx-2 mt-1 border-t border-gray-100 pt-1">
          <span className="text-xs text-gray-400">{tPieces('viewPieces')} ({pieces.length})</span>

          {false && (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[360px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className={`px-1.5 py-1 font-medium text-gray-600 text-center w-8 ${isRTL ? 'text-right' : 'text-left'}`}>#</th>
                    <th className={`px-1.5 py-1 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('color')}</th>
                    <th className={`px-1.5 py-1 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('hasDamage')}</th>
                    <th className={`px-1.5 py-1 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('hasStain')}</th>
                    <th className={`px-1.5 py-1 font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{tPieces('notes')}</th>
                    <th className="px-1.5 py-1 w-6"></th>
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
                        <td className="px-1.5 py-1 text-center text-gray-600 font-medium">{piece.pieceSeq}</td>
                        <td className="px-1.5 py-1">
                          <select
                            value={pieceColor}
                            onChange={(e) => { e.stopPropagation(); updatePiece(piece.id, { color: e.target.value || undefined }); }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-1 py-0.5 border border-gray-200 rounded bg-white w-full"
                            dir={isRTL ? 'rtl' : 'ltr'}
                          >
                            <option value="">—</option>
                            {colorOptions.map((c) => (
                              <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-1">
                          <select
                            value={pieceDamage}
                            onChange={(e) => {
                              e.stopPropagation();
                              const other = (piece.conditions ?? []).filter((c) => !damageOptions.some((d) => d.code === c));
                              const next = e.target.value ? [...other, e.target.value] : other;
                              updatePiece(piece.id, { conditions: next });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-1 py-0.5 border border-gray-200 rounded bg-white w-full"
                            dir={isRTL ? 'rtl' : 'ltr'}
                          >
                            <option value="">—</option>
                            {damageOptions.map((d) => (
                              <option key={d.code} value={d.code}>{d.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-1">
                          <select
                            value={pieceStain}
                            onChange={(e) => {
                              e.stopPropagation();
                              const other = (piece.conditions ?? []).filter((c) => !stainOptions.some((s) => s.code === c));
                              const next = e.target.value ? [...other, e.target.value] : other;
                              updatePiece(piece.id, { conditions: next });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-1 py-0.5 border border-gray-200 rounded bg-white w-full"
                            dir={isRTL ? 'rtl' : 'ltr'}
                          >
                            <option value="">—</option>
                            {stainOptions.map((s) => (
                              <option key={s.code} value={s.code}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-1">
                          <input
                            type="text"
                            value={piece.notes ?? ''}
                            onChange={(e) => { e.stopPropagation(); updatePiece(piece.id, { notes: e.target.value || undefined }); }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="..."
                            className="w-full px-1 py-0.5 text-xs border border-gray-200 rounded"
                            dir={isRTL ? 'rtl' : 'ltr'}
                          />
                        </td>
                        <td className="px-1.5 py-1 text-center">
                          {onCopyPieceToAll && (
                            <button
                              type="button"
                              title={tPieces('copyToAllPieces') || 'Copy to all pieces'}
                              onClick={(e) => { e.stopPropagation(); onCopyPieceToAll(piece.id); }}
                              className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Copy className="w-3 h-3" />
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
  );
}

export const ItemCartItem = memo(ItemCartItemComponent);
