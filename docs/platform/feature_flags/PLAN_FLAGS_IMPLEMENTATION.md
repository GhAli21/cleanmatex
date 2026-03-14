---
version: v1.1.0
last_updated: 2026-03-15
author: CleanMateX Team
---

# Plan Flags Implementation Guide

Implementation guide for plan-bound feature flags (`bundles_enabled`, `repeat_last_order`, `smart_suggestions`) used in the new order Items Details tab.

## Overview

These flags are resolved via `hq_ff_get_effective_value` RPC from `hq_ff_feature_flags_mst` and `sys_ff_pln_flag_mappings_dtl`. They are separate from tenant settings (`sys_tenant_settings_cd`).

**Note:** For all-flag resolution (e.g. navigation, gating), use `feature-flags.service.ts` → `getFeatureFlags()` which calls `hq_ff_get_effective_values_batch`. This service is for the three plan-bound flags used in the new order UI.

## Components

### Service Layer

**File:** `web-admin/lib/services/plan-flags.service.ts`

- `getPlanFlags(tenantId)` — Fetches all three flags for a tenant
- `checkPlanFlag(tenantId, flagKey, supabase?)` — Single flag check (for API gating)
- Uses RPC `hq_ff_get_effective_value(p_tenant_id, p_flag_key)`
- Parses JSONB value to boolean; returns `false` on error or RPC failure

### Constants

**File:** `web-admin/lib/constants/plan-flags.ts`

- `PLAN_FLAG_KEYS` — `['bundles_enabled', 'repeat_last_order', 'smart_suggestions']`
- `PlanFlags` interface — `bundlesEnabled`, `repeatLastOrderEnabled`, `smartSuggestionsEnabled`

### API Route

**File:** `web-admin/app/api/v1/plan-flags/route.ts`

- `GET` — Requires auth; resolves tenant via `get_user_tenants` RPC
- Returns `{ bundlesEnabled, repeatLastOrderEnabled, smartSuggestionsEnabled }`
- 401 if unauthenticated; 403 if no tenant access

### Client Hook

**File:** `web-admin/src/features/orders/hooks/use-plan-flags.ts`

- `usePlanFlags()` — React Query hook
- Fetches from `/api/v1/plan-flags`
- Returns flags (default `false` when loading/error) and `isLoading`, `error`
- Stale time: 5 minutes
- Enabled only when `currentTenant?.tenant_id` is set

### UI Wiring

- **new-order-content.tsx** — Uses `usePlanFlags`, passes flags to `OrderDetailsSection`
- **order-details-section.tsx** — Receives `bundlesEnabled`, `repeatLastOrderEnabled`, `smartSuggestionsEnabled`; gates CarePackageBundles, RepeatLastOrderPanel, SmartSuggestionsPanel

### API Gating

| Route | Flag | Response when disabled |
|-------|------|-------------------------|
| POST /api/v1/orders/[id]/items/[itemId]/apply-bundle/[bundleCode] | bundles_enabled | 403 "Care Packages not available on your plan" |
| GET /api/v1/preferences/last-order | repeat_last_order | 403 "Repeat Last Order not available on your plan" |
| GET /api/v1/preferences/suggest | smart_suggestions | 403 "Smart Suggestions not available on your plan" |

## Fallback Behavior

- **No tenant:** Hook returns `false` for all flags; panels hidden
- **API error:** Hook returns `false`; UI does not crash
- **RPC error:** Service returns `false` for that flag
- **No org_pln_subscriptions_mst:** RPC returns `default_value` (false)

## Migration

Ensure migrations 0062, 0066, 0067, 0140 are applied so `bundles_enabled`, `repeat_last_order`, `smart_suggestions` exist in `hq_ff_feature_flags_mst` and `sys_ff_pln_flag_mappings_dtl`.

## See Also

- [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md) — RPCs, resolution order, full catalog
- [FEATURE_FLAGS_USAGE](FEATURE_FLAGS_USAGE.md)
- [TENANT_AND_PLAN_FLAGS](TENANT_AND_PLAN_FLAGS.md)
