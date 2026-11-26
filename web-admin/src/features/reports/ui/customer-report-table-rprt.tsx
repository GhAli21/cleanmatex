'use client';

import { CmxButton } from '@ui/primitives';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReportInstantDay } from '@features/reports/ui/reports-clock';
import type { CustomerRow, ReportPagination } from '@/lib/types/report-types';

interface CustomerReportTableProps {
  customers: CustomerRow[];
  pagination: ReportPagination;
  currencyCode: string;
  basePath: string;
}

/**
 *
 * @param root0
 * @param root0.customers
 * @param root0.pagination
 * @param root0.currencyCode
 * @param root0.basePath
 */
export default function CustomerReportTable({
  customers,
  pagination,
  currencyCode,
  basePath,
}: CustomerReportTableProps) {
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
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.customer')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.phone')}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('table.totalOrders')}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('table.totalRevenue')}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('table.avgOrderValue')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.lastOrder')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('table.firstOrder')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((cust) => (
              <tr
                key={cust.id}
                className="cursor-pointer hover:bg-muted"
                onClick={() => router.push(`/dashboard/customers/${cust.id}`)}
              >
                <td className="px-4 py-3 font-medium text-foreground">{cust.name}</td>
                <td className="px-4 py-3 text-foreground">{cust.phone ?? '-'}</td>
                <td className="px-4 py-3 text-end text-foreground">{cust.totalOrders}</td>
                <td className="px-4 py-3 text-end font-medium text-foreground">
                  {currencyCode} {cust.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-end text-foreground">
                  {currencyCode} {cust.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <ReportInstantDay value={cust.lastOrderDate} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <ReportInstantDay value={cust.firstOrderDate} />
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
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
