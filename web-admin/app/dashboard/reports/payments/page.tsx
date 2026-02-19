'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { CreditCard, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { fetchPaymentsReport } from '@/app/actions/reports/report-actions';
import type { PaymentsReportData } from '@/lib/types/report-types';
import ReportFiltersBar from '@features/reports/ui/report-filters-bar-rprt';
import KPICards, { type KPICardData } from '@features/reports/ui/kpi-cards-rprt';
import PaymentsReportCharts from '@features/reports/ui/payments-report-charts-rprt';
import PaymentsReportTable from '@features/reports/ui/payments-report-table-rprt';

const PAYMENT_STATUSES = ['completed', 'pending', 'cancelled', 'refunded'];
const BASE_PATH = '/dashboard/reports/payments';

export default function PaymentsReportPage() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaymentsReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startDate = searchParams.get('startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd');
    const status = searchParams.get('status') ? searchParams.get('status')!.split(',') : undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);

    const result = await fetchPaymentsReport({
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
        <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={PAYMENT_STATUSES} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={PAYMENT_STATUSES} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const kpiCards: KPICardData[] = [
    {
      label: t('kpi.totalPayments'),
      value: data.kpis.totalPayments,
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('kpi.totalAmount'),
      value: `${data.kpis.currencyCode} ${data.kpis.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: t('kpi.avgAmount'),
      value: `${data.kpis.currencyCode} ${data.kpis.avgAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: t('kpi.refundedPayments'),
      value: data.kpis.refundedPayments,
      icon: RefreshCw,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={PAYMENT_STATUSES} />
      <KPICards cards={kpiCards} />
      <PaymentsReportCharts
        paymentsByDay={data.paymentsByDay}
        paymentsByMethod={data.paymentsByMethod}
        paymentsByStatus={data.paymentsByStatus}
        currencyCode={data.kpis.currencyCode}
      />
      <PaymentsReportTable payments={data.payments} pagination={data.pagination} basePath={BASE_PATH} />
    </div>
  );
}
