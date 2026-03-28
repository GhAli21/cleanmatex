---
version: v1.0.0
last_updated: 2026-03-27
author: CleanMateX AI Assistant
document_id: ERP_LITE_CROSS_PROJECT_PRD_2026_03_27
status: Approved
approved_date: 2026-03-28
---

# Cross-Project PRD: ERP-Lite

## 1. Overview

ERP-Lite is a cross-project feature spanning:

- `cleanmatex`: tenant-facing runtime finance operations
- `cleanmatexsaas`: HQ governance, standards, publishing, and SaaS plan control

It is designed for tenants who do not already have an ERP and need finance control inside CleanMateX, while still allowing external ERP integration/export for customers who prefer or require it.

---

## 2. Business Problem

Many target laundries:

- do not use a formal ERP
- still need basic accounting visibility
- need receivables control
- need expense and petty cash control
- need branch-level financial visibility

If CleanMateX only supports external ERP integration, those tenants remain operationally enabled but financially underserved.

ERP-Lite closes that gap.

---

## 3. Product Positioning

ERP-Lite is:

- laundry-focused
- finance-control oriented
- operationally integrated
- optional

ERP-Lite is not:

- a generic full ERP
- a statutory compliance suite
- a payroll product
- an enterprise multi-company finance platform

---

## 4. Scope Principles

### 4.1 Laundry-First Scope

Prioritize what laundries need first:

- receivables visibility
- accounting backbone
- basic expenses
- petty cash
- procurement later
- profitability later

### 4.2 Governance and Runtime Separation

Platform-governed finance standards belong in `cleanmatexsaas`.

Tenant runtime finance execution belongs in `cleanmatex`.

### 4.3 Config-Driven Accounting

Posting and mapping logic must be config-driven and governed, not hardcoded in UI.

### 4.4 Safe Rollout

ERP-Lite must be feature-flagged, permission-gated, and settings-driven.

---

## 5. Cross-Project Ownership Split

## 5.1 `cleanmatexsaas` Ownership

Platform HQ owns:

- account type master definitions
- accounting policy governance
- posting/mapping rule governance
- mapping/version publishing
- auto-post runtime behavior policy configuration
- SaaS plan/flag governance
- HQ management UI for publishing and control

## 5.2 `cleanmatex` Ownership

Tenant runtime owns:

- tenant chart of accounts
- GL posting execution
- exception queue and repost flows
- reports
- AR aging
- basic expenses
- basic petty cash
- later AP/PO, bank recon, profitability

## 5.3 Shared Concepts

Shared concepts include:

- account type model
- mapping rule model
- auto-post policies configuration
- version references
- feature flags
- settings contract
- tax/VAT handling model

---

## 6. Critical Product Decisions

### 6.1 Account Types

Account types are:

- HQ-governed
- centralized
- standards-compliant
- locked against tenant customization

Tenants may own their Chart of Accounts, but only within policy constraints.

### 6.2 Debit/Credit Behavior

Do not allow:

- manual override of natural debit/credit behavior
- tenant-defined custom account type behavior

### 6.3 Mapping Engine

Posting must use a rules-driven mapping engine that supports:

- conditions
- multi-line entries
- versioning
- accounting validation
- execution audit trail

### 6.4 Auto-Post Control

Auto-post must be configurable per transaction type and support:

- enabled/disabled
- blocking/non-blocking behavior
- visible failure handling
- retry/repost for failed postings

Ownership model:

- HQ/platform defines and governs auto-post runtime behavior policy
- tenant runtime consumes and enforces the published policy
- tenant users should not independently redefine core posting behavior outside approved policy boundaries

### 6.5 VAT / Tax

v1 must support at least simple tax/VAT handling:

- tax code/rate setup
- tax account mapping
- invoice posting with tax split
- tax visibility in finance outputs

This is not full tax compliance or filing.

---

## 7. Approved Phased Scope

### 7.1 v1

