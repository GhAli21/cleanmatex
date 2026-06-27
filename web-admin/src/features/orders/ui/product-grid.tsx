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
import { CmxInput, CmxSwitch, Label, CmxSelect } from '@ui/primitives';
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

  const showPaginationFooter =
    productsTotal > 0 && onPageChange != null && onPageSizeChange != null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Header panel */}
        <div className="border-b border-gray-200 bg-gradient-to-b from-slate-50 to-white px-4 py-4 sm:px-5">
          <h2
            className={`mb-3 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('selectItems')}
          </h2>

          {onProductSearchChange ? (
            <div
              className={`rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4 ${isRTL ? 'text-right' : 'text-left'}`}
              role="search"
              aria-label={t('searchProductsLabel')}
            >
              <div
                className={`flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4 ${isRTL ? 'xl:flex-row-reverse' : ''}`}
              >
                <div className="relative min-w-0 flex-1 xl:max-w-md">
                  <label htmlFor="new-order-product-search" className="sr-only">
                    {t('searchProductsLabel')}
                  </label>
                  <Search
                    className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                    aria-hidden="true"
                  />
                  <CmxInput
                    id="new-order-product-search"
                    type="search"
                    value={productSearch}
                    onChange={(event) => onProductSearchChange(event.target.value)}
                    placeholder={t('searchProductsPlaceholder')}
                    className={`border-slate-200 bg-slate-50/50 focus:bg-white ${isRTL ? 'pr-9' : 'pl-9'}`}
                    aria-busy={isSearchPending}
                  />
                </div>

                <div
                  className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:shrink-0 ${isRTL ? 'sm:flex-row-reverse' : ''}`}
                >
                  {onSearchAllCategoriesChange ? (
                    <div
                      className={`flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      <CmxSwitch
                        id="new-order-search-all-categories"
                        checked={searchAllCategories}
                        onCheckedChange={onSearchAllCategoriesChange}
                        aria-describedby="new-order-search-all-categories-help"
                      />
                      <div className="min-w-0">
                        <Label
                          htmlFor="new-order-search-all-categories"
                          className="cursor-pointer text-sm font-medium text-slate-800 whitespace-nowrap"
                        >
                          {t('searchAllCategories')}
                        </Label>
                        <p
                          id="new-order-search-all-categories-help"
                          className="text-xs text-slate-500 sr-only sm:not-sr-only sm:max-w-[12rem] sm:leading-snug"
                        >
                          {t('searchAllCategoriesHelp')}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {onPageSizeChange ? (
                    <div
                      className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      <span className="whitespace-nowrap font-medium">{tCommon('rowsPerPage')}</span>
                      <CmxSelect
                        fullWidth={false}
                        size="sm"
                        className="w-[4.5rem] border-slate-200 bg-white"
                        options={ORDER_DEFAULTS.LIMITS.PRODUCTS_PAGE_SIZE_OPTIONS.map((size) => ({
                          value: String(size),
                          label: String(size),
                        }))}
                        value={String(pageSize)}
                        onChange={(event) => onPageSizeChange(Number(event.target.value))}
                        disabled={isFetching}
                        aria-label={tCommon('rowsPerPage')}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {isGlobalSearch ? (
                <div className={`mt-3 flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                    {t('searchingAllCategories')}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          {products.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-12 px-4 ${isRTL ? 'text-right' : 'text-center'}`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <Package className="h-8 w-8 text-slate-400" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-slate-800 sm:text-lg">
                {productSearch.trim() ? t('noSearchResults') : t('noProductsAvailable')}
              </h3>
              <p className="mb-4 max-w-sm text-sm text-slate-500">{emptyHint}</p>
              {productSearch.trim() && onProductSearchChange ? (
                <CmxButton variant="outline" size="sm" onClick={() => onProductSearchChange('')}>
                  {t('clearSearch')}
                </CmxButton>
              ) : null}
            </div>
          ) : (
            <div
              ref={gridRef}
              className={`grid grid-cols-2 gap-3 transition-opacity duration-150 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 ${isFetching ? 'opacity-70' : ''}`}
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
          )}
        </div>

        {/* Footer panel */}
        {showPaginationFooter ? (
          <div className="border-t border-gray-200 bg-gradient-to-t from-slate-50 to-white px-2 py-1 sm:px-3">
            <div className="rounded-lg border border-slate-200/80 bg-white px-1 shadow-sm sm:px-2">
              <CmxPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={productsTotal}
                onPageChange={handlePageChange}
                onPageSizeChange={onPageSizeChange}
                pageSizeOptions={[...ORDER_DEFAULTS.LIMITS.PRODUCTS_PAGE_SIZE_OPTIONS]}
                showPageSizeSelector={false}
                showWhenSinglePage
                disabled={isFetching}
                labels={{ rowsPerPage: tCommon('rowsPerPage') }}
              />
            </div>
          </div>
        ) : null}
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
