/**
 * Plan-bound feature flags service
 * Resolves flags via hq_ff_get_effective_value RPC (hq_ff_feature_flags_mst + sys_ff_pln_flag_mappings_dtl)
 */

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PLAN_FLAG_KEYS,
  type PlanFlagKey,
  type PlanFlags,
} from '@/lib/constants/plan-flags';

function parseJsonbToBoolean(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return parseJsonbToBoolean((value as { value: unknown }).value);
  }
  return Boolean(value);
}

/**
 * Get effective value for a single plan flag
 */
export async function checkPlanFlag(
  tenantId: string,
  flagKey: PlanFlagKey,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? (await createClient());
  try {
    const { data, error } = await client.rpc('hq_ff_get_effective_value', {
      p_tenant_id: tenantId,
      p_flag_key: flagKey,
    });
    if (error) {
      console.error('[PlanFlagsService] hq_ff_get_effective_value error:', error);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const value = row?.value;
    return parseJsonbToBoolean(value);
  } catch (err) {
    console.error('[PlanFlagsService] checkPlanFlag failed:', err);
    return false;
  }
}

/**
 * Get all plan flags for a tenant (bundles, repeat last order, smart suggestions)
 */
export async function getPlanFlags(
  tenantId: string,
  supabase?: SupabaseClient
): Promise<PlanFlags> {
  const client = supabase ?? (await createClient());
  const results = await Promise.all(
    PLAN_FLAG_KEYS.map((key) => checkPlanFlag(tenantId, key, client))
  );
  return {
    bundlesEnabled: results[0] ?? false,
    repeatLastOrderEnabled: results[1] ?? false,
    smartSuggestionsEnabled: results[2] ?? false,
  };
}
