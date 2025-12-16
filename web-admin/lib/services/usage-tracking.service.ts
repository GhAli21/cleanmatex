/**
 * PRD-002: Usage Tracking Service
 * Monitors tenant resource usage and enforces plan limits
 */

import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import type { UsageTracking, UsageMetrics, UsageWarning, LimitCheckResult } from '@/lib/types/tenant';
import { getSubscription } from './subscriptions.service';
import { getPlan } from './subscriptions.service';

// ========================
// Usage Calculation
// ========================

/**
 * Calculate current usage for a tenant
 * @param tenantId - Tenant ID
 * @param periodStart - Start of period (defaults to current month start)
 * @param periodEnd - End of period (defaults to current month end)
 * @returns Usage tracking record
 */
export async function calculateUsage(
  tenantId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<UsageTracking> {
  // Use admin client to bypass RLS for usage calculation
  // tenantId is already verified through org_users_mst lookup
  const supabase = createAdminSupabaseClient();

  // Default to current month if not specified
  const start = periodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = periodEnd || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  // Count orders in period
  const { count: ordersCount } = await supabase
    .from('org_orders_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', tenantId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  // Count active users (from org_users_mst, not auth.users)
  const { count: usersCount } = await supabase
    .from('org_users_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true);

  // Count active branches
  const { count: branchesCount } = await supabase
    .from('org_branches_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true);

  // Calculate storage usage (TODO: Implement when file storage is added)
  const storageMb = 0;

  // API calls count (TODO: Implement API usage tracking)
  const apiCalls = 0;

  // Upsert usage tracking record
  const { data, error } = await supabase
    .from('org_usage_tracking')
    .upsert(
      {
        tenant_org_id: tenantId,
        period_start: start.toISOString().split('T')[0],
        period_end: end.toISOString().split('T')[0],
        orders_count: ordersCount || 0,
        users_count: usersCount || 0,
        branches_count: branchesCount || 0,
        storage_mb: storageMb,
        api_calls: apiCalls,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'tenant_org_id,period_start',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error calculating usage:', error);
    throw new Error('Failed to calculate usage');
  }

  return data as UsageTracking;
}

/**
 * Calculate daily usage for all active tenants (background job)
 * Should be run daily at midnight
 */
export async function calculateDailyUsage(): Promise<void> {
  const supabase = await createClient();

  // Get all active tenants
  const { data: tenants, error } = await supabase
    .from('org_tenants_mst')
    .select('id')
    .eq('is_active', true);

  if (error || !tenants) {
    console.error('Error fetching active tenants:', error);
    return;
  }

  console.log(`Calculating usage for ${tenants.length} tenants...`);

  for (const tenant of tenants) {
    try {
      await calculateUsage(tenant.id);
    } catch (err) {
      console.error(`Error calculating usage for tenant ${tenant.id}:`, err);
    }
  }

  console.log('Daily usage calculation completed');
}

// ========================
// Usage Metrics & Warnings
// ========================

/**
 * Get usage metrics for a tenant with warnings
 * @param tenantId - Tenant ID
 * @returns Usage metrics with limits and warnings
 */
export async function getUsageMetrics(tenantId: string): Promise<UsageMetrics> {
  // Use admin client for usage tracking queries
  const supabase = createAdminSupabaseClient();

  // Get current subscription and plan
  const subscription = await getSubscription(tenantId);
  const plan = await getPlan(subscription.plan);

  // Get current period usage
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  const { data: usage, error } = await supabase
    .from('org_usage_tracking')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('period_start', startOfMonth.toISOString().split('T')[0])
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching usage:', error);
    throw new Error('Failed to fetch usage metrics');
  }

  // If no usage record exists, calculate it now
  const currentUsage = usage || await calculateUsage(tenantId);

  // Calculate percentages
  const ordersPercentage = plan.orders_limit === -1 ? 0 : Math.round((currentUsage.orders_count / plan.orders_limit) * 100);
  const usersPercentage = plan.users_limit === -1 ? 0 : Math.round((currentUsage.users_count / plan.users_limit) * 100);
  const branchesPercentage = plan.branches_limit === -1 ? 0 : Math.round((currentUsage.branches_count / plan.branches_limit) * 100);
  const storagePercentage = plan.storage_mb_limit === -1 ? 0 : Math.round((currentUsage.storage_mb / plan.storage_mb_limit) * 100);

  // Generate warnings
  const warnings: UsageWarning[] = [];

  if (ordersPercentage >= 100) {
    warnings.push({
      type: 'limit_exceeded',
      resource: 'orders',
      message: `You have exceeded your monthly order limit (${currentUsage.orders_count}/${plan.orders_limit})`,
      percentage: ordersPercentage,
    });
  } else if (ordersPercentage >= 90) {
    warnings.push({
      type: 'limit_reached',
      resource: 'orders',
      message: `You are approaching your order limit (${currentUsage.orders_count}/${plan.orders_limit})`,
      percentage: ordersPercentage,
    });
  } else if (ordersPercentage >= 80) {
    warnings.push({
      type: 'approaching_limit',
      resource: 'orders',
      message: `You've used ${ordersPercentage}% of your monthly order limit`,
      percentage: ordersPercentage,
    });
  }

  if (usersPercentage >= 100) {
    warnings.push({
      type: 'limit_exceeded',
      resource: 'users',
      message: `You have exceeded your user limit (${currentUsage.users_count}/${plan.users_limit})`,
      percentage: usersPercentage,
    });
  }

  if (branchesPercentage >= 100) {
    warnings.push({
      type: 'limit_exceeded',
      resource: 'branches',
      message: `You have exceeded your branch limit (${currentUsage.branches_count}/${plan.branches_limit})`,
      percentage: branchesPercentage,
    });
  }

  if (storagePercentage >= 90) {
    warnings.push({
      type: 'approaching_limit',
      resource: 'storage',
      message: `You've used ${storagePercentage}% of your storage limit`,
      percentage: storagePercentage,
    });
  }

  return {
    currentPeriod: {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString(),
    },
    limits: {
      ordersLimit: plan.orders_limit,
      usersLimit: plan.users_limit,
      branchesLimit: plan.branches_limit,
      storageMbLimit: plan.storage_mb_limit,
    },
    usage: {
      ordersCount: currentUsage.orders_count,
      ordersPercentage,
      usersCount: currentUsage.users_count,
      usersPercentage,
      branchesCount: currentUsage.branches_count,
      branchesPercentage,
      storageMb: currentUsage.storage_mb,
      storagePercentage,
    },
    warnings,
  };
}

// ========================
// Limit Enforcement
// ========================

/**
 * Check if tenant can create a new order
 * @param tenantId - Tenant ID
 * @returns Limit check result
 */
export async function canCreateOrder(tenantId: string): Promise<LimitCheckResult> {
  const subscription = await getSubscription(tenantId);
  const plan = await getPlan(subscription.plan);

  // Unlimited orders
  if (plan.orders_limit === -1) {
    return { canProceed: true, current: 0, limit: -1 };
  }

  const metrics = await getUsageMetrics(tenantId);

  if (metrics.usage.ordersCount >= plan.orders_limit) {
    return {
      canProceed: false,
      limitType: 'orders',
      current: metrics.usage.ordersCount,
      limit: plan.orders_limit,
      message: `Order limit reached (${metrics.usage.ordersCount}/${plan.orders_limit}). Please upgrade your plan.`,
    };
  }

  return {
    canProceed: true,
    current: metrics.usage.ordersCount,
    limit: plan.orders_limit,
  };
}

/**
 * Check if tenant can add a new user
 * @param tenantId - Tenant ID
 * @returns Limit check result
 */
export async function canAddUser(tenantId: string): Promise<LimitCheckResult> {
  const subscription = await getSubscription(tenantId);
  const plan = await getPlan(subscription.plan);

  // Unlimited users
  if (plan.users_limit === -1) {
    return { canProceed: true, current: 0, limit: -1 };
  }

  const metrics = await getUsageMetrics(tenantId);

  if (metrics.usage.usersCount >= plan.users_limit) {
    return {
      canProceed: false,
      limitType: 'users',
      current: metrics.usage.usersCount,
      limit: plan.users_limit,
      message: `User limit reached (${metrics.usage.usersCount}/${plan.users_limit}). Please upgrade your plan.`,
    };
  }

  return {
    canProceed: true,
    current: metrics.usage.usersCount,
    limit: plan.users_limit,
  };
}

/**
 * Check if tenant can add a new branch
 * @param tenantId - Tenant ID
 * @returns Limit check result
 */
export async function canAddBranch(tenantId: string): Promise<LimitCheckResult> {
  const subscription = await getSubscription(tenantId);
  const plan = await getPlan(subscription.plan);

  // Unlimited branches
  if (plan.branches_limit === -1) {
    return { canProceed: true, current: 0, limit: -1 };
  }

  const metrics = await getUsageMetrics(tenantId);

  if (metrics.usage.branchesCount >= plan.branches_limit) {
    return {
      canProceed: false,
      limitType: 'branches',
      current: metrics.usage.branchesCount,
      limit: plan.branches_limit,
      message: `Branch limit reached (${metrics.usage.branchesCount}/${plan.branches_limit}). Please upgrade your plan.`,
    };
  }

  return {
    canProceed: true,
    current: metrics.usage.branchesCount,
    limit: plan.branches_limit,
  };
}

/**
 * Increment order count after successful creation
 * @param tenantId - Tenant ID
 */
export async function incrementOrderCount(tenantId: string): Promise<void> {
  const supabase = await createClient();

  // Update subscription orders_used
  await supabase
    .from('org_subscriptions_mst')
    .update({
      orders_used: supabase.rpc('increment', { x: 1 }),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_org_id', tenantId);

  // Recalculate usage
  await calculateUsage(tenantId);
}

/**
 * Reset monthly usage counters (called on billing cycle start)
 * @param tenantId - Tenant ID
 */
export async function resetMonthlyUsage(tenantId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('org_subscriptions_mst')
    .update({
      orders_used: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_org_id', tenantId);
}

// ========================
// Historical Usage
// ========================

/**
 * Get usage history for a tenant
 * @param tenantId - Tenant ID
 * @param months - Number of months to retrieve (default: 6)
 * @returns List of usage tracking records
 */
export async function getUsageHistory(
  tenantId: string,
  months: number = 6
): Promise<UsageTracking[]> {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from('org_usage_tracking')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .gte('period_start', startDate.toISOString().split('T')[0])
    .order('period_start', { ascending: false });

  if (error) {
    console.error('Error fetching usage history:', error);
    throw new Error('Failed to fetch usage history');
  }

  return (data as UsageTracking[]) || [];
}
