/**
 * Plan Limits & Constraints Settings screen
 *
 * View-only summary of plan limits and current usage for the tenant.
 */

'use client';

import React from 'react';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxProgressBar } from '@ui/feedback';
import type { UsageMetrics } from '@/lib/types/tenant';

export function PlanLimitsSettings() {
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
        throw new Error(json?.error || 'Failed to load usage metrics');
      }
      setMetrics(json.data as UsageMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage metrics');
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
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        Loading plan limits...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center py-12 text-red-600 text-sm">
        {error || 'Failed to load plan limits'}
      </div>
    );
  }

  const { limits, usage } = metrics;

  return (
    <CmxCard>
      <CmxCardContent className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Plan Limits & Usage</h2>
          <p className="text-sm text-gray-500">
            View your current plan constraints and how much you have used.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Orders */}
          <LimitCard
            title="Orders"
            used={usage.ordersCount}
            limit={limits.ordersLimit}
            percentage={usage.ordersPercentage}
          />

          {/* Users */}
          <LimitCard
            title="Users"
            used={usage.usersCount}
            limit={limits.usersLimit}
            percentage={usage.usersPercentage}
          />

          {/* Branches */}
          <LimitCard
            title="Branches"
            used={usage.branchesCount}
            limit={limits.branchesLimit}
            percentage={usage.branchesPercentage}
          />

          {/* Storage */}
          <LimitCard
            title="Storage (MB)"
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
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">
              {isUnlimited
                ? `${used.toLocaleString()} used (Unlimited)`
                : `${used.toLocaleString()} / ${limit.toLocaleString()} used`}
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {percentage.toFixed(1)}%
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

