'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { DollarSign, Package, TrendingUp, Users } from 'lucide-react';
import { useReportRange } from '@features/reports/ui/reports-clock';
import { fetchOrdersReport } from '@/app/actions/reports/report-actions';
import type { OrdersReportData } from '@/lib/types/report-types';
import ReportFiltersBar from '@features/reports/ui/report-filters-bar-rprt';
import KPICards, { type KPICardData } from '@features/reports/ui/kpi-cards-rprt';
import OrdersReportCharts from '@features/reports/ui/orders-report-charts-rprt';
import OrdersReportTable from '@features/reports/ui/orders-report-table-rprt';

const ORDER_STATUSES = ['intake', 'pending', 'preparing', 'processing', 'ready', 'ready_for_pickup', 'delivered', 'completed', 'cancelled'];
const BASE_PATH = '/dashboard/reports/orders';

/**
 *
 */
export default function OrdersReportPage() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const { query } = useReportRange();
  const rangeStart = query?.start ?? '';
  const rangeEnd = query?.end ?? '';
  const [data, setData] = useState<OrdersReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!rangeStart || !rangeEnd) {
      setError(t('timezoneNotConfigured'));
      setLoading(false);
      return;
    }
    const status = searchParams.get('status') ? searchParams.get('status')!.split(',') : undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const limit = [10, 20, 50, 100].includes(limitParam) ? limitParam : 20;
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined;

    const result = await fetchOrdersReport({
      startDate: rangeStart,
      endDate: rangeEnd,
      status,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Failed to load report data');
    }
    setLoading(false);
  }, [searchParams, rangeStart, rangeEnd, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar
          basePath={BASE_PATH}
          showStatusFilter
          statusOptions={ORDER_STATUSES}
        />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar
          basePath={BASE_PATH}
          showStatusFilter
          statusOptions={ORDER_STATUSES}
        />
        <div className="rounded-lg border border-danger-border bg-danger-bg p-6 text-center text-danger-text">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpiCards: KPICardData[] = [
    {
      label: t('totalRevenue'),
      value: `${data.kpis.currencyCode} ${data.kpis.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-success-text',
      bgColor: 'bg-success-bg',
    },
    {
      label: t('totalOrders'),
      value: data.kpis.totalOrders,
      icon: Package,
      color: 'text-primary-text',
      bgColor: 'bg-info-bg',
    },
    {
      label: t('avgOrderValue'),
      value: `${data.kpis.currencyCode} ${data.kpis.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-primary-text',
      bgColor: 'bg-info-bg',
    },
    {
      label: t('activeCustomers'),
      value: data.kpis.activeCustomers,
      icon: Users,
      color: 'text-warning-text',
      bgColor: 'bg-warning-bg',
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFiltersBar
        basePath={BASE_PATH}
        showStatusFilter
        statusOptions={ORDER_STATUSES}
      />

      <KPICards cards={kpiCards} />

      <OrdersReportCharts
        revenueByDay={data.revenueByDay}
        ordersByStatus={data.ordersByStatus}
        ordersByType={data.ordersByType}
        currencyCode={data.kpis.currencyCode}
      />

      <OrdersReportTable
        orders={data.orders}
        pagination={data.pagination}
        currencyCode={data.kpis.currencyCode}
        basePath={BASE_PATH}
      />
    </div>
  );
}
