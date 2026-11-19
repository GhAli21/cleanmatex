/**
 * Order Stats Cards Component
 *
 * Displays order statistics in card format.
 */

'use client';

import { useTranslations } from 'next-intl';
import type { OrderStats } from '@/types/order';

interface OrderStatsCardsProps {
  stats: OrderStats;
}

/**
 *
 * @param root0
 * @param root0.stats
 */
export function OrderStatsCards({ stats }: OrderStatsCardsProps) {
  const t = useTranslations('orders');
  
  const cards = [
    {
      label: t('totalOrders'),
      value: stats.total,
      color: 'bg-info-bg text-info-text',
      icon: '📦',
    },
    {
      label: t('pendingPrep'),
      value: stats.pending_preparation,
      color: 'bg-warning-bg text-warning-text',
      icon: '⏳',
    },
    {
      label: t('inProgress'),
      value: stats.processing,
      color: 'bg-info-bg text-info-text',
      icon: '🔄',
    },
    {
      label: t('ready'),
      value: stats.ready,
      color: 'bg-success-bg text-success-text',
      icon: '✅',
    },
    {
      label: t('statuses.outForDelivery'),
      value: stats.out_for_delivery,
      color: 'bg-info-bg text-info-text',
      icon: '🚚',
    },
    {
      label: t('deliveredToday'),
      value: stats.delivered_today,
      color: 'bg-info-bg text-info-text',
      icon: '📫',
    },
    {
      label: t('overdue'),
      value: stats.overdue,
      color: 'bg-danger-bg text-danger-text',
      icon: '⚠️',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.color} rounded-lg p-4 border border-border text-start`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">{card.icon}</span>
            <bdi className="text-2xl font-bold tabular-nums">{card.value}</bdi>
          </div>
          <div className="mt-2 text-sm font-medium text-start">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
