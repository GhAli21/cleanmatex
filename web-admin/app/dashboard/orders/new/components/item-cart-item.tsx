/**
 * Item Cart Item Component
 * Individual line item in the order cart with edit/delete actions
 * Re-Design: PRD-010 Advanced Orders - Section 4
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { Pencil, Trash2, AlertCircle } from 'lucide-react';

interface ItemCartItemProps {
  itemNumber: number;
  productName: string;
  productName2?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  conditions?: string[];
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  onEdit?: () => void;
  onDelete: () => void;
}

export function ItemCartItem({
  itemNumber,
  productName,
  productName2,
  quantity,
  price,
  totalPrice,
  conditions = [],
  hasStain = false,
  hasDamage = false,
  notes,
  onEdit,
  onDelete,
}: ItemCartItemProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const displayName = getBilingual(productName, productName2) || 'Unknown Product';

  const hasIssues = hasStain || hasDamage || conditions.length > 0;

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
          <h4 className={`font-medium text-gray-900 text-sm line-clamp-1 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {displayName}
          </h4>

          {/* Actions - Show on hover or always on mobile */}
          <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                aria-label={tCommon('edit')}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
              aria-label={tCommon('delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quantity and Price */}
        <div className={`flex items-center gap-2 text-sm text-gray-600 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="font-semibold">{quantity}x</span>
          <span>@{price.toFixed(3)} OMR</span>
          <span className="mx-1">•</span>
          <span className="font-bold text-gray-900">{totalPrice.toFixed(3)} OMR</span>
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
      </div>
    </div>
  );
}
