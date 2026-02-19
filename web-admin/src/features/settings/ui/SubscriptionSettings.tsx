/**
 * Subscription Settings Tab
 * View current subscription and plan details (read-only, links to subscription page)
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@ui/compat';
import { Badge, CmxButton } from '@ui/primitives';
import { CmxProgressBar } from '@ui/feedback';
import type { Tenant } from '@/lib/types/tenant';

interface SubscriptionSettingsProps {
  tenant: Tenant;
}

export function SubscriptionSettings({ tenant }: SubscriptionSettingsProps) {
  const router = useRouter();

  // @ts-expect-error - subscription is added in API response
  const subscription = tenant.subscription;
  // @ts-expect-error
  const usage = tenant.usage;

  if (!subscription) {
    return (
      <Card>
        <p className="text-gray-600">Loading subscription information...</p>
      </Card>
    );
  }

  const planNames: Record<string, string> = {
    free: 'Free Trial',
    starter: 'Starter',
    growth: 'Growth',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader
          title="Current Plan"
          subtitle="Your subscription details and features"
          actions={
            <Button
              onClick={() => router.push('/dashboard/subscription')}
            >
              Manage Subscription
            </Button>
          }
        />

        <div className="space-y-4">
          {/* Plan Info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {planNames[subscription.plan] || subscription.plan}
              </h3>
              <p className="text-gray-600">
                {subscription.status === 'trial' && subscription.trialEnds && (
                  <>
                    Trial ends on{' '}
                    {new Date(subscription.trialEnds).toLocaleDateString()}
                  </>
                )}
                {subscription.status === 'active' && 'Active subscription'}
              </p>
            </div>
            <Badge
              variant={
                subscription.status === 'trial'
                  ? 'warning'
                  : subscription.status === 'active'
                  ? 'success'
                  : 'default'
              }
            >
              {subscription.status.toUpperCase()}
            </Badge>
          </div>

          {/* Usage Metrics */}
          {usage && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold text-gray-900">Current Usage</h4>

              <CmxProgressBar
                label={`Orders: ${usage.usage.ordersCount} / ${usage.limits.ordersLimit}`}
                value={usage.usage.ordersCount}
                max={usage.limits.ordersLimit}
                showPercentage
              />

              <CmxProgressBar
                label={`Users: ${usage.usage.usersCount} / ${usage.limits.usersLimit}`}
                value={usage.usage.usersCount}
                max={usage.limits.usersLimit}
                showPercentage
              />

              <CmxProgressBar
                label={`Branches: ${usage.usage.branchesCount} / ${usage.limits.branchesLimit}`}
                value={usage.usage.branchesCount}
                max={usage.limits.branchesLimit}
                showPercentage
              />
            </div>
          )}
        </div>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader
          title="Enabled Features"
          subtitle="Features available on your current plan"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tenant.feature_flags && Object.entries(tenant.feature_flags).map(([key, enabled]) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
            >
              <span className="text-sm text-gray-700">
                {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </span>
              {enabled ? (
                <span className="text-green-600 font-medium">✓ Enabled</span>
              ) : (
                <span className="text-gray-400">Disabled</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader
          title="Subscription Actions"
          subtitle="Manage your subscription plan"
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <CmxButton
            className="w-full"
            onClick={() => router.push('/dashboard/subscription')}
          >
            View All Plans
          </CmxButton>
          {subscription.plan !== 'free' && (
            <CmxButton
              variant="outline"
              className="w-full"
              onClick={() => router.push('/dashboard/subscription?action=cancel')}
            >
              Cancel Subscription
            </CmxButton>
          )}
        </div>
      </Card>
    </div>
  );
}
