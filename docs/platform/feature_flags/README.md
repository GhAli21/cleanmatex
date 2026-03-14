---
version: v1.1.0
last_updated: 2026-03-15
author: CleanMateX Team
---

# Feature Flags Documentation

Feature flags are resolved via the **HQ system** (`hq_ff_feature_flags_mst`, `sys_ff_pln_flag_mappings_dtl`, `org_ff_overrides_cf`). All tenant flag resolution uses `hq_ff_get_effective_values_batch` RPC.

## Documentation Index

| Document | Description |
|----------|-------------|
| [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md) | Tables, RPCs, columns, resolution order, catalog |
| [FEATURE_FLAGS_USAGE](FEATURE_FLAGS_USAGE.md) | Where flags are checked in the codebase |
| [TENANT_AND_PLAN_FLAGS](TENANT_AND_PLAN_FLAGS.md) | HQ system, resolution order, legacy deprecation |
| [PLAN_FLAGS_IMPLEMENTATION](PLAN_FLAGS_IMPLEMENTATION.md) | Plan-bound flags (bundles_enabled, repeat_last_order, smart_suggestions) |
| [NAVIGATION_FEATURE_FLAGS](NAVIGATION_FEATURE_FLAGS.md) | Navigation gating via sys_components_cd.feature_flag |

## Quick Reference

| RPC | Purpose |
|-----|---------|
| `hq_ff_get_effective_values_batch(p_tenant_id, p_flag_keys)` | All flags for tenant |
| `hq_ff_get_effective_value(p_tenant_id, p_flag_key)` | Single flag for tenant |
| `hq_ff_get_plan_defaults(p_plan_code, p_flag_keys)` | Plan comparison (no tenant) |

**Service:** `web-admin/lib/services/feature-flags.service.ts` — `getFeatureFlags()`, `canAccess()`, `updateFeatureFlags()`, `resetToDefaults()`, `compareFeatures()`
