'use client';

import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartLegend } from '@/lib/charts/recharts-legend';
import type { InvoiceStatusBreakdown, AgingBucket, DailyDataPoint } from '@/lib/types/report-types';

interface InvoicesReportChartsProps {
  invoicesByStatus: InvoiceStatusBreakdown[];
  agingBuckets: AgingBucket[];
  collectionTrend: DailyDataPoint[];
  currencyCode: string;
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'rgb(var(--cmx-success-text-rgb))',
  partial: 'rgb(var(--cmx-warning-text-rgb))',
  pending: 'rgb(var(--cmx-muted-foreground-rgb))',
  overdue: 'rgb(var(--cmx-danger-text-rgb))',
  draft: 'rgb(var(--cmx-muted-foreground-rgb))',
  cancelled: 'rgb(var(--cmx-danger-text-rgb))',
};

const AGING_COLORS = [
  'rgb(var(--cmx-success-text-rgb))',
  'rgb(var(--cmx-primary-rgb))',
  'rgb(var(--cmx-warning-text-rgb))',
  '#F97316', // cmx-ds-ignore UI003: distinct 60-90d aging bucket severity colour
  'rgb(var(--cmx-danger-text-rgb))',
];

/**
 *
 * @param root0
 * @param root0.invoicesByStatus
 * @param root0.agingBuckets
 * @param root0.collectionTrend
 * @param root0.currencyCode
 */
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
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          {t('charts.invoicesByStatus')}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={invoicesByStatus}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <ChartLegend />
            <Bar dataKey="count" name={t('charts.count')} fill="rgb(var(--cmx-primary-rgb))" />
            <Bar dataKey="amount" name={`${t('charts.amount')} (${currencyCode})`} fill="rgb(var(--cmx-success-text-rgb))" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Aging Buckets */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
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
            <Bar dataKey="amount" name={t('charts.outstanding')} fill="rgb(var(--cmx-primary-rgb))">
              {agingBuckets.map((_, idx) => (
                <Cell key={idx} fill={AGING_COLORS[idx % AGING_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Collection Trend */}
      <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
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
            <Line type="monotone" dataKey="revenue" stroke="rgb(var(--cmx-success-text-rgb))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
