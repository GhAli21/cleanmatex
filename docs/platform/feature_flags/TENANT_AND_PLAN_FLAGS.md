---
version: v1.0.0
last_updated: 2026-03-15
author: CleanMateX Team
---

# Tenant and Plan Feature Flags

**Primary source:** HQ system (`hq_ff_feature_flags_mst`, `sys_ff_pln_flag_mappings_dtl`, `org_ff_overrides_cf`).

**Source:** `web-admin/lib/services/feature-flags.service.ts`, `hq_ff_get_effective_values_batch` RPC

## HQ System (Primary)

| Table | Purpose |
|-------|---------|
| hq_ff_feature_flags_mst | Global flag definitions |
| sys_ff_pln_flag_mappings_dtl | Plan-flag relationships with plan-specific values |
| org_ff_overrides_cf | Tenant-specific overrides (highest priority) |

## Resolution Order (feature-flags.service.ts)

1. **Tenant override** — `org_ff_overrides_cf` (approved, active, within effective dates)
2. **Plan-specific** — `sys_ff_pln_flag_mappings_dtl` for tenant's subscription plan
3. **Plan (enabled_plan_codes)** — Fallback from `hq_ff_feature_flags_mst.enabled_plan_codes`
4. **Default** — `hq_ff_feature_flags_mst.default_value`

Resolved via `hq_ff_get_effective_values_batch(p_tenant_id, p_flag_keys)` RPC.

## Plan Comparison (compareFeatures)

Uses `hq_ff_get_plan_defaults(p_plan_code, p_flag_keys)` RPC — plan-level values without tenant overrides. Source: `sys_ff_pln_flag_mappings_dtl` + `hq_ff_feature_flags_mst`.

## Legacy (Deprecated)

| System | Status |
|--------|--------|
| org_tenants_mst.feature_flags | Deprecated; overrides now in org_ff_overrides_cf |
| sys_plan_limits.feature_flags | Deprecated for flag resolution; may still be used for plan display |

## Subscriptions Service

**File:** `web-admin/lib/services/subscriptions.service.ts`

- `feature_flags` passed when upgrading: `feature_flags: newPlan.feature_flags`
- Free plan: `feature_flags: freePlan.feature_flags`

## SubscriptionSettings UI

**File:** `web-admin/src/features/settings/ui/SubscriptionSettings.tsx`

- Displays tenant feature flags. Overrides are written to `org_ff_overrides_cf` via `updateFeatureFlags()` / `resetToDefaults()`.

## Widget Component

**File:** `web-admin/src/features/dashboard/ui/Widget.tsx`

- `featureFlag?: FeatureFlagKey` prop — intended for feature-flag gating.
- **TODO:** Not yet wired to `canAccess` / `getFeatureFlags`; currently all features shown in dev.

## See Also

- [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md)
- [FEATURE_FLAGS_USAGE](FEATURE_FLAGS_USAGE.md)
- [PLAN_LIMITS_REFERENCE](../plan_limits/PLAN_LIMITS_REFERENCE.md)
- [SUBSCRIPTION_UI](../plan_limits/SUBSCRIPTION_UI.md)
