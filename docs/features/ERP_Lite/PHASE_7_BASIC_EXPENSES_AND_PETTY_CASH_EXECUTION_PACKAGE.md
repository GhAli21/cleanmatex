---
version: v1.0.0
last_updated: 2026-03-31
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_7_EXPENSES_EXEC_PKG_2026_03_30
status: In Progress
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Phase 7 Basic Expenses and Petty Cash Execution Package

## 1. Purpose

This document is the implementation-ready package for `Phase 7: Basic Expenses and Petty Cash`.

## 2. Scope

Phase 7 includes:
- basic expense source documents with header/detail structure
- petty cash cashbox master
- petty cash transaction ledger for top-up and spend flows
- posting-ready document fields aligned to `EXPENSE_RECORDED`, `PETTY_CASH_TOPUP`, and `PETTY_CASH_SPENT`
- tenant-scoped list and running-balance views to be built after schema application

Phase 7 does not include:
- advanced approval chains
- petty cash reconciliation or counting workflows
- inter-cashbox transfer workflows
- AP/vendor invoice lifecycle

## 3. Schema Design Rules

- expense and petty cash remain tenant-scoped runtime entities in `cleanmatex`
- all new `org_*` tables must carry RLS and tenant-safe foreign keys
- expense lines classify the debit side with HQ-governed `usage_code_id`, not tenant-entered account IDs
- petty cash balance must remain derived from `org_fin_cash_txn_tr`; no mutable stored current-balance column
- petty cash cashboxes must bind to tenant COA accounts through `org_fin_acct_mst`
- top-up and spend transactions must capture the source classification required for later posting-request construction

## 4. Planned Migration Split

### 4.1 `0187_erp_lite_phase7_expenses.sql`

Creates:
- `org_fin_exp_mst`
- `org_fin_exp_dtl`

Purpose:
- basic expense source-document foundation
- usage-driven detail classification for future-safe posting
- branch-aware expense ownership

### 4.2 `0188_erp_lite_phase7_petty_cash.sql`

Creates:
- `org_fin_cashbox_mst`
- `org_fin_cash_txn_tr`

Purpose:
- petty cash runtime master and ledger foundation
- top-up and spend document model
- future-safe source-of-truth for running cashbox balance

## 5. Runtime Follow-Up After Migration Apply

Current implementation progress after `0187` and `0188` apply:

1. expense service and create/list route flow are implemented
2. petty cash service and top-up/spend/list flow are implemented
3. governed non-blocking ERP-Lite event dispatch is implemented
4. the ERP-Lite expenses shell page is replaced with a real runtime screen
5. targeted auto-post regression tests pass
6. full Next build validation is still blocked by the stale `.next/lock` file

## 6. Validation Gate

Before runtime work starts, confirm:
- migrations apply cleanly
- all new tables have RLS enabled
- all composite tenant foreign keys are valid
- no table stores mutable petty cash running balance
- no source document stores direct debit/credit account IDs outside governed references
