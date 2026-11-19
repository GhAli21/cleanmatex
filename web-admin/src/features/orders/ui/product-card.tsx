/**
 * Product Card Component
 * Touch-friendly product card for new order UI
 * PRD-010: Advanced Order Management
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useBilingual } from '@/lib/utils/bilingual';
import { Plus, Minus } from 'lucide-react';
import { CmxButton } from '@ui/primitives';

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

interface ProductCardProps {
  product: Product;
  quantity: number;
  price: number;
  /** Shown under the price when the order speed adds a premium (priced in the cart). */
  speedNote?: string | null;
  currencyCode?: string;
  categoryLabel?: string;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

/**
 *
 * @param root0
 * @param root0.product
 * @param root0.quantity
 * @param root0.price
 * @param root0.speedNote
 * @param root0.currencyCode
 * @param root0.onAdd
 * @param root0.onIncrement
 * @param root0.onDecrement
 */
export function ProductCard({
  product,
  quantity,
  price,
  speedNote = null,
  currencyCode = '',
  categoryLabel,
  onAdd,
  onIncrement,
  onDecrement,
}: ProductCardProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const locale = useLocale();
  const { decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const getBilingual = useBilingual();

  const displayName = getBilingual(product.product_name, product.product_name2) || t('unknownProduct');
  const hasQuantity = quantity > 0;

  return (
    <div
      className={`
        relative border rounded-lg p-2 transition-all duration-150 cursor-pointer
        flex flex-col
        hover:scale-[1.02] active:scale-[0.98]
        ${
          hasQuantity
            ? 'border-primary bg-info-bg shadow-md'
            : 'border-border hover:border-border hover:shadow-sm bg-card'
        }
      `}
    >
      {/* Quantity Overlay Badge */}
      {hasQuantity && (
        <div
          key={quantity}
          className="absolute -top-2 -end-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-xs shadow-lg z-10 border-2 border-card animate-in zoom-in-50 duration-200"
        >
          {quantity}
        </div>
      )}

      {/* Product Image/Icon */}
      <div className="w-full h-10 bg-muted rounded-lg mb-1.5 flex items-center justify-center overflow-hidden shrink-0">
        {product.product_image ? (
          <img
            src={product.product_image}
            alt={displayName}
            className="w-full h-full object-contain p-1"
          />
        ) : product.product_icon ? (
          <i className={`mdi ${product.product_icon} text-3xl text-muted-foreground`} />
        ) : (
          <i className="mdi mdi-hanger text-3xl text-muted-foreground" />
        )}
      </div>

      {/* Category badge (global search) */}
      {categoryLabel ? (
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5 line-clamp-1 text-start">
          {categoryLabel}
        </p>
      ) : null}

      {/* Product Name */}
      <h3 className="font-medium text-xs mb-1 text-foreground line-clamp-2 grow text-start">
        {displayName}
      </h3>

      {/* Price */}
      <div className="mb-2 text-start">
        <p className="text-primary-text font-bold text-sm">
          {formatMoneyAmountWithCode(price, {
            currencyCode: currencyCode as string,
            decimalPlaces,
            locale: moneyLocale,
          })}
        </p>
        {speedNote ? (
          <span className="text-xs text-warning-text font-medium">{speedNote}</span>
        ) : null}
      </div>

      {/* Action Buttons */}
      {hasQuantity ? (
        <div className="flex items-center justify-between gap-2 mt-auto">
          <CmxButton
            type="button"
            variant="destructive"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDecrement(); }}
            className="h-9 w-9 p-0 rounded-full shadow-md"
            aria-label={t('decreaseQuantity')}
          >
            <Minus className="w-3 h-3" />
          </CmxButton>
          <span className="flex-1 text-center font-bold text-xl text-foreground tabular-nums">
            {quantity}
          </span>
          <CmxButton
            type="button"
            variant="primary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onIncrement(); }}
            className="h-9 w-9 p-0 rounded-full shadow-md"
            aria-label={t('increaseQuantity')}
          >
            <Plus className="w-5 h-5" />
          </CmxButton>
        </div>
      ) : (
        <CmxButton
          type="button"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="w-full min-h-9 px-2 py-2 bg-success text-on-solid rounded-lg hover:bg-success/90 font-semibold text-xs shadow-sm flex items-center justify-center gap-1"
          aria-label={t('add') || 'Add item'}
        >
          <Plus className="w-3 h-3" aria-hidden />
          {t('add')}
        </CmxButton>
      )}
    </div>
  );
}
