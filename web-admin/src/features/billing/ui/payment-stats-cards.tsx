'use client';

import { useTranslations } from 'next-intl';
import type { PaymentStats } from '@/lib/types/payment';

interface PaymentStatsCardsProps {
  stats: PaymentStats | null;
}

export default function PaymentStatsCards({ stats }: PaymentStatsCardsProps) {
  const t = useTranslations('payments.stats');

  if (!stats) {
    return null;
  }

  const completedStats = stats.byStatus['completed'] || { count: 0, amount: 0 };
  const pendingStats = stats.byStatus['pending'] || { count: 0, amount: 0 };
  const failedStats = stats.byStatus['failed'] || { count: 0, amount: 0 };

  // Find most used payment method
  let topMethod = '—';
  let topMethodCount = 0;
  Object.entries(stats.byMethod).forEach(([method, data]) => {
    if (data.count > topMethodCount) {
      topMethod = method;
      topMethodCount = data.count;
    }
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
      {/* Total Payments */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-500">{t('totalPayments')}</div>
        <div className="mt-1 text-2xl font-bold">{stats.totalCount}</div>
      </div>

      {/* Total Amount */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm text-gray-600">{t('totalAmount')}</div>
        <div className="mt-1 text-2xl font-bold text-blue-700">
          {stats.totalAmount.toFixed(3)} OMR
        </div>
      </div>

      {/* Completed */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="text-sm text-gray-600">{t('completedPayments')}</div>
        <div className="mt-1 text-2xl font-bold text-green-700">
          {completedStats.count}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {completedStats.amount.toFixed(3)} OMR
        </div>
      </div>

      {/* Pending */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="text-sm text-gray-600">{t('pendingPayments')}</div>
        <div className="mt-1 text-2xl font-bold text-yellow-700">
          {pendingStats.count}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {pendingStats.amount.toFixed(3)} OMR
        </div>
      </div>

      {/* Failed */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-gray-600">{t('failedPayments')}</div>
        <div className="mt-1 text-2xl font-bold text-red-700">
          {failedStats.count}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {failedStats.amount.toFixed(3)} OMR
        </div>
      </div>

      {/* Top Method */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
        <div className="text-sm text-gray-600">{t('topMethod')}</div>
        <div className="mt-1 text-lg font-bold text-purple-700 uppercase">
          {topMethod}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {topMethodCount} payments
        </div>
      </div>
    </div>
  );
}
