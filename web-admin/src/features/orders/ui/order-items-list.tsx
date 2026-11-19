'use client';

import { FILE_SOURCES } from '@/lib/constants/file-util';
import { useState } from 'react';
import React from 'react';
import { AlertCircle, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useBilingual } from '@/lib/hooks/useBilingual';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
import { lineCodeOfPieceRef } from '@features/orders/lib/piece-highlight';
import { OrderLineNetNote } from './order-line-net-note';

interface OrderItem {
  id: string;
  /** Line code `<order_no>-<n>` (HFC P2). */
  order_item_srno?: string | null;
  service_category_code?: string | null;
  product_name?: string | null;
  product_name2?: string | null;
  quantity?: number | null;
  price_per_unit: number | string;
  total_price: number | string;
  net_amount?: number | string | null;
  status?: string | null;
  color?: string | null;
  brand?: string | null;
  has_stain?: boolean | null;
  has_damage?: boolean | null;
  stain_notes?: string | null;
  damage_notes?: string | null;
  notes?: string | null;
}

interface OrderItemsListProps {
  items: OrderItem[];
  orderId?: string;
  tenantId?: string;
  branchId?: string | null;
  trackByPiece?: boolean;
  readOnly?: boolean;
  /** `?piece=` (piece id or code): open its line and highlight it (HFC T3.9). */
  highlightPiece?: string | null;
}

/**
 *
 * @param root0
 * @param root0.items
 * @param root0.orderId
 * @param root0.tenantId
 * @param root0.branchId
 * @param root0.trackByPiece
 * @param root0.readOnly
 * @param root0.highlightPiece
 */
export function OrderItemsList({ 
  items, 
  orderId,
  tenantId,
  branchId = null,
  trackByPiece = false,
  readOnly = true,
  highlightPiece = null,
}: OrderItemsListProps) {
  const t = useTranslations('orders.itemsList');
  const tPieces = useTranslations('newOrder.pieces');
  const getBilingual = useBilingual();
  const { formatMoneyWithCode } = useTenantCurrency();
  // A piece code names its line; a piece id does not, so then every line opens to find it.
  const highlightLine = lineCodeOfPieceRef(highlightPiece);
  const isHighlightLine = (item: OrderItem) =>
    Boolean(highlightPiece) &&
    (!highlightLine || (item.order_item_srno ?? '').toUpperCase() === highlightLine);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
    () => new Set(highlightPiece ? items.filter(isHighlightLine).map((item) => item.id) : [])
  );

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-start">
        <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
        <p>{t('noItems')}</p>
        <p className="text-sm mt-1">{t('itemsWillBeAdded')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground text-start">
                  {getBilingual(item.product_name, item.product_name2) || item.service_category_code || t('item')}
                </span>
                <CmxCodeChip code={item.order_item_srno} kind="item" />
                {item.status && (
                  <span className="px-2 py-0.5 text-xs bg-muted text-foreground rounded text-start">
                    {item.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
            <div className="text-end">
              <div className="text-sm font-semibold text-foreground text-end">
                {formatMoneyWithCode(parseFloat(item.total_price.toString()))}
              </div>
              <div className="text-xs text-muted-foreground text-end">
                {item.quantity || 1} × {formatMoneyWithCode(parseFloat(item.price_per_unit.toString()))}
              </div>
              <OrderLineNetNote gross={item.total_price} net={item.net_amount} format={formatMoneyWithCode} />
            </div>
          </div>

          {/* Item Details */}
          {(item.color || item.brand) && (
            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
              {item.color && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">{t('color')}:</span> {item.color}
                </span>
              )}
              {item.brand && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">{t('brand')}:</span> {item.brand}
                </span>
              )}
            </div>
          )}

          {/* Condition Flags */}
          {(item.has_stain || item.has_damage) && (
            <div className="flex gap-2 mb-2">
              {item.has_stain && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-warning-bg text-warning-text border border-warning-border rounded">
                  <AlertCircle className="w-3 h-3" />
                  {t('stain')}
                </span>
              )}
              {item.has_damage && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-danger-bg text-danger-text border border-danger-border rounded">
                  <AlertCircle className="w-3 h-3" />
                  {t('damage')}
                </span>
              )}
            </div>
          )}

          {/* Notes */}
          {(item.stain_notes || item.damage_notes || item.notes) && (
            <div className="space-y-1 text-xs text-start">
              {item.stain_notes && (
                <div className="bg-warning-bg border border-warning-border rounded p-2 text-start">
                  <span className="font-medium text-warning-text">{t('stainNotes')}:</span>{' '}
                  <span className="text-warning-text">{item.stain_notes}</span>
                </div>
              )}
              {item.damage_notes && (
                <div className="bg-danger-bg border border-danger-border rounded p-2 text-start">
                  <span className="font-medium text-danger-text">{t('damageNotes')}:</span>{' '}
                  <span className="text-danger-text">{item.damage_notes}</span>
                </div>
              )}
              {item.notes && (
                <div className="bg-muted border border-border rounded p-2 text-start">
                  <span className="font-medium text-foreground">{t('notes')}:</span>{' '}
                  <span className="text-muted-foreground">{item.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Pieces Section - Expandable */}
          {(trackByPiece || isHighlightLine(item)) && orderId && tenantId && (
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => toggleItemExpansion(item.id)}
                className="w-full flex items-center justify-between text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
              >
                <span>
                  {tPieces('viewPieces')}
                </span>
                {expandedItemIds.has(item.id) ? (
                  <ChevronUp className="w-4 h-4 rtl:rotate-180" />
                ) : (
                  <ChevronDown className="w-4 h-4 rtl:rotate-180" />
                )}
              </button>
              
              {expandedItemIds.has(item.id) && orderId && tenantId && item.id && (
                <div className="mt-3">
                  <PiecesErrorBoundary>
                    <React.Suspense fallback={<div className="text-sm text-muted-foreground p-2">Loading pieces...</div>}>
                      <OrderPiecesManager
                        orderId={orderId}
                        itemId={item.id}
                        fileSource={FILE_SOURCES.ORDER_DETAIL}
                        tenantId={tenantId}
                        branchId={branchId}
                        readOnly={readOnly}
                        autoLoad={true}
                        enableBulkOperations={!readOnly}
                        pieceDensity="compact"
                        highlightPiece={isHighlightLine(item) ? highlightPiece : null}
                      />
                    </React.Suspense>
                  </PiecesErrorBoundary>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Summary */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between text-sm font-medium text-foreground">
          <span className="text-start">{t('totalItems')}:</span>
          <span className="text-end">{items.reduce((sum, item) => sum + (item.quantity || 1), 0)}</span>
        </div>
      </div>
    </div>
  );
}
