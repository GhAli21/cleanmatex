/**
 * Invoices List Page
 *
 * Displays a paginated, filterable list of invoices for the current tenant.
 * Uses Prisma-based invoice service with strict tenant isolation.
 * Route: /dashboard/billing/invoices
 */

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { listInvoices, getInvoiceStats } from '@/lib/services/invoice-service';
import InvoiceFiltersBar from '@features/billing/ui/invoice-filters-bar';
import InvoicesTable from '@features/billing/ui/invoices-table';

type InvoicesSearchParams = {
  page?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
};

interface PageProps {
  searchParams?: Promise<InvoicesSearchParams>;
}

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
    searchQuery: params.search?.trim(),
    sortBy: params.sortBy,
    sortOrder: (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
    limit: 20,
    offset: (page - 1) * 20,
  };

  const [invoicesResult, stats] = await Promise.all([
    listInvoices(filters),
    getInvoiceStats(tenantOrgId),
  ]);

  const pagination = {
    page,
    limit: 20,
    totalCount: invoicesResult.total,
    totalPages: invoicesResult.totalPages ?? Math.ceil((invoicesResult.total || 0) / 20),
  };

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

      <InvoiceFiltersBar />

      <Suspense fallback={<div>{tCommon('loading')}</div>}>
        <InvoicesTable
          invoices={invoicesResult.invoices}
          pagination={pagination}
          sortBy={params.sortBy || 'created_at'}
          sortOrder={params.sortOrder === 'asc' ? 'asc' : 'desc'}
        />
      </Suspense>
    </div>
  );
}
