/**
 * Product Grid Component
 * Larger cards, capped columns, with PreferencesPanel
 * PRD-010: Advanced Order Management
 */

'use client';

import { memo, useRef } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ProductCard } from './product-card';
import { PreferencesPanel } from './preferences-panel';
import { Package, Search } from 'lucide-react';
import { CmxInput, CmxSwitch, Label } from '@ui/primitives';
import { CmxButton } from '@ui/primitives';
import { CmxPagination } from '@ui/navigation';

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
  productSearch?: string;
  onProductSearchChange?: (value: string) => void;
  isSearchPending?: boolean;
  searchAllCategories?: boolean;
  onSearchAllCategoriesChange?: (value: boolean) => void;
  isGlobalSearch?: boolean;
  productsTotal?: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isFetching?: boolean;
  getCategoryLabel?: (code: string | null) => string | undefined;
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
  productSearch = '',
  onProductSearchChange,
  isSearchPending = false,
  searchAllCategories = false,
  onSearchAllCategoriesChange,
  isGlobalSearch = false,
  productsTotal = 0,
  totalPages = 0,
  currentPage = 1,
  pageSize = ORDER_DEFAULTS.LIMITS.PRODUCTS_PER_CATEGORY,
  onPageChange,
  onPageSizeChange,
  isFetching = false,
  getCategoryLabel,
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
  const tCommon = useTranslations('common');
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
  const gridRef = useRef<HTMLDivElement>(null);

  void onRemoveItem;
  void onOpenCustomItemModal;
  void onOpenPhotoCapture;

  const handlePageChange = (page: number) => {
    onPageChange?.(page);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const emptyHint = productSearch.trim()
    ? isGlobalSearch
      ? t('noGlobalSearchResultsHint')
      : t('noSearchResultsHint')
    : (t('noProductsHint') || 'No products in this category. Try selecting another category above.');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className={`flex flex-col gap-4 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {t('selectItems')}
            </h2>
            {onProductSearchChange ? (
              <div className="w-full sm:max-w-xs">
                <label htmlFor="new-order-product-search" className="sr-only">
                  {t('searchProductsLabel')}
                </label>
                <div className="relative">
                  <Search
                    className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`}
                    aria-hidden="true"
                  />
                  <CmxInput
                    id="new-order-product-search"
                    type="search"
                    value={productSearch}
                    onChange={(event) => onProductSearchChange(event.target.value)}
                    placeholder={t('searchProductsPlaceholder')}
                    className={isRTL ? 'pr-9' : 'pl-9'}
                    aria-busy={isSearchPending}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {onSearchAllCategoriesChange ? (
            <div
              className={`flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <CmxSwitch
                id="new-order-search-all-categories"
                checked={searchAllCategories}
                onCheckedChange={onSearchAllCategoriesChange}
                aria-describedby="new-order-search-all-categories-help"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <Label
                  htmlFor="new-order-search-all-categories"
                  className="cursor-pointer text-sm font-medium text-gray-900"
                >
                  {t('searchAllCategories')}
                </Label>
                <p
                  id="new-order-search-all-categories-help"
                  className="text-xs text-gray-500"
                >
                  {t('searchAllCategoriesHelp')}
                </p>
              </div>
            </div>
          ) : null}

          {isGlobalSearch ? (
            <p className="text-sm font-medium text-blue-700">{t('searchingAllCategories')}</p>
          ) : null}
        </div>

        {products.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-12 px-4 ${isRTL ? 'text-right' : 'text-center'}`}>
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-400" aria-hidden="true" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">
              {productSearch.trim() ? t('noSearchResults') : t('noProductsAvailable')}
            </h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm">{emptyHint}</p>
            {productSearch.trim() && onProductSearchChange ? (
              <CmxButton variant="outline" size="sm" onClick={() => onProductSearchChange('')}>
                {t('clearSearch')}
              </CmxButton>
            ) : null}
          </div>
        ) : (
          <>
            <div
              ref={gridRef}
              className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 transition-opacity duration-150 ${isFetching ? 'opacity-70' : ''}`}
              aria-busy={isFetching}
            >
              {products.map((product) => {
                const quantity = getItemQuantity(product.id);
                const price = getItemPrice(product);
                const categoryLabel = isGlobalSearch && getCategoryLabel
                  ? getCategoryLabel(product.service_category_code)
                  : undefined;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={quantity}
                    price={price}
                    express={express}
                    currencyCode={currencyCode}
                    categoryLabel={categoryLabel}
                    onAdd={() => onAddItem(product)}
                    onIncrement={() => onQuantityChange(product.id, quantity + 1)}
                    onDecrement={() => onQuantityChange(product.id, quantity - 1)}
                  />
                );
              })}
            </div>
            {productsTotal > 0 && onPageChange && onPageSizeChange ? (
              <div className="mt-4 border-t border-gray-100">
                <CmxPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={productsTotal}
                  onPageChange={handlePageChange}
                  onPageSizeChange={onPageSizeChange}
                  pageSizeOptions={[...ORDER_DEFAULTS.LIMITS.PRODUCTS_PAGE_SIZE_OPTIONS]}
                  showWhenSinglePage
                  disabled={isFetching}
                  labels={{ rowsPerPage: tCommon('rowsPerPage') }}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div ref={prefsPanelRef}>
        <PreferencesPanel
          selectedPieceId={selectedPieceId}
          selectedConditions={selectedConditions}
          onConditionToggle={onConditionToggle}
          enforcePrefCompatibility={enforcePrefCompatibility}
        />
      </div>
    </div>
  );
});
