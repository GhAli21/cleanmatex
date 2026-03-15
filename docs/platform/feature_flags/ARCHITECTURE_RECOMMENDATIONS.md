---
version: v1.1.0
last_updated: 2026-03-15
author: CleanMateX Team
---

# Feature Flags & Settings — Architecture Recommendations

Comprehensive recommendations for a production-ready, maintainable, gap-free architecture with best UI/UX.

**Scope:** Feature flags (HQ system), settings (7-layer resolution), cleanmatex (tenant app), cleanmatexsaas (platform HQ).

**Migrations 0158 & 0159:** See [MIGRATIONS_0158_0159](MIGRATIONS_0158_0159.md) for full RPC reference.

---

## 1. Database Functions (Single Source of Truth)

### 1.1 Feature Flags — Current RPCs

| RPC | Purpose | Migration | Status |
|-----|---------|-----------|--------|
| `hq_ff_get_effective_value(p_tenant_id, p_flag_key)` | Single flag for tenant | 0062, 0157 | ✅ Production |
| `hq_ff_get_effective_values_batch(p_tenant_id, p_flag_keys)` | All flags for tenant in one call | **0158** | ✅ Production |
| `hq_ff_get_plan_defaults(p_plan_code, p_flag_keys)` | Plan-level values (no tenant) for comparison UI | **0159** | ✅ Production |

**Resolution order (all RPCs):** override → plan_specific → plan → default

**Critical for plan-bound boolean flags:** In `sys_ff_pln_flag_mappings_dtl`, set `plan_specific_value = true` (not NULL) and `is_enabled = true` so the RPC returns `true`; otherwise it falls back to `default_value` (often `false`).

### 1.2 Settings — Current RPCs

| RPC | Purpose | Migration | Status |
|-----|---------|-----------|--------|
| `fn_stng_resolve_setting_value(p_tenant_id, p_setting_code, p_branch_id, p_user_id)` | Single setting (7 layers) | 0071, 0123, 0151, **0160** | ✅ Layers 3 & 4 implemented |
| `fn_stng_resolve_all_settings(p_tenant_id, p_branch_id, p_user_id)` | All settings for context | 0071 | ✅ Calls fn_stng_resolve_setting_value |

**7-layer order:** SYSTEM_DEFAULT → SYSTEM_PROFILE → PLAN_CONSTRAINT → FEATURE_FLAG → TENANT_OVERRIDE → BRANCH_OVERRIDE → USER_OVERRIDE

---

## 2. What to Call — Quick Reference

### 2.1 cleanmatex (Tenant App)

| Need | Call | Service |
|------|------|---------|
| All flags for tenant | `hq_ff_get_effective_values_batch(p_tenant_id, p_flag_keys)` | `feature-flags.service.ts` → `getFeatureFlags()` |
| Single flag (e.g. API gating) | `hq_ff_get_effective_value(p_tenant_id, p_flag_key)` | `plan-flags.service.ts` → `checkPlanFlag()` |
| Plan comparison (upgrade UI) | `hq_ff_get_plan_defaults(p_plan_code, p_flag_keys)` | `feature-flags.service.ts` → `compareFeatures()` |
| All settings | `fn_stng_resolve_all_settings(p_tenant_id, p_branch_id, p_user_id)` | `tenant-settings.service.ts` |
| Single setting | `fn_stng_resolve_setting_value(...)` | `tenant-settings.service.ts` |

### 2.2 cleanmatexsaas (Platform HQ)

| Need | Call | Endpoint |
|------|------|----------|
| Tenant flags (paginated) | platform-api → `hq_ff_get_effective_value` per flag | `GET /feature-flags/tenants/:id/evaluate` |
| Plan-flag mappings | platform-api → `sys_ff_pln_flag_mappings_dtl` | `GET /feature-flags/plans/:code/flags` |
| Tenant settings | platform-api → `StngResolverService` | `GET /settings/tenants/:id/effective` |

