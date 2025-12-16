/**
 * Processing Stats Cards Component
 * Real-time statistics display for the processing queue
 */

'use client';

import { useTranslations } from 'next-intl';
import type { ProcessingStats } from '@/types/processing';

interface ProcessingStatsCardsProps {
  stats: ProcessingStats;
}

export function ProcessingStatsCards({ stats }: ProcessingStatsCardsProps) {
  const t = useTranslations('processing.stats');

  const statItems = [
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
      format: (val: number) => `OMR ${val.toFixed(3)}`,
    },
    {
      label: t('unpaid'),
      value: stats.unpaid,
      format: (val: number) => `OMR ${val.toFixed(3)}`,
      highlight: true,
    },
  ];

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
