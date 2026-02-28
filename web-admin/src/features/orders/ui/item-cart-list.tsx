/**
 * Item Cart List Component
 * List of all items in the order with edit/delete capabilities
 * Re-Design: PRD-010 Advanced Orders - Section 4
 */

'use client';

import { memo } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ItemCartItem } from './item-cart-item';
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
}

interface ItemCartListProps {
  items: CartItem[];
  onEditItem?: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onPiecesChange?: (itemId: string, pieces: PreSubmissionPiece[]) => void;
  trackByPiece?: boolean;
  currencyCode?: string;
}

function ItemCartListComponent({ 
  items, 
  onEditItem, 
  onDeleteItem, 
  onPiecesChange,
  trackByPiece = false,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
}: ItemCartListProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  
  // Calculate total pieces count
  const totalPieces = trackByPiece && items.length > 0
    ? items.reduce((sum, item) => sum + (item.pieces?.length || item.quantity), 0)
    : items.reduce((sum, item) => sum + item.quantity, 0);
  
  if (items.length === 0) {
    return (
      <div className={`${isRTL ? 'text-right' : 'text-center'} py-8 text-gray-400`}>
        <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t('noItemsAdded')}</p>
        <p className={`text-xs mt-1 ${isRTL ? 'text-right' : 'text-center'}`}>{t('selectItemsFromGrid')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-3 pb-2 border-b-2 border-gray-200`}>
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

      <div className="max-h-80 overflow-y-auto">
        {items.map((item, index) => (
          <ItemCartItem
            key={item.id}
            itemNumber={index + 1}
            itemId={item.id}
            productName={item.productName}
            productName2={item.productName2}
            quantity={item.quantity}
            price={item.pricePerUnit}
            totalPrice={item.totalPrice}
            conditions={item.conditions}
            hasStain={item.hasStain}
            hasDamage={item.hasDamage}
            notes={item.notes}
            pieces={item.pieces}
            serviceCategoryCode={item.serviceCategoryCode}
            serviceCategoryName={item.serviceCategoryName}
            serviceCategoryName2={item.serviceCategoryName2}
            onPiecesChange={onPiecesChange ? (pieces) => onPiecesChange(item.id, pieces) : undefined}
            trackByPiece={trackByPiece}
            onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
            onDelete={() => onDeleteItem(item.id)}
            priceOverride={item.priceOverride}
            overrideReason={item.overrideReason}
            currencyCode={currencyCode}
          />
        ))}
      </div>
    </div>
  );
}

export const ItemCartList = memo(ItemCartListComponent);
