# Settings Resolver Remediation Plan

**Date:** 2026-10-28 · **Status:** S1 ✅ · S2 ✅ · S3 ✅ applied 2026-10-28 and verified · S4 waits for production measurement · **Source:** `Database_CPU_Remediation_Report_27102026_01.md` §1

## Progress (2026-10-28)

| Step | Result |
|---|---|
| S1 `0647` | Applied local + remote by owner; types and Prisma regenerated. |
| S2 equivalence | All-settings: 7 contexts, 287 rows, **0 diffs**. Single-setting: 287, **0 diffs**. Covered layers: SYSTEM_DEFAULT, SYSTEM_PROFILE, FEATURE_FLAG, TENANT_OVERRIDE. **Not covered by live data:** PLAN_CONSTRAINT as the winner, BRANCH/USER overrides (no such rows exist). |
| Catalog change since the plan | `INV_PDF_ENABLED`, `PRN_THERMAL_ENABLED`, `RCPT_WHATSAPP_ENABLED` are now `is_active=false`, so the B1 error rows are gone from live output. The object-form parser stays supported. |
| Bug found in 0647 | `deps_invalid` returned NULL for `{}` and scalar values, so the flag layer was silently skipped. Fixed in `0648` (no active row was affected). |
| Measurement | Warm (50 calls): old 20.2 ms → new **3.5 ms**. First call per connection: 56 → 34 ms (plpgsql compile and plan). |
| S3 `0648` | Applied local + remote. Verified on remote: both public functions delegate to the set-based core, the flag fix is present, grants are unchanged, and the unknown code returns the same `ERROR_AT: Checking Catalog` row. Warm: all settings **4.4 ms** (was 20.2), single setting **0.44 ms**. First call per connection about 36 ms (a one-off 287 ms right after the DDL invalidated cached plans). |
| Real-traffic check (2026-10-28) | Too little traffic to measure. Remote: only 4 new RPC calls, average 359 ms (cold connections). Local: 0 calls. The app's `.env.local` points to local `127.0.0.1:54321`. |
| Simulated app path | Remote, as `authenticated` with a real user JWT (RLS active), rolled back: all settings **5.4 ms** warm, single setting **2.1 ms** warm, **first call per connection 247 ms**. |
| New finding → next candidate | 240 of 354 public RLS policies use unwrapped `current_tenant_id()` (a SECURITY DEFINER lookup on `org_users_mst`), and 81 use unwrapped `auth.uid()`/`auth.jwt()`. Postgres may evaluate these per row. The Supabase-recommended form is `(SELECT current_tenant_id())`, which runs once per statement. This affects every `org_*` query, not only settings. Plan it separately. |
| Next | After a few days of real traffic, read the `fn_stng_resolve_all_settings` RPC mean in `pg_stat_statements` (baseline 144 ms over 19,318 calls). Do S4 (one settings RPC shared per request in `TenantSettingsService`) only if the RPC still ranks high. |

## 1. Verified evidence (remote DB, PG 17.6)

| Fact | Value |
|---|---|
| `fn_stng_resolve_all_settings` RPC | 19,318 calls, mean 144 ms, 2.78M ms total (top app statement) |
| Live `EXPLAIN ANALYZE`, 1 tenant + branch | **99.7 ms, 3,003 buffer hits** for 44 rows |
| Active catalog settings | 44 (7 array flag-deps, 3 object flag-deps, 5 required-not-null) |
| `org_tenant_settings_cf` | 20 rows, 0 duplicate active scope keys, 0 user rows |
| Max profile chain depth | 4 |
| Index from the report | `org_tenant_settings_lookup_active_idx` **already exists on remote but in no migration** (drift) |

**Root cause:** each call runs N=44 separate resolutions. Each one re-reads the catalog (twice), `org_tenants_mst` (twice), subscriptions, the profile chain (≤4 reads plus a value read per level), plan constraints, up to 3 override scans, and `hq_ff_get_effective_value` for each flag of each setting (≈4 queries each). That is about 350–450 statements per call. The cost comes from repeating these reads, not from the size of any table. An index cannot fix that.

## 2. Bugs found while tracing (current behavior)

| # | Finding | Impact |
|---|---|---|
| B1 | `INV_PDF_ENABLED`, `PRN_THERMAL_ENABLED`, `RCPT_WHATSAPP_ENABLED` store `stng_depends_on_flags` as an object `{"required_flags":[...]}`. `jsonb_array_length` throws on it, so these settings **always** return an `ERROR_AT` row. | `TenantSettingsService.checkIfSettingAllowed` maps the `{error:...}` object through `Boolean(obj)` and gets **true**. The three settings look enabled regardless of their flags. |
| B2 | Plan `deny`/`max_value` (priority 300) and a disabled feature flag (400) are overridden by any tenant/branch/user override (500–700). | A plan cap or a disabled flag can be bypassed by an override. This is a business-rule gap: preserve the behavior, owner decides. |
| B3 | The user-override lookup ignores `branch_id`. No unique key exists on the override scope, so a duplicate row would make the result arbitrary (`SELECT INTO` takes any row). | No duplicates today, but nothing prevents them. |
| B4 | Callers resolve all 44 settings to read one (`getSettingValue`, `getSettingValueJson`, `checkIfSettingAllowed`, `getSettingValueStrict`, the SQL `... WHERE stng_code = $4`). Every helper call is a full RPC. | Multiplies the database load from the app side. |

