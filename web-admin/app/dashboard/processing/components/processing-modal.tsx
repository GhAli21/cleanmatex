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
import { Loader2, AlertCircle, Package, RefreshCw, User, Phone, Calendar } from 'lucide-react';
import { CmxProgressIndicator } from '@/src/ui/feedback/cmx-progress-indicator';
import { CmxStatusBadge } from '@/src/ui/feedback/cmx-status-badge';
import { CmxProcessingStepTimeline } from '@/src/ui/data-display/cmx-processing-step-timeline';
import { Card } from '@/src/ui/primitives/card';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type {
  Order,
  OrderItem,
  ItemPiece,
  BatchUpdateRequest,
  SummaryMessage as SummaryMessageType,
  ProcessingStep,
  OrderItemPiece,
  ProcessingStepConfig,
} from '@/types/order';
import { ProcessingModalFilters } from './processing-modal-filters';
import { ProcessingItemRow } from './processing-item-row';
import { SplitConfirmationDialog } from './split-confirmation-dialog';
import { logger } from '@/lib/utils/logger';

interface ProcessingModalProps {
  isOpen: boolean;
  orderId: string | null;
  tenantId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

/**
 * Generate pieces from an order item
 * Only used when trackByPiece is disabled (legacy mode)
 * When trackByPiece is enabled, pieces are loaded directly from DB
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

/**
 * Map OrderItemPiece (from DB) to ItemPiece (for UI)
 * Converts database piece format to component format
 */
function mapDbPieceToItemPiece(dbPiece: OrderItemPiece & { is_ready?: boolean | null }, itemId: string): ItemPiece {
  // is_ready exists in DB but not in OrderItemPiece type, so we access it via type assertion
  const isReady = (dbPiece as any).is_ready ?? false;
  const pieceStatus = dbPiece.piece_status;

  return {
    id: dbPiece.id, // Use actual DB UUID
    itemId: itemId,
    pieceNumber: dbPiece.piece_seq,
    isReady: isReady || pieceStatus === 'ready',
    currentStep: dbPiece.last_step as ProcessingStep | undefined,
    notes: dbPiece.notes || '',
    rackLocation: dbPiece.rack_location || '',
    isRejected: dbPiece.is_rejected || false,
    // Include piece details
    color: dbPiece.color || null,
    brand: dbPiece.brand || null,
    has_stain: dbPiece.has_stain || null,
    has_damage: dbPiece.has_damage || null,
    barcode: dbPiece.barcode || null,
    piece_code: dbPiece.piece_code || null,
    scan_state: dbPiece.scan_state || null,
    // Status fields
    piece_status: pieceStatus || null,
    is_ready: isReady ?? null,
  };
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
  const { token: csrfToken } = useCSRFToken();

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
  const [originalPieceStates, setOriginalPieceStates] = React.useState<Map<string, ItemPiece>>(new Map());
  const [selectedForSplit, setSelectedForSplit] = React.useState<Set<string>>(new Set());
  const [rackLocation, setRackLocation] = React.useState('');
  const [summaryMessage, setSummaryMessage] = React.useState<SummaryMessageType | null>(null);
  const [showSplitDialog, setShowSplitDialog] = React.useState(false);
  const [showRejectedOnTop, setShowRejectedOnTop] = React.useState(false);
  const [filters, setFilters] = React.useState<{
    search: string;
    step: ProcessingStep | 'all';
    status: 'all' | 'ready' | 'not_ready';
    showRejectedOnTop: boolean;
  }>({
    search: '',
    step: 'all',
    status: 'all',
    showRejectedOnTop: false,
  });

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
    staleTime: 30000,  // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000,  // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,  // Don't refetch when window regains focus
    refetchOnMount: false,  // Don't refetch on mount if data exists
  });

  const order: Order | null = orderData?.order || null;
  const items: OrderItem[] = orderData?.items || [];
  // Customer data might be in orderData or nested in order
  const customerData = (orderData as any)?.customer || (order as any)?.customer || null;

  // Fetch processing steps for the order's service category
  const serviceCategoryCode = order?.service_category_code;
  const { data: processingStepsData } = useQuery<{ success: boolean; data?: ProcessingStepConfig[] }>({
    queryKey: ['processing-steps', tenantId, serviceCategoryCode],
    queryFn: async () => {
      if (!tenantId || !serviceCategoryCode) return { success: false };
      const response = await fetch(`/api/v1/processing-steps/${encodeURIComponent(serviceCategoryCode)}`);
      if (!response.ok) {
        console.error('[ProcessingModal] Failed to fetch processing steps:', response.statusText);
        return { success: false };
      }
      return response.json();
    },
    enabled: isOpen && !!orderId && !!tenantId && !!serviceCategoryCode,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const processingSteps: ProcessingStepConfig[] = processingStepsData?.data || [];

  // Fetch all pieces for the order in a single query (optimized)
  const { data: piecesData, isLoading: piecesLoading, error: piecesError } = useQuery({
    queryKey: ['order-pieces', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const response = await fetch(`/api/v1/orders/${orderId}/pieces`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: isOpen && !!orderId && trackByPiece,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Group pieces by itemId for O(1) lookup
  const piecesByItemId = React.useMemo(() => {
    const grouped = new Map<string, ItemPiece[]>();

    if (!piecesData?.pieces || !Array.isArray(piecesData.pieces)) {
      return grouped;
    }

    piecesData.pieces.forEach((dbPiece: OrderItemPiece) => {
      const itemId = dbPiece.order_item_id;
      const itemPiece = mapDbPieceToItemPiece(dbPiece, itemId);

      if (!grouped.has(itemId)) {
        grouped.set(itemId, []);
      }
      grouped.get(itemId)!.push(itemPiece);
    });

    // Sort pieces by piece_seq within each item
    grouped.forEach((pieces) => {
      pieces.sort((a, b) => a.pieceNumber - b.pieceNumber);
    });

    return grouped;
  }, [piecesData]);

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

  // Track if piece states have been initialized for current order
  const initializedOrderIdRef = React.useRef<string | null>(null);

  // Initialize piece states when items and pieces data load
  // Uses React Query data for trackByPiece mode, generates pieces otherwise
  React.useEffect(() => {
    if (!isOpen || !orderId || items.length === 0) return;

    // Only initialize if this is a new order (not already initialized)
    if (initializedOrderIdRef.current !== orderId) {
      const initialStates = new Map<string, ItemPiece>();

      if (trackByPiece) {
        // If trackByPiece is enabled, use pieces from React Query
        // Pieces are already grouped by itemId in piecesByItemId
        piecesByItemId.forEach((pieces, itemId) => {
          pieces.forEach(piece => {
            initialStates.set(piece.id, piece);
          });
        });

        // If no pieces found in DB but items exist, generate fallback (shouldn't happen if pieces are auto-created)
        if (piecesByItemId.size === 0 && !piecesLoading) {
          console.warn('[ProcessingModal] No DB pieces found, generating fallback for items');
          items.forEach(item => {
            const generatedPieces = generatePieces(item);
            generatedPieces.forEach(piece => {
              initialStates.set(piece.id, piece);
            });
          });
        }
      } else {
        // Not tracking by piece, generate pieces from items
        items.forEach(item => {
          const generatedPieces = generatePieces(item);
          generatedPieces.forEach(piece => {
            initialStates.set(piece.id, piece);
          });
        });
      }

      setPieceStates(initialStates);
      // Store original states for comparison
      setOriginalPieceStates(new Map(initialStates));
      initializedOrderIdRef.current = orderId;
    } else {
      // If order is already initialized, merge new pieces without overwriting existing state
      // This handles cases where items are added after initial load
      setPieceStates(prev => {
        const newMap = new Map(prev);
        let hasNewPieces = false;

        items.forEach(item => {
          if (trackByPiece && piecesByItemId.has(item.id)) {
            // Use DB pieces if available
            const dbPieces = piecesByItemId.get(item.id) || [];
            dbPieces.forEach(piece => {
              if (!newMap.has(piece.id)) {
                newMap.set(piece.id, piece);
                hasNewPieces = true;
              }
            });
          } else {
            // Generate pieces for new items
            const pieces = generatePieces(item);
            pieces.forEach(piece => {
              if (!newMap.has(piece.id)) {
                newMap.set(piece.id, piece);
                hasNewPieces = true;
              }
            });
          }
        });

        // Only update if there are new pieces
        return hasNewPieces ? newMap : prev;
      });
    }
  }, [isOpen, orderId, items, trackByPiece, piecesByItemId, piecesLoading]);

  // Set initial rack location from order
  React.useEffect(() => {
    if (order?.rack_location && !rackLocation) {
      setRackLocation(order.rack_location);
    }
  }, [order, rackLocation]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      // Reset all state when modal closes
      setExpandedItemIds(new Set());
      setPieceStates(new Map());
      setOriginalPieceStates(new Map());
      setSelectedForSplit(new Set());
      setRackLocation('');
      setSummaryMessage(null);
      setShowSplitDialog(false);
      setShowRejectedOnTop(false);
      initializedOrderIdRef.current = null;
    }
  }, [isOpen]);

  // Batch update mutation
  const updateMutation = useMutation({
    mutationFn: async (request: BatchUpdateRequest) => {
      const response = await fetch(`/api/v1/orders/${orderId}/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to update order');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Calculate actual counts from the request (use request data, not API response)
      const actualPiecesUpdated = variables.updates.length;
      const actualReadyCount = variables.updates.filter(u => u.isReady).length;
      const actualStepsRecorded = new Set(variables.updates.filter(u => u.currentStep).map(u => u.currentStep)).size;
      const actualRackLocationsSet = variables.updates.filter(u => u.rackLocation && u.rackLocation.trim() !== '').length;

      // Build summary items - always show pieces updated if there are any updates
      const summaryItems: string[] = [];

      if (actualPiecesUpdated > 0) {
        summaryItems.push(String(t('summary.piecesUpdated', { count: actualPiecesUpdated })));
      }

      if (actualReadyCount > 0) {
        summaryItems.push(String(t('summary.readyCount', { count: actualReadyCount })));
      }

      if (actualStepsRecorded > 0) {
        summaryItems.push(String(t('summary.stepsRecorded', { count: actualStepsRecorded })));
      }

      if (actualRackLocationsSet > 0) {
        summaryItems.push(String(t('summary.rackLocationsSet', { count: actualRackLocationsSet })));
      }

      // If no items but we had updates, show a generic success message
      if (summaryItems.length === 0 && actualPiecesUpdated > 0) {
        summaryItems.push(String(t('summary.piecesUpdated', { count: actualPiecesUpdated })));
      }

      setSummaryMessage({
        type: 'success',
        title: String(t('summary.updateSuccess')),
        items: summaryItems,
      });

      // Update original states to current states after successful update
      setOriginalPieceStates(new Map(pieceStates));

      // Refresh parent list
      onRefresh?.();
      // Invalidate both order state and pieces cache to ensure fresh data
      if (isOpen && orderId) {
        queryClient.invalidateQueries({
          queryKey: ['order-processing', orderId],
        });
        queryClient.invalidateQueries({
          queryKey: ['order-pieces', orderId],
        });
      }
    },
    onError: (error) => {
      setSummaryMessage({
        type: 'error',
        title: 'Update Failed',
        items: [String(error instanceof Error ? error.message : 'Unknown error')],
      });
    },
  });

  // Split order mutation
  const splitMutation = useMutation({
    mutationFn: async ({ pieceIds, reason }: { pieceIds: string[]; reason: string }) => {
      const response = await fetch(`/api/v1/orders/${orderId}/split`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify({ pieceIds, reason }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to split order');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSummaryMessage({
        type: 'success',
        title: String(t('summary.splitSuccess')),
        items: [
          String(t('summary.newOrder', { orderNumber: data.newOrderNumber })),
          String(t('summary.movedPieces', { count: data.movedPieces })),
        ],
      });

      // Clear split selection
      setSelectedForSplit(new Set());
      setShowSplitDialog(false);

      // Refresh
      onRefresh?.();
      // Invalidate both order state and pieces cache to ensure fresh data
      if (isOpen && orderId) {
        queryClient.invalidateQueries({
          queryKey: ['order-processing', orderId],
        });
        queryClient.invalidateQueries({
          queryKey: ['order-pieces', orderId],
        });
      }
    },
    onError: (error) => {
      setSummaryMessage({
        type: 'error',
        title: 'Split Failed',
        items: [String(error instanceof Error ? error.message : 'Unknown error')],
      });
    },
  });

  // Helper function to check if a piece has changed
  const hasPieceChanged = (current: ItemPiece, original: ItemPiece | undefined): boolean => {
    if (!original) return true; // New piece, consider it changed

    return (
      current.isReady !== original.isReady ||
      (current.is_ready ?? false) !== (original.is_ready ?? false) ||
      current.currentStep !== original.currentStep ||
      (current.notes || '') !== (original.notes || '') ||
      (current.rackLocation || '') !== (original.rackLocation || '') ||
      current.isRejected !== original.isRejected ||
      (current.color || null) !== (original.color || null) ||
      (current.brand || null) !== (original.brand || null) ||
      (current.barcode || null) !== (original.barcode || null) ||
      (current.has_stain ?? null) !== (original.has_stain ?? null) ||
      (current.has_damage ?? null) !== (original.has_damage ?? null)
    );
  };

  // Handle update button click
  const handleUpdate = () => {
    // Only collect pieces that have actually changed
    const updates = Array.from(pieceStates.values())
      .filter(piece => {
        const original = originalPieceStates.get(piece.id);
        return hasPieceChanged(piece, original);
      })
      .map(piece => ({
        pieceId: piece.id, // Use the ID (could be DB ID or generated ID)
        itemId: piece.itemId,
        pieceNumber: piece.pieceNumber,
        isReady: piece.isReady,
        is_ready: piece.is_ready ?? null,
        currentStep: piece.currentStep,
        notes: piece.notes || '',
        rackLocation: piece.rackLocation || '',
        isRejected: piece.isRejected || false,
        color: piece.color || null,
        brand: piece.brand || null,
        barcode: piece.barcode || null,
        has_stain: piece.has_stain || null,
        has_damage: piece.has_damage || null,
      }));

    // Calculate quantity_ready per item
    const itemQuantityReady: Record<string, number> = {};
    items.forEach(item => {
      const itemPieces = updates.filter(u => u.itemId === item.id);
      const readyCount = itemPieces.filter(u => u.isReady).length;
      itemQuantityReady[item.id] = readyCount;
    });

    logger.info('[ProcessingModal] Saving updates:', {
      feature: 'ordersPieces',
      action: 'Update_ordersPieces',
      orderRackLocation: rackLocation,
      itemQuantityReady: itemQuantityReady,
      count: updates.length,
    });

    console.log('[ProcessingModal] Saving updates:', {
      updatesCount: updates.length,
      itemQuantityReady,
      orderRackLocation: rackLocation,
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
    console.log('[ProcessingModal] Piece change:', { pieceId, updates });
    setPieceStates(prev => {
      const newMap = new Map(prev);
      const piece = newMap.get(pieceId);
      if (piece) {
        const updatedPiece = { ...piece, ...updates };
        console.log('[ProcessingModal] Updating piece:', { pieceId, oldNotes: piece.notes, newNotes: updatedPiece.notes });
        newMap.set(pieceId, updatedPiece);
      } else {
        console.warn('[ProcessingModal] Piece not found:', pieceId);
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
  // Uses memoized piecesByItemId for O(1) lookup when trackByPiece is enabled
  // Falls back to pieceStates for legacy mode
  const getPiecesForItem = React.useCallback((itemId: string): ItemPiece[] => {
    if (trackByPiece && piecesByItemId.has(itemId)) {
      // Use memoized grouped pieces (already sorted)
      return piecesByItemId.get(itemId) || [];
    }
    // Fallback to pieceStates (for legacy mode or when pieces haven't loaded yet)
    return Array.from(pieceStates.values())
      .filter(piece => piece.itemId === itemId)
      .sort((a, b) => a.pieceNumber - b.pieceNumber);
  }, [trackByPiece, piecesByItemId, pieceStates]);

  // Filter and sort items based on filters
  const filteredAndSortedItems = React.useMemo(() => {
    let filtered = [...items];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(item => {
        const productName = (item.org_product_data_mst?.product_name || item.product_name || '').toLowerCase();
        const productName2 = (item.org_product_data_mst?.product_name2 || item.product_name2 || '').toLowerCase();
        return productName.includes(searchLower) || productName2.includes(searchLower);
      });
    }

    // Apply step filter
    if (filters.step !== 'all') {
      filtered = filtered.filter(item => {
        const itemPieces = getPiecesForItem(item.id);
        return itemPieces.some(piece => piece.currentStep === filters.step);
      });
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => {
        const itemPieces = getPiecesForItem(item.id);
        if (filters.status === 'ready') {
          return itemPieces.some(piece => piece.isReady);
        } else {
          return itemPieces.some(piece => !piece.isReady);
        }
      });
    }

    // Sort by rejected status if enabled
    if (filters.showRejectedOnTop || showRejectedOnTop) {
      filtered.sort((a, b) => {
        const aRejected = a.item_is_rejected || false;
        const bRejected = b.item_is_rejected || false;
        if (aRejected && !bRejected) return -1;
        if (!aRejected && bRejected) return 1;
        return 0;
      });
    }

    return filtered;
  }, [items, filters, showRejectedOnTop]);

  // Loading states - separate for order vs pieces
  const isLoading = orderLoading || settingsLoading;
  const isPiecesLoading = piecesLoading && trackByPiece;
  const hasChanges = pieceStates.size > 0;

  // Calculate overall progress
  const overallProgress = React.useMemo(() => {
    if (!order || items.length === 0) return 0;
    const allPieces = Array.from(pieceStates.values());
    const totalPieces = allPieces.length || items.reduce((sum, item) => sum + item.quantity, 0);
    const readyPieces = allPieces.filter(p => p.isReady).length;
    return totalPieces > 0 ? (readyPieces / totalPieces) * 100 : 0;
  }, [order, items, pieceStates]);

  // Calculate overall order step and completed steps using dynamic steps from service category
  const { overallCurrentStep, overallCompletedSteps } = React.useMemo(() => {
    const allPieces = Array.from(pieceStates.values());
    if (allPieces.length === 0 || processingSteps.length === 0) {
      return { overallCurrentStep: null, overallCompletedSteps: new Set<ProcessingStep>() };
    }

    // Get active steps sorted by step_seq
    const activeSteps = processingSteps
      .filter(step => step.is_active)
      .sort((a, b) => a.step_seq - b.step_seq)
      .map(step => step.step_code as ProcessingStep);

    if (activeSteps.length === 0) {
      return { overallCurrentStep: null, overallCompletedSteps: new Set<ProcessingStep>() };
    }

    // Get all current steps from pieces
    const pieceSteps = allPieces
      .map(p => p.currentStep)
      .filter((step): step is ProcessingStep => !!step);

    if (pieceSteps.length === 0) {
      return { overallCurrentStep: null, overallCompletedSteps: new Set<ProcessingStep>() };
    }

    // Find the minimum step (earliest step) - this represents the overall order progress
    // If all pieces are at different steps, show the earliest one
    let minStepIndex = Infinity;
    let overallStep: ProcessingStep | null = null;

    pieceSteps.forEach(step => {
      const stepIndex = activeSteps.indexOf(step);
      if (stepIndex !== -1 && stepIndex < minStepIndex) {
        minStepIndex = stepIndex;
        overallStep = step;
      }
    });

    // Calculate completed steps (steps before the current step)
    const completedSteps = new Set<ProcessingStep>();
    if (overallStep && minStepIndex > 0) {
      for (let i = 0; i < minStepIndex; i++) {
        completedSteps.add(activeSteps[i]);
      }
    }

    return {
      overallCurrentStep: overallStep,
      overallCompletedSteps: completedSteps,
    };
  }, [pieceStates, processingSteps]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !updateMutation.isPending) {
          handleUpdate();
        }
      }

      // Esc to close
      if (e.key === 'Escape' && !updateMutation.isPending && !splitMutation.isPending) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasChanges, updateMutation.isPending, splitMutation.isPending, onClose]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-4xl w-full mx-4 h-[90vh] sm:h-[90vh] flex flex-col"
          aria-labelledby="processing-modal-title"
          aria-describedby="processing-modal-description"
        >
          {/* Enhanced Header */}
          <DialogHeader className="flex-shrink-0 pb-4 border-b">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <DialogTitle
                    id="processing-modal-title"
                    className="text-xl sm:text-2xl font-bold text-gray-900 mb-2"
                  >
                    {order
                      ? `${t('title')} - ${order.order_no}`
                      : t('title')}
                  </DialogTitle>
                  <p id="processing-modal-description" className="sr-only">
                    {t('modalDescription') || 'Manage and update processing details for order items and pieces'}
                  </p>
                  {order && (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      {customerData && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          <span>
                            {customerData.name ||
                              customerData.phone ||
                              customerData.display_name ||
                              'Unknown Customer'}
                          </span>
                        </div>
                      )}
                      {customerData?.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-4 w-4" />
                          <span>{customerData.phone}</span>
                        </div>
                      )}
                      {order.ready_by && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(order.ready_by).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {order?.status && (
                  <CmxStatusBadge
                    label={order.status.replace('_', ' ').toUpperCase()}
                    variant="info"
                    size="md"
                    className="capitalize"
                  />
                )}
              </div>

              {/* Overall Progress */}
              {order && items.length > 0 && (
                <div className="pt-2 space-y-3">
                  <CmxProgressIndicator
                    value={overallProgress}
                    size="sm"
                    variant={overallProgress === 100 ? 'success' : 'default'}
                    showPercentage={true}
                    label={`Overall Progress: ${Array.from(pieceStates.values()).filter(p => p.isReady).length} / ${Array.from(pieceStates.values()).length || items.reduce((sum, item) => sum + item.quantity, 0)} pieces ready`}
                  />
                </div>
              )}
            </div>
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
                {/* Enhanced Filter Bar */}
                <ProcessingModalFilters
                  showRejectedOnTop={showRejectedOnTop}
                  onToggleRejectedOnTop={setShowRejectedOnTop}
                  filters={filters}
                  onFiltersChange={setFilters}
                  rejectEnabled={rejectEnabled}
                />

                {/* Items List */}
                <div className="space-y-3">
                  {filteredAndSortedItems.length === 0 ? (
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
                    <>
                      {filteredAndSortedItems.map(item => (
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
                          orderId={orderId || undefined}
                          tenantId={tenantId}
                        />
                      ))}
                      {/* Show loading indicator for pieces if still loading */}
                      {isPiecesLoading && trackByPiece && (
                        <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span>Loading pieces...</span>
                        </div>
                      )}
                    </>
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
              <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-6 pt-4">
                {/* Rack Location Input */}
                <div className="flex-1 space-y-2">
                  <Label htmlFor="rack-location" className="block text-sm font-medium text-gray-700">
                    {t('rackLocationOrder')}
                  </Label>
                  <Input
                    id="rack-location"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    placeholder={t('rackLocationPlaceholder') || t('rackLocation')}
                    label="" // Clear label since we're using Label component above
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleUpdate}
                    disabled={!hasChanges || updateMutation.isPending}
                    className="w-full sm:w-auto"
                    aria-label={`${t('update')} (Ctrl+S)`}
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('update')}
                    <span className="ml-2 text-xs opacity-70 hidden sm:inline">
                      (Ctrl+S)
                    </span>
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
