'use client';

import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
import { CmxButton, CmxSelect, Label } from '@ui/primitives';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { OrderRow, ReportPagination } from '@/lib/types/report-types';

interface OrdersReportTableProps {
  orders: OrderRow[];
  pagination: ReportPagination;
  currencyCode: string;
  basePath: string;
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  completed: 'bg-success-bg text-success-text',
  delivered: 'bg-info-bg text-info-text',
  processing: 'bg-warning-bg text-warning-text',
  pending: 'bg-muted text-foreground',
  cancelled: 'bg-danger-bg text-danger-text',
  intake: 'bg-info-bg text-info-text',
  preparing: 'bg-info-bg text-info-text',
  ready: 'bg-info-bg text-info-text',
  ready_for_pickup: 'bg-info-bg text-info-text',
  draft: 'bg-muted text-muted-foreground',
};

const PAYMENT_BADGE_COLORS: Record<string, string> = {
  paid: 'bg-success-bg text-success-text',
  partial: 'bg-warning-bg text-warning-text',
  pending: 'bg-muted text-foreground',
};

/**
 *
 * @param root0
 * @param root0.orders
 * @param root0.pagination
 * @param root0.currencyCode
 * @param root0.basePath
 */
export default function OrdersReportTable({
  orders,
  pagination,
  currencyCode,
  basePath,
}: OrdersReportTableProps) {
  const t = useTranslations('reports');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(newPage));
      router.push(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath],
  );

  const handleSort = useCallback(
    (field: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const currentSort = params.get('sortBy');
      const currentOrder = params.get('sortOrder') || 'desc';
      const newOrder = currentSort === field && currentOrder === 'asc' ? 'desc' : 'asc';
      params.set('sortBy', field);
      params.set('sortOrder', newOrder);
      params.set('page', '1');
      router.push(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath],
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('limit', String(newLimit));
      params.set('page', '1');
      router.push(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath],
  );

  const PAGE_SIZES = [10, 20, 50, 100] as const;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 text-start font-medium text-muted-foreground hover:bg-muted"
                onClick={() => handleSort('order_no')}
              >
                {t('table.orderNo')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t('table.customer')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-start font-medium text-muted-foreground hover:bg-muted"
                onClick={() => handleSort('status')}
              >
                {t('table.status')}
              </th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                {t('table.items')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-end font-medium text-muted-foreground hover:bg-muted"
                onClick={() => handleSort('total')}
              >
                {t('table.total')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t('table.paymentStatus')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-start font-medium text-muted-foreground hover:bg-muted"
                onClick={() => handleSort('created_at')}
              >
                {t('table.date')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer hover:bg-muted"
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
              >
                <td className="px-4 py-3 font-medium text-primary-text">
                  <CmxCodeChip code={order.orderNo} kind="order" />
                </td>
                <td className="px-4 py-3 text-foreground">
                  {order.customerName}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_COLORS[order.status] ?? 'bg-muted text-foreground'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-end text-foreground">
                  {order.totalItems}
                </td>
                <td className="px-4 py-3 text-end font-medium text-foreground">
                  {currencyCode} {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_BADGE_COLORS[order.paymentStatus] ?? 'bg-muted text-foreground'}`}>
                    {order.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '-'}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {t('noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination: always show when there is data or total count so user sees position and can change page size */}
      {(pagination.total > 0 || orders.length === 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-nowrap">
          <span className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="orders-report-limit" className="whitespace-nowrap text-sm text-muted-foreground">
                {t('pagination.rowsPerPage')}
              </Label>
              <CmxSelect
                id="orders-report-limit"
                value={String(pagination.limit)}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="w-20"
                options={PAGE_SIZES.map((size) => ({
                  value: String(size),
                  label: String(size),
                }))}
              />
            </div>
            <div className="flex items-center gap-1">
              <CmxButton
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                aria-label={tCommon('previous')}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </CmxButton>
              <span className="min-w-[4rem] px-2 py-1 text-center text-sm font-medium text-foreground tabular-nums">
                {pagination.page} / {Math.max(1, pagination.totalPages)}
              </span>
              <CmxButton
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                aria-label={tCommon('next')}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </CmxButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
