/**
 * Processing Item Row Component
 *
 * Displays a single order item with expandable piece details.
 * Shows aggregate status and "Pieces" button to expand/collapse.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { OrderItem, ItemPiece, OrderItemPiece } from '@/types/order';
import { ProcessingPieceRow } from './processing-piece-row';
import { OrderPiecesManager } from '@/components/orders/OrderPiecesManager';

interface ProcessingItemRowProps {
  item: OrderItem;
  pieces: ItemPiece[];
  isExpanded: boolean;
  onToggleExpand: (itemId: string) => void;
  onPieceChange: (pieceId: string, updates: Partial<ItemPiece>) => void;
  onSplitToggle: (pieceId: string, selected: boolean) => void;
  selectedForSplit: Set<string>;
  splitOrderEnabled: boolean;
  rejectEnabled: boolean;
  trackByPiece: boolean;
  rejectColor: string;
  orderId?: string;
  tenantId?: string;
  useDbPieces?: boolean; // New prop to use DB pieces instead of client-side
}

export function ProcessingItemRow({
  item,
  pieces,
  isExpanded,
  onToggleExpand,
  onPieceChange,
  onSplitToggle,
  selectedForSplit,
  splitOrderEnabled,
  rejectEnabled,
  trackByPiece,
  rejectColor,
  orderId,
  tenantId,
  useDbPieces = false,
}: ProcessingItemRowProps) {
  const t = useTranslations('processing.modal');

  const isRejected = item.item_is_rejected || pieces.some(p => p.isRejected);
  const readyCount = pieces.filter(p => p.isReady).length;
  const totalCount = item.quantity;

  // Debug logging
  React.useEffect(() => {
    console.log('[ProcessingItemRow] Props:', {
      itemId: item.id,
      trackByPiece,
      splitOrderEnabled,
      rejectEnabled,
      piecesCount: pieces.length,
    });
  }, [item.id, trackByPiece, splitOrderEnabled, rejectEnabled, pieces.length]);

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{
        borderLeftWidth: isRejected ? '4px' : '1px',
        borderLeftColor: isRejected ? rejectColor : undefined,
      }}
    >
      {/* Item Header */}
      <div className="p-4 bg-gray-50 flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">
            {item.org_product_data_mst?.product_name || item.product_name || 'Unknown Item'}
          </h3>
          {(item.org_product_data_mst?.product_name2 || item.product_name2) && (
            <p className="text-sm text-gray-600">
              {item.org_product_data_mst?.product_name2 || item.product_name2}
            </p>
          )}
          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
            <span>
              {t('quantityReady', { ready: readyCount, total: totalCount })}
            </span>
            {item.item_last_step && (
              <span className="capitalize">
                Step: {item.item_last_step.replace('_', ' ')}
              </span>
            )}
            {isRejected && rejectEnabled && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${rejectColor}40`,
                  color: rejectColor,
                }}
              >
                {t('rejected')}
              </span>
            )}
          </div>
        </div>

        {/* Pieces Button - Only show if trackByPiece is enabled */}
        {trackByPiece && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleExpand(item.id)}
            className="ml-4"
          >
            {t('pieces')}
            {isExpanded ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Pieces Detail - Only show if trackByPiece is enabled AND expanded */}
      {trackByPiece && isExpanded && (
        <div className="p-4 bg-white">
          {useDbPieces && orderId && tenantId ? (
            // Use database-backed pieces manager
            <OrderPiecesManager
              orderId={orderId}
              itemId={item.id}
              tenantId={tenantId}
              onUpdate={() => {
                // Refresh parent when pieces are updated
                onToggleExpand(item.id); // Collapse and re-expand to refresh
                setTimeout(() => onToggleExpand(item.id), 100);
              }}
              readOnly={false}
              showSplitCheckbox={splitOrderEnabled}
              selectedForSplit={selectedForSplit}
              onSplitToggle={onSplitToggle}
              rejectColor={rejectColor}
              autoLoad={true}
            />
          ) : (
            // Fallback to client-side pieces (for backward compatibility)
            <div className="space-y-2">
              {pieces.map(piece => (
                <ProcessingPieceRow
                  key={piece.id}
                  piece={piece}
                  onChange={(updates) => onPieceChange(piece.id, updates)}
                  onSplitToggle={(selected) => onSplitToggle(piece.id, selected)}
                  isSelectedForSplit={selectedForSplit.has(piece.id)}
                  splitOrderEnabled={splitOrderEnabled}
                  rejectEnabled={rejectEnabled}
                  rejectColor={rejectColor}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Item-Level View - Show if trackByPiece is disabled */}
      {!trackByPiece && (
        <div className="p-4 bg-white">
          <div className="text-sm text-gray-600">
            <p>Item-level tracking active</p>
            <p className="mt-1">
              Status: <span className="font-medium capitalize">{item.status}</span>
            </p>
            {item.notes && (
              <p className="mt-2">
                <span className="font-medium">Notes:</span> {item.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
