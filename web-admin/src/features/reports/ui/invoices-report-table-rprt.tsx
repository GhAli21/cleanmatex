'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { InvoiceRow, ReportPagination } from '@/lib/types/report-types';

interface InvoicesReportTableProps {
  invoices: InvoiceRow[];
  pagination: ReportPagination;
  currencyCode: string;
  basePath: string;
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-gray-100 text-gray-800',
  overdue: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
};

export default function InvoicesReportTable({
  invoices,
  pagination,
  currencyCode,
  basePath,
}: InvoicesReportTableProps) {
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
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-gray-600">{t('table.invoiceNo')}</th>
              <th className="px-4 py-3 text-start font-medium text-gray-600">{t('table.customer')}</th>
              <th className="px-4 py-3 text-end font-medium text-gray-600">{t('table.total')}</th>
              <th className="px-4 py-3 text-end font-medium text-gray-600">{t('table.paid')}</th>
              <th className="px-4 py-3 text-end font-medium text-gray-600">{t('table.balance')}</th>
              <th className="px-4 py-3 text-start font-medium text-gray-600">{t('table.status')}</th>
              <th className="px-4 py-3 text-start font-medium text-gray-600">{t('table.dueDate')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => router.push(`/dashboard/billing/invoices/${inv.id}`)}
              >
                <td className="px-4 py-3 font-medium text-blue-600">{inv.invoiceNo}</td>
                <td className="px-4 py-3 text-gray-900">{inv.customerName ?? '-'}</td>
                <td className="px-4 py-3 text-end text-gray-900">
                  {currencyCode} {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-end text-green-700">
                  {currencyCode} {inv.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-end font-medium text-gray-900">
                  {currencyCode} {inv.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {inv.status}
                    </span>
                    {inv.isOverdue && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {inv.dueDate ? format(new Date(inv.dueDate), 'dd MMM yyyy') : '-'}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t('noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-600">
            {t('pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 text-sm font-medium text-gray-700">{pagination.page} / {pagination.totalPages}</span>
            <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
