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
import type { InvoiceStatusBreakdown, AgingBucket, DailyDataPoint } from '@/lib/types/report-types';

interface InvoicesReportChartsProps {
  invoicesByStatus: InvoiceStatusBreakdown[];
  agingBuckets: AgingBucket[];
  collectionTrend: DailyDataPoint[];
  currencyCode: string;
}

const STATUS_COLORS: Record<string, string> = {
  paid: '#10B981',
  partial: '#F59E0B',
  pending: '#6B7280',
  overdue: '#EF4444',
  draft: '#9CA3AF',
  cancelled: '#EF4444',
};

const AGING_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#EF4444'];

export default function InvoicesReportCharts({
  invoicesByStatus,
  agingBuckets,
  collectionTrend,
  currencyCode,
}: InvoicesReportChartsProps) {
  const t = useTranslations('reports');

  const formattedTrend = collectionTrend.map((d) => ({
    ...d,
    date: d.date.slice(5),
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Invoices by Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.invoicesByStatus')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={invoicesByStatus}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name={t('charts.count')} fill="#3B82F6" />
            <Bar dataKey="amount" name={`${t('charts.amount')} (${currencyCode})`} fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Aging Buckets */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.agingBuckets')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={agingBuckets}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => `${currencyCode} ${value.toLocaleString()}`}
            />
            <Bar dataKey="amount" name={t('charts.outstanding')}>
              {agingBuckets.map((_, idx) => (
                <rect key={idx} fill={AGING_COLORS[idx % AGING_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Collection Trend */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {t('charts.collectionTrend')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={formattedTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${currencyCode} ${value.toLocaleString()}`, t('charts.collected')]}
            />
            <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
