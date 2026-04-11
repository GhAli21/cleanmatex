/**
 * Processing Stats Cards Component
 * Real-time statistics display for the processing queue
 */

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { ProcessingStats } from '@/types/processing';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

interface ProcessingStatsCardsProps {
  stats: ProcessingStats;
}

export function ProcessingStatsCards({ stats }: ProcessingStatsCardsProps) {
  const t = useTranslations('processing.stats');
  const { formatMoneyWithCode } = useTenantCurrency();

  const statItems = useMemo(
    () => [
      {
        label: t('orders'),
        value: stats.orders,
        format: (val: number) => val.toString(),
      },
      {
        label: t('pieces'),
        value: stats.pieces,
        format: (val: number) => val.toString(),
      },
      {
        label: t('weight'),
        value: stats.weight,
        format: (val: number) => `${val}kg`,
      },
      {
        label: t('value'),
        value: stats.value,
        format: (val: number) => formatMoneyWithCode(val),
      },
      {
        label: t('unpaid'),
        value: stats.unpaid,
        format: (val: number) => formatMoneyWithCode(val),
        highlight: true,
      },
    ],
    [formatMoneyWithCode, stats.orders, stats.pieces, stats.unpaid, stats.value, stats.weight, t]
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {statItems.map((item) => (
        <div
          key={item.label}
          className={`bg-white rounded-lg border p-4 ${
            item.highlight ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
          }`}
        >
          <div className="text-sm text-gray-600 mb-1">{item.label}</div>
          <div
            className={`text-2xl font-bold ${
              item.highlight ? 'text-orange-600' : 'text-gray-900'
            }`}
          >
            {item.format(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
