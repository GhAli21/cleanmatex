# Changelog

## 1.6.0 — 2026-10-28 — Verification of 0650–0652; 0653 written

- Applied local + remote by owner and verified on remote:
  - **0652:** resolver fingerprint (17 settings × 7 contexts) `27355a0f…` **identical**; 17 active settings; 0 active plan constraints; 0 error rows.
  - **0650:** `is_admin()` covers admin; 0 `role='admin'`-only policies; 311 policies (−43 service_role); 27 policies use `is_admin()`; `role` is text; `uq_ots_scope_act` present, `idx_ots_lookup_act` gone.
  - **Visibility:** cashier and anon fingerprints unchanged. The tenant admin now passes `is_admin()` and sees exactly its own tenant's rows (`cmx_effective_permissions` 433/987, `org_auth_user_roles` 2/6), as intended.
  - **0651:** new function executable by postgres and service_role only. Old batch vs new is **identical** for all 3 tenants (all 302 flags plus a subset with an unknown key). Warm: 79.1 → **7.7 ms** (10.3×).
- `0653` (applied local + remote, verified: both DBs delegate and grant postgres/service_role only; remote output identical for all tenants (302 flags); an `authenticated` session reading another tenant's flags now gets `42501 permission denied`): batch delegates to the set-based core and is revoked from anon/authenticated (both callers are service-role).

## 1.5.0 — 2026-10-28 — Settings ceilings and catalog cleanup

- `0652`: plan constraints and feature flags are now **ceilings** applied after overrides. A disabled flag or plan deny forces `stng_disabled_value_jsonb` (new column; NULL = `false` for booleans, else the default).
- Deactivated 24 settings that nothing reads (audited web-admin, cmx-api, HQ and SQL functions): AUTO_CLOSE_DAYS, B2B_CONTRACTS_ENABLED, ERP_LITE_ENABLED, ERP_LITE_FIRST_PERIOD_START, ERP_LITE_FISCAL_YEAR_START, ERP_LITE_PERIOD_CLOSE_ENABLED, ORD_ALLOW_BACKWARD_TRANSITIONS, ORD_QUICK_DROP_ENABLED, ORD_READY_BY_REQUIRED, PEAK_SEASON_START, SERVICE_PREF_ALLOW_NOTES, SERVICE_PREF_BUNDLES_SHOW_SAVINGS, SERVICE_PREF_DEFAULT_PACKING, SERVICE_PREF_REQUIRE_CONFIRMATION, SERVICE_PREF_SHOW_PRICE_ON_COUNTER, SYS_TIMEZONE, TENANT_DATE_FORMAT, TENANT_FIRST_DAY_OF_WEEK, TENANT_LANGUAGE, TENANT_LOCALE, TENANT_TIME_FORMAT, UI_RTL_ENABLED, WF_TEMPLATE_DEFAULT, TENANT_VAT_ENABLED. 41 → 17 active. `TAX_RATE` and `TENANT_VAT_RATE` stay until the VAT retirement plan (`get_product_price_with_tax` reads `TAX_RATE`).
- Deactivated all 15 plan constraints: they target setting codes that are not in the catalog.
- Feature-flag batch rewire renumbered to `0653` (after the `0651` equivalence check).
- HQ (cleanmatexsaas) is cross-tenant by design, so its override update by `id` is not an isolation issue. The earlier finding is withdrawn.

## 1.4.0 — 2026-10-28 — Admin roles, cleanup, feature-flag batch (pending apply)

- `0650`: `is_admin()` accepts super_admin, tenant_admin and admin (pinned search_path), and 21 RBAC-table policies use it (previously role `'admin'` only, held by no user). Dropped 43 service_role-only policies (no-ops: service_role has BYPASSRLS). `org_users_mst.role` changed to TEXT (remote varchar drift); the 4 navigation policies were recreated identically and stay super_admin-only because the table is global. `uq_ots_scope_act`: one active override per scope (HQ check-then-insert race) replaces `idx_ots_lookup_act`. In-migration assertions.
- Security (from automated review): the flag RPCs are SECURITY DEFINER and take `p_tenant_id` from the caller, so any anon/authenticated session could read any tenant's flags. `0651` grants the new function to `service_role` only. `feature-flags.service.ts#getFeatureFlags` now calls the RPC with the server-only `createAdminSupabaseClient()`, which keeps public booking (`canAccess(tenantId,'online_booking')`) working. `0652` (after equivalence) will rewire the batch and revoke it from anon/authenticated. Still open: `hq_ff_get_effective_value` (single flag) is called with session clients by `plan-flags.service.ts` and `credit-limit-plan-cap.service.ts`, and by HQ.
- `0651`: set-based `hq_ff_get_eff_values_set` (additive). `hq_ff_get_effective_values_batch` looped 302 flags with a subtransaction each (159 ms mean). It is rewired after the equivalence check.
- Realtime: only `org_ntf_inbox_mst` is published. The bell subscription (`use-notification-bell.ts`) is filtered to `recipient_user_id` and cleaned up on unmount, so no change is needed. `realtime.list_changes` volume is the Realtime server polling the WAL while subscribers are connected.
- Item 2 (VAT fallback retirement): plan at `Line_Level_Money_Snapshot/VAT_Settings_Fallback_Retirement_Plan.md`. BlueWave needs a profile backfill first.
- Item 3: `Settings_Entitlement_Precedence_Recommendation.md`.

## 1.3.0 — 2026-10-28 — RLS auth-helper wrapping (see `RLS_InitPlan_Remediation_Plan.md`)

- `0649` (applied local + remote, verified: 0 unwrapped, visibility fingerprints identical for 3 contexts, permissions 40.6 → 2.4 ms, settings under RLS 5.4 → 3.1 ms): wraps `current_tenant_id()`, `is_admin()`, `auth.uid()`, `auth.jwt()` and `auth.role()` as `(SELECT …)` in 319 public policies, transformed from each DB's own catalog (local/remote deparse drift). Self-verifying in one transaction.
- Evidence: admin/own-row policy on `cmx_effective_permissions` 40.6 → 1.7 ms (23×).
- Visibility baseline for 3 contexts and the review listing are in `technical_docs/rls_0649_policy_diff.md`.
- Prevention: rule added to `docs/dev/rules/performance-engineering.md` §7; check `supabase/checks/rls_unwrapped_auth_helpers.sql`.

## 1.2.0 — 2026-10-28 — Settings resolver (see `Settings_Resolver_Remediation_Plan.md`)

- `0647` (applied local + remote): added set-based `fn_stng_resolve_settings_set`; renamed the drifted 37-char index `org_tenant_settings_lookup_active_idx` to `idx_ots_lookup_act` and codified it.
- Equivalence on remote: all-settings 7 contexts / 287 rows / 0 diffs; single-setting 287 / 0 diffs. Warm call 20.2 ms → 3.5 ms (first call on a connection 56 → 34 ms).
- `0648` (applied local + remote, verified: all settings 4.4 ms warm, single setting 0.44 ms): fixes a 0647 bug where a malformed `stng_depends_on_flags` silently skipped the flag layer, and rewires both public resolvers to the set-based core with unchanged signatures.

## 1.1.1 — 2026-10-24

- Added mandatory Step 0 and PERF-00: revalidate the actual related system and latest evidence before implementing or resuming work from the plan.
- Required explicit task applicability, stale-evidence review, preservation of in-progress changes and plan revision before candidate selection.
- Added a revalidation record template and reference to the tester log; kept implementation waiting for the user's future request.
- Documentation only; no current-system runtime review, benchmark, application change or migration is claimed.
- Linked feature-specific coding guidance to the common repository performance rules; the broader skill/instruction update does not initiate this feature's pending implementation.

## 1.1.0 — 2026-10-24

- Made the baseline-first, one-change, tester-feedback and stop loop the active execution sequence in the main and development plans.
- Reclassified P1-P5 as candidate workstreams; removed the implication that all phases must be delivered or started while the baseline is blocked.
- Replaced the broad completion checklist with per-improvement evidence, engineering disposition and stopping requirements.
- Preserved detailed designs, deferred proposals and all existing tester entries. No threshold, benchmark, selected candidate or application result was invented.
- Documentation only; no application, fixture, migration or deployment change.

## 1.0.2 — 2026-10-24

- Added a tester handoff procedure and append-only results/engineer-response log with improvement/run IDs and explicit acceptance dispositions.
- Recorded the agreed one-small-measured-improvement policy and stopping rule in the overview and implementation plan.
- Linked the tester workflow from the scenario catalog. No results, thresholds, owners or completed optimizations were fabricated.
- Documentation only; no application, fixture, migration or deployment change.

## 1.0.1 — 2026-10-24

- Added `performance-coding-rules.md` with 18 implementation rule groups and a review checklist.
- Linked coding requirements from the overview and implementation plan; preserved pending implementation/deferred status.
- Documentation only; no application or migration change.

## 1.0.0 — 2026-10-24

- Created the requested Performance_Enhance implementation-planning pack.
- Defined P0-P6 scope, invariants, tasks, affected layers, acceptance gates and review boundaries.
- Separated D01-D09 deferred proposals into individual files.
- Added developer/cashier flows, financial snapshot rules, testing, benchmarking, rollout, decisions, risks and status records.
- Preserved the earlier coordinated-quote evidence as historical starting-point information, including unresolved configured-fixture runtime proof.
- Documentation only: no application change, migration, deployment, provider call or new test-run result is claimed.
