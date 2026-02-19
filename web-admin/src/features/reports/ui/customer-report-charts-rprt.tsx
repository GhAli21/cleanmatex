'use client';

import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TopCustomer } from '@/lib/types/report-types';

interface CustomerReportChartsProps {
  topCustomersByRevenue: TopCustomer[];
  newVsReturning: { date: string; newCustomers: number; returningCustomers: number }[];
  currencyCode: string;
}

export default function CustomerReportCharts({
  topCustomersByRevenue,
  newVsReturning,
  currencyCode,
}: CustomerReportChartsProps) {
  const t = useTranslations('reports');

  const formattedTrend = newVsReturning.map((d) => ({
    ...d,
    date: d.date.slice(5),
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Top Customers */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.topCustomers')}
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={topCustomersByRevenue} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 10 }}
              width={100}
            />
            <Tooltip
              formatter={(value: number) => `${currencyCode} ${value.toLocaleString()}`}
            />
            <Bar dataKey="totalRevenue" name={t('charts.revenue')} fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* New vs Returning */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.newVsReturning')}
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={formattedTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="newCustomers"
              name={t('charts.newCustomers')}
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="returningCustomers"
              name={t('charts.returningCustomers')}
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
