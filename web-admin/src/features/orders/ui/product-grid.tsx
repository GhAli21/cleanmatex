/**
 * Product Grid Component
 * Display products in a grid with add/remove functionality
 * Re-Design: PRD-010 Advanced Orders - Enhanced with ProductCard and StainConditionToggles
 */

'use client';

import { memo, useEffect, useRef } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ProductCard } from './product-card';
import { PreferencesForSelectedPiecePanel } from './preferences/PreferencesForSelectedPiecePanel';
import { Plus, Camera, Package } from 'lucide-react';

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
  selectedPieceId?: string | null;
  enforcePrefCompatibility?: boolean;
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
  selectedPieceId = null,
  enforcePrefCompatibility = false,
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
  const prefsPanelRef = useRef<HTMLDivElement>(null);

  // Scroll PreferencesForSelectedPiecePanel into view when piece is selected
  useEffect(() => {
    if (selectedPieceId && prefsPanelRef.current) {
      prefsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedPieceId]);

  return (
    <div className="space-y-4">
      {/* Product Grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <h2 className={`text-xl sm:text-2xl font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('selectItems')}</h2>

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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3">
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

      {/* Preferences for Selected Piece (replaces StainConditionToggles) */}
      <PreferencesForSelectedPiecePanel
        selectedPieceId={selectedPieceId}
        selectedConditions={selectedConditions}
        onConditionToggle={onConditionToggle}
        enforcePrefCompatibility={enforcePrefCompatibility}
      />
    </div>
  );
});
