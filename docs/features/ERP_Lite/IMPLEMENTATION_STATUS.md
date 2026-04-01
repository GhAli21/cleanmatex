---
document_id: ERP_LITE_IMPLEMENTATION_STATUS_001
title: ERP-Lite Implementation Status Tracker
version: "1.0"
status: Active
last_updated: 2026-04-01
author: CleanMateX AI Assistant
note: This document is updated continuously during implementation. It is not a planning document — use ROADMAP_TASK_BY_TASK.md for the implementation plan.
---

# ERP-Lite Implementation Status Tracker

## 1. Purpose

This document tracks the live implementation status of ERP-Lite across all phases. It is updated as migrations are applied, features are built, and blockers are resolved.

**This is not a planning document.** For the implementation plan, see [ROADMAP_TASK_BY_TASK.md](ROADMAP_TASK_BY_TASK.md) and [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](IMPLEMENTATION_GAP_CLOSURE_PLAN.md).

---

## 2. Phase Status

| Phase | Name | Status | Notes | Last Updated |
|---|---|---|---|---|
| Phase 0 | Decision Freeze | Complete | Canonical PRD/ADR/runtime-rule/approval pack completed and formally approved. | 2026-03-28 |
| Phase 1 | Platform Enablement | Complete | Phase 1 migrations were applied, ERP-Lite shell routes were created, route guards were wired, flags/settings/constants were aligned, and EN/AR shell messages were added. Node-based validation remains environment-blocked on local WSL 1. | 2026-03-28 |
| Phase 2 | HQ Governance Foundation | Complete | Phase 2A DB foundation is complete through migrations `0179` to `0182`. Phase 2B in `cleanmatexsaas` now includes dashboard, package detail, draft package creation/editing, draft rule editing, draft auto-post policy editing, validation, approve, and publish flows. Local sibling build validation remains limited because the `cleanmatexsaas` environment is missing `nest` and `next` binaries. | 2026-04-01 |
| Phase 3 | Tenant Finance Schema | Complete | Migrations `0183` to `0186` were reviewed and applied in `cleanmatex`. | 2026-03-29 |
| Phase 4 | Posting Engine | Complete | Governed posting engine, replay paths, validation flow, and targeted test coverage are implemented in `cleanmatex`. | 2026-03-30 |
| Phase 5 | Core Auto-Post Integration | Complete | Invoice creation, invoice-on-demand payment creation, direct payment, distributed multi-invoice payment, and refund completion now all use the governed auto-post path with transaction-aware blocking behavior. | 2026-03-30 |
| Phase 6 | V1 Finance Inquiry and Reports | Complete | GL inquiry, trial balance, profit and loss, balance sheet, and AR aging are implemented in `cleanmatex`, with targeted reporting tests passing. | 2026-03-31 |
| Phase 7 | Basic Expenses and Petty Cash | Complete | Phase 7 schema is applied, the tenant expenses route now has basic expense, cashbox, and petty-cash transaction runtime implementation in `cleanmatex`, and targeted service/action tests are passing. | 2026-03-31 |
| Phase 8 | V1 Pilot and Hardening | Complete | ERP-Lite regression, i18n parity, and tenant `web-admin` production build now pass. The ESLint circular-config failure was removed and the earlier build-hang classification is no longer active for the tenant project. | 2026-04-01 |
| Phase 9 | V2 Treasury + Suppliers + AP/PO | In Progress | Migrations `0189` to `0192` are applied. Tenant runtime now includes supplier, PO, AP invoice, AP payment, AP aging, bank account, bank statement batch/manual line/bulk line import, reversible bank matching, and bank reconciliation close/lock flows in `cleanmatex`. Phase 9 remains open for richer external import ingestion and required governance publication extensions. | 2026-04-01 |
| Phase 10 | V3 Advanced Controls + Profitability + Costing | In Progress | The v3 ADR/scope pack exists and the first safe runtime slice is implemented: direct-posted Branch P&L in `cleanmatex` from posted journal truth only. Allocation-aware profitability, advanced controls, and costing still require additional approved schema/runtime work. | 2026-04-01 |

