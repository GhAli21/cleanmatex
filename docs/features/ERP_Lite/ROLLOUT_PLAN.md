---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# ERP-Lite Rollout Plan

Phased implementation plan for the ERP-Lite module.

---

## Overview

| Phase | Focus | Duration | Dependencies |
|-------|--------|----------|--------------|
| 1 | Foundation (COA + GL + Auto-Post) | 8–10 weeks | None |
| 2 | Financial Reports + AR Aging | 4–6 weeks | Phase 1 |
| 3 | Bank Reconciliation | 4 weeks | Phase 1, 2 |
| 4 | AP + Purchase Orders | 6–8 weeks | Phase 1 |
| 5 | Expense Management + Branch P&L | 4–6 weeks | Phase 1, 4 |
| 6 | Payroll + Fixed Assets (Optional) | 8–12 weeks | Phase 1–5 |

---

## Phase 1: Foundation (8–10 weeks)

**Goal:** Chart of Accounts, General Ledger, auto-post from invoices and payments.

### Week 1–2: Schema & COA

- Design `org_fin_chart_of_accounts_mst`
- Design `org_fin_gl_entries_tr`
- Migration for COA + GL tables (RLS, indexes, audit fields)
- Seed COA template for laundry
- COA setup UI

### Week 3–4: GL Posting Engine

- Posting rules for `org_invoice_mst`
- Posting rules for payments
- Posting rules for refunds/credit notes
- Idempotency
- GL entry service

### Week 5–6: Integration & Validation

- Trigger/hook on invoice create/update
- Trigger/hook on payment create
- Validation (Debits = Credits)
- GL viewer UI
- Feature flag `erp_lite_enabled`, `erp_lite_gl_enabled`

### Week 7–8: Testing & Soft Launch

- Unit tests, integration tests, tenant isolation tests
- Pilot with 1–2 tenants

---

## Phase 2: Financial Reports + AR Aging (4–6 weeks)

- P&L, Balance Sheet, Cash Flow queries
- AR aging logic
- Report UI, export (PDF, Excel)
- Feature flags: `erp_lite_reports_enabled`, `erp_lite_ar_enabled`

---

## Phase 3: Bank Reconciliation (4 weeks)

- `org_fin_bank_accounts_mst`, `org_fin_bank_transactions_tr`
- CSV import, matching logic
- Reconciliation UI
- Feature flag: `erp_lite_bank_recon_enabled`

---

## Phase 4: AP + Purchase Orders (6–8 weeks)

- AP schema, PO schema
- PO workflow, AP workflow
- GL posting for AP
- Feature flags: `erp_lite_ap_enabled`, `erp_lite_po_enabled`

---

## Phase 5: Expense Management + Branch P&L (4–6 weeks)

- Expense claims, approval workflow
- Branch P&L report
- Feature flags: `erp_lite_expenses_enabled`, `erp_lite_branch_pl_enabled`

---

## Phase 6: Payroll + Fixed Assets (Optional, 8–12 weeks)

- Basic payroll
- Fixed assets register, depreciation

---

## Milestones

| Milestone | After Phase | Success Criteria |
|-----------|-------------|-------------------|
| M1: GL Live | Phase 1 | Invoices and payments post to GL; balances correct |
| M2: Reports Live | Phase 2 | P&L, Balance Sheet, AR aging available |
| M3: Bank Recon Live | Phase 3 | Bank import and matching working |
| M4: AP Live | Phase 4 | POs and AP invoices recorded and paid |
| M5: Full ERP-Lite | Phase 5 | Expenses and branch P&L available |

---

## Resource Estimate

| Phase | Dev Weeks | Roles |
|-------|-----------|-------|
| Phase 1 | 8–10 | 1 full-stack + 0.5 QA |
| Phase 2 | 4–6 | 1 full-stack |
| Phase 3 | 4 | 1 full-stack |
| Phase 4 | 6–8 | 1 full-stack + 0.5 backend |
| Phase 5 | 4–6 | 1 full-stack |
| Phase 6 | 8–12 | 1 full-stack (optional) |

**Total (Phases 1–5):** ~26–34 weeks (6–8 months) with one full-stack developer.
