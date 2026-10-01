# Tenant Currency & FX — Implementation Plan 01 (tenant context)

**Status:** 🟡 IN PROGRESS — plan v2 approved 2026-09-25. L0/5A/L2/5B/5C all done. **5C (Currencies & FX screen) completed 2026-10-01 — see §0.2. Pending: migration `0540` (nav) needs owner review/apply. Next up: 5D (CSV/Excel) or 5E (URL fetch), or stop here pending owner go.**
**Resume here (both repos):** `cleanmatexsaas/docs/features/Currency_Setup/RESUME_HERE.md`
**v2 (2026-09-25):** folds in the review of the external currency pack (`REVIEW_external_currency_pack.md`): `is_base_currency` naming, full unique key, context flags defaulting FALSE, module-readiness registry, foreign cash = a drawer in that currency (CLF-aligned), `sales_pricing_mode`, reason-coded policy resolver, health panel, progressive-disclosure UI, later phases T-B (branch restriction) and T-R (tenant rounding overrides).
**Context:** **Tenant only** (`cleanmatex`: `web-admin` + `org_*` migrations)
**Sibling plan (HQ context):** `cleanmatexsaas/docs/features/Currency_Setup/implementation_plan_04_hq_fx.md`
**Split from:** `cleanmatexsaas/docs/features/Currency_Setup/_archive/implementation_plan_03_fx.md` v5 (2026-09-25; moved to `_archive/` 2026-10-01 during a docs cleanup), which is now an index/historical record only. Decision IDs carry over unchanged.
**Created:** 2026-09-25

---

## 0. Progress (updated 2026-09-25, end of cloud session)

| Stage | Status | Evidence / next action |
|---|---|---|
| **L0** drift report | ✅ done | `sql/L0_tenant_currency_drift_report.sql` run by owner (local + remote). 3 tenants, all consistent: resolved `TENANT_CURRENCY` = `org_tenants_mst.currency` = document currencies (OMR, OMR, SAR); decimals = `minor_unit`. Layer `SYSTEM_PROFILE` counts as chosen (report fixed, `7b0a944`); legacy `org_payments_dtl_tr` removed from the report |
| **5A-1** `0532_org_currency_cf.sql` | ✅ **applied local + remote** (`b631285`) | `org_currency_cf` + `org_fin_fx_stng_cf`, RLS; triggers: base lock (orders exist ⇒ base immutable, binds HQ too), mirror → `org_tenants_mst.currency`, bridge from legacy `org_tenants_mst.currency` writers (keeps new-tenant onboarding + `ensure_branch_pd_drawer` working until 4E fully retires it); backfill from resolved setting + every currency on documents/drawers; drawer composite FK (C5) validated. Types regenerated in both repos (uncommitted) |
| **5A-2** tenant rate book | ✅ **applied local + remote** (`0537_org_fx_rate_book.sql`) | `org_fx_provider_cf`, `org_fx_import_batch_mst`, `org_fx_rate_mst` — same shape/lifecycle as the HQ book (0531), tenant-scoped RLS. C3 (rate pair must have one side base/reporting, other any active tenant currency) enforced by DB trigger `fn_ofrm_pair_check`, not just the service layer. `HQ_COPY`⇒`hq_rate_id` and `URL_FETCH`⇒`provider_code` enforced by CHECK. Types regenerated, confirmed present in `database.generated.ts` |
| **5A-3** perms / flag | ✅ **applied local + remote**, verified against remote DB (`0538_rbac_permissions_currency_fx.sql`, `0539_add_feature_flag_multi_currency_fx.sql`) | 8 permissions confirmed live (`currencies:view/manage/set_base`, `fx_rates:view/manage/approve/import/manual_override`), including the `viewer` role fix (`currencies:view`/`fx_rates:view` now enabled for `viewer`, consistent with its broad-read-only pattern). Flag `multi_currency_fx` confirmed live (boolean, plan-bound, `default_value=false`). Rollback script + README in `cleanmatexsaas/docs/Added_Feature_Flags_docs/`. **Navigation still deliberately deferred** to 5C (no screen to point at yet). `web-admin/lib/constants/feature-flags.ts` FLAG_CATALOG synced (+ `multi_currency_fx: boolean` added to `FeatureFlags` in `lib/types/tenant.ts`); tsc/eslint clean |
| **L2** code cut-over | ✅ done 2026-09-26 | Re-pointed `getTenantCurrency`/`getTenantDecimalPlaces`/`getCurrencyConfig` (`tenant-settings.service.ts`) and `resolveTenantBaseCurrencyCode` (`order-financial-write.service.ts`) to new `TenantCurrencyProfileService` (`lib/services/fx/tenant-currency-profile.service.ts`, reads `org_currency_cf`); `getCurrencyConfigAction`/`useTenantCurrency` unchanged (they already delegate). Signatures preserved (unused `branchId`/`userId` params kept, prefixed `_`, since `org_currency_cf` is tenant-only). Parity + fail-loud tests added (`tenant-currency-profile.service.test.ts`, `tenant-settings.service.currency.test.ts`, `order-financial-write.resolve-base-currency.test.ts`). `MISSING_TENANT_CURRENCY` EN/AR copy updated to reference Currency Settings. tsc/eslint/i18n clean; orphaned `src/features/orders/hooks/use-tenant-currency.ts` stub (zero callers) left untouched |
| **5B** tenant FX services | ✅ **done 2026-10-01** — see §0.1 | 9 service/constant files + 6 new test files (111 tests total across 7 suites), tsc/eslint/jest/build all green |
| **5C** Currencies & FX screen | ✅ **done 2026-10-01** — see §0.2 | Full tab set (Currencies/Rates/Import/Converter/Settings) + progressive-disclosure compact view, server actions, access contract, nav dual-write. tsc/eslint/jest/i18n/access-contract/build all green. **Migration `0540` created but NOT applied — owner must review and apply** |
| 5D–5E, L4, L5 | ⬜ | per §9 |

### 0.1 — 5B resume checkpoint (2026-10-01, before a context `/clear`)

