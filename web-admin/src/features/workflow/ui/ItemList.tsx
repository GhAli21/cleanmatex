"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import type { OrderItem } from '@/types/order';

interface ItemListProps {
  orderId: string;
  /** Server-known tenant (e.g. order.tenant_org_id). Ensures piece prefs load without waiting on client auth. */
  tenantOrgId: string;
  branchId?: string | null;
  items: OrderItem[];
  /** When true (e.g. preparation), expand all item rows that contain pieces so prefs are visible without extra clicks. */
  defaultExpandAllPieces?: boolean;
  onItemsChange: (items: OrderItem[]) => void;
  /** After piece edits or preference saves — refresh price preview */
  onPiecesOrPrefsChange?: () => void;
  disabled?: boolean;
}

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.tenantOrgId
 * @param root0.branchId
 * @param root0.items
 * @param root0.defaultExpandAllPieces
 * @param root0.onItemsChange
 * @param root0.onPiecesOrPrefsChange
 * @param root0.disabled
 */
export function ItemList({
  orderId,
  tenantOrgId,
  branchId = null,
  items,
  defaultExpandAllPieces = false,
  onItemsChange,
  onPiecesOrPrefsChange,
  disabled,
}: ItemListProps) {
  const tPieces = useTranslations('newOrder.pieces');
  const tOrdPieces = useTranslations('orders.pieces');
  const tCommon = useTranslations('common');
  const { formatMoneyWithCode } = useTenantCurrency();
  const { trackByPiece } = useTenantSettingsWithDefaults(tenantOrgId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const itemIdsKey = items.map((i) => i.id).join('|');
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!defaultExpandAllPieces || !trackByPiece || items.length === 0) return;
    setExpandedItemIds(new Set(items.map((i) => i.id)));
  }, [defaultExpandAllPieces, trackByPiece, itemIdsKey]);

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
      {!trackByPiece && items.length > 0 && (
        <p
          className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
          role="status"
        >
          {tOrdPieces('pieceTrackingDisabled')}
        </p>
      )}
      {items.map((item) => (
        <div key={item.id} className="border border-gray-200 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {item.product_name || item.service_category_code || 'Item'}
              </div>
              <div className="text-xs text-gray-500">{item.quantity} × {formatMoneyWithCode(Number(item.price_per_unit))}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">{formatMoneyWithCode(Number(item.total_price))}</div>
              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={disabled || busyId === item.id}
                onClick={() => handleDelete(item.id)}
              >
                {tCommon('delete')}
              </CmxButton>
            </div>
          </div>

          {/* Pieces Section - Expandable */}
          {trackByPiece && (
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
                      tenantId={tenantOrgId}
                      branchId={branchId}
                      readOnly={false}
                      autoLoad={true}
                      enableBulkOperations
                      pieceDensity="compact"
                      onUpdate={() => {
                        onPiecesOrPrefsChange?.();
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


