/**
 * Product Card Component
 * Enhanced product card with quantity overlay and touch-friendly design
 * Re-Design: PRD-010 Advanced Orders - Section 3B
 */

'use client';

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
  product_image?: string | null;
  product_icon?: string | null;
}

interface ProductCardProps {
  product: Product;
  quantity: number;
  price: number;
  express: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function ProductCard({
  product,
  quantity,
  price,
  express,
  onAdd,
  onIncrement,
  onDecrement,
}: ProductCardProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tNewOrder = useTranslations('newOrder');
  const isRTL = useRTL();
  const getBilingual = useBilingual();

  const displayName = getBilingual(product.product_name, product.product_name2) || t('unknownProduct');

  const hasQuantity = quantity > 0;

  return (
    <div
      className={`
        relative border rounded-xl p-4 transition-all cursor-pointer
        min-h-[200px] flex flex-col
        ${
          hasQuantity
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
        }
      `}
    >
      {/* Quantity Overlay Badge - Top Right/Left */}
      {hasQuantity && (
        <div className={`absolute -top-2 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg z-10 border-2 border-white ${isRTL ? '-left-2' : '-right-2'}`}>
          {quantity}
        </div>
      )}

      {/* Product Image/Icon */}
      <div className="w-full aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {product.product_image ? (
          <img
            src={product.product_image}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : product.product_icon ? (
          <span className="text-5xl">{product.product_icon}</span>
        ) : (
          <span className="text-5xl">👔</span>
        )}
      </div>

      {/* Product Name */}
      <h3 className={`font-semibold text-sm mb-1 text-gray-900 line-clamp-2 flex-grow ${isRTL ? 'text-right' : 'text-left'}`}>
        {displayName}
      </h3>

      {/* Price */}
      <div className={`mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="text-blue-600 font-bold text-lg">
          {price.toFixed(3)} OMR
        </p>
        {express && (
          <span className="text-xs text-orange-600 font-medium">{tNewOrder('express.label')}</span>
        )}
      </div>

      {/* Action Buttons - Touch Friendly (min 44px) */}
      {hasQuantity ? (
        <div className={`flex items-center justify-between gap-2 mt-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Decrement Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDecrement();
            }}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors shadow-md"
            aria-label={t('decreaseQuantity')}
          >
            <Minus className="w-5 h-5" />
          </button>

          {/* Quantity Display */}
          <span className={`flex-1 text-center font-bold text-xl text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
            {quantity}
          </span>

          {/* Increment Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIncrement();
            }}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md"
            aria-label={t('increaseQuantity')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className={`w-full h-12 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <Plus className="w-5 h-5" />
          {t('add')}
        </button>
      )}
    </div>
  );
}
