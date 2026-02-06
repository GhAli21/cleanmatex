'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { FileText, DollarSign, TrendingDown, AlertTriangle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { fetchInvoicesReport } from '@/app/actions/reports/report-actions';
import type { InvoicesReportData } from '@/lib/types/report-types';
import ReportFiltersBar from '../components/report-filters-bar-rprt';
import KPICards, { type KPICardData } from '../components/kpi-cards-rprt';
import InvoicesReportCharts from '../components/invoices-report-charts-rprt';
import InvoicesReportTable from '../components/invoices-report-table-rprt';

const INVOICE_STATUSES = ['pending', 'paid', 'partial', 'overdue', 'draft', 'cancelled'];
const BASE_PATH = '/dashboard/reports/invoices';

export default function InvoicesReportPage() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const [data, setData] = useState<InvoicesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startDate = searchParams.get('startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd');
    const status = searchParams.get('status') ? searchParams.get('status')!.split(',') : undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);

    const result = await fetchInvoicesReport({
      startDate: `${startDate}T00:00:00.000Z`,
      endDate: `${endDate}T23:59:59.999Z`,
      status,
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
        <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={INVOICE_STATUSES} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={INVOICE_STATUSES} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const kpiCards: KPICardData[] = [
    {
      label: t('kpi.totalInvoices'),
      value: data.kpis.totalInvoices,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('kpi.totalOutstanding'),
      value: `${data.kpis.currencyCode} ${data.kpis.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: t('kpi.collectionRate'),
      value: `${data.kpis.collectionRate}%`,
      icon: TrendingDown,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: t('kpi.overdueCount'),
      value: data.kpis.overdueCount,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={INVOICE_STATUSES} />
      <KPICards cards={kpiCards} />
      <InvoicesReportCharts
        invoicesByStatus={data.invoicesByStatus}
        agingBuckets={data.agingBuckets}
        collectionTrend={data.collectionTrend}
        currencyCode={data.kpis.currencyCode}
      />
      <InvoicesReportTable
        invoices={data.invoices}
        pagination={data.pagination}
        currencyCode={data.kpis.currencyCode}
        basePath={BASE_PATH}
      />
    </div>
  );
}
