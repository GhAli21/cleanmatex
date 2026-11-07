# Tax Engine — Master Plan (v2 draft)

**Status:** APPROVED by owner ("all approved", 2026-11-07) — implementation authorised in program order: Service Speeds S1–S7 → Setup Health → Tax Engine T0–T9
**Supersedes on approval:** [TENANT_TAX_CONFIG_IMPLEMENTATION_PLAN.md](TENANT_TAX_CONFIG_IMPLEMENTATION_PLAN.md), [TAX_CALCULATION_AND_FINANCIAL_POSTING_SPEC.md](TAX_CALCULATION_AND_FINANCIAL_POSTING_SPEC.md), [CROSS_PROJECT_TAX_IMPLEMENTATION_COORDINATION_PLAN.md](CROSS_PROJECT_TAX_IMPLEMENTATION_COORDINATION_PLAN.md), HQ `cleanmatexsaas/docs/features/Tax_Setup/` (all "Proposed — planning only", nothing built). Carried parts are marked *(carried)*.
**Builds on:** `lib/commercial/` (ADR-060), [Setup Health](../Setup_Health/PLAN.md).

## 0. Program order

1. [Service Speeds](../Service_Speeds/PLAN.md) (S1–S7) — independent, smallest.
2. [Setup Health](../Setup_Health/PLAN.md) — framework needed by the tax banner and kit.
3. Tax Engine T0–T9 (this plan).

Each migration: written → STOP → owner applies (local + remote) → Prisma pull + types in both repos → continue.

## 1. Decisions (owner, 2026-11-07)

| # | Decision |
|---|---|
| D1 | A rules table decides which tax applies |
| D2 | All phases (sales, purchases, payouts, reporting) built to production grade |
| D3 | Every transaction carries a document type from one registry; tax rules are configured per document type |
| D4 | Each line keeps its full tax split |
| D5 | *(carried)* Server is the only money authority; final results immutable; corrections are new documents |
| D6 | *(carried)* No maker≠checker; permission + reasoned audit |
| D7 | Basic / Advanced modes; Basic default |
| D8 | Registration per branch; NULL = organization's |
| D9 | HQ owns country packs and prepares ready-to-use kits; supporting inexperienced laundries is a design goal |
| D10 | Kits: verified OM, SA, AE, BH; "no VAT" kits QA, KW; generic kit (no rate) for other countries |
| D11 | Kit is created as a pending candidate at tenant creation; the tenant-app banner says orders are not taxed until confirmed. **Apply tax kit** is an HQ screen opened from HQ › tenant › Setup Health. HQ support may apply **and** activate on the owner's behalf (reason recorded, e.g. "confirmed with owner by phone"), or leave it pending for the owner to confirm in the tenant app |
| D12 | **Starter packages = the existing settings profiles** (`sys_stng_profiles_mst`: country + segment, parent inheritance, version; tenant `stng_profile_code` / `stng_profile_version_applied` / `stng_profile_locked`). No parallel package table. A profile references the country tax kit and calendar template; segment differences are profile values and segment-flagged kit rules (§4.7) |
| D13 | When the tax invoice is issued stays in the existing `org_tax_doc_triggers_cfg` (per document type and event, e.g. `ON_ORDER_SUBMIT` → `INVOICE`); the starter package seeds it. No duplicate column on `org_tenants_mst` |

## 2. Current state (verified 2026-11-07)

