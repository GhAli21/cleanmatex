/**
 * Processing Table Component
 * Dense, sortable data table with all order details
 */

'use client';

import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, SquarePen, CheckCircle, Loader2, AlertCircle, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback/cmx-message';
import { isOrderPaidStatus } from '@/lib/utils/order-payment-status';
import { normalizeOrderStateResponse } from '@features/workflow/lib/processing-piece-map';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton, CmxInput, Label } from '@ui/primitives';
import type { ProcessingOrder, SortField, SortDirection } from '@/types/processing';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { OrderIssueRowActions } from '@features/orders/ui/issues/order-issue-row-actions';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';

const sortableHeaderClass =
  'px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors rtl:text-right';

function formatProcessingDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  return `${day}/${month}/${year} ${hour12}${ampm}`;
}

function useProcessingDialogPrefetch() {
  const queryClient = useQueryClient();

  return React.useCallback((orderId: string) => {
    void queryClient.prefetchQuery({
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
      staleTime: 30000,
    });

    void queryClient.prefetchQuery({
      queryKey: ['order-pieces', orderId],
      queryFn: async () => {
        const response = await fetch(`/api/v1/orders/${orderId}/pieces`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error || `HTTP ${response.status}`
          );
        }
        return response.json();
      },
      staleTime: 30000,
    });
  }, [queryClient]);
}

function ProcessingSortableHeader({
  field,
  sortField,
  onSort,
  children,
}: {
  field: SortField;
  sortField: SortField;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}) {
  return (
    <th className={sortableHeaderClass} onClick={() => onSort(field)}>
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown
          className={`h-4 w-4 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`}
        />
      </div>
    </th>
  );
}

interface ProcessingTableProps {
  orders: ProcessingOrder[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onRefresh: () => void;
  onEditClick?: (orderId: string) => void;
  /** Opens Simple Processing dialog */
  onSimpleProcessClick?: (orderId: string) => void;
  selectedOrderId?: string | null;
}

/**
 *
 * @param root0
 * @param root0.orders
 * @param root0.sortField
 * @param root0.onSort
 * @param root0.onRefresh
 * @param root0.onEditClick
 * @param root0.selectedOrderId
 */
export function ProcessingTable({
  orders,
  sortField,
  onSort,
  onRefresh,
  onEditClick,
  onSimpleProcessClick,
  selectedOrderId,
}: ProcessingTableProps) {
  const t = useTranslations('processing.table');
  const [isMobile, setIsMobile] = React.useState(false);
  const [markReadyOrder, setMarkReadyOrder] = useState<ProcessingOrder | null>(null);
  const [markReadyBusyId, setMarkReadyBusyId] = useState<string | null>(null);
  const [markReadySuccessId, setMarkReadySuccessId] = useState<string | null>(null);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMarkReadyClick = useCallback((order: ProcessingOrder) => {
    setMarkReadyOrder(order);
  }, []);

  const handleMarkReadyClose = useCallback(() => {
    setMarkReadyOrder(null);
  }, []);

  const handleMarkReadySuccess = useCallback(
    (orderId: string) => {
      setMarkReadyOrder(null);
      setMarkReadyBusyId(null);
      setMarkReadySuccessId(orderId);
      window.setTimeout(() => {
        onRefresh();
        setMarkReadySuccessId(null);
      }, 1500);
    },
    [onRefresh]
  );

  const handleMarkReadyBusy = useCallback((orderId: string | null) => {
    setMarkReadyBusyId(orderId);
  }, []);

  const sharedMarkReadyDialog = (
    <SharedMarkReadyDialog
      order={markReadyOrder}
      onClose={handleMarkReadyClose}
      onBusy={handleMarkReadyBusy}
      onSuccess={handleMarkReadySuccess}
    />
  );

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-600 text-lg">{t('noOrders')}</p>
        <Link
          href="/dashboard/orders/new"
          className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('createNew')}
        </Link>
      </div>
    );
  }

  if (isMobile) {
    return (
      <>
        <div className="space-y-4">
          {orders.map((order, index) => (
            <ProcessingOrderCard
              key={order.id}
              order={order}
              formatDate={formatProcessingDate}
              onEditClick={onEditClick}
              onSimpleProcessClick={onSimpleProcessClick}
              onMarkReadyClick={handleMarkReadyClick}
              onRefresh={onRefresh}
              markReadyBusy={markReadyBusyId === order.id}
              markReadySuccess={markReadySuccessId === order.id}
              index={index}
              selectedOrderId={selectedOrderId}
            />
          ))}
        </div>
        {sharedMarkReadyDialog}
      </>
    );
  }

  return (
    <>
      <ProcessingTableDesktop
        orders={orders}
        sortField={sortField}
        onSort={onSort}
        onEditClick={onEditClick}
        onSimpleProcessClick={onSimpleProcessClick}
        onMarkReadyClick={handleMarkReadyClick}
        onRefresh={onRefresh}
        markReadyBusyId={markReadyBusyId}
        markReadySuccessId={markReadySuccessId}
        formatDate={formatProcessingDate}
        selectedOrderId={selectedOrderId}
      />
      {sharedMarkReadyDialog}
    </>
  );
}

