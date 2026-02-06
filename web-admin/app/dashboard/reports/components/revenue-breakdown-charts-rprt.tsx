'use client';

import { useTranslations } from 'next-intl';
import {
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
import type { RevenueCategoryBreakdown } from '@/lib/types/report-types';

interface RevenueBreakdownChartsProps {
  byServiceCategory: RevenueCategoryBreakdown[];
  byBranch: RevenueCategoryBreakdown[];
  byOrderType: RevenueCategoryBreakdown[];
  totalRevenue: number;
  currencyCode: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function RevenueBreakdownCharts({
  byServiceCategory,
  byBranch,
  byOrderType,
  totalRevenue,
  currencyCode,
}: RevenueBreakdownChartsProps) {
  const t = useTranslations('reports');

  return (
    <div className="space-y-6">
      {/* Total Revenue */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="text-sm text-gray-600">{t('totalRevenue')}</div>
        <div className="mt-1 text-3xl font-bold text-gray-900">
          {currencyCode} {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Service Category */}
        {byServiceCategory.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              {t('charts.byServiceCategory')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byServiceCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="revenue"
                  nameKey="name"
                  label={({ name, percentage }) => `${name} (${percentage}%)`}
                >
                  {byServiceCategory.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${currencyCode} ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By Order Type */}
        {byOrderType.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              {t('charts.byOrderType')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byOrderType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(value: number) => `${currencyCode} ${value.toLocaleString()}`} />
                <Bar dataKey="revenue" name={t('charts.revenue')} fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By Branch */}
        {byBranch.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              {t('charts.byBranch')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byBranch}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${currencyCode} ${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" name={t('charts.revenue')} fill="#3B82F6" />
                <Bar dataKey="orderCount" name={t('charts.orders')} fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
