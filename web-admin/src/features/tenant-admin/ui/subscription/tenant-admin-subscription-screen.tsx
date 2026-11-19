/**
 * Tenant Admin — Subscription & Billing screen.
 * Route: /dashboard/tenant-admin/subscription
 */

'use client';

import React, { useState, useEffect } from 'react';
import { CmxCard } from '@ui/primitives/cmx-card';
import {
  CmxButton,
  CmxRadio,
  CmxSelect,
  CmxTextarea,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxProgressBar, CmxStatusBadge } from '@ui/feedback';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import type {
  PlanComparison,
  UsageMetrics,
  Tenant,
  Subscription,
} from '@/lib/types/tenant';
import { useLocale } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { invalidateTenantFeatureFlags } from '@/lib/query/feature-flag-keys';

/**
 *
 */
export function TenantAdminSubscriptionScreen() {
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const [plans, setPlans] = useState<PlanComparison[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanComparison | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPricing, setShowPricing] = useState<'monthly' | 'yearly'>('monthly');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFeedback, setCancelFeedback] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const locale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const fmtPlanMoney = (amount: number) =>
    formatMoneyAmountWithCode(amount, { currencyCode, decimalPlaces, locale: moneyLocale });

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Fetch all data in parallel
      const [plansRes, usageRes, tenantRes] = await Promise.all([
        fetch('/api/v1/subscriptions/plans'),
        fetch('/api/v1/subscriptions/usage'),
        fetch('/api/v1/tenants/me'),
      ]);

      if (!plansRes.ok || !usageRes.ok || !tenantRes.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const plansData = await plansRes.json();
      const usageData = await usageRes.json();
      const tenantData = await tenantRes.json();

      setPlans(plansData.data.plans);
      setCurrentPlan(plansData.data.currentPlan);
      setUsage(usageData.data);
      setTenant(tenantData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradeClick = (plan: PlanComparison) => {
    setSelectedPlan(plan);
    setBillingCycle('monthly');
    setShowUpgradeModal(true);
    setError('');
    setSuccess('');
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/v1/subscriptions/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planCode: selectedPlan.plan_code,
          billingCycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upgrade failed');
      }

      setSuccess(`Successfully upgraded to ${selectedPlan.plan_name}!`);
      setShowUpgradeModal(false);
      void invalidateTenantFeatureFlags(queryClient, currentTenant?.tenant_id);

      // Refresh data after 1 second
      setTimeout(() => {
        fetchSubscriptionData();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelClick = () => {
    setCancelReason('');
    setCancelFeedback('');
    setShowCancelModal(true);
    setError('');
    setSuccess('');
  };

  const handleCancel = async () => {
    if (!cancelReason) {
      setError('Please select a cancellation reason');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/v1/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          feedback: cancelFeedback,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Cancellation failed');
      }

      setSuccess('Subscription will be canceled at the end of the billing period');
      setShowCancelModal(false);
      void invalidateTenantFeatureFlags(queryClient, currentTenant?.tenant_id);

      // Refresh data
      setTimeout(() => {
        fetchSubscriptionData();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const getProgressVariant = (percentage: number): 'default' | 'success' | 'warning' | 'danger' => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const getDaysRemaining = (trialEnd: string): number => {
    const now = new Date();
    const end = new Date(trialEnd);
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CmxSummaryMessage
          type="error"
          title="Error Loading Subscription"
          message={error}
        />
      </div>
    );
  }

  const isOnTrial = tenant?.status === 'trial';
  const isPaidPlan = currentPlan && currentPlan !== 'free';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Subscription & Billing
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage your plan and view usage
            </p>
          </div>
          {tenant && (
            <CmxStatusBadge size="sm"
              tone={
                tenant.status === 'active' ? 'success' :
                tenant.status === 'trial' ? 'info' :
                tenant.status === 'suspended' ? 'warning' : 'brand'
              }
            >
              {tenant.status.toUpperCase()}
            </CmxStatusBadge>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <CmxSummaryMessage
          type="success"
          title="Success"
          message={success}
          className="mb-6"
        />
      )}
      {error && (
        <CmxSummaryMessage
          type="error"
          title="Error"
          message={error}
          className="mb-6"
        />
      )}

      {/* Trial Countdown Banner */}
      {isOnTrial && tenant?.status === 'trial' && (
        <CmxSummaryMessage
          type="warning"
          title="Trial Period Active"
          message={`You have ${tenant?.status === 'trial' && usage ? getDaysRemaining(usage.currentPeriod.end) : 0} days remaining in your free trial. Upgrade now to unlock all features!`}
          className="mb-6"
        >
          <CmxButton
            variant="primary"
            size="sm"
            onClick={() => {
              const starterPlan = plans.find(p => p.plan_code === 'starter');
              if (starterPlan) handleUpgradeClick(starterPlan);
            }}
            className="mt-2"
          >
            Upgrade Now
          </CmxButton>
        </CmxSummaryMessage>
      )}

      {/* Current Plan Card */}
      <CmxCard className="mb-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {plans.find(p => p.plan_code === currentPlan)?.plan_name || 'Loading...'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {fmtPlanMoney(Number(plans.find(p => p.plan_code === currentPlan)?.price_monthly || 0))}/month
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isOnTrial ? 'Trial Ends' : 'Next Billing Date'}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {usage?.currentPeriod.end ? new Date(usage.currentPeriod.end).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>
        </div>
      </CmxCard>

      {/* Usage Metrics Section */}
      {usage && (
        <CmxCard className="mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Usage & Limits</h2>
              <p className="text-sm text-muted-foreground">
                Period: {new Date(usage.currentPeriod.start).toLocaleDateString()} - {new Date(usage.currentPeriod.end).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-6">
              {/* Orders Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Orders
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {usage.usage.ordersCount} / {usage.limits.ordersLimit}
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.ordersPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.ordersPercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {usage.usage.ordersPercentage.toFixed(1)}% used
                </p>
              </div>

              {/* Users Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Users
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {usage.usage.usersCount} / {usage.limits.usersLimit}
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.usersPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.usersPercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {usage.usage.usersPercentage.toFixed(1)}% used
                </p>
              </div>

              {/* Branches Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Branches
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {usage.usage.branchesCount} / {usage.limits.branchesLimit}
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.branchesPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.branchesPercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {usage.usage.branchesPercentage.toFixed(1)}% used
                </p>
              </div>

              {/* Storage Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Storage
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {usage.usage.storageMb} MB / {usage.limits.storageMbLimit} MB
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.storagePercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.storagePercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {usage.usage.storagePercentage.toFixed(1)}% used
                </p>
              </div>
            </div>

            {/* Warnings */}
            {usage.warnings.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  ⚠️ Warnings ({usage.warnings.length})
                </h3>
                <div className="space-y-2">
                  {usage.warnings.map((warning, idx) => (
                    <CmxSummaryMessage
                      key={idx}
                      type={warning.type === 'limit_exceeded' ? 'error' : 'warning'}
                      title={warning.resource.toUpperCase()}
                      message={warning.message}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CmxCard>
      )}

      {/* Plan Comparison Table */}
      <CmxCard className="mb-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Available Plans</h2>
            <div className="flex items-center space-x-2">
              <CmxButton
                type="button"
                variant={showPricing === 'monthly' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowPricing('monthly')}
              >
                Monthly
              </CmxButton>
              <CmxButton
                type="button"
                variant={showPricing === 'yearly' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowPricing('yearly')}
              >
                Yearly
                <span className="ms-1 text-xs">(Save 20%)</span>
              </CmxButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Plan
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Price
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Orders
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Users
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Branches
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Key Features
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card divide-y divide-border">
                {plans.map((plan) => {
                  const price = showPricing === 'yearly' && plan.price_yearly
                    ? plan.price_yearly / 12
                    : plan.price_monthly;

                  return (
                    <TableRow
                      key={plan.plan_code}
                      className={plan.isCurrentPlan ? 'bg-info-bg' : ''}
                    >
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-foreground">
                            {plan.plan_name}
                          </span>
                          {plan.isCurrentPlan && (
                            <CmxStatusBadge size="sm" tone="success">
                              Current
                            </CmxStatusBadge>
                          )}
                          {plan.plan_code === 'growth' && !plan.isCurrentPlan && (
                            <CmxStatusBadge size="sm" tone="info">
                              Recommended
                            </CmxStatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap tabular-nums">
                        <bdi dir="ltr" className="text-lg font-bold text-foreground">
                          {fmtPlanMoney(price)}
                        </bdi>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground tabular-nums">
                        {plan.orders_limit === 999999 ? 'Unlimited' : plan.orders_limit}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground tabular-nums">
                        {plan.users_limit === 999999 ? 'Unlimited' : plan.users_limit}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground tabular-nums">
                        {plan.branches_limit === 999999 ? 'Unlimited' : plan.branches_limit}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {plan.feature_flags.pdf_invoices && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">PDF</CmxStatusBadge>
                          )}
                          {plan.feature_flags.whatsapp_receipts && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">WhatsApp</CmxStatusBadge>
                          )}
                          {plan.feature_flags.driver_app && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">Driver App</CmxStatusBadge>
                          )}
                          {plan.feature_flags.multi_branch && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">Multi-Branch</CmxStatusBadge>
                          )}
                          {plan.feature_flags.api_access && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">API</CmxStatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        {plan.isCurrentPlan ? (
                          <CmxButton variant="secondary" size="sm" disabled>
                            Current Plan
                          </CmxButton>
                        ) : plan.display_order && currentPlan &&
                           plans.find(p => p.plan_code === currentPlan)?.display_order &&
                           plan.display_order > plans.find(p => p.plan_code === currentPlan)!.display_order! ? (
                          <CmxButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpgradeClick(plan)}
                          >
                            Upgrade
                          </CmxButton>
                        ) : (
                          <CmxButton variant="secondary" size="sm" disabled>
                            Downgrade
                          </CmxButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CmxCard>

      {/* Cancel Subscription Button */}
      {isPaidPlan && tenant?.status !== 'canceled' && (
        <div className="flex justify-end">
          <CmxButton
            variant="destructive"
            size="md"
            onClick={handleCancelClick}
          >
            Cancel Subscription
          </CmxButton>
        </div>
      )}

      {/* Upgrade Modal */}
      <CmxDialog
        open={Boolean(showUpgradeModal && selectedPlan)}
        onOpenChange={(next) => {
          if (!next && !isProcessing) setShowUpgradeModal(false);
        }}
      >
        <CmxDialogContent className="max-w-2xl w-full p-6" scrollBody>
          {selectedPlan && (
            <>
              <CmxDialogHeader className="mb-6">
                <CmxDialogTitle className="text-2xl font-bold">
                  Upgrade to {selectedPlan.plan_name}
                </CmxDialogTitle>
              </CmxDialogHeader>

              {error && (
                <CmxSummaryMessage
                  type="error"
                  title="Error"
                  message={error}
                  className="mb-4"
                />
              )}

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Select Billing Cycle
                </h3>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <CmxRadio
                      name="billingCycle"
                      value="monthly"
                      checked={billingCycle === 'monthly'}
                      onChange={(e) => setBillingCycle(e.target.value as 'monthly')}
                      disabled={isProcessing}
                      label={
                        <span className="tabular-nums">
                          Monthly - {fmtPlanMoney(Number(selectedPlan.price_monthly))}/mo
                        </span>
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <CmxRadio
                      name="billingCycle"
                      value="yearly"
                      checked={billingCycle === 'yearly'}
                      onChange={(e) => setBillingCycle(e.target.value as 'yearly')}
                      disabled={isProcessing}
                      label={
                        <span className="tabular-nums">
                          Yearly - {fmtPlanMoney(
                            selectedPlan.price_yearly
                              ? Number(selectedPlan.price_yearly) / 12
                              : Number(selectedPlan.price_monthly) * 12
                          )}/mo
                          {selectedPlan.price_yearly && (
                            <span className="ms-2 text-success-text font-semibold">
                              Save 20%!
                            </span>
                          )}
                        </span>
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-info-bg rounded-lg">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  New Features You&apos;ll Get:
                </h3>
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedPlan.feature_flags.pdf_invoices && <li>✓ PDF Invoices</li>}
                  {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ WhatsApp Receipts</li>}
                  {selectedPlan.feature_flags.driver_app && <li>✓ Driver App</li>}
                  {selectedPlan.feature_flags.multi_branch && <li>✓ Multi-Branch Support</li>}
                  {selectedPlan.feature_flags.advanced_analytics && <li>✓ Advanced Analytics</li>}
                  {selectedPlan.feature_flags.api_access && <li>✓ API Access</li>}
                </ul>
              </div>

              <div className="mb-6 p-4 bg-muted rounded-lg">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Payment Integration
                </h3>
                <p className="text-sm text-muted-foreground">
                  Payment gateway integration coming soon. For now, your plan will be upgraded immediately
                  and you&apos;ll receive an invoice via email.
                </p>
              </div>

              <div className="flex space-x-4">
                <CmxButton
                  variant="secondary"
                  size="md"
                  onClick={() => setShowUpgradeModal(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Cancel
                </CmxButton>
                <CmxButton
                  variant="primary"
                  size="md"
                  onClick={handleUpgrade}
                  loading={isProcessing}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Processing...' : 'Confirm Upgrade'}
                </CmxButton>
              </div>
            </>
          )}
        </CmxDialogContent>
      </CmxDialog>

      {/* Cancel Subscription Modal */}
      <CmxDialog
        open={showCancelModal}
        onOpenChange={(next) => {
          if (!next && !isProcessing) setShowCancelModal(false);
        }}
      >
        <CmxDialogContent className="max-w-md w-full p-6">
          <CmxDialogHeader className="mb-4">
            <CmxDialogTitle className="text-2xl font-bold">
              Cancel Subscription
            </CmxDialogTitle>
          </CmxDialogHeader>

          {error && (
            <CmxSummaryMessage
              type="error"
              title="Error"
              message={error}
              className="mb-4"
            />
          )}

          <CmxSummaryMessage
            type="warning"
            title="Warning"
            message="Your subscription will remain active until the end of the current billing period. You will lose access to premium features after cancellation."
            className="mb-4"
          />

          <div className="mb-4">
            <Label htmlFor="cancel-reason-select" className="mb-2 block">
              Reason for Cancellation *
            </Label>
            <CmxSelect
              id="cancel-reason-select"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={isProcessing}
              className="w-full"
              options={[
                { value: '', label: 'Select a reason' },
                { value: 'Too expensive', label: 'Too expensive' },
                { value: 'Missing features', label: 'Missing features' },
                { value: 'Switching to competitor', label: 'Switching to competitor' },
                { value: 'No longer needed', label: 'No longer needed' },
                { value: 'Other', label: 'Other' },
              ]}
              placeholder="Select a reason"
            />
          </div>

          <div className="mb-6">
            <Label htmlFor="cancel-feedback-input" className="mb-2 block">
              Additional Feedback (Optional)
            </Label>
            <CmxTextarea
              id="cancel-feedback-input"
              value={cancelFeedback}
              onChange={(e) => setCancelFeedback(e.target.value)}
              disabled={isProcessing}
              rows={3}
              placeholder="Help us improve by sharing your feedback..."
            />
          </div>

          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-foreground">
              <strong>Effective Date:</strong>{' '}
              {usage?.currentPeriod.end
                ? new Date(usage.currentPeriod.end).toLocaleDateString()
                : '-'}
            </p>
          </div>

          <div className="flex space-x-4">
            <CmxButton
              variant="secondary"
              size="md"
              onClick={() => setShowCancelModal(false)}
              disabled={isProcessing}
              className="flex-1"
            >
              Keep Subscription
            </CmxButton>
            <CmxButton
              variant="destructive"
              size="md"
              onClick={handleCancel}
              loading={isProcessing}
              disabled={isProcessing || !cancelReason}
              className="flex-1"
            >
              {isProcessing ? 'Processing...' : 'Confirm Cancellation'}
            </CmxButton>
          </div>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
