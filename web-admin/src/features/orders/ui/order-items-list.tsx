'use client';

import { useState } from 'react';
import React from 'react';
import { AlertCircle, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/hooks/useBilingual';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';

interface OrderItem {
  id: string;
  service_category_code?: string | null;
  product_name?: string | null;
  product_name2?: string | null;
  quantity?: number | null;
  price_per_unit: number | string;
  total_price: number | string;
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
  trackByPiece?: boolean;
  readOnly?: boolean;
}

export function OrderItemsList({ 
  items, 
  orderId,
  tenantId,
  trackByPiece = false,
  readOnly = true 
}: OrderItemsListProps) {
  const t = useTranslations('orders.itemsList');
  const tPieces = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

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
      <div className={`text-center py-8 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
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
          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          <div className={`flex ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} items-start mb-2`}>
            <div className="flex-1">
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {getBilingual(item.product_name, item.product_name2) || item.service_category_code || t('item')}
                </span>
                {item.status && (
                  <span className={`px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded ${isRTL ? 'text-right' : 'text-left'}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
            <div className={isRTL ? 'text-left' : 'text-right'}>
              <div className={`text-sm font-semibold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>
                {parseFloat(item.total_price.toString()).toFixed(3)} OMR
              </div>
              <div className={`text-xs text-gray-500 ${isRTL ? 'text-left' : 'text-right'}`}>
                {item.quantity || 1} × {parseFloat(item.price_per_unit.toString()).toFixed(3)} OMR
              </div>
            </div>
          </div>

          {/* Item Details */}
          {(item.color || item.brand) && (
            <div className={`flex gap-4 text-xs text-gray-600 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {item.color && (
                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="font-medium">{t('color')}:</span> {item.color}
                </span>
              )}
              {item.brand && (
                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="font-medium">{t('brand')}:</span> {item.brand}
                </span>
              )}
            </div>
          )}

          {/* Condition Flags */}
          {(item.has_stain || item.has_damage) && (
            <div className={`flex gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {item.has_stain && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <AlertCircle className="w-3 h-3" />
                  {t('stain')}
                </span>
              )}
              {item.has_damage && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <AlertCircle className="w-3 h-3" />
                  {t('damage')}
                </span>
              )}
            </div>
          )}

          {/* Notes */}
          {(item.stain_notes || item.damage_notes || item.notes) && (
            <div className={`space-y-1 text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
              {item.stain_notes && (
                <div className={`bg-yellow-50 border border-yellow-100 rounded p-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="font-medium text-yellow-800">{t('stainNotes')}:</span>{' '}
                  <span className="text-yellow-700">{item.stain_notes}</span>
                </div>
              )}
              {item.damage_notes && (
                <div className={`bg-red-50 border border-red-100 rounded p-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="font-medium text-red-800">{t('damageNotes')}:</span>{' '}
                  <span className="text-red-700">{item.damage_notes}</span>
                </div>
              )}
              {item.notes && (
                <div className={`bg-gray-50 border border-gray-100 rounded p-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="font-medium text-gray-700">{t('notes')}:</span>{' '}
                  <span className="text-gray-600">{item.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Pieces Section - Expandable */}
          {trackByPiece && orderId && tenantId && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={() => toggleItemExpansion(item.id)}
                className={`w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <span>
                  {tPieces('viewPieces')}
                </span>
                {expandedItemIds.has(item.id) ? (
                  <ChevronUp className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                ) : (
                  <ChevronDown className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                )}
              </button>
              
              {expandedItemIds.has(item.id) && orderId && tenantId && item.id && (
                <div className="mt-3">
                  <PiecesErrorBoundary>
                    <React.Suspense fallback={<div className="text-sm text-gray-500 p-2">Loading pieces...</div>}>
                      <OrderPiecesManager
                        orderId={orderId}
                        itemId={item.id}
                        tenantId={tenantId}
                        readOnly={readOnly}
                        autoLoad={true}
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
      <div className="pt-4 border-t border-gray-200">
        <div className={`flex ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} text-sm font-medium text-gray-900`}>
          <span className={isRTL ? 'text-right' : 'text-left'}>{t('totalItems')}:</span>
          <span className={isRTL ? 'text-left' : 'text-right'}>{items.reduce((sum, item) => sum + (item.quantity || 1), 0)}</span>
        </div>
      </div>
    </div>
  );
}
