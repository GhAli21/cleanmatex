/**
 * Processing Modal Component
 *
 * Main modal for editing order items in processing.
 * Shows items with expandable piece-level details (if USE_TRACK_BY_PIECE enabled).
 * Supports batch updates, split orders, and rack location management.
 */

'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { SummaryMessage } from '@/components/ui/summary-message';
import { Loader2, AlertCircle, Package, RefreshCw } from 'lucide-react';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import type {
  Order,
  OrderItem,
  ItemPiece,
  BatchUpdateRequest,
  SummaryMessage as SummaryMessageType,
  ProcessingStep,
} from '@/types/order';
import { ProcessingModalFilters } from './processing-modal-filters';
import { ProcessingItemRow } from './processing-item-row';
import { SplitConfirmationDialog } from './split-confirmation-dialog';

interface ProcessingModalProps {
  isOpen: boolean;
  orderId: string | null;
  tenantId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

/**
 * Generate pieces from an order item
 */
function generatePieces(item: OrderItem): ItemPiece[] {
  const pieces: ItemPiece[] = [];

  for (let i = 1; i <= item.quantity; i++) {
    pieces.push({
      id: `${item.id}-piece-${i}`,
      itemId: item.id,
      pieceNumber: i,
      isReady: i <= (item.quantity_ready || 0),
      currentStep: item.item_last_step as ProcessingStep | undefined,
      notes: '',
      rackLocation: '',
      isRejected: item.item_is_rejected || false,
    });
  }

  return pieces;
}

export function ProcessingModal({
  isOpen,
  orderId,
  tenantId,
  onClose,
  onRefresh,
}: ProcessingModalProps) {
  const t = useTranslations('processing.modal');
  const queryClient = useQueryClient();

  // Fetch tenant settings
  const {
    splitOrderEnabled,
    rejectEnabled,
    trackByPiece,
    rejectColor,
    isLoading: settingsLoading,
  } = useTenantSettingsWithDefaults(tenantId);

  // Debug logging
  React.useEffect(() => {
    console.log('[ProcessingModal] Settings loaded:', {
      tenantId,
      trackByPiece,
      splitOrderEnabled,
      rejectEnabled,
      settingsLoading,
    });
  }, [tenantId, trackByPiece, splitOrderEnabled, rejectEnabled, settingsLoading]);

  // State management
  const [expandedItemIds, setExpandedItemIds] = React.useState<Set<string>>(new Set());
  const [pieceStates, setPieceStates] = React.useState<Map<string, ItemPiece>>(new Map());
  const [selectedForSplit, setSelectedForSplit] = React.useState<Set<string>>(new Set());
  const [rackLocation, setRackLocation] = React.useState('');
  const [summaryMessage, setSummaryMessage] = React.useState<SummaryMessageType | null>(null);
  const [showSplitDialog, setShowSplitDialog] = React.useState(false);
  const [showRejectedOnTop, setShowRejectedOnTop] = React.useState(false);

  // Fetch order data
  const { data: orderData, isLoading: orderLoading, error: orderError } = useQuery({
    queryKey: ['order-processing', orderId],
    queryFn: async () => {
      console.log('[ProcessingModal] Fetching order:', orderId);

      const response = await fetch(`/api/v1/orders/${orderId}/state`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ProcessingModal] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      console.log('[ProcessingModal] Raw API Response:', json);

      // ✅ CORRECTED: Check actual format first (Format 3)
      let normalizedData;
      if (json.success && json.order && json.items) {
        // Format 3: { success: true, order: {}, items: [] } - ACTUAL FORMAT
        normalizedData = { order: json.order, items: json.items };
        console.log('[ProcessingModal] Format: success.order wrapper (actual format)');
      } else if (json.success && json.data) {
        // Format 1: { success: true, data: { order: {}, items: [] } }
        normalizedData = json.data;
        console.log('[ProcessingModal] Format: success.data wrapper');
      } else if (json.order && json.items) {
        // Format 2: { order: {}, items: [] }
        normalizedData = { order: json.order, items: json.items };
        console.log('[ProcessingModal] Format: direct order.items');
      } else {
        // ❌ Unexpected format
        console.error('[ProcessingModal] Unexpected response format:', json);
        normalizedData = { order: null, items: [] };
      }

      console.log('[ProcessingModal] Normalized Data:', {
        hasOrder: !!normalizedData.order,
        orderId: normalizedData.order?.id,
        itemsCount: normalizedData.items?.length || 0,
        items: normalizedData.items?.map((i: any) => ({ id: i.id, description: i.description }))
      });

      return normalizedData;
    },
    enabled: isOpen && !!orderId,
    retry: 1,
    staleTime: 0,  // Always fetch fresh
    gcTime: 0,     // Don't cache
  });

  const order: Order | null = orderData?.order || null;
  const items: OrderItem[] = orderData?.items || [];

  // ✅ Comprehensive debug logging
  React.useEffect(() => {
    if (!isOpen) return;

    console.log('[ProcessingModal] State Update:', {
      isOpen,
      orderId,
      orderLoading,
      hasError: !!orderError,
      errorMessage: orderError instanceof Error ? orderError.message : 'none',
      hasOrderData: !!orderData,
      hasOrder: !!order,
      itemsCount: items.length,
    });

    if (orderError) {
      console.error('[ProcessingModal] Error Details:', orderError);
    }

    if (!orderLoading && !orderError && !order) {
      console.warn('[ProcessingModal] No order data but no error - possible format mismatch');
    }
  }, [isOpen, orderId, orderLoading, orderError, orderData, order, items]);

  // Initialize piece states when items load
  React.useEffect(() => {
    if (items.length > 0 && pieceStates.size === 0) {
      const initialStates = new Map<string, ItemPiece>();

      items.forEach(item => {
        const pieces = generatePieces(item);
        pieces.forEach(piece => {
          initialStates.set(piece.id, piece);
        });
      });

      setPieceStates(initialStates);
    }
  }, [items, pieceStates.size]);

  // Set initial rack location from order
  React.useEffect(() => {
    if (order?.rack_location && !rackLocation) {
      setRackLocation(order.rack_location);
    }
  }, [order, rackLocation]);

  // Batch update mutation
  const updateMutation = useMutation({
    mutationFn: async (request: BatchUpdateRequest) => {
      const response = await fetch(`/api/v1/orders/${orderId}/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) throw new Error('Failed to update order');
      return response.json();
    },
    onSuccess: (data) => {
      setSummaryMessage({
        type: 'success',
        title: t('summary.updateSuccess'),
        items: [
          t('summary.piecesUpdated', { count: data.summary.piecesUpdated }),
          t('summary.readyCount', { count: data.summary.readyCount }),
          data.summary.stepsRecorded > 0
            ? t('summary.stepsRecorded', { count: data.summary.stepsRecorded })
            : null,
          data.summary.rackLocationsSet > 0
            ? t('summary.rackLocationsSet', { count: data.summary.rackLocationsSet })
            : null,
        ].filter(Boolean) as string[],
      });

      // Refresh parent list
      onRefresh?.();
      queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
    },
    onError: (error) => {
      setSummaryMessage({
        type: 'error',
        title: 'Update Failed',
        items: [error instanceof Error ? error.message : 'Unknown error'],
      });
    },
  });

  // Split order mutation
  const splitMutation = useMutation({
    mutationFn: async ({ pieceIds, reason }: { pieceIds: string[]; reason: string }) => {
      const response = await fetch(`/api/v1/orders/${orderId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceIds, reason }),
      });

      if (!response.ok) throw new Error('Failed to split order');
      return response.json();
    },
    onSuccess: (data) => {
      setSummaryMessage({
        type: 'success',
        title: t('summary.splitSuccess'),
        items: [
          t('summary.newOrder', { orderNumber: data.newOrderNumber }),
          t('summary.movedPieces', { count: data.movedPieces }),
        ],
      });

      // Clear split selection
      setSelectedForSplit(new Set());
      setShowSplitDialog(false);

      // Refresh
      onRefresh?.();
      queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
    },
    onError: (error) => {
      setSummaryMessage({
        type: 'error',
        title: 'Split Failed',
        items: [error instanceof Error ? error.message : 'Unknown error'],
      });
    },
  });

  // Handle update button click
  const handleUpdate = () => {
    // Collect all piece updates
    const updates = Array.from(pieceStates.values()).map(piece => ({
      pieceId: piece.id,
      itemId: piece.itemId,
      pieceNumber: piece.pieceNumber,
      isReady: piece.isReady,
      currentStep: piece.currentStep,
      notes: piece.notes,
      rackLocation: piece.rackLocation,
    }));

    // Calculate quantity_ready per item
    const itemQuantityReady: Record<string, number> = {};
    items.forEach(item => {
      const itemPieces = updates.filter(u => u.itemId === item.id);
      const readyCount = itemPieces.filter(u => u.isReady).length;
      itemQuantityReady[item.id] = readyCount;
    });

    updateMutation.mutate({
      updates,
      itemQuantityReady,
      orderRackLocation: rackLocation,
    });
  };

  // Handle split confirmation
  const handleSplitConfirm = (reason: string) => {
    const pieceIds = Array.from(selectedForSplit);
    splitMutation.mutate({ pieceIds, reason });
  };

  // Handle piece state change
  const handlePieceChange = (pieceId: string, updates: Partial<ItemPiece>) => {
    setPieceStates(prev => {
      const newMap = new Map(prev);
      const piece = newMap.get(pieceId);
      if (piece) {
        newMap.set(pieceId, { ...piece, ...updates });
      }
      return newMap;
    });
  };

  // Handle split selection toggle
  const handleSplitToggle = (pieceId: string, selected: boolean) => {
    setSelectedForSplit(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(pieceId);
      } else {
        newSet.delete(pieceId);
      }
      return newSet;
    });
  };

  // Handle item expansion
  const handleToggleExpand = (itemId: string) => {
    setExpandedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Get pieces for an item
  const getPiecesForItem = (itemId: string): ItemPiece[] => {
    return Array.from(pieceStates.values())
      .filter(piece => piece.itemId === itemId)
      .sort((a, b) => a.pieceNumber - b.pieceNumber);
  };

  // Sort items based on rejected filter
  const sortedItems = React.useMemo(() => {
    if (!showRejectedOnTop) return items;

    return [...items].sort((a, b) => {
      const aRejected = a.item_is_rejected || false;
      const bRejected = b.item_is_rejected || false;
      if (aRejected && !bRejected) return -1;
      if (!aRejected && bRejected) return 1;
      return 0;
    });
  }, [items, showRejectedOnTop]);

  const isLoading = orderLoading || settingsLoading;
  const hasChanges = pieceStates.size > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl w-full mx-4 h-[90vh] sm:h-[90vh] flex flex-col">
          {/* Header */}
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {order
                ? `${t('title')} - ${order.order_no}`
                : t('title')}
            </DialogTitle>
          </DialogHeader>

          {/* Loading State */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Error State */}
          {!isLoading && orderError && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-4 max-w-md">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    {t('error.loadingFailed') || 'Failed to Load Order'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-1">
                    {orderError instanceof Error
                      ? orderError.message
                      : 'An unknown error occurred'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Order ID: {orderId || 'Unknown'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                  <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
                    {t('close') || 'Close'}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      console.log('[ProcessingModal] Retrying fetch for order:', orderId);
                      queryClient.invalidateQueries({
                        queryKey: ['order-processing', orderId]
                      });
                    }}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('retry') || 'Retry'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {!isLoading && !orderError && order && (
            <>
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Filter Bar */}
                {rejectEnabled && (
                  <ProcessingModalFilters
                    showRejectedOnTop={showRejectedOnTop}
                    onToggleRejectedOnTop={setShowRejectedOnTop}
                  />
                )}

                {/* Items List */}
                <div className="space-y-3">
                  {sortedItems.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        {t('noItems') || 'No Items Found'}
                      </h3>
                      <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        {t('noItemsDesc') || 'This order has no items to process. Please check the order details or contact support.'}
                      </p>
                    </div>
                  ) : (
                    sortedItems.map(item => (
                      <ProcessingItemRow
                        key={item.id}
                        item={item}
                        pieces={getPiecesForItem(item.id)}
                        isExpanded={expandedItemIds.has(item.id)}
                        onToggleExpand={handleToggleExpand}
                        onPieceChange={handlePieceChange}
                        onSplitToggle={handleSplitToggle}
                        selectedForSplit={selectedForSplit}
                        splitOrderEnabled={splitOrderEnabled}
                        rejectEnabled={rejectEnabled}
                        trackByPiece={trackByPiece}
                        rejectColor={rejectColor}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Summary Message */}
              {summaryMessage && (
                <div className="flex-shrink-0">
                  <SummaryMessage
                    {...summaryMessage}
                    onDismiss={() => setSummaryMessage(null)}
                  />
                </div>
              )}

              {/* Footer */}
              <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-4">
                {/* Rack Location Input */}
                <div className="flex-1">
                  <Label htmlFor="rack-location">{t('rackLocationOrder')}</Label>
                  <Input
                    id="rack-location"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    placeholder={t('rackLocation')}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleUpdate}
                    disabled={!hasChanges || updateMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('update')}
                  </Button>

                  {splitOrderEnabled && selectedForSplit.size > 0 && (
                    <Button
                      variant="danger"
                      onClick={() => setShowSplitDialog(true)}
                      disabled={splitMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {t('splitOrder')} ({selectedForSplit.size})
                    </Button>
                  )}

                  <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">{t('close')}</Button>
                  </DialogClose>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Split Confirmation Dialog */}
      {splitOrderEnabled && (
        <SplitConfirmationDialog
          isOpen={showSplitDialog}
          pieceCount={selectedForSplit.size}
          onConfirm={handleSplitConfirm}
          onCancel={() => setShowSplitDialog(false)}
          isLoading={splitMutation.isPending}
        />
      )}
    </>
  );
}
