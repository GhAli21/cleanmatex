/**
 * Invoices List Page
 *
 * Displays a paginated, filterable list of invoices for the current tenant.
 * Uses Prisma-based invoice service with strict tenant isolation.
 * Route: /dashboard/billing/invoices
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  listInvoices,
  getInvoiceStats,
} from '@/lib/services/invoice-service';

type InvoicesSearchParams = {
  page?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
};

interface PageProps {
  searchParams?: Promise<InvoicesSearchParams>;
}

const INVOICES_BASE = '/dashboard/billing/invoices';

export default async function InvoicesPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices');
  const tCommon = await getTranslations('common');

  const resolvedSearchParams = await searchParams;
  const params: InvoicesSearchParams = resolvedSearchParams ?? {};

  let tenantOrgId: string;
  try {
    const authContext = await getAuthContext();
    tenantOrgId = authContext.tenantId;
  } catch (error) {
    console.error('[InvoicesPage] Auth error:', error);
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Authentication failed. Please log in again.'}
        </div>
      </div>
    );
  }

  const page =
    params.page && !Number.isNaN(Number.parseInt(params.page, 10))
      ? Number.parseInt(params.page, 10)
      : 1;

  const parseDate = (value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  const filters = {
    tenantOrgId,
    status: params.status as any,
    dateFrom: parseDate(params.fromDate),
    dateTo: parseDate(params.toDate),
    limit: 20,
    offset: (page - 1) * 20,
  };

  const [invoicesResult, stats] = await Promise.all([
    listInvoices(filters),
    getInvoiceStats(tenantOrgId),
  ]);

  const totalPages = Math.ceil((invoicesResult.total || 0) / 20);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-gray-600">{t('subtitle')}</p>
        </div>
      </div>

      {/* Simple stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">{t('stats.total')}</div>
            <div className="mt-1 text-2xl font-bold">
              {stats.total_invoices}
            </div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="text-sm text-gray-600">{t('stats.paid')}</div>
            <div className="mt-1 text-2xl font-bold text-green-700">
              {stats.paid_invoices}
            </div>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="text-sm text-gray-600">{t('stats.pending')}</div>
            <div className="mt-1 text-2xl font-bold text-yellow-700">
              {stats.pending_invoices}
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-sm text-gray-600">{t('stats.overdue')}</div>
            <div className="mt-1 text-2xl font-bold text-red-700">
              {stats.overdue_invoices}
            </div>
          </div>
        </div>
      )}

      {/* Invoices table */}
      <Suspense fallback={<div>{tCommon('loading')}</div>}>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t('columns.invoiceNo')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t('columns.orderNo')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t('columns.total')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t('columns.paid')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t('columns.balance')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t('columns.status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {invoicesResult.invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                invoicesResult.invoices.map((invoice) => {
                  const balance =
                    Number(invoice.total) - Number(invoice.paid_amount);
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {invoice.invoice_no}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {invoice.order_id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {Number(invoice.total).toFixed(3)} OMR
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-green-700">
                        {Number(invoice.paid_amount).toFixed(3)} OMR
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-orange-700">
                        {balance.toFixed(3)} OMR
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                          {invoice.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Link
                          href={`${INVOICES_BASE}/${invoice.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {tCommon('view')}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Simple pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
              <div>
                {t('pagination.pageOf', { page, totalPages })}
              </div>
              <div className="space-x-2">
                {page > 1 && (
                  <Link
                    href={`${INVOICES_BASE}?page=${page - 1}`}
                    className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
                  >
                    {tCommon('previous')}
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`${INVOICES_BASE}?page=${page + 1}`}
                    className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
                  >
                    {tCommon('next')}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </Suspense>
    </div>
  );
}
