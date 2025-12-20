/**
 * PRD-002: Feature Flag Service
 * Manages feature access based on subscription plans and tenant-specific overrides
 */

import { createClient } from '@/lib/supabase/server';
import type { FeatureFlags } from '@/lib/types/tenant';
import { getTenant } from './tenants.service';
import { getPlan } from './subscriptions.service';

// Cache for feature flags (in-memory, can be replaced with Redis)
const featureFlagCache = new Map<string, { flags: FeatureFlags; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ========================
// Feature Flag Types
// ========================

export type FeatureFlagKey = keyof FeatureFlags;

export const FEATURE_FLAGS: Record<FeatureFlagKey, { name: string; description: string }> = {
  pdf_invoices: {
    name: 'PDF Invoices',
    description: 'Generate and download PDF invoices',
  },
  whatsapp_receipts: {
    name: 'WhatsApp Receipts',
    description: 'Send receipts via WhatsApp',
  },
  in_app_receipts: {
    name: 'In-App Receipts',
    description: 'View receipts in mobile app',
  },
  printing: {
    name: 'Receipt Printing',
    description: 'Print receipts on thermal printers',
  },
  b2b_contracts: {
    name: 'B2B Contracts',
    description: 'Corporate customer contracts and billing',
  },
  white_label: {
    name: 'White Label',
    description: 'Custom branding and white-label apps',
  },
  marketplace_listings: {
    name: 'Marketplace Listings',
    description: 'List services on the marketplace',
  },
  loyalty_programs: {
    name: 'Loyalty Programs',
    description: 'Customer loyalty points and rewards',
  },
  driver_app: {
    name: 'Driver App',
    description: 'Mobile app for delivery drivers',
  },
  multi_branch: {
    name: 'Multi-Branch',
    description: 'Manage multiple branch locations',
  },
  advanced_analytics: {
    name: 'Advanced Analytics',
    description: 'Detailed reports and business intelligence',
  },
  api_access: {
    name: 'API Access',
    description: 'REST API access for integrations',
  },
};

// ========================
// Feature Flag Retrieval
// ========================

/**
 * Get feature flags for a tenant
 * Checks cache first, then database
 * @param tenantId - Tenant ID
 * @returns Feature flags object
 */
export async function getFeatureFlags(tenantId: string): Promise<FeatureFlags> {
  // Check cache
  const cached = featureFlagCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.flags;
  }

  // Fetch from database
  const tenant = await getTenant(tenantId);

  if (!tenant.feature_flags) {
    // If no custom feature flags, get from plan
    const plan = await getPlan(tenant.s_cureent_plan);
    return plan.feature_flags;
  }

  // Cache and return
  featureFlagCache.set(tenantId, {
    flags: tenant.feature_flags,
    timestamp: Date.now(),
  });

  return tenant.feature_flags;
}

/**
 * Get current tenant's feature flags from session
 * @returns Feature flags for current tenant
 */
export async function getCurrentFeatureFlags(): Promise<FeatureFlags> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.user_metadata?.tenant_org_id) {
    throw new Error('No authenticated user or missing tenant context');
  }

  return getFeatureFlags(user.user_metadata.tenant_org_id);
}

// ========================
// Feature Access Control
// ========================

/**
 * Check if a tenant has access to a specific feature
 * @param tenantId - Tenant ID
 * @param feature - Feature flag key
 * @returns True if feature is enabled
 */
export async function canAccess(
  tenantId: string,
  feature: FeatureFlagKey
): Promise<boolean> {
  const flags = await getFeatureFlags(tenantId);
  return flags[feature] === true;
}

/**
 * Check if current tenant has access to a feature
 * @param feature - Feature flag key
 * @returns True if feature is enabled
 */
export async function currentTenantCan(feature: FeatureFlagKey): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.user_metadata?.tenant_org_id) {
    return false;
  }

  return canAccess(user.user_metadata.tenant_org_id, feature);
}

/**
 * Check multiple features at once
 * @param tenantId - Tenant ID
 * @param features - Array of feature flag keys
 * @returns Map of feature keys to boolean access values
 */
export async function canAccessMultiple(
  tenantId: string,
  features: FeatureFlagKey[]
): Promise<Record<FeatureFlagKey, boolean>> {
  const flags = await getFeatureFlags(tenantId);

  const result: Partial<Record<FeatureFlagKey, boolean>> = {};
  for (const feature of features) {
    result[feature] = flags[feature] === true;
  }

  return result as Record<FeatureFlagKey, boolean>;
}

