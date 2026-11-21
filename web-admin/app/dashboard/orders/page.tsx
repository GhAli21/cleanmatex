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
import { CmxButton, CmxSkeletonTable } from '@ui/primitives';
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';

/** Labels the tenant order list independently from individual order workspaces. */
export const metadata: Metadata = { title: 'Orders' };

type OrdersSearchParams = {
  page?: string;
  limit?: string;
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
        <CmxSummaryMessage
          type="error"
          message={error instanceof Error ? error.message : t('failedToLoadOrders')}
        />
      </div>
    );
  }

  // Safely parse page / limit / dates from query string
  const page =
    params.page && !Number.isNaN(Number.parseInt(params.page, 10))
      ? Number.parseInt(params.page, 10)
      : 1;

  const parsedLimit =
    params.limit && !Number.isNaN(Number.parseInt(params.limit, 10))
      ? Number.parseInt(params.limit, 10)
      : CMX_DEFAULT_PAGE_SIZE;
  const limit = CMX_PAGE_SIZE_OPTIONS.includes(parsedLimit)
    ? parsedLimit
    : CMX_DEFAULT_PAGE_SIZE;

  const parseDate = (value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const filters = {
    page,
    limit,
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
          <CmxButton variant="outline" size="sm" asChild>
            <Link
              href="/dashboard/orders?status=draft&physicalIntakeStatus=pending_dropoff"
              className="text-warning-text border-warning-border hover:bg-warning-bg"
            >
              {t('awaitingDropoffQueue')}
            </Link>
          </CmxButton>
          <CmxButton variant="primary" size="sm" asChild>
            <Link href="/dashboard/orders/new">
              + {t('newOrder')}
            </Link>
          </CmxButton>
        </>
      }
      kpis={statsData ? <OrderStatsCards stats={statsData} /> : undefined}
      filters={<OrderFiltersBar currentFilters={params} />}
    >
      {/* Orders table with graceful error state (simplified table component) */}
      <Suspense fallback={<CmxSkeletonTable rows={8} columns={8} />}>
        {ordersData ? (
          <OrdersSimpleTable
            orders={ordersData.orders}
            pagination={ordersData.pagination}
            hasActiveFilters={Boolean(
              params.status ||
              params.preparationStatus ||
              params.priority ||
              params.isRetail ||
              params.physicalIntakeStatus ||
              params.fromDate ||
              params.toDate ||
              params.orderSourceCode ||
              params.search
            )}
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