No migrations involved in 5B — this is pure application code against the already-applied `0532`/`0537` schema. Read this section first on resume; it supersedes the "Next engineering steps" list further down until 5B is marked done.

**Done, `npx tsc --noEmit` clean, `npx eslint --quiet` clean (verified individually as each file was written):**

| File | Role |
|---|---|
| `prisma/schema.prisma` | Added 10 models: `org_currency_cf`, `org_fin_fx_stng_cf`, `org_fx_provider_cf`, `org_fx_import_batch_mst`, `org_fx_rate_mst` (tenant-owned, from 0532/0537) + `sys_exchange_rate_source_cd`, `sys_fx_rate_type_cd`, `sys_fx_rate_origin_cd`, `sys_fx_provider_cd`, `sys_currency_exchange_rate_mst` (HQ-owned, read-only, from HQ 0531). Back-relations added to `org_tenants_mst`. `npx prisma generate` run twice successfully — **client codegen only, no DB connection, not a migration** |
| `lib/constants/currency-fx.ts` | All DB-mirrored enums: `FX_RATE_STATUS`, `FX_RATE_ORIGIN`, `FX_IMPORT_BATCH_STATUS`, `FX_RESOLUTION_POLICY`, `SALES_PRICING_MODE`, `FX_RESOLUTION`, `FX_RATE_SOURCE_BOOK`, `CURRENCY_CONTEXT` + `MULTI_CURRENCY_READY_CONTEXTS` (C10) + `CURRENCY_CONTEXT_COLUMN`, `CURRENCY_POLICY_REASON` (§4.3), `CURRENCY_USAGE_REASON` (C4), `FX_RATE_TYPE`, `FX_ROUNDING_CONTEXT` |
| `lib/services/fx/fx-errors.ts` | `FxError` class + `FX_ERROR` code enum, mirrors the existing `CurrencyResolutionError` pattern (`lib/money/currency-resolution.ts`) |
| `lib/services/fx/fx-decimal.ts` | **Byte-identical** port of HQ's `fx-decimal.util.ts` (diff-verified, header comment excepted) |
| `__tests__/services/fx/fx-golden-vectors.json` | Byte-identical copy of the HQ canonical fixture. SHA-256 `19879eaba8c3ae7161d13af5910093a3794f3579f0394774f272433f5997056c` (verified both sides) |
| `__tests__/services/fx/fx-decimal.test.ts` | 27 tests passing, incl. a hardcoded-checksum assertion against the fixture above (catches future drift) |
| `lib/services/fx/currency-usage.service.ts` | C4 guard — `checkCurrencyInUse(tenantId, currencyCode)`. Checks orders (`ORDER_PAYMENT_STATUS` open set), AR (`org_invoice_mst` — confirmed this table **is** the AR invoice table in this codebase, `AR_INVOICE_STATUSES`), wallets/gift-cards/advances (nonzero balance), open drawer sessions, active drawers. "Unsettled payments" is proxied by the order's own `payment_status` (documented scope decision — see comment in file) |
| `lib/services/fx/org-currency.service.ts` | Portfolio CRUD on `org_currency_cf`: `listPortfolio`, `getCurrency`, `addCurrency`, `updateCurrency`, `setBaseCurrency` (C6 — pre-checks for a clean error, DB trigger `fn_orgcur_base_lock` is still authoritative), `setReportingCurrency`, `deactivateCurrency` (C4), `reactivateCurrency`. C11 pricing mode and C10 readiness enforced |
| `lib/services/fx/fx-rate.service.ts` | Rate CRUD/lifecycle on `org_fx_rate_mst`: `listRates`, `findRate`, `createRate`, `updateRate`, `approveRate`, `rejectRate`, `voidRate`, `deleteRate`. Translates the C3 trigger (`fn_ofrm_pair_check`) exception and the one-live-rate unique violation into typed `FxError`s |
| `lib/services/fx/fx-rate-resolver.service.ts` | `resolveRate(tenantId, input)` — own book → HQ book per `org_fin_fx_stng_cf.resolution_policy` (`TENANT_THEN_HQ` default / `TENANT_ONLY` / `HQ_ONLY`), direct → inverse, publisher-precedence tie-break by `display_order`, staleness reported not enforced (mirrors HQ) |
| `lib/services/fx/currency-policy.service.ts` | §4.3 resolver — `checkCurrencyPolicy({tenantId, branchId?, drawerId?, context, currencyCode}) → {allowed, reasonCode, requiresFx, staleRateWarning?}`. Layers: global active → tenant row active + context → C10 fail-fast → branch (T-B reserved, always passes) → drawer currency match (CASH). `reasonCode` is blocking-only; `FX_RATE_STALE` surfaces as the separate non-blocking `staleRateWarning` instead (resolved exactly per the open question below) |
| `lib/services/fx/fx-import.service.ts` | **HQ-copy adapter only** (CSV/Excel/URL remain out of scope for 5D/5E) — `previewHqCopyImport`/`commitHqCopyImport`. Preview builds C3-valid pairs (base/reporting × every other active portfolio currency), pulls the latest approved HQ row per pair/source, flags duplicates against `uq_ofrm_live`, snapshots to `org_fx_import_batch_mst.preview_rows`. Commit reuses `fx-rate.service.ts`'s `createRate` per selected row (`origin_code=HQ_COPY`, `hq_rate_id`, `source_code` = the HQ row's real publisher), `approveNow` only when `auto_approve_imports` is on **and** caller-supplied `actorCanApprove` is true |

**5B is DONE as of 2026-10-01.** All 9 service/constant files + 6 new test files (`org-currency.service.test.ts`, `fx-rate.service.test.ts`, `fx-rate-resolver.service.test.ts`, `currency-usage.service.test.ts`, `currency-policy.service.test.ts`, `fx-import.service.test.ts` — 101 tests) plus the pre-existing `fx-decimal.test.ts` (27 tests, incl. the HQ fixture checksum) — **111 tests, 7 suites, all green** under `__tests__/services/fx/`.