- platform enablement
- account type governance foundations
- tenant COA
- GL
- posting engine
- auto-post from invoices/payments/refunds
- posting exception queue and repost
- basic VAT/tax
- AR aging
- trial balance
- P&L
- balance sheet
- basic expenses
- basic petty cash

### 7.2 v2

- bank reconciliation
- supplier master
- accounts payable
- purchase orders

### 7.3 v3

- advanced expenses
- advanced petty cash controls
- branch profitability
- laundry-specific costing

---

## 8. Out of Scope

- payroll
- fixed assets
- advanced tax compliance
- statutory filing
- multi-company consolidation
- full treasury suite
- manufacturing/MRP
- supplier portal

---

## 9. Functional Requirements Summary

### 9.1 Governance Layer

HQ must be able to:

- define account types
- publish governed rule versions
- control finance feature availability by plan
- prevent tenant violation of core accounting model

### 9.2 Tenant Runtime

Tenant must be able to:

- manage tenant COA
- view GL
- run auto-posted accounting
- view failures and repost
- manage simple expenses
- manage basic petty cash
- view AR aging and finance reports

---

## 10. Auto-Post Runtime Policy Model

Each transaction type must support policy configuration for:

- auto-post enabled
- blocking or non-blocking
- required success or exception allowed
- failure action
- retry/repost allowed

Target transaction types:

- invoice
- payment
- refund
- expense
- petty cash top-up
- later AP invoice / AP payment

---

## 11. Mapping Engine Requirements

The mapping engine must:

- never be hardcoded in UI
- support config-driven rules
- support conditional logic
- support multi-line entries
- support versioning
- validate accounting balance rules
- log every execution

Execution logs should capture:

- mapping version used
- source transaction type
- source record id
- success/failure
- validation errors if any
- user/system context

---

## 12. Account Type Governance Requirements

Account types are:

- governance layer of accounting
- input to the rule engine
- bridge from raw transactions to reports

The system must not permit:

- tenant-created account types
- tenant override of account type debit/credit semantics

The system should permit:

- tenant-managed accounts under governed account type definitions
- tenant COA structure within allowed constraints

---

## 13. Tax / VAT v1 Requirements

v1 should include:

- simple VAT/tax setup
- tax rates or tax codes
- mapping to tax liability or tax-related accounts
- invoice posting that separates tax from revenue when applicable
- tax visibility in trial balance and reports

v1 should not include:

- advanced tax jurisdiction engine
- filing workflows
- regulatory submission

---

## 14. Success Criteria

ERP-Lite v1 is successful when:

- tenant can maintain a constrained COA without bypassing HQ-governed account type rules
- invoice, payment, and refund posting create balanced journals in approved test scenarios
- duplicate posting is prevented for the same logical source event
- failed postings create visible exception records with controlled retry/repost behavior
- taxable invoice posting separates tax from revenue correctly in approved test scenarios
- trial balance reconciles to posted journal totals for approved validation scenarios
- AR aging follows approved finance-controlled logic and reconciles to control-account behavior
- basic expenses and basic petty cash create traceable finance effects
- governance remains HQ-controlled and tenant runtime does not redefine core posting policy

---

## 15. Appendix A: Minimum Runtime Finance Objects

The following object families are the minimum approved v1 runtime model:

- account type master
- account group master
- tenant chart of accounts
- transaction event master
- mapping rule header
- mapping rule line
- account usage mapping
- journal master
- journal line
- posting log
- posting exception queue
- accounting period master

These objects are elaborated operationally in:
- `ERP_LITE_FINANCE_CORE_RULES.md`
- `ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md`

---

## 16. Required Follow-On Documents

This PRD is supported by:

- ADR-001: Account Type Governance Model
- ADR-002: Posting Engine and Mapping Governance
- ADR-003: Auto-Post Exception and Repost Model
- ADR-004: VAT / Tax v1 Scope
- ERP-Lite Finance Core Rules
- ERP-Lite Runtime Domain Contract
- cleanmatex runtime implementation plan
- cleanmatexsaas governance implementation plan
