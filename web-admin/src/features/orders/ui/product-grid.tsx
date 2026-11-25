/**
 * Product Grid Component
 * Larger cards, capped columns, with PreferencesPanel
 * PRD-010: Advanced Order Management
 */

'use client';

import { memo, useRef } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { ProductCard } from './product-card';
import { PreferencesPanel } from './preferences-panel';
import { Camera, Package, Plus, Search } from 'lucide-react';
import { CmxInput, CmxSwitch, Label, CmxSelect } from '@ui/primitives';
import { CmxButton } from '@ui/primitives';
import { CmxPagination } from '@ui/navigation';

interface Product {
  id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  default_sell_price: number | null;
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
  /** Shown on each card when the order speed adds a premium the cart prices (P5-03b). */
  speedNote?: string | null;
  /** Each product's price at the order speed, when the server has answered. */
  speedPrices?: ReadonlyMap<string, number> | null;
  /** Shown instead of `speedNote` on a card that shows its price at the order speed. */
  speedPricedNote?: string | null;
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
  /** Photos taken for this order but not saved yet (uploaded right after the order is saved). */
  pendingPhotoCount?: number;
}

export const ProductGrid = memo(function ProductGrid({
  products,
  items,
  speedNote = null,
  speedPrices = null,
  speedPricedNote = null,
  currencyCode = '',
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
  pendingPhotoCount = 0,
}: ProductGridProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tCommon = useTranslations('common');

  // A product may have several cart lines (Cart Line Grouping): the card shows them all together.
  const getItemQuantity = (productId: string): number =>
    items.reduce((sum, item) => (item.productId === productId ? sum + item.quantity : sum), 0);

  // The server's price at the order speed, else the catalog price with a note that the cart prices it.
  const getItemPrice = (product: Product): number => speedPrices?.get(product.id) ?? (product.default_sell_price || 0);

  const prefsPanelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  void onRemoveItem;

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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Header panel */}
        <div className="border-b border-border bg-gradient-to-b from-muted to-card px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2
              className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl text-start"
            >
              {t('selectItems')}
            </h2>
            <div className="flex items-center gap-2">
              {onOpenPhotoCapture ? (
                <CmxButton type="button" variant="outline" size="sm" onClick={onOpenPhotoCapture} aria-label={t('photosPending', { count: pendingPhotoCount })}>
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  {t('addPhoto')}
                  {pendingPhotoCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {pendingPhotoCount}
                    </span>
                  )}
                </CmxButton>
              ) : null}
              {/* P5-03e: a line with no catalog product; absent without `pricing:override` */}
              {onOpenCustomItemModal ? (
                <CmxButton type="button" variant="outline" size="sm" onClick={onOpenCustomItemModal}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('addCustomItem')}
                </CmxButton>
              ) : null}
            </div>
          </div>

          {onProductSearchChange ? (
            <div
              className="rounded-xl border border-border/90 bg-card p-3 shadow-sm sm:p-4 text-start"
              role="search"
              aria-label={t('searchProductsLabel')}
            >
              <div
                className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4"
              >
                <div className="relative min-w-0 flex-1 xl:max-w-md">
                  <Label htmlFor="new-order-product-search" className="sr-only">
                    {t('searchProductsLabel')}
                  </Label>
                  <Search
                    className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3"
                    aria-hidden="true"
                  />
                  <CmxInput
                    id="new-order-product-search"
                    type="search"
                    value={productSearch}
                    onChange={(event) => onProductSearchChange(event.target.value)}
                    placeholder={t('searchProductsPlaceholder')}
                    className="border-border bg-muted/50 focus:bg-card ps-9"
                    aria-busy={isSearchPending}
                  />
                </div>

                <div
                  className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:shrink-0"
                >
                  {onSearchAllCategoriesChange ? (
                    <div
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/80 px-3 py-2.5"
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
                          className="cursor-pointer text-sm font-medium text-foreground whitespace-nowrap"
                        >
                          {t('searchAllCategories')}
                        </Label>
                        <p
                          id="new-order-search-all-categories-help"
                          className="text-xs text-muted-foreground sr-only sm:not-sr-only sm:max-w-[12rem] sm:leading-snug"
                        >
                          {t('searchAllCategoriesHelp')}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {onPageSizeChange ? (
                    <div
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/80 px-3 py-2 text-sm text-muted-foreground"
                    >
                      <span className="whitespace-nowrap font-medium">{tCommon('rowsPerPage')}</span>
                      <CmxSelect
                        fullWidth={false}
                        size="sm"
                        className="w-[4.5rem] border-border bg-card"
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
                <div className="mt-3 flex justify-start">
                  <span className="inline-flex items-center rounded-full border border-info-border bg-info-bg px-3 py-1 text-xs font-medium text-info-text">
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
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 py-12 px-4 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
                <Package className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground sm:text-lg">
                {productSearch.trim() ? t('noSearchResults') : t('noProductsAvailable')}
              </h3>
              <p className="mb-4 max-w-sm text-sm text-muted-foreground">{emptyHint}</p>
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
                    speedNote={speedPrices?.has(product.id) ? speedPricedNote : speedNote}
                    currencyCode={currencyCode}
                    categoryLabel={categoryLabel}
                    onAdd={() => onAddItem(product)}
                    onIncrement={() => onAddItem(product)}
                    onDecrement={() => onQuantityChange(product.id, quantity - 1)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer panel */}
        {showPaginationFooter ? (
          <div className="border-t border-border bg-gradient-to-t from-muted to-card px-2 py-1 sm:px-3">
            <div className="rounded-lg border border-border/80 bg-card px-1 shadow-sm sm:px-2">
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
