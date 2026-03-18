/**
 * Product Card V2 Component
 * Larger touch-friendly product card for v2 new order UI
 * Re-Design: PRD-010 Advanced Orders - V2 Enhancement
 */

'use client';

import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { Plus, Minus } from 'lucide-react';

interface Product {
  id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  default_sell_price: number | null;
  default_express_sell_price: number | null;
  service_category_code: string | null;
  product_image?: string | null;
  product_icon?: string | null;
}

interface ProductCardV2Props {
  product: Product;
  quantity: number;
  price: number;
  express: boolean;
  currencyCode?: string;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function ProductCardV2({
  product,
  quantity,
  price,
  express,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  onAdd,
  onIncrement,
  onDecrement,
}: ProductCardV2Props) {
  const t = useTranslations('newOrder.itemsGrid');
  const tNewOrder = useTranslations('newOrder');
  const isRTL = useRTL();
  const getBilingual = useBilingual();

  const displayName = getBilingual(product.product_name, product.product_name2) || t('unknownProduct');
  const hasQuantity = quantity > 0;

  return (
    <div
      className={`
        relative border rounded-lg p-3 transition-all duration-150 cursor-pointer
        flex flex-col
        hover:scale-[1.02] active:scale-[0.98]
        ${
          hasQuantity
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
        }
      `}
    >
      {/* Quantity Overlay Badge */}
      {hasQuantity && (
        <div
          key={quantity}
          className="absolute -top-2 -end-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base shadow-lg z-10 border-2 border-white animate-in zoom-in-50 duration-200"
        >
          {quantity}
        </div>
      )}

      {/* Product Image/Icon */}
      <div className="w-full h-16 bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden shrink-0">
        {product.product_image ? (
          <img
            src={product.product_image}
            alt={displayName}
            className="w-full h-full object-contain p-1"
          />
        ) : product.product_icon ? (
          <i className={`mdi ${product.product_icon} text-3xl text-gray-600`} />
        ) : (
          <i className="mdi mdi-hanger text-3xl text-gray-400" />
        )}
      </div>

      {/* Product Name */}
      <h3 className={`font-medium text-sm mb-1 text-gray-900 line-clamp-2 grow ${isRTL ? 'text-right' : 'text-left'}`}>
        {displayName}
      </h3>

      {/* Price */}
      <div className={`mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="text-blue-600 font-bold text-sm">
          {price.toFixed(3)} {currencyCode}
        </p>
        {express && (
          <span className="text-xs text-orange-600 font-medium">{tNewOrder('express.label')}</span>
        )}
      </div>

      {/* Action Buttons */}
      {hasQuantity ? (
        <div className={`flex items-center justify-between gap-2 mt-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onDecrement(); }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label={t('decreaseQuantity')}
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className={`flex-1 text-center font-bold text-xl text-gray-900`}>
            {quantity}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onIncrement(); }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={t('increaseQuantity')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className={`w-full min-h-[44px] px-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${isRTL ? 'flex-row-reverse' : ''}`}
          aria-label={t('add') || 'Add item'}
        >
          <Plus className="w-3 h-3" aria-hidden />
          {t('add')}
        </button>
      )}
    </div>
  );
}