Final validation pass, all green:
- `npx tsc --noEmit` — 0 new errors; only the 2 known pre-existing/unrelated ones remain (`fx-decimal.ts` BigInt-literal warnings ×25, `tenants.service.ts(230,8)`).
- `npx eslint --quiet lib/services/fx lib/constants/currency-fx.ts __tests__/services/fx` — clean.
- `npx jest __tests__/services/fx` — 7 suites, 111 tests passed.
- `npm run build` — succeeded (Next/SWC build; the authoritative check for the BigInt/tsconfig quirk above — confirms it is a raw-`tsc`-only artifact, not a real build blocker).

No migrations were touched in 5B — pure application code against the already-applied `0532`/`0537` schema.

**Next stage: 5C** — the Currencies/Rates/Import/Converter/Settings screen (§7.2), route via `/navigation`, gated behind `multi_currency_fx`. Load `/frontend` + `/i18n` + the UI-access-contract golden path (CRITICAL RULE 14) before writing any component.

**Known, accepted, pre-existing non-issue (do not "fix"):** `npx tsc --noEmit` reports `TS2737: BigInt literals are not available when targeting lower than ES2020` for every `0n`/`1n` literal in `fx-decimal.ts` (25 occurrences). `tsconfig.json` targets `ES2017`. This is **not new** — the same warning already exists, untouched, in the concurrent CLF code (`lib/services/cash-drawer-ledger/cash-drawer-balance.service.ts`, `lib/services/cash-drawer-session.service.ts`), confirmed via `grep -rlP "\b\d+n\b"`. Jest (babel transform) and Next's actual build (SWC) both handle BigInt literals regardless of this tsconfig field — only raw `tsc` emit cares. Bumping `tsconfig.json`'s `target` repo-wide is a separate, deliberate decision for the owner, not an in-scope fix for 5B. The other pre-existing tsc error, unrelated: `lib/services/tenants.service.ts(230,8)`.

**Established conventions to keep following for the remaining files:**
- Prisma-based (`prisma` from `@/lib/db/prisma`), wrapped in `withTenantContext(tenantId, async (tenant) => ...)`, every query explicitly filtered by `tenant_org_id` even inside that wrapper (the `$extends` tenant guard checks/rejects, never injects).
- **Permission gating is the caller's responsibility, never the service's** — matches `cash-control-settings.service.ts`'s explicit precedent comment. Do not add `hasPermissionServer`/`requirePermission` calls inside `lib/services/fx/*`.
- Typed errors via `FxError`/`FX_ERROR` (`fx-errors.ts`), not raw `throw new Error(...)`.
- Money/rates: exact decimal strings or `Prisma.Decimal`/`bigint` — never a JS `number` for a rate or an amount.

### 0.2 — 5C: Currencies & FX screen (done 2026-10-01)

**New service/constant file (beyond the 8 from 5B):**