interface OrderRowProps {
  order: ProcessingOrder;
  formatDate: (date: string) => string;
  onEditClick?: (orderId: string) => void;
  onSimpleProcessClick?: (orderId: string) => void;
  onMarkReadyClick: (order: ProcessingOrder) => void;
  onRefresh: () => void;
  markReadyBusy: boolean;
  markReadySuccess: boolean;
  index: number;
  selectedOrderId?: string | null;
}

const OrderRow = React.memo(function OrderRow({
  order,
  formatDate,
  onEditClick,
  onSimpleProcessClick,
  onMarkReadyClick,
  onRefresh,
  markReadyBusy,
  markReadySuccess,
  index,
  selectedOrderId,
}: OrderRowProps) {
  const router = useRouter();
  const t = useTranslations('processing.table');
  const tProcessing = useTranslations('processing');
  const { formatMoneyWithCode } = useTenantCurrency();
  const prefetchProcessingDialogs = useProcessingDialogPrefetch();
  const isPaid = isOrderPaidStatus(order.payment_status);
  const isUrgent = order.priority === 'urgent' || order.priority === 'express';
  const isSelected = selectedOrderId === order.id;

  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const successMessage = markReadySuccess
    ? t('markReadySuccess') || 'Order marked as ready successfully'
    : null;

  const rowHighlight = isUrgent ? 'border-l-4 border-l-pink-500' : 'border-l-4 border-l-blue-200';

  const rowBgColor = isSelected
    ? 'bg-green-50'
    : index % 2 === 0
      ? 'bg-white'
      : 'bg-gray-50/50';
  const hoverColor = isSelected ? 'hover:bg-green-100' : 'hover:bg-blue-50/50';

  const handleStatusToggleClick = () => {
    onMarkReadyClick(order);
  };

  const handleEdit = () => {
    setIsLoadingEdit(true);

    if (onEditClick) {
      onEditClick(order.id);
      setTimeout(() => setIsLoadingEdit(false), 500);
    } else {
      router.push(`/dashboard/processing/${order.id}`);
    }
  };

  return (
    <React.Fragment>
      <tr className={`${rowBgColor} ${hoverColor} transition-colors duration-150 ${rowHighlight}`}>
        {/* ID */}
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="font-medium text-blue-600">{order.order_no}</div>
            <OrderIssueRowActions
              orderId={order.id}
              scopeLevel={ORDER_ISSUE_SCOPE.ORDER}
              openCount={order.has_issue ? 1 : 0}
              totalCount={
                order.issue_total_count ??
                (order.has_issue ? 1 : 0)
              }
              hasOpenIssue={order.has_issue}
              onChanged={onRefresh}
            />
          </div>
        </td>

        {/* READY BY */}
        <td className="px-4 py-4">
          <div className="text-sm">{formatDate(order.ready_by_at)}</div>
        </td>

        {/* CUSTOMER */}
        <td className="px-4 py-4">
          <div className="font-medium">{order.customer_name}</div>
          {order.customer_name2 && (
            <div className="text-sm text-gray-500">{order.customer_name2}</div>
          )}
        </td>

        {/* ORDER - Multi-line items with details */}
        <td className="px-4 py-4">
          <div className="space-y-2 max-w-xs">
            {order.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="text-sm space-y-1">
                <div className="font-medium">
                  {item.product_name} x {item.quantity}
                </div>
                {/* Item Details: Color, Brand */}
                {(item.color || item.brand) && (
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
                    {item.color && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                        {t('color') || 'Color'}: {item.color}
                      </span>
                    )}
                    {item.brand && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                        {t('brand') || 'Brand'}: {item.brand}
                      </span>
                    )}
                  </div>
                )}
                {/* Condition Flags: Stain, Damage */}
                {(item.has_stain || item.has_damage) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.has_stain && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded border border-yellow-200">
                        {t('stain') || 'Stain'}
                      </span>
                    )}
                    {item.has_damage && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded border border-red-200">
                        {t('damage') || 'Damage'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {order.items.length > 3 && (
              <div className="text-sm text-gray-500">
                +{order.items.length - 3} {t('moreItems')}
              </div>
            )}
            <Link
              href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/processing')}&returnLabel=${encodeURIComponent(tProcessing('backToProcessing') || 'Back to Processing')}`}
              className="inline-block mt-2 text-xs text-blue-600 hover:text-blue-700"
            >
              {t('details')} →
            </Link>
          </div>
        </td>

        {/* PCS */}
        <td className="px-4 py-4 text-right">
          <div className="font-medium">{order.total_items}</div>
        </td>

        {/* ✅ PROGRESS - NEW */}
        <td className="px-4 py-4">
          <div className="w-24">
            {(() => {
              const progressPercent = order.total_items > 0
                ? Math.round((order.quantity_ready || 0) / order.total_items * 100)
                : 0;

              return (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {tProcessing('progress')}: {progressPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${progressPercent === 100 ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                      style={{ width: `${Math.min(100, progressPercent)}%` }}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </td>

        {/* NOTES */}
        <td className="px-4 py-4">
          <div className="text-sm text-gray-600 max-w-xs truncate">
            {order.notes || '—'}
          </div>
        </td>

        {/* TOTAL */}
        <td className="px-4 py-4 text-right">
          <div className="font-semibold">{formatMoneyWithCode(order.total)}</div>
        </td>

        {/* STATUS - Action Icons */}
        <td className="px-4 py-4">
          <div className="flex items-center gap-3 justify-end">
            {/* Payment/Priority Tag */}
            {!isPaid && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                1st
              </span>
            )}

            {/* Full processing editor */}
            <button
              onClick={handleEdit}
              onMouseEnter={() => prefetchProcessingDialogs(order.id)}
              disabled={isLoadingEdit}
              className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
              title={isLoadingEdit ? (t('opening') || 'Opening...') : t('edit')}
              aria-label={t('edit')}
            >
              {isLoadingEdit ? (
                <Loader2 className="h-4 w-4 text-gray-600 animate-spin" />
              ) : (
                <SquarePen className="h-4 w-4 text-gray-600" />
              )}
            </button>

            {/* Simple processing dialog */}
            <button
              type="button"
              onClick={() => onSimpleProcessClick?.(order.id)}
              onMouseEnter={() => prefetchProcessingDialogs(order.id)}
              disabled={!onSimpleProcessClick}
              className="p-2 hover:bg-sky-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('simpleProcess')}
              aria-label={t('simpleProcess')}
            >
              <ListChecks className="h-4 w-4 text-sky-700" />
            </button>

            {/* Status Toggle Icon */}
            <button
              type="button"
              onClick={handleStatusToggleClick}
              disabled={markReadyBusy}
              className="p-2 hover:bg-green-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
              title={markReadyBusy ? (t('processing') || 'Processing...') : t('complete')}
              aria-label={t('complete')}
            >
              {markReadyBusy ? (
                <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </button>

            {/* Current Status Badge */}
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
              {order.current_status}
            </span>

            {/* Link to processing details page */}
            <Link
              href={`/dashboard/processing/${order.id}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              title={t('viewProcessingDetails')}
              aria-label={t('viewProcessingDetails')}
            >
              {t('viewProcessingDetails')} →
            </Link>
          </div>
        </td>

      </tr>

      {/* Success Message Row */}
      {successMessage && (
        <tr>
          <td colSpan={9} className="px-4 py-3 bg-green-50 border-t border-green-200">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

/** Single shared Mark Ready confirm dialog for the whole table (desktop + mobile). */
function SharedMarkReadyDialog({
  order,
  onClose,
  onBusy,
  onSuccess,
}: {
  order: ProcessingOrder | null;
  onClose: () => void;
  onBusy: (orderId: string | null) => void;
  onSuccess: (orderId: string) => void;
}) {
  const t = useTranslations('processing.table');
  const tDetail = useTranslations('processing.detail');
  const tCommon = useTranslations('common');
  const [isLoading, setIsLoading] = useState(false);
  const [rackLocation, setRackLocation] = useState('');
  const [rackLocationError, setRackLocationError] = useState('');

  const resetForm = useCallback(() => {
    setRackLocation('');
    setRackLocationError('');
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    if (order) {
      resetForm();
    }
  }, [order?.id, resetForm]);

  const handleConfirm = async () => {
    if (!order) return;
    const rack = rackLocation.trim();
    if (!rack) {
      setRackLocationError(
        tDetail('validation.rackLocationRequired') || 'Rack location is required'
      );
      return;
    }

    const orderId = order.id;
    onBusy(orderId);
    setIsLoading(true);
    onClose();

    try {
      const res = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus: 'ready',
          notes: 'Processing completed via quick action',
          metadata: {
            rack_location: rack,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          resetForm();
          onSuccess(orderId);
          return;
        }
        onBusy(null);
        setIsLoading(false);
        cmxMessage.error(t('markReadyError') || 'Failed to update order status', {
          description: json.error,
          duration: 5000,
        });
      } else {
        onBusy(null);
        setIsLoading(false);
        const error = await res
          .json()
          .catch(() => ({ error: t('markReadyError') || 'Failed to update order status' }));
        cmxMessage.error(t('markReadyError') || 'Failed to update order status', {
          description: error.error,
          duration: 5000,
        });
      }
    } catch (error) {
      onBusy(null);
      setIsLoading(false);
      cmxMessage.error(t('markReadyError') || 'Error updating order status', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  return (
    <CmxDialog open={!!order} onOpenChange={handleOpenChange}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            {t('confirmMarkReady') || 'Confirm Mark as Ready'}
          </CmxDialogTitle>
          <CmxDialogDescription>
            {t('confirmMarkReadyMessage') ||
              `Are you sure you want to mark order ${order?.order_no ?? ''} as ready?`}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className="py-4 space-y-2">
          <Label htmlFor="rack-location" className="block text-sm font-medium text-gray-700">
            {t('rackLocation') || tDetail('rackLocation') || 'Rack Location'}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <CmxInput
            id="rack-location"
            value={rackLocation}
            onChange={(e) => {
              setRackLocation(e.target.value);
              setRackLocationError('');
            }}
            placeholder={tDetail('rackLocationPlaceholder') || 'e.g., Rack A-12'}
            aria-invalid={!!rackLocationError}
            required
          />
          {rackLocationError && (
            <p className="text-sm text-red-600">{rackLocationError}</p>
          )}
          <p className="text-xs text-gray-500">
            {tDetail('rackLocationHelp') ||
              'Enter the rack location where this order is stored'}
          </p>
        </div>

        <CmxDialogFooter>
          <CmxButton
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {tCommon('cancel') || 'Cancel'}
          </CmxButton>
          <CmxButton
            variant="primary"
            onClick={handleConfirm}
            disabled={isLoading || !rackLocation.trim()}
            loading={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('processing') || 'Processing...'}
              </>
            ) : (
              t('confirmReady') || 'Confirm Ready'
            )}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

// ✅ Mobile Card View Component
function ProcessingOrderCard({
  order,
  formatDate,
  onEditClick,
  onSimpleProcessClick,
  onMarkReadyClick,
  onRefresh,
  markReadyBusy,
  markReadySuccess,
  index,
  selectedOrderId,
}: {
  order: ProcessingOrder;
  formatDate: (date: string) => string;
  onEditClick?: (orderId: string) => void;
  onSimpleProcessClick?: (orderId: string) => void;
  onMarkReadyClick: (order: ProcessingOrder) => void;
  onRefresh: () => void;
  markReadyBusy: boolean;
  markReadySuccess: boolean;
  index: number;
  selectedOrderId?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations('processing.table');
  const tProcessing = useTranslations('processing');
  const { formatMoneyWithCode } = useTenantCurrency();
  const isPaid = isOrderPaidStatus(order.payment_status);
  const isUrgent = order.priority === 'urgent' || order.priority === 'express';
  const isSelected = selectedOrderId === order.id;
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const prefetchProcessingDialogs = useProcessingDialogPrefetch();

  const handleEdit = () => {
    setIsLoadingEdit(true);
    if (onEditClick) {
      onEditClick(order.id);
      setTimeout(() => setIsLoadingEdit(false), 500);
    } else {
      router.push(`/dashboard/processing/${order.id}`);
    }
  };

  const progressPercent = order.total_items > 0
    ? Math.round((order.quantity_ready || 0) / order.total_items * 100)
    : 0;

  return (
    <div className={`rounded-lg border-2 p-4 ${isSelected
      ? 'bg-green-50 border-green-300'
      : isUrgent
        ? 'bg-white border-l-4 border-l-pink-500'
        : 'bg-white border-gray-200'
      }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-blue-600 text-lg">{order.order_no}</h3>
            <OrderIssueRowActions
              orderId={order.id}
              scopeLevel={ORDER_ISSUE_SCOPE.ORDER}
              openCount={order.has_issue ? 1 : 0}
              totalCount={
                order.issue_total_count ?? (order.has_issue ? 1 : 0)
              }
              hasOpenIssue={order.has_issue}
              onChanged={onRefresh}
            />
            {!isPaid && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                1st
              </span>
            )}
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
              {order.current_status}
            </span>
          </div>
          <p className="text-sm text-gray-600">{order.customer_name}</p>
          <p className="text-xs text-gray-500">{formatDate(order.ready_by_at)}</p>
        </div>
      </div>

      {/* Items */}
      <div className="mb-3 space-y-2">
        {order.items.slice(0, 2).map((item, idx) => (
          <div key={idx} className="text-sm space-y-1">
            <div className="font-medium text-gray-700">
              {item.product_name} x {item.quantity}
            </div>
            {/* Item Details: Color, Brand */}
            {(item.color || item.brand) && (
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
                {item.color && (
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                    {t('color') || 'Color'}: {item.color}
                  </span>
                )}
                {item.brand && (
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                    {t('brand') || 'Brand'}: {item.brand}
                  </span>
                )}
              </div>
            )}
            {/* Condition Flags: Stain, Damage */}
            {(item.has_stain || item.has_damage) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.has_stain && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded border border-yellow-200">
                    {t('stain') || 'Stain'}
                  </span>
                )}
                {item.has_damage && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded border border-red-200">
                    {t('damage') || 'Damage'}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {order.items.length > 2 && (
          <div className="text-xs text-gray-500">
            +{order.items.length - 2} {t('moreItems')}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">{tProcessing('progress')}</span>
          <span className="text-xs font-medium text-gray-700">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${progressPercent === 100 ? 'bg-green-600' : 'bg-blue-600'
              }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div>
          <span className="text-gray-600">{t('pcs')}: </span>
          <span className="font-medium">{order.total_items}</span>
        </div>
        <div className="text-right">
          <span className="text-gray-600">{t('total')}: </span>
          <span className="font-semibold">{formatMoneyWithCode(order.total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
        <Link
          href={`/dashboard/processing/${order.id}`}
          className="text-xs text-blue-600 hover:text-blue-700 text-center py-1 font-medium"
        >
          {t('viewProcessingDetails')} →
        </Link>
        <Link
          href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/processing')}&returnLabel=${encodeURIComponent(tProcessing('backToProcessing') || 'Back to Processing')}`}
          className="text-xs text-blue-600 hover:text-blue-700 text-center py-1"
        >
          {t('details')} →
        </Link>
        <button
          type="button"
          onClick={() => onSimpleProcessClick?.(order.id)}
          onMouseEnter={() => prefetchProcessingDialogs(order.id)}
          disabled={!onSimpleProcessClick}
          className="w-full px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <ListChecks className="h-4 w-4" />
          {t('simpleProcess')}
        </button>
        <button
          type="button"
          onClick={handleEdit}
          onMouseEnter={() => prefetchProcessingDialogs(order.id)}
          disabled={isLoadingEdit}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait text-sm font-medium flex items-center justify-center gap-2"
        >
          {isLoadingEdit ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('opening') || 'Opening...'}
            </>
          ) : (
            <>
              <SquarePen className="h-4 w-4" />
              {t('edit')}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => onMarkReadyClick(order)}
          disabled={markReadyBusy}
          className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
        >
          {markReadyBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('processing') || 'Processing...'}
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              {t('complete')}
            </>
          )}
        </button>
        {markReadySuccess ? (
          <p className="text-sm text-green-700 text-center">
            {t('markReadySuccess') || 'Order marked as ready successfully'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ✅ Desktop Table Component (extracted for clarity)
function ProcessingTableDesktop({
  orders,
  sortField,
  onSort,
  onEditClick,
  onSimpleProcessClick,
  onMarkReadyClick,
  onRefresh,
  markReadyBusyId,
  markReadySuccessId,
  formatDate,
  selectedOrderId,
}: {
  orders: ProcessingOrder[];
  sortField: SortField;
  onSort: (field: SortField) => void;
  onEditClick?: (orderId: string) => void;
  onSimpleProcessClick?: (orderId: string) => void;
  onMarkReadyClick: (order: ProcessingOrder) => void;
  onRefresh: () => void;
  markReadyBusyId: string | null;
  markReadySuccessId: string | null;
  formatDate: (date: string) => string;
  selectedOrderId?: string | null;
}) {
  const t = useTranslations('processing.table');
  const tProcessing = useTranslations('processing');

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <ProcessingSortableHeader field="id" sortField={sortField} onSort={onSort}>
                {t('id')}
              </ProcessingSortableHeader>
              <ProcessingSortableHeader field="ready_by_at" sortField={sortField} onSort={onSort}>
                {t('readyBy')}
              </ProcessingSortableHeader>
              <ProcessingSortableHeader field="customer_name" sortField={sortField} onSort={onSort}>
                {t('customer')}
              </ProcessingSortableHeader>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 rtl:text-right">
                {t('order')}
              </th>
              <ProcessingSortableHeader field="total_items" sortField={sortField} onSort={onSort}>
                {t('pcs')}
              </ProcessingSortableHeader>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 rtl:text-right">
                {tProcessing('progress')}
              </th>
              <ProcessingSortableHeader field="notes" sortField={sortField} onSort={onSort}>
                {t('notes')}
              </ProcessingSortableHeader>
              <ProcessingSortableHeader field="total" sortField={sortField} onSort={onSort}>
                {t('total')}
              </ProcessingSortableHeader>
              <ProcessingSortableHeader field="status" sortField={sortField} onSort={onSort}>
                {t('status')}
              </ProcessingSortableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order, index) => (
              <OrderRow
                key={order.id}
                order={order}
                formatDate={formatDate}
                onEditClick={onEditClick}
                onSimpleProcessClick={onSimpleProcessClick}
                onMarkReadyClick={onMarkReadyClick}
                onRefresh={onRefresh}
                markReadyBusy={markReadyBusyId === order.id}
                markReadySuccess={markReadySuccessId === order.id}
                index={index}
                selectedOrderId={selectedOrderId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