---

## 3. Gaps & Recommendations

### 3.1 Platform-API: Use Batch RPC for Performance

**Current:** `FlagEvaluationService.evaluateMany()` calls `hq_ff_get_effective_value` per flag (25 concurrent).

**Recommendation:** Add a batch evaluation path that calls `hq_ff_get_effective_values_batch` when evaluating all flags for a tenant. Reduces N round-trips to 1.

```typescript
// platform-api: Add to FlagEvaluationService
async evaluateBatch(tenantId: string, flagKeys?: string[]): Promise<Record<string, FlagEvaluation>> {
  const { data } = await client.rpc('hq_ff_get_effective_values_batch', {
    p_tenant_id: tenantId,
    p_flag_keys: flagKeys ?? null,
  });
  // Transform JSONB map to FlagEvaluation[] format for API consistency
}
```

### 3.2 Platform-API: Expose Plan Defaults for Plan Comparison UI

**Recommendation:** Add endpoint for plan comparison (used by billing/plans UI):

```
GET /feature-flags/plans/:planCode/defaults?flagKeys=pdf_invoices,b2b_contracts
→ Calls hq_ff_get_plan_defaults(p_plan_code, p_flag_keys)
```

### 3.3 fn_stng_resolve_setting_value: Implement Layers 3 & 4

**Gap:** PLAN_CONSTRAINT and FEATURE_FLAG are TODO in the DB function.

**Recommendation:** Implement in a new migration:

- **Layer 3 (PLAN_CONSTRAINT):** Check `sys_plan_setting_constraints` (or equivalent); apply plan caps/denies.
- **Layer 4 (FEATURE_FLAG):** Read `stng_depends_on_flags` from `sys_tenant_settings_cd`; for each flag call `hq_ff_get_effective_value`; if any disabled → force to catalog default.

This keeps cleanmatex and platform-api aligned when using the DB function.

### 3.4 Tenant Self-Serve Disable (Feature Enabled by Plan)

**Scenario:** Plan enables B2B, tenant wants to disable for their users.

**Recommendation:** Use a **setting** with `stng_depends_on_flags` + tenant override:

1. Add setting `B2B_CONTRACTS_ENABLED` in catalog with `stng_depends_on_flags = ["b2b_contracts"]`, `stng_is_overridable = true`.
2. Tenant sets override to `false` in `org_tenant_settings_cf`.
3. Resolution: FEATURE_FLAG allows → TENANT_OVERRIDE disables.

---

## 4. UI/UX Best Practices (No Gaps)

### 4.1 Tenant Feature Flags Screen (Platform HQ)

| Practice | Implementation |
|----------|----------------|
| **Effective value badge** | Green for `true`, gray/red for `false`; show source (Plan: ENTERPRISE, Default, Override) |
| **Source clarity** | Badge: "Plan: ENTERPRISE", "Default", "Override" — never ambiguous |
| **Empty state** | When `plan_specific_value = NULL` and `is_enabled = false`, show: "Edit in Plan-Flag Mappings to enable for this plan." |
| **Refresh** | Prominent refresh button; auto-refresh on tab focus (stale time 5 min) |
| **Search** | Debounced (300ms) on flag_key, flag_name, data_type, value, source |
| **Sort** | Server-side for flag_key, flag_name, data_type; client-side for value/source |
| **Loading** | Skeleton rows or spinner; never blank table |
| **Pagination** | Server-side pagination with page size selector (10, 25, 50) |
| **RTL** | Support Arabic layout when `dir="rtl"` |

### 4.2 Plan-Flag Mappings Screen (Platform HQ)

