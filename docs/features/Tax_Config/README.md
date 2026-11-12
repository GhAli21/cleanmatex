# Tax Engine

Which tax applies to each sale and purchase, how much, and how it is recorded, reported and posted. A tax rule picks the tax codes for each document type, item tax class and party. Countries start from a ready tax kit that HQ publishes.

**Version:** 1.0.1 (2026-11-12) · **Status:** engineering done (T0–T9), owner QA pending — see [STATUS.md](STATUS.md)

| Doc | For |
|---|---|
| [TAX_ENGINE_PLAN.md](TAX_ENGINE_PLAN.md) | Approved plan, decisions, phases T0–T9 |
| [STATUS.md](STATUS.md) | Progress per phase, checks, log (authoritative) |
| [ADR-061](ADR/ADR-061-Tax-Engine.md) · [ADR-062](ADR/ADR-062-Document-Identity.md) | Architecture decisions |
| [developer_guide.md](developer_guide.md) | How it works, tables, files, APIs, tests |
| [user_guide.md](user_guide.md) | Organization admins and HQ staff (EN / AR) |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Manual test scenarios T3–T8 |
| [followups_by_user.md](followups_by_user.md) | Owner actions: facts to verify, decisions |
| [KIT_FACTS.md](KIT_FACTS.md) | Country rates, thresholds and their sources |
| [CHANGELOG.md](CHANGELOG.md) · [version.txt](version.txt) | Changes per version |

Older plans in this folder (`TENANT_TAX_CONFIG_IMPLEMENTATION_PLAN.md`, `TAX_CALCULATION_AND_FINANCIAL_POSTING_SPEC.md`, `CROSS_PROJECT_TAX_IMPLEMENTATION_COORDINATION_PLAN.md`) are superseded; kept for history.

## At a glance

| Area | What |
|---|---|
| Document identity | Every transaction header carries `doc_type_code` from `sys_doc_seq_type_cd` (`tax_flow_code`, `is_tax_relevant`) — ADR-062 |
| Kits (HQ) | `sys_tax_kits_mst` → versions `sys_tax_kit_versions_mst` (DRAFT / PUBLISHED / RETIRED) with codes, item classes, rules, worked examples. Published versions are locked. Kits: OM, SA, AE, BH VAT, NO_VAT, GENERIC_VAT |
| Starter packages (HQ) | `sys_starter_pkg_mst` per country and segment: kit, calendar, Basic/Advanced, price mode, invoice triggers. New organizations get the country default as "waiting for confirmation" |
| Organization setup | `org_tax_config_cf` (status PENDING / ACTIVE, Basic / Advanced mode), codes `org_tax_profiles_cf` (versioned), `org_tax_item_classes_cf`, `org_tax_rules_cf` + `org_tax_rule_codes_dtl`, registration numbers per branch |
| Tax record | `org_tax_lines_tr`: one row per line and code; PROVISIONAL at order, FINAL at invoice; corrections are reversal rows. Periods `org_tax_periods_mst`; a closed period refuses new FINAL rows |
| Sales | `lib/tax/order-line-tax.ts` — quote, create, booking and Edit share it. No tax until the setup is confirmed (ACTIVE) |
| Purchases | Expenses, purchase orders, supplier invoices taxed from INPUT rules; recoverable share; withholding on supplier payments |
| Advances, gift cards | Advances taxed when received (kit `tax_on_advance`); gift cards single-purpose (tax at sale) or multi-purpose (tax at use) |
| Reports | VAT return (Reports › **VAT return**) from FINAL lines, per kit box layout, drill-down, CSV |
| Posting | ERP-Lite events for tax reclass of advances and gift cards; expense posting splits recoverable VAT to `VAT_INPUT` |
| Health | 7 TAX checks in Setup Health; `TAX_SETUP_NOT_CONFIRMED` shows the banner |
| Screens | Tenant: Settings › **Tax Setup** `/dashboard/settings/tax` (+ `/setup` review), Reports › **VAT return** `/dashboard/reports/tax-return` · HQ: Master System Codes › **Tax Kits** `/system-codes/tax-kits`, **Starter packages** `/system-codes/starter-packages`, organization workspace › **Tax kit** `/tenants/<id>/tax-kit` |
| Permissions | Tenant `tax:view_config`, `tax:manage_config`, `tax:view_reports`, `tax:manage_periods` · HQ `tax_packs.view`, `tax_packs.manage` |
| Settings / flags | None. No `sys_stng_*`: typed tables only. No feature flag, no plan limit |
| Jobs | pg_cron `tax-kit-update` 02:05 daily (`fn_tax_kit_update_all`), `setup-health-refresh` 02:15 |
| Migrations | 0708, 0712, 0713, 0718, 0719, 0722, 0723, 0725, 0726, 0727 (drops the old engine's columns) |
