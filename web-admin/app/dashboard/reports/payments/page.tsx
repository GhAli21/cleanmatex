'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { CreditCard, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { useReportRange } from '@features/reports/ui/reports-clock';
import { fetchPaymentsReport } from '@/app/actions/reports/report-actions';
import type { PaymentsReportData } from '@/lib/types/report-types';
import ReportFiltersBar from '@features/reports/ui/report-filters-bar-rprt';
import KPICards, { type KPICardData } from '@features/reports/ui/kpi-cards-rprt';
import PaymentsReportCharts from '@features/reports/ui/payments-report-charts-rprt';
import PaymentsReportTable from '@features/reports/ui/payments-report-table-rprt';

// Canonical lifecycle buckets — expanded server-side to the row statuses of
// each bucket (see getPaymentsReport / ORDER_PAYMENT_LIFECYCLE_STATUSES).
const PAYMENT_STATUSES = ['COMPLETED', 'PENDING', 'AUTHORIZED', 'FAILED'];
const BASE_PATH = '/dashboard/reports/payments';

/**
 *
 */
export default function PaymentsReportPage() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const { query } = useReportRange();
  const rangeStart = query?.start ?? '';
  const rangeEnd = query?.end ?? '';
  const [data, setData] = useState<PaymentsReportData | null>(null);
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

    const result = await fetchPaymentsReport({
      startDate: rangeStart,
      endDate: rangeEnd,
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
  }, [searchParams, rangeStart, rangeEnd, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={PAYMENT_STATUSES} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar basePath={BASE_PATH} showStatusFilter statusOptions={PAYMENT_STATUSES} />
        <div className="rounded-lg border border-danger-border bg-danger-bg p-6 text-center text-danger-text">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const kpiCards: KPICardData[] = [
    {
      label: t('kpi.totalPayments'),
      value: data.kpis.totalPayments,
      icon: CreditCard,
      color: 'text-primary-text',
      bgColor: 'bg-info-bg',
    },
    {
      label: t('kpi.totalAmount'),
      value: `${data.kpis.currencyCode} ${data.kpis.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-success-text',
      bgColor: 'bg-success-bg',
    },
    {
      label: t('kpi.avgAmount'),
      value: `${data.kpis.currencyCode} ${data.kpis.avgAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-primary-text',
      bgColor: 'bg-info-bg',
    },
    {
      label: t('kpi.refundedPayments'),
      value: data.kpis.refundedPayments,
      icon: RefreshCw,
      color: 'text-danger-text',
      bgColor: 'bg-danger-bg',
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
