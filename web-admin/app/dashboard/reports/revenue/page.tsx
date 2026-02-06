'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { fetchRevenueBreakdown } from '@/app/actions/reports/report-actions';
import type { RevenueBreakdownData } from '@/lib/types/report-types';
import ReportFiltersBar from '../components/report-filters-bar-rprt';
import RevenueBreakdownCharts from '../components/revenue-breakdown-charts-rprt';

const BASE_PATH = '/dashboard/reports/revenue';

export default function RevenueReportPage() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const [data, setData] = useState<RevenueBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startDate = searchParams.get('startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd');

    const result = await fetchRevenueBreakdown({
      startDate: `${startDate}T00:00:00.000Z`,
      endDate: `${endDate}T23:59:59.999Z`,
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

  return (
    <div className="space-y-6">
      <ReportFiltersBar basePath={BASE_PATH} />
      <RevenueBreakdownCharts
        byServiceCategory={data.byServiceCategory}
        byBranch={data.byBranch}
        byOrderType={data.byOrderType}
        totalRevenue={data.totalRevenue}
        currencyCode={data.currencyCode}
      />
    </div>
  );
}
