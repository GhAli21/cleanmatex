/**
 * PRD-002: Subscription Management Service
 * Handles subscription lifecycle, plan upgrades/downgrades, and billing
 */

import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import type {
  Subscription,
  PlanLimits,
  PlanComparison,
  SubscriptionUpgradeRequest,
  SubscriptionCancelRequest,
} from '@/lib/types/tenant';
import { toBillingPlanCode, toLimitsPlanCode, planCodesMatch } from '@/lib/constants/plan-codes';
import { getTenant, updateTenant } from './tenants.service';

type SubscriptionRow = {
  id: string;
  tenant_org_id: string;
  plan_code: string;
  status: string | null;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapSubscriptionStatus(
  status: string | null
): Subscription['status'] {
  if (status === 'cancelled') return 'canceled';
  if (
    status === 'trial' ||
    status === 'active' ||
    status === 'canceling' ||
    status === 'canceled' ||
    status === 'past_due'
  ) {
    return status;
  }
  return 'active';
}

function mapSubscriptionRow(row: SubscriptionRow): Subscription {
  const limitsPlanCode = toLimitsPlanCode(row.plan_code);
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    plan: limitsPlanCode,
    status: mapSubscriptionStatus(row.status),
    orders_limit: 0,
    orders_used: 0,
    branch_limit: 0,
    user_limit: 0,
    start_date: row.current_period_start,
    end_date: row.current_period_end,
    trial_ends: row.trial_end,
    auto_renew: true,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Resolve tenant ID for the authenticated user (org_users_mst / get_user_tenants).
 */
export async function getAuthenticatedTenantId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No authenticated user');
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');

  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found');
  }

  const first = tenants[0] as { tenant_id: string };
  return first.tenant_id;
}

// ========================
// Plan Management
// ========================

/**
 * Get all available subscription plans
 * @param currentPlanCode - Optional current plan to mark in comparison
 * @returns List of plans with comparison data
 */
export async function getAvailablePlans(
  currentPlanCode?: string
): Promise<PlanComparison[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sys_plan_limits')
    .select('*')
    .eq('is_public', true)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching plans:', error);
    throw new Error('Failed to fetch subscription plans');
  }

  const plans = ((data ?? []) as unknown as PlanLimits[]) || [];

  const normalizedCurrent = currentPlanCode ? toLimitsPlanCode(currentPlanCode) : undefined;

  // Add comparison metadata
  return plans.map((plan) => ({
    ...plan,
    isCurrentPlan: normalizedCurrent ? planCodesMatch(plan.plan_code, normalizedCurrent) : false,
    isRecommended: plan.plan_code === 'growth', // Growth plan is recommended
  }));
}

/**
 * Get plan details by code
 * @param planCode - Plan code (e.g., 'free', 'starter')
 * @returns Plan details
 */
export async function getPlan(planCode: string): Promise<PlanLimits> {
  const limitsPlanCode = toLimitsPlanCode(planCode);
  if (!limitsPlanCode) {
    throw new Error('Plan code is required');
  }

  // sys_plan_limits is a system table (no RLS), but using admin client for consistency
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('sys_plan_limits')
    .select('*')
    .eq('plan_code', limitsPlanCode)
    .single();

  if (error || !data) {
    console.error('Error fetching plan:', { planCode, limitsPlanCode, error });
    throw new Error(`Plan "${planCode}" not found`);
  }

  return data as unknown as PlanLimits;
}

// ========================
// Subscription Queries
// ========================


/**
 * Get subscription for a tenant
 * @param tenantId - Tenant ID
 * @returns Current subscription 
 */
export async function getSubscription(tenantId: string): Promise<Subscription> {
  // Use admin client to bypass RLS since we already verified tenant access via org_users_mst
  // This is safe because tenantId is obtained from authenticated user's org_users_mst record
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('org_pln_subscriptions_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Error fetching subscription:', {
      error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      tenantId,
    });
    throw new Error(`Subscription not found: ${error.message}`);
  }

  if (!data) {
    console.error('No subscription data returned for tenant:', tenantId);
    throw new Error('Subscription not found: No data returned');
  }

  return mapSubscriptionRow(data as SubscriptionRow);
}

/**
 * Get subscription for a tenant old
 * @param tenantId - Tenant ID
 * @returns Current subscription 
 */
