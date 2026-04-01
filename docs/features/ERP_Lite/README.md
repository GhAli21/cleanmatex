---
version: v1.1.0
last_updated: 2026-04-01
author: CleanMateX Team
---

# ERP-Lite Feature

## Overview

ERP-Lite is an add-on finance and accounting module for CleanMateX tenants who do not have an external ERP. It provides Chart of Accounts, General Ledger, financial reports, AR aging, bank reconciliation, and optional AP/PO/expense management—all within the platform.

## Strategic Context

- **Original plan**: Integrate with external ERPs (QuickBooks, Xero, SAP) via CSV/API export
- **Current plan**: ERP-Lite for customers without ERP; CSV/API export for those with ERP
- **Coexistence**: Same tenant can use ERP-Lite for daily ops and export for external accountant

## Scope

| Module | Description | Feature Flag |
|--------|-------------|--------------|
| **Chart of Accounts (COA)** | Account hierarchy, types (Asset, Liability, Equity, Revenue, Expense) | `erp_lite_gl_enabled` |
| **General Ledger (GL)** | Double-entry postings from invoices, payments, refunds | `erp_lite_gl_enabled` |
| **Financial Reports** | P&L, Balance Sheet, Cash Flow | `erp_lite_reports_enabled` |
| **AR Aging** | Customer outstanding balances by aging bucket | `erp_lite_ar_enabled` |
| **Bank Reconciliation** | Match bank transactions to payments | `erp_lite_bank_recon_enabled` |
| **Accounts Payable (AP)** | Supplier invoices, payments | `erp_lite_ap_enabled` |
| **Purchase Orders (PO)** | POs for consumables/supplies | `erp_lite_po_enabled` |
| **Expense Management** | Staff expense claims, approvals | `erp_lite_expenses_enabled` |
| **Branch P&L** | Profitability by branch | `erp_lite_branch_pl_enabled` |

## Main Feature Flag

- **`erp_lite_enabled`** — Master switch. When `false`, the entire ERP-Lite module is hidden. All sub-module flags require this to be `true`.

## Navigation

- Dashboard → Finance & Accounting (gated by `erp_lite_enabled`)
  - Chart of Accounts
  - General Ledger
  - Financial Reports (P&L, Balance Sheet, Cash Flow)
  - AR Aging
  - Bank Reconciliation
  - AP (optional)
  - Purchase Orders (optional)
  - Expenses (optional)
  - Branch P&L (optional)

## Cross-References

- [Master Plan](../../plan/master_plan_cc_01.md) — Phase 5+ ERP-Lite
- [Unified Requirements](../../Requirments_Specifications/clean_mate_x_unified_requirements_pack_v_0.12.md) — FR-INV-001, UC17
- [B2B Feature](../B2B_Feature/) — AR integration with B2B statements
- [Finance/Invoices](../../dev/finance_invoices_payments_dev_guide.md) — invoice/payment integration

## Document Index

### 1. Approval Pack

