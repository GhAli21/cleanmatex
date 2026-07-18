/**
 * Processing Modal Component
 *
 * Main modal for editing order items in processing.
 * Shows items with expandable piece-level details.
 * Supports batch updates, split orders, and rack location management.
 */

'use client';

import * as React from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogClose,
} from '@ui/overlays';
import { CmxButton, CmxInput, Label } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';
import { Loader2, AlertCircle, Package, RefreshCw, User, Phone, Calendar } from 'lucide-react';
import { CmxProgressIndicator } from '@/src/ui/feedback/cmx-progress-indicator';
import { CmxStatusBadge } from '@/src/ui/feedback/cmx-status-badge';
import { CmxProcessingStepTimeline } from '@/src/ui/data-display/cmx-processing-step-timeline';
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
import { useBilingual } from '@/lib/utils/bilingual';
import { usePreferenceCatalog } from '@/src/features/orders/hooks/use-preference-catalog';
import { buildColorHexByCode } from '@/src/features/orders/ui/piece-preferences/piece-preference-readonly-chips';
import { buildPrefNameByCode } from '@/src/features/orders/ui/piece-preferences/pref-display-labels';
import {
  groupPiecesByItemId,
  hasProcessingPieceChanged,
  normalizeOrderStateResponse,
} from '@features/workflow/lib/processing-piece-map';
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
 * Fallback when pieces are not yet loaded from DB; normally pieces are loaded from DB
 * @param item
 */
