/**
 * Plan-bound feature flags for Order Service Preferences
 * Resolved via hq_ff_get_effective_value RPC (hq_ff_feature_flags_mst + sys_ff_pln_flag_mappings_dtl)
 */

export const PLAN_FLAG_KEYS = [
  'bundles_enabled',
  'repeat_last_order',
  'smart_suggestions',
] as const;

export type PlanFlagKey = (typeof PLAN_FLAG_KEYS)[number];

export interface PlanFlags {
  bundlesEnabled: boolean;
  repeatLastOrderEnabled: boolean;
  smartSuggestionsEnabled: boolean;
}