| Document | Status | Description |
|---|---|---|
| [V1_0_APPROVAL_PACK.md](V1_0_APPROVAL_PACK.md) | ✅ Approved | Canonical approval index — v1.0 outcome and conditions |
| [APPROVAL_CHECKLIST_FOR_PHASE_0.md](APPROVAL_CHECKLIST_FOR_PHASE_0.md) | ✅ Approved | Phase 0 gate checklist — approval recorded |
| [PHASE_1_PLATFORM_ENABLEMENT_CHECKLIST.md](PHASE_1_PLATFORM_ENABLEMENT_CHECKLIST.md) | ✅ Approved | Exact Phase 1 platform enablement checklist for flags, permissions, settings, nav, shells, and migration ownership |
| [PHASE_1_EXECUTION_PACKAGE.md](PHASE_1_EXECUTION_PACKAGE.md) | ✅ Approved | Implementation-ready Phase 1 package with exact route, seed, setting, and migration plan |
| [PHASE_2_HQ_GOVERNANCE_CHECKLIST.md](PHASE_2_HQ_GOVERNANCE_CHECKLIST.md) | ✅ Complete | Exact Phase 2 HQ governance checklist for shared governance schema and package modeling |
| [PHASE_2_HQ_GOVERNANCE_EXECUTION_PACKAGE.md](PHASE_2_HQ_GOVERNANCE_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 2 package for governance catalogs, package model, rules, and auto-post policy |
| [PHASE_2B_HQ_GOVERNANCE_APP_CHECKLIST.md](PHASE_2B_HQ_GOVERNANCE_APP_CHECKLIST.md) | Complete | Exact Phase 2B checklist for HQ governance backend/frontend in `cleanmatexsaas`; dashboard, detail, authoring, editing, validate, approve, and publish flows are implemented |
| [PHASE_2B_HQ_GOVERNANCE_APP_EXECUTION_PACKAGE.md](PHASE_2B_HQ_GOVERNANCE_APP_EXECUTION_PACKAGE.md) | Complete | Implementation-ready Phase 2B package for HQ governance app work in `cleanmatexsaas`; authoring/editing is implemented and local sibling build validation is limited only by missing `nest` and `next` binaries |
| [PHASE_3_TENANT_FINANCE_SCHEMA_CHECKLIST.md](PHASE_3_TENANT_FINANCE_SCHEMA_CHECKLIST.md) | ✅ Complete | Exact Phase 3 checklist for tenant finance schema work in `cleanmatex` |
| [PHASE_3_TENANT_FINANCE_SCHEMA_EXECUTION_PACKAGE.md](PHASE_3_TENANT_FINANCE_SCHEMA_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 3 package for tenant finance schema work in `cleanmatex` |
| [PHASE_4_POSTING_ENGINE_CHECKLIST.md](PHASE_4_POSTING_ENGINE_CHECKLIST.md) | ✅ Complete | Exact Phase 4 checklist for posting-engine work in `cleanmatex` |
| [PHASE_4_POSTING_ENGINE_EXECUTION_PACKAGE.md](PHASE_4_POSTING_ENGINE_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 4 package for posting-engine work in `cleanmatex` |
| [PHASE_5_CORE_AUTO_POST_CHECKLIST.md](PHASE_5_CORE_AUTO_POST_CHECKLIST.md) | ✅ Complete | Exact Phase 5 checklist for invoice, payment, and refund auto-post integration in `cleanmatex` |
| [PHASE_5_CORE_AUTO_POST_EXECUTION_PACKAGE.md](PHASE_5_CORE_AUTO_POST_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 5 package for governed auto-post integration in `cleanmatex` |
| [PHASE_6_FINANCE_INQUIRY_REPORTS_CHECKLIST.md](PHASE_6_FINANCE_INQUIRY_REPORTS_CHECKLIST.md) | ✅ Complete | Exact Phase 6 checklist for finance inquiry and journal-driven reporting in `cleanmatex` |
| [PHASE_6_FINANCE_INQUIRY_REPORTS_EXECUTION_PACKAGE.md](PHASE_6_FINANCE_INQUIRY_REPORTS_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 6 package for GL inquiry, trial balance, P&L, balance sheet, and AR aging in `cleanmatex` |
| [PHASE_7_BASIC_EXPENSES_AND_PETTY_CASH_CHECKLIST.md](PHASE_7_BASIC_EXPENSES_AND_PETTY_CASH_CHECKLIST.md) | ✅ Complete | Exact Phase 7 checklist for basic expenses and petty cash in `cleanmatex` |
| [PHASE_7_BASIC_EXPENSES_AND_PETTY_CASH_EXECUTION_PACKAGE.md](PHASE_7_BASIC_EXPENSES_AND_PETTY_CASH_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 7 package for expense source documents and petty cash runtime foundations in `cleanmatex` |
| [PHASE_8_V1_PILOT_AND_HARDENING_CHECKLIST.md](PHASE_8_V1_PILOT_AND_HARDENING_CHECKLIST.md) | ✅ Complete | Exact Phase 8 checklist for v1 pilot and hardening in `cleanmatex` |
| [PHASE_8_V1_PILOT_AND_HARDENING_EXECUTION_PACKAGE.md](PHASE_8_V1_PILOT_AND_HARDENING_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 8 package for ERP-Lite regression and final hardening in `cleanmatex` |
| [PHASE_9_V2_TREASURY_AP_PO_CHECKLIST.md](PHASE_9_V2_TREASURY_AP_PO_CHECKLIST.md) | ✅ Complete | Exact Phase 9 checklist for treasury, suppliers, AP, and PO across `cleanmatexsaas` governance extension and `cleanmatex` runtime |
| [PHASE_9_V2_TREASURY_AP_PO_EXECUTION_PACKAGE.md](PHASE_9_V2_TREASURY_AP_PO_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 9 package with the applied v2 schema/runtime split and validation rules |
| [PHASE_10_V3_ADVANCED_CONTROLS_COSTING_CHECKLIST.md](PHASE_10_V3_ADVANCED_CONTROLS_COSTING_CHECKLIST.md) | ✅ Complete | Exact Phase 10 checklist for advanced controls, profitability, and costing |
| [PHASE_10_V3_ADVANCED_CONTROLS_COSTING_EXECUTION_PACKAGE.md](PHASE_10_V3_ADVANCED_CONTROLS_COSTING_EXECUTION_PACKAGE.md) | ✅ Complete | Implementation-ready Phase 10 structure with applied schema, allocation-aware profitability, and audited costing runtime |
| [V2_SCOPE_AND_DECISION_PACK.md](V2_SCOPE_AND_DECISION_PACK.md) | Draft | Frozen v2 business and implementation boundaries for treasury, suppliers, AP, and PO |
| [V3_SCOPE_AND_DECISION_PACK.md](V3_SCOPE_AND_DECISION_PACK.md) | Draft | Frozen v3 business and implementation boundaries for advanced controls, profitability, and costing |
| [ADR_005_SUPPLIER_AP_GOVERNANCE_MODEL.md](ADR_005_SUPPLIER_AP_GOVERNANCE_MODEL.md) | Draft | Supplier and AP governance model for v2 |
| [ADR_006_BANK_RECONCILIATION_MODEL.md](ADR_006_BANK_RECONCILIATION_MODEL.md) | Draft | Bank statement import, matching, and reconciliation model for v2 |
| [ADR_007_PO_TO_AP_POSTING_BOUNDARIES.md](ADR_007_PO_TO_AP_POSTING_BOUNDARIES.md) | Draft | Posting boundaries between purchase orders, AP invoices, and AP payments |
| [ADR_008_ADVANCED_EXPENSES_AND_PETTY_CASH_CONTROLS.md](ADR_008_ADVANCED_EXPENSES_AND_PETTY_CASH_CONTROLS.md) | Draft | Advanced expense and petty-cash control model for v3 |
| [ADR_009_BRANCH_PROFITABILITY_SOURCE_OF_TRUTH.md](ADR_009_BRANCH_PROFITABILITY_SOURCE_OF_TRUTH.md) | Draft | Branch profitability truth model for v3 |
| [ADR_010_LAUNDRY_SPECIFIC_COSTING_MODEL.md](ADR_010_LAUNDRY_SPECIFIC_COSTING_MODEL.md) | Draft | Laundry-specific costing model for v3 |

### 2. Product & Scope

| Document | Status | Description |
|---|---|---|
| [CROSS_PROJECT_PRD.md](CROSS_PROJECT_PRD.md) | ✅ Approved | Full cross-project PRD with appendices |
| [ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md](ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md) | Draft | Scope validation and decision report |
| [GAP_ANALYSIS_REPORT.md](GAP_ANALYSIS_REPORT.md) | Draft | Gap analysis against original requirements |
| [V2_V3_READINESS_ASSESSMENT.md](V2_V3_READINESS_ASSESSMENT.md) | ✅ Approved | Readiness assessment for v2/v3 phases |
| [xxPRD-ERP-Lite.md](xxPRD-ERP-Lite.md) | Draft | Original PRD draft (superseded by CROSS_PROJECT_PRD) |

### 3. Architecture Decisions (ADRs)

| Document | Status | Description |
|---|---|---|
| [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md) | ✅ Approved | HQ-governed account type model |
| [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md) | ✅ Approved | Config-driven mapping engine governance |
| [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md) | ✅ Approved | Auto-post exception and repost model |
| [ADR_004_VAT_TAX_V1_SCOPE.md](ADR_004_VAT_TAX_V1_SCOPE.md) | ✅ Approved | VAT/tax v1 scope decisions |

### 4. Control & Runtime Contracts

| Document | Status | Description |
|---|---|---|
| [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md) | ✅ Approved | Canonical finance control rules (supersedes _01, _02) |
| [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md) | ✅ Approved | Runtime entity and behavior contracts |
| [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md) | ✅ Approved | HQ governance package publishing model |

### 5. Operational Catalogs

| Document | Status | Description |
|---|---|---|
| [ACCOUNT_USAGE_CODE_CATALOG.md](ACCOUNT_USAGE_CODE_CATALOG.md) | ✅ Approved | All usage codes v1/v2/v3 — required before Phase 3 |
| [V1_POSTING_RULES_CATALOG.md](V1_POSTING_RULES_CATALOG.md) | ✅ Approved | DR/CR rules per event v1/v2/v3 — required before Phase 4 |
| [BLOCKING_POLICY_TABLE.md](BLOCKING_POLICY_TABLE.md) | ✅ Approved | Auto-post blocking policy v1/v2/v3 — required before Phase 5 |
| [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md) | ✅ Approved | HQ vs Tenant responsibility split for accounting |
| [GL_POSTING_EXECUTION_VS_AUTO_POST.md](GL_POSTING_EXECUTION_VS_AUTO_POST.md) | Draft | Conceptual separation: GL engine vs auto-post policy |

### 6. Implementation Plans & Tracking

| Document | Status | Description |
|---|---|---|
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Active | Live implementation status tracker — updated continuously |
| [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](IMPLEMENTATION_GAP_CLOSURE_PLAN.md) | Draft | Gap closure plan with canonical dependencies |
| [CLEANMATEX_RUNTIME_IMPLEMENTATION_PLAN.md](CLEANMATEX_RUNTIME_IMPLEMENTATION_PLAN.md) | Draft | Runtime implementation plan (cleanmatex) |
| [CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md](CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md) | Draft | Governance implementation plan (cleanmatexsaas) |
| [ROADMAP_TASK_BY_TASK.md](ROADMAP_TASK_BY_TASK.md) | Draft | Detailed task-by-task implementation roadmap |
| [ROLLOUT_PLAN.md](ROLLOUT_PLAN.md) | Draft | Rollout and deployment plan |

### 7. Platform Specs

| Document | Status | Description |
|---|---|---|
| [FEATURE_FLAGS.md](FEATURE_FLAGS.md) | Draft | Feature flags for ERP-Lite modules |
| [PERMISSIONS.md](PERMISSIONS.md) | Draft | Permission codes and RBAC definitions |
| [SETTINGS.md](SETTINGS.md) | Draft | Tenant and HQ settings reference |
| [implementation_requirements.md](implementation_requirements.md) | Draft | Implementation requirements spec |

### 8. Review Artifacts (Non-Canonical)

> These files are review inputs only. They are not canonical documents and must not be used as implementation references.

| Document | Notes |
|---|---|
| [ERP_LITE_FINANCE_CORE_RULES_01.md](ERP_LITE_FINANCE_CORE_RULES_01.md) | ⛔ SUPERSEDED — use ERP_LITE_FINANCE_CORE_RULES.md |
| [ERP_LITE_FINANCE_CORE_RULES_02.md](ERP_LITE_FINANCE_CORE_RULES_02.md) | ⛔ SUPERSEDED — use ERP_LITE_FINANCE_CORE_RULES.md |
| [Validation assessment_01.md](Validation%20assessment_01.md) | ChatGPT validation artifact — review history only |
| [Validation Verdict.md](Validation%20Verdict.md) | ChatGPT validation artifact — review history only |
| [Critical Gaps in files.md](Critical%20Gaps%20in%20files.md) | ChatGPT gap analysis artifact — review history only |