| File | Role |
|---|---|
| `lib/services/fx/fx-settings.service.ts` | `getFxSettings`/`updateFxSettings` CRUD on `org_fin_fx_stng_cf` (resolution policy, default rate type, auto-approve imports) — the one 5B left unbuilt since no caller needed writes yet. Same conventions as every other 5B service (upsert on the tenant-unique row, no permission checks inside) |
| `lib/services/fx/fx-lookups.service.ts` | Read-only catalog projections for dropdowns: `listPlatformEnabledCurrencies`, `listAddableCurrencies` (platform-enabled minus the tenant's existing portfolio), `listFxRateTypes`, `listFxSources` |
| `lib/types/currency-fx.ts` | Type-only re-exports of the `lib/services/fx/*` row/input interfaces for client-component imports (erased at compile time, so the `server-only` guard on the source files is never violated) — same pattern as `lib/types/payment.ts` |
| `lib/services/fx/org-currency.service.ts` | **Extended** (not new): `CurrencyPortfolioRow` gained `baseLockedAt: string | null` (from `base_locked_at`) so the UI can show real lock state instead of a hardcoded claim. Existing 5B tests unaffected (no exact-shape assertions) |
| `lib/constants/permissions/currency-fx-perm.ts` | `CURRENCY_FX_PERMISSIONS` — the 8 codes from migration 0538, typed registry for programmatic use (route guards/contracts still use string literals per convention) |

**Server actions** `app/actions/fx/*.ts` (all `'use server'`, each does its own `hasPermissionServer` check — services never gate): `currency-actions.ts`, `rate-actions.ts`, `import-actions.ts`, `settings-actions.ts`, `lookup-actions.ts`, `converter-actions.ts` (composes `resolveRate` + `fx-decimal.ts`'s `convertMinor`/`formatMinor` — **never edits `fx-decimal.ts` itself**, which stays byte-identical to the HQ copy).

**Access & navigation (dual-write, CRITICAL RULE 10):**
- `src/features/fx/access/fx-access.ts` — route `/dashboard/settings/finance/currency-fx`, page gate `currencies:view`, 7 action gates, 6 `apiDependencies` entries marked `enforcement: 'external'` (server actions, not `/api/*` routes). Registered in `page-access-registry.ts`.
- `web-admin/config/navigation.ts` — `settings_currency_fx` leaf under `config_settings`, sibling to `settings_finance`/`settings_payments`/`settings_tax`, gated on `permissions: ['currencies:view']`.
- `supabase/migrations/0540_nav_currency_fx.sql` — the `sys_components_cd` half of the dual-write. **Created only — NOT applied.** Per CRITICAL RULES 1–3, stop and get owner review before this is run (local + remote).
- `npm run check:ui-access-contract -- --route=/dashboard/settings/finance/currency-fx --wire` → PASS (contract OK, page gate OK, API gate OK). `npm run sync:ui-access-contract` → 154 routes, 0 drift errors/warnings, inventories regenerated.

**UI** `src/features/fx/ui/*.tsx` (feature folder, Cmx components only):
- `currency-fx-screen.tsx` — orchestrator; progressive disclosure per §7.2: a tenant with only its base currency active sees the compact card (base currency + lock state + a `multi_currency_fx`-gated "Add a currency" CTA); once a second active currency exists, the full `CmxTabsPanel` (Currencies/Rates/Import/Converter/Settings) renders.
- `currencies-tab.tsx` + `currency-form-dialog.tsx` — portfolio table (role chips, context badges), add/edit, set-base (confirm dialog), set/clear-reporting, deactivate (confirm dialog, C4)/reactivate. Base row never shows deactivate/reporting actions.
- `rates-tab.tsx` + `rate-form-dialog.tsx` + `fx-reason-dialog.tsx` (shared reject/void-with-reason dialog, modeled on `voucher-reversal-dialog.tsx`) — lifecycle actions gated per permission (`fx_rates:approve` for approve/reject, `fx_rates:manual_override` for void + self-approve-on-create).
- `import-tab.tsx` — HQ-copy preview/commit wired live; CSV/Excel/URL rendered as explicit "coming soon" cards (no server action behind them — 5D/5E).
- `converter-tab.tsx` — ad-hoc conversion preview via `convertAmountAction`, shows which book resolved (tenant/HQ) and a non-blocking staleness note.
- `settings-tab.tsx` — resolution-policy select + auto-approve-imports toggle.
- `src/features/fx/model/currency-schema.ts`, `rate-schema.ts` — Zod schemas, RHF-driven forms, no custom i18n'd zod messages (matches `payment-config` precedent).
- `src/features/fx/lib/resolve-error-message.ts` — maps a server action's `FX_ERROR` code to `currencyFx.errors.<CODE>`, falling back to the raw message for anything unrecognized (never calls the translator with an unknown key).

**i18n:** `messages/{en,ar}/currencyFx.json` (new namespace, full tab/dialog/error coverage). Added 4 recurring platform terms to `docs/dev/i18n_docs/GLOSSARY.md` (+ both `glossary.*.json`): `base_currency`, `reporting_currency`, `exchange_rate`, `multi_currency`.

**Final validation pass, all green:**
- `npx tsc --noEmit` — 0 new errors (only the same 3 known pre-existing/unrelated ones: `fx-decimal.ts` BigInt literals, `app/actions/fx/converter-actions.ts`'s own `10n` literal — same accepted class, see below — and `tenants.service.ts(230,8)`).
- `npx eslint --quiet` over every new file — clean.
- `npx jest __tests__/services/fx` — still 111/111 (the `baseLockedAt` field addition didn't break anything).
- `npm run check:i18n` — passed (only pre-existing-pattern "same EN/AR value" warnings for format names like CSV/Excel, expected).
- `npm run check:ui-access-contract -- --wire` + `sync:ui-access-contract` — PASS, 0 drift.
- `npm run build` — succeeded; `/dashboard/settings/finance/currency-fx` compiled and listed.
- Runtime smoke test: dev server started, unauthenticated `GET /dashboard/settings/finance/currency-fx` → clean 307 to `/login` (no server crash). **Not verified: an authenticated in-browser walkthrough with real tenant data — no test credentials were available in this session.** Owner should click through the screen (Currencies → add/edit/set-base/deactivate, Rates → create/approve/reject/void, Import → HQ-copy preview/commit, Converter, Settings) before considering 5C fully QA'd.

**Known, accepted (same class as the 5B note above):** `app/actions/fx/converter-actions.ts` has one more `10n` BigInt literal (`parseMajorToMinor`) → same `TS2737` raw-`tsc`-only artifact, harmless under Jest/SWC. Not fixed, per the same owner decision already recorded for `fx-decimal.ts`.

**Deliberately out of scope for 5C (unchanged from the plan):** CSV import, Excel import, URL/provider fetch (5D/5E — need their own security review: malicious-file tests, SSRF tests); batch import history view; branch-level currency restriction (T-B); tenant rounding overrides (T-R); wiring FX into orders/invoices/payments (5G).

---

**HQ side already done (for §8 contract):** HQ `0531` applied (catalogs + HQ rate book, approved-only RLS read), HQ exchange-rate backend + screen shipped, golden vectors at `cleanmatexsaas/platform-api/src/modules/currency-fx/__tests__/fx-golden-vectors.json` (copy byte-identical into web-admin tests in 5B).

**Migration numbers actually used so far:** `0531` HQ FX catalogs/book · `0532` org_currency_cf · `0533` HQ billing FX · `0534` HQ plan prices · `0535` HQ plan currency NOT NULL fix · `0537` org_fx_rate_book (5A-2) · `0538` RBAC permissions (5A-3) · `0539` `multi_currency_fx` feature flag (5A-3) — **all applied local + remote**. `0536` went to the CLF cash-drawer program (unrelated, concurrent work), not FX. `0540` (`nav_currency_fx.sql`, 5C) **created 2026-10-01, NOT yet applied — awaiting owner review**. Last on disk: `0540`. Always `ls supabase/migrations/` before writing the next one (next free: `0541`).

---

## 1. What the tenant side owns

| Area | Summary |
|---|---|
| **A. Tenant currency authority** `org_currency_cf` | Functional (base) currency, reporting currency, foreign currencies and what each may be used for |
| **B. Legacy removal** | Retire `TENANT_CURRENCY`, `BRANCH_CURRENCY`, `TENANT_DECIMAL_PLACES`. Keep `org_tenants_mst.currency` as a synced mirror |
| **C. Tenant rate book** `org_fx_rate_mst` | The tenant's own exchange rates, authoritative for its transactions |
| **D. Fill origins** | From CleanMateX HQ · Manual · URL/provider · CSV · Excel |
| **E. Tenant screen** | Currencies · Rates · Import · Converter · Settings |

Not tenant: the HQ rate book, the shared FX catalogs, HQ billing FX, and the HQ wizard/locale tab. Those are in the HQ plan.

---

## 2. Model

```
org_currency_cf  (one row per tenant × currency)  ← THE tenant currency authority
  ├─ exactly 1 is_base_currency (DB-locked once documents exist) ──trigger──► org_tenants_mst.currency (mirror)
  ├─ 0..1 is_reporting
  └─ 0..n foreign currencies + contexts (sales · payments · cash · AR; others gated by readiness)
        ▼ constrains which pairs the rate book accepts
org_fx_rate_mst  ← filled by HQ_COPY · MANUAL · URL_FETCH · CSV_IMPORT · EXCEL_IMPORT
        ▼
resolver: own APPROVED rate → (policy) HQ APPROVED rate (sys_currency_exchange_rate_mst)
        ▼
orders / invoices freeze rate_value + fx_rate_id at post time (stage 5G, later)
decimals: sys_currency_cd.minor_unit only
```

**Why the tenant has its own book:** a tenant can be contractually bound to its bank's rate. HQ rates are a default; "Fill from HQ" **copies** them into the tenant book (a snapshot with `hq_rate_id`), so an HQ void never silently changes the tenant's history.

---

## 3. Verified facts (tenant-relevant)

| # | Fact | Where | Consequence |
|---|---|---|---|
| F1 | No FX today: `getCurrencyConfigAction` hardcodes `currencyExRate: 1` | `web-admin/app/actions/tenant/get-currency-config.ts:43` | Greenfield. Nothing breaks when the book ships |
| F3 | `currency_ex_rate` on `org_orders_mst`/`org_invoice_mst` is `DECIMAL(10,6)` (max 9 999.999999); siblings are `(18,6)`/`(19,6)`/`(22,10)` | `0090`, `0092`, `0314`, `0300` | KWD→IRR overflows. Widen to `(22,10)` before 5G |
| F6 | `web-admin` already reads `sys_currency_*` directly; the ban is only `sys_stng_*`/`sys_feature_flags_*` | CLAUDE.md | Read the HQ book through RLS; no HQ API needed |
| F7 | `xlsx@0.18.5` is a dependency with zero imports; that npm release has published advisories | `web-admin/package.json` | Server-side parse, pinned fixed build, caps (5D) |
| F8 | Provider secrets stay in env vars | `0352` | Tenants pick curated providers; no per-tenant keys in v1 |
| F9 | Tenant policy table precedent `org_fin_cash_ctrl_stng_cf` | `0515` | `org_fin_fx_stng_cf` |
| F12 | Tenant permissions need a seed migration, `resource:action` form | CRITICAL RULES 11, 13 | `0534` |
| F13 | The drawer program (CLF, ADR-057) **superseded** A4-3: no multi-currency drawers; a cash line's currency must equal the drawer's (P12); balances are per currency in `org_cash_drawer_ses_bal_dtl` | drawer `IMPLEMENTATION_PLAN.md` §4B.13, P5, P12 | Foreign cash = a drawer in that currency (C5) |
| F14 | `org_currency_cf` doesn't exist anywhere | — | Greenfield |
| F15 | `TENANT_CURRENCY`/`BRANCH_CURRENCY`/`TENANT_DECIMAL_PLACES` resolve via `fn_stng_resolve_all_settings` (`sys_tenant_settings_cd` + `sys_stng_profile_values_dtl` + `org_tenant_settings_cf`). `TENANT_CURRENCY` is tenant-level only, with a catalog default of `'OMR'`. `BRANCH_CURRENCY` is read by nothing | `0094`, `0164`, `tenant-settings.service.ts:27` | Retired per §6 |
| F16 | Currency is read through **5 entry points** (`getTenantCurrency`, `getTenantDecimalPlaces`, `getCurrencyConfig`, `getCurrencyConfigAction`, `useTenantCurrency`) plus 1 direct HQ-settings read (`resolveTenantBaseCurrencyCode`, `order-financial-write.service.ts:961`). About 113 files / 179 `useTenantCurrency` calls sit behind them | grep | The cut-over touches about 7 files |
| F17 | `org_tenants_mst.currency` is a third copy: the tenant profile locks it once orders exist (`tenant-profile.service.ts:253`); HQ does not lock it | — | Mirror trigger + DB lock (C6) |

---

## 4. `org_currency_cf` (15 chars)

```sql
id                        UUID PK DEFAULT gen_random_uuid(),
tenant_org_id             UUID NOT NULL → org_tenants_mst(id),
currency_code             TEXT NOT NULL → sys_currency_cd(code),   -- no default

-- roles
is_base_currency          BOOLEAN NOT NULL DEFAULT FALSE,  -- = functional; exactly 1 per tenant
base_locked_at            TIMESTAMPTZ NULL,                -- stamped at first posted document (C6)
is_reporting_currency     BOOLEAN NOT NULL DEFAULT FALSE,  -- ≤ 1; NULL role = "same as base"

-- contexts (defaults FALSE; base row forced TRUE for every READY context — §4.2)
allow_sales               BOOLEAN NOT NULL DEFAULT FALSE,
allow_payments            BOOLEAN NOT NULL DEFAULT FALSE,  -- non-cash tenders
allow_cash                BOOLEAN NOT NULL DEFAULT FALSE,  -- drawers may be created in it (C5)
allow_ar                  BOOLEAN NOT NULL DEFAULT FALSE,
allow_wallet              BOOLEAN NOT NULL DEFAULT FALSE,  -- not ready (§4.2)
allow_gift_card           BOOLEAN NOT NULL DEFAULT FALSE,  -- not ready
allow_customer_advance    BOOLEAN NOT NULL DEFAULT FALSE,  -- not ready
allow_purchasing          BOOLEAN NOT NULL DEFAULT FALSE,  -- AP + PO; not ready

-- pricing
sales_pricing_mode        TEXT NOT NULL DEFAULT 'CONVERT_FROM_BASE'
                          CHECK (sales_pricing_mode IN ('CONVERT_FROM_BASE','PRICE_LIST')),  -- PRICE_LIST reserved

-- FX policy/defaults (never a current rate)
default_rate_type_code    TEXT NULL → sys_fx_rate_type_cd(code),
default_rate_source_code  TEXT NULL → sys_exchange_rate_source_cd(code),
rate_max_age_days         INTEGER NULL CHECK (> 0),
allow_manual_fx_rate      BOOLEAN NOT NULL DEFAULT FALSE,
manual_fx_requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
manual_rate_tolerance_pct NUMERIC(7,4) NULL CHECK (>= 0),
tax_rate_source_code      TEXT NULL → sys_exchange_rate_source_cd(code),

display_order, is_active, rec_status/rec_order/rec_notes, metadata JSONB,
created_at/created_by TEXT/created_info, updated_at/updated_by TEXT/updated_info
```

**Keys, constraints and triggers:**
- **Full unique** `uq_orgcur (tenant_org_id, currency_code)`, **not partial**, so composite FKs can target it (branch table, drawers, transactions). Deactivate/reactivate the same row; never re-insert.
- **Partial unique:** one active base per tenant; at most one active reporting per tenant.
- **CHECK:** base ⇒ `is_active` and every READY context flag TRUE.
- **CHECK:** base ≠ reporting.
- `UNIQUE (tenant_org_id, id)`. Standard tenant RLS and indexes.
- **Mirror trigger** `trg_orgcur_sync_tenant_ccy`: base row insert/update → `org_tenants_mst.currency` (same transaction). `0523`'s `ensure_branch_pd_drawer` already reads that column, which is another reason to keep it.
- **Lock trigger:** rejects changing the base row or its code when `base_locked_at IS NOT NULL`.

### 4.1 Rules

| # | Rule |
|---|---|
| **C1** | `org_currency_cf` is the only authority. After cut-over, nothing reads the 3 legacy settings, and `org_tenants_mst.currency` is only a mirror |
| C2 | A currency can be added only if it is `is_active` + `is_platform_enabled` in `sys_currency_cd` (service). HQ's usage guard counts these rows |
| C3 | Rate-book pairs: one side base/reporting, the other an active `org_currency_cf` row |
| C4 | **Deactivation / context-off guard** (`CurrencyUsageService`, tenant side). Blocked while any of these exist in that currency: open (unpaid/partly paid) orders or invoices, unsettled payments, non-zero wallet/gift-card/advance balances, open AR, open drawer sessions or active drawers. The base row can't be deactivated |
| **C5** | **Foreign cash = a drawer in that currency.** `org_cash_drawers_mst (tenant_org_id, currency_code)` gets a composite FK → `org_currency_cf` (`NOT VALID` → `VALIDATE` after L1 backfills drawer currencies). Creating or activating a drawer requires `allow_cash = true`. No multi-currency drawers (drawer plan P12, §4B.13) |
| **C6** | The base currency is locked **in the DB** once documents exist. Before that, changing it needs `currencies:set_base`. After, only a future controlled migration process can change it |
| C7 | `tax_rate_source_code` pins tax-document conversion to a regulator-accepted source (enforced at 5G) |
| **C8** | Decimals = `sys_currency_cd.minor_unit` |
| **C9** | **Refunds go back in the original tender's currency.** This is an invariant, not a toggle (there is deliberately no `allow_refunds`) |
| **C10** | **Module-readiness registry:** `MULTI_CURRENCY_READY_CONTEXTS` (constant, DB-mirrored names). Enabling a not-ready context for a foreign currency → `CURRENCY_CONTEXT_NOT_READY`. The UI shows it disabled, with a hint. v1 ready: `SALES`, `PAYMENTS`, `CASH`, `AR` |
| **C11** | `sales_pricing_mode = CONVERT_FROM_BASE`: the foreign price is the base price converted at the resolved rate. It is rounded by the currency's `FX_CONVERSION` rule, with **the rate and the rounding shown inline** (CRITICAL RULE 15) and frozen on the order. `PRICE_LIST` is rejected until price lists support currencies |

### 4.2 Why these context flags, and not others

| Flag | Default | v1 | Note |
|---|---|---|---|
| `allow_sales` / `allow_payments` / `allow_cash` / `allow_ar` | FALSE | ready | Base row forced TRUE |
| `allow_wallet` / `allow_gift_card` / `allow_customer_advance` | FALSE | not ready | Foreign stored value is a liability that needs revaluation first |
| `allow_purchasing` | FALSE | not ready | ERP-lite AP/PO is not multi-currency yet |
| ~~`allow_refunds`~~ | — | — | Replaced by C9 |
| ~~`allow_accounting`, `allow_customer_credit`~~ | — | — | Derived: every document is accounting, and credit notes follow their invoice |
| ~~`requires_fx`~~, ~~`is_default_display_currency`~~ | — | — | Derived / no consumer |

### 4.3 Policy resolver (the one decision point)

`currency-policy.service.ts` → `check({ tenant, branch?, drawer?, context, currency }) → { allowed, reasonCode, requiresFx }`.
- Layers: global active → tenant row active + context → context ready (C10) → branch (T-B, when present) → drawer currency (cash).
- **Reason codes:** `CURRENCY_NOT_ENABLED` · `CONTEXT_NOT_ALLOWED` · `CONTEXT_NOT_READY` · `BRANCH_RESTRICTED` · `NO_DRAWER_IN_CURRENCY` · `FX_RATE_MISSING` · `FX_RATE_STALE`. Each maps 1:1 to the i18n key `currencyPolicy.reasons.<CODE>`, so the UI shows business language via `cmxMessage` and never internal flags.
- **Every module** (orders, payments, drawers, AR) calls this instead of re-implementing rules.

### 4.4 Owned elsewhere (contract)
- **Cash policy:** `org_fin_cash_ctrl_stng_cf` (drawer program).
- **Tenant denominations:** `org_currency_denom_cf` (drawer program C1-1b).
- **Per-currency session balances:** `org_cash_drawer_ses_bal_dtl` (CLF).

This plan does **not** create drawer, cash-policy or denomination tables.

---

## 5. Tenant rate book and policy

| Object | Chars | Content |
|---|---|---|
| `org_fin_fx_stng_cf` | 18 | Per tenant: `resolution_policy` (`TENANT_THEN_HQ` default / `TENANT_ONLY` / `HQ_ONLY`), `default_rate_type_code`, `auto_approve_imports` (default false). No row = defaults |
| `org_fx_provider_cf` | 18 | `provider_code` → `sys_fx_provider_cd`, `currency_codes TEXT[]`, `rate_type_code`, `is_active`, `last_fetch_*`. **No URL, no secret** |
| `org_fx_import_batch_mst` | 23 | `origin_code`, `provider_code`, file name/hash, `status` (`PREVIEWED`/`COMMITTED`/`FAILED`/`CANCELLED`), counts, errors, capped `preview_rows` |
| `org_fx_rate_mst` | 15 | Same columns as the HQ book (HQ plan §5.1) + `tenant_org_id`, `hq_rate_id` → `sys_currency_exchange_rate_mst`, `provider_code`. Unique "one live rate" prefixed with `tenant_org_id` |

**Tenant rate-book rules:**
- Rate lifecycle: `DRAFT → APPROVED` / `REJECTED`, `APPROVED → VOIDED`.
- Approved rates are immutable; correct one by voiding it and entering a new draft. Self-approval is allowed and audited.
- `NUMERIC(22,10)`; rates handled as strings.
- Resolution: direct → inverse. No triangulation.
- Audit via the tenant app's existing audit pattern.

---

## 6. Legacy removal

The resolver fails loudly when currency is missing (B15), so the order is **code first, settings last**.

| Step | What | Safety |
|---|---|---|
| **L0 — Drift report** | Read-only SQL. For each tenant, compare the resolved `TENANT_CURRENCY`, `org_tenants_mst.currency`, and `TENANT_DECIMAL_PLACES` vs `minor_unit`, whether orders exist, and the currencies on existing orders/invoices. **Owner resolves mismatches** | No writes |
| **L1 = `0532`** | Create `org_currency_cf` + `org_fin_fx_stng_cf` + triggers. Backfill one **base** row per tenant from the value `fn_stng_resolve_all_settings` returns today for `TENANT_CURRENCY` (so behavior is preserved) → else `org_tenants_mst.currency` → else no row (reported). Add rows (contexts off) for other currencies already on documents **or on `org_cash_drawers_mst`**, then add the drawer composite FK (C5) `NOT VALID` → `VALIDATE`. Stamp `base_locked_at` for tenants with history. Mirror → `org_tenants_mst.currency` | Additive; the settings are untouched |
| **L2 — Code cut-over** ✅ done 2026-09-26 | Re-pointed the 5 entry points + `resolveTenantBaseCurrencyCode` to `tenant-currency-profile.service`. **Signatures unchanged.** Updated the `MISSING_TENANT_CURRENCY` EN/AR message | Parity tests ✅ · tsc/eslint/i18n ✅ (full suite/build not re-run this session — no other module touched) |
| *(HQ 4E)* | HQ wizard, locale tab and settings screens move to `org_currency_cf` (HQ plan §6) | HQ plan |
| **L4** (`05xx`) | Soft-retire the 3 settings (catalog, profile values, tenant overrides: `is_active = false`, `rec_status = 0`). Refresh platform inventories and settings docs. **Needs your explicit go**, and only after L2 + HQ 4E are deployed | Reversible |
| **L5** (`05xx`, one release later) | Hard-delete the 3 settings' rows. `org_tenants_mst.currency` is **kept** | Own review |

---

## 7. Tenant build

### 7.1 Services `web-admin/lib/services/fx/`

| File | Role |
|---|---|
| `tenant-currency-profile.service.ts` | **The** entry point: `{ base, reporting?, currencies[] }` joined with `sys_currency_cd`, cached per request |
| `currency-policy.service.ts` | §4.3 resolver + reason codes |
| `currency-usage.service.ts` | C4 guard (open docs, balances, drawers, sessions) |
| `org-currency.service.ts` | Portfolio CRUD enforcing C2, C4, C5, C10, C11; `set-base` guarded by `currencies:set_base` + C6 |
| `fx-decimal.ts` | Same math as the HQ plan §7.4; same golden fixture (checksum-compared) |
| `fx-rate-resolver.service.ts` | Own approved rate → HQ approved rate per policy; returns which book answered |
| `fx-rate.service.ts` | Rate CRUD + lifecycle; every query filters `tenant_org_id` |
| `fx-import.service.ts` | Preview → commit pipeline + adapters (below) |

| Adapter | Origin | Notes |
|---|---|---|
| `hq-copy` | `HQ_COPY` | HQ approved rates by pair/date/type; keeps `hq_rate_id` and the HQ source; the preview marks duplicates and HQ-voided rows |
| manual form | `MANUAL` | single-row create |
| `csv` | `CSV_IMPORT` | template header whitelist `from_currency,to_currency,rate_date,rate_type,rate,source_reference`; server-side parse; rate kept as a string |
| `excel` | `EXCEL_IMPORT` | same template; server-side, pinned fixed SheetJS build, 2 MB / 5 000 rows, first sheet, values only |
| `url` | `URL_FETCH` | curated `sys_fx_provider_cd` only; allowlisted host, HTTPS, redirect re-check, timeout/size cap; env key via `env_key_name` |

Every import validates per row (portfolio pair under C3, rate format, duplicates), then shows a preview with errors, then commits valid rows as `DRAFT`. Rows land `APPROVED` only if `auto_approve_imports` is on **and** the user holds `fx_rates:approve`.

### 7.2 Screen `src/features/fx-rates/` (route via `/navigation`): progressive disclosure

**Single-currency tenant (default)** sees only:
```
Currencies
  Base currency     OMR   🔒 Locked (after first document)
  Multi-currency    [ Off ]   ← visible only when the multi_currency_fx flag allows it
```
No FX, rates, import, drawer or advanced controls.

**After the first foreign currency is enabled**, the tabs appear:
- **Currencies:**
  - One list: base row + foreign rows with status chips
  - "Add currency" (platform-enabled currencies only)
  - Selecting a row opens a concise panel: Sales · Payments · Cash · AR toggles, then **FX** (rate type, source, manual rate allowed/approval/tolerance, max age), then **Advanced ▸** (reporting role, tax rate source, not-ready contexts shown disabled with "coming with <module>", pricing mode)
  - **Health line** per currency: rate fresh? drawer exists if cash? denominations available? tax source set?
- **Rates:** table, filters, status actions, "Correct"
- **Import:** From CleanMateX HQ · Manual · From URL/provider · CSV · Excel · batch history
- **Converter**
- **Settings:** resolution policy, auto-approve imports, providers

**POS / order screens:**
- A currency selector appears **only** when the policy resolver returns more than one allowed currency for that context/branch/drawer.
- Converted prices show the rate and rounding inline (C11).

**Conventions:**
- Errors use reason-code messages ("USD cash is not enabled for this branch"), never flag names.
- Cmx components only (`.clauderc`), `cmxMessage`/`useMessage()`, full EN/AR + RTL, `npm run check:i18n`.
- UI-access-contract golden path (CRITICAL RULE 14).

### 7.3 Gating migrations

Numbers below are illustrative only — always `ls supabase/migrations/` at write time (this plan has already collided twice: `0533`–`0535` went to HQ H-A, `0536` went to the CLF cash-drawer program; `0537` is `org_fx_rate_book.sql`, 5A-2).

| # | Content | Skill | Status |
|---|---|---|---|
| `0538` ✅ | `currencies:view`, `currencies:manage`, **`currencies:set_base`** (elevated), `fx_rates:view`, `fx_rates:manage`, `fx_rates:approve`, `fx_rates:import`, **`fx_rates:manual_override`** + role mapping | `/create-update-rbac-permission`, `/update-rbac-role` | applied local + remote |
| `0540` ⬜ | `sys_components_cd` nav + `navigation.ts` dual-write | `/navigation` | **created, awaiting owner review/apply** |
| `0539` ✅ | Feature flag `multi_currency_fx` (+ plan mappings) + `FLAG_CATALOG` | `/create-feature-flag` | applied local + remote |

---

## 8. Contract with the HQ plan

| Tenant needs from HQ | Blocks |
|---|---|
| HQ `0531` applied (rate-type/origin/provider catalogs, `cleanmatex_hq` source, HQ book with approved-only RLS) | `0532` (FK to `sys_fx_rate_type_cd`), `0533` |
| Golden fixture (canonical in HQ) | 5B tests |
| HQ 4E shipped (wizard, locale tab, settings screens on `org_currency_cf`) | L4 |

| Tenant provides to HQ | Used by |
|---|---|
| `0532`: `org_currency_cf` + mirror + lock triggers | HQ 4E, HQ usage guard, HQ billing currency choice (H2) |

---

## 9. Sequencing (tenant)

| Stage | Work | Depends on | Exit | Est. |
|---|---|---|---|---|
| **L0** ✅ | Drift report; owner resolves — clean 2026-09-25 | — | clean report | 0.5 d |
| **5A** ✅ | `0532`, `0537`, `0538`, `0539` — **all applied local + remote, verified against the live DB**. Navigation (nav half of 5A-3) deferred to 5C (route doesn't exist yet) | HQ `0531` ✅, L0 ✅ | applied ✅ | 1.5 d |
| **L2** ✅ | Code cut-over (5 entry points) — done 2026-09-26 | 5A | tsc/eslint/i18n + parity tests ✅ | 1.5 d |
| **5B** ✅ | FX services + HQ-copy adapter + golden tests — done 2026-10-01 | 5A | tsc/eslint/tests/build ✅ (111 tests) | 2 d |
| **5C** ✅ | Screen: Currencies, Rates, Manual, From HQ, Converter, Settings — done 2026-10-01 | 5B | build + eslint + check:i18n + access-contract ✅; migration `0540` pending owner apply | 2.5 d |
| **5D** | CSV + Excel import | 5C | + malicious-file tests | 1.5 d |
| **5E** | URL fetch (ECB first) | 5C | + SSRF tests | 1.5 d |
| **L4** | Soft-retire the settings (your go) | L2 + HQ 4E deployed | applied | 0.5 d |
| **L5** | Hard delete (one release later) | L4 | applied | 0.5 d |

**Tenant total ≈ 12–13 days.**

**Later:**
- **T-B** branch restriction `org_branch_currency_cf` (22 chars): restrict-only, composite FK → `org_currency_cf (tenant_org_id, currency_code)`, no row = inherit. Plugs into the §4.3 resolver's branch layer
- **T-R** tenant rounding overrides `org_currency_rounding_rules_cf` (30 chars): only where `sys_currency_rounding_rules_cf.is_tenant_overridable` (never `TAX`/`ACCOUNTING`), `INTEGER` increment, FKs to `sys_rounding_context_cd`/`sys_rounding_mode_cd`. Resolution: tenant override → HQ rule → `minor_unit`
- Composite FK `(tenant_org_id, currency_code) → org_currency_cf` on transaction currency columns (with 5G)
- Flip C10 readiness for wallet / gift card / advance / purchasing as each module supports multi-currency (+ revaluation for stored value)
- **5F** custom tenant URL (security review)
- **5G** wire rates into orders/invoices/payments: widen `currency_ex_rate` to `(22,10)`, `fx_rate_id`/`fx_rate_date`/`fx_rate_source`, freeze at post (each payment its own rate), C7 tax source
- scheduled auto-fetch / auto-copy
- per-tenant provider keys

---

## 10. Open questions (tenant)

| # | Question | Default |
|---|---|---|
| Q2 | Default resolution policy | `TENANT_THEN_HQ` |
| Q4 | Screen location | Finance settings area (via `/navigation`) |
| Q5 | `multi_currency_fx` plan-bound? | Yes, top plans |
| Q6 | Scheduled auto-copy from HQ? | No in v1 |
| Q7 | Plan limit on the number of currencies? | No cap in v1 |
| Q9 | Go for L4? | Asked again at L4 |

---

## 11. Risks (tenant)

- **R3 — `xlsx` advisories.** Mitigations: server-side parse, pinned build, caps.
- **R2 — SSRF.** Curated providers only in v1.
- **R4 — `(10,6)` overflow** at 5G. Widen first.
- **R8 — HQ copy staleness.** Rows copied from HQ rates that HQ later voids are flagged, not auto-changed.
- **R9 — Cut-over order.** Settings are retired only after L2 + HQ 4E.
- **R10 — Parity.** Every tenant resolves the same currency before and after L2 (L0 proves it).
- **R11 — Rounding change** for tenants whose `TENANT_DECIMAL_PLACES` ≠ `minor_unit` (listed in L0).
- **R13 — Cross-plan ordering** (§8).
- **R14 — Config ahead of code.** C10 readiness prevents enabling contexts whose module can't handle a foreign currency yet.
- **R15 — Drawer composite FK** (C5) touches a drawer-program table. Coordinate with that program. It is additive (`NOT VALID` first).
