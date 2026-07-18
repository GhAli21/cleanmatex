/**
 * Simple Processing dialog — lightweight piece Ready / Notes / Split surface
 * opened from the Processing list (separate from full ProcessingModal).
 */

'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton, CmxCheckbox, CmxInput, Tooltip } from '@ui/primitives';
import { CmxStatusBadge, CmxConfirmDialog, cmxMessage } from '@ui/feedback';
import {
  CmxEmptyState,
  CmxInlineEditTable,
  type CmxInlineEditTableColumn,
} from '@ui/data-display';
import { X } from 'lucide-react';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { isOrderPaidStatus } from '@/lib/utils/order-payment-status';
import type { BatchUpdateRequest, ItemPiece, OrderItemPiece } from '@/types/order';
import {
  hasSimplePieceChanged,
  isPieceUuid,
  mapDbPieceToItemPiece,
  normalizeOrderStateResponse,
} from '@features/workflow/lib/processing-piece-map';
import { SimpleProcessingIssueDialog } from './simple-processing-issue-dialog';
import { SplitConfirmationDialog } from './split-confirmation-dialog';

export interface SimpleProcessingDialogProps {
  isOpen: boolean;
  orderId: string | null;
  tenantId: string;
  onClose: () => void;
  onRefresh?: () => void;
  /** Optional: open full ProcessingModal for empty-pieces CTA */
  onOpenFullEditor?: (orderId: string) => void;
}

/**
 * Format a relative time string for the Created metadata cell.
 */
function formatRelativeTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale.startsWith('ar') ? 'ar' : 'en', {
    numeric: 'auto',
  });
  if (absSec < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) return rtf.format(diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(diffDay, 'day');
}

/**
 * Simple Processing dialog shell + piece table + Update / Split / Issue.
 */
