/**
 * Product Grid Component
 * Display products in a grid with add/remove functionality
 * Re-Design: PRD-010 Advanced Orders - Enhanced with ProductCard and StainConditionToggles
 */

'use client';

import { memo } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ProductCard } from './product-card';
import { StainConditionToggles } from './stain-condition-toggles';
import { Plus, Camera } from 'lucide-react';

/** Set to true to show the "Custom Item" button in the product grid. */
const SHOW_CUSTOM_ITEM = false;
/** Set to true to show the "Photo / Capture item" button in the product grid. */
const SHOW_PHOTO_CAPTURE = false;

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

interface ProductGridProps {
  products: Product[];
  items: OrderItem[];
  express: boolean;
  currencyCode?: string;
  onAddItem: (product: Product) => void;
  onRemoveItem: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  selectedConditions?: string[];
  onConditionToggle?: (condition: string) => void;
  onOpenCustomItemModal?: () => void;
  onOpenPhotoCapture?: () => void;
}

export const ProductGrid = memo(function ProductGrid({
  products,
  items,
  express,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  onAddItem,
  onRemoveItem,
  onQuantityChange,
  selectedConditions = [],
  onConditionToggle = () => {},
  onOpenCustomItemModal,
  onOpenPhotoCapture,
}: ProductGridProps) {
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

  const hasItems = items.length > 0;

  return (
    <div className="space-y-4">
      {/* Product Grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <h2 className={`text-xl font-semibold mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('selectItems')}</h2>

        {products.length === 0 ? (
          <div className={`${isRTL ? 'text-right' : 'text-center'} py-12 text-gray-500`}>
            <p>{t('noProductsAvailable')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
            {/* Product Cards */}
            {products.map((product) => {
              const quantity = getItemQuantity(product.id);
              const price = getItemPrice(product);

              return (
                <ProductCard
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

            {/* Custom Item Button - hidden for now; set SHOW_CUSTOM_ITEM to true to re-enable */}
            {SHOW_CUSTOM_ITEM && (
              <button
                onClick={onOpenCustomItemModal}
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all min-h-[200px] flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Plus className="w-8 h-8" />
                </div>
                <span className="font-semibold">{t('customItem')}</span>
                <span className="text-xs text-gray-500">{t('describeItem')}</span>
              </button>
            )}

            {/* Photo Button - hidden for now; set SHOW_PHOTO_CAPTURE to true to re-enable */}
            {SHOW_PHOTO_CAPTURE && (
              <button
                onClick={onOpenPhotoCapture}
                disabled={!onOpenPhotoCapture}
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-green-500 hover:bg-green-50 transition-all min-h-[200px] flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:border-green-500 disabled:focus:ring-0"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8" />
                </div>
                <span className="font-semibold">{t('addPhoto')}</span>
                <span className="text-xs text-gray-500">{t('captureItem')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stain/Condition Toggles Section */}
      <StainConditionToggles
        selectedConditions={selectedConditions}
        onConditionToggle={onConditionToggle}
        disabled={!hasItems}
      />
    </div>
  );
});
