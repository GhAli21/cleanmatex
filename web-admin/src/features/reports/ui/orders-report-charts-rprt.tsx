'use client';

import { useTranslations } from 'next-intl';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartLegend } from '@/lib/charts/recharts-legend';
import type { DailyDataPoint, StatusBreakdown, TypeBreakdown } from '@/lib/types/report-types';

interface OrdersReportChartsProps {
  revenueByDay: DailyDataPoint[];
  ordersByStatus: StatusBreakdown[];
  ordersByType: TypeBreakdown[];
  currencyCode: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'rgb(var(--cmx-success-text-rgb))',
  delivered: 'rgb(var(--cmx-primary-rgb))',
  processing: 'rgb(var(--cmx-warning-text-rgb))',
  pending: 'rgb(var(--cmx-muted-foreground-rgb))',
  cancelled: 'rgb(var(--cmx-danger-text-rgb))',
  intake: '#8B5CF6', // cmx-ds-ignore UI003: distinct workflow stage series colour
  preparing: '#EC4899', // cmx-ds-ignore UI003: distinct workflow stage series colour
  ready: 'rgb(var(--cmx-info-text-rgb))',
  draft: 'rgb(var(--cmx-muted-foreground-rgb))',
};

/**
 *
 * @param root0
 * @param root0.revenueByDay
 * @param root0.ordersByStatus
 * @param root0.ordersByType
 * @param root0.currencyCode
 */
export default function OrdersReportCharts({
  revenueByDay,
  ordersByStatus,
  ordersByType,
  currencyCode,
}: OrdersReportChartsProps) {
  const t = useTranslations('reports');

  // Format date for X axis
  const formattedRevenue = revenueByDay.map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Revenue Trend */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          {t('charts.revenueTrend')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={formattedRevenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${currencyCode} ${value.toLocaleString()}`, t('charts.revenue')]}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="rgb(var(--cmx-primary-rgb))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Orders by Status */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          {t('charts.ordersByStatus')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ordersByStatus}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" name={t('charts.count')} fill="rgb(var(--cmx-primary-rgb))">
              {ordersByStatus.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLORS[entry.status] ?? 'rgb(var(--cmx-muted-foreground-rgb))'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Orders by Type */}
      {ordersByType.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {t('charts.ordersByType')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ordersByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="orderTypeId" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <ChartLegend />
              <Bar yAxisId="left" dataKey="count" name={t('charts.count')} fill="rgb(var(--cmx-primary-rgb))" />
              <Bar yAxisId="right" dataKey="revenue" name={t('charts.revenue')} fill="rgb(var(--cmx-success-text-rgb))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
