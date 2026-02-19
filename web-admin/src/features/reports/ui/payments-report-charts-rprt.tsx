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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { DailyDataPoint, PaymentMethodBreakdown, PaymentStatusBreakdown } from '@/lib/types/report-types';

interface PaymentsReportChartsProps {
  paymentsByDay: DailyDataPoint[];
  paymentsByMethod: PaymentMethodBreakdown[];
  paymentsByStatus: PaymentStatusBreakdown[];
  currencyCode: string;
}

const METHOD_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  pending: '#F59E0B',
  cancelled: '#EF4444',
  refunded: '#8B5CF6',
};

export default function PaymentsReportCharts({
  paymentsByDay,
  paymentsByMethod,
  paymentsByStatus,
  currencyCode,
}: PaymentsReportChartsProps) {
  const t = useTranslations('reports');

  const formattedDaily = paymentsByDay.map((d) => ({
    ...d,
    date: d.date.slice(5),
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Payments Trend */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.paymentsTrend')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={formattedDaily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${currencyCode} ${value.toLocaleString()}`, t('charts.amount')]}
            />
            <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Payments by Method */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.byPaymentMethod')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={paymentsByMethod}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="amount"
              nameKey="methodName"
              label={({ methodName, percent }) => `${methodName} (${(percent * 100).toFixed(0)}%)`}
            >
              {paymentsByMethod.map((_, idx) => (
                <Cell key={idx} fill={METHOD_COLORS[idx % METHOD_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${currencyCode} ${value.toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Payments by Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.byPaymentStatus')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={paymentsByStatus}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name={t('charts.count')} fill="#3B82F6" />
            <Bar dataKey="amount" name={t('charts.amount')} fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
