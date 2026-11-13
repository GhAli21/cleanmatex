# Setup Health — Plan 2: selective runs + QA fixes

**Status:** IMPLEMENTED 2026-11-13 (0740 + browser QA pending) — see STATUS.md row P2
**Parent:** [PLAN.md](PLAN.md) (closed engineering) · [STATUS.md](STATUS.md) · QA source: [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) "Financial_Expert_Tester" results
**Owner request (2026-11-13):** (1) run checks for all or chosen organizations and all or chosen checks; (2) fix every QA finding; (3) close every open issue, production-ready.

## 1. Root causes found (evidence)

| Finding | Root cause | Evidence |
|---|---|---|
| P0 HqHealthInconsistent | **Not a Setup Health bug.** Tax was confirmed between the two loads. HQ Tax kit page showed a 1-minute-old cached status | `org_tax_config_cf` for `1111…`: `updated_at 2026-11-13 04:59:36+04`, `updated_info fn_tax_config_confirm` (tester loads: 04:58 and 04:59). HQ React Query default `staleTime 60s`, `refetchOnWindowFocus false` (`platform-web/components/providers.tsx`); `useTenantTaxSetup` uses the default |
| P1 ErpLiteRowShown (T9) | A check can name only one feature flag. ERP-Lite readiness needs two (`erp_lite_enabled` AND `erp_lite_readiness_enabled`) | Registry `ERP_LITE_NOT_READY.feature_flag_key = erp_lite_readiness_enabled`; demo org: `erp_lite_enabled=false`, `erp_lite_readiness_enabled=true`; readiness page checks both |
| P1 DirectUrlNotRefused (T4) + ViewerBlankPage (T3) | Page gate `RequireAnyPermission` has `fallback = null` → blank page. Viewer has no `setup_health:view` (0710), so "contact support" can never show | `app/dashboard/setup-health/page.tsx`, `RequirePermission.tsx:72` |
| P2 OkTitlesDescribeProblem | Registry has only the problem title | `sys_setup_health_check_cd.name` |
| P2 SpeedCheckOkOnEconomy | Check is right (any active speed rule = more than Standard). The description talks only about faster speeds | `fn_shc_speed_no_rules`, description text |
| P2 HqTenantsPagination | `page` can be larger than the last page (page restored from the URL / table preference while the filtered total shrinks); never clamped | `app/tenants/page.tsx` |
| P2 JwtTestInSidebar | Developer page `jhtestui` is a normal menu item | `config/navigation.ts:1135`, `sys_components_cd.jhtestui` |
| P3 TilePlurals | `homeCard.counts` is not ICU plural | `messages/{en,ar}/setupHealth.json` |
| P3 ArabicNavEnglish | 9 active menu rows have no `label2` (also `assembly` label is "AssemblyJh") | `sys_components_cd`: assembly, billing_invoices, catalog, catalog_addons, drivers, help, home, jhtestui, orders |
| P3 HqArabicLeftovers | Shared HQ components hardcode English ("Audit History", audit drawer texts) | `cmx-page-header.tsx:96`, `cmx-datatable.tsx:631`, `cmx-audit-timeline-drawer.tsx` |
| P3 HqFilterPlaceholders | **By design**: HQ "Label - [column]" convention (`CmxFieldLabel column`) | `cmx-field-help.tsx:44` — no change |
| P3 HqFilterAppliesImmediately | Selects apply at once; the button only applies the search text but says "Apply Filters" | rename label |
| P3 SetupHealthSlowLoad / ViewerBannerLate | To measure first (performance rule). Suspects: banner + home card each call `/summary` (each runs all checks + HQ flag fetch + permission lookups) | measure, then one change |
| P3 SignOutSaysExpired, LoginAutocomplete, AdminNameTypo | Outside Setup Health (auth, demo data). Root cause to trace during work | — |

## 2. Feature: selective run (owner item 1)

HQ Tenant Organizations list (`/tenants`):
- **Check Setup Now** (header) and **Recheck Setup** (row menu) open one dialog **Run setup checks**:
  - Organizations: *All active* or *Selected* (organization picker; the row is preselected when opened from the row menu).
  - Checks: *All* or *Selected* (grouped by area: Tax, Business calendar, Service speeds, Accounting; from the registry).
  - **Run** → results table in the dialog: organization · blockers · warnings · info · could not check · failing checks (name + severity) · link to its Setup Health page.
- Only a run with **All checks** updates the stored counts shown in the list (a partial run would make them wrong). The dialog says so.
- API (platform-api, `tenant_setup_health:view`):
  - `GET /tenants/setup-health/checks` — registry for the picker (code, area, severity, names EN/AR).
  - `POST /tenants/setup-health/runs` — `{ tenantIds?: uuid[] (max 500), checkCodes?: string[] }` → per organization counts + failing checks. Replaces the two `/refresh` endpoints added earlier today (callers moved; no other users).
