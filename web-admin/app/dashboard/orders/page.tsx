/**
 * Orders List Page
 *
 * Displays a paginated, filterable list of orders for the current tenant.
 * This is an async Server Component that:
 * - Reads search params from the URL (page, status, dates, etc.)
 * - Fetches orders + statistics using server actions
 * - Passes plain data to client components for interactivity
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listOrders, getStats } from '@/app/actions/orders/list-orders';
import { getAuthContext } from '@/lib/auth/server-auth';
import { OrderStatsCards } from '@features/orders/ui/order-stats-cards';
import { OrderFiltersBar } from '@features/orders/ui/order-filters-bar';
import { OrdersSimpleTable } from '@features/orders/ui/orders-simple-table';

type OrdersSearchParams = {
  page?: string;
  status?: string;
  preparationStatus?: string;
  priority?: string;
  isRetail?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
};

interface PageProps {
  searchParams?: Promise<OrdersSearchParams>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const t = await getTranslations('orders');

  // In Next.js 15+, searchParams is a Promise that must be awaited
  const resolvedSearchParams = await searchParams;

  // Ensure we always have an object (Next.js passes {} when no params)
  const params: OrdersSearchParams = resolvedSearchParams ?? {};

  // Get tenant ID from auth context (enforces multi-tenancy)
  let tenantOrgId: string;
  try {
    const authContext = await getAuthContext();
    tenantOrgId = authContext.tenantId;
  } catch (error) {
    console.error('[OrdersPage] Auth error:', error);
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Authentication failed. Please log in again.'}
        </div>
      </div>
    );
  }

  // Safely parse page / dates from query string
  const page =
    params.page && !Number.isNaN(Number.parseInt(params.page, 10))
      ? Number.parseInt(params.page, 10)
      : 1;

  const parseDate = (value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const filters = {
    page,
    limit: 20,
    status: params.status,
    preparationStatus: params.preparationStatus,
    priority: params.priority,
    isRetail: params.isRetail === 'true' || params.isRetail === 'false' ? params.isRetail : undefined,
    search: params.search,
    fromDate: parseDate(params.fromDate),
    toDate: parseDate(params.toDate),
  };

  const [ordersResult, statsResult] = await Promise.allSettled([
    listOrders(tenantOrgId, filters),
    getStats(tenantOrgId),
  ]);

  const ordersOk =
    ordersResult.status === 'fulfilled' &&
    ordersResult.value.success &&
    !!ordersResult.value.data;

  const statsOk =
    statsResult.status === 'fulfilled' &&
    statsResult.value.success &&
    !!statsResult.value.data;

  const ordersData =
    ordersOk && ordersResult.status === 'fulfilled' ? ordersResult.value.data : null;

  const statsData =
    statsOk && statsResult.status === 'fulfilled' ? statsResult.value.data : null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-gray-600">{t('manageAndTrack')}</p>
        </div>

        <Link
          href="/dashboard/orders/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + {t('newOrder')}
        </Link>
      </div>

      {/* Filters */}
      <OrderFiltersBar currentFilters={params} />

      {/* Stats cards */}
      {statsData && <OrderStatsCards stats={statsData} />}

      {/* Orders table with graceful error state (simplified table component) */}
      <Suspense fallback={<div>{t('loadingOrders')}</div>}>
        {ordersData ? (
          <OrdersSimpleTable
            orders={ordersData.orders}
            pagination={ordersData.pagination}
          />
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {ordersResult.status === 'fulfilled' && ordersResult.value.error
              ? ordersResult.value.error
              : t('failedToLoadOrders')}
          </div>
        )}
      </Suspense>
    </div>
  );
}