export async function getSubscriptionOld(tenantId: string): Promise<Subscription> {
  // Use admin client to bypass RLS since we already verified tenant access via org_users_mst
  // This is safe because tenantId is obtained from authenticated user's org_users_mst record
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('org_pln_subscriptions_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single();
  console.log('Jh Subscription tenantId='+tenantId)
  if (error) {
    console.error('Jh Error fetching subscription:', {
      error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      tenantId,
    });
    throw new Error(`Subscription not found: ${error.message}`);
  }

  if (!data) {
    console.error('No subscription data returned for tenant:', tenantId);
    throw new Error('Subscription not found: No data returned');
  }

  return data as unknown as Subscription;
}

/**
 * Get current subscription from session context
 * @returns Current subscription
 */
export async function getCurrentSubscription(): Promise<Subscription> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No authenticated user');
  }

  // Get user's tenants using the same function as other services 
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');

  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found');
  } 
  // Use the first tenant (current tenant)
  return getSubscription(tenants[0].tenant_id);
}

// ========================
// Subscription Upgrades
// ========================

/**
 * Calculate prorated amount for mid-cycle upgrade
 * @param currentPlan - Current plan details
 * @param newPlan - New plan details
 * @param billingCycle - Billing cycle
 * @param currentSubscription - Current subscription
 * @returns Prorated amount to charge
 */
function calculateProration(
  currentPlan: PlanLimits,
  newPlan: PlanLimits,
  billingCycle: 'monthly' | 'yearly',
  currentSubscription: Subscription
): number {
  const endDate = new Date(currentSubscription.end_date);
  const now = new Date();
  const daysRemaining = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalDays = billingCycle === 'monthly' ? 30 : 365;

  const currentPrice =
    billingCycle === 'monthly'
      ? currentPlan.price_monthly
      : currentPlan.price_yearly || currentPlan.price_monthly * 10; // Default 10-month yearly discount

  const newPrice =
    billingCycle === 'monthly'
      ? newPlan.price_monthly
      : newPlan.price_yearly || newPlan.price_monthly * 10;

  // Credit for unused portion of current plan
  const currentCredit = (currentPrice / totalDays) * daysRemaining;

  // Charge for remaining portion of new plan
  const newCharge = (newPrice / totalDays) * daysRemaining;

  // Amount to charge = new plan cost - credit from old plan
  const proratedAmount = Math.max(0, newCharge - currentCredit);

  return Math.round(proratedAmount * 100) / 100; // Round to 2 decimal places
}

/**
 * Upgrade subscription to a paid plan
 * @param tenantId - Tenant ID
 * @param request - Upgrade request details
 * @returns Updated subscription
 */
