'use client';

import { useTranslations } from 'next-intl';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DailyDataPoint, StatusBreakdown, TypeBreakdown } from '@/lib/types/report-types';

interface OrdersReportChartsProps {
  revenueByDay: DailyDataPoint[];
  ordersByStatus: StatusBreakdown[];
  ordersByType: TypeBreakdown[];
  currencyCode: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  delivered: '#3B82F6',
  processing: '#F59E0B',
  pending: '#6B7280',
  cancelled: '#EF4444',
  intake: '#8B5CF6',
  preparing: '#EC4899',
  ready: '#06B6D4',
  draft: '#9CA3AF',
};

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
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
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
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Orders by Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.ordersByStatus')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ordersByStatus}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" name={t('charts.count')}>
              {ordersByStatus.map((entry, idx) => (
                <rect key={idx} fill={STATUS_COLORS[entry.status] ?? '#6B7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Orders by Type */}
      {ordersByType.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            {t('charts.ordersByType')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ordersByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="orderTypeId" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name={t('charts.count')} fill="#3B82F6" />
              <Bar yAxisId="right" dataKey="revenue" name={t('charts.revenue')} fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
