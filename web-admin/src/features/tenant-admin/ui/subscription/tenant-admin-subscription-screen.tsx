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
import { useLocale, useTranslations } from 'next-intl';
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
  const t = useTranslations('settings.subscriptionPage');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { currencyCode, decimalPlaces, formatNumber } = useTenantCurrency();
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
        throw new Error(t('fetchError'));
      }

      const plansData = await plansRes.json();
      const usageData = await usageRes.json();
      const tenantData = await tenantRes.json();

      setPlans(plansData.data.plans);
      setCurrentPlan(plansData.data.currentPlan);
      setUsage(usageData.data);
      setTenant(tenantData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
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
        throw new Error(data.error || t('upgradeFailed'));
      }

      setSuccess(t('upgradeSuccess', { planName: selectedPlan.plan_name }));
      setShowUpgradeModal(false);
      void invalidateTenantFeatureFlags(queryClient, currentTenant?.tenant_id);

      // Refresh data after 1 second
      setTimeout(() => {
        fetchSubscriptionData();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upgradeError'));
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
      setError(t('cancelSelectReason'));
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
        throw new Error(data.error || t('cancelFailed'));
      }

      setSuccess(t('cancelSuccess'));
      setShowCancelModal(false);
      void invalidateTenantFeatureFlags(queryClient, currentTenant?.tenant_id);

      // Refresh data
      setTimeout(() => {
        fetchSubscriptionData();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cancelError'));
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
          <p className="mt-4 text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CmxSummaryMessage
          type="error"
          title={t('errorLoadingTitle')}
          message={error}
        />
      </div>
    );
  }

  const isOnTrial = tenant?.status === 'trial';
  const isPaidPlan = currentPlan && currentPlan !== 'free';
  const statusLabels: Record<string, string> = {
    active: t('statusActive'),
    trial: t('statusTrial'),
    suspended: t('statusSuspended'),
    canceled: t('statusCanceled'),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('title')}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t('subtitle')}
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
              {statusLabels[tenant.status] ?? tenant.status}
            </CmxStatusBadge>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <CmxSummaryMessage
          type="success"
          title={tCommon('success')}
          message={success}
          className="mb-6"
        />
      )}
      {error && (
        <CmxSummaryMessage
          type="error"
          title={tCommon('error')}
          message={error}
          className="mb-6"
        />
      )}

      {/* Trial Countdown Banner */}
      {isOnTrial && tenant?.status === 'trial' && (
        <CmxSummaryMessage
          type="warning"
          title={t('trialActiveTitle')}
          message={t('trialActiveMessage', {
            days: formatNumber(tenant?.status === 'trial' && usage ? getDaysRemaining(usage.currentPeriod.end) : 0),
          })}
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
            {t('upgradeNow')}
          </CmxButton>
        </CmxSummaryMessage>
      )}

      {/* Current Plan Card */}
      <CmxCard className="mb-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">{tSettings('currentPlan')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">{tSettings('plan')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {plans.find(p => p.plan_code === currentPlan)?.plan_name || tCommon('loading')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('priceLabel')}</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                <bdi dir="ltr">
                  {t('perMonthFull', {
                    amount: fmtPlanMoney(Number(plans.find(p => p.plan_code === currentPlan)?.price_monthly || 0)),
                  })}
                </bdi>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isOnTrial ? t('trialEnds') : tSettings('nextBillingDate')}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                {usage?.currentPeriod.end ? new Date(usage.currentPeriod.end).toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM') : '-'}
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
              <h2 className="text-xl font-semibold">{t('usageLimitsTitle')}</h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {t('periodLabel', {
                  start: new Date(usage.currentPeriod.start).toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM'),
                  end: new Date(usage.currentPeriod.end).toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM'),
                })}
              </p>
            </div>

            <div className="space-y-6">
              {/* Orders Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {t('orders')}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatNumber(usage.usage.ordersCount)} / {formatNumber(usage.limits.ordersLimit)}
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.ordersPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.ordersPercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {t('usedPct', { pct: formatNumber(usage.usage.ordersPercentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                </p>
              </div>

              {/* Users Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {t('users')}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatNumber(usage.usage.usersCount)} / {formatNumber(usage.limits.usersLimit)}
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.usersPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.usersPercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {t('usedPct', { pct: formatNumber(usage.usage.usersPercentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                </p>
              </div>

              {/* Branches Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {t('branches')}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatNumber(usage.usage.branchesCount)} / {formatNumber(usage.limits.branchesLimit)}
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.branchesPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.branchesPercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {t('usedPct', { pct: formatNumber(usage.usage.branchesPercentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                </p>
              </div>

              {/* Storage Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {t('storage')}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t('storageUsage', { used: formatNumber(usage.usage.storageMb), limit: formatNumber(usage.limits.storageMbLimit) })}
                  </span>
                </div>
                <CmxProgressBar
                  value={usage.usage.storagePercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.storagePercentage)}
                />
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {t('usedPct', { pct: formatNumber(usage.usage.storagePercentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                </p>
              </div>
            </div>

            {/* Warnings */}
            {usage.warnings.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  ⚠️ {t('warningsTitle', { count: formatNumber(usage.warnings.length) })}
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
            <h2 className="text-xl font-semibold">{tSettings('availablePlans')}</h2>
            <div className="flex items-center gap-2">
              <CmxButton
                type="button"
                variant={showPricing === 'monthly' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowPricing('monthly')}
              >
                {t('monthly')}
              </CmxButton>
              <CmxButton
                type="button"
                variant={showPricing === 'yearly' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowPricing('yearly')}
              >
                {t('yearly')}
                <span className="ms-1 text-xs">{t('save20Short')}</span>
              </CmxButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {tSettings('plan')}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('priceLabel')}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('orders')}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('users')}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('branches')}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('colKeyFeatures')}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('colAction')}
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
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {plan.plan_name}
                          </span>
                          {plan.isCurrentPlan && (
                            <CmxStatusBadge size="sm" tone="success">
                              {tSettings('current')}
                            </CmxStatusBadge>
                          )}
                          {plan.plan_code === 'growth' && !plan.isCurrentPlan && (
                            <CmxStatusBadge size="sm" tone="info">
                              {t('recommended')}
                            </CmxStatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap tabular-nums">
                        <bdi dir="ltr" className="text-lg font-bold text-foreground">
                          {t('perMoShort', { amount: fmtPlanMoney(price) })}
                        </bdi>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground tabular-nums">
                        {plan.orders_limit === 999999 ? tSettings('unlimited') : formatNumber(plan.orders_limit)}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground tabular-nums">
                        {plan.users_limit === 999999 ? tSettings('unlimited') : formatNumber(plan.users_limit)}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground tabular-nums">
                        {plan.branches_limit === 999999 ? tSettings('unlimited') : formatNumber(plan.branches_limit)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {plan.feature_flags.pdf_invoices && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">{t('featurePdf')}</CmxStatusBadge>
                          )}
                          {plan.feature_flags.whatsapp_receipts && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">{t('featureWhatsapp')}</CmxStatusBadge>
                          )}
                          {plan.feature_flags.driver_app && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">{t('featureDriverApp')}</CmxStatusBadge>
                          )}
                          {plan.feature_flags.multi_branch && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">{t('featureMultiBranch')}</CmxStatusBadge>
                          )}
                          {plan.feature_flags.api_access && (
                            <CmxStatusBadge size="sm" tone="brand" appearance="solid">{t('featureApi')}</CmxStatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        {plan.isCurrentPlan ? (
                          <CmxButton variant="secondary" size="sm" disabled>
                            {tSettings('currentPlan')}
                          </CmxButton>
                        ) : plan.display_order && currentPlan &&
                           plans.find(p => p.plan_code === currentPlan)?.display_order &&
                           plan.display_order > plans.find(p => p.plan_code === currentPlan)!.display_order! ? (
                          <CmxButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpgradeClick(plan)}
                          >
                            {tSettings('upgrade')}
                          </CmxButton>
                        ) : (
                          <CmxButton variant="secondary" size="sm" disabled>
                            {t('downgrade')}
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
            {t('cancelSubscription')}
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
                  {t('upgradeToPlan', { planName: selectedPlan.plan_name })}
                </CmxDialogTitle>
              </CmxDialogHeader>

              {error && (
                <CmxSummaryMessage
                  type="error"
                  title={tCommon('error')}
                  message={error}
                  className="mb-4"
                />
              )}

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {t('selectBillingCycle')}
                </h3>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <CmxRadio
                      name="billingCycle"
                      value="monthly"
                      checked={billingCycle === 'monthly'}
                      onChange={(e) => setBillingCycle(e.target.value as 'monthly')}
                      disabled={isProcessing}
                      label={
                        <span className="tabular-nums">
                          {t('monthlyOption', { amount: fmtPlanMoney(Number(selectedPlan.price_monthly)) })}
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
                          {t('yearlyOption', {
                            amount: fmtPlanMoney(
                              selectedPlan.price_yearly
                                ? Number(selectedPlan.price_yearly) / 12
                                : Number(selectedPlan.price_monthly) * 12
                            ),
                          })}
                          {selectedPlan.price_yearly && (
                            <span className="ms-2 text-success-text font-semibold">
                              {t('save20Exclaim')}
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
                  {t('newFeaturesTitle')}
                </h3>
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedPlan.feature_flags.pdf_invoices && <li>✓ {t('featurePdfFull')}</li>}
                  {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ {t('featureWhatsappFull')}</li>}
                  {selectedPlan.feature_flags.driver_app && <li>✓ {t('featureDriverAppFull')}</li>}
                  {selectedPlan.feature_flags.multi_branch && <li>✓ {t('featureMultiBranchFull')}</li>}
                  {selectedPlan.feature_flags.advanced_analytics && <li>✓ {t('featureAdvancedAnalyticsFull')}</li>}
                  {selectedPlan.feature_flags.api_access && <li>✓ {t('featureApiFull')}</li>}
                </ul>
              </div>

              <div className="mb-6 p-4 bg-muted rounded-lg">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t('paymentIntegrationTitle')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('paymentIntegrationNotice')}
                </p>
              </div>

              <div className="flex gap-4">
                <CmxButton
                  variant="secondary"
                  size="md"
                  onClick={() => setShowUpgradeModal(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {tCommon('cancel')}
                </CmxButton>
                <CmxButton
                  variant="primary"
                  size="md"
                  onClick={handleUpgrade}
                  loading={isProcessing}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? t('processing') : t('confirmUpgrade')}
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
              {t('cancelSubscription')}
            </CmxDialogTitle>
          </CmxDialogHeader>

          {error && (
            <CmxSummaryMessage
              type="error"
              title={tCommon('error')}
              message={error}
              className="mb-4"
            />
          )}

          <CmxSummaryMessage
            type="warning"
            title={tCommon('warning')}
            message={t('cancelWarningMessage')}
            className="mb-4"
          />

          <div className="mb-4">
            <Label htmlFor="cancel-reason-select" className="mb-2 block">
              {t('cancelReasonLabel')} *
            </Label>
            <CmxSelect
              id="cancel-reason-select"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={isProcessing}
              className="w-full"
              options={[
                { value: '', label: t('selectReasonPlaceholder') },
                { value: 'Too expensive', label: t('reasonTooExpensive') },
                { value: 'Missing features', label: t('reasonMissingFeatures') },
                { value: 'Switching to competitor', label: t('reasonCompetitor') },
                { value: 'No longer needed', label: t('reasonNoLongerNeeded') },
                { value: 'Other', label: t('reasonOther') },
              ]}
              placeholder={t('selectReasonPlaceholder')}
            />
          </div>

          <div className="mb-6">
            <Label htmlFor="cancel-feedback-input" className="mb-2 block">
              {t('additionalFeedback')}
            </Label>
            <CmxTextarea
              id="cancel-feedback-input"
              value={cancelFeedback}
              onChange={(e) => setCancelFeedback(e.target.value)}
              disabled={isProcessing}
              rows={3}
              placeholder={t('feedbackPlaceholder')}
            />
          </div>

          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-foreground tabular-nums">
              <strong>{t('effectiveDate')}</strong>{' '}
              {usage?.currentPeriod.end
                ? new Date(usage.currentPeriod.end).toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM')
                : '-'}
            </p>
          </div>

          <div className="flex gap-4">
            <CmxButton
              variant="secondary"
              size="md"
              onClick={() => setShowCancelModal(false)}
              disabled={isProcessing}
              className="flex-1"
            >
              {t('keepSubscription')}
            </CmxButton>
            <CmxButton
              variant="destructive"
              size="md"
              onClick={handleCancel}
              loading={isProcessing}
              disabled={isProcessing || !cancelReason}
              className="flex-1"
            >
              {isProcessing ? t('processing') : t('confirmCancellation')}
            </CmxButton>
          </div>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
