/**
 * Order Pieces Manager Component
 * Main component for managing order item pieces
 * Can be embedded in any screen that displays order data
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceList } from './PieceList';
import { PieceBarcodeScanner } from './PieceBarcodeScanner';
import { PieceBulkOperations } from './PieceBulkOperations';
import { Button } from '@/components/ui/Button';
import { Loader2, RefreshCw } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';
import { log } from '@/lib/utils/logger';
import { downloadPiecesCSV } from '@/lib/utils/piece-export';

export interface OrderPiecesManagerProps {
  orderId: string;
  itemId: string;
  tenantId: string;
  onUpdate?: () => void;
  readOnly?: boolean;
  showSplitCheckbox?: boolean;
  selectedForSplit?: Set<string>;
  onSplitToggle?: (pieceId: string, selected: boolean) => void;
  rejectColor?: string;
  autoLoad?: boolean;
  enableBarcodeScanner?: boolean;
  enableBulkOperations?: boolean;
}

export function OrderPiecesManager({
  orderId,
  itemId,
  tenantId,
  onUpdate,
  readOnly = false,
  showSplitCheckbox = false,
  selectedForSplit = new Set(),
  onSplitToggle,
  rejectColor = '#10B981',
  autoLoad = true,
  enableBarcodeScanner = false,
  enableBulkOperations = false,
}: OrderPiecesManagerProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();

  const [pieces, setPieces] = React.useState<OrderItemPiece[]>([]);
  const [loading, setLoading] = React.useState(autoLoad);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPieces, setSelectedPieces] = React.useState<Set<string>>(new Set());

  const loadPieces = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/orders/${orderId}/items/${itemId}/pieces`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load pieces');
      }

      const data = await response.json();
      setPieces(data.data || []);
    } catch (err) {
      log.error('[OrderPiecesManager] Error loading pieces', err instanceof Error ? err : new Error(String(err)), {
        feature: 'order_pieces',
        action: 'load_pieces',
        orderId,
        itemId,
      });
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orderId, itemId]);

  React.useEffect(() => {
    if (autoLoad) {
      loadPieces();
    }
  }, [autoLoad, loadPieces]);

  const handlePieceUpdate = React.useCallback(
    async (pieceId: string, updates: Partial<OrderItemPiece>) => {
      if (readOnly) return;

      // Optimistic update: update local state immediately
      const previousPieces = [...pieces];
      setPieces((prev) =>
        prev.map((p) => (p.id === pieceId ? { ...p, ...updates } : p))
      );

      try {
        const response = await fetch(
          `/api/v1/orders/${orderId}/items/${itemId}/pieces/${pieceId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update piece');
        }

        const data = await response.json();
        
        // Update with server response (may have additional fields)
        setPieces((prev) =>
          prev.map((p) => (p.id === pieceId ? { ...p, ...data.data } : p))
        );

        // Notify parent
        if (onUpdate) {
          onUpdate();
        }
      } catch (err) {
        // Rollback on error
        setPieces(previousPieces);
        log.error('[OrderPiecesManager] Error updating piece', err instanceof Error ? err : new Error(String(err)), {
          feature: 'order_pieces',
          action: 'update_piece',
          orderId,
          itemId,
          pieceId,
        });
        setError(err instanceof Error ? err.message : 'Failed to update piece');
      }
    },
    [orderId, itemId, readOnly, onUpdate, pieces]
  );

  const handleBatchUpdate = React.useCallback(
    async (updates: Array<{ pieceId: string; updates: Partial<OrderItemPiece> }>) => {
      if (readOnly) return;

      // Optimistic update: update local state immediately
      const previousPieces = [...pieces];
      setPieces((prev) => {
        const updated = [...prev];
        updates.forEach(({ pieceId, updates: pieceUpdates }) => {
          const index = updated.findIndex((p) => p.id === pieceId);
          if (index !== -1) {
            updated[index] = { ...updated[index], ...pieceUpdates };
          }
        });
        return updated;
      });

      try {
        const response = await fetch(
          `/api/v1/orders/${orderId}/items/${itemId}/pieces`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ updates }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update pieces');
        }

        // Reload pieces to get server state
        await loadPieces();

        // Notify parent
        if (onUpdate) {
          onUpdate();
        }
      } catch (err) {
        // Rollback on error
        setPieces(previousPieces);
        log.error('[OrderPiecesManager] Error batch updating pieces', err instanceof Error ? err : new Error(String(err)), {
          feature: 'order_pieces',
          action: 'batch_update_pieces',
          orderId,
          itemId,
          updateCount: updates.length,
        });
        setError(err instanceof Error ? err.message : 'Failed to update pieces');
      }
    },
    [orderId, itemId, readOnly, loadPieces, onUpdate, pieces]
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className={`ml-2 text-sm text-gray-500 ${isRTL ? 'mr-2 ml-0' : ''}`}>
          {t('loading')}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPieces}
          className={isRTL ? 'flex-row-reverse' : ''}
        >
          <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className={`flex ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} items-center`}>
        <h3 className={`text-sm font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('pieces')} ({pieces.length})
        </h3>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPieces}
            className={isRTL ? 'flex-row-reverse' : ''}
          >
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            {t('refresh')}
          </Button>
        )}
      </div>

      {/* Barcode Scanner */}
      {enableBarcodeScanner && !readOnly && (
        <PieceBarcodeScanner
          orderId={orderId}
          itemId={itemId}
          tenantId={tenantId}
          onScanSuccess={(pieceId) => {
            // Highlight scanned piece
            setSelectedPieces(new Set([pieceId]));
            // Reload pieces to get updated state
            loadPieces();
            onUpdate?.();
          }}
        />
      )}

      {/* Bulk Operations */}
      {enableBulkOperations && !readOnly && (
        <PieceBulkOperations
          pieces={pieces}
          selectedPieces={selectedPieces}
          onSelectionChange={setSelectedPieces}
          onBulkUpdate={handleBatchUpdate}
          onExport={(pieceIds) => {
            const selectedPiecesData = pieces.filter(p => pieceIds.includes(p.id));
            downloadPiecesCSV(selectedPiecesData, `pieces-export-${Date.now()}.csv`);
          }}
        />
      )}

      {/* Pieces List */}
      <PieceList
        pieces={pieces}
        onPieceUpdate={handlePieceUpdate}
        readOnly={readOnly}
        showSplitCheckbox={showSplitCheckbox}
        selectedForSplit={selectedForSplit}
        onSplitToggle={onSplitToggle}
        rejectColor={rejectColor}
      />
    </div>
  );
}

// Export batch update function for external use
export { OrderPiecesManager as default };

