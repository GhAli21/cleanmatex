/**
 * Item Cart Item Component
 * Individual line item in the order cart with edit/delete actions
 * Re-Design: PRD-010 Advanced Orders - Section 4
 */

'use client';

import { useState, memo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { Pencil, Trash2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { PreSubmissionPiecesManager, type PreSubmissionPiece } from './pre-submission-pieces-manager';

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
  trackByPiece?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  priceOverride?: number | null;
  overrideReason?: string | null;
  currencyCode?: string;
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
  trackByPiece = false,
  onEdit,
  onDelete,
  priceOverride,
  overrideReason,
  currencyCode = 'OMR',
}: ItemCartItemProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tPieces = useTranslations('newOrder.pieces');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const displayName = getBilingual(productName, productName2) || 'Unknown Product';
  const displayCategory = getBilingual(serviceCategoryName, serviceCategoryName2) || serviceCategoryCode;
  const [piecesExpanded, setPiecesExpanded] = useState(false);

  const hasIssues = hasStain || hasDamage || conditions.length > 0;
  const showPieces = trackByPiece && pieces.length > 0;

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Item Number */}
      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-700">
        {itemNumber}
      </div>

      {/* Item Details */}
      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Product Name */}
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
          </div>

          {/* Actions - Show on hover or always on mobile */}
          <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                aria-label={tCommon('edit')}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onDelete}
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
          {/* Price source indicator - will be populated when pricing service integration is complete */}
        </div>

        {/* Conditions/Issues */}
        {hasIssues && (
          <div className={`flex items-center gap-1.5 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <div className={`flex flex-wrap gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {conditions.slice(0, 3).map((condition) => (
                <span
                  key={condition}
                  className="inline-block px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-md"
                >
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

        {/* Notes */}
        {notes && (
          <p className={`text-xs text-gray-500 mt-1 italic line-clamp-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('note')}: {notes}
          </p>
        )}

        {/* Pieces Section - Expandable */}
        {showPieces && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              onClick={() => setPiecesExpanded(!piecesExpanded)}
              className={`w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <span>
                {tPieces('viewPieces')} ({pieces.length})
              </span>
              {piecesExpanded ? (
                <ChevronUp className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              ) : (
                <ChevronDown className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              )}
            </button>

            {piecesExpanded && onPiecesChange && (
              <PreSubmissionPiecesManager
                pieces={pieces}
                itemId={itemId}
                onPiecesChange={onPiecesChange}
                readOnly={false}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ItemCartItem = memo(ItemCartItemComponent);
