'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Clock,
  Package,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { STATUS_META, type OrderStatus } from '@/lib/types/workflow';

interface WorkflowStats {
  totalOrders: number;
  inProgress: number;
  ready: number;
  overdue: number;
  byStatus: {
    status: OrderStatus;
    count: number;
  }[];
  slaCompliance: number;
  avgCompletionHours: number;
}

/**
 *
 */
export function WorkflowStatsWidget() {
  const t = useTranslations('dashboard.workflowStats');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { formatNumber } = useTenantCurrency();
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchStats, 2 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/dashboard/workflow-stats');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('fetchError'));
      }

      const data = await response.json();
      setStats(data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching workflow stats:', err);
      setError(
        err instanceof Error ? err.message : t('loadError')
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchStats();
  };

  if (loading && !isRefreshing) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {t('title')}
          </h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span className="text-sm">{tCommon('loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {t('title')}
          </h3>
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            aria-label={t('refreshAria')}
          >
            <RefreshCw className="h-5 w-5" />
          </CmxButton>
        </div>
        <div className="rounded-lg bg-danger-bg p-4 text-sm text-danger-text">
          {error || t('noData')}
        </div>
      </div>
    );
  }

  // Calculate chart data (top 6 statuses + others)
  const sortedByStatus = [...stats.byStatus]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const otherCount = stats.byStatus
    .slice(6)
    .reduce((sum, item) => sum + item.count, 0);

  if (otherCount > 0) {
    sortedByStatus.push({
      status: 'OTHER' as OrderStatus,
      count: otherCount,
    });
  }

  // Simple donut chart using conic-gradient
  const chartData = sortedByStatus.map((item) => {
    const meta = STATUS_META[item.status];
    const localizedLabel = locale === 'ar' ? meta?.labelAr || meta?.label : meta?.label;
    return {
      label: localizedLabel || item.status,
      // cmx-ds-ignore UI003: fallback neutral conic-gradient slice hex color
      color: meta?.color || '#999',
      value: item.count,
      percentage: stats.totalOrders > 0 ? ((item.count / stats.totalOrders) * 100) : 0,
    };
  });

  let cumulativePercentage = 0;
  const gradientStops = chartData
    .map((item) => {
      const startPercentage = cumulativePercentage;
      cumulativePercentage += item.percentage;
      return `${item.color} ${startPercentage}% ${cumulativePercentage}%`;
    })
    .join(', ');

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-6">
        <h3 className="text-lg font-semibold text-foreground">
          {t('title')}
        </h3>
        <CmxButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label={t('refreshAria')}
        >
          <RefreshCw
            className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </CmxButton>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg bg-info-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-primary-text" />
              <span className="text-xs font-medium text-primary-text uppercase">
                {t('total')}
              </span>
            </div>
            <div className="text-2xl font-bold text-primary-text tabular-nums">
              {formatNumber(stats.totalOrders)}
            </div>
          </div>

          <div className="rounded-lg bg-info-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary-text" />
              <span className="text-xs font-medium text-primary-text uppercase">
                {t('inProgress')}
              </span>
            </div>
            <div className="text-2xl font-bold text-primary-text tabular-nums">
              {formatNumber(stats.inProgress)}
            </div>
          </div>

          <div className="rounded-lg bg-success-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-success-text" />
              <span className="text-xs font-medium text-success-text uppercase">
                {t('ready')}
              </span>
            </div>
            <div className="text-2xl font-bold text-success-text tabular-nums">
              {formatNumber(stats.ready)}
            </div>
          </div>

          <div className="rounded-lg bg-danger-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-danger-text" />
              <span className="text-xs font-medium text-danger-text uppercase">
                {t('overdue')}
              </span>
            </div>
            <div className="text-2xl font-bold text-danger-text tabular-nums">
              {formatNumber(stats.overdue)}
            </div>
          </div>
        </div>

        {/* Donut Chart & Legend */}
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Donut Chart */}
          <div className="relative flex items-center justify-center">
            <div
              className="w-48 h-48 rounded-full"
              style={{
                background: `conic-gradient(${gradientStops})`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-card flex flex-col items-center justify-center">
                  <div className="text-3xl font-bold text-foreground tabular-nums">
                    {formatNumber(stats.totalOrders)}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('ordersUnit')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chartData.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-sm"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-foreground flex-1">{item.label}</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatNumber(item.value)}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  ({formatNumber(item.percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t('slaCompliance')}</div>
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {formatNumber(stats.slaCompliance, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </div>
            </div>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                stats.slaCompliance >= 95
                  ? 'bg-success-bg text-success-text'
                  : stats.slaCompliance >= 85
                  ? 'bg-warning-bg text-warning-text'
                  : 'bg-danger-bg text-danger-text'
              }`}
            >
              {stats.slaCompliance >= 95 ? (
                <>
                  <TrendingUp className="h-3 w-3" />
                  <span>{t('excellent')}</span>
                </>
              ) : stats.slaCompliance >= 85 ? (
                <>
                  <TrendingDown className="h-3 w-3" />
                  <span>{t('good')}</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3" />
                  <span>{t('needsAttention')}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t('avgCompletionTime')}
              </div>
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {t('durationHoursValue', {
                  hours: formatNumber(stats.avgCompletionHours, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                })}
              </div>
            </div>
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
