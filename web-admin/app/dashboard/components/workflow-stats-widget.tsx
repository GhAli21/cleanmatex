'use client';

import { useEffect, useState } from 'react';
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
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchStats, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/dashboard/workflow-stats');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch workflow stats');
      }

      const data = await response.json();
      setStats(data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching workflow stats:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load workflow stats'
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
            Workflow Statistics
          </h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading...</span>
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
            Workflow Statistics
          </h3>
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            aria-label="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </CmxButton>
        </div>
        <div className="rounded-lg bg-danger-bg p-4 text-sm text-danger-text">
          {error || 'No data available'}
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
    return {
      label: meta?.label || item.status,
      // cmx-ds-ignore UI003: fallback neutral conic-gradient slice hex color
      color: meta?.color || '#999',
      value: item.count,
      percentage: ((item.count / stats.totalOrders) * 100).toFixed(1),
    };
  });

  let cumulativePercentage = 0;
  const gradientStops = chartData
    .map((item, index) => {
      const startPercentage = cumulativePercentage;
      cumulativePercentage += parseFloat(item.percentage);
      return `${item.color} ${startPercentage}% ${cumulativePercentage}%`;
    })
    .join(', ');

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-6">
        <h3 className="text-lg font-semibold text-foreground">
          Workflow Statistics
        </h3>
        <CmxButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh"
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
                Total
              </span>
            </div>
            <div className="text-2xl font-bold text-primary-text">
              {stats.totalOrders}
            </div>
          </div>

          <div className="rounded-lg bg-info-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary-text" />
              <span className="text-xs font-medium text-primary-text uppercase">
                In Progress
              </span>
            </div>
            <div className="text-2xl font-bold text-primary-text">
              {stats.inProgress}
            </div>
          </div>

          <div className="rounded-lg bg-success-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-success-text" />
              <span className="text-xs font-medium text-success-text uppercase">
                Ready
              </span>
            </div>
            <div className="text-2xl font-bold text-success-text">
              {stats.ready}
            </div>
          </div>

          <div className="rounded-lg bg-danger-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-danger-text" />
              <span className="text-xs font-medium text-danger-text uppercase">
                Overdue
              </span>
            </div>
            <div className="text-2xl font-bold text-danger-text">
              {stats.overdue}
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
                  <div className="text-3xl font-bold text-foreground">
                    {stats.totalOrders}
                  </div>
                  <div className="text-xs text-muted-foreground">Orders</div>
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
                <span className="font-semibold text-foreground">
                  {item.value}
                </span>
                <span className="text-muted-foreground text-xs">
                  ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <div className="text-xs text-muted-foreground mb-1">SLA Compliance</div>
              <div className="text-2xl font-bold text-foreground">
                {stats.slaCompliance.toFixed(1)}%
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
                  <span>Excellent</span>
                </>
              ) : stats.slaCompliance >= 85 ? (
                <>
                  <TrendingDown className="h-3 w-3" />
                  <span>Good</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3" />
                  <span>Needs Attention</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Avg Completion Time
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.avgCompletionHours.toFixed(1)}h
              </div>
            </div>
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
