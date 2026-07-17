"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useBilingual } from '@/lib/utils/bilingual';
import { formatCodeLabel } from '@/lib/utils/format-code-label';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useMessage } from '@ui/feedback';
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

function itemDisplayName(
  item: OrderItem,
  getBilingual: (name?: string | null, name2?: string | null) => string,
  fallback: string
): string {
  const bilingual =
    getBilingual(item.product_name, item.product_name2) ||
    getBilingual(
      item.org_product_data_mst?.product_name,
      item.org_product_data_mst?.product_name2
    );
  return formatCodeLabel(bilingual || item.service_category_code, fallback);
}

/**
 * Preparation item rows with expandable piece editors.
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
  const tWorkflow = useTranslations('workflow');
  const { formatMoneyWithCode } = useTenantCurrency();
  const { trackByPiece } = useTenantSettingsWithDefaults(tenantOrgId);
  const getBilingual = useBilingual();
  const { token: csrfToken } = useCSRFToken();
  const { showErrorFrom } = useMessage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const itemIdsKey = items.map((i) => i.id).join('|');
  const expandSyncKey = `${defaultExpandAllPieces}:${trackByPiece}:${itemIdsKey}`;
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(() =>
    defaultExpandAllPieces && trackByPiece ? new Set(items.map((i) => i.id)) : new Set()
  );
  const [syncedExpandKey, setSyncedExpandKey] = useState(expandSyncKey);

  // Expand items during render when defaultExpandAllPieces is on (avoid setState-in-effect).
  if (expandSyncKey !== syncedExpandKey) {
    setSyncedExpandKey(expandSyncKey);
    if (defaultExpandAllPieces && trackByPiece) {
      setExpandedItemIds(new Set(items.map((i) => i.id)));
    }
  }

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItemIds((prev) => {
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
      const response = await fetch(`/api/v1/preparation/${orderId}/items/${id}`, {
        method: 'DELETE',
        headers: {
          ...getCSRFHeader(csrfToken),
        },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || tWorkflow('preparation.detail.deleteItemFailed'));
      }
      onItemsChange(items.filter((i) => i.id !== id));
    } catch (error) {
      showErrorFrom(error, { fallback: tWorkflow('preparation.detail.deleteItemFailed') });
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
      {items.map((item) => {
        const name = itemDisplayName(
          item,
          getBilingual,
          tWorkflow('preparation.detail.fallbackItem')
        );
        const expanded = expandedItemIds.has(item.id);

        return (
          <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 break-words">{name}</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {item.quantity} × {formatMoneyWithCode(Number(item.price_per_unit))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-sm font-semibold text-gray-900 tabular-nums">
                  {formatMoneyWithCode(Number(item.total_price))}
                </div>
                <CmxButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-200 hover:bg-red-50"
                  disabled={disabled || busyId === item.id}
                  aria-label={`${tCommon('delete')}: ${name}`}
                  onClick={() => {
                    void handleDelete(item.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 me-1" aria-hidden />
                  {tCommon('delete')}
                </CmxButton>
              </div>
            </div>

            {trackByPiece && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between px-1 font-medium text-gray-700"
                  onClick={() => toggleItemExpansion(item.id)}
                  aria-expanded={expanded}
                >
                  <span>{tPieces('viewPieces') || 'View Pieces'}</span>
                  {expanded ? (
                    <ChevronUp className="w-4 h-4" aria-hidden />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden />
                  )}
                </CmxButton>

                {expanded && (
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
        );
      })}
    </div>
  );
}