### Phase Status Key

| Status | Meaning |
|---|---|
| `Not Started` | No implementation work has begun |
| `In Progress` | Actively being implemented |
| `Blocked` | Cannot proceed — blocker listed in §3 |
| `In Review` | Implementation complete, pending QA/review |
| `Complete` | Fully implemented, reviewed, and deployed |

---

## 3. Active Blockers

No active tenant-project ERP-Lite blockers are currently recorded.

---

## 4. Migration Tracking

| Migration File | Description | Status | Applied Date | Notes |
|---|---|---|---|---|
| `0175_erp_lite_phase1_feature_flags.sql` | Phase 1 ERP-Lite feature flags and plan mappings | Applied | 2026-03-28 | Phase 1 platform enablement |
| `0176_erp_lite_phase1_permissions.sql` | Phase 1 ERP-Lite permissions and role defaults | Applied | 2026-03-28 | Phase 1 platform enablement |
| `0177_erp_lite_phase1_navigation.sql` | Phase 1 ERP-Lite navigation seed entries | Applied | 2026-03-28 | Phase 1 platform enablement |
| `0178_erp_lite_phase1_settings.sql` | Phase 1 ERP-Lite settings category and allowed setting keys | Applied | 2026-03-28 | Phase 1 platform enablement |
| `0179_erp_lite_phase2_account_governance.sql` | Phase 2 HQ account type and group governance schema | Applied | 2026-03-29 | Applied with hierarchy/reporting-ready group foundations |
| `0180_erp_lite_phase2_event_usage.sql` | Phase 2 event catalog and usage code schema | Applied | 2026-03-29 | Applied with multi-type usage support for future-safe account resolution |
| `0181_erp_lite_phase2_gov_rules.sql` | Phase 2 governance package and mapping rule schema | Applied | 2026-03-29 | Applied with governed resolver catalog and deterministic rule constraints |
| `0182_erp_lite_phase2_auto_post_policy.sql` | Phase 2 HQ auto-post policy schema and v1 draft defaults | Applied | 2026-03-29 | Applied with policy version/status fields for future-safe governance |
| `0183_erp_lite_phase3_accounts.sql` | Phase 3 tenant COA schema | Applied | 2026-03-29 | Applied in cleanmatex after review |
| `0184_erp_lite_phase3_maps_periods.sql` | Phase 3 tenant usage mappings and periods | Applied | 2026-03-29 | Applied in cleanmatex after review |
| `0185_erp_lite_phase3_journals.sql` | Phase 3 tenant journal master/detail schema | Applied | 2026-03-29 | Applied in cleanmatex after review |
| `0186_erp_lite_phase3_posting_runtime.sql` | Phase 3 posting log and exception runtime schema | Applied | 2026-03-29 | Applied in cleanmatex after review |
| `0187_erp_lite_phase7_expenses.sql` | Phase 7 basic expense source-document schema | Applied | 2026-03-31 | Applied after correcting usage-code catalog references |
| `0188_erp_lite_phase7_petty_cash.sql` | Phase 7 petty cash cashbox and transaction schema | Applied | 2026-03-31 | Applied after correcting usage-code catalog references |
| `0189_erp_lite_phase9_bank_core.sql` | Phase 9 bank account and statement foundation | Applied | 2026-04-01 | Applied in cleanmatex after review |
| `0190_erp_lite_phase9_supplier_master.sql` | Phase 9 supplier master foundation | Applied | 2026-04-01 | Applied in cleanmatex after review |
| `0191_erp_lite_phase9_po_ap_docs.sql` | Phase 9 PO and AP invoice document foundation | Applied | 2026-04-01 | Applied in cleanmatex after review |
| `0192_erp_lite_phase9_ap_pmt_bank_recon.sql` | Phase 9 AP payment and bank reconciliation foundation | Applied | 2026-04-01 | Applied in cleanmatex after review |

---

