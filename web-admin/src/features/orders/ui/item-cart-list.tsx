/**
 * Item Cart List Component
 * List of all items in the order summary panel
 * PRD-010: Advanced Order Management
 */

'use client';

import { memo } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useLocale, useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { SummaryCartItem } from './summary-cart-item';
import { ShoppingCart } from 'lucide-react';
import type { PreSubmissionPiece } from './pre-submission-pieces-manager';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productName2?: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  conditions?: string[];
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  pieces?: PreSubmissionPiece[];
  serviceCategoryCode?: string;
  serviceCategoryName?: string;
  serviceCategoryName2?: string;
  priceOverride?: number | null;
  overrideReason?: string | null;
}

interface ColorCatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  color_hex?: string | null;
}

interface ItemCartListProps {
  items: CartItem[];
  onEditItem?: (itemId: string) => void;
  onEditItemNotes?: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onPiecesChange?: (itemId: string, pieces: PreSubmissionPiece[]) => void;
  onCopyPieceToAll?: (itemId: string, pieceId: string) => void;
  trackByPiece?: boolean;
  currencyCode?: string;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  colorCatalog?: ColorCatalogEntry[];
}

function ItemCartListComponent({
  items,
  onEditItem,
  onEditItemNotes,
  onDeleteItem,
  trackByPiece = false,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  colorCatalog,
}: ItemCartListProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  const locale = useLocale();
  const { decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';

  const totalPieces = trackByPiece && items.length > 0
    ? items.reduce((sum, item) => sum + (item.pieces?.length || item.quantity), 0)
    : items.reduce((sum, item) => sum + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-10 px-4 ${isRTL ? 'text-right' : 'text-center'}`}>
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <ShoppingCart className="w-10 h-10 text-gray-400" aria-hidden="true" />
        </div>
        <p className="text-base font-medium text-gray-700 mb-1">{t('noItemsAdded')}</p>
        <p className="text-sm text-gray-500 max-w-xs">
          {t('selectItemsFromGrid') || 'Select items from the grid above to add to your order.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-2 pb-2 border-b-2 border-gray-200`}>
        <h3 className={`font-semibold text-gray-900 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('orderItems')} ({items.length})
        </h3>
        <span className={`text-xs text-gray-500 ${isRTL ? 'text-left' : 'text-right'}`}>
          {trackByPiece ? (
            <span>{totalPieces} {tPieces('totalPieces')}</span>
          ) : (
            <span>{totalPieces} {t('pieces')}</span>
          )}
        </span>
      </div>

      {/* Items */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        {items.map((item, index) => (
          <SummaryCartItem
            key={item.id}
            itemNumber={index + 1}
            itemId={item.id}
            productName={item.productName}
            productName2={item.productName2}
            quantity={item.quantity}
            totalPrice={item.totalPrice}
            conditions={item.conditions}
            notes={item.notes}
            pieces={item.pieces}
            trackByPiece={trackByPiece}
            priceOverride={item.priceOverride}
            overrideReason={item.overrideReason}
            currencyCode={currencyCode}
            colorCatalog={colorCatalog}
            onEditPrice={onEditItem ? () => onEditItem(item.id) : undefined}
            onEditNotes={onEditItemNotes ? () => onEditItemNotes(item.id) : undefined}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
      </div>

      {/* Total row */}
      <div className={`flex items-center justify-between pt-2 mt-1 border-t border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs text-gray-500">{t('total') || 'Total'}</span>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {formatMoneyAmountWithCode(items.reduce((sum, item) => sum + item.totalPrice, 0), {
            currencyCode: currencyCode as string,
            decimalPlaces,
            locale: moneyLocale,
          })}
        </span>
      </div>
    </div>
  );
}

export const ItemCartList = memo(ItemCartListComponent);
