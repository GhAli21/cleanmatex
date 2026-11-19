/**
 * Processing Stats Cards Component
 * Queue-wide KPI strip built on CmxKpiStatCard.
 */

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Clock, Coins, Layers, Package } from 'lucide-react';
import { CmxKpiStatCard, type CmxKpiStatCardTone } from '@ui/data-display/cmx-kpi-stat-card';
import type { ProcessingStats } from '@/types/processing';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

interface ProcessingStatsCardsProps {
  stats: ProcessingStats;
}

/**
 * Displays real-time KPIs for the processing queue using CmxKpiStatCard.
 * @param props Queue KPI stats.
 */
export function ProcessingStatsCards(props: ProcessingStatsCardsProps) {
  const { stats } = props;
  const t = useTranslations('processing.stats');
  const { formatMoneyWithCode } = useTenantCurrency();

  const statItems = useMemo(
    () => [
      {
        key: 'orders',
        title: t('orders'),
        subtitle: t('ordersSubtitle'),
        value: stats.orders.toLocaleString(),
        icon: <Package className="h-4 w-4 text-muted-foreground" aria-hidden />,
        tone: 'default' as CmxKpiStatCardTone,
      },
      {
        key: 'pieces',
        title: t('pieces'),
        subtitle: t('piecesSubtitle'),
        value: stats.pieces.toLocaleString(),
        icon: <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />,
        tone: 'default' as CmxKpiStatCardTone,
      },
      {
        key: 'overdue',
        title: t('overdue'),
        subtitle: t('overdueSubtitle'),
        value: stats.overdue.toLocaleString(),
        icon: (
          <Clock
            className={stats.overdue > 0 ? 'h-4 w-4 text-danger-text' : 'h-4 w-4 text-muted-foreground'}
            aria-hidden
          />
        ),
        tone: (stats.overdue > 0 ? 'danger' : 'default') as CmxKpiStatCardTone,
      },
      {
        key: 'issues',
        title: t('issues'),
        subtitle: t('issuesSubtitle'),
        value: stats.issues.toLocaleString(),
        icon: (
          <AlertTriangle
            className={stats.issues > 0 ? 'h-4 w-4 text-warning-text' : 'h-4 w-4 text-muted-foreground'}
            aria-hidden
          />
        ),
        tone: (stats.issues > 0 ? 'warning' : 'default') as CmxKpiStatCardTone,
      },
      {
        key: 'unpaid',
        title: t('unpaid'),
        subtitle: t('unpaidSubtitle'),
        value: formatMoneyWithCode(stats.unpaid),
        icon: (
          <Coins
            className={stats.unpaid > 0 ? 'h-4 w-4 text-warning-text' : 'h-4 w-4 text-muted-foreground'}
            aria-hidden
          />
        ),
        tone: (stats.unpaid > 0 ? 'warning' : 'default') as CmxKpiStatCardTone,
      },
    ],
    [formatMoneyWithCode, stats.issues, stats.orders, stats.overdue, stats.pieces, stats.unpaid, t]
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {statItems.map((item) => (
        <CmxKpiStatCard
          key={item.key}
          title={item.title}
          subtitle={item.subtitle}
          value={item.value}
          icon={item.icon}
          tone={item.tone}
        />
      ))}
    </div>
  );
}
