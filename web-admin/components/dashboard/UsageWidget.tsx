/**
 * Usage Dashboard Widget
 * Compact widget for main dashboard showing usage at-a-glance
 * Displays top 3 resources with progress bars and warnings
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Button, ProgressBar, Badge } from '@/components/ui';
import type { UsageMetrics } from '@/lib/types/tenant';

interface UsageWidgetProps {
  tenantId?: string; // Optional, defaults to current tenant
  compact?: boolean; // If true, show even more compact version
}

export function UsageWidget({ tenantId, compact = false }: UsageWidgetProps) {
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
      <Card className={compact ? 'p-4' : 'p-6'}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  if (error || !usage) {
    return (
      <Card className={compact ? 'p-4' : 'p-6'}>
        <div className="text-center">
          <p className="text-sm text-red-600">
            {error || 'Failed to load usage data'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchUsage}
            className="mt-3"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={compact ? 'p-4' : 'p-6'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>
            Usage & Limits
          </h3>
          <p className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
            {new Date(usage.currentPeriod.start).toLocaleDateString()} -{' '}
            {new Date(usage.currentPeriod.end).toLocaleDateString()}
          </p>
        </div>
        {hasWarnings && (
          <Badge variant="warning" size="sm">
            {usage.warnings.length} {usage.warnings.length === 1 ? 'Warning' : 'Warnings'}
          </Badge>
        )}
      </div>

      {/* Top 3 Metrics */}
      <div className="space-y-4">
        {/* Orders */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
              Orders
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                {usage.usage.ordersCount} / {usage.limits.ordersLimit}
              </span>
              <Badge
                variant={
                  usage.usage.ordersPercentage >= 90
                    ? 'error'
                    : usage.usage.ordersPercentage >= 70
                    ? 'warning'
                    : 'success'
                }
                size="sm"
              >
                {usage.usage.ordersPercentage.toFixed(0)}%
              </Badge>
            </div>
          </div>
          <ProgressBar
            value={usage.usage.ordersPercentage}
            max={100}
            variant={getProgressVariant(usage.usage.ordersPercentage)}
            size={compact ? 'sm' : 'md'}
          />
        </div>

        {/* Users */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
              Users
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                {usage.usage.usersCount} / {usage.limits.usersLimit}
              </span>
              <Badge
                variant={
                  usage.usage.usersPercentage >= 90
                    ? 'error'
                    : usage.usage.usersPercentage >= 70
                    ? 'warning'
                    : 'success'
                }
                size="sm"
              >
                {usage.usage.usersPercentage.toFixed(0)}%
              </Badge>
            </div>
          </div>
          <ProgressBar
            value={usage.usage.usersPercentage}
            max={100}
            variant={getProgressVariant(usage.usage.usersPercentage)}
            size={compact ? 'sm' : 'md'}
          />
        </div>

        {/* Branches */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
              Branches
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                {usage.usage.branchesCount} / {usage.limits.branchesLimit}
              </span>
              <Badge
                variant={
                  usage.usage.branchesPercentage >= 90
                    ? 'error'
                    : usage.usage.branchesPercentage >= 70
                    ? 'warning'
                    : 'success'
                }
                size="sm"
              >
                {usage.usage.branchesPercentage.toFixed(0)}%
              </Badge>
            </div>
          </div>
          <ProgressBar
            value={usage.usage.branchesPercentage}
            max={100}
            variant={getProgressVariant(usage.usage.branchesPercentage)}
            size={compact ? 'sm' : 'md'}
          />
        </div>
      </div>

      {/* Warnings Section */}
      {hasWarnings && !compact && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="space-y-2">
            {usage.warnings.slice(0, 2).map((warning, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2 p-2 rounded-lg ${
                  warning.type === 'limit_exceeded'
                    ? 'bg-red-50'
                    : warning.type === 'limit_reached'
                    ? 'bg-orange-50'
                    : 'bg-yellow-50'
                }`}
              >
                <span className="text-lg">
                  {warning.type === 'limit_exceeded' ? '🔴' : '⚠️'}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-900">
                    {warning.resource.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-600">{warning.message}</p>
                </div>
              </div>
            ))}
            {usage.warnings.length > 2 && (
              <p className="text-xs text-gray-500 text-center">
                +{usage.warnings.length - 2} more warnings
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className={`flex items-center justify-between ${compact ? 'mt-3 space-x-2' : 'mt-6 space-x-3'}`}>
        <Link href="/dashboard/subscription" className="flex-1">
          <Button
            variant="secondary"
            size={compact ? 'sm' : 'md'}
            className="w-full"
          >
            View Details
          </Button>
        </Link>
        {highUsageCount > 0 && (
          <Link href="/dashboard/subscription" className="flex-1">
            <Button
              variant="primary"
              size={compact ? 'sm' : 'md'}
              className="w-full"
            >
              Upgrade Plan
            </Button>
          </Link>
        )}
      </div>

      {/* Refresh indicator */}
      <div className="mt-3 text-center">
        <button
          onClick={fetchUsage}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh usage data"
        >
          🔄 Refresh
        </button>
      </div>
    </Card>
  );
}