export function SimpleProcessingDialog({
  isOpen,
  orderId,
  tenantId,
  onClose,
  onRefresh,
  onOpenFullEditor,
}: SimpleProcessingDialogProps) {
  const t = useTranslations('processing.simpleModal');
  const tModal = useTranslations('processing.modal');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { token: csrfToken } = useCSRFToken();
  const { formatMoneyWithCode } = useTenantCurrency();
  const { splitOrderEnabled, trackByPiece, isLoading: settingsLoading } =
    useTenantSettingsWithDefaults(tenantId);

  const [pieceStates, setPieceStates] = React.useState<Map<string, ItemPiece>>(
    new Map()
  );
  const [originalPieceStates, setOriginalPieceStates] = React.useState<
    Map<string, ItemPiece>
  >(new Map());
  const [selectedForSplit, setSelectedForSplit] = React.useState<Set<string>>(
    new Set()
  );
  const [showSplitDialog, setShowSplitDialog] = React.useState(false);
  const [showIssueDialog, setShowIssueDialog] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const initializedOrderIdRef = React.useRef<string | null>(null);

  const { data: orderData, isLoading: orderLoading, error: orderError } = useQuery({
    queryKey: ['order-processing', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/state`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `HTTP ${response.status}`
        );
      }
      return normalizeOrderStateResponse(await response.json());
    },
    enabled: isOpen && !!orderId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const order = orderData?.order ?? null;
  const items = orderData?.items ?? [];

  const { data: piecesData, isLoading: piecesLoading } = useQuery({
    queryKey: ['order-pieces', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/pieces`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `HTTP ${response.status}`
        );
      }
      return response.json() as Promise<{ pieces?: OrderItemPiece[] }>;
    },
    enabled: isOpen && !!orderId && trackByPiece,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Initialize piece local state from DB pieces once per open/order (or after split invalidate)
  React.useEffect(() => {
    if (!isOpen || !orderId) return;
    if (settingsLoading) return;
    if (trackByPiece && piecesLoading) return;
    if (initializedOrderIdRef.current === orderId) return;

    const next = new Map<string, ItemPiece>();
    const dbPieces = piecesData?.pieces;
    if (Array.isArray(dbPieces)) {
      dbPieces.forEach((dbPiece) => {
        const itemId = dbPiece.order_item_id;
        const mapped = mapDbPieceToItemPiece(dbPiece, itemId);
        if (isPieceUuid(mapped.id)) {
          next.set(mapped.id, mapped);
        }
      });
    }

    setPieceStates(next);
    setOriginalPieceStates(new Map(next));
    setSelectedForSplit(new Set());
    initializedOrderIdRef.current = orderId;
  }, [
    isOpen,
    orderId,
    trackByPiece,
    piecesLoading,
    settingsLoading,
    piecesData,
  ]);

  React.useEffect(() => {
    if (!isOpen) {
      setPieceStates(new Map());
      setOriginalPieceStates(new Map());
      setSelectedForSplit(new Set());
      setShowSplitDialog(false);
      setShowIssueDialog(false);
      setShowDiscardConfirm(false);
      initializedOrderIdRef.current = null;
    }
  }, [isOpen]);

  const itemLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      const id = String(item.id ?? '');
      if (!id) return;
      const product = item.org_product_data_mst as
        | { product_name?: string; product_name2?: string }
        | undefined;
      const name =
        product?.product_name ||
        (item.product_name as string | undefined) ||
        (item.description as string | undefined) ||
        t('unnamedItem');
      map.set(id, name);
    });
    return map;
  }, [items, t]);

  const pieceRows = React.useMemo(() => {
    return Array.from(pieceStates.values()).sort((a, b) => {
      const itemCmp = a.itemId.localeCompare(b.itemId);
      if (itemCmp !== 0) return itemCmp;
      return a.pieceNumber - b.pieceNumber;
    });
  }, [pieceStates]);

  const handlePieceChange = React.useCallback(
    (pieceId: string, updates: Partial<ItemPiece>) => {
      setPieceStates((prev) => {
        const next = new Map(prev);
        const piece = next.get(pieceId);
        if (!piece) return prev;
        next.set(pieceId, { ...piece, ...updates });
        return next;
      });
    },
    []
  );

  const handleSplitToggle = React.useCallback(
    (pieceId: string, selected: boolean) => {
      if (!isPieceUuid(pieceId)) return;
      setSelectedForSplit((prev) => {
        const next = new Set(prev);
        if (selected) next.add(pieceId);
        else next.delete(pieceId);
        return next;
      });
    },
    []
  );

  const pieceColumns = React.useMemo((): CmxInlineEditTableColumn<ItemPiece>[] => {
    const cols: CmxInlineEditTableColumn<ItemPiece>[] = [
      {
        key: 'item',
        header: t('columns.item'),
        cell: (piece) => {
          const isRejected = Boolean(piece.isRejected);
          const isReady = piece.is_ready === true;
          const label =
            itemLabelById.get(piece.itemId) || t('unnamedItem');
          return (
            <div className="min-w-[10rem] space-y-1.5 py-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {label} #{piece.pieceNumber}
                </span>
                {isRejected ? (
                  <CmxStatusBadge
                    label={tModal('rejected')}
                    variant="error"
                    size="sm"
                  />
                ) : null}
                {isRejected ? (
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      handlePieceChange(piece.id, { isRejected: false })
                    }
                    aria-label={tModal('unReject')}
                  >
                    <X className="me-1 h-3 w-3" />
                    {tModal('unReject')}
                  </CmxButton>
                ) : null}
              </div>
              {isReady && !isRejected ? (
                <CmxInput
                  value={piece.rackLocation || ''}
                  onChange={(e) =>
                    handlePieceChange(piece.id, {
                      rackLocation: e.target.value,
                    })
                  }
                  placeholder={t('rackOptionalPlaceholder')}
                  aria-label={t('rackOptional')}
                  className="h-8 max-w-xs text-xs"
                />
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'notes',
        header: t('columns.notes'),
        cell: (piece) => (
          <CmxInput
            value={piece.notes || ''}
            onChange={(e) =>
              handlePieceChange(piece.id, { notes: e.target.value })
            }
            placeholder={t('notesPlaceholder')}
            aria-label={t('columns.notes')}
            className="h-8 min-w-[8rem] text-sm"
          />
        ),
      },
      {
        key: 'ready',
        header: t('columns.ready'),
        align: 'center',
        width: '5.5rem',
        cell: (piece) => {
          const isRejected = Boolean(piece.isRejected);
          const isReady = piece.is_ready === true;
          const checkbox = (
            <CmxCheckbox
              checked={isReady}
              disabled={isRejected}
              onChange={(e) => {
                if (isRejected) return;
                const checked = e.target.checked;
                handlePieceChange(piece.id, {
                  is_ready: checked,
                  isReady: checked,
                });
              }}
              aria-label={t('columns.ready')}
            />
          );
          return (
            <div className="flex justify-center">
              {isRejected ? (
                <Tooltip content={t('readyDisabledRejected')}>
                  <span className="inline-flex">{checkbox}</span>
                </Tooltip>
              ) : (
                checkbox
              )}
            </div>
          );
        },
      },
    ];

    if (splitOrderEnabled) {
      cols.push({
        key: 'split',
        header: t('columns.split'),
        align: 'center',
        width: '5.5rem',
        cell: (piece) => (
          <div className="flex justify-center">
            <CmxCheckbox
              checked={selectedForSplit.has(piece.id)}
              onChange={(e) => handleSplitToggle(piece.id, e.target.checked)}
              aria-label={t('columns.split')}
            />
          </div>
        ),
      });
    }

    return cols;
  }, [
    t,
    tModal,
    itemLabelById,
    splitOrderEnabled,
    selectedForSplit,
    handlePieceChange,
    handleSplitToggle,
  ]);

  const hasChanges = React.useMemo(() => {
    return Array.from(pieceStates.values()).some((piece) =>
      hasSimplePieceChanged(piece, originalPieceStates.get(piece.id))
    );
  }, [pieceStates, originalPieceStates]);

  const invalidateCaches = React.useCallback(() => {
    if (!orderId) return;
    queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
    queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
    onRefresh?.();
  }, [orderId, onRefresh, queryClient]);

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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || t('updateFailed')
        );
      }
      return data;
    },
    onSuccess: () => {
      cmxMessage.success(t('updateSuccess'));
      setOriginalPieceStates(new Map(pieceStates));
      invalidateCaches();
    },
    onError: (error) => {
      cmxMessage.error(
        error instanceof Error ? error.message : t('updateFailed')
      );
    },
  });

  const splitMutation = useMutation({
    mutationFn: async ({
      pieceIds,
      reason,
    }: {
      pieceIds: string[];
      reason: string;
    }) => {
      const response = await fetch(`/api/v1/orders/${orderId}/split`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify({ pieceIds, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || t('splitFailed')
        );
      }
      return data;
    },
    onSuccess: (data) => {
      cmxMessage.success(
        tModal('summary.splitSuccess') +
          (data?.newOrderNumber
            ? ` — ${tModal('summary.newOrder', { orderNumber: data.newOrderNumber })}`
            : '')
      );
      setSelectedForSplit(new Set());
      setShowSplitDialog(false);
      initializedOrderIdRef.current = null;
      invalidateCaches();
    },
    onError: (error) => {
      cmxMessage.error(
        error instanceof Error ? error.message : t('splitFailed')
      );
    },
  });

  const busy =
    updateMutation.isPending ||
    splitMutation.isPending ||
    showIssueDialog ||
    showSplitDialog;

  const requestClose = React.useCallback(() => {
    if (busy) return;
    if (hasChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [busy, hasChanges, onClose]);

  const handleUpdate = () => {
    const updates = Array.from(pieceStates.values())
      .filter((piece) => isPieceUuid(piece.id))
      .filter((piece) =>
        hasSimplePieceChanged(piece, originalPieceStates.get(piece.id))
      )
      .map((piece) => ({
        pieceId: piece.id,
        itemId: piece.itemId,
        pieceNumber: piece.pieceNumber,
        is_ready: piece.is_ready ?? null,
        notes: piece.notes || '',
        rackLocation: piece.rackLocation || '',
        isRejected: piece.isRejected || false,
      }));

    if (updates.length === 0) {
      cmxMessage.info(t('noChanges'));
      return;
    }

    const itemQuantityReady: Record<string, number> = {};
    items.forEach((item) => {
      const id = String(item.id ?? '');
      if (!id) return;
      const itemPieces = Array.from(pieceStates.values()).filter(
        (p) => p.itemId === id
      );
      itemQuantityReady[id] = itemPieces.filter(
        (p) => p.is_ready === true && !p.isRejected
      ).length;
    });

    // Omit orderRackLocation so batch-update does not auto-transition order to Ready
    updateMutation.mutate({
      updates,
      itemQuantityReady,
    });
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !updateMutation.isPending) {
          handleUpdate();
        }
      }
      if (e.key === 'Escape' && !busy) {
        requestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // handleUpdate closes over latest piece state; rebind when dirty/busy changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional keyboard binding scope
  }, [isOpen, hasChanges, updateMutation.isPending, busy, requestClose]);

  const orderNo = order
    ? String(order.order_no ?? order.orderNumber ?? '')
    : '';
  const currentStatus = order
    ? String(order.current_status ?? order.status ?? 'processing')
    : 'processing';
  const createdAt = order?.created_at ? String(order.created_at) : '';
  const updatedAt = order?.updated_at ? String(order.updated_at) : '';
  const createdByInfo =
    (order?.created_info as string | undefined) ||
    (order?.created_by_name as string | undefined) ||
    '';
  const branchName =
    (order?.branch_name as string | undefined) ||
    (order?.location_name as string | undefined) ||
    '';
  const paymentStatus = order
    ? String(order.payment_status ?? '')
    : '';
  const totalAmount = Number(
    order?.total_amount ?? order?.total ?? order?.grand_total ?? 0
  );
  const isPaid = isOrderPaidStatus(paymentStatus);
  const wasEdited =
    createdAt &&
    updatedAt &&
    new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 2000;

  const isLoading =
    orderLoading || settingsLoading || (trackByPiece && piecesLoading);

  return (
    <>
      <CmxDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <CmxDialogContent
          className="flex max-h-[90vh] w-full max-w-3xl flex-col"
          aria-labelledby="simple-processing-title"
          aria-describedby="simple-processing-desc"
        >
          <CmxDialogHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CmxDialogTitle
                  id="simple-processing-title"
                  className="text-xl font-bold sm:text-2xl"
                >
                  {orderNo ? t('title', { orderNo }) : t('titleFallback')}
                </CmxDialogTitle>
                <CmxDialogDescription id="simple-processing-desc" className="sr-only">
                  {t('description')}
                </CmxDialogDescription>
                <CmxStatusBadge
                  label={
                    currentStatus === 'processing'
                      ? t('statusProcessing')
                      : currentStatus
                  }
                  variant="info"
                  size="sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <CmxButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!orderId || busy}
                  onClick={() => {
                    setShowSplitDialog(false);
                    setShowIssueDialog(true);
                  }}
                >
                  {t('reportIssue')}
                </CmxButton>
                <CmxButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => cmxMessage.info(t('sendReceiptComingSoon'))}
                >
                  {t('sendReceipt')}
                </CmxButton>
              </div>
            </div>

            {!isLoading && order && (
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {t('meta.created')}
                  </div>
                  <div className="text-foreground">
                    {createdAt
                      ? new Date(createdAt).toLocaleString(locale)
                      : '—'}
                  </div>
                  {createdAt ? (
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(createdAt, locale)}
                    </div>
                  ) : null}
                  {createdByInfo || branchName ? (
                    <div className="text-xs text-muted-foreground">
                      {[createdByInfo, branchName].filter(Boolean).join(' · ')}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {t('meta.payment')}
                  </div>
                  <div className="text-foreground">
                    {formatMoneyWithCode(totalAmount)}{' '}
                    <span className="text-muted-foreground">
                      {isPaid ? t('meta.paid') : t('meta.unpaid')}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {t('meta.edited')}
                  </div>
                  <div className="text-foreground">
                    {wasEdited ? t('meta.yes') : t('meta.no')}
                  </div>
                </div>
              </div>
            )}
          </CmxDialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            {orderError ? (
              <CmxEmptyState
                title={t('loadError')}
                description={
                  orderError instanceof Error
                    ? orderError.message
                    : t('loadError')
                }
              />
            ) : (
              <CmxInlineEditTable
                caption={t('description')}
                columns={pieceColumns}
                data={pieceRows}
                getRowId={(piece) => piece.id}
                loading={isLoading}
                skeletonRows={4}
                density="compact"
                zebra
                emptyTitle={t('noPiecesTitle')}
                emptyDescription={t('noPiecesDesc')}
                emptyAction={
                  orderId && onOpenFullEditor ? (
                    <CmxButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onOpenFullEditor(orderId);
                      }}
                    >
                      {t('openFullEditor')}
                    </CmxButton>
                  ) : undefined
                }
                getRowClassName={(piece) =>
                  piece.isRejected ? 'bg-destructive/5' : undefined
                }
              />
            )}
          </div>

          <CmxDialogFooter className="flex-shrink-0 border-t pt-4">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {splitOrderEnabled && selectedForSplit.size > 0 && (
                <CmxButton
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setShowIssueDialog(false);
                    setShowSplitDialog(true);
                  }}
                >
                  {tModal('splitOrder')} ({selectedForSplit.size})
                </CmxButton>
              )}
              <CmxButton
                type="button"
                variant="secondary"
                onClick={requestClose}
                disabled={updateMutation.isPending || splitMutation.isPending}
              >
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton
                type="button"
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleUpdate}
                disabled={
                  !hasChanges ||
                  updateMutation.isPending ||
                  pieceRows.length === 0 ||
                  !csrfToken
                }
                loading={updateMutation.isPending}
              >
                {t('update')}
              </CmxButton>
            </div>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <SplitConfirmationDialog
        isOpen={showSplitDialog}
        pieceCount={selectedForSplit.size}
        isLoading={splitMutation.isPending}
        onCancel={() => setShowSplitDialog(false)}
        onConfirm={(reason) => {
          const pieceIds = Array.from(selectedForSplit).filter(isPieceUuid);
          if (pieceIds.length === 0) return;
          splitMutation.mutate({ pieceIds, reason });
        }}
      />

      {orderId ? (
        <SimpleProcessingIssueDialog
          open={showIssueDialog}
          orderId={orderId}
          onOpenChange={setShowIssueDialog}
          onSuccess={invalidateCaches}
        />
      ) : null}

      <CmxConfirmDialog
        open={showDiscardConfirm}
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discardConfirm')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
      />
    </>
  );
}