## 5. PR / Branch Tracking

| Branch | Description | Status | Opened | Merged | Notes |
|---|---|---|---|---|---|
| _(tracking not recorded in this doc)_ | Phase 0 and Phase 1 were completed in the current implementation stream | Active | 2026-03-28 | — | Use git history/PR system as the source of truth for branch-level detail |

---

## 5.1 Completed Scope Snapshot

### Phase 0 Completed

- canonical ERP-Lite PRD/ADR pack approved
- finance core rules approved
- runtime domain contract approved
- governance publication contract approved
- approval checklist finalized and recorded

### Phase 1 Completed

- ERP-Lite feature flags seeded and applied
- ERP-Lite permissions seeded and applied
- ERP-Lite navigation seed entries applied
- ERP-Lite settings seed entries applied
- tenant runtime shell routes added under `/dashboard/erp-lite/*`
- route contracts and page registry entries added
- runtime page/layout feature and permission guards added
- feature flag constants/types aligned to applied flags
- EN/AR shell and access-state messages added
- permission documentation updated

### Phase 2 Completed

- HQ-governed account types and account groups applied
- HQ-governed event catalog and usage code catalog applied
- usage-code-to-allowed-account-type structure applied
- HQ-governed resolver catalog applied
- governance package master and mapping rule master/detail tables applied
- deterministic rule-priority constraints applied
- HQ auto-post policy structure with version/status support applied
- Phase 2 foundation is now future-safe for v1/v2/v3 governance growth while keeping only v1 data seeded

### Phase 2B Current Progress

- `cleanmatexsaas` read-only ERP-Lite governance backend module is implemented for dashboard/catalog/package visibility
- `cleanmatexsaas` read-only ERP-Lite governance route is implemented in platform web navigation
- HQ package detail drill-down is implemented for mapping rules and auto-post policy visibility
- HQ draft package creation is implemented
- HQ draft package metadata editing is implemented
- HQ draft mapping rule editing is implemented
- HQ draft auto-post policy editing is implemented
- HQ package validation is implemented
- HQ package approval is implemented
- HQ package publication is implemented
- local sibling build validation remains blocked because `cleanmatexsaas` is missing `nest` and `next` binaries in this environment

### Phase 3 Completed

- tenant chart of accounts schema applied
- tenant usage-code mapping schema applied
- tenant accounting period schema applied
- tenant journal master/detail schema applied
- tenant posting log and exception queue schema applied
- RLS and tenant isolation policies applied for all new `org_*` tables

### Phase 4 Current Progress

- governed posting-engine constants/types added
- governed posting-engine runtime service implemented
- request normalization, governance resolution, amount/account resolution, journal persistence, posting logs, exception creation, retry, and repost are implemented
- targeted unit tests pass for preview, duplicate blocking, and retry replay

### Phase 5 Completed

- governed auto-post adapter service added
- invoice, payment, and refund posting-request builders added
- HQ policy lookup helper added for published active policy consumption
- event-code mapping added for order settlement vs standalone payment flows
- invoice creation now uses transaction-aware blocking finance posting
- on-demand invoice creation during payment now uses transaction-aware blocking finance posting
- direct single-invoice payment completion now uses transaction-aware blocking finance posting
- distributed multi-invoice payment completion now uses transaction-aware blocking finance posting inside one business transaction
- refund completion now uses transaction-aware blocking finance posting
- targeted unit tests pass for invoice, payment, refund, auto-post adapter, and posting engine flows

### Phase 6 Current Progress

- GL inquiry route now renders posted journal lines only
- financial reports route now renders trial balance from posted journals only
- profit and loss first slice now renders from posted journals plus governed account types only
- balance sheet first slice now renders from posted journals plus governed account types only
- AR aging route now renders open invoice balances limited to successfully posted ERP-Lite invoices
- report pages are now bilingual in EN/AR
- targeted reporting tests now pass for trial balance, profit and loss, and AR aging

### Phase 7 Completed

