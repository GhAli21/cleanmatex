'use client';

import { CmxButton } from '@ui/primitives';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { ReportCivilDay } from '@features/reports/ui/reports-clock';
import type { InvoiceRow, ReportPagination } from '@/lib/types/report-types';

interface InvoicesReportTableProps {
  invoices: InvoiceRow[];
  pagination: ReportPagination;
  currencyCode: string;
  basePath: string;
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-success-bg text-success-text',
  partial: 'bg-warning-bg text-warning-text',
  pending: 'bg-muted text-foreground',
  overdue: 'bg-danger-bg text-danger-text',
  draft: 'bg-muted text-muted-foreground',
  cancelled: 'bg-danger-bg text-danger-text',
};

/**
 *
 * @param root0
 * @param root0.invoices
 * @param root0.pagination
 * @param root0.currencyCode
 * @param root0.basePath
 */
export default function InvoicesReportTable({
  invoices,
  pagination,
  currencyCode,
  basePath,
}: InvoicesReportTableProps) {
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

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.invoiceNo')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.customer')}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('table.total')}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('table.paid')}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('table.balance')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.status')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.dueDate')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className="cursor-pointer hover:bg-muted"
                onClick={() => router.push(`/dashboard/internal_fin/invoices/${inv.id}`)}
              >
                <td className="px-4 py-3 font-medium text-primary-text">{inv.invoiceNo}</td>
                <td className="px-4 py-3 text-foreground">{inv.customerName ?? '-'}</td>
                <td className="px-4 py-3 text-end text-foreground">
                  {currencyCode} {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-end text-success-text">
                  {currencyCode} {inv.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-end font-medium text-foreground">
                  {currencyCode} {inv.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[inv.status] ?? 'bg-muted text-foreground'}`}>
                      {inv.status}
                    </span>
                    {inv.isOverdue && (
                      <AlertTriangle className="h-3.5 w-3.5 text-danger-text" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <ReportCivilDay value={inv.dueDate} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
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
            <CmxButton type="button" variant="ghost" size="icon" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} aria-label={tCommon('previous')}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </CmxButton>
            <span className="px-3 py-1 text-sm font-medium text-foreground">{pagination.page} / {pagination.totalPages}</span>
            <CmxButton type="button" variant="ghost" size="icon" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} aria-label={tCommon('next')}>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </CmxButton>
          </div>
        </div>
      )}
    </div>
  );
}
