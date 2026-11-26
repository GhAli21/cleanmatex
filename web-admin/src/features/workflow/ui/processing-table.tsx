/**
 * Processing Table Component
 * Full-width, dense Cmx worklist table (desktop) and responsive cards (mobile).
 */

'use client';

import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  ExternalLink,
  FileText,
  ListChecks,
  MoreVertical,
  PackageOpen,
  RotateCcw,
  SquarePen,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  CmxButton,
  CmxInput,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives';
import { CmxCodeChip, CmxEmptyState } from '@ui/data-display';
import { CmxStatusBadge, CmxSummaryMessage, cmxMessage, type CmxBadgeTone } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';
import { ORDER_PAYMENT_STATUS } from '@/lib/constants/order-financial';
import { PRIORITY_LEVELS } from '@/lib/constants/order-types';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';
import { useBilingual } from '@/lib/utils/bilingual';
import { normalizeOrderPaymentStatus } from '@/lib/utils/order-payment-status';
import { postStaffWorkflowCommand } from '@/lib/workflow/post-staff-workflow-command';
import { OrderDetailsLink } from '@features/orders/ui/order-details-link';
import { OrderIssueRowActions } from '@features/orders/ui/issues/order-issue-row-actions';
import { normalizeOrderStateResponse } from '@features/workflow/lib/processing-piece-map';
import type { ProcessingOrder, SortDirection, SortField } from '@/types/processing';
import { useOperationalZones } from '@/lib/hooks/use-operational-zones';
import { civilDateInZone, formatInstantOrEmpty } from '@/lib/utils/operational-time';

