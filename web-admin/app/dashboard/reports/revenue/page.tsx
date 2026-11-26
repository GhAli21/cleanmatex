'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useReportRange } from '@features/reports/ui/reports-clock';
import { fetchRevenueBreakdown } from '@/app/actions/reports/report-actions';
import type { RevenueBreakdownData } from '@/lib/types/report-types';
import ReportFiltersBar from '@features/reports/ui/report-filters-bar-rprt';
import RevenueBreakdownCharts from '@features/reports/ui/revenue-breakdown-charts-rprt';

const BASE_PATH = '/dashboard/reports/revenue';

/**
 *
 */
export default function RevenueReportPage() {
  const t = useTranslations('reports');
  const searchParams = useSearchParams();
  const { query } = useReportRange();
  const rangeStart = query?.start ?? '';
  const rangeEnd = query?.end ?? '';
  const [data, setData] = useState<RevenueBreakdownData | null>(null);
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

    const result = await fetchRevenueBreakdown({
      startDate: rangeStart,
      endDate: rangeEnd,
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
        <ReportFiltersBar basePath={BASE_PATH} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar basePath={BASE_PATH} />
        <div className="rounded-lg border border-danger-border bg-danger-bg p-6 text-center text-danger-text">{error}</div>
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
