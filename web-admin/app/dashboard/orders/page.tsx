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
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listOrders, getStats } from '@/app/actions/orders/list-orders';
import { getAuthContext } from '@/lib/auth/server-auth';
import { OrderStatsCards } from '@features/orders/ui/order-stats-cards';
import { OrderFiltersBar } from '@features/orders/ui/order-filters-bar';
import { OrdersSimpleTable } from '@features/orders/ui/orders-simple-table';
import { OrdersRefreshButton } from '@features/orders/ui/orders-refresh-button';
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';

/** Labels the tenant order list independently from individual order workspaces. */
export const metadata: Metadata = { title: 'Orders' };

type OrdersSearchParams = {
  page?: string;
  status?: string;
  preparationStatus?: string;
  priority?: string;
  isRetail?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  physicalIntakeStatus?: string;
  orderSourceCode?: string;
};

interface PageProps {
  searchParams?: Promise<OrdersSearchParams>;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
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
        <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger-text">
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
    physicalIntakeStatus: params.physicalIntakeStatus,
    orderSourceCode: params.orderSourceCode,
    sortBy:
      params.physicalIntakeStatus === 'pending_dropoff'
        ? ('created_at' as const)
        : ('received_at' as const),
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
    <CmxCrudPageShell
      className="p-6"
      title={t('title')}
      subtitle={t('manageAndTrack')}
      actions={
        <>
          <OrdersRefreshButton />
          <Link
            href="/dashboard/orders?status=draft&physicalIntakeStatus=pending_dropoff"
            className="text-sm font-medium text-warning-text hover:text-warning-text/80"
          >
            {t('awaitingDropoffQueue')}
          </Link>
          <Link
            href="/dashboard/orders/new"
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
          >
            + {t('newOrder')}
          </Link>
        </>
      }
      kpis={statsData ? <OrderStatsCards stats={statsData} /> : undefined}
      filters={<OrderFiltersBar currentFilters={params} />}
    >
      {/* Orders table with graceful error state (simplified table component) */}
      <Suspense fallback={<div>{t('loadingOrders')}</div>}>
        {ordersData ? (
          <OrdersSimpleTable
            orders={ordersData.orders}
            pagination={ordersData.pagination}
          />
        ) : (
          <CmxSummaryMessage
            type="error"
            message={
              ordersResult.status === 'fulfilled' && ordersResult.value.error
                ? ordersResult.value.error
                : t('failedToLoadOrders')
            }
          />
        )}
      </Suspense>
    </CmxCrudPageShell>
  );
}
