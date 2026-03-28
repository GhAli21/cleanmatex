---
version: v1.0.0
last_updated: 2026-03-27
author: CleanMateX AI Assistant
document_id: ERP_LITE_CLEANMATEX_RUNTIME_PLAN_2026_03_27
status: Approved
approved_date: 2026-03-28
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# cleanmatex Runtime Implementation Plan

## 1. Purpose

This document covers only `cleanmatex` tenant runtime responsibilities for ERP-Lite.

It excludes HQ governance responsibilities that belong to `cleanmatexsaas`.

Runtime consumes HQ-governed auto-post behavior policy. It does not own the authoritative policy definition.

---

## 2. Runtime Scope

Tenant runtime owns:

- tenant chart of accounts
- GL execution and inquiry
- auto-post execution
- posting exception queue
- retry/repost flows
- AR aging
- finance reports
- simple VAT/tax runtime behavior
- basic expenses
- basic petty cash

Later:

- bank reconciliation runtime
- supplier/AP/PO runtime
- advanced expenses
- advanced petty cash
- branch profitability

---

## 3. v1 Runtime Build Order

1. ERP-Lite route shell and runtime gating
2. tenant COA
3. GL schema and services
4. posting execution engine
5. invoice/payment/refund integration
6. exception queue and repost
7. reports and AR aging
8. basic expenses and petty cash

---

## 4. Runtime Data Responsibilities

Tenant-side runtime tables should include:

- tenant COA structures
- GL entries and batches
- posting execution logs
- posting exceptions / failed auto-posts
- expense runtime tables
- petty cash runtime tables or equivalent simple control structures

All tenant runtime tables must:

- include `tenant_org_id`
- use RLS
- be branch-aware when relevant
- include audit fields

---

## 5. Runtime APIs and UI

Expected runtime API surface:

- COA CRUD
- GL inquiry
- repost/retry endpoints
- AR aging endpoints
- P&L / Balance Sheet / Trial Balance endpoints
- expense entry endpoints
- petty cash entry/top-up endpoints

Expected runtime UI:

- Finance & Accounting section
- COA screen
- GL screen
- reports screen
- AR aging screen
- expenses screen
- petty cash screen or petty cash controls inside expenses

---

## 6. Runtime Validation Rules

Must validate:

- tenant isolation
- balanced postings
- branch handling
- tax split handling
- exception/repost behavior
- expense and petty cash posting behavior

---

## 7. Human Review Gates

Review in `cleanmatex` planning after:

- schema design
- posting integration
- report correctness
- expense/petty cash behavior
