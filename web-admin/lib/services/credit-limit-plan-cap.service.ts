/**
 * Credit Limit Plan Cap Service
 * Resolves tenant's plan cap for B2B credit_limit via hq_ff_get_effective_value.
 * Per-customer credit_limit must be ≤ plan cap (Zero-Gap checklist).
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const CREDIT_LIMITS_FLAG = 'credit_limits';

/**
 * Get the maximum credit limit allowed for B2B customers based on tenant's plan.
 * Returns null if no cap is configured (e.g. flag not enabled for plan).
 */
export async function getCreditLimitPlanCap(
  tenantId: string
): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('hq_ff_get_effective_value', {
      p_tenant_id: tenantId,
      p_flag_key: CREDIT_LIMITS_FLAG,
    });
    if (error) {
      logger.warn('Credit limit plan cap lookup failed', {
        feature: 'b2b',
        action: 'getCreditLimitPlanCap',
        tenantId,
        error: error.message,
      });
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const value = row?.value;
    if (value === null || value === undefined) return null;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch (err) {
    logger.warn('Credit limit plan cap lookup failed', {
      feature: 'b2b',
      action: 'getCreditLimitPlanCap',
      tenantId,
    });
    return null;
  }
}

/**
 * Cap credit limit to plan maximum. Returns the value to use.
 * If planCap is null, returns requested as-is.
 */
export function capCreditLimitToPlan(
  requested: number,
  planCap: number | null
): number {
  if (planCap == null || planCap <= 0) return requested;
  return Math.min(requested, planCap);
}
