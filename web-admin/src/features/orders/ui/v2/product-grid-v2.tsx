/**
 * Product Grid V2 Component
 * Larger cards, capped columns, uses PreferencesPanelV2
 * Re-Design: PRD-010 Advanced Orders - V2 Enhancement
 */

'use client';

import { memo, useEffect, useRef } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ProductCardV2 } from './product-card-v2';
import { PreferencesPanelV2 } from './preferences-panel-v2';
import { Package } from 'lucide-react';

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

interface OrderItem {
  productId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  serviceCategoryCode?: string;
}

interface ProductGridV2Props {
  products: Product[];
  items: OrderItem[];
  express: boolean;
  currencyCode?: string;
  onAddItem: (product: Product) => void;
  onRemoveItem: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  selectedConditions?: string[];
  onConditionToggle?: (condition: string) => void;
  selectedPieceId?: string | null;
  enforcePrefCompatibility?: boolean;
  onOpenCustomItemModal?: () => void;
  onOpenPhotoCapture?: () => void;
}

export const ProductGridV2 = memo(function ProductGridV2({
  products,
  items,
  express,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  onAddItem,
  onRemoveItem,
  onQuantityChange,
  selectedConditions = [],
  onConditionToggle = () => {},
  selectedPieceId = null,
  enforcePrefCompatibility = false,
  onOpenCustomItemModal,
  onOpenPhotoCapture,
}: ProductGridV2Props) {
  const t = useTranslations('newOrder.itemsGrid');
  const isRTL = useRTL();

  const getItemQuantity = (productId: string): number => {
    const item = items.find((i) => i.productId === productId);
    return item?.quantity || 0;
  };

  const getItemPrice = (product: Product): number => {
    if (express && product.default_express_sell_price) {
      return product.default_express_sell_price;
    }
    return product.default_sell_price || 0;
  };

  const prefsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedPieceId && prefsPanelRef.current) {
      prefsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedPieceId]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <h2 className={`text-xl sm:text-2xl font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('selectItems')}
        </h2>

        {products.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-12 px-4 ${isRTL ? 'text-right' : 'text-center'}`}>
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-400" aria-hidden="true" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">
              {t('noProductsAvailable')}
            </h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm">
              {t('noProductsHint') || 'No products in this category. Try selecting another category above.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {products.map((product) => {
              const quantity = getItemQuantity(product.id);
              const price = getItemPrice(product);
              return (
                <ProductCardV2
                  key={product.id}
                  product={product}
                  quantity={quantity}
                  price={price}
                  express={express}
                  currencyCode={currencyCode}
                  onAdd={() => onAddItem(product)}
                  onIncrement={() => onQuantityChange(product.id, quantity + 1)}
                  onDecrement={() => onQuantityChange(product.id, quantity - 1)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Preferences Panel V2 */}
      <div ref={prefsPanelRef}>
        <PreferencesPanelV2
          selectedPieceId={selectedPieceId}
          selectedConditions={selectedConditions}
          onConditionToggle={onConditionToggle}
          enforcePrefCompatibility={enforcePrefCompatibility}
        />
      </div>
    </div>
  );
});
