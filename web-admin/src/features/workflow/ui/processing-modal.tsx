/**
 * Processing Modal Component
 * Full piece-level editor for processing orders: dynamic category steps,
 * service-category/condition filters, bulk piece actions, split orders,
 * rack management, and dirty-state close confirmation.
 */

'use client';

import * as React from 'react';
import { useQueries, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  Calendar,
  CheckCheck,
  History,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  User,
} from 'lucide-react';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxButton, CmxInput, CmxSkeleton, Label } from '@ui/primitives';
import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
import {
  CmxConfirmDialog,
  CmxStatusBadge,
  CmxSummaryMessage,
  cmxMessage,
  type CmxBadgeTone,
} from '@ui/feedback';
import { CmxProgressIndicator } from '@/src/ui/feedback/cmx-progress-indicator';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';
import { PRIORITY_LEVELS } from '@/lib/constants/order-types';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useBilingual } from '@/lib/utils/bilingual';
import { formatDateTime } from '@/lib/utils/rtl';
import { logger } from '@/lib/utils/logger';
import { OrderIssueRowActions } from '@features/orders/ui/issues/order-issue-row-actions';
import { usePreferenceCatalog } from '@/src/features/orders/hooks/use-preference-catalog';
import { buildColorHexByCode } from '@/src/features/orders/ui/piece-preferences/piece-preference-readonly-chips';
import { buildPrefNameByCode } from '@/src/features/orders/ui/piece-preferences/pref-display-labels';
import { pieceTagErrorMessage } from '@/src/features/workflow/lib/piece-tag-error';
import {
  groupPiecesByItemId,
  hasProcessingPieceChanged,
  normalizeOrderStateResponse,
  toSplitPieceId,
} from '@features/workflow/lib/processing-piece-map';
import type {
  BatchUpdateRequest,
  ItemPiece,
  Order,
  OrderItem,
  OrderItemPiece,
  ProcessingStep,
  ProcessingStepConfig,
  SummaryMessage as SummaryMessageType,
} from '@/types/order';
import { ProcessingItemRow } from './processing-item-row';
import { CmxFollowupNotesFeed } from './cmx-followup-notes-feed';
import { ProcessingTransactionsPanel } from './processing-transactions-panel';
import {
  NOTES_FOLLOWUP_TARGET_LEVELS,
  PRC_TRX_SOURCE_SCREENS,
} from '@/lib/constants/processing-trx';
import { PREFS_SOURCE_STAGE } from '@/lib/constants/order-preferences';
import type { PrefsFollowupNote } from '@/lib/utils/notes-followup';
import type { PieceTagSaved } from '@/src/features/scan/api/scan-api';
import {
  ProcessingModalFilters,
  type ProcessingFilterOption,
  type ProcessingModalFiltersState,
} from './processing-modal-filters';
import { SplitConfirmationDialog } from './split-confirmation-dialog';

