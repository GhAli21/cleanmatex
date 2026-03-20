/**
 * Summary Cart Item Component
 * POS-style cart item for the Order Summary right panel
 * Matches the Order_Summary_Item_Summary_02 design:
 *   seq | ✏ name | price ✏ 🗑
 *   conditions / notes as teal text lines
 */

'use client';

import { memo, useMemo } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { Pencil, Trash2 } from 'lucide-react';
import { STAIN_CONDITIONS } from '@/lib/types/order-creation';
import type { PreSubmissionPiece } from './pre-submission-pieces-manager';

interface ColorCatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  color_hex?: string | null;
}

interface SummaryCartItemProps {
  itemNumber: number;
  itemId: string;
  productName: string;
  productName2?: string;
  quantity: number;
  totalPrice: number;
  conditions?: string[];
  notes?: string;
  pieces?: PreSubmissionPiece[];
  priceOverride?: number | null;
  overrideReason?: string | null;
  currencyCode?: string;
  trackByPiece?: boolean;
  colorCatalog?: ColorCatalogEntry[];
  onEditPrice?: () => void;
  onEditNotes?: () => void;
  onDelete: () => void;
}

function SummaryCartItemComponent({
  itemNumber,
  productName,
  productName2,
  quantity,
  totalPrice,
  conditions = [],
  notes,
  pieces = [],
  priceOverride,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  trackByPiece = false,
  colorCatalog,
  onEditPrice,
  onEditNotes,
  onDelete,
}: SummaryCartItemProps) {
  const isRTL = useRTL();
  const getBilingual = useBilingual();

  const displayName = getBilingual(productName, productName2) || '—';

  // Build condition/notes text lines
  const conditionLines = useMemo((): string[] => {
    const colorOptions = colorCatalog && colorCatalog.length > 0 ? colorCatalog : [];

    if (trackByPiece && pieces.length > 0) {
      return pieces.map((piece) => {
        const parts: string[] = [];
        if (piece.color) {
          const colorEntry = colorOptions.find((c) => c.code === piece.color);
          parts.push(colorEntry ? (getBilingual(colorEntry.name, colorEntry.name2 ?? undefined) || colorEntry.name) : piece.color);
        }
        (piece.conditions ?? []).forEach((code) => {
          const cond = STAIN_CONDITIONS.find((s) => s.code === code);
          parts.push(cond ? cond.label : code.replace(/_/g, ' '));
        });
        if (piece.notes) parts.push(piece.notes);
        return parts.join('/');
      }).filter(Boolean);
    }

    // Item-level conditions
    const parts: string[] = conditions.map((code) => {
      const cond = STAIN_CONDITIONS.find((s) => s.code === code);
      return cond ? cond.label : code.replace(/_/g, ' ');
    });
    if (notes) parts.push(notes);
    return parts.length > 0 ? [parts.join('/')] : [];
  }, [trackByPiece, pieces, conditions, notes, colorCatalog, getBilingual]);

  const displayPrice = totalPrice.toFixed(3);

  return (
    <div className={`border-b border-dashed border-gray-200 last:border-b-0 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Main row */}
      <div className={`flex items-center gap-1 px-2 py-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Seq / quantity */}
        <span className="shrink-0 w-5 text-xs font-bold text-gray-700 text-center">
          {quantity}
        </span>

        {/* Pen — edit notes/pieces */}
        {onEditNotes && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditNotes(); }}
            className="shrink-0 p-0.5 text-gray-300 hover:text-purple-500 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-purple-400"
            title="Edit notes / pieces"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}

        {/* Item name */}
        <span className={`flex-1 min-w-0 text-sm text-gray-800 truncate ${isRTL ? 'text-right' : 'text-left'}`}>
          {displayName}
          {priceOverride !== null && priceOverride !== undefined && (
            <span className="ms-1 text-xs text-orange-500" title={`Price overridden${priceOverride ? `: ${priceOverride.toFixed(3)} ${currencyCode}` : ''}`}>*</span>
          )}
        </span>

        {/* Item number badge */}
        <span className="shrink-0 text-[10px] text-gray-400 hidden sm:inline">{itemNumber}</span>

        {/* Price */}
        <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
          {displayPrice}
        </span>

        {/* Pen — edit price override */}
        {onEditPrice && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditPrice(); }}
            className="shrink-0 p-0.5 text-gray-300 hover:text-blue-500 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            title="Override price"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 p-0.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
          title="Remove item"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Condition / notes lines */}
      {conditionLines.length > 0 && (
        <div className={`px-2 pb-1.5 ${isRTL ? 'pe-8 text-right' : 'ps-8'}`}>
          {conditionLines.map((line, i) => (
            <p key={i} className="text-xs text-teal-600 leading-snug">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export const SummaryCartItem = memo(SummaryCartItemComponent);
