---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Tenant and Plan Feature Flags

`org_tenants_mst.feature_flags` vs `hq_ff_*` tables and `sys_plan_limits.feature_flags`.

**Source:** `org_tenants_mst`, `sys_plan_limits`, `web-admin/lib/services/subscriptions.service.ts`, `web-admin/lib/services/feature-flags.service.ts`

## Two Systems

| System | Tables/Columns | Purpose |
|--------|----------------|---------|
| Plan/tenant JSON | org_tenants_mst.feature_flags, sys_plan_limits.feature_flags | Subscription plan features (pdf_invoices, driver_app, etc.) |
| HQ-managed | hq_ff_feature_flags_mst, sys_ff_pln_flag_mappings_dtl, org_ff_overrides_cf | Fine-grained flags (service_preferences_enabled, per_piece_packing, etc.) |

## org_tenants_mst.feature_flags

- JSON object: `{ pdf_invoices: boolean, whatsapp_receipts: boolean, ... }`
- Overrides plan defaults when set (tenant-specific enable/disable).
- Resolution: `feature-flags.service.ts` checks tenant first; if null, falls back to plan.

## sys_plan_limits.feature_flags

- JSON object per plan (FREE_TRIAL, STARTER, GROWTH, PRO, ENTERPRISE).
- Defines which features each plan includes.
- Used when tenant has no custom override.

## Resolution Order (feature-flags.service.ts)

1. **Tenant override** — If `tenant.feature_flags` is set, use it.
2. **Plan defaults** — Else use `plan.feature_flags` from `sys_plan_limits` for tenant's `s_current_plan`.
3. **Fallback** — If plan lookup fails, return all-false defaults.

## Subscriptions Service

**File:** `web-admin/lib/services/subscriptions.service.ts`

- `feature_flags` passed when upgrading: `feature_flags: newPlan.feature_flags`
- Free plan: `feature_flags: freePlan.feature_flags`

## SubscriptionSettings UI

**File:** `web-admin/src/features/settings/ui/SubscriptionSettings.tsx`

- Displays `tenant.feature_flags` as key-value pairs (enabled/disabled).

## Widget Component

**File:** `web-admin/src/features/dashboard/ui/Widget.tsx`

- `featureFlag?: FeatureFlagKey` prop — intended for feature-flag gating.
- **TODO:** Not yet wired to `canAccess` / `getFeatureFlags`; currently all features shown in dev.

## See Also

- [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md)
- [FEATURE_FLAGS_USAGE](FEATURE_FLAGS_USAGE.md)
- [PLAN_LIMITS_REFERENCE](../plan_limits/PLAN_LIMITS_REFERENCE.md)
- [SUBSCRIPTION_UI](../plan_limits/SUBSCRIPTION_UI.md)
