'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, UserCheck, DollarSign } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { fetchCustomerReport } from '@/app/actions/reports/report-actions';
import type { CustomerReportData } from '@/lib/types/report-types';
import ReportFiltersBar from '../components/report-filters-bar-rprt';
import KPICards, { type KPICardData } from '../components/kpi-cards-rprt';
import CustomerReportCharts from '../components/customer-report-charts-rprt';
import CustomerReportTable from '../components/customer-report-table-rprt';

const BASE_PATH = '/dashboard/reports/customers';

export default function CustomersReportPage() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const [data, setData] = useState<CustomerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startDate = searchParams.get('startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd');
    const page = parseInt(searchParams.get('page') || '1', 10);

    const result = await fetchCustomerReport({
      startDate: `${startDate}T00:00:00.000Z`,
      endDate: `${endDate}T23:59:59.999Z`,
      page,
      limit: 20,
    });

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Failed to load report data');
    }
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar basePath={BASE_PATH} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar basePath={BASE_PATH} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const kpiCards: KPICardData[] = [
    {
      label: t('kpi.totalCustomers'),
      value: data.kpis.totalCustomers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('kpi.newCustomers'),
      value: data.kpis.newCustomers,
      icon: UserPlus,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: t('kpi.returningCustomers'),
      value: data.kpis.returningCustomers,
      icon: UserCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: t('kpi.avgLTV'),
      value: `${data.kpis.currencyCode} ${data.kpis.avgLTV.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFiltersBar basePath={BASE_PATH} />
      <KPICards cards={kpiCards} />
      <CustomerReportCharts
        topCustomersByRevenue={data.topCustomersByRevenue}
        newVsReturning={data.newVsReturning}
        currencyCode={data.kpis.currencyCode}
      />
      <CustomerReportTable
        customers={data.customers}
        pagination={data.pagination}
        currencyCode={data.kpis.currencyCode}
        basePath={BASE_PATH}
      />
    </div>
  );
}