- `org_tax_profiles_cf` (type, rate, compound, `applies_to`, default, dates, rounding); `sys_tax_types_cd` (VAT/GST/CUSTOM, hardcoded again in the profiles route); `sys_tax_category_cd` (S/Z/E/O), `sys_tax_exempt_reason_cd`, `org_tax_exemptions_cf`.
- Engine: `lib/commercial/tax.ts` (`selectTaxProfiles` by product `tax_supply_code`, else defaults); line keeps first profile only; order summary `org_order_taxes_dtl`; tax documents `org_tax_documents_mst` / `_items_dtl` / `_lines_dtl` (lines link `order_tax_line_id`).
- Purchases/payouts: `org_fin_exp_*`, `org_fin_po_*`, `org_fin_ap_inv_*`, `org_fin_ap_pmt_mst` with bare `tax_amount`, empty, behind ERP-Lite flags.
- Registry `sys_doc_seq_type_cd` (TRANSACTION / MASTER_DATA, `target_table`, `target_column`). Existing reference convention: `org_fin_journal_mst.source_doc_type_code / source_doc_id / source_doc_no`.
- Permissions exist: `tax:view_config`, `tax:manage_config`, `tax:view_reports`, `tax_document:*`, `settings:tax`.
- Pre-launch: demo data only.

## 3. Document identity standard (D3)

| Where | Columns | Rule |
|---|---|---|
| `sys_doc_seq_type_cd` | + `tax_flow_code` (`OUTPUT`/`INPUT`/`WITHHOLDING`/`NONE`), `is_tax_relevant` | single registry, no `sys_doc_type_cd` |
| Transaction headers (registry `category_code = TRANSACTION`, header tables) | + `doc_type_code TEXT NOT NULL` FK → registry. Single-type tables: DEFAULT + CHECK on their one value. Multi-type tables (`org_fin_vouchers_mst`, `org_tax_documents_mst`, `org_invoice_mst`): set by trigger from the existing subtype column, CHECK consistency | uniform type on every transaction |
| Tables that reference any document | `source_doc_type_code`, `source_doc_id`, `source_doc_no` (+ `source_doc_line_id`) — the journal's existing names | one convention |
| Not added | `doc_id`/`doc_no` copies on headers (`id` and `target_column` already are) | no drift |

Headers in scope (T1): orders, AR invoices, tax documents, store credit notes, refunds, vouchers, expenses, PO, AP invoices, AP payments, petty cash txn, cash drawer trx, stock transactions, POS sessions/Z reports, B2B statements, AR disputes/dunning/recon, ERP runs, delivery routes. HQ `sys_bill_invoices_mst` excluded (platform billing — own program).
Constants: `lib/constants/doc-types.ts` mirrors `doc_type_code` values used in code (DB-mirror rule).

## 4. Engine layers

| Layer | Objects |
|---|---|
| L1 Country packs *(carried)* | `sys_tax_jurisdictions_cd`, `sys_tax_policy_packs_mst`, `sys_tax_pack_versions_cf` (rounding, tax point, `tax_on_advance`, source/review), `sys_tax_pack_rules_dtl`; `sys_tax_types_cd` + `charge_kind` (TAX/LEVY); new types `MUNICIPALITY_TAX`, `TOURISM_TAX`, `TOURISM_LEVY`, `SERVICE_LEVY`, `WHT` |
| L1b Kits | `sys_tax_kits_mst` (per pack version), `sys_tax_kit_codes_dtl`, `sys_tax_kit_item_classes_dtl`, `sys_tax_kit_rules_dtl` (+ result codes), `sys_tax_kit_vectors_dtl` (sample + expected tax) |
| L2 Registration | `org_tax_config_cf` *(carried)*: mode (BASIC/ADVANCED), pack version, kit version, status (`PENDING_CONFIRMATION`/`ACTIVE`/`DISABLED`), `tax_enabled`, confirmed by/at. Branch: `tax_registration_no` (exists), `country` (exists), `tax_pack_version_id` NULL = organization's |
| L3 Tax codes | `org_tax_profiles_cf` evolved: `tax_code`, `version_no`, `charge_kind`, `amount_kind` (PERCENT/FIXED), `fixed_amount`, `calc_level` (LINE/DOCUMENT), `tax_category_code`, `exempt_reason_code`, `tax_flow_code`, `recoverable_pct`, `priority`, `compound_base`, `report_box_code`, `source` (HQ_KIT/TENANT), `kit_code_ref`. Invariants: VAT ⇒ LINE; used code immutable (trigger) — change = new version; `applies_to`/`is_default` retired in T3 |
| L4 Classes | `org_tax_item_classes_cf` (tenant, from kit) → `org_product_data_mst.tax_item_class_code` (replaces `tax_supply_code`), `org_fin_exp_cat_cf`, service categories. `sys_tax_party_class_cd` (CONSUMER, BUSINESS_REGISTERED, GOVERNMENT, FOREIGN, EXEMPT_ENTITY) → `org_customers_mst` (+ `tax_country`, reuse `tax_id`), `org_fin_supp_mst` (+ class, country, reuse `tax_reg_no`) |
| L5 Rules | `org_tax_rules_cf`: criteria (NULL = any) `doc_type_code`, `tax_flow_code`, `branch_id`, `place_of_supply_country`, `tax_item_class_code`, `party_tax_class_code`, `party_country_scope` (DOMESTIC/GCC/FOREIGN), `service_category_code`, dates, `priority`, `source`. Result: `org_tax_rule_codes_dtl` (ordered codes) or treatment override (EXEMPT/ZERO_RATED/OUT_OF_SCOPE + reason, REVERSE_CHARGE). Most specific wins → priority; ambiguity refused at save; no match with tax enabled → `NO_TAX_RULE` (never silent zero) |
| L6 Calculation | pure `lib/tax/` |
| L7 Record | `org_tax_lines_tr` |
| L8 Report / post | return boxes, GL posting, tax documents, periods |

