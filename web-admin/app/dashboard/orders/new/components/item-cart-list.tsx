/**
 * Item Cart List Component
 * List of all items in the order with edit/delete capabilities
 * Re-Design: PRD-010 Advanced Orders - Section 4
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ItemCartItem } from './item-cart-item';
import { ShoppingCart } from 'lucide-react';

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
}

interface ItemCartListProps {
  items: CartItem[];
  onEditItem?: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}

export function ItemCartList({ items, onEditItem, onDeleteItem }: ItemCartListProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const isRTL = useRTL();
  
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
          {items.reduce((sum, item) => sum + item.quantity, 0)} {t('pieces')}
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {items.map((item, index) => (
          <ItemCartItem
            key={item.id}
            itemNumber={index + 1}
            productName={item.productName}
            productName2={item.productName2}
            quantity={item.quantity}
            price={item.pricePerUnit}
            totalPrice={item.totalPrice}
            conditions={item.conditions}
            hasStain={item.hasStain}
            hasDamage={item.hasDamage}
            notes={item.notes}
            onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