export async function upgradeSubscription(
  tenantId: string,
  request: SubscriptionUpgradeRequest
): Promise<Subscription> {
  const supabase = await createClient();

  // Step 1: Get current subscription and plan
  const currentSubscription = await getSubscription(tenantId);
  const currentPlan = await getPlan(currentSubscription.plan);
  const newPlan = await getPlan(request.planCode);

  // Step 2: Validate upgrade (can't downgrade via upgrade endpoint)
  const planOrder = ['free', 'starter', 'growth', 'pro', 'enterprise'];
  const currentIndex = planOrder.indexOf(toLimitsPlanCode(currentPlan.plan_code));
  const newIndex = planOrder.indexOf(toLimitsPlanCode(newPlan.plan_code));

  if (newIndex <= currentIndex) {
    throw new Error('Cannot downgrade using upgrade endpoint. Use cancel instead.');
  }

  // Step 3: Calculate proration
  const proratedAmount = calculateProration(
    currentPlan,
    newPlan,
    request.billingCycle,
    currentSubscription
  );

  // Step 4: Process payment (TODO: Integrate payment gateway)
  // For now, we'll assume payment is successful
  // const paymentResult = await processPayment(proratedAmount, request.paymentMethodId);

  // Step 5: Calculate new end date
  const startDate = new Date();
  const endDate = new Date(startDate);
  if (request.billingCycle === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  // Step 6: Update subscription
  const billingPlanCode = toBillingPlanCode(newPlan.plan_code);

  const { data: updatedSubscription, error: subscriptionError } = await supabase
    .from('org_pln_subscriptions_mst')
    .update({
      plan_code: billingPlanCode,
      status: 'active',
      current_period_start: startDate.toISOString(),
      current_period_end: endDate.toISOString(),
      trial_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_org_id', tenantId)
    .select()
    .single();

  if (subscriptionError || !updatedSubscription) {
    console.error('Error updating subscription:', subscriptionError);
    throw new Error('Failed to update subscription');
  }

  // Step 7: Update tenant with new plan and feature flags
  await updateTenant(tenantId, {
    feature_flags: newPlan.feature_flags,
  } as any);

  await supabase
    .from('org_tenants_mst')
    .update({
      s_cureent_plan: billingPlanCode,
      status: 'active',
    })
    .eq('id', tenantId);

  // Step 8: Send confirmation email (TODO: Implement email service)
  // await sendUpgradeConfirmationEmail(tenant, newPlan);

  return mapSubscriptionRow(updatedSubscription as SubscriptionRow);
}

/**
 * Cancel subscription (schedules downgrade at end of billing period)
 * @param tenantId - Tenant ID
 * @param request - Cancellation request with reason
 * @returns Updated subscription
 */
export async function cancelSubscription(
  tenantId: string,
  request: SubscriptionCancelRequest
): Promise<Subscription> {
  const supabase = await createClient();

  const currentSubscription = await getSubscription(tenantId);

  // Update subscription to mark for cancellation
  const { data, error } = await supabase
    .from('org_pln_subscriptions_mst')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: `${request.reason}${request.feedback ? ` - ${request.feedback}` : ''}`,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_org_id', tenantId)
    .select()
    .single();

  if (error || !data) {
    console.error('Error canceling subscription:', error);
    throw new Error('Failed to cancel subscription');
  }

  // Send cancellation confirmation (TODO: Implement email service)
  // await sendCancellationEmail(tenant, currentSubscription.end_date);

  return mapSubscriptionRow(data as SubscriptionRow);
}

/**
 * Process trial expirations (called by background job)
 * Downgrades tenants to free plan if trial expired without payment
 */
export async function processTrialExpirations(): Promise<void> {
  const supabase = await createClient();

  const now = new Date().toISOString();

  // Find all subscriptions with expired trials
  const { data: expiredTrials, error } = await supabase
    .from('org_pln_subscriptions_mst')
    .select('*, org_tenants_mst(*)')
    .eq('status', 'trial')
    .lte('trial_end', now);

  if (error) {
    console.error('Error fetching expired trials:', error);
    return;
  }

  if (!expiredTrials || expiredTrials.length === 0) {
    return;
  }

  // Get free plan limits
  const freePlan = await getPlan('free');

  // Downgrade each expired trial
  for (const subscription of expiredTrials) {
    try {
      // Update subscription to free plan
      await supabase
        .from('org_pln_subscriptions_mst')
        .update({
          plan_code: 'FREE_TRIAL',
          status: 'active',
          trial_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      // Update tenant status and feature flags
      await supabase
        .from('org_tenants_mst')
        .update({
          s_cureent_plan: 'FREE_TRIAL',
          feature_flags: freePlan.feature_flags as unknown as Json,
          status: 'active',
        })
        .eq('id', subscription.tenant_org_id);

      // Send trial expiration email (TODO: Implement email service)
      // await sendTrialExpiredEmail(subscription.org_tenants_mst);
    } catch (err) {
      console.error(
        `Error processing trial expiration for tenant ${subscription.tenant_org_id}:`,
        err
      );
    }
  }

  console.log(`Processed ${expiredTrials.length} expired trials`);
}

// ========================
// Subscription Renewal
// ========================

/**
 * Process subscription renewals (called by background job)
 * Charges payment method and extends subscription period
 */
export async function processSubscriptionRenewals(): Promise<void> {
  const supabase = await createClient();

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find subscriptions ending tomorrow with auto-renew enabled
  const { data: renewals, error } = await supabase
    .from('org_pln_subscriptions_mst')
    .select('*, org_tenants_mst(*)')
    .eq('status', 'active')
    .gte('current_period_end', now.toISOString())
    .lte('current_period_end', tomorrow.toISOString());

  if (error) {
    console.error('Error fetching renewals:', error);
    return;
  }

  if (!renewals || renewals.length === 0) {
    return;
  }

  for (const subscription of renewals) {
    try {
      const plan = await getPlan(subscription.plan_code);

      // Process payment (TODO: Integrate payment gateway)
      // const paymentResult = await processPayment(plan.price_monthly, subscription.payment_method_id);

      // Extend subscription period
      const newEndDate = new Date(subscription.current_period_end);
      newEndDate.setMonth(newEndDate.getMonth() + 1); // Assuming monthly billing

      await supabase
        .from('org_pln_subscriptions_mst')
        .update({
          current_period_start: subscription.current_period_end,
          current_period_end: newEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      // Send renewal confirmation (TODO: Implement email service)
      // await sendRenewalEmail(subscription.org_tenants_mst, newEndDate);
    } catch (err) {
      console.error(
        `Error processing renewal for tenant ${subscription.tenant_org_id}:`,
        err
      );

      // Mark subscription as past_due if payment fails
      await supabase
        .from('org_pln_subscriptions_mst')
        .update({ status: 'past_due' })
        .eq('id', subscription.id);
    }
  }

  console.log(`Processed ${renewals.length} subscription renewals`);
}
