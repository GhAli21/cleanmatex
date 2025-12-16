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
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Workflow Statistics
          </h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Workflow Statistics
          </h3>
          <button
            onClick={handleRefresh}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
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
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Workflow Statistics
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600 uppercase">
                Total
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {stats.totalOrders}
            </div>
          </div>

          <div className="rounded-lg bg-purple-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600 uppercase">
                In Progress
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {stats.inProgress}
            </div>
          </div>

          <div className="rounded-lg bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600 uppercase">
                Ready
              </span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {stats.ready}
            </div>
          </div>

          <div className="rounded-lg bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-600 uppercase">
                Overdue
              </span>
            </div>
            <div className="text-2xl font-bold text-red-900">
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
                <div className="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.totalOrders}
                  </div>
                  <div className="text-xs text-gray-500">Orders</div>
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
                <span className="text-gray-700 flex-1">{item.label}</span>
                <span className="font-semibold text-gray-900">
                  {item.value}
                </span>
                <span className="text-gray-500 text-xs">
                  ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
            <div>
              <div className="text-xs text-gray-500 mb-1">SLA Compliance</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.slaCompliance.toFixed(1)}%
              </div>
            </div>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                stats.slaCompliance >= 95
                  ? 'bg-green-100 text-green-700'
                  : stats.slaCompliance >= 85
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
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

          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
            <div>
              <div className="text-xs text-gray-500 mb-1">
                Avg Completion Time
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.avgCompletionHours.toFixed(1)}h
              </div>
            </div>
            <Clock className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
