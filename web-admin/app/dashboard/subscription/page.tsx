/**
 * Subscription & Billing Management Page
 * Comprehensive subscription interface with plan comparison, upgrade flow, and usage metrics
 * Route: /dashboard/subscription (protected)
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Alert,
  Badge,
  ProgressBar,
  Select,
  Input,
} from '@/components/ui';
import type {
  PlanComparison,
  UsageMetrics,
  Tenant,
  Subscription,
} from '@/lib/types/tenant';

export default function SubscriptionPage() {
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert
          variant="error"
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
            <h1 className="text-3xl font-bold text-gray-900">
              Subscription & Billing
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your plan and view usage
            </p>
          </div>
          {tenant && (
            <Badge
              variant={
                tenant.status === 'active' ? 'success' :
                tenant.status === 'trial' ? 'info' :
                tenant.status === 'suspended' ? 'warning' : 'default'
              }
              size="lg"
            >
              {tenant.status.toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert
          variant="success"
          title="Success"
          message={success}
          className="mb-6"
        />
      )}
      {error && (
        <Alert
          variant="error"
          title="Error"
          message={error}
          className="mb-6"
        />
      )}

      {/* Trial Countdown Banner */}
      {isOnTrial && tenant?.status === 'trial' && (
        <Alert
          variant="warning"
          title="Trial Period Active"
          message={`You have ${tenant?.status === 'trial' && usage ? getDaysRemaining(usage.currentPeriod.end) : 0} days remaining in your free trial. Upgrade now to unlock all features!`}
          className="mb-6"
        >
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const starterPlan = plans.find(p => p.plan_code === 'starter');
              if (starterPlan) handleUpgradeClick(starterPlan);
            }}
            className="mt-2"
          >
            Upgrade Now
          </Button>
        </Alert>
      )}

      {/* Current Plan Card */}
      <Card className="mb-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {plans.find(p => p.plan_code === currentPlan)?.plan_name || 'Loading...'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Price</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                OMR {plans.find(p => p.plan_code === currentPlan)?.price_monthly || 0}/month
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {isOnTrial ? 'Trial Ends' : 'Next Billing Date'}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {usage?.currentPeriod.end ? new Date(usage.currentPeriod.end).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Usage Metrics Section */}
      {usage && (
        <Card className="mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Usage & Limits</h2>
              <p className="text-sm text-gray-600">
                Period: {new Date(usage.currentPeriod.start).toLocaleDateString()} - {new Date(usage.currentPeriod.end).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-6">
              {/* Orders Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Orders
                  </span>
                  <span className="text-sm text-gray-600">
                    {usage.usage.ordersCount} / {usage.limits.ordersLimit}
                  </span>
                </div>
                <ProgressBar
                  value={usage.usage.ordersPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.ordersPercentage)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {usage.usage.ordersPercentage.toFixed(1)}% used
                </p>
              </div>

              {/* Users Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Users
                  </span>
                  <span className="text-sm text-gray-600">
                    {usage.usage.usersCount} / {usage.limits.usersLimit}
                  </span>
                </div>
                <ProgressBar
                  value={usage.usage.usersPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.usersPercentage)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {usage.usage.usersPercentage.toFixed(1)}% used
                </p>
              </div>

              {/* Branches Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Branches
                  </span>
                  <span className="text-sm text-gray-600">
                    {usage.usage.branchesCount} / {usage.limits.branchesLimit}
                  </span>
                </div>
                <ProgressBar
                  value={usage.usage.branchesPercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.branchesPercentage)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {usage.usage.branchesPercentage.toFixed(1)}% used
                </p>
              </div>

              {/* Storage Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Storage
                  </span>
                  <span className="text-sm text-gray-600">
                    {usage.usage.storageMb} MB / {usage.limits.storageMbLimit} MB
                  </span>
                </div>
                <ProgressBar
                  value={usage.usage.storagePercentage}
                  max={100}
                  variant={getProgressVariant(usage.usage.storagePercentage)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {usage.usage.storagePercentage.toFixed(1)}% used
                </p>
              </div>
            </div>

            {/* Warnings */}
            {usage.warnings.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  ⚠️ Warnings ({usage.warnings.length})
                </h3>
                <div className="space-y-2">
                  {usage.warnings.map((warning, idx) => (
                    <Alert
                      key={idx}
                      variant={warning.type === 'limit_exceeded' ? 'error' : 'warning'}
                      title={warning.resource.toUpperCase()}
                      message={warning.message}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Plan Comparison Table */}
      <Card className="mb-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Available Plans</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPricing('monthly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showPricing === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setShowPricing('yearly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showPricing === 'yearly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Yearly
                <span className="ml-1 text-xs">(Save 20%)</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branches
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Key Features
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plans.map((plan) => {
                  const price = showPricing === 'yearly' && plan.price_yearly
                    ? plan.price_yearly / 12
                    : plan.price_monthly;

                  return (
                    <tr
                      key={plan.plan_code}
                      className={plan.isCurrentPlan ? 'bg-blue-50' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">
                            {plan.plan_name}
                          </span>
                          {plan.isCurrentPlan && (
                            <Badge variant="success" size="sm">
                              Current
                            </Badge>
                          )}
                          {plan.plan_code === 'growth' && !plan.isCurrentPlan && (
                            <Badge variant="info" size="sm">
                              Recommended
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-gray-900">
                          OMR {price.toFixed(2)}
                        </span>
                        <span className="text-sm text-gray-500">/mo</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {plan.orders_limit === 999999 ? 'Unlimited' : plan.orders_limit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {plan.users_limit === 999999 ? 'Unlimited' : plan.users_limit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {plan.branches_limit === 999999 ? 'Unlimited' : plan.branches_limit}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {plan.feature_flags.pdf_invoices && (
                            <Badge variant="default" size="sm">PDF</Badge>
                          )}
                          {plan.feature_flags.whatsapp_receipts && (
                            <Badge variant="default" size="sm">WhatsApp</Badge>
                          )}
                          {plan.feature_flags.driver_app && (
                            <Badge variant="default" size="sm">Driver App</Badge>
                          )}
                          {plan.feature_flags.multi_branch && (
                            <Badge variant="default" size="sm">Multi-Branch</Badge>
                          )}
                          {plan.feature_flags.api_access && (
                            <Badge variant="default" size="sm">API</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {plan.isCurrentPlan ? (
                          <Button variant="secondary" size="sm" disabled>
                            Current Plan
                          </Button>
                        ) : plan.display_order && currentPlan &&
                           plans.find(p => p.plan_code === currentPlan)?.display_order &&
                           plan.display_order > plans.find(p => p.plan_code === currentPlan)!.display_order! ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpgradeClick(plan)}
                          >
                            Upgrade
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" disabled>
                            Downgrade
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Cancel Subscription Button */}
      {isPaidPlan && tenant?.status !== 'canceled' && (
        <div className="flex justify-end">
          <Button
            variant="danger"
            size="md"
            onClick={handleCancelClick}
          >
            Cancel Subscription
          </Button>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Upgrade to {selectedPlan.plan_name}
                </h2>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isProcessing}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <Alert
                  variant="error"
                  title="Error"
                  message={error}
                  className="mb-4"
                />
              )}

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Select Billing Cycle
                </h3>
                <div className="flex space-x-4">
                  <label className="flex-1">
                    <input
                      type="radio"
                      value="monthly"
                      checked={billingCycle === 'monthly'}
                      onChange={(e) => setBillingCycle(e.target.value as 'monthly')}
                      className="mr-2"
                      disabled={isProcessing}
                    />
                    <span className="text-sm">
                      Monthly - OMR {selectedPlan.price_monthly}/mo
                    </span>
                  </label>
                  <label className="flex-1">
                    <input
                      type="radio"
                      value="yearly"
                      checked={billingCycle === 'yearly'}
                      onChange={(e) => setBillingCycle(e.target.value as 'yearly')}
                      className="mr-2"
                      disabled={isProcessing}
                    />
                    <span className="text-sm">
                      Yearly - OMR {selectedPlan.price_yearly ? (selectedPlan.price_yearly / 12).toFixed(2) : (selectedPlan.price_monthly * 12).toFixed(2)}/mo
                      {selectedPlan.price_yearly && (
                        <span className="ml-2 text-green-600 font-semibold">
                          Save 20%!
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  New Features You&apos;ll Get:
                </h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  {selectedPlan.feature_flags.pdf_invoices && <li>✓ PDF Invoices</li>}
                  {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ WhatsApp Receipts</li>}
                  {selectedPlan.feature_flags.driver_app && <li>✓ Driver App</li>}
                  {selectedPlan.feature_flags.multi_branch && <li>✓ Multi-Branch Support</li>}
                  {selectedPlan.feature_flags.advanced_analytics && <li>✓ Advanced Analytics</li>}
                  {selectedPlan.feature_flags.api_access && <li>✓ API Access</li>}
                </ul>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Payment Integration
                </h3>
                <p className="text-sm text-gray-600">
                  Payment gateway integration coming soon. For now, your plan will be upgraded immediately
                  and you&apos;ll receive an invoice via email.
                </p>
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowUpgradeModal(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Processing...' : 'Confirm Upgrade'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Cancel Subscription
              </h2>

              {error && (
                <Alert
                  variant="error"
                  title="Error"
                  message={error}
                  className="mb-4"
                />
              )}

              <Alert
                variant="warning"
                title="Warning"
                message="Your subscription will remain active until the end of the current billing period. You will lose access to premium features after cancellation."
                className="mb-4"
              />

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Cancellation *
                </label>
                <Select
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Feedback (Optional)
                </label>
                <textarea
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  disabled={isProcessing}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Help us improve by sharing your feedback..."
                />
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Effective Date:</strong>{' '}
                  {usage?.currentPeriod.end
                    ? new Date(usage.currentPeriod.end).toLocaleDateString()
                    : '-'}
                </p>
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowCancelModal(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Keep Subscription
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleCancel}
                  disabled={isProcessing || !cancelReason}
                  className="flex-1"
                >
                  {isProcessing ? 'Processing...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
