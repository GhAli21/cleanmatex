/**
 * Item Cart List Component
 * List of all items in the order summary panel
 * PRD-010: Advanced Order Management
 */

'use client';

import type { CartQuoteRequest } from '@/lib/validations/new-order-payment-schemas';
import { memo } from 'react';
import type { LineKey, OrderItemMeasure, OrderItemUom } from '../model/new-order-types';
import { useTranslations } from 'next-intl';
import { SummaryCartItem } from './summary-cart-item';
import { ShoppingCart } from 'lucide-react';
import type { PreSubmissionPiece } from './pre-submission-pieces-manager';
import type { CartQuoteLine } from '@/lib/types/cart-quote';

/**
 * The server's figures per cart line (New Order, P5-03b) and the line speed
 * menus (New Order and Order Edit, P6-02b).
 */
export interface ItemCartListQuoteProps {
  /** Quoted lines by cart position; null before the first answer. */
  lines: CartQuoteLine[] | null;
  /** A changed cart is being priced: the figures shown are not final. */
  pending: boolean;
  /** Order Edit: no live line figures; each line shows its stored price and Review re-prices. */
  unquoted?: boolean;
  onLineSpeedChange?: (lineKey: LineKey, serviceSpeed: string | null) => void;
  lineSpeedDisabled?: boolean;
  /** The current cart request; lets a line's speed menu price its options. */
  previewRequest?: Omit<CartQuoteRequest, 'requestId'>;
  /** Opens the line discount dialog; absent when the user lacks `orders:discount` (P5-03c). */
  onEditLineDiscount?: (lineKey: LineKey) => void;
  /** Opens the discount dialog for one piece (PIECE level, P9-01). */
  onEditPieceDiscount?: (lineKey: LineKey, pieceId: string) => void;
}

interface CartItem {
  /** The line's cart key (Cart Line Grouping P1). */
  id: LineKey;
  /** Set only when the product has more than one line (§5.5). */
  lineNumber?: number | null;
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
  /** A measured line (kg, m, m²…): its unit and what staff measured. */
  uom?: OrderItemUom;
  measure?: OrderItemMeasure;
  /** Order Edit: the line is priced per piece (P9-01). */
  piecePriced?: boolean;
  serviceCategoryCode?: string;
  serviceCategoryName?: string;
  serviceCategoryName2?: string;
  priceOverride?: number | null;
  overrideReason?: string | null;
  serviceSpeed?: string | null;
}

interface ColorCatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  color_hex?: string | null;
}

interface ItemCartListProps {
  items: CartItem[];
  onEditItem?: (itemId: LineKey) => void;
  onEditItemPreferences?: (itemId: LineKey) => void;
  onEditItemMeasure?: (lineKey: LineKey) => void;
  /** Move one equal share of a measured line to a new line (§4.3). */
  onSplitMeasuredShare?: (lineKey: LineKey) => void;
  onDeleteItem: (itemId: LineKey) => void;
  onPiecesChange?: (itemId: LineKey, pieces: PreSubmissionPiece[]) => void;
  onCopyPieceToAll?: (itemId: LineKey, pieceId: string) => void;
  trackByPiece?: boolean;
  currencyCode?: string;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  colorCatalog?: ColorCatalogEntry[];
  preferenceLabelByCode?: Record<string, string>;
  /** Packing surcharge by code — same catalog as packing chips (`default_extra_price`) */
  packingExtraPriceByCode?: Record<string, number>;
  /** The order speed lines follow when they have none of their own. */
  orderSpeed?: string;
  quote?: ItemCartListQuoteProps;
}

function ItemCartListComponent({
  items,
  onEditItem,
  onEditItemPreferences,
  onEditItemMeasure,
  onSplitMeasuredShare,
  onDeleteItem,
  trackByPiece = false,
  currencyCode = '',
  colorCatalog,
  preferenceLabelByCode,
  packingExtraPriceByCode,
  orderSpeed,
  quote,
  onPiecesChange,
}: ItemCartListProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tPieces = useTranslations('newOrder.pieces');

  const totalPieces = trackByPiece && items.length > 0
    ? items.reduce((sum, item) => sum + (item.pieces?.length || item.quantity), 0)
    : items.reduce((sum, item) => sum + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <ShoppingCart className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-base font-medium text-foreground mb-1">{t('noItemsAdded')}</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t('selectItemsFromGrid') || 'Select items from the grid above to add to your order.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b-2 border-border">
        <h3 className="font-semibold text-foreground text-sm text-start">
          {t('orderItems')} ({items.length})
        </h3>
        <span className="text-xs text-muted-foreground text-end">
          {trackByPiece ? (
            <span>{totalPieces} {tPieces('totalPieces')}</span>
          ) : (
            <span>{totalPieces} {t('pieces')}</span>
          )}
        </span>
      </div>

      {/* Items */}
      <div className="rounded-lg border border-border overflow-hidden">
        {items.map((item, index) => (
          <SummaryCartItem
            key={item.id}
            itemNumber={index + 1}
            itemId={item.id}
            productName={item.productName}
            productName2={item.productName2}
            uom={item.uom}
            measure={item.measure}
            onEditMeasure={item.uom && onEditItemMeasure ? () => onEditItemMeasure(item.id) : undefined}
            lineNumber={item.lineNumber}
            onSplitMeasuredShare={item.uom && onSplitMeasuredShare ? () => onSplitMeasuredShare(item.id) : undefined}
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
            preferenceLabelByCode={preferenceLabelByCode}
            packingExtraPriceByCode={packingExtraPriceByCode}
            onEditPrice={onEditItem ? () => onEditItem(item.id) : undefined}
            onEditPreferences={onEditItemPreferences ? () => onEditItemPreferences(item.id) : undefined}
            onDelete={() => onDeleteItem(item.id)}
            quote={quote ? {
              line: quote.lines?.find((line) => line.index === index) ?? null,
              pending: quote.pending,
              unquoted: quote.unquoted,
              orderSpeed: orderSpeed ?? '',
              lineSpeed: item.serviceSpeed ?? null,
              piecePriced: item.piecePriced,
              onLineSpeedChange: quote.onLineSpeedChange
                ? (code: string | null) => quote.onLineSpeedChange?.(item.id, code)
                : undefined,
              lineSpeedDisabled: quote.lineSpeedDisabled,
              speedPreview: quote.previewRequest
                ? {
                    lineIndex: index,
                    requestFor: (code: string) => ({
                      ...quote.previewRequest!,
                      items: quote.previewRequest!.items.map((line, i) => (i === index ? { ...line, serviceSpeed: code } : line)),
                    }),
                  }
                : undefined,
              onEditLineDiscount: quote.onEditLineDiscount
                ? () => quote.onEditLineDiscount?.(item.id)
                : undefined,
              onPieceSpeedChange: onPiecesChange && quote.onLineSpeedChange
                ? (pieceId: string, code: string | null) => onPiecesChange(
                    item.id,
                    (item.pieces ?? []).map((p) => (p.id === pieceId ? { ...p, serviceSpeed: code } : p)),
                  )
                : undefined,
              onEditPieceDiscount: quote.onEditPieceDiscount
                ? (pieceId: string) => quote.onEditPieceDiscount?.(item.id, pieceId)
                : undefined,
            } : undefined}
          />
        ))}
      </div>
      {/* No client-summed total here (BF-19): the summary rail shows the server's figures. */}
    </div>
  );
}

export const ItemCartList = memo(ItemCartListComponent);
