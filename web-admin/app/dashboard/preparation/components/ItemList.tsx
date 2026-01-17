"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OrderPiecesManager } from '@/components/orders/OrderPiecesManager';
import { PiecesErrorBoundary } from '@/components/orders/PiecesErrorBoundary';
import type { OrderItem } from '@/types/order';

interface ItemListProps {
  orderId: string;
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  disabled?: boolean;
}

export function ItemList({ orderId, items, onItemsChange, disabled }: ItemListProps) {
  const tPieces = useTranslations('newOrder.pieces');
  const { currentTenant } = useAuth();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const [busyId, setBusyId] = useState<string | null>(null);
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

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/v1/preparation/${orderId}/items/${id}`, { method: 'DELETE' });
      onItemsChange(items.filter((i) => i.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="border border-gray-200 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {item.product_name || item.service_category_code || 'Item'}
              </div>
              <div className="text-xs text-gray-500">{item.quantity} × {Number(item.price_per_unit).toFixed(3)} OMR</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">{Number(item.total_price).toFixed(3)} OMR</div>
              <button
                disabled={disabled || busyId === item.id}
                onClick={() => handleDelete(item.id)}
                className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Pieces Section - Expandable */}
          {trackByPiece && currentTenant?.tenant_id && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={() => toggleItemExpansion(item.id)}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <span>
                  {tPieces('viewPieces') || 'View Pieces'}
                </span>
                {expandedItemIds.has(item.id) ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {expandedItemIds.has(item.id) && (
                <div className="mt-3">
                  <PiecesErrorBoundary>
                    <OrderPiecesManager
                      orderId={orderId}
                      itemId={item.id}
                      tenantId={currentTenant.tenant_id}
                      readOnly={false}
                      autoLoad={true}
                      onUpdate={() => {
                        // Refresh items if needed
                      }}
                    />
                  </PiecesErrorBoundary>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


