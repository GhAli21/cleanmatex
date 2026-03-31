---
version: v1.0.0
last_updated: 2026-03-30
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_7_EXPENSES_CHECKLIST_2026_03_30
status: In Progress
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Phase 7 Basic Expenses and Petty Cash Checklist

## 1. Purpose

This document defines the exact checklist for `Phase 7: Basic Expenses and Petty Cash`.

Phase 7 is limited to:
- basic expense entry in `cleanmatex`
- basic petty cash cashbox management in `cleanmatex`
- petty cash top-up and petty cash spend runtime flows
- posting-ready source documents for governed ERP-Lite finance events
- tenant-scoped list and running-balance views

Phase 7 must not:
- introduce advanced approval chains
- introduce custodian transfer workflows
- introduce petty cash counting or reconciliation workflows
- bypass ERP-Lite posting and exception patterns

## 2. Canonical Dependencies

- [PHASE_6_FINANCE_INQUIRY_REPORTS_EXECUTION_PACKAGE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_6_FINANCE_INQUIRY_REPORTS_EXECUTION_PACKAGE.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [BLOCKING_POLICY_TABLE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/BLOCKING_POLICY_TABLE.md)

## 3. Phase 7 Outcome

Phase 7 is complete only when all of the following are true:

- tenant users can create and list basic expenses
- tenant users can create petty cash top-up and petty cash spend transactions
- petty cash running balance is derived from petty cash transactions only
- expense and petty cash source documents are tenant-scoped and RLS-protected
- ERP-Lite expense and petty cash events can dispatch through governed posting

## 4. Runtime Checklist

- [x] create expense source tables
- [x] create petty cash cashbox table
- [x] create petty cash transaction table
- [x] add posting-ready source-document fields for ERP-Lite auto-post
- [x] add expense list flow
- [x] add petty cash list and running balance flow
- [x] add EN/AR copy for expense and petty cash screens
- [x] validate tenant filters, balances, and posting-event compatibility

## 5. Final Readiness Gate

Phase 7 can start safely only when:

- Phase 6 is materially complete
- Phase 3 journal and posting runtime schema is applied
- Phase 5 event dispatch patterns are available for reuse
- no new finance source table bypasses tenant isolation or posting audit
