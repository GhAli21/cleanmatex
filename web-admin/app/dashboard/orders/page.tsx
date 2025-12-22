/**
 * Orders List Page
 *
 * Displays a paginated, filterable list of orders for the current tenant.
 * This is an async Server Component that:
 * - Reads search params from the URL (page, status, dates, etc.)
 * - Fetches orders + statistics using server actions
 * - Passes plain data to client components for interactivity
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { listOrders, getStats } from '@/app/actions/orders/list-orders';
import { getAuthContext } from '@/lib/auth/server-auth';

// NOTE: These richer client components are temporarily disabled while
// we track down a production-only React error on Vercel. Once we confirm
// the minimal page works in production, we will re‑enable them one by one.
// import { OrderTable } from './components/order-table';
// import { OrderFiltersBar } from './components/order-filters-bar';
// import { OrderStatsCards } from './components/order-stats-cards';

type OrdersSearchParams = {
  page?: string;
  status?: string;
  preparationStatus?: string;
  priority?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
};

interface PageProps {
  searchParams?: OrdersSearchParams;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const t = await getTranslations('orders');

  // Ensure we always have an object (Next.js passes {} when no params)
  const params: OrdersSearchParams = searchParams ?? {};

  // Get tenant ID from auth context (enforces multi-tenancy)
  const { tenantId: tenantOrgId } = await getAuthContext();

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
    ordersResult.value.data;

  const statsOk =
    statsResult.status === 'fulfilled' &&
    statsResult.value.success &&
    statsResult.value.data;

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

      {/* Temporary minimal diagnostics block to keep page stable in production.
          Once we confirm this renders without React error #130 on Vercel,
          we will restore the rich client UI (filters, stats cards, table). */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
        <p className="font-semibold">{t('loadingOrders')}</p>
        <p className="text-xs text-blue-800">
          Minimal version of the Orders page is active to diagnose a production
          error. Data fetch status:
        </p>
        <ul className="list-disc pl-5 text-xs">
          <li>
            Orders:&nbsp;
            {ordersOk ? 'ok' : 'error'}
          </li>
          <li>
            Stats:&nbsp;
            {statsOk ? 'ok' : 'error'}
          </li>
        </ul>
      </div>
    </div>
  );
}
