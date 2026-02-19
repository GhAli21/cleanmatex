/**
 * Payments List Page
 *
 * Displays a paginated, filterable list of payment transactions for the current tenant.
 * Uses Prisma-based payment service with strict tenant isolation.
 * Route: /dashboard/billing/payments
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { listPayments, getPaymentStats } from '@/app/actions/payments/payment-list-actions';
import PaymentStatsCards from '@features/billing/ui/payment-stats-cards';
import PaymentFiltersBar from '@features/billing/ui/payment-filters-bar';
import PaymentsTable from '@features/billing/ui/payments-table';

type PaymentsSearchParams = {
  page?: string;
  status?: string;
  method?: string;
  kind?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
};

interface PageProps {
  searchParams?: Promise<PaymentsSearchParams>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const t = await getTranslations('payments');
  const tCommon = await getTranslations('common');

  const resolvedSearchParams = await searchParams;
  const params: PaymentsSearchParams = resolvedSearchParams ?? {};

  // Verify authentication and get tenant context
  let tenantOrgId: string;
  try {
    const authContext = await getAuthContext();
    tenantOrgId = authContext.tenantId;
  } catch (error) {
    console.error('[PaymentsPage] Auth error:', error);
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error
            ? error.message
            : 'Authentication failed. Please log in again.'}
        </div>
      </div>
    );
  }

  // Parse page number
  const page =
    params.page && !Number.isNaN(Number.parseInt(params.page, 10))
      ? Number.parseInt(params.page, 10)
      : 1;

  // Parse sort params
  const sortBy = params.sortBy || 'paid_at';
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  // Build filters
  const filters = {
    page,
    limit: 20,
    status: params.status ? params.status.split(',') : undefined,
    paymentMethodCode: params.method ? params.method.split(',') : undefined,
    kind: params.kind ? params.kind.split(',') : undefined,
    searchQuery: params.search,
    startDate: params.startDate,
    endDate: params.endDate,
    sortBy,
    sortOrder,
  };

  // Fetch data in parallel
  const [paymentsResult, statsResult] = await Promise.all([
    listPayments(filters),
    getPaymentStats({}),
  ]);

  // Handle errors
  if (!paymentsResult.success) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {paymentsResult.error || 'Failed to load payments'}
        </div>
      </div>
    );
  }

  if (!statsResult.success) {
    console.error('[PaymentsPage] Failed to load stats:', statsResult.error);
  }

  const payments = paymentsResult.data?.payments || [];
  const pagination = paymentsResult.data?.pagination || {
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  };
  const stats = statsResult.success ? statsResult.data : null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-gray-600">{t('description')}</p>
        </div>
        <Link
          href="/dashboard/billing/payments/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('newPayment')}
        </Link>
      </div>

      {/* Stats Cards */}
      <PaymentStatsCards stats={stats} />

      {/* Filters */}
      <PaymentFiltersBar />

      {/* Payments Table */}
      <Suspense fallback={<div>{tCommon('loading')}</div>}>
        <PaymentsTable
          payments={payments}
          pagination={pagination}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </Suspense>
    </div>
  );
}