### 4.1 Kit apply — one function for both repos

`fn_tax_kit_apply(p_tenant, p_kit_id, p_options jsonb, p_actor)` (SQL, SECURITY INVOKER, every `org_*` write sets/filters `tenant_org_id`): copies kit codes, classes, rules into the tenant with `source = HQ_KIT`; idempotent (re-apply updates only `source = HQ_KIT` rows not modified by the tenant, reports conflicts); creates/updates `org_tax_config_cf` as `PENDING_CONFIRMATION`; maps all products without class to the kit default class. Called by HQ onboarding and by the tenant **Apply tax kit** screen. `fn_tax_config_confirm(p_tenant, p_actor)` activates (`ACTIVE`, sets confirmed_by/at) after readiness passes. Audited.

### 4.2 Calculation — `lib/tax/` (pure, no I/O)

`determine(facts, rules)` → codes + explanation per line · `calculate(lines, codes, pricingMode, rounding, currency)` → `TaxLine[]` · `reverse(lines, portion)`.
Covers: exclusive/inclusive, stacked independent, compound (NET_PLUS_PRIOR with unique priority), fixed levy per line/document, document-level percent after order discount, line/document rounding per pack with labelled residual, zero/negative base, multi-currency base amounts. `lib/commercial/tax.ts` delegates to it. Facts are loaded by `lib/services/tax/tax-facts.loader.ts` (one request-scoped read of config, codes, rules, classes, registration).

### 4.3 Record — `org_tax_lines_tr`

`tenant_org_id`, `source_doc_type_code`, `source_doc_id`, `source_doc_no`, `source_doc_line_id`, `source_doc_sub_line_id` (piece), `line_status` (`PROVISIONAL`/`FINAL`), `tax_point_at`, `tax_date`, `tax_flow_code`, `branch_id`, `party_type`, `party_id`, `tax_code`, `tax_profile_id` (version), `tax_rule_id`, `tax_category_code`, `exempt_reason_code`, `calc_level`, `rate`, `fixed_amount`, `taxable_amount`, `tax_amount`, `recoverable_amount`, `currency_code`, `base_currency_code`, `base_taxable_amount`, `base_tax_amount`, `fx_rate…`, `compound_base`, `applied_seq`, `reverses_tax_line_id`, `report_box_code`, `period_id`, audit columns.
- `PROVISIONAL` while the source document can still change (order before its tax document): replaced in the same transaction under the order lock (Order Edit).
- `FINAL` at the tax point (tax document issued, or advance received where `tax_on_advance`): immutable (trigger blocks UPDATE/DELETE); corrections = reversal rows via credit/debit notes.
- Indexes: (tenant, source_doc_type_code, source_doc_id), (tenant, tax_date, tax_flow_code), (tenant, period_id). RLS.
- `org_order_taxes_dtl` = order summary rebuilt from these rows in the same transaction (readers unchanged); `org_order_items_dtl.tax_profile_id` retired after readers move.