function generatePieces(item: OrderItem): ItemPiece[] {
  const pieces: ItemPiece[] = [];

  for (let i = 1; i <= item.quantity; i++) {
    const isReady = i <= (item.quantity_ready || 0);
    pieces.push({
      id: `${item.id}-piece-${i}`,
      itemId: item.id,
      pieceNumber: i,
      // is_ready is the source of truth, isReady is computed for backward compatibility
      is_ready: isReady ? true : null,
      isReady: isReady,
      currentStep: item.item_last_step as ProcessingStep | undefined,
      piece_stage: null,
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
 * @param dbPiece
 * @param itemId
 */
function mapDbPieceToItemPiece(dbPiece: OrderItemPiece & { is_ready?: boolean | null }, itemId: string): ItemPiece {
  // is_ready exists in DB but not in OrderItemPiece type, so we access it via type assertion
  const isReady = (dbPiece as any).is_ready ?? false;
  const pieceStatus = dbPiece.piece_status;

  return {
    id: dbPiece.id, // Use actual DB UUID
    itemId: itemId,
    pieceNumber: dbPiece.piece_seq,
    // isReady is now computed from is_ready or piece_status for backward compatibility (read-only)
    isReady: isReady || pieceStatus === 'ready',
    currentStep: dbPiece.last_step as ProcessingStep | undefined,
    notes: dbPiece.notes || '',
    rackLocation: dbPiece.rack_location || '',
    isRejected: dbPiece.is_rejected || false,
    has_stain: dbPiece.has_stain || null,
    has_damage: dbPiece.has_damage || null,
    barcode: dbPiece.barcode || null,
    piece_code: dbPiece.piece_code || null,
    scan_state: dbPiece.scan_state || null,
    // Status fields - is_ready is the source of truth
    piece_status: pieceStatus || null,
    piece_stage: dbPiece.piece_stage || null,
    is_ready: isReady ?? null,
    // Preferences from org_order_preferences_dtl (color/brand columns are legacy)
    packingPrefCode: dbPiece.packing_pref_code || null,
    servicePrefs: dbPiece.service_prefs || undefined,
    colorPrefs: dbPiece.color_prefs || undefined,
  };
}

/**
 *
 * @param root0
 * @param root0.isOpen
 * @param root0.orderId
 * @param root0.tenantId
 * @param root0.onClose
 * @param root0.onRefresh
 */
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
    processingConfirmationEnabled,
    isLoading: settingsLoading,
  } = useTenantSettingsWithDefaults(tenantId, null, null, isOpen);

  const getBilingual = useBilingual();
  const { servicePrefs, packingPrefs, conditionCatalog } = usePreferenceCatalog(
    undefined,
    false,
    false,
    isOpen
  );
  const colorHexByCode = React.useMemo(
    () => buildColorHexByCode(conditionCatalog.colors),
    [conditionCatalog.colors]
  );
  const nameByCode = React.useMemo(
    () =>
      buildPrefNameByCode(
        {
          servicePrefs,
          packingPrefs,
          stains: conditionCatalog.stains,
          damages: conditionCatalog.damages,
          colors: conditionCatalog.colors,
        },
        getBilingual
      ),
    [servicePrefs, packingPrefs, conditionCatalog, getBilingual]
  );

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

  const { data: orderData, isLoading: orderLoading, error: orderError } = useQuery({
    queryKey: ['order-processing', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/state`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return normalizeOrderStateResponse(await response.json());
    },
    enabled: isOpen && !!orderId,
    retry: 1,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const order: Order | null = (orderData?.order as unknown as Order | null) ?? null;
  const items: OrderItem[] = (orderData?.items as unknown as OrderItem[]) ?? [];
  const customerData = (orderData?.customer as Record<string, unknown> | null) ?? null;

  const categoryCodesToFetch = React.useMemo(() => {
    const codes = new Set<string>();
    if (order?.service_category_code) {
      codes.add(order.service_category_code);
    }
    items.forEach((item) => {
      if (item.service_category_code) {
        codes.add(item.service_category_code);
      }
    });
    expandedItemIds.forEach((itemId) => {
      const item = items.find((entry) => entry.id === itemId);
      if (item?.service_category_code) {
        codes.add(item.service_category_code);
      }
    });
    return Array.from(codes);
  }, [order, items, expandedItemIds]);

  const processingStepsQueries = useQueries({
    queries: categoryCodesToFetch.map((serviceCategoryCode) => ({
      queryKey: ['processing-steps', tenantId, serviceCategoryCode],
      queryFn: async (): Promise<{ success: boolean; data?: ProcessingStepConfig[] }> => {
        const response = await fetch(
          `/api/v1/processing-steps/${encodeURIComponent(serviceCategoryCode)}`
        );
        if (!response.ok) {
          return { success: false };
        }
        return response.json();
      },
      enabled: isOpen && !!tenantId && !!serviceCategoryCode,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const processingStepsByCategory = React.useMemo(() => {
    const map = new Map<string, ProcessingStepConfig[]>();
    categoryCodesToFetch.forEach((code, index) => {
      map.set(code, processingStepsQueries[index]?.data?.data || []);
    });
    return map;
  }, [categoryCodesToFetch, processingStepsQueries]);

  const orderProcessingSteps =
    processingStepsByCategory.get(order?.service_category_code || '') || [];

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

  // Group DB pieces by itemId for initial hydrate only
  const dbPiecesByItemId = React.useMemo(() => {
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

    grouped.forEach((pieceList) => {
      pieceList.sort((a, b) => a.pieceNumber - b.pieceNumber);
    });

    return grouped;
  }, [piecesData]);

  // Stable piece arrays for row props (one array ref per item while pieceStates unchanged)
  const piecesByItemId = React.useMemo(
    () => groupPiecesByItemId(pieceStates),
    [pieceStates]
  );

  // Initialize piece states when items and pieces data load
  const initializedOrderIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !orderId || items.length === 0) return;

    // Only initialize if this is a new order (not already initialized)
    if (initializedOrderIdRef.current !== orderId) {
      if (trackByPiece && piecesLoading) return;

      const initialStates = new Map<string, ItemPiece>();

      if (trackByPiece) {
        dbPiecesByItemId.forEach((pieces) => {
          pieces.forEach((piece) => {
            initialStates.set(piece.id, piece);
          });
        });

        if (dbPiecesByItemId.size === 0 && !piecesLoading) {
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
          if (trackByPiece && dbPiecesByItemId.has(item.id)) {
            const dbPieces = dbPiecesByItemId.get(item.id) || [];
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
  }, [isOpen, orderId, items, trackByPiece, dbPiecesByItemId, piecesLoading]);

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
      const actualReadyCount = variables.updates.filter(u => u.is_ready === true).length;
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

  const handleUpdate = React.useCallback(() => {
    // Only collect pieces that have actually changed
    const updates = Array.from(pieceStates.values())
      .filter(piece => {
        const original = originalPieceStates.get(piece.id);
        return hasProcessingPieceChanged(piece, original);
      })
      .map(piece => ({
        pieceId: piece.id, // Use the ID (could be DB ID or generated ID)
        itemId: piece.itemId,
        pieceNumber: piece.pieceNumber,
        // Only send is_ready (source of truth), backend will handle piece_status
        is_ready: piece.is_ready ?? null,
        currentStep: piece.currentStep,
        piece_stage: piece.piece_stage || null,
        notes: piece.notes || '',
        rackLocation: piece.rackLocation || '',
        isRejected: piece.isRejected || false,
        barcode: piece.barcode || null,
        has_stain: piece.has_stain || null,
        has_damage: piece.has_damage || null,
      }));

    // Calculate quantity_ready per item
    const itemQuantityReady: Record<string, number> = {};
    items.forEach(item => {
      const itemPieces = updates.filter(u => u.itemId === item.id);
      const readyCount = itemPieces.filter(u => u.is_ready === true).length;
      itemQuantityReady[item.id] = readyCount;
    });

    logger.info('[ProcessingModal] Saving updates:', {
      feature: 'ordersPieces',
      action: 'Update_ordersPieces',
      orderRackLocation: rackLocation,
      itemQuantityReady: itemQuantityReady,
      count: updates.length,
    });

    updateMutation.mutate({
      updates,
      itemQuantityReady,
      orderRackLocation: rackLocation,
    });
  }, [
    pieceStates,
    originalPieceStates,
    items,
    rackLocation,
    updateMutation,
  ]);

  const handleSplitConfirm = React.useCallback((reason: string) => {
    const pieceIds = Array.from(selectedForSplit);
    splitMutation.mutate({ pieceIds, reason });
  }, [selectedForSplit, splitMutation]);

  const handlePieceChange = React.useCallback((pieceId: string, updates: Partial<ItemPiece>) => {
    setPieceStates(prev => {
      const newMap = new Map(prev);
      const piece = newMap.get(pieceId);
      if (piece) {
        newMap.set(pieceId, { ...piece, ...updates });
      }
      return newMap;
    });
  }, []);

  const handleSplitToggle = React.useCallback((pieceId: string, selected: boolean) => {
    setSelectedForSplit(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(pieceId);
      } else {
        newSet.delete(pieceId);
      }
      return newSet;
    });
  }, []);

  const handleToggleExpand = React.useCallback((itemId: string) => {
    setExpandedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const onConfirmSuccess = React.useCallback(() => {
    if (orderId) {
      queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
    }
  }, [orderId, queryClient]);

  const getPiecesForItem = React.useCallback((itemId: string): ItemPiece[] => {
    const fromState = piecesByItemId.get(itemId);
    if (fromState && fromState.length > 0) {
      return fromState;
    }
    if (trackByPiece && dbPiecesByItemId.has(itemId)) {
      return dbPiecesByItemId.get(itemId) || [];
    }
    return [];
  }, [trackByPiece, piecesByItemId, dbPiecesByItemId]);

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
          return itemPieces.some(piece => piece.is_ready === true);
        } else {
          return itemPieces.some(piece => piece.is_ready !== true);
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
  }, [items, filters, showRejectedOnTop, getPiecesForItem]);

  // Loading states - separate for order vs pieces
  const isLoading = orderLoading || settingsLoading;
  const isPiecesLoading = piecesLoading && trackByPiece;
  const hasChanges = React.useMemo(() => {
    const piecesDirty = Array.from(pieceStates.values()).some((piece) =>
      hasProcessingPieceChanged(piece, originalPieceStates.get(piece.id))
    );
    const rackDirty = rackLocation !== (order?.rack_location ?? '');
    return piecesDirty || rackDirty;
  }, [pieceStates, originalPieceStates, rackLocation, order?.rack_location]);

  // Calculate overall progress
  const overallProgress = React.useMemo(() => {
    if (!order || items.length === 0) return 0;
    const allPieces = Array.from(pieceStates.values());
    const totalPieces = allPieces.length || items.reduce((sum, item) => sum + item.quantity, 0);
    const readyPieces = allPieces.filter(p => p.is_ready === true).length;
    return totalPieces > 0 ? (readyPieces / totalPieces) * 100 : 0;
  }, [order, items, pieceStates]);

  // Calculate overall order step and completed steps using dynamic steps from service category
  const { overallCurrentStep, overallCompletedSteps } = React.useMemo(() => {
    const allPieces = Array.from(pieceStates.values());
    if (allPieces.length === 0 || orderProcessingSteps.length === 0) {
      return { overallCurrentStep: null, overallCompletedSteps: new Set<ProcessingStep>() };
    }

    const activeSteps = orderProcessingSteps
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
  }, [pieceStates, orderProcessingSteps]);

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
  }, [isOpen, hasChanges, updateMutation.isPending, splitMutation.isPending, onClose, handleUpdate]);

  return (
    <>
      <CmxDialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <CmxDialogContent
          className="max-w-4xl w-full mx-4 h-[90vh] sm:h-[90vh] flex flex-col"
          aria-labelledby="processing-modal-title"
          aria-describedby="processing-modal-description"
        >
          {/* Enhanced Header */}
          <CmxDialogHeader className="flex-shrink-0 pb-4 border-b">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CmxDialogTitle
                    id="processing-modal-title"
                    className="text-xl sm:text-2xl font-bold text-gray-900 mb-2"
                  >
                    {order
                      ? `${t('title')} - ${order.order_no}`
                      : t('title')}
                  </CmxDialogTitle>
                  <p id="processing-modal-description" className="sr-only">
                    {t('modalDescription') || 'Manage and update processing details for order items and pieces'}
                  </p>
                  {order && (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      {customerData && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          <span>
                            {String(
                              customerData.name ||
                                customerData.phone ||
                                customerData.display_name ||
                                'Unknown Customer'
                            )}
                          </span>
                        </div>
                      )}
                      {customerData?.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-4 w-4" />
                          <span>{String(customerData.phone)}</span>
                        </div>
                      ) : null}
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
                    label={`Overall Progress: ${Array.from(pieceStates.values()).filter(p => p.is_ready === true).length} / ${Array.from(pieceStates.values()).length || items.reduce((sum, item) => sum + item.quantity, 0)} pieces ready`}
                  />
                </div>
              )}
            </div>
          </CmxDialogHeader>

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
                  <CmxButton variant="secondary" onClick={onClose} className="w-full sm:w-auto">
                    {t('close') || 'Close'}
                  </CmxButton>
                  <CmxButton
                    variant="primary"
                    onClick={() => {
                      queryClient.invalidateQueries({
                        queryKey: ['order-processing', orderId]
                      });
                    }}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('retry') || 'Retry'}
                  </CmxButton>
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
                          processingConfirmationEnabled={processingConfirmationEnabled}
                          processingSteps={
                            processingStepsByCategory.get(item.service_category_code || '') || []
                          }
                          colorHexByCode={colorHexByCode}
                          nameByCode={nameByCode}
                          onConfirmSuccess={onConfirmSuccess}
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
                  <CmxSummaryMessage
                    {...summaryMessage}
                    onDismiss={() => setSummaryMessage(null)}
                  />
                </div>
              )}

              {/* Footer */}
              <CmxDialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-6 pt-4">
                {/* Rack Location Input */}
                <div className="flex-1 space-y-2">
                  <Label htmlFor="rack-location" className="block text-sm font-medium text-gray-700">
                    {t('rackLocationOrder')}
                  </Label>
                  <CmxInput
                    id="rack-location"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    placeholder={t('rackLocationPlaceholder') || t('rackLocation')}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <CmxButton
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
                  </CmxButton>

                  {splitOrderEnabled && selectedForSplit.size > 0 && (
                    <CmxButton
                      variant="destructive"
                      onClick={() => setShowSplitDialog(true)}
                      disabled={splitMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {t('splitOrder')} ({selectedForSplit.size})
                    </CmxButton>
                  )}

                  <CmxDialogClose asChild>
                    <CmxButton variant="outline" className="w-full sm:w-auto">{t('close')}</CmxButton>
                  </CmxDialogClose>
                </div>
              </CmxDialogFooter>
            </>
          )}
        </CmxDialogContent>
      </CmxDialog>

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
