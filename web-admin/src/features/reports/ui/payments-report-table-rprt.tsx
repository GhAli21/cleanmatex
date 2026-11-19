'use client';

import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { PaymentRow, ReportPagination } from '@/lib/types/report-types';

interface PaymentsReportTableProps {
  payments: PaymentRow[];
  pagination: ReportPagination;
  basePath: string;
}

// Canonical `org_order_payments_dtl.payment_status` lifecycle codes (ADR-002).
const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-success-bg text-success-text',
  CAPTURED: 'bg-success-bg text-success-text',
  SETTLED: 'bg-success-bg text-success-text',
  PENDING: 'bg-warning-bg text-warning-text',
  PROCESSING: 'bg-warning-bg text-warning-text',
  CAPTURE_PENDING: 'bg-warning-bg text-warning-text',
  AUTHORIZED: 'bg-info-bg text-info-text',
  FAILED: 'bg-danger-bg text-danger-text',
  CANCELLED: 'bg-danger-bg text-danger-text',
  EXPIRED: 'bg-danger-bg text-danger-text',
  VOIDED: 'bg-danger-bg text-danger-text',
  REFUSED: 'bg-danger-bg text-danger-text',
  REVERSED: 'bg-info-bg text-info-text',
};

/**
 *
 * @param root0
 * @param root0.payments
 * @param root0.pagination
 * @param root0.basePath
 */
export default function PaymentsReportTable({
  payments,
  pagination,
  basePath,
}: PaymentsReportTableProps) {
  const t = useTranslations('reports');
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

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.orderNo')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.invoiceNo')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.customer')}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('table.amount')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.method')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.status')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.date')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-muted">
                <td className="px-4 py-3 font-medium text-primary-text">{p.orderNo ? <CmxCodeChip code={p.orderNo} kind="order" /> : '-'}</td>
                <td className="px-4 py-3 text-foreground">{p.invoiceNo ?? '-'}</td>
                <td className="px-4 py-3 text-foreground">{p.customerName ?? '-'}</td>
                <td className="px-4 py-3 text-end font-medium text-foreground">
                  {p.currencyCode} {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-foreground">{p.methodName ?? p.methodCode}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? 'bg-muted text-foreground'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.paidAt ? format(new Date(p.paidAt), 'dd MMM yyyy') : '-'}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t('noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 text-sm font-medium text-foreground">{pagination.page} / {pagination.totalPages}</span>
            <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