### 4.7 Starter packages (D12)

| Layer | Holds | Example |
|---|---|---|
| `GENERAL_MAIN_PROFILE` → `GCC_MAIN_PROFILE` → `GCC_OM_MAIN` (exists) | country defaults | tax kit `OM_VAT_KIT`, calendar template `OM`, currency, tax doc triggers |
| `GCC_OM_SME` / `GCC_OM_ENTERPRISE` / `FRANCHISE_BASE` (exist, empty) | segment values | SME: Basic mode, prices include VAT, simplified tax invoice on order submit. ENTERPRISE: Advanced mode, B2B rules on, full tax invoice for business customers |
| New profile values (settings catalog `sys_stng_*`, HQ-managed) | `TAX_KIT_CODE`, `TAX_SETUP_MODE`, `TAX_PRICING_MODE_DEFAULT`, `TAX_DOC_TRIGGERS_DEFAULT` (jsonb), `CALENDAR_TEMPLATE_CODE`, `TAX_KIT_SEGMENT` | resolved through the profile chain (child overrides parent) |
| Kit rules | `segment_codes TEXT[]` (NULL = every segment) | B2B reverse-charge rule only for ENTERPRISE |

One kit per country (rates live once, so a rate change updates every segment); a package only selects and adjusts. A new segment or situation (e.g. "not VAT-registered" small shop — approved 2026-11-07) = a new child profile, no code change. `fn_tax_kit_apply` reads the tenant's resolved profile to choose kit, segment rules, mode, pricing mode and tax doc triggers. Changing a tenant's profile later re-runs apply as a pending candidate (never silently).

## 5. Special treatments

| Case | Rule |
|---|---|
| Credit note / refund | reverse original FINAL lines proportionally at original rate |
| Rate change | tax point in jurisdiction timezone *(carried)*; kit update creates a new code version at its effective date |
| Reverse charge | input + output pair, net zero, both on the return |
| Input VAT | `recoverable_pct`; non-recoverable part posted to cost |
| Withholding | WHT line on AP payment reduces cash paid; liability posted |
| Gift cards | `voucher_tax_mode` SPV (tax at sale) / MPV (tax at redemption) on gift card setup |
| Advance payments | pack `tax_on_advance`: receipt creates FINAL lines; invoice nets them |
| Delivery/service charges | taxable through rules; tips, cash rounding OUT_OF_SCOPE |
| Periods *(carried)* | `org_tax_periods_mst` OPEN/CLOSED; closed blocks back-dated FINAL lines; reopen with reason |

## 6. Database migrations (each STOP)

| # | Migration | Content |
|---|---|---|
| M1 | Doc identity | §3 columns, triggers, CHECKs, backfill, comments |
| M2 | Tax catalog & kits | L1, L1b, party classes, return boxes `sys_tax_return_box_cd`, GCC + generic seeds (rates from official sources, cited in comments), new types |
| M3 | Tenant config | `org_tax_config_cf`, profile evolution, item classes, rules + codes, periods, branch pack column, customer/supplier tax columns, `fn_tax_kit_apply`, `fn_tax_config_confirm`, immutability triggers, RLS, permissions, nav |
| M4 | Convert existing | demo profiles `applies_to`/`is_default` → rules; products `tax_supply_code` → classes; pending config for every tenant; then drop retired columns (separate M4b after readers moved) |
| M5 | Tax lines | `org_tax_lines_tr`, triggers, indexes, RLS |
| M6 | Purchases/payouts | tax columns on expense/AP/PO lines (`tax_item_class_code`, party on header), `voucher_tax_mode` on gift cards |
| M7 | Reporting/posting | return box mapping, GL usage codes for output/input/WHT/non-recoverable |
| M8 | Setup Health checks | TAX_* check functions + registry rows |

