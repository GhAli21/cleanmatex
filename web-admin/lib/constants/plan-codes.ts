/**
 * Plan code bridging between billing subscriptions (org_pln_subscriptions_mst /
 * sys_pln_subscription_plans_mst) and legacy limits catalog (sys_plan_limits).
 *
 * Billing stores UPPER_SNAKE_CASE (e.g. ENTERPRISE); sys_plan_limits uses lowercase
 * snake (e.g. enterprise). UI subscription screens read from sys_plan_limits.
 */

const BILLING_TO_LIMITS: Record<string, string> = {
  FREE_TRIAL: 'free',
  STARTER: 'starter',
  GROWTH: 'growth',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

const LIMITS_TO_BILLING: Record<string, string> = {
  free: 'FREE_TRIAL',
  starter: 'STARTER',
  growth: 'GROWTH',
  pro: 'PRO',
  enterprise: 'ENTERPRISE',
};

/**
 * Normalize any plan code to the sys_plan_limits catalog key (lowercase).
 */
export function toLimitsPlanCode(planCode: string): string {
  const trimmed = planCode.trim();
  if (!trimmed) return trimmed;
  const upper = trimmed.toUpperCase();
  if (BILLING_TO_LIMITS[upper]) {
    return BILLING_TO_LIMITS[upper];
  }
  return trimmed.toLowerCase();
}

/**
 * Convert a sys_plan_limits code to the billing subscription plan_code value.
 */
export function toBillingPlanCode(planCode: string): string {
  const limitsCode = toLimitsPlanCode(planCode);
  return LIMITS_TO_BILLING[limitsCode] ?? planCode.toUpperCase();
}

/**
 * Compare plan codes across billing and limits catalogs.
 */
export function planCodesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return toLimitsPlanCode(a) === toLimitsPlanCode(b);
}
