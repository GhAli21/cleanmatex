/**
 * Plan Limits & Constraints Settings screen
 *
 * View-only summary of plan limits and current usage for the tenant.
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxProgressBar } from '@ui/feedback';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import type { UsageMetrics } from '@/lib/types/tenant';

/**
 *
 */
export function PlanLimitsSettings() {
  const t = useTranslations('settings.advancedSettings');
  const tSub = useTranslations('settings.subscriptionPage');
  const { formatNumber } = useTenantCurrency();
  const [metrics, setMetrics] = React.useState<UsageMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    void loadUsage();
  }, []);

  async function loadUsage() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/subscriptions/usage');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || t('loadErrorUsage'));
      }
      setMetrics(json.data as UsageMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadErrorUsage'));
    } finally {
      setLoading(false);
    }
  }

  const getProgressVariant = (percentage: number): 'default' | 'success' | 'warning' | 'danger' => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {t('loadingLimits')}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center py-12 text-danger-text text-sm">
        {error || t('loadErrorLimits')}
      </div>
    );
  }

  const { limits, usage } = metrics;

  return (
    <CmxCard>
      <CmxCardContent className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('planLimitsTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('planLimitsSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Orders */}
          <LimitCard
            title={tSub('orders')}
            used={usage.ordersCount}
            limit={limits.ordersLimit}
            percentage={usage.ordersPercentage}
          />

          {/* Users */}
          <LimitCard
            title={tSub('users')}
            used={usage.usersCount}
            limit={limits.usersLimit}
            percentage={usage.usersPercentage}
          />

          {/* Branches */}
          <LimitCard
            title={tSub('branches')}
            used={usage.branchesCount}
            limit={limits.branchesLimit}
            percentage={usage.branchesPercentage}
          />

          {/* Storage */}
          <LimitCard
            title={t('storageMbLabel')}
            used={usage.storageMb}
            limit={limits.storageMbLimit}
            percentage={usage.storagePercentage}
          />
        </div>
      </CmxCardContent>
    </CmxCard>
  );

  function LimitCard(props: { title: string; used: number; limit: number; percentage: number }) {
    const { title, used, limit, percentage } = props;
    const isUnlimited = limit < 0 || !Number.isFinite(limit);
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              {isUnlimited
                ? t('usedUnlimited', { used: formatNumber(used) })
                : t('usedOfLimit', { used: formatNumber(used), limit: formatNumber(limit) })}
            </p>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {formatNumber(percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
        </div>
        {!isUnlimited && (
          <CmxProgressBar
            value={percentage}
            variant={getProgressVariant(percentage)}
          />
        )}
      </div>
    );
  }
}

