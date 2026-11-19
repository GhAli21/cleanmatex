/**
 * Usage Dashboard Widget
 * Compact widget for main dashboard showing usage at-a-glance
 * Displays top 3 resources with progress bars and warnings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CmxCard, CmxButton } from '@ui/primitives';
import { CmxProgressBar, CmxStatusBadge } from '@ui/feedback';
import type { UsageMetrics } from '@/lib/types/tenant';

interface UsageWidgetProps {
  tenantId?: string; // Optional, defaults to current tenant
  compact?: boolean; // If true, show even more compact version
}

/**
 *
 * @param root0
 * @param root0.tenantId
 * @param root0.compact
 */
export function UsageWidget({ tenantId, compact = false }: UsageWidgetProps) {
  const tCommon = useTranslations('common');
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsage();
  }, [tenantId]);

  const fetchUsage = async () => {
    setIsLoading(true);
    setError('');
    
    return; // jh

    try {
      const response = await fetch('/api/v1/subscriptions/usage');

      if (!response.ok) {
        throw new Error('Failed to fetch usage metrics');
      }

      const data = await response.json();
      setUsage(data.data);
    } catch (err: unknown) {
      let errorMessage = 'Failed to load usage data';
      if (err instanceof Error) {
        errorMessage = (err as Error).message;
      } else if (typeof err === 'string') {
        errorMessage = err as string;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressVariant = (percentage: number): 'default' | 'success' | 'warning' | 'danger' => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const hasWarnings = usage && usage.warnings.length > 0;
  const highUsageCount = usage
    ? [
        usage.usage.ordersPercentage,
        usage.usage.usersPercentage,
        usage.usage.branchesPercentage,
      ].filter((p) => p > 80).length
    : 0;

  if (isLoading) {
    return (
      <CmxCard className={compact ? 'p-4' : 'p-6'}>
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/2 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
          </div>
        </div>
      </CmxCard>
    );
  }

  if (error || !usage) {
    return (
      <CmxCard className={compact ? 'p-4' : 'p-6'}>
        <div className="text-center">
          <p className="text-sm text-danger-text">
            {error || 'Failed to load usage data'}
          </p>
          <CmxButton
            variant="secondary"
            size="sm"
            onClick={fetchUsage}
            className="mt-3"
          >
            Retry
          </CmxButton>
        </div>
      </CmxCard>
    );
  }

  return (
    <CmxCard className={compact ? 'p-4' : 'p-6'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-semibold text-foreground ${compact ? 'text-base' : 'text-lg'}`}>
            Usage & Limits
          </h3>
          <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
            {new Date(usage.currentPeriod.start).toLocaleDateString()} -{' '}
            {new Date(usage.currentPeriod.end).toLocaleDateString()}
          </p>
        </div>
        {hasWarnings && (
          <CmxStatusBadge size="sm" tone="warning" className="text-xs">
            {tCommon('warningCount', { count: usage.warnings.length })}
          </CmxStatusBadge>
        )}
      </div>

      {/* Top 3 Metrics */}
      <div className="space-y-4">
        {/* Orders */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
              Orders
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                {usage.usage.ordersCount} / {usage.limits.ordersLimit}
              </span>
              <CmxStatusBadge size="sm"
                tone={
                  usage.usage.ordersPercentage >= 90
                    ? 'danger'
                    : usage.usage.ordersPercentage >= 70
                    ? 'warning'
                    : 'success'
                }
                className="text-xs"
              >
                {usage.usage.ordersPercentage.toFixed(0)}%
              </CmxStatusBadge>
            </div>
          </div>
          <CmxProgressBar
            value={usage.usage.ordersPercentage}
            max={100}
            variant={getProgressVariant(usage.usage.ordersPercentage)}
            size={compact ? 'sm' : 'md'}
          />
        </div>

        {/* Users */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
              Users
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                {usage.usage.usersCount} / {usage.limits.usersLimit}
              </span>
              <CmxStatusBadge size="sm"
                tone={
                  usage.usage.usersPercentage >= 90
                    ? 'danger'
                    : usage.usage.usersPercentage >= 70
                    ? 'warning'
                    : 'success'
                }
                className="text-xs"
              >
                {usage.usage.usersPercentage.toFixed(0)}%
              </CmxStatusBadge>
            </div>
          </div>
          <CmxProgressBar
            value={usage.usage.usersPercentage}
            max={100}
            variant={getProgressVariant(usage.usage.usersPercentage)}
            size={compact ? 'sm' : 'md'}
          />
        </div>

        {/* Branches */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
              Branches
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                {usage.usage.branchesCount} / {usage.limits.branchesLimit}
              </span>
              <CmxStatusBadge size="sm"
                tone={
                  usage.usage.branchesPercentage >= 90
                    ? 'danger'
                    : usage.usage.branchesPercentage >= 70
                    ? 'warning'
                    : 'success'
                }
                className="text-xs"
              >
                {usage.usage.branchesPercentage.toFixed(0)}%
              </CmxStatusBadge>
            </div>
          </div>
          <CmxProgressBar
            value={usage.usage.branchesPercentage}
            max={100}
            variant={getProgressVariant(usage.usage.branchesPercentage)}
            size={compact ? 'sm' : 'md'}
          />
        </div>
      </div>

      {/* Warnings Section */}
      {hasWarnings && !compact && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="space-y-2">
            {usage.warnings.slice(0, 2).map((warning, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2 p-2 rounded-lg ${
                  warning.type === 'limit_exceeded'
                    ? 'bg-danger-bg'
                    : warning.type === 'limit_reached'
                    ? 'bg-warning-bg'
                    : 'bg-warning-bg'
                }`}
              >
                <span className="text-lg">
                  {warning.type === 'limit_exceeded' ? '🔴' : '⚠️'}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {warning.resource.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">{warning.message}</p>
                </div>
              </div>
            ))}
            {usage.warnings.length > 2 && (
              <p className="text-xs text-muted-foreground text-center">
                +{usage.warnings.length - 2} more warnings
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className={`flex items-center justify-between ${compact ? 'mt-3 space-x-2' : 'mt-6 space-x-3'}`}>
        <Link href="/dashboard/tenant-admin/subscription" className="flex-1">
          <CmxButton
            variant="secondary"
            size={compact ? 'sm' : 'md'}
            className="w-full"
          >
            View Details
          </CmxButton>
        </Link>
        {highUsageCount > 0 && (
          <Link href="/dashboard/tenant-admin/subscription" className="flex-1">
            <CmxButton
              variant="primary"
              size={compact ? 'sm' : 'md'}
              className="w-full"
            >
              Upgrade Plan
            </CmxButton>
          </Link>
        )}
      </div>

      {/* Refresh indicator */}
      <div className="mt-3 text-center">
        <button
          onClick={fetchUsage}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh usage data"
        >
          🔄 Refresh
        </button>
      </div>
    </CmxCard>
  );
}
