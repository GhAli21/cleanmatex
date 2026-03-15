---
version: v1.0.0
last_updated: 2026-03-15
author: CleanMateX Team
---

# Migrations 0158 & 0159 — Batch & Plan Defaults RPCs

Reference for the feature flag batch and plan-defaults database functions.

---

## 0158 — hq_ff_get_effective_values_batch

**File:** `supabase/migrations/0158_hq_ff_get_effective_values_batch.sql`

### Purpose

Resolve multiple feature flags for a tenant in a single database call. Reduces N round-trips to 1 when loading all flags (e.g. navigation, subscription settings, plan comparison).

### Signature

```sql
hq_ff_get_effective_values_batch(
  p_tenant_id UUID,
  p_flag_keys TEXT[] DEFAULT NULL
) RETURNS JSONB
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| p_tenant_id | UUID | Tenant ID (required) |
| p_flag_keys | TEXT[] | Flag keys to resolve; NULL = all active flags |

### Return Value

JSONB object mapping flag keys to effective values:

```json
{
  "pdf_invoices": true,
  "b2b_contracts": true,
  "bundles_enabled": 5,
  "service_preferences_enabled": 10
}
```

### Resolution Order

Same as `hq_ff_get_effective_value`:

1. **Override** — `org_ff_overrides_cf` (approved, active)
2. **Plan-specific** — `sys_ff_pln_flag_mappings_dtl` for tenant's plan
3. **Plan** — `hq_ff_feature_flags_mst.enabled_plan_codes`
4. **Default** — `hq_ff_feature_flags_mst.default_value`

### Error Handling

- Unknown flag key: Returns `false` (to_jsonb(false)) for that key
- RPC exception: Caught per-flag; other flags still returned

### Usage

| Consumer | Service | Notes |
|----------|---------|-------|
| cleanmatex | `feature-flags.service.ts` → `getFeatureFlags()` | All flags for tenant |
| cleanmatex | `navigation.service.ts` | Passes `p_feature_flags` to nav tree |
| platform-api | `FlagEvaluationService` | TODO: Add batch path |

---

## 0159 — hq_ff_get_plan_defaults

**File:** `supabase/migrations/0159_hq_ff_get_plan_defaults.sql`

### Purpose

Resolve feature flag values at the **plan level only** (no tenant overrides). Used for plan comparison UI (upgrade/downgrade), billing plans display, and "what you get" views.

### Signature

```sql
hq_ff_get_plan_defaults(
  p_plan_code VARCHAR,
  p_flag_keys TEXT[] DEFAULT NULL
) RETURNS JSONB
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| p_plan_code | VARCHAR | Plan code (e.g. ENTERPRISE, GROWTH) |
| p_flag_keys | TEXT[] | Flag keys to resolve; NULL = all active flags |

### Return Value

JSONB object mapping flag keys to plan-level values:

```json
{
  "pdf_invoices": true,
  "b2b_contracts": true,
  "bundles_enabled": -1,
  "service_preferences_enabled": -1
}
```

### Resolution Logic (No Tenant)

1. **Plan-specific** — `sys_ff_pln_flag_mappings_dtl` where `plan_code = p_plan_code` and `is_enabled = true`
   - Uses `plan_specific_value` if set; else `default_value` from catalog
2. **Plan (enabled_plan_codes)** — If flag is `plan_bound` and plan in `enabled_plan_codes`, use `default_value`
3. **Default** — `false` for plan_bound flags not in plan; catalog `default_value` for independent flags

### Important: plan_specific_value

For boolean flags (e.g. `b2b_contracts`), if `plan_specific_value` is NULL in `sys_ff_pln_flag_mappings_dtl`, the RPC uses `default_value` from `hq_ff_feature_flags_mst` (often `false`). To enable a flag for a plan:

- Set `plan_specific_value = true` (JSONB) **and** `is_enabled = true` in Plan-Flag Mappings.

### Usage

| Consumer | Service | Notes |
|----------|---------|-------|
| cleanmatex | `feature-flags.service.ts` → `compareFeatures()` | Compare current vs target plan |
| platform-api | — | TODO: `GET /feature-flags/plans/:planCode/defaults` |
| Billing UI | — | Show plan features in upgrade flow |

---

## See Also

- [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md)
- [ARCHITECTURE_RECOMMENDATIONS](ARCHITECTURE_RECOMMENDATIONS.md)
- [TENANT_AND_PLAN_FLAGS](TENANT_AND_PLAN_FLAGS.md)