interface ProcessingTableProps {
  tenantOrgId?: string | null;
  orders: ProcessingOrder[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onRefresh: () => void;
  onEditClick?: (orderId: string) => void;
  onSimpleProcessClick?: (orderId: string) => void;
  selectedOrderId?: string | null;
  nowMs: number;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}

function formatProcessingDate(dateString: string, locale: string, zone: string | null): string {
  return formatInstantOrEmpty(dateString, zone, locale === 'ar' ? 'ar' : 'en') || '—';
}

type SlaState = 'overdue' | 'dueSoon' | 'today' | null;

function getSlaState(readyByAt: string, nowMs: number, zone: string | null): SlaState {
  const due = new Date(readyByAt);
  if (Number.isNaN(due.getTime())) return null;
  const diffMs = due.getTime() - nowMs;
  if (diffMs < 0) return 'overdue';
  if (diffMs <= 2 * 60 * 60 * 1000) return 'dueSoon';
  const dueDay = civilDateInZone(readyByAt, zone);
  const today = civilDateInZone(new Date(nowMs), zone);
  if (dueDay && dueDay === today) return 'today';
  return null;
}

function getPaymentBadgeInfo(
  order: ProcessingOrder,
  t: ReturnType<typeof useTranslations>
): { label: string; tone: CmxBadgeTone } {
  const normalized = normalizeOrderPaymentStatus(order.payment_status, {
    paymentTypeCode: order.payment_type_code,
    outstandingAmount: order.outstanding_amount,
  });

  switch (normalized) {
    case ORDER_PAYMENT_STATUS.PAID:
    case ORDER_PAYMENT_STATUS.OVERPAID:
      return { label: t('paymentPaid'), tone: 'success' };
    case ORDER_PAYMENT_STATUS.PARTIALLY_PAID:
      return { label: t('paymentPartial'), tone: 'warning' };
    case ORDER_PAYMENT_STATUS.PENDING_COLLECTION:
      return { label: t('paymentCollection'), tone: 'warning' };
    default:
      return { label: t('paymentUnpaid'), tone: 'danger' };
  }
}

const KNOWN_PROCESSING_STATUS_KEYS = new Set([
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

function getLocalizedStatusLabel(
  status: string,
  tStatus: (key: string) => string
): string {
  const normalized = (status || 'processing').trim().toLowerCase();
  if (KNOWN_PROCESSING_STATUS_KEYS.has(normalized)) {
    return tStatus(normalized);
  }
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getPriorityBadgeInfo(
  priority: string,
  t: ReturnType<typeof useTranslations>
): { label: string; tone: CmxBadgeTone } | null {
  const normalized = (priority || '').toLowerCase();
  if (normalized === PRIORITY_LEVELS.URGENT) {
    return { label: t('priorityUrgent'), tone: 'danger' };
  }
  if (normalized === PRIORITY_LEVELS.EXPRESS) {
    return { label: t('priorityExpress'), tone: 'brand' };
  }
  return null;
}

function useProcessingDialogPrefetch() {
  const queryClient = useQueryClient();

  return useCallback(
    (orderId: string) => {
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
    },
    [queryClient]
  );
}

function ProcessingSortableHeader({
  field,
  sortField,
  sortDirection,
  onSort,
  alignEnd = false,
  children,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  alignEnd?: boolean;
  children: React.ReactNode;
}) {
  const isActive = sortField === field;
  const SortIcon = !isActive
    ? ArrowUpDown
    : sortDirection === 'asc'
      ? ArrowUp
      : ArrowDown;

  return (
    <TableHead
      rowHeight="compact"
      aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-2 py-2 ${alignEnd ? 'text-end' : ''}`}
    >
      <CmxButton
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onSort(field)}
        className={`-mx-1.5 h-7 max-w-full px-1.5 font-semibold text-foreground ${alignEnd ? 'ms-auto' : ''}`}
      >
        <span className="truncate">{children}</span>
        <SortIcon
          className={`ms-1 h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary-text' : 'text-muted-foreground'}`}
          aria-hidden
        />
      </CmxButton>
    </TableHead>
  );
}

/**
 * Processing worklist with responsive desktop table and mobile card list.
 * @param props Component props.
 */
export function ProcessingTable(props: ProcessingTableProps) {
  const {
    tenantOrgId,
    orders,
    sortField,
    sortDirection,
    onSort,
    onRefresh,
    onEditClick,
    onSimpleProcessClick,
    selectedOrderId,
    nowMs,
    hasActiveFilters = false,
    onResetFilters,
  } = props;
  const t = useTranslations('processing.table');
  const tFilters = useTranslations('processing.filters');
  const [markReadyOrder, setMarkReadyOrder] = useState<ProcessingOrder | null>(null);
  const [markReadyBusyId, setMarkReadyBusyId] = useState<string | null>(null);
  const [markReadySuccessId, setMarkReadySuccessId] = useState<string | null>(null);
  const { zoneFor } = useOperationalZones('ready_by', orders.map((order) => order.branch_id));

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
      cmxMessage.success(t('markReadySuccess'));
      window.setTimeout(() => {
        onRefresh();
        setMarkReadySuccessId(null);
      }, 900);
    },
    [onRefresh, t]
  );

  const handleMarkReadyBusy = useCallback((orderId: string | null) => {
    setMarkReadyBusyId(orderId);
  }, []);

  if (orders.length === 0) {
    return (
      <CmxEmptyState
        icon={<PackageOpen className="h-10 w-10 text-muted-foreground" aria-hidden />}
        title={hasActiveFilters ? t('noOrdersFiltered') : t('noOrders')}
        description={hasActiveFilters ? t('clearFiltersHint') : undefined}
        action={
          hasActiveFilters && onResetFilters ? (
            <CmxButton type="button" variant="outline" onClick={onResetFilters}>
              <RotateCcw className="me-1.5 h-4 w-4" aria-hidden />
              {tFilters('clearFilters')}
            </CmxButton>
          ) : (
            <CmxButton variant="primary" asChild>
              <Link href="/dashboard/orders/new">{t('createNew')}</Link>
            </CmxButton>
          )
        }
      />
    );
  }

  return (
    <>
      {/* Mobile / Tablet Cards (< lg) */}
      <div className="space-y-3 lg:hidden">
        {orders.map((order) => (
          <ProcessingOrderCard
            key={order.id}
            order={order}
            onEditClick={onEditClick}
            onSimpleProcessClick={onSimpleProcessClick}
            onMarkReadyClick={handleMarkReadyClick}
            onRefresh={onRefresh}
            markReadyBusy={markReadyBusyId === order.id}
            markReadySuccess={markReadySuccessId === order.id}
            selectedOrderId={selectedOrderId}
            nowMs={nowMs}
            tenantOrgId={tenantOrgId}
            opsZone={zoneFor(order.branch_id)}
          />
        ))}
      </div>

      {/* Desktop Table (>= lg): full row fits without horizontal scroll; vertical scroll with sticky header */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:block">
        <Table
          className="w-full table-fixed"
          containerClassName="max-h-[calc(100vh-20rem)] min-h-[16rem] overflow-y-auto overflow-x-hidden"
        >
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
            <TableRow>
              <ProcessingSortableHeader field="order_no" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>
                {t('id')}
              </ProcessingSortableHeader>
              <ProcessingSortableHeader field="ready_by_at" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>
                {t('readyBy')}
              </ProcessingSortableHeader>
              <ProcessingSortableHeader field="customer_name" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>
                {t('customer')}
              </ProcessingSortableHeader>
              <TableHead rowHeight="compact" className="px-2 py-2">{t('order')}</TableHead>
              <ProcessingSortableHeader field="total_items" sortField={sortField} sortDirection={sortDirection} onSort={onSort} alignEnd>
                {t('pcs')}
              </ProcessingSortableHeader>
              <TableHead rowHeight="compact" className="px-2 py-2">{t('notes')}</TableHead>
              <ProcessingSortableHeader field="total" sortField={sortField} sortDirection={sortDirection} onSort={onSort} alignEnd>
                {t('total')}
              </ProcessingSortableHeader>
              <ProcessingSortableHeader field="status" sortField={sortField} sortDirection={sortDirection} onSort={onSort} alignEnd>
                {t('status')}
              </ProcessingSortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order, index) => (
              <OrderRow
                key={order.id}
                order={order}
                onEditClick={onEditClick}
                onSimpleProcessClick={onSimpleProcessClick}
                onMarkReadyClick={handleMarkReadyClick}
                onRefresh={onRefresh}
                markReadyBusy={markReadyBusyId === order.id}
                markReadySuccess={markReadySuccessId === order.id}
                index={index}
                selectedOrderId={selectedOrderId}
                nowMs={nowMs}
                tenantOrgId={tenantOrgId}
                opsZone={zoneFor(order.branch_id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <SharedMarkReadyDialog
        order={markReadyOrder}
        onClose={handleMarkReadyClose}
        onBusy={handleMarkReadyBusy}
        onSuccess={handleMarkReadySuccess}
      />
    </>
  );
}

interface OrderRowProps {
  order: ProcessingOrder;
  onEditClick?: (orderId: string) => void;
  onSimpleProcessClick?: (orderId: string) => void;
  onMarkReadyClick: (order: ProcessingOrder) => void;
  onRefresh: () => void;
  markReadyBusy: boolean;
  markReadySuccess: boolean;
  index: number;
  selectedOrderId?: string | null;
  nowMs: number;
  tenantOrgId?: string | null;
  opsZone: string | null;
}

const OrderRow = React.memo(function OrderRow({
  order,
  onEditClick,
  onSimpleProcessClick,
  onMarkReadyClick,
  onRefresh,
  markReadyBusy,
  markReadySuccess,
  index,
  selectedOrderId,
  nowMs,
  tenantOrgId,
  opsZone,
}: OrderRowProps) {
  const t = useTranslations('processing.table');
  const tProcessing = useTranslations('processing');
  const tStatus = useTranslations('processing.status');
  const locale = useLocale();
  const getBilingual = useBilingual();
  const { formatMoneyWithCode } = useTenantCurrency();
  const prefetchProcessingDialogs = useProcessingDialogPrefetch();

  const isSelected = selectedOrderId === order.id;
  const slaState = getSlaState(order.ready_by_at, nowMs, opsZone);
  const priorityBadge = getPriorityBadgeInfo(order.priority, t);
  const paymentBadge = getPaymentBadgeInfo(order, t);
  const localizedStatus = getLocalizedStatusLabel(order.current_status, tStatus);

  const totalItems = Math.max(0, order.total_items || 0);
  const readyCount = Math.min(totalItems, Math.max(0, order.quantity_ready || 0));
  const progressPercent = totalItems > 0 ? Math.round((readyCount / totalItems) * 100) : 0;
  const extraItemsCount = Math.max(0, (order.items_count ?? order.items.length) - order.items.length);

  const displayCustomerName = getBilingual(order.customer_name, order.customer_name2) || order.customer_name;
  const secondaryCustomerName =
    locale === 'ar'
      ? order.customer_name2 && order.customer_name && order.customer_name2 !== order.customer_name
        ? order.customer_name
        : null
      : order.customer_name2 && order.customer_name2 !== order.customer_name
        ? order.customer_name2
        : null;

  const rowHighlight = priorityBadge
    ? 'border-s-4 border-s-primary'
    : slaState === 'overdue'
      ? 'border-s-4 border-s-destructive'
      : 'border-s-4 border-s-transparent';

  const rowBg = isSelected
    ? 'bg-success-bg/60'
    : markReadySuccess
      ? 'bg-success-bg/40'
      : index % 2 === 1
        ? 'bg-muted/25'
        : 'bg-card';

  const orderDetailsHref = `/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/processing')}`;

  return (
    <TableRow className={`${rowBg} ${rowHighlight} transition-colors`}>
      {/* Order & Priority & Issues */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <CmxCodeChip code={order.order_no} kind="order" size="sm" />
            <OrderIssueRowActions
              orderId={order.id}
              scopeLevel={ORDER_ISSUE_SCOPE.ORDER}
              openCount={order.has_issue ? 1 : 0}
              totalCount={order.issue_total_count ?? (order.has_issue ? 1 : 0)}
              hasOpenIssue={order.has_issue}
              onChanged={onRefresh}
            />
          </div>
          {priorityBadge && (
            <div>
              <CmxStatusBadge label={priorityBadge.label} tone={priorityBadge.tone} size="sm" />
            </div>
          )}
        </div>
      </TableCell>

      {/* Ready By & SLA */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium leading-tight tabular-nums text-foreground">
            {formatProcessingDate(order.ready_by_at, locale, opsZone)}
          </span>
          {slaState && (
            <div>
              <CmxStatusBadge
                size="sm"
                tone={slaState === 'overdue' ? 'danger' : slaState === 'dueSoon' ? 'warning' : 'info'}
                label={
                  slaState === 'overdue'
                    ? t('slaOverdue')
                    : slaState === 'dueSoon'
                      ? t('slaDueSoon')
                      : t('slaToday')
                }
              />
            </div>
          )}
        </div>
      </TableCell>

      {/* Customer */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-foreground sm:text-sm" title={displayCustomerName}>
            {displayCustomerName}
          </div>
          {secondaryCustomerName && (
            <div className="truncate text-xs text-muted-foreground" title={secondaryCustomerName}>
              {secondaryCustomerName}
            </div>
          )}
          {order.customer_phone && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
              <bdi dir="ltr">{order.customer_phone}</bdi>
            </div>
          )}
        </div>
      </TableCell>

      {/* Items Preview & Details Link */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top">
        <div className="min-w-0 space-y-1">
          {order.items.map((item, idx) => {
            const itemName = getBilingual(item.product_name, item.product_name2) || item.product_name;
            return (
              <div key={idx} className="text-xs leading-snug">
                <div className="flex items-baseline gap-1">
                  <span className="truncate font-medium text-foreground" title={itemName}>
                    {itemName}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">× {item.quantity}</span>
                </div>
                {(item.service_name || item.color || item.brand || item.has_stain || item.has_damage) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {item.service_name && (
                      <span className="rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary">
                        {item.service_name}
                      </span>
                    )}
                    {item.color && (
                      <span className="rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                        {item.color}
                      </span>
                    )}
                    {item.brand && (
                      <span className="rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                        {item.brand}
                      </span>
                    )}
                    {item.has_stain && (
                      <CmxStatusBadge label={t('stain')} tone="warning" size="sm" />
                    )}
                    {item.has_damage && (
                      <CmxStatusBadge label={t('damage')} tone="danger" size="sm" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {extraItemsCount > 0 && (
            <div className="text-xs font-medium text-muted-foreground tabular-nums">
              +{extraItemsCount} {t('moreItems')}
            </div>
          )}
          <div className="pt-0.5">
            <OrderDetailsLink
              tenantOrgId={tenantOrgId}
              orderId={order.id}
              orderNo={order.order_no}
              returnUrl="/dashboard/processing"
              returnLabel={tProcessing('backToProcessing')}
              className="text-xs font-medium text-primary-text hover:underline"
            >
              {t('details')}
            </OrderDetailsLink>
          </div>
        </div>
      </TableCell>

      {/* Pieces & Progress */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top text-end">
        <div
          className="ms-auto w-full max-w-[5.75rem] space-y-1 text-end"
          title={`${t('piecesReadyCount', { ready: readyCount, total: totalItems })} (${progressPercent}%)`}
        >
          <div className="flex items-center justify-between gap-1 text-xs tabular-nums">
            <span className="font-semibold text-foreground">{totalItems}</span>
            <span className="text-muted-foreground">
              <bdi dir="ltr" className="inline-block tabular-nums">
                {readyCount}/{totalItems} ({progressPercent}%)
              </bdi>
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('piecesReadyCount', { ready: readyCount, total: totalItems })}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>
      </TableCell>

      {/* Notes */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top">
        <div className="truncate text-xs text-muted-foreground" title={order.notes || undefined}>
          {order.notes || '—'}
        </div>
      </TableCell>

      {/* Total & Payment */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top text-end">
        <div className="flex flex-col items-end gap-1">
          <bdi dir="ltr" className="whitespace-nowrap text-xs font-semibold tabular-nums text-foreground sm:text-sm">
            {formatMoneyWithCode(order.total)}
          </bdi>
          <CmxStatusBadge label={paymentBadge.label} tone={paymentBadge.tone} size="sm" />
        </div>
      </TableCell>

      {/* Status & Streamlined Actions */}
      <TableCell rowHeight="compact" className="px-2 py-2 align-top text-end">
        <div className="flex flex-col items-end gap-1.5">
          <CmxStatusBadge label={localizedStatus} tone="info" size="sm" />

          <div className="flex items-center justify-end gap-1">
            <CmxButton
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => onSimpleProcessClick?.(order.id)}
              onMouseEnter={() => prefetchProcessingDialogs(order.id)}
              disabled={!onSimpleProcessClick}
              title={t('simpleProcess')}
              aria-label={t('simpleProcess')}
              className="px-2 pointer-coarse:min-h-11"
            >
              <ListChecks className="h-3.5 w-3.5 2xl:me-1" aria-hidden />
              <span className="hidden 2xl:inline">{t('simpleProcess')}</span>
            </CmxButton>

            <CmxButton
              type="button"
              size="xs"
              variant="outline"
              onClick={() => onMarkReadyClick(order)}
              disabled={markReadyBusy}
              loading={markReadyBusy}
              title={t('complete')}
              aria-label={t('complete')}
              className="border-success-border px-2 text-success-text hover:bg-success-bg pointer-coarse:min-h-11"
            >
              {!markReadyBusy && <CheckCircle className="h-3.5 w-3.5" aria-hidden />}
            </CmxButton>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <CmxButton
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-label={t('moreActions')}
                  title={t('moreActions')}
                  className="px-1.5 pointer-coarse:min-h-11"
                >
                  <MoreVertical className="h-3.5 w-3.5" aria-hidden />
                </CmxButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEditClick && (
                  <DropdownMenuItem
                    onSelect={() => onEditClick(order.id)}
                    onMouseEnter={() => prefetchProcessingDialogs(order.id)}
                  >
                    <SquarePen className="h-4 w-4" aria-hidden />
                    <span>{t('edit')}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/processing/${order.id}`}>
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    <span>{t('viewProcessingDetails')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={orderDetailsHref}>
                    <FileText className="h-4 w-4" aria-hidden />
                    <span>{t('details')}</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
});

/**
 * Single shared Mark Ready confirm dialog for desktop and mobile.
 * @param props Dialog state and lifecycle callbacks.
 */
function SharedMarkReadyDialog(props: {
  order: ProcessingOrder | null;
  onClose: () => void;
  onBusy: (orderId: string | null) => void;
  onSuccess: (orderId: string) => void;
}) {
  const { order, onClose, onBusy, onSuccess } = props;
  return (
    <CmxDialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      {order ? (
        <SharedMarkReadyDialogContent
          key={order.id}
          order={order}
          onClose={onClose}
          onBusy={onBusy}
          onSuccess={onSuccess}
        />
      ) : null}
    </CmxDialog>
  );
}

function SharedMarkReadyDialogContent({
  order,
  onClose,
  onBusy,
  onSuccess,
}: {
  order: ProcessingOrder;
  onClose: () => void;
  onBusy: (orderId: string | null) => void;
  onSuccess: (orderId: string) => void;
}) {
  const t = useTranslations('processing.table');
  const tDetail = useTranslations('processing.detail');
  const tCommon = useTranslations('common');
  const profileStaffMessage = useWorkflowProfileStaffMessage();
  const [isLoading, setIsLoading] = useState(false);
  const [rackLocation, setRackLocation] = useState('');
  const [rackLocationError, setRackLocationError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleConfirm = async () => {
    const rack = rackLocation.trim();
    if (!rack) {
      setRackLocationError(tDetail('validation.rackLocationRequired'));
      return;
    }

    const orderId = order.id;
    onBusy(orderId);
    setIsLoading(true);
    setSubmitError('');

    try {
      const availRes = await fetch(
        `/api/v1/orders/${orderId}/available-actions?screen=processing`,
      );
      const availJson = await availRes.json().catch(() => ({}));
      if (!availRes.ok || !availJson.success) {
        throw new Error(
          profileStaffMessage(availJson.code, availJson.error || t('markReadyError')) ||
            t('markReadyError'),
        );
      }
      const payload = availJson.data ?? availJson;
      const expectedStateVersion = Number(payload.stateVersion ?? 0);
      const result = await postStaffWorkflowCommand({
        orderId,
        screen: 'processing',
        actionCode: WORKFLOW_ACTIONS.COMPLETE_PROCESSING,
        expectedStateVersion,
        input: { rackLocation: rack },
      });

      if (result.ok && result.success) {
        onSuccess(orderId);
        return;
      }

      const errMsg = profileStaffMessage(result.code, result.error) || result.error || t('markReadyError');
      setSubmitError(errMsg);
      cmxMessage.error(t('markReadyError'), { description: errMsg, duration: 5000 });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : t('markReadyError');
      setSubmitError(errMsg);
      cmxMessage.error(t('markReadyError'), { description: errMsg, duration: 5000 });
    } finally {
      onBusy(null);
      setIsLoading(false);
    }
  };

  return (
    <CmxDialogContent className="max-w-md">
      <CmxDialogHeader>
        <CmxDialogTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning-text" aria-hidden />
          {t('confirmMarkReady')}
        </CmxDialogTitle>
        <CmxDialogDescription>
          {t('confirmMarkReadyMessage', { orderNo: order.order_no })}
        </CmxDialogDescription>
      </CmxDialogHeader>

      <div className="space-y-3 py-3">
        {submitError && (
          <CmxSummaryMessage type="error" title={t('markReadyError')} items={[submitError]} />
        )}

        <div className="space-y-2">
          <Label htmlFor="rack-location" className="block text-sm font-medium text-foreground">
            {t('rackLocation')}
            <span className="ms-1 text-danger-text" aria-hidden="true">*</span>
          </Label>
          <CmxInput
            id="rack-location"
            value={rackLocation}
            onChange={(e) => {
              setRackLocation(e.target.value);
              setRackLocationError('');
              setSubmitError('');
            }}
            placeholder={tDetail('rackLocationPlaceholder')}
            error={rackLocationError || undefined}
            disabled={isLoading}
            required
          />
          <p className="text-xs text-muted-foreground">{tDetail('rackLocationHelp')}</p>
        </div>
      </div>

      <CmxDialogFooter>
        <CmxButton variant="secondary" onClick={onClose} disabled={isLoading}>
          {tCommon('cancel')}
        </CmxButton>
        <CmxButton
          variant="primary"
          onClick={handleConfirm}
          disabled={isLoading || !rackLocation.trim()}
          loading={isLoading}
        >
          {isLoading ? t('processing') : t('confirmReady')}
        </CmxButton>
      </CmxDialogFooter>
    </CmxDialogContent>
  );
}

/** Mobile Card View Component (shown on < md viewports via CSS). */
function ProcessingOrderCard(props: {
  order: ProcessingOrder;
  onEditClick?: (orderId: string) => void;
  onSimpleProcessClick?: (orderId: string) => void;
  onMarkReadyClick: (order: ProcessingOrder) => void;
  onRefresh: () => void;
  markReadyBusy: boolean;
  markReadySuccess: boolean;
  selectedOrderId?: string | null;
  nowMs: number;
  tenantOrgId?: string | null;
  opsZone: string | null;
}) {
  const {
    order,
    onEditClick,
    onSimpleProcessClick,
    onMarkReadyClick,
    onRefresh,
    markReadyBusy,
    markReadySuccess,
    selectedOrderId,
    nowMs,
    tenantOrgId,
    opsZone,
  } = props;
  const t = useTranslations('processing.table');
  const tProcessing = useTranslations('processing');
  const tStatus = useTranslations('processing.status');
  const locale = useLocale();
  const getBilingual = useBilingual();
  const { formatMoneyWithCode } = useTenantCurrency();
  const prefetchProcessingDialogs = useProcessingDialogPrefetch();

  const isSelected = selectedOrderId === order.id;
  const slaState = getSlaState(order.ready_by_at, nowMs, opsZone);
  const priorityBadge = getPriorityBadgeInfo(order.priority, t);
  const paymentBadge = getPaymentBadgeInfo(order, t);
  const localizedStatus = getLocalizedStatusLabel(order.current_status, tStatus);

  const totalItems = Math.max(0, order.total_items || 0);
  const readyCount = Math.min(totalItems, Math.max(0, order.quantity_ready || 0));
  const progressPercent = totalItems > 0 ? Math.round((readyCount / totalItems) * 100) : 0;
  const extraItemsCount = Math.max(0, (order.items_count ?? order.items.length) - order.items.length);
  const displayCustomerName = getBilingual(order.customer_name, order.customer_name2) || order.customer_name;

  const cardBorder = isSelected
    ? 'border-success-border bg-success-bg/50'
    : priorityBadge
      ? 'border-border border-s-4 border-s-primary bg-card'
      : 'border-border bg-card';

  return (
    <div className={`rounded-lg border p-4 ${cardBorder}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <CmxCodeChip code={order.order_no} kind="order" size="md" />
            <OrderIssueRowActions
              orderId={order.id}
              scopeLevel={ORDER_ISSUE_SCOPE.ORDER}
              openCount={order.has_issue ? 1 : 0}
              totalCount={order.issue_total_count ?? (order.has_issue ? 1 : 0)}
              hasOpenIssue={order.has_issue}
              onChanged={onRefresh}
            />
            {priorityBadge && (
              <CmxStatusBadge label={priorityBadge.label} tone={priorityBadge.tone} size="sm" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{displayCustomerName}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{formatProcessingDate(order.ready_by_at, locale, opsZone)}</span>
            {slaState && (
              <CmxStatusBadge
                size="sm"
                tone={slaState === 'overdue' ? 'danger' : slaState === 'dueSoon' ? 'warning' : 'info'}
                label={
                  slaState === 'overdue'
                    ? t('slaOverdue')
                    : slaState === 'dueSoon'
                      ? t('slaDueSoon')
                      : t('slaToday')
                }
              />
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <CmxStatusBadge label={localizedStatus} tone="info" size="sm" />
          <CmxStatusBadge label={paymentBadge.label} tone={paymentBadge.tone} size="sm" />
        </div>
      </div>

      {/* Items */}
      <div className="mb-3 space-y-1.5">
        {order.items.slice(0, 2).map((item, idx) => {
          const itemName = getBilingual(item.product_name, item.product_name2) || item.product_name;
          return (
            <div key={idx} className="text-sm">
              <div className="font-medium text-foreground">
                {itemName}{' '}
                <span className="tabular-nums text-muted-foreground">× {item.quantity}</span>
              </div>
              {(item.has_stain || item.has_damage) && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {item.has_stain && <CmxStatusBadge label={t('stain')} tone="warning" size="sm" />}
                  {item.has_damage && <CmxStatusBadge label={t('damage')} tone="danger" size="sm" />}
                </div>
              )}
            </div>
          );
        })}
        {extraItemsCount > 0 && (
          <div className="text-xs text-muted-foreground tabular-nums">
            +{extraItemsCount} {t('moreItems')}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs tabular-nums">
          <span className="font-medium text-foreground">{tProcessing('progress')}</span>
          <span className="font-medium text-foreground">
            {t('piecesReadyCount', { ready: readyCount, total: totalItems })} ({progressPercent}%)
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('piecesReadyCount', { ready: readyCount, total: totalItems })}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progressPercent === 100 ? 'bg-success' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm tabular-nums">
        <div>
          <span className="text-muted-foreground">{t('pcs')}: </span>
          <span className="font-medium">{totalItems}</span>
        </div>
        <div className="text-end">
          <span className="text-muted-foreground">{t('total')}: </span>
          <span className="font-semibold">{formatMoneyWithCode(order.total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <CmxButton
          type="button"
          size="sm"
          variant="primary"
          onClick={() => onSimpleProcessClick?.(order.id)}
          onMouseEnter={() => prefetchProcessingDialogs(order.id)}
          disabled={!onSimpleProcessClick}
        >
          <ListChecks className="me-1.5 h-4 w-4" aria-hidden />
          {t('simpleProcess')}
        </CmxButton>

        <CmxButton
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onMarkReadyClick(order)}
          disabled={markReadyBusy}
          loading={markReadyBusy}
          className="border-success-border text-success-text hover:bg-success-bg"
        >
          {!markReadyBusy && <CheckCircle className="me-1.5 h-4 w-4" aria-hidden />}
          {t('complete')}
        </CmxButton>

        {onEditClick && (
          <CmxButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onEditClick(order.id)}
            onMouseEnter={() => prefetchProcessingDialogs(order.id)}
          >
            <SquarePen className="me-1.5 h-4 w-4" aria-hidden />
            {t('edit')}
          </CmxButton>
        )}

        <CmxButton size="sm" variant="ghost" asChild>
          <Link href={`/dashboard/processing/${order.id}`}>
            <ExternalLink className="me-1.5 h-4 w-4" aria-hidden />
            {t('viewProcessingDetails')}
          </Link>
        </CmxButton>
      </div>

      <div className="mt-2 text-center">
        <OrderDetailsLink
          tenantOrgId={tenantOrgId}
          orderId={order.id}
          orderNo={order.order_no}
          returnUrl="/dashboard/processing"
          returnLabel={tProcessing('backToProcessing')}
          className="text-xs font-medium text-primary-text hover:underline"
        >
          {t('details')}
        </OrderDetailsLink>
      </div>

      {markReadySuccess && (
        <p className="mt-2 text-center text-xs font-medium text-success-text">
          {t('markReadySuccess')}
        </p>
      )}
    </div>
  );
}
