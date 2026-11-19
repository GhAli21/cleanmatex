'use client';

import { useTranslations } from 'next-intl';
import { CmxCard } from '@ui/primitives';
import { Package, AlertTriangle, XCircle, TrendingDown, DollarSign } from 'lucide-react';
import type { InventoryStatistics } from '@/lib/types/inventory';

interface StatsCardsProps {
  stats: InventoryStatistics;
  branchName?: string;
}

/**
 *
 * @param root0
 * @param root0.stats
 * @param root0.branchName
 */
export default function StatsCards({ stats, branchName }: StatsCardsProps) {
  const t = useTranslations('inventory.stats');
  const atBranch = branchName ? t('atBranch', { branch: branchName }) : t('allBranches');

  const cards = [
    {
      label: t('totalItems'),
      value: stats.totalItems,
      icon: Package,
      color: 'text-info-text bg-info-bg',
    },
    {
      label: t('lowStock'),
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: 'text-warning-text bg-warning-bg',
    },
    {
      label: t('outOfStock'),
      value: stats.outOfStockCount,
      icon: XCircle,
      color: 'text-danger-text bg-danger-bg',
    },
    {
      label: t('negativeStock'),
      value: stats.negativeStockCount,
      icon: TrendingDown,
      color: 'text-warning-text bg-warning-bg',
    },
    {
      label: t('totalStockValue'),
      value: stats.totalStockValue.toFixed(2),
      icon: DollarSign,
      color: 'text-success-text bg-success-bg',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <CmxCard key={card.label} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-xs text-muted-foreground">{atBranch}</p>
              <p className="text-xl font-semibold">{card.value}</p>
            </div>
          </div>
        </CmxCard>
      ))}
    </div>
  );
}
