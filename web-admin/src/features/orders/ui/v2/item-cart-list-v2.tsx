/**
 * Item Cart List V2
 * Uses ItemCartItemV2 with onCopyPieceToAll support
 * Re-Design: PRD-010 Advanced Orders - V2 Enhancement
 */

'use client';

import { memo } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ItemCartItemV2 } from './item-cart-item-v2';
import { ShoppingCart } from 'lucide-react';
import type { PreSubmissionPiece } from '../pre-submission-pieces-manager';

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

interface ItemCartListV2Props {
  items: CartItem[];
  onEditItem?: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onPiecesChange?: (itemId: string, pieces: PreSubmissionPiece[]) => void;
  onCopyPieceToAll?: (itemId: string, pieceId: string) => void;
  trackByPiece?: boolean;
  currencyCode?: string;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  colorCatalog?: ColorCatalogEntry[];
}

function ItemCartListV2Component({
  items,
  onEditItem,
  onDeleteItem,
  onPiecesChange,
  onCopyPieceToAll,
  trackByPiece = false,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  selectedPieceId = null,
  onSelectPiece,
  colorCatalog,
}: ItemCartListV2Props) {
  const t = useTranslations('newOrder.itemsGrid');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();

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
    <div className="space-y-0">
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-3 pb-2 border-b-2 border-gray-200`}>
        <h3 className={`font-semibold text-gray-900 text-sm sm:text-base ${isRTL ? 'text-right' : 'text-left'}`}>
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

      <div>
        {items.map((item, index) => (
          <ItemCartItemV2
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
            onCopyPieceToAll={onCopyPieceToAll ? (pieceId) => onCopyPieceToAll(item.id, pieceId) : undefined}
            trackByPiece={trackByPiece}
            onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
            onDelete={() => onDeleteItem(item.id)}
            priceOverride={item.priceOverride}
            overrideReason={item.overrideReason}
            currencyCode={currencyCode}
            selectedPieceId={selectedPieceId}
            onSelectPiece={onSelectPiece}
            colorCatalog={colorCatalog}
          />
        ))}
      </div>
    </div>
  );
}

export const ItemCartListV2 = memo(ItemCartListV2Component);