## 3. Chosen design

**Load the context once, fetch each source once, then fold the layers in memory.** One internal resolver serves both public functions, so their logic can no longer drift apart.

`fn_stng_resolve_settings_set(p_tenant_id, p_branch_id, p_user_id, p_setting_codes text[] DEFAULT NULL)`, plpgsql STABLE:

1. **Context once:** the tenant row (profile code, `s_current_plan`), the plan code (subscription → tenant → `FREE_TRIAL`, same as today), and the profile chain (`fn_stng_get_profile_chain`). Every `org_*` read filters `tenant_org_id` / `id = p_tenant_id` explicitly.
2. **Flags once per distinct key:** normalize the dependency format (`array`, or `object.required_flags`), which fixes B1. Then call `hq_ff_get_effective_value` once per distinct key (6 today, versus once per setting per flag). Each call keeps its own exception guard so a failure still counts as disabled.
3. **One batched query** returns one row per setting: catalog fields, the best non-null profile value with its priority (`unnest(chain) WITH ORDINALITY`, same `200 + (len-i+1)*10` formula), the last found profile code, aggregated plan constraints, and the tenant, branch and user override values (one scan of `org_tenant_settings_cf` with `tenant_org_id = p_tenant_id AND is_active AND setting_code = ANY(...)`).
4. **In-memory fold** over ≤44 rows that mirrors today's order exactly: default → profile → plan (`deny` first, then `max/min_value` using a `pg_input_is_valid(...,'numeric')` guard in place of the exception) → flag → tenant → branch → user. The required/allows-null validation and the per-setting `ERROR_AT` rows keep the same text, so one bad setting never fails the whole call.

The public signatures stay unchanged, so the TS types and RPC contracts need no change:
- `fn_stng_resolve_all_settings(...)` returns `SELECT * FROM fn_stng_resolve_settings_set(..., NULL)`.
- `fn_stng_resolve_setting_value(...)` keeps its catalog-not-found error row, then calls `fn_stng_resolve_settings_set(..., ARRAY[code])`.

**Target:** under 5 ms and under 100 buffer hits per call (from 100 ms and 3,003). About 15 statements instead of about 400.

### Rejected / deferred

| Option | Decision | Why |
|---|---|---|
| New index only | Reject as the fix | It already exists and the measurement is still 100 ms. The problem is repetition. The index is codified only to remove drift. |
| Effective-settings cache table | Reject now | Invalidation spans 5 sources, including HQ-managed flags and plans. Once the resolver is fast it is unnecessary, and it risks stale money/tax settings. |
| One giant pure-SQL CTE | Reject | Proving equivalence (exceptions, layer metadata, required rules) is much harder. The hybrid keeps the old control flow readable. |
| Fix B2/B3 semantics now | Defer to owner | This is a behavior change on plan/flag enforcement and must not ride inside a performance change. |

## 4. Steps (each is one measured change)

| Step | Deliverable | Gate |
|---|---|---|
| S1 | `0647_stng_resolve_settings_set.sql`: **additive only**. The new function plus the index codified with `IF NOT EXISTS`. | User applies |
| S2 | Equivalence diff on remote (read-only): old vs new for every tenant × {no branch, each branch} × {null user, each override user}, excluding `stng_computed_at`. | Zero diffs except the 3 B1 settings (expected fix) |
| S3 | `0648_stng_resolver_use_set.sql`: rewire both public functions to the new core. | User applies, then re-run `EXPLAIN ANALYZE`, record the number |
| S4 | App side: per-request memoization in `TenantSettingsService` so helper calls share one RPC (B4), and point `getSettingValueStrict` / error rows to fail closed. | jest + tsc + eslint + build; only if S3 numbers still justify it |
| S5 | Optional: partial unique index on the override scope, `(tenant_org_id, setting_code, branch_id, user_id) NULLS NOT DISTINCT WHERE is_active` (B3). | Owner approval |
| S6 | Owner decision on B2 (should plan caps and disabled flags beat overrides?). | Separate ADR if changed |

Each step updates `current_status.md` and `CHANGELOG.md` in this folder.

## 5. Risks

- **B1 fix changes the result for 3 settings:** they go from always-error (read as true) to flag-gated. If `pdf_invoices`, `printing` or `whatsapp_receipts` are off for a tenant, those features turn **off**. This is correct, but visible. The app is pre-launch, with demo tenants only.
- `hq_ff_get_effective_value` stays VOLATILE and SECURITY DEFINER, called from a STABLE function. That is unchanged from today.
- Currency no longer uses this path (`org_currency_cf`, migration 0532). **VAT still does:** `TaxService.getTaxRate` (the `tax_fallback` in order-calculation and commercial-checkout, plus pricing and order-change preview) and the public booking route read `TENANT_VAT_RATE` from settings. S2 equivalence is a hard gate before S3.
- **Out of scope, tracked gap:** move VAT reads to the org tax profile (Line-Level program, 0642/0645), retire the `TENANT_VAT_RATE` / `TAX_RATE` settings fallback, and remove `TaxService`'s 5-minute in-memory VAT cache ([tax.service.ts:35](../../../../web-admin/lib/services/tax.service.ts)), which is a stale-money risk today.