- DB: `fn_setup_health_run_bulk(p_tenants uuid[], p_checks text[])` — one call, one failing organization does not stop the rest (logged, returned as an error row), flag filtering done in SQL with the same rule as the stored counts.

## 3. Migrations (each: live last + 1 at write time, then STOP for owner apply)

**M1 — Setup Health registry v2**
1. `feature_flag_keys TEXT[]` (check shows only when **all** flags are on) replaces `feature_flag_key` (backfilled, then dropped — pre-launch). `ERP_LITE_NOT_READY` → `{erp_lite_enabled, erp_lite_readiness_enabled}`.
2. `ok_name` / `ok_name2` (title when the check passes), NOT NULL, seeded for all 11 checks (incl. the 7 `TAX_*` rows; the Tax session is told).
3. `SPEED_NO_RULES` description EN/AR reworded: no active speed rule → customers can only choose Standard; add a rule (e.g. Express, Economy).
4. `fn_setup_health_flags_on(p_tenant, p_keys)` — one flag rule for SQL callers.
5. `fn_setup_health_run(p_tenant, p_branch, p_domain, p_checks TEXT[] DEFAULT NULL)` — returns `feature_flag_keys`, `ok_name`, `ok_name2` (DROP + CREATE, RESTRICT).
6. `fn_setup_health_refresh_sum` uses the shared flag rule; new `fn_setup_health_run_bulk`.
7. Full object comments; check contract for Tax M8 (`fn_shc_*`) unchanged.

**M2 — Tenant navigation fixes (owner changed it before applying: `jhtestui` is NOT retired, the catalog label reads الترميزات والتسعير)** (`/navigation` dual-write): Arabic `label2` for the 9 rows, `assembly` label "Assembly", `jhtestui` deactivated (and removed from `navigation.ts`; page stays, admin-only by URL).

**M3 — dropped:** the "Admin Demo Lanudry" typo is one demo user's `display_name` in the remote database, not seed data. The owner fixes it in the Users screen.

**Numbering:** M1 = 0738 (applied), M2 = 0740 (0739 belongs to Service Speeds).

## 4. Code changes

Tenant app (`cleanmatex/web-admin`):
- Page gate shows a refusal (CmxEmptyState + lock; reuse existing denied wording where it exists) — T3/T4.
- Service: flag filter over all `feature_flagKeys`; item gets `okName/okName2`; screen shows the OK title for OK rows.
- Home card ICU plurals EN/AR.
- Performance: measure `/summary` (server timings per step) and the client requests; then one change (expected: banner and home card share one cached query; flags read once per request), retest.
- Auth (after root cause): voluntary sign-out must not show "session expired"; login fields' `autocomplete`/`name` so browsers fill email and password correctly. HQ login the same.

HQ (`cleanmatexsaas`):
- `tenant-setup-health` module: checks catalog + runs endpoints, bulk service, flag rule via keys; dialog `TenantSetupHealthRunDialog` (Cmx only) in `src/features/tenants/ui/`; list page wires it.
- List pagination clamp to the last page after load.
- Tax kit tenant query: always refetch on open (`staleTime: 0`) — status is changed from the tenant app (one line in the Tax feature; Tax session told).
- Shared HQ components: "Audit History" and audit drawer texts through `common.audit.*` (backward compatible: explicit labels still win).
- "Apply Filters" → "Apply search" (EN/AR).

## 5. Tests and gates

- DB: integration test for `fn_setup_health_run_bulk` (all/selected tenants and checks, failing tenant isolated, flags all-must-be-on, partial run does not write counts), `fn_setup_health_run` with `p_checks`.
- Tenant: service (multi-flag, okName), page refusal, home card plurals.
- HQ: service + controller specs (validation: max 500 ids, unknown check codes rejected), dialog behaviour.
- Both repos: eslint, typecheck, build, check:i18n, access-contract + inventories refresh (nav changed), targeted jest.

## 6. Steps

1. M1 → STOP (owner applies, regenerates types + Prisma) → update STATUS.
2. HQ backend (catalog, runs, bulk) + tests → STATUS.
3. HQ dialog + list wiring + pagination clamp + tax-kit refetch + shared audit labels + filter button → gates → STATUS.
4. Tenant fixes (refusal, okName, multi-flag, plurals) → gates → STATUS.
5. M2 (+ navigation.ts) → STOP → inventories refresh → STATUS.
6. Performance measure → one change → retest → STATUS.
7. Auth fixes (sign-out reason, login autocomplete, both apps) → gates → STATUS.
8. M3 if needed → STOP.
9. Docs: QA guide (new rows + retest list for every FET finding), user guide EN/AR, developer guide, README, followups, memory; tell the Tax session (registry v2, tax-kit refetch).

## 7. Not doing (and why)

- `[status]` / `[s_current_plan]` hints in HQ filters: deliberate HQ convention.
- Re-testing P0 as a Setup Health bug: data changed between loads; the real fix is the Tax kit page refetch.