All `org_*`: `tenant_org_id`, RLS, tenant-first list indexes, composite FKs in parent key order, `DROP … RESTRICT`, TEXT not VARCHAR, money DECIMAL(19,4), `COMMENT ON` everything.

## 7. Backend & APIs (tenant app)

| Service | Responsibility |
|---|---|
| `lib/tax/*` | pure engine (§4.2) |
| `lib/services/tax/tax-facts.loader.ts` | request-scoped facts |
| `lib/services/tax/tax-lines.writer.ts` | write/replace PROVISIONAL, finalize, reverse; summary rebuild |
| `lib/services/tax/tax-config.service.ts` | config, Basic answers → kit options, confirm, mode switch (downgrade blocked while advanced-only rows active) |
| `lib/services/tax/tax-codes.service.ts` · `tax-rules.service.ts` · `tax-classes.service.ts` | CRUD with versioning, ambiguity check, audit |
| `lib/services/tax/tax-explain.service.ts` | explain preview for a draft/order/line |
| `lib/services/tax/tax-return.service.ts` | return per period, drill-down, export |
| `lib/services/tax/tax-period.service.ts` | open/close/reopen |
| Integrations | commercial checkout, payment quote, booking, Order Edit, split, invoices, credit notes, refunds, tax documents, expenses, AP invoice, AP payment, gift cards, finance posting |

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/tax/config` · POST `/config/confirm` · PUT `/config` (Basic answers / mode) | `tax:view_config` / `tax:manage_config` |
| GET | `/api/v1/tax/kits` (for tenant country) · POST `/kits/apply` | `tax:view_config` / `tax:manage_config` |
| CRUD | `/api/v1/tax/codes`, `/api/v1/tax/rules`, `/api/v1/tax/item-classes` | `tax:view_config` / `tax:manage_config` |
| POST | `/api/v1/tax/explain` | `tax:view_config` |
| GET | `/api/v1/tax/returns?period=` · GET `/returns/export` | `tax:view_reports` |
| CRUD | `/api/v1/tax/periods` (close/reopen) | new `tax:manage_periods` |
| existing | `/api/v1/settings/tax/profiles*` → retired (replaced by `/tax/codes`) | — |

New permission: `tax:manage_periods` (migration + `lib/constants/permissions/tax-perm.ts`). Feature flags: none new; purchase/payout tax rides existing `erp_lite_*` flags.

## 8. Frontend (tenant app)

| Screen | Route | Notes |
|---|---|---|
| **Review tax setup** | `/dashboard/settings/tax/setup` | owner-side confirm of a pending kit: summary in plain words ("Your customers pay 5% VAT on all services"), registration numbers, worked example, Confirm. Opened from the banner when the user has `tax:manage_config`; others see "contact support" |
| Tax settings (Basic) | `/dashboard/settings/tax` | registration per branch, pricing mode, enable/disable, kit version + "update available" review |
| Tax settings (Advanced) | tabs on same page | Codes (versions), Rules matrix (filters by document type), Item classes, Exemptions, Periods; explain preview drawer |
| Product / category / expense category forms | existing | tax item class select (default from kit) |
| Customer / supplier forms | existing | tax class, country, VAT number (format check per country) |
| Order Fin View | existing component | per-line tax split section + document-level taxes; public projection allowlist updated |
| VAT Return | `/dashboard/reports/tax-return` | period picker, boxes, drill-down to lines/documents, export; `tax:view_reports` |
| Banner | layout (Setup Health) | "Orders are not taxed: tax setup is not confirmed" → Apply tax kit |

All: Cmx components, `cmxMessage`, EN/AR + RTL, loading/empty/error, server pagination, no browser tax math, navigation dual-write, access contracts (scaffold → derive → wire → check → sync), `/rebuild-platform-info-inventories` after gating changes.

## 9. HQ (`cleanmatexsaas`)

| Area | Item |
|---|---|
| platform-api module `tax-setup` | packs, versions, kits (codes/classes/rules/vectors) CRUD; publish (runs kit vectors via tenant preview contract); kit diff |
| Tenant onboarding | resolves the tenant's settings profile (D12) and calls `fn_tax_kit_apply` (pending) |
| **Apply tax kit** (HQ tenant workspace, from Setup Health) | shows profile + kit + segment rules in plain words, per-branch registration numbers, worked example; actions: Apply (pending) · Apply and activate (reason required) |
| Settings profiles screen (exists) | new tax/calendar values per profile; preview "what a tenant on this profile gets" |
| Tenant support | `GET /tenants/:id/tax` (config, diff vs kit, readiness, explain order), actions: re-apply kit (pending candidate), reset row to kit — audited |
| Kit updates | publish new version with effective date → job creates new code versions for tenants on that kit (HQ_KIT rows only) + tenant notification; tenant-modified rows flagged `TAX_KIT_UPDATE_PENDING` |
| platform-web | Tax Packs & Kits screens, tenant › Tax tab, tenant › Setup Health tab |
| Permissions / nav | HQ perms `tax_packs:view/manage`, HQ nav rows — migrations in `cleanmatex` |
| Preview contract *(carried)* | private tenant endpoint `POST /internal/tax/preview` with service auth (existing Notification HQ service-auth pattern) |

## 10. Mobile

Customer app: shows server tax lines in the payment summary (no change to math); booking errors for `NO_TAX_RULE`.

## 11. Phases

| Phase | Content | Repo |
|---|---|---|
| T0 | ADR-061 Tax Engine, ADR-062 Document identity; plan approved; old plans marked superseded | both |
| T1 | M1 + `doc-types.ts` + writers set `doc_type_code` | tenant |
| T2 | M2 + HQ packs/kits screens & API | both |
| T3 | M3 + config/codes/rules/classes services, APIs, Basic/Advanced screens, Apply tax kit, explain | both |
| T4 | M5 + `lib/tax/` + sales integration (create, quote, booking, Edit, split, invoices, credit notes, refunds, tax documents) + Order Fin View; M4 conversion | tenant |
| T5 | M6 purchases/payouts integration | tenant |
| T6 | gift card modes, advance tax point | tenant |
| T7 | M7 return report, GL posting, periods | tenant |
| T8 | HQ onboarding apply, support console, kit update job, M8 health checks + banner | both |
| T9 | Docs pack, QA guide, glossary, inventories, mobile check | both |

## 12. Tests

Engine vectors *(carried list)* + stacked, compound, document-level, reverse charge, WHT, recoverable, SPV/MPV, advance, rounding residual, FX; rule matching (specificity, save-time ambiguity, no-rule error); kit apply idempotency and conflict reporting; immutability and period triggers; tenant isolation for every new `org_*` table; parity create = quote = Edit = booking (existing oracle); return totals = Σ tax lines; kit vectors pass for every published kit.

## 13. Documentation

Per feature folder: README, PLAN, STATUS, developer_guide, user_guide EN/AR (written for non-experts), QA_TEST_GUIDE, CHANGELOG, version. ADR-061/062. Glossary: tax code «رمز الضريبة», tax rule «قاعدة ضريبية», tax kit «الإعداد الضريبي الجاهز», item tax class «الفئة الضريبية للصنف», party tax class «الفئة الضريبية للطرف», reverse charge «الاحتساب العكسي», withholding tax «ضريبة الاستقطاع», tax return «الإقرار الضريبي». Integration contracts updated in both repos.

## 14. Risks

- Largest program so far (≈8 migrations, both repos): phases are independently shippable; sales stay on today's engine until T4 lands complete.
- Kit rates are legal facts: each verified kit cites its official source and review date; generic kits never claim verification *(carried)*.
- E-invoicing connectors (ZATCA, Oman, UAE) remain a separate program; data is ready after T4.
