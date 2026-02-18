'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui';
import { Package, AlertTriangle, XCircle, TrendingDown, DollarSign } from 'lucide-react';
import type { InventoryStatistics } from '@/lib/types/inventory';

interface StatsCardsProps {
  stats: InventoryStatistics;
  branchName?: string;
}

export default function StatsCards({ stats, branchName }: StatsCardsProps) {
  const t = useTranslations('inventory.stats');
  const atBranch = branchName ? t('atBranch', { branch: branchName }) : t('allBranches');

  const cards = [
    {
      label: t('totalItems'),
      value: stats.totalItems,
      icon: Package,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: t('lowStock'),
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      label: t('outOfStock'),
      value: stats.outOfStockCount,
      icon: XCircle,
      color: 'text-red-600 bg-red-50',
    },
    {
      label: t('negativeStock'),
      value: stats.negativeStockCount,
      icon: TrendingDown,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: t('totalStockValue'),
      value: stats.totalStockValue.toFixed(2),
      icon: DollarSign,
      color: 'text-green-600 bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-xs text-gray-400">{atBranch}</p>
              <p className="text-xl font-semibold">{card.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
