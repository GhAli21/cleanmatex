/**
 * PRD-002: Usage Tracking Service
 * Monitors tenant resource usage and enforces plan limits
 */

import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import type { UsageTracking, UsageMetrics, UsageWarning, LimitCheckResult } from '@/lib/types/tenant';
import { getSubscription } from './subscriptions.service';
import { getPlan } from './subscriptions.service';
import { prisma } from '@/lib/db/prisma';
import { dtTodayIn } from '@cmx/clock';

/**
 * G12: plan usage is a platform metric, so its months are UTC months on purpose
 * (not a shop day). Explicit UTC, never the server's local zone.
 */
function utcMonthBounds(at: Date): { start: Date; end: Date } {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 0)) };
}

/** `YYYY-MM-DD` of an instant in UTC (platform metric). */
function utcCivil(at: Date): string {
  return dtTodayIn('UTC', at);
}

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
  const month = utcMonthBounds(new Date());
  const start = periodStart || month.start;
  const end = periodEnd || month.end;

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

  // Storage: READY File Util objects + thumbnails, in MB (index-only sum, idx_ofm_quota).
  const storageMb = Math.ceil((await getTenantStorageBytes(tenantId)) / 1048576);

  // API calls count (TODO: Implement API usage tracking)
  const apiCalls = 0;

  // Upsert usage tracking record
  const { data, error } = await supabase
    .from('org_usage_tracking')
    .upsert(
      {
        tenant_org_id: tenantId,
        period_start: utcCivil(start),
        period_end: utcCivil(end),
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
  const { start: startOfMonth, end: endOfMonth } = utcMonthBounds(new Date());

  const { data: usage, error } = await supabase
    .from('org_usage_tracking')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('period_start', utcCivil(startOfMonth))
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
 * Bytes stored by an organization in File Util: main objects plus thumbnails of READY files.
 * Served by the index-only `idx_ofm_quota`.
 * @param tenantId - Tenant ID
 * @returns stored bytes
 */
export async function getTenantStorageBytes(tenantId: string): Promise<number> {
  const sum = await prisma.org_file_mst.aggregate({
    where: { tenant_org_id: tenantId, status_code: 'READY' },
    _sum: { size_bytes: true, thumb_size_bytes: true },
  });
  return Number(sum._sum.size_bytes ?? BigInt(0)) + Number(sum._sum.thumb_size_bytes ?? BigInt(0));
}

/**
 * Check if tenant can store `addBytes` more within the plan storage limit.
 * Counts READY files live (not the monthly snapshot), so the check is current.
 * @param tenantId - Tenant ID
 * @param addBytes - Size of the upload about to be stored
 * @returns Limit check result (current/limit in MB)
 */
export async function canStoreBytes(tenantId: string, addBytes: number): Promise<LimitCheckResult> {
  const subscription = await getSubscription(tenantId);
  const plan = await getPlan(subscription.plan);

  // Unlimited storage
  if (plan.storage_mb_limit === -1) {
    return { canProceed: true, current: 0, limit: -1 };
  }

  const usedBytes = await getTenantStorageBytes(tenantId);
  const currentMb = Math.ceil(usedBytes / 1048576);
  if (usedBytes + addBytes > plan.storage_mb_limit * 1048576) {
    return {
      canProceed: false,
      limitType: 'storage',
      current: currentMb,
      limit: plan.storage_mb_limit,
      message: `Storage limit reached (${currentMb}/${plan.storage_mb_limit} MB). Please upgrade your plan.`,
    };
  }

  return { canProceed: true, current: currentMb, limit: plan.storage_mb_limit };
}

/**
 * Increment order count after successful creation
 * @param tenantId - Tenant ID
 */
export async function incrementOrderCount(tenantId: string): Promise<void> {
  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from('org_pln_subscriptions_mst')
    .select('id')
    .eq('tenant_org_id', tenantId)
    .maybeSingle();

  if (fetchError || !row?.id) {
    return;
  }

  await supabase
    .from('org_pln_subscriptions_mst')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

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
    .from('org_pln_subscriptions_mst')
    .update({
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
  startDate.setUTCMonth(startDate.getUTCMonth() - months);

  const { data, error } = await supabase
    .from('org_usage_tracking')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .gte('period_start', utcCivil(startDate))
    .order('period_start', { ascending: false });

  if (error) {
    console.error('Error fetching usage history:', error);
    throw new Error('Failed to fetch usage history');
  }

  return (data as UsageTracking[]) || [];
}