interface ProcessingModalProps {
  isOpen: boolean;
  orderId: string | null;
  tenantId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

const KNOWN_ORDER_STATUS_KEYS = new Set([
  'processing',
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
  'in_wash',
  'in_dry',
  'in_finish',
  'qc',
  'qa',
  'assembly',
]);

function generatePieces(item: OrderItem): ItemPiece[] {
  const pieces: ItemPiece[] = [];
  for (let i = 1; i <= item.quantity; i++) {
    const isReady = i <= (item.quantity_ready || 0);
    pieces.push({
      id: `${item.id}-piece-${i}`,
      itemId: item.id,
      pieceNumber: i,
      is_ready: isReady ? true : null,
      isReady,
      currentStep: item.item_last_step as ProcessingStep | undefined,
      piece_stage: null,
      notes: '',
      notes_followup: [],
      processingNote: '',
      rackLocation: '',
      isRejected: item.item_is_rejected || false,
      serviceCategoryCode: item.service_category_code || null,
      serviceSpeed: item.service_speed || null,
      readyByAt: item.ready_by_at || null,
    });
  }
  return pieces;
}

function mapDbPieceToItemPiece(
  dbPiece: OrderItemPiece & { is_ready?: boolean | null },
  itemId: string
): ItemPiece {
  const isReady = dbPiece.is_ready ?? false;
  const pieceStatus = dbPiece.piece_status;

  return {
    id: dbPiece.id,
    itemId,
    pieceNumber: dbPiece.piece_seq,
    isReady: isReady || pieceStatus === 'ready',
    currentStep: dbPiece.last_step as ProcessingStep | undefined,
    notes: dbPiece.notes || '',
    notes_followup: dbPiece.notes_followup ?? [],
    processingNote: '',
    rackLocation: dbPiece.rack_location || '',
    isRejected: dbPiece.is_rejected || false,
    has_stain: dbPiece.has_stain || null,
    has_damage: dbPiece.has_damage || null,
    barcode: dbPiece.barcode || null,
    piece_code: dbPiece.piece_code || null,
    scan_state: dbPiece.scan_state || null,
    piece_status: pieceStatus || null,
    piece_stage: dbPiece.piece_stage || null,
    is_ready: isReady ?? null,
    issue_id: dbPiece.issue_id ?? null,
    packingPrefCode: dbPiece.packing_pref_code || null,
    servicePrefs: dbPiece.service_prefs || undefined,
    colorPrefs: dbPiece.color_prefs || undefined,
    serviceCategoryCode: dbPiece.service_category_code || null,
    serviceSpeed: dbPiece.service_speed || null,
    readyByAt: dbPiece.ready_by_at || null,
    lastStepAt: dbPiece.last_step_at || null,
    tagReleasedAt: dbPiece.tag_released_at || null,
  };
}

const DEFAULT_FILTERS: ProcessingModalFiltersState = {
  search: '',
  category: 'all',
  step: 'all',
  status: 'all',
  showRejectedOnTop: false,
};

/**
 * Full Processing Editor modal for `/dashboard/processing`.
 * @param props Modal visibility, order identity, and refresh callbacks.
 */
export function ProcessingModal(props: ProcessingModalProps) {
  const { isOpen, orderId, tenantId, onClose, onRefresh } = props;
  const t = useTranslations('processing.modal');
  const tProcessing = useTranslations('processing');
  const tTable = useTranslations('processing.table');
  const tStatus = useTranslations('processing.status');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { token: csrfToken } = useCSRFToken();

  const {
    splitOrderEnabled: splitOrderSettingEnabled,
    rejectEnabled,
    trackByPiece,
    rejectColor,
    processingConfirmationEnabled,
    isLoading: settingsLoading,
  } = useTenantSettingsWithDefaults(tenantId, null, null, isOpen);

  const canSplitOrders = useHasPermissionCode('orders:split');
  const splitOrderEnabled = splitOrderSettingEnabled && canSplitOrders;

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

  const [expandedItemIds, setExpandedItemIds] = React.useState<Set<string>>(new Set());
  const [pieceStates, setPieceStates] = React.useState<Map<string, ItemPiece>>(new Map());
  const [originalPieceStates, setOriginalPieceStates] = React.useState<Map<string, ItemPiece>>(
    new Map()
  );
  const [selectedForSplit, setSelectedForSplit] = React.useState<Set<string>>(new Set());
  const [rackLocation, setRackLocation] = React.useState('');
  const [batchNote, setBatchNote] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'pieces' | 'transactions'>('pieces');
  const [trxRefreshKey, setTrxRefreshKey] = React.useState(0);
  const [summaryMessage, setSummaryMessage] = React.useState<SummaryMessageType | null>(null);
  const [showSplitDialog, setShowSplitDialog] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const [filters, setFilters] = React.useState<ProcessingModalFiltersState>(DEFAULT_FILTERS);

  const initializedOrderIdRef = React.useRef<string | null>(null);
  const rackInitializedOrderIdRef = React.useRef<string | null>(null);
  const originalPieceStatesRef = React.useRef<Map<string, ItemPiece>>(new Map());
  originalPieceStatesRef.current = originalPieceStates;

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
    enabled: isOpen && Boolean(orderId),
    retry: 1,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });

  const order: Order | null = (orderData?.order as unknown as Order | null) ?? null;
  const isCommercialLocked = Boolean(orderData?.isCommercialLocked);
  const items = React.useMemo(
    () => (orderData?.items as unknown as OrderItem[]) ?? [],
    [orderData?.items]
  );
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
    return Array.from(codes);
  }, [order, items]);

  const processingStepsQueries = useQueries({
    queries: categoryCodesToFetch.map((serviceCategoryCode) => ({
      queryKey: ['processing-steps', tenantId, serviceCategoryCode],
      queryFn: async (): Promise<{ success: boolean; data?: ProcessingStepConfig[] }> => {
        const response = await fetch(
          `/api/v1/processing-steps/${encodeURIComponent(serviceCategoryCode)}`
        );
        if (!response.ok) return { success: false };
        return response.json();
      },
      enabled: isOpen && Boolean(tenantId) && Boolean(serviceCategoryCode),
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

  const categoryFilterOptions: ProcessingFilterOption[] = React.useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      const code = item.service_category_code;
      if (!code || map.has(code)) return;
      const label =
        getBilingual(item.service_category_name, item.service_category_name2) || code;
      map.set(code, label);
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [getBilingual, items]);

  const dynamicStepFilterOptions: ProcessingFilterOption[] = React.useMemo(() => {
    const map = new Map<string, { label: string; seq: number }>();
    processingStepsByCategory.forEach((steps) => {
      steps
        .filter((s) => s.is_active)
        .forEach((s) => {
          if (!map.has(s.step_code)) {
            map.set(s.step_code, {
              label: getBilingual(s.step_name, s.step_name2) || s.step_name,
              seq: s.step_seq,
            });
          }
        });
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].seq - b[1].seq)
      .map(([code, meta]) => ({ code, label: meta.label }));
  }, [getBilingual, processingStepsByCategory]);

  const { data: piecesData, isLoading: piecesLoading } = useQuery({
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
    enabled: isOpen && Boolean(orderId) && trackByPiece,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });

  const { data: issueSummary } = useQuery({
    queryKey: ['order-issue-summary', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/issue-summary`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as { error?: string }).error || 'Failed to load issue summary');
      }
      return (
        (
          json as {
            data?: {
              byItem?: Record<string, { open: number; total: number }>;
              byPiece?: Record<string, { open: number; total: number }>;
            };
          }
        ).data ?? { byItem: {}, byPiece: {} }
      );
    },
    enabled: isOpen && Boolean(orderId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const issueByItem = React.useMemo(() => issueSummary?.byItem ?? {}, [issueSummary?.byItem]);
  const issueByPiece = React.useMemo(() => issueSummary?.byPiece ?? {}, [issueSummary?.byPiece]);

  const dbPiecesByItemId = React.useMemo(() => {
    const grouped = new Map<string, ItemPiece[]>();
    if (!piecesData?.pieces || !Array.isArray(piecesData.pieces)) {
      return grouped;
    }
    piecesData.pieces.forEach((dbPiece: OrderItemPiece) => {
      const itemId = dbPiece.order_item_id;
      const itemPiece = mapDbPieceToItemPiece(dbPiece, itemId);
      const list = grouped.get(itemId) ?? [];
      list.push(itemPiece);
      grouped.set(itemId, list);
    });
    grouped.forEach((list) => list.sort((a, b) => a.pieceNumber - b.pieceNumber));
    return grouped;
  }, [piecesData]);

  const piecesByItemId = React.useMemo(() => groupPiecesByItemId(pieceStates), [pieceStates]);

  React.useEffect(() => {
    if (!isOpen || !orderId || items.length === 0) return;

    if (initializedOrderIdRef.current !== orderId) {
      if (trackByPiece && piecesLoading) return;

      const initialStates = new Map<string, ItemPiece>();
      if (trackByPiece && dbPiecesByItemId.size > 0) {
        dbPiecesByItemId.forEach((pieces) => {
          pieces.forEach((piece) => initialStates.set(piece.id, piece));
        });
      } else {
        items.forEach((item) => {
          generatePieces(item).forEach((piece) => initialStates.set(piece.id, piece));
        });
      }

      setPieceStates(initialStates);
      setOriginalPieceStates(new Map(initialStates));
      initializedOrderIdRef.current = orderId;

      if (items.length <= 2) {
        setExpandedItemIds(new Set(items.map((it) => it.id)));
      }
      return;
    }

    // Re-sync server refetches (after batch save, split, tag link, or pref confirm) without
    // overwriting unsaved operator edits on pieces that are still dirty.
    if (trackByPiece && !piecesLoading && dbPiecesByItemId.size > 0) {
      const serverMap = new Map<string, ItemPiece>();
      dbPiecesByItemId.forEach((pieces) => {
        pieces.forEach((piece) => serverMap.set(piece.id, piece));
      });
      const prevOriginals = originalPieceStatesRef.current;

      setPieceStates((prev) => {
        const next = new Map<string, ItemPiece>();
        serverMap.forEach((serverPiece, id) => {
          const localPiece = prev.get(id);
          const prevOriginal = prevOriginals.get(id);
          if (!localPiece || !hasProcessingPieceChanged(localPiece, prevOriginal)) {
            next.set(id, serverPiece);
          } else {
            next.set(id, {
              ...localPiece,
              notes_followup: serverPiece.notes_followup,
              servicePrefs: serverPiece.servicePrefs,
              colorPrefs: serverPiece.colorPrefs,
              piece_code: serverPiece.piece_code,
              tagReleasedAt: serverPiece.tagReleasedAt,
            });
          }
        });
        return next;
      });
      setOriginalPieceStates(new Map(serverMap));
    }
  }, [isOpen, orderId, items, trackByPiece, dbPiecesByItemId, piecesLoading]);

  React.useEffect(() => {
    if (!isOpen || !orderId || !order) return;
    if (rackInitializedOrderIdRef.current !== orderId) {
      setRackLocation(order.rack_location ?? '');
      rackInitializedOrderIdRef.current = orderId;
    }
  }, [isOpen, orderId, order]);

  const resetModalState = React.useCallback(() => {
    setExpandedItemIds(new Set());
    setPieceStates(new Map());
    setOriginalPieceStates(new Map());
    setSelectedForSplit(new Set());
    setRackLocation('');
    setBatchNote('');
    setActiveTab('pieces');
    setTrxRefreshKey(0);
    setSummaryMessage(null);
    setShowSplitDialog(false);
    setShowDiscardConfirm(false);
    setFilters(DEFAULT_FILTERS);
    initializedOrderIdRef.current = null;
    rackInitializedOrderIdRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      resetModalState();
    }
  }, [isOpen, resetModalState]);

  const prevOrderIdRef = React.useRef<string | null>(orderId);
  React.useEffect(() => {
    if (prevOrderIdRef.current !== orderId) {
      prevOrderIdRef.current = orderId;
      if (isOpen) {
        resetModalState();
      }
    }
  }, [orderId, isOpen, resetModalState]);

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
        const tagMessage = pieceTagErrorMessage(errorData, (key, values) => String(t(key, values)));
        throw new Error(tagMessage || errorData.error || errorData.message || 'Failed to update order');
      }
      return response.json();
    },
    onSuccess: (data: { summary?: { trxCode?: string } }, variables) => {
      const trxCode = data?.summary?.trxCode;
      const actualPiecesUpdated = variables.updates.length;
      const actualReadyCount = variables.updates.filter((u) => u.is_ready === true).length;
      const actualStepsRecorded = new Set(
        variables.updates.filter((u) => u.currentStep).map((u) => u.currentStep)
      ).size;
      const actualRackLocationsSet = variables.updates.filter(
        (u) => u.rackLocation && u.rackLocation.trim() !== ''
      ).length;

      const summaryItems: string[] = [];
      if (trxCode) {
        summaryItems.push(String(t('summary.trxCode', { trxCode })));
      }
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

      setSummaryMessage({
        type: 'success',
        title: String(t('summary.updateSuccess')),
        items: summaryItems,
      });
      cmxMessage.success(
        trxCode
          ? String(t('summary.updateSuccessWithTrx', { trxCode }))
          : String(t('summary.updateSuccess'))
      );

      setPieceStates((prev) => {
        const clearedMap = new Map<string, ItemPiece>();
        prev.forEach((piece, key) => {
          clearedMap.set(key, { ...piece, processingNote: '' });
        });
        setOriginalPieceStates(new Map(clearedMap));
        return clearedMap;
      });
      setBatchNote('');
      setTrxRefreshKey((k) => k + 1);
      onRefresh?.();

      if (isOpen && orderId) {
        queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
        queryClient.invalidateQueries({ queryKey: ['processing-transactions', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order-processing-detail', orderId] });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setSummaryMessage({
        type: 'error',
        title: String(t('error.updateFailed')),
        items: [msg],
      });
      cmxMessage.error(String(t('error.updateFailed')), { description: msg });
    },
  });

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
      cmxMessage.success(String(t('summary.splitSuccess')));
      setSelectedForSplit(new Set());
      setShowSplitDialog(false);
      setTrxRefreshKey((k) => k + 1);
      onRefresh?.();

      if (isOpen && orderId) {
        queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
        queryClient.invalidateQueries({ queryKey: ['processing-transactions', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order-processing-detail', orderId] });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setSummaryMessage({
        type: 'error',
        title: String(t('splitFailed')),
        items: [msg],
      });
      cmxMessage.error(String(t('splitFailed')), { description: msg });
    },
  });

  const dirtyPiecesCount = React.useMemo(() => {
    let count = 0;
    pieceStates.forEach((piece) => {
      if (hasProcessingPieceChanged(piece, originalPieceStates.get(piece.id))) {
        count++;
      }
    });
    return count;
  }, [pieceStates, originalPieceStates]);

  const rackDirty = rackLocation !== (order?.rack_location ?? '');
  const batchNoteDirty = batchNote.trim().length > 0;
  const totalDirtyCount = dirtyPiecesCount + (rackDirty ? 1 : 0) + (batchNoteDirty ? 1 : 0);
  const hasChanges = totalDirtyCount > 0;

  const handleUpdate = React.useCallback(() => {
    const updates = Array.from(pieceStates.values())
      .filter((piece) => hasProcessingPieceChanged(piece, originalPieceStates.get(piece.id)))
      .map((piece) => ({
        pieceId: piece.id,
        itemId: piece.itemId,
        pieceNumber: piece.pieceNumber,
        is_ready: piece.is_ready ?? null,
        currentStep: piece.currentStep,
        piece_stage: piece.piece_stage || null,
        ...(isCommercialLocked
          ? {}
          : {
            notes: piece.notes || '',
            has_stain: piece.has_stain || null,
            has_damage: piece.has_damage || null,
          }),
        ...(piece.processingNote?.trim()
          ? { processingNote: piece.processingNote.trim() }
          : {}),
        rackLocation: piece.rackLocation || '',
        isRejected: piece.isRejected || false,
        barcode: piece.barcode || null,
      }));

    // Compute ready count across ALL pieces of each item (never only edited updates)
    const itemQuantityReady: Record<string, number> = {};
    items.forEach((item) => {
      const allForItem = piecesByItemId.get(item.id) ?? [];
      itemQuantityReady[item.id] = allForItem.filter((p) => p.is_ready === true).length;
    });

    logger.info('[ProcessingModal] Saving updates:', {
      feature: 'ordersPieces',
      action: 'Update_ordersPieces',
      orderRackLocation: rackLocation,
      itemQuantityReady,
      count: updates.length,
    });

    updateMutation.mutate({
      updates,
      itemQuantityReady,
      orderRackLocation: rackLocation,
      sourceScreen: PRC_TRX_SOURCE_SCREENS.PROCESSING_MODAL,
      ...(batchNote.trim() ? { processingNote: batchNote.trim() } : {}),
    });
  }, [
    pieceStates,
    originalPieceStates,
    items,
    piecesByItemId,
    rackLocation,
    batchNote,
    isCommercialLocked,
    updateMutation,
  ]);

  const handlePieceNotesUpdated = React.useCallback(
    (pieceId: string, updatedNotes: PrefsFollowupNote[]) => {
      setPieceStates((prev) => {
        const next = new Map(prev);
        const cur = next.get(pieceId);
        if (cur) next.set(pieceId, { ...cur, notes_followup: updatedNotes });
        return next;
      });
      setOriginalPieceStates((prev) => {
        const next = new Map(prev);
        const cur = next.get(pieceId);
        if (cur) next.set(pieceId, { ...cur, notes_followup: updatedNotes });
        return next;
      });
      setTrxRefreshKey((k) => k + 1);
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ['processing-transactions', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order-processing-detail', orderId] });
      }
    },
    [orderId, queryClient]
  );

  const handleTagSaved = React.useCallback(
    (pieceId: string, saved: PieceTagSaved) => {
      const nextTag = saved.externalTag ?? null;
      setPieceStates((prev) => {
        const next = new Map(prev);
        const cur = next.get(pieceId);
        if (cur) next.set(pieceId, { ...cur, barcode: nextTag });
        return next;
      });
      setOriginalPieceStates((prev) => {
        const next = new Map(prev);
        const cur = next.get(pieceId);
        if (cur) next.set(pieceId, { ...cur, barcode: nextTag });
        return next;
      });
      setTrxRefreshKey((k) => k + 1);
      cmxMessage.success(
        saved.trxCode
          ? String(t('tagLinkedWithTrx', { trxCode: saved.trxCode }))
          : String(t('tagLinked'))
      );
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
        queryClient.invalidateQueries({ queryKey: ['processing-transactions', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order-processing-detail', orderId] });
      }
      onRefresh?.();
    },
    [orderId, onRefresh, queryClient, t]
  );

  const handleSplitConfirm = React.useCallback(
    (reason: string) => {
      const pieceIds = Array.from(selectedForSplit, (selectedId) => {
        const piece = pieceStates.get(selectedId);
        return piece ? toSplitPieceId(piece) : selectedId;
      });
      splitMutation.mutate({ pieceIds, reason });
    },
    [pieceStates, selectedForSplit, splitMutation]
  );

  const handlePieceChange = React.useCallback(
    (pieceId: string, updates: Partial<ItemPiece>) => {
      setPieceStates((prev) => {
        const next = new Map(prev);
        const piece = next.get(pieceId);
        if (piece) {
          next.set(pieceId, { ...piece, ...updates });
        }
        return next;
      });
    },
    []
  );

  const handleBulkItemReadyChange = React.useCallback(
    (itemId: string, ready: boolean) => {
      setPieceStates((prev) => {
        const next = new Map(prev);
        next.forEach((piece, key) => {
          if (piece.itemId === itemId) {
            next.set(key, { ...piece, is_ready: ready, isReady: ready });
          }
        });
        return next;
      });
    },
    []
  );

  const handleBulkOrderReady = React.useCallback((ready: boolean) => {
    setPieceStates((prev) => {
      const next = new Map(prev);
      next.forEach((piece, key) => {
        next.set(key, { ...piece, is_ready: ready, isReady: ready });
      });
      return next;
    });
  }, []);

  const handleApplyOrderRackToPieces = React.useCallback(() => {
    const rack = rackLocation.trim();
    if (!rack) return;
    setPieceStates((prev) => {
      const next = new Map(prev);
      next.forEach((piece, key) => {
        next.set(key, { ...piece, rackLocation: rack });
      });
      return next;
    });
  }, [rackLocation]);

  const handleSplitToggle = React.useCallback((pieceId: string, selected: boolean) => {
    setSelectedForSplit((prev) => {
      const next = new Set(prev);
      if (selected) next.add(pieceId);
      else next.delete(pieceId);
      return next;
    });
  }, []);

  const handleToggleExpand = React.useCallback((itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const onConfirmSuccess = React.useCallback(() => {
    if (orderId) {
      queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-issue-summary', orderId] });
    }
  }, [orderId, queryClient]);

  const getPiecesForItem = React.useCallback(
    (itemId: string): ItemPiece[] => {
      const fromState = piecesByItemId.get(itemId);
      if (fromState && fromState.length > 0) return fromState;
      if (trackByPiece && dbPiecesByItemId.has(itemId)) {
        return dbPiecesByItemId.get(itemId) || [];
      }
      return [];
    },
    [trackByPiece, piecesByItemId, dbPiecesByItemId]
  );

  const filteredAndSortedItems = React.useMemo(() => {
    let filtered = [...items];

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter((item) => {
        const productName = (
          item.org_product_data_mst?.product_name ||
          item.product_name ||
          ''
        ).toLowerCase();
        const productName2 = (
          item.org_product_data_mst?.product_name2 ||
          item.product_name2 ||
          ''
        ).toLowerCase();
        const catCode = (item.service_category_code || '').toLowerCase();
        const catName = (item.service_category_name || '').toLowerCase();
        const catName2 = (item.service_category_name2 || '').toLowerCase();
        if (
          productName.includes(q) ||
          productName2.includes(q) ||
          catCode.includes(q) ||
          catName.includes(q) ||
          catName2.includes(q)
        ) {
          return true;
        }
        return getPiecesForItem(item.id).some(
          (piece) =>
            (piece.piece_code || '').toLowerCase().includes(q) ||
            (piece.barcode || '').toLowerCase().includes(q) ||
            (piece.rackLocation || '').toLowerCase().includes(q) ||
            (piece.notes || '').toLowerCase().includes(q) ||
            (piece.processingNote || '').toLowerCase().includes(q) ||
            (piece.notes_followup ?? []).some((n) =>
              n.note_text.toLowerCase().includes(q)
            )
        );
      });
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(
        (item) => (item.service_category_code || '') === filters.category
      );
    }

    if (filters.step !== 'all') {
      filtered = filtered.filter((item) => {
        const itemPieces = getPiecesForItem(item.id);
        return (
          item.item_last_step === filters.step ||
          itemPieces.some((piece) => piece.currentStep === filters.step)
        );
      });
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter((item) => {
        const itemPieces = getPiecesForItem(item.id);
        switch (filters.status) {
          case 'ready':
            return itemPieces.some((piece) => piece.is_ready === true);
          case 'not_ready':
            return itemPieces.some((piece) => piece.is_ready !== true);
          case 'has_issues':
            return (
              Boolean(item.item_issue_id) ||
              (issueByItem[item.id]?.open ?? 0) > 0 ||
              itemPieces.some(
                (p) => Boolean(p.issue_id) || (issueByPiece[p.id]?.open ?? 0) > 0
              )
            );
          case 'has_condition':
            return (
              Boolean(item.has_stain) ||
              Boolean(item.has_damage) ||
              itemPieces.some((p) => Boolean(p.has_stain) || Boolean(p.has_damage))
            );
          case 'rejected':
            return Boolean(item.item_is_rejected) || itemPieces.some((p) => p.isRejected);
          default:
            return true;
        }
      });
    }

    if (filters.showRejectedOnTop) {
      filtered.sort((a, b) => {
        const aRejected = a.item_is_rejected || false;
        const bRejected = b.item_is_rejected || false;
        if (aRejected && !bRejected) return -1;
        if (!aRejected && bRejected) return 1;
        return 0;
      });
    }

    return filtered;
  }, [filters, getPiecesForItem, issueByItem, issueByPiece, items]);

  const allFilteredExpanded =
    filteredAndSortedItems.length > 0 &&
    filteredAndSortedItems.every((it) => expandedItemIds.has(it.id));

  const handleToggleExpandAll = React.useCallback(() => {
    if (allFilteredExpanded) {
      setExpandedItemIds(new Set());
    } else {
      setExpandedItemIds(new Set(filteredAndSortedItems.map((it) => it.id)));
    }
  }, [allFilteredExpanded, filteredAndSortedItems]);

  const requestClose = React.useCallback(() => {
    if (updateMutation.isPending || splitMutation.isPending) return;
    if (hasChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [hasChanges, onClose, splitMutation.isPending, updateMutation.isPending]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !updateMutation.isPending && Boolean(csrfToken)) {
          handleUpdate();
        }
      }
      if (e.key === 'Escape' && !showDiscardConfirm && !showSplitDialog) {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    hasChanges,
    updateMutation.isPending,
    csrfToken,
    handleUpdate,
    requestClose,
    showDiscardConfirm,
    showSplitDialog,
  ]);

  const isLoading = orderLoading || settingsLoading;
  const isPiecesLoading = piecesLoading && trackByPiece;

  const allPieceList = React.useMemo(() => Array.from(pieceStates.values()), [pieceStates]);
  const totalPiecesCount =
    allPieceList.length || items.reduce((sum, item) => sum + item.quantity, 0);
  const readyPiecesCount = allPieceList.filter((p) => p.is_ready === true).length;
  const allOrderPiecesReady =
    allPieceList.length > 0 && allPieceList.every((p) => p.is_ready === true);
  const overallProgress =
    totalPiecesCount > 0 ? (readyPiecesCount / totalPiecesCount) * 100 : 0;

  const displayCustomerName = customerData
    ? getBilingual(
      customerData.name as string | undefined,
      customerData.name2 as string | undefined
    ) ||
    String(customerData.display_name || customerData.phone || tProcessing('unknownCustomer'))
    : tProcessing('unknownCustomer');

  const rawStatus = (order?.current_status || order?.status || 'processing').toLowerCase();
  const localizedOrderStatus = KNOWN_ORDER_STATUS_KEYS.has(rawStatus)
    ? tStatus(rawStatus)
    : rawStatus.replace(/[_-]+/g, ' ');

  const priorityLower = (order?.priority || '').toLowerCase();
  const priorityBadge: { label: string; tone: CmxBadgeTone } | null =
    priorityLower === PRIORITY_LEVELS.URGENT
      ? { label: tTable('priorityUrgent'), tone: 'danger' }
      : priorityLower === PRIORITY_LEVELS.EXPRESS
        ? { label: tTable('priorityExpress'), tone: 'brand' }
        : null;

  return (
    <>
      <CmxDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <CmxDialogContent
          className="mx-4 flex h-[90vh] w-full max-w-5xl flex-col"
          aria-labelledby="processing-modal-title"
          aria-describedby="processing-modal-description"
        >
          <CmxDialogHeader className="flex-shrink-0 border-b border-border pb-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CmxDialogTitle
                      id="processing-modal-title"
                      className="text-lg font-bold text-foreground sm:text-xl"
                    >
                      {t('title')}
                    </CmxDialogTitle>
                    {order?.order_no && (
                      <CmxCodeChip code={order.order_no} kind="order" size="md" />
                    )}
                    {order && (
                      <CmxStatusBadge label={localizedOrderStatus} tone="info" size="sm" />
                    )}
                    {priorityBadge && (
                      <CmxStatusBadge
                        label={priorityBadge.label}
                        tone={priorityBadge.tone}
                        size="sm"
                      />
                    )}
                    {orderId && (
                      <OrderIssueRowActions
                        orderId={orderId}
                        scopeLevel={ORDER_ISSUE_SCOPE.ORDER}
                        hasOpenIssue={Boolean(order?.has_issue)}
                        onChanged={onConfirmSuccess}
                      />
                    )}
                  </div>
                  <p id="processing-modal-description" className="sr-only">
                    {t('modalDescription')}
                  </p>
                  {order && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" aria-hidden />
                        <span>{displayCustomerName}</span>
                      </div>
                      {customerData?.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          <bdi dir="ltr" className="tabular-nums">
                            {String(customerData.phone)}
                          </bdi>
                        </div>
                      ) : null}
                      {order.ready_by_at && (
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <Calendar className="h-3.5 w-3.5" aria-hidden />
                          <span>
                            {formatDateTime(
                              order.ready_by_at,
                              locale === 'ar' ? 'ar' : 'en'
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {trackByPiece && allPieceList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pe-6">
                    <CmxButton
                      type="button"
                      size="xs"
                      variant={allOrderPiecesReady ? 'outline' : 'secondary'}
                      onClick={() => handleBulkOrderReady(!allOrderPiecesReady)}
                    >
                      <CheckCheck className="me-1 h-3.5 w-3.5" aria-hidden />
                      {allOrderPiecesReady ? t('unmarkAllReady') : t('markAllReady')}
                    </CmxButton>
                  </div>
                )}
              </div>

              {order && items.length > 0 && (
                <CmxProgressIndicator
                  value={overallProgress}
                  size="sm"
                  variant={overallProgress === 100 ? 'success' : 'default'}
                  showPercentage
                  label={t('overallProgress', {
                    ready: readyPiecesCount,
                    total: totalPiecesCount,
                  })}
                />
              )}
            </div>
          </CmxDialogHeader>

          {isLoading && (
            <div className="flex-1 space-y-3 py-4">
              <CmxSkeleton className="h-14 w-full" />
              <CmxSkeleton className="h-32 w-full" />
              <CmxSkeleton className="h-32 w-full" />
            </div>
          )}

          {!isLoading && orderError && (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-md space-y-4 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-danger-text" aria-hidden />
                <div>
                  <h3 className="mb-1 text-lg font-semibold text-danger-text">
                    {t('error.loadingFailed')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {orderError instanceof Error ? orderError.message : t('error.loadingFailed')}
                  </p>
                  {orderId && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('orderIdLabel', { id: orderId })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <CmxButton variant="secondary" onClick={onClose}>
                    {t('close')}
                  </CmxButton>
                  <CmxButton
                    variant="primary"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
                    }}
                  >
                    <RefreshCw className="me-2 h-4 w-4" aria-hidden />
                    {t('retry')}
                  </CmxButton>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !orderError && order && (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2.5 pt-1">
                <CmxButton
                  type="button"
                  size="sm"
                  variant={activeTab === 'pieces' ? 'primary' : 'outline'}
                  onClick={() => setActiveTab('pieces')}
                >
                  {t('tabs.itemsAndPieces')}
                </CmxButton>
                <CmxButton
                  type="button"
                  size="sm"
                  variant={activeTab === 'transactions' ? 'primary' : 'outline'}
                  onClick={() => setActiveTab('transactions')}
                  className="gap-1.5"
                >
                  <History className="h-3.5 w-3.5" aria-hidden />
                  {t('tabs.transactions')}
                </CmxButton>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto py-3">
                {activeTab === 'transactions' ? (
                  <ProcessingTransactionsPanel
                    orderId={order.id}
                    refreshKey={trxRefreshKey}
                  />
                ) : (
                  <>
                    <CmxFollowupNotesFeed
                      orderId={order.id}
                      targetLevel={NOTES_FOLLOWUP_TARGET_LEVELS.ORDER}
                      targetId={order.id}
                      notes={order.notes_followup}
                      intakeNote={
                        [order.customer_notes, order.internal_notes]
                          .filter((s): s is string => Boolean(s && s.trim()))
                          .join(' — ') || undefined
                      }
                      intakeNoteLocked={isCommercialLocked}
                      noteSource={PREFS_SOURCE_STAGE.ORDER_PROCESSING}
                      sourceScreen={PRC_TRX_SOURCE_SCREENS.PROCESSING_MODAL}
                      onNotesUpdated={() => {
                        setTrxRefreshKey((k) => k + 1);
                        if (orderId) {
                          queryClient.invalidateQueries({
                            queryKey: ['order-processing', orderId],
                          });
                          queryClient.invalidateQueries({
                            queryKey: ['processing-transactions', orderId],
                          });
                          queryClient.invalidateQueries({
                            queryKey: ['order-processing-detail', orderId],
                          });
                        }
                      }}
                      title={tProcessing('notes.orderFeedTitle')}
                      compact
                      defaultOpen={false}
                    />

                    <ProcessingModalFilters
                      filters={filters}
                      onFiltersChange={setFilters}
                      categories={categoryFilterOptions}
                      stepOptions={dynamicStepFilterOptions}
                      rejectEnabled={rejectEnabled}
                      allExpanded={allFilteredExpanded}
                      onToggleExpandAll={handleToggleExpandAll}
                      showExpandAll={trackByPiece && filteredAndSortedItems.length > 0}
                    />

                    <div className="space-y-2.5">
                      {filteredAndSortedItems.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                          <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" aria-hidden />
                          <h3 className="mb-1 text-base font-semibold text-foreground">{t('noItems')}</h3>
                          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                            {t('noItemsDesc')}
                          </p>
                        </div>
                      ) : (
                        <>
                          {filteredAndSortedItems.map((item) => (
                            <ProcessingItemRow
                              key={item.id}
                              item={item}
                              pieces={getPiecesForItem(item.id)}
                              isExpanded={expandedItemIds.has(item.id)}
                              onToggleExpand={handleToggleExpand}
                              onPieceChange={handlePieceChange}
                              onBulkReadyChange={handleBulkItemReadyChange}
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
                              issueOpenCount={issueByItem[item.id]?.open}
                              issueTotalCount={issueByItem[item.id]?.total}
                              issueByPiece={issueByPiece}
                              isCommercialLocked={isCommercialLocked}
                              onItemNotesUpdated={() => {
                                setTrxRefreshKey((k) => k + 1);
                                if (orderId) {
                                  queryClient.invalidateQueries({
                                    queryKey: ['order-processing', orderId],
                                  });
                                  queryClient.invalidateQueries({
                                    queryKey: ['processing-transactions', orderId],
                                  });
                                  queryClient.invalidateQueries({
                                    queryKey: ['order-processing-detail', orderId],
                                  });
                                }
                              }}
                              onPieceNotesUpdated={handlePieceNotesUpdated}
                              onTagSaved={handleTagSaved}
                            />
                          ))}
                          {isPiecesLoading && trackByPiece && (
                            <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                              <span>{t('loadingPieces')}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {summaryMessage && (
                <div className="flex-shrink-0">
                  <CmxSummaryMessage
                    {...summaryMessage}
                    onDismiss={() => setSummaryMessage(null)}
                  />
                </div>
              )}

              <CmxDialogFooter className="flex-shrink-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-wrap items-end gap-2">
                  <div className="min-w-[160px] flex-1 space-y-1">
                    <Label htmlFor="rack-location" className="block text-xs font-medium text-foreground">
                      {t('rackLocationOrder')}
                    </Label>
                    <CmxInput
                      id="rack-location"
                      value={rackLocation}
                      onChange={(e) => setRackLocation(e.target.value)}
                      placeholder={t('rackLocationPlaceholder')}
                      leftIcon={<MapPin className="h-4 w-4" aria-hidden />}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label htmlFor="batch-note" className="block text-xs font-medium text-foreground">
                      {t('batchNoteLabel')}
                    </Label>
                    <CmxInput
                      id="batch-note"
                      value={batchNote}
                      onChange={(e) => setBatchNote(e.target.value)}
                      placeholder={t('batchNotePlaceholder')}
                      className="h-9 text-sm"
                    />
                  </div>
                  {trackByPiece && rackLocation.trim() && (
                    <CmxButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyOrderRackToPieces}
                      className="h-9 shrink-0"
                    >
                      {t('applyOrderRack')}
                    </CmxButton>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {hasChanges && (
                    <CmxStatusBadge
                      label={t('unsavedChanges', { count: totalDirtyCount })}
                      tone="warning"
                      size="sm"
                    />
                  )}

                  <CmxButton
                    type="button"
                    onClick={handleUpdate}
                    disabled={!hasChanges || updateMutation.isPending || !csrfToken}
                    loading={updateMutation.isPending}
                    aria-label={t('updateShortcutAria')}
                    title={t('updateShortcutAria')}
                  >
                    {t('update')}
                    <span className="ms-1.5 hidden text-xs opacity-75 sm:inline">
                      ({t('saveKeyHint')})
                    </span>
                  </CmxButton>

                  {splitOrderEnabled && selectedForSplit.size > 0 && (
                    <CmxButton
                      type="button"
                      variant="destructive"
                      onClick={() => setShowSplitDialog(true)}
                      disabled={splitMutation.isPending}
                    >
                      {t('splitOrder')} ({selectedForSplit.size})
                    </CmxButton>
                  )}

                  <CmxButton type="button" variant="outline" onClick={requestClose}>
                    {t('close')}
                  </CmxButton>
                </div>
              </CmxDialogFooter>
            </>
          )}
        </CmxDialogContent>
      </CmxDialog>

      {splitOrderEnabled && (
        <SplitConfirmationDialog
          isOpen={showSplitDialog}
          pieceCount={selectedForSplit.size}
          onConfirm={handleSplitConfirm}
          onCancel={() => setShowSplitDialog(false)}
          isLoading={splitMutation.isPending}
        />
      )}

      <CmxConfirmDialog
        open={showDiscardConfirm}
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discardConfirm')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </>
  );
}
