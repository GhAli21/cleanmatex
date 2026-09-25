# Tenant Currency & FX — Implementation Plan 01 (tenant context)

**Status:** 📝 DRAFT v2 — awaiting owner approval. No code, no migration written yet.
**v2 (2026-09-25):** folds in the review of the external currency pack (`REVIEW_external_currency_pack.md`): `is_base_currency` naming, full unique key, context flags defaulting FALSE, module-readiness registry, foreign cash = a drawer in that currency (CLF-aligned), `sales_pricing_mode`, reason-coded policy resolver, health panel, progressive-disclosure UI, later phases T-B (branch restriction) and T-R (tenant rounding overrides).
**Context:** **Tenant only** (`cleanmatex`: `web-admin` + `org_*` migrations)
**Sibling plan (HQ context):** `cleanmatexsaas/docs/features/Currency_Setup/implementation_plan_04_hq_fx.md`
**Split from:** `cleanmatexsaas/docs/features/Currency_Setup/implementation_plan_03_fx.md` v5 (2026-09-25), which is now an index. Decision IDs carry over unchanged.
**Created:** 2026-09-25

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
| **L2 — Code cut-over** | Re-point the 5 entry points + `resolveTenantBaseCurrencyCode` to `tenant-currency-profile.service`. **Signatures unchanged.** `tenant-profile.service` writes the base row. Update the `MISSING_TENANT_CURRENCY` EN/AR message | Parity tests + full suite + build |
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

| # | Content | Skill |
|---|---|---|
| `0534` | `currencies:view`, `currencies:manage`, **`currencies:set_base`** (elevated), `fx_rates:view`, `fx_rates:manage`, `fx_rates:approve`, `fx_rates:import`, **`fx_rates:manual_override`** + role mapping | `/create-update-rbac-permission`, `/update-rbac-role` |
| `0535` | `sys_components_cd` nav + `navigation.ts` dual-write | `/navigation` |
| `0536` | Feature flag `multi_currency_fx` (+ plan mappings) + `FLAG_CATALOG` | `/create-feature-flag` |

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
| **L0** | Drift report; owner resolves | — | clean report | 0.5 d |
| **5A** | `0532` (`org_currency_cf` + policy + triggers + backfill), `0533` (rate book, providers, batches), `0534`–`0536`. **Stop → owner applies** | HQ `0531`, L0 | applied | 1.5 d |
| **L2** | Code cut-over (5 entry points) | 5A | full suite + build | 1.5 d |
| **5B** | FX services + HQ-copy adapter + golden tests | 5A | tsc/eslint/tests | 2 d |
| **5C** | Screen: Currencies, Rates, Manual, From HQ, Converter, Settings | 5B | build + eslint + check:i18n | 2.5 d |
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