| Practice | Implementation |
|----------|----------------|
| **By Plan / By Flag** | Tabs for both views; persist last selected in URL (`?view=plan&plan=ENTERPRISE`) |
| **Plan-specific value** | Boolean: checkbox; Integer: number input; String: text input. Empty = use flag default |
| **Enabled toggle** | Label: "Enabled for this plan (when false, RPC ignores this mapping)" |
| **Bulk operations** | Add multiple flags to plan, or one flag to multiple plans; optional `plan_specific_value` |
| **Validation** | Error if value doesn't match data_type (e.g. "Value must be boolean for b2b_contracts") |
| **Boolean flags** | Explicitly set `plan_specific_value = true` for enabled; avoid NULL for plan-bound flags |
| **Inline edit** | Quick edit for plan_specific_value and is_enabled without full dialog |
| **Confirmation** | Confirm before delete; show impact (e.g. "Tenants on ENTERPRISE will lose B2B") |

### 4.3 Plan Comparison UI (Billing / Upgrade)

| Practice | Implementation |
|----------|----------------|
| **RPC** | Use `hq_ff_get_plan_defaults(p_plan_code, p_flag_keys)` — no tenant overrides |
| **Visual diff** | Highlight gained (green), lost (red), unchanged (gray) |
| **Tooltips** | Show `flag_description` on hover |
| **Side-by-side** | Current plan vs target plan columns |
| **Upgrade CTA** | Clear "Upgrade" button when target has more features |

### 4.4 cleanmatex Subscription Settings

| Practice | Implementation |
|----------|----------------|
| **Tenant overrides** | Write to `org_ff_overrides_cf` via `updateFeatureFlags()` |
| **Reset to defaults** | Clear overrides; show plan defaults from `hq_ff_get_plan_defaults` |
| **Cache invalidation** | Call `invalidateCache(tenantId)` after update |
| **Read-only when not allowed** | Disable toggles when `allows_tenant_override = false` |

### 4.5 Navigation Gating

| Practice | Implementation |
|----------|----------------|
| **feature_flag** | `sys_components_cd.feature_flag` — array of flag keys |
| **Visibility** | Item visible if tenant has at least one enabled flag |
| **Navigation service** | Pass `p_feature_flags` from `getFeatureFlags()` → keys where value is truthy |
| **Loading state** | Skeleton or hide gated items until flags load |
| **Widget** | Wire `featureFlag` prop in `Widget.tsx` to `canAccess()` |

---

## 5. Consistency & Maintainability

### 5.1 Single Source of Truth

- **Feature flags:** All resolution in `hq_ff_get_effective_value` (batch wraps it).
- **Settings:** All resolution in `fn_stng_resolve_setting_value`.
- **Platform-API:** Should call DB functions, not reimplement logic. Refactor `StngResolverService` to use `fn_stng_resolve_setting_value` when DB has full 7 layers.

### 5.2 Caching

- **cleanmatex:** 5 min cache for `getFeatureFlags()`; invalidate on override update.
- **Platform-API:** Consider short cache (1–2 min) for evaluate endpoints if traffic is high.
- **DB:** No application-level cache inside RPCs; keep them stateless.

### 5.3 Error Handling

- **RPC failure:** Return safe default (e.g. `false` for boolean flags).
- **Missing flag:** `hq_ff_get_effective_value` raises; batch RPC catches and returns `false` for that key.
- **Required setting with no value:** `fn_stng_resolve_setting_value` raises with clear message.

### 5.4 Audit Trail

- **Feature flags:** `hq_ff_audit_history_tr` for flag definition, override, plan mapping changes.
- **Settings:** `org_stng_audit_log_tr` for override changes.
- **Platform-API:** `FlagAuditService` logs plan mapping updates.

---

