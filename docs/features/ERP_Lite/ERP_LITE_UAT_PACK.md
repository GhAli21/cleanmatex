---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_UAT_PACK_2026_04_01
status: Active
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite UAT Pack

## 1. Purpose

This document defines the UAT checklist for ERP-Lite before pilot or production rollout.

## 2. UAT Preconditions

Before UAT starts:

- the target tenant has `erp_lite_enabled = true`
- required sub-flags are enabled for the modules being tested
- tenant roles are assigned the intended `erp_lite_*:view` permissions
- at least one published HQ governance package exists for the test scenario
- the target tenant has a valid COA, usage mappings, and open accounting period

## 3. UAT Roles

Recommended testers:

- finance owner
- branch operations manager
- cashier / payment operator
- AP / procurement operator
- HQ governance owner

## 4. UAT Scope

### 4.1 Access and Navigation

Verify:

- ERP-Lite appears only for intended plans and roles
- Finance & Accounting sidebar opens correctly
- live routes load:
  - General Ledger
  - Financial Reports
  - AR Aging
  - Expenses
  - Bank Reconciliation
  - Accounts Payable
  - Purchase Orders
  - Branch P&L
- placeholder routes remain clearly non-operational where applicable

### 4.2 Core v1 Posting

Verify:

- invoice creation posts balanced journals
- direct payment posts balanced journals
- distributed multi-invoice payment posts balanced journals
- refund posts balanced journals
- duplicate posting is blocked
- failed posting creates visible posting-log / exception behavior

### 4.3 v1 Inquiry and Reports

Verify:

- GL inquiry shows posted journal lines only
- trial balance reconciles to posted journals
- profit and loss is reasonable and balanced against posted activity
- balance sheet is reasonable and balanced against posted activity
- AR aging shows only valid outstanding customer balances

### 4.4 v1 Expenses and Petty Cash

Verify:

- expense entry saves and posts correctly
- petty cash cashbox can be created correctly
- petty cash top-up and spend save and post correctly
- petty cash numbering is tenant-scoped
- petty cash approvals can be requested and processed
- petty cash reconciliation can be created, exceptioned, closed, and locked

### 4.5 v2 Treasury, Suppliers, AP, PO

Verify:

- supplier can be created and listed
- PO can be created and listed
- AP invoice can be created and listed
- AP payment updates open amounts correctly
- AP aging is reasonable for the test supplier data
- bank account can be created
- bank statement batch and lines can be created/imported
- bank match can be created and reversed
- bank reconciliation can be closed only when unmatched amount is zero
- closed bank reconciliation can be locked

### 4.6 v3 Advanced Controls, Profitability, Costing

Verify:

- allocation rule can be created
- allocation run can be created, populated, and posted
- Branch P&L shows direct values separately from allocated values
- cost component can be created
- cost run can be created, populated, and posted
- latest cost summary appears by branch
- profitability/costing outputs are auditable and understandable to finance reviewers

### 4.7 HQ Governance

In `cleanmatexsaas`, verify:

- governance dashboard loads
- package detail loads
- draft package can be created and edited
- draft rule can be edited
- draft auto-post policy can be edited
- package validate / approve / publish flow works

## 5. UAT Test Data Recommendations

Use at least:

- 2 branches
- 2 customer invoices with different payment timing
- 2 suppliers
- 2 PO documents
- 2 AP invoices
- 1 AP payment with allocation
- 1 bank statement with multiple lines
- 1 petty cash box with top-up and spend
- 1 allocation run with cross-branch effect
- 1 cost run with at least 2 cost components

## 6. Expected UAT Outputs

Capture:

- screenshots of key screens
- sample journal numbers
- sample posting log / exception IDs
- report snapshots
- reconciliation IDs
- allocation run IDs
- cost run IDs
- list of issues by severity

## 7. UAT Exit Criteria

ERP-Lite UAT passes only when:

- no high-severity finance correctness defect remains
- no tenant-isolation defect remains
- no blocking role/flag defect remains
- finance owner signs off on journals and reports
- operations owner signs off on day-to-day workflows
- HQ governance owner signs off on package authoring/publication behavior

## 8. UAT Signoff Record

Use this simple signoff block:

- Tenant:
- Test window:
- Finance owner:
- Operations owner:
- HQ governance owner:
- Result: `Pass` / `Pass with follow-ups` / `Fail`
- High-severity issues:
- Required fixes before pilot:

## 9. Related Documents

- [ERP_LITE_REMAINING_ITEMS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_REMAINING_ITEMS.md)
- [IMPLEMENTATION_STATUS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_STATUS.md)
- [PHASE_8_V1_PILOT_AND_HARDENING_EXECUTION_PACKAGE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_8_V1_PILOT_AND_HARDENING_EXECUTION_PACKAGE.md)
