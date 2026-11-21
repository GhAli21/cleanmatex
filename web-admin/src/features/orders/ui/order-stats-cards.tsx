/**
 * Order Stats Cards Component
 *
 * Displays interactive order KPI cards built on CmxKpiStatCard.
 */

'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MailCheck,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { CmxKpiStatCard, type CmxKpiStatCardTone } from '@ui/data-display';
import { CmxButton } from '@ui/primitives';
import { cn } from '@/lib/utils';
import type { OrderStats } from '@/types/order';

interface OrderStatsCardsProps {
  stats: OrderStats;
  currentFilters?: Record<string, string | undefined>;
}

/**
 * Interactive KPI strip for `/dashboard/orders`.
 */
export function OrderStatsCards({ stats, currentFilters = {} }: OrderStatsCardsProps) {
  const t = useTranslations('orders');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applyFilter = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const cards: Array<{
    key: string;
    label: string;
    value: number;
    tone: CmxKpiStatCardTone;
    active: boolean;
    onClick: () => void;
    Icon: typeof Package;
  }> = [
    {
      key: 'total',
      label: t('totalOrders'),
      value: stats.total,
      tone: 'default',
      active: !currentFilters.status && !currentFilters.preparationStatus && currentFilters.overdue !== 'true',
      onClick: () => applyFilter({ status: null, preparationStatus: null, overdue: null }),
      Icon: Package,
    },
    {
      key: 'pending_prep',
      label: t('pendingPrep'),
      value: stats.pending_preparation,
      tone: stats.pending_preparation > 0 ? 'warning' : 'default',
      active: currentFilters.preparationStatus === 'pending' && currentFilters.overdue !== 'true',
      onClick: () => applyFilter({ status: null, preparationStatus: 'pending', overdue: null }),
      Icon: Clock,
    },
    {
      key: 'processing',
      label: t('inProgress'),
      value: stats.processing,
      tone: 'default',
      active: currentFilters.status === 'processing' && currentFilters.overdue !== 'true',
      onClick: () => applyFilter({ status: 'processing', preparationStatus: null, overdue: null }),
      Icon: RefreshCw,
    },
    {
      key: 'ready',
      label: t('ready'),
      value: stats.ready,
      tone: stats.ready > 0 ? 'success' : 'default',
      active: currentFilters.status === 'ready' && currentFilters.overdue !== 'true',
      onClick: () => applyFilter({ status: 'ready', preparationStatus: null, overdue: null }),
      Icon: CheckCircle2,
    },
    {
      key: 'out_for_delivery',
      label: t('statuses.outForDelivery'),
      value: stats.out_for_delivery,
      tone: 'default',
      active: currentFilters.status === 'out_for_delivery' && currentFilters.overdue !== 'true',
      onClick: () => applyFilter({ status: 'out_for_delivery', preparationStatus: null, overdue: null }),
      Icon: Truck,
    },
    {
      key: 'delivered_today',
      label: t('deliveredToday'),
      value: stats.delivered_today,
      tone: 'default',
      active: currentFilters.status === 'delivered' && currentFilters.overdue !== 'true',
      onClick: () => applyFilter({ status: 'delivered', preparationStatus: null, overdue: null }),
      Icon: MailCheck,
    },
    {
      key: 'overdue',
      label: t('overdue'),
      value: stats.overdue,
      tone: stats.overdue > 0 ? 'danger' : 'default',
      active: currentFilters.overdue === 'true',
      onClick: () => applyFilter({ status: null, preparationStatus: null, overdue: 'true', sortBy: 'ready_by', sortOrder: 'asc' }),
      Icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => {
        const CardIcon = card.Icon;
        return (
          <CmxButton
            key={card.key}
            type="button"
            variant="ghost"
            aria-pressed={card.active}
            onClick={card.onClick}
            className="block h-auto w-full rounded-lg p-0 text-start font-normal hover:bg-transparent"
          >
            <CmxKpiStatCard
              title={card.label}
              value={card.value}
              tone={card.tone}
              icon={<CardIcon className="h-4 w-4" aria-hidden="true" />}
              className={cn(
                'transition-shadow hover:shadow-md',
                card.active && 'ring-2 ring-ring',
              )}
            />
          </CmxButton>
        );
      })}
    </div>
  );
}