## 6. Migration Checklist

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Apply 0158, 0159 migrations | DevOps | ✅ Done |
| 2 | cleanmatex `getFeatureFlags` uses batch RPC | Dev | ✅ Done |
| 3 | cleanmatex `compareFeatures` uses `hq_ff_get_plan_defaults` | Dev | ✅ Done |
| 4 | Platform-API: Add batch evaluate path using `hq_ff_get_effective_values_batch` | Dev | ✅ Done |
| 5 | Platform-API: Add `GET /feature-flags/plans/:planCode/defaults` | Dev | ✅ Done |
| 6 | DB: Implement FEATURE_FLAG + PLAN_CONSTRAINT in `fn_stng_resolve_setting_value` | Dev | ✅ Done (0160) |
| 7 | Add settings for tenant self-serve disable (e.g. B2B_CONTRACTS_ENABLED) | Dev | ✅ Done (0161) |
| 8 | Wire Widget `featureFlag` prop to `canAccess` | Dev | ✅ Done |
| 9 | Plan-Flag Mappings: Set `plan_specific_value = true` for boolean flags (e.g. b2b_contracts on ENTERPRISE) | Dev | ✅ Done |
| 10 | Deprecate `org_tenants_mst.feature_flags` / `sys_plan_limits.feature_flags` for resolution | Dev | Future |

---

## 7. Readiness & No-Gaps Checklist

| Area | Ready | Gap |
|------|-------|-----|
| **DB RPCs** | ✅ 0158 batch, 0159 plan defaults | — |
| **cleanmatex flags** | ✅ getFeatureFlags, compareFeatures | Widget not wired |
| **Platform-API tenant eval** | ✅ Paginated, batch path | — |
| **Platform-API plan defaults** | ✅ GET /plans/:code/defaults | — |
| **Plan-Flag Mappings** | ✅ By Plan / By Flag, bulk ops, boolean fix | — |
| **Settings 7-layer** | ✅ Layers 3 & 4 in fn_stng_resolve_setting_value | — |
| **Tenant self-serve disable** | ✅ B2B_CONTRACTS_ENABLED setting | — |
| **Widget gating** | ✅ featureFlag → canAccess | — |
| **Audit** | ✅ FlagAuditService, hq_ff_audit_history_tr | — |
| **i18n** | ✅ en.json, ar.json for feature flags screens | — |

---

## 8. Documentation Index

| Document | Description |
|----------|-------------|
| [README](README.md) | Index, quick reference |
| [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md) | Tables, RPCs, columns, resolution |
| [FEATURE_FLAGS_USAGE](FEATURE_FLAGS_USAGE.md) | Where flags are checked |
| [TENANT_AND_PLAN_FLAGS](TENANT_AND_PLAN_FLAGS.md) | HQ system, legacy deprecation |
| [PLAN_FLAGS_IMPLEMENTATION](PLAN_FLAGS_IMPLEMENTATION.md) | Plan-bound flags (bundles, repeat, suggest) |
| [NAVIGATION_FEATURE_FLAGS](NAVIGATION_FEATURE_FLAGS.md) | Navigation gating |
| [MIGRATIONS_0158_0159](MIGRATIONS_0158_0159.md) | Batch & plan-defaults RPC reference |
| [MIGRATIONS_0160_0161_0162](MIGRATIONS_0160_0161_0162.md) | Settings layers 3 & 4, B2B_CONTRACTS_ENABLED |
| **ARCHITECTURE_RECOMMENDATIONS** (this doc) | Best practices, gaps, UI/UX |

---

## 9. Summary

| Principle | Recommendation |
|-----------|-----------------|
| **Single source of truth** | DB functions own resolution |
| **Performance** | Use batch RPCs (`hq_ff_get_effective_values_batch`) for multi-flag resolution |
| **Plan comparison** | Use `hq_ff_get_plan_defaults` for plan-level values |
| **No gaps** | Implement FEATURE_FLAG + PLAN_CONSTRAINT in `fn_stng_resolve_setting_value` |
| **Tenant self-serve** | Settings with `stng_depends_on_flags` + tenant override |
| **UI/UX** | Clear badges, hints, bulk ops, validation, loading states |
| **Maintainability** | One implementation, consistent docs, audit trail |
