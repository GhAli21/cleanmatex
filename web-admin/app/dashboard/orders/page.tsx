/**
 * Orders List Page
 *
 * Displays paginated list of orders with filters and search.
 */

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { listOrders, getStats } from '@/app/actions/orders/list-orders';
import { OrderTable } from './components/order-table';
import { OrderFiltersBar } from './components/order-filters-bar';
import { OrderStatsCards } from './components/order-stats-cards';
import { getAuthContext } from '@/lib/auth/server-auth';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    preparationStatus?: string;
    priority?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  // Get tenant ID from auth context
  const { tenantId: tenantOrgId } = await getAuthContext();
  const t = await getTranslations('orders');

  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // Parse filters from search params
  const filters = {
    page: params.page ? parseInt(params.page, 10) : 1,
    limit: 20,
    status: params.status,
    preparationStatus: params.preparationStatus,
    priority: params.priority,
    search: params.search,
    fromDate: params.fromDate ? new Date(params.fromDate) : undefined,
    toDate: params.toDate ? new Date(params.toDate) : undefined,
  };

  // Fetch orders and stats
  const [ordersResult, statsResult] = await Promise.all([
    listOrders(tenantOrgId, filters),
    getStats(tenantOrgId),
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-gray-600 mt-1">{t('manageAndTrack')}</p>
        </div>

        <Link
          href="/dashboard/orders/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + {t('newOrder')}
        </Link>
      </div>

      {/* Statistics Cards */}
      {statsResult.success && statsResult.data && (
        <OrderStatsCards stats={statsResult.data} />
      )}

      {/* Filters */}
      <OrderFiltersBar currentFilters={params} />

      {/* Orders Table */}
      <Suspense fallback={<div>{t('loadingOrders')}</div>}>
        {ordersResult.success && ordersResult.data ? (
          <OrderTable
            orders={ordersResult.data.orders}
            pagination={ordersResult.data.pagination}
          />
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">
              {ordersResult.error || t('failedToLoadOrders')}
            </p>
          </div>
        )}
      </Suspense>
    </div>
  );
}