/**
 * Require access to a feature (throws error if not enabled)
 * Use this in API endpoints to enforce feature access
 * @param tenantId - Tenant ID
 * @param feature - Feature flag key
 * @throws Error if feature is not enabled
 */
export async function requireFeature(
  tenantId: string,
  feature: FeatureFlagKey
): Promise<void> {
  const hasAccess = await canAccess(tenantId, feature);

  if (!hasAccess) {
    const featureMeta = FEATURE_FLAGS[feature];
    throw new Error(
      `Access denied: "${featureMeta.name}" feature is not enabled for your plan. Please upgrade to access this feature.`
    );
  }
}

// ========================
// Feature Flag Updates
// ========================

/**
 * Update feature flags for a tenant (admin override)
 * This allows admins to enable/disable specific features
 * @param tenantId - Tenant ID
 * @param flags - Partial feature flags to update
 * @returns Updated feature flags
 */
export async function updateFeatureFlags(
  tenantId: string,
  flags: Partial<FeatureFlags>
): Promise<FeatureFlags> {
  const supabase = await createClient();

  // Get current flags
  const currentFlags = await getFeatureFlags(tenantId);

  // Merge with new flags
  const updatedFlags = { ...currentFlags, ...flags };

  // Update in database
  const { error } = await supabase
    .from('org_tenants_mst')
    .update({
      feature_flags: updatedFlags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  if (error) {
    console.error('Error updating feature flags:', error);
    throw new Error('Failed to update feature flags');
  }

  // Invalidate cache
  featureFlagCache.delete(tenantId);

  return updatedFlags;
}

/**
 * Reset feature flags to plan defaults
 * Removes any custom overrides
 * @param tenantId - Tenant ID
 * @returns Plan default feature flags
 */
export async function resetToDefaults(tenantId: string): Promise<FeatureFlags> {
  const supabase = await createClient();

  const tenant = await getTenant(tenantId);
  const plan = await getPlan(tenant.s_cureent_plan);

  // Set feature flags to plan defaults
  const { error } = await supabase
    .from('org_tenants_mst')
    .update({
      feature_flags: plan.feature_flags as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  if (error) {
    console.error('Error resetting feature flags:', error);
    throw new Error('Failed to reset feature flags');
  }

  // Invalidate cache
  featureFlagCache.delete(tenantId);

  return plan.feature_flags;
}

// ========================
// Cache Management
// ========================

/**
 * Invalidate feature flag cache for a tenant
 * Call this after updating feature flags or subscription plans
 * @param tenantId - Tenant ID
 */
export function invalidateCache(tenantId: string): void {
  featureFlagCache.delete(tenantId);
}

/**
 * Clear all cached feature flags
 * Useful for testing or cache reset
 */
export function clearAllCache(): void {
  featureFlagCache.clear();
}

/**
 * Get cache statistics
 * @returns Cache size and TTL info
 */
export function getCacheStats() {
  return {
    size: featureFlagCache.size,
    ttl: CACHE_TTL,
    entries: Array.from(featureFlagCache.keys()),
  };
}

// ========================
// Helper Decorators (for future use with TypeScript decorators)
// ========================

/**
 * Feature flag guard for use in API routes
 * Example usage in Next.js API route:
 *
 * export async function POST(request: Request) {
 *   const tenantId = await getTenantIdFromRequest(request);
 *   await requireFeature(tenantId, 'pdf_invoices');
 *   // Continue with PDF generation...
 * }
 */

// ========================
// Feature Flag Comparison
// ========================

/**
 * Compare feature flags between two plans
 * Useful for showing upgrade benefits
 * @param currentPlanCode - Current plan code
 * @param targetPlanCode - Target plan code
 * @returns Difference in features
 */
export async function compareFeatures(
  currentPlanCode: string,
  targetPlanCode: string
): Promise<{
  gained: FeatureFlagKey[];
  lost: FeatureFlagKey[];
  unchanged: FeatureFlagKey[];
}> {
  const currentPlan = await getPlan(currentPlanCode);
  const targetPlan = await getPlan(targetPlanCode);

  const gained: FeatureFlagKey[] = [];
  const lost: FeatureFlagKey[] = [];
  const unchanged: FeatureFlagKey[] = [];

  const features = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

  for (const feature of features) {
    const currentHas = currentPlan.feature_flags[feature];
    const targetHas = targetPlan.feature_flags[feature];

    if (!currentHas && targetHas) {
      gained.push(feature);
    } else if (currentHas && !targetHas) {
      lost.push(feature);
    } else {
      unchanged.push(feature);
    }
  }

  return { gained, lost, unchanged };
}