- Phase 7 checklist is created and active
- Phase 7 execution package is created
- expense source-document schema is applied in `0187`
- petty cash cashbox and transaction schema is applied in `0188`
- tenant-scoped expense service is implemented
- tenant-scoped petty cash cashbox and transaction service is implemented
- Phase 7 sequential numbering is now tenant-scoped instead of global across all organizations
- ERP-Lite auto-post adapter now supports `EXPENSE_RECORDED`, `PETTY_CASH_TOPUP`, and `PETTY_CASH_SPENT`
- `/dashboard/erp-lite/expenses` now renders real Phase 7 forms and list views instead of the shell page
- targeted auto-post regression tests pass for the new Phase 7 posting request builders
- targeted service tests pass for expense creation and petty-cash transaction creation
- targeted action tests pass for expense, cashbox, and petty-cash redirects

### Phase 8 Current Progress

- Phase 8 checklist is created and active
- Phase 8 execution package is created
- canonical ERP-Lite regression command is added in `web-admin/package.json`
- canonical ERP-Lite regression command passes with 7 suites and 22 tests
- `check:i18n` passes
- the date-fragile Phase 7 expense-numbering tests were fixed by pinning test system time
- the ESLint circular-config failure was fixed by switching `web-admin/eslint.config.mjs` to the native Next flat config import
- remaining unresolved validation behavior is classified as local toolchain/environment hang without an identified ERP-Lite code defect

### Phase 9 Current Progress

- Phase 9 checklist is created and active
- Phase 9 execution package is created
- the first Phase 9 tenant-runtime schema package is applied in four migrations
- the applied scope covers bank-account and statement foundations, supplier master, PO/AP document foundations, AP payment allocation, and bank reconciliation foundations
- tenant runtime service foundations are implemented for supplier, PO, AP invoice, AP payment, bank account, bank statement, and bank reconciliation creation and latest-list inquiry
- `/dashboard/erp-lite/ap`, `/dashboard/erp-lite/po`, and `/dashboard/erp-lite/bank-recon` now render real Phase 9 forms and list views instead of shell placeholders
- targeted Phase 9 service tests pass for tenant-scoped supplier numbering, AP aging, AP payment allocation behavior, bank matching, and reconciliation-close guard rails
- AP aging now renders in the AP workspace from open AP invoice balances
- bank statement lines can now be created manually for matching review
- bank statement lines can now be matched to AP payments with reconciliation unmatched-balance updates
- open bank reconciliations can now be closed when unmatched amount is zero
- bank statement lines now support bulk pipe-delimited import in addition to manual entry
- confirmed bank matches can now be reversed with reconciliation balance restoration
- closed bank reconciliations can now be locked
- Phase 9 is still open for richer external statement-import ingestion and related Phase 9 governance publication extensions

### Phase 10 Current Progress

- direct-posted Branch P&L route is now implemented in `cleanmatex`
- branch profitability currently uses posted ERP-Lite revenue and expense journals only
- no allocation logic is applied in the current branch profitability output
- advanced expense workflow depth remains pending
- advanced petty-cash control and reconciliation depth remains pending
- laundry-specific costing remains pending

---

## 6. Related Documents

- [ROADMAP_TASK_BY_TASK.md](ROADMAP_TASK_BY_TASK.md) — Detailed task-by-task implementation plan
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](IMPLEMENTATION_GAP_CLOSURE_PLAN.md) — Gap closure plan with canonical dependencies
- [APPROVAL_CHECKLIST_FOR_PHASE_0.md](APPROVAL_CHECKLIST_FOR_PHASE_0.md) — Phase 0 approval gate checklist
- [V1_0_APPROVAL_PACK.md](V1_0_APPROVAL_PACK.md) — Canonical approval pack for v1.0
- [CLEANMATEX_RUNTIME_IMPLEMENTATION_PLAN.md](CLEANMATEX_RUNTIME_IMPLEMENTATION_PLAN.md) — Runtime implementation plan (cleanmatex)
- [CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md](CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md) — Governance implementation plan (cleanmatexsaas)
