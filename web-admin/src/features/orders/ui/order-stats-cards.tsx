/**
 * Order Stats Cards Component
 *
 * Displays order statistics in card format.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import type { OrderStats } from '@/types/order';

interface OrderStatsCardsProps {
  stats: OrderStats;
}

export function OrderStatsCards({ stats }: OrderStatsCardsProps) {
  const t = useTranslations('orders');
  const isRTL = useRTL();
  
  const cards = [
    {
      label: t('totalOrders'),
      value: stats.total,
      color: 'bg-blue-50 text-blue-700',
      icon: '📦',
    },
    {
      label: t('pendingPrep'),
      value: stats.pending_preparation,
      color: 'bg-yellow-50 text-yellow-700',
      icon: '⏳',
    },
    {
      label: t('inProgress'),
      value: stats.processing,
      color: 'bg-purple-50 text-purple-700',
      icon: '🔄',
    },
    {
      label: t('ready'),
      value: stats.ready,
      color: 'bg-green-50 text-green-700',
      icon: '✅',
    },
    {
      label: t('statuses.outForDelivery'),
      value: stats.out_for_delivery,
      color: 'bg-indigo-50 text-indigo-700',
      icon: '🚚',
    },
    {
      label: t('deliveredToday'),
      value: stats.delivered_today,
      color: 'bg-teal-50 text-teal-700',
      icon: '📫',
    },
    {
      label: t('overdue'),
      value: stats.overdue,
      color: 'bg-red-50 text-red-700',
      icon: '⚠️',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.color} rounded-lg p-4 border border-gray-200 ${isRTL ? 'text-right' : 'text-left'}`}
        >
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <span className="text-2xl">{card.icon}</span>
            <span className="text-2xl font-bold">{card.value}</span>
          </div>
          <div className={`mt-2 text-sm font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{card.label}</div>
        </div>
      ))}
    </div>
  );
}
