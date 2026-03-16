---
version: v1.0.0
last_updated: 2026-03-16
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

## Key Documentation

- [PRD (Full)](PRD-ERP-Lite.md)
- [Feature Flags](FEATURE_FLAGS.md)
- [Settings](SETTINGS.md)
- [Permissions](PERMISSIONS.md)
- [Implementation Requirements](implementation_requirements.md)
- [Rollout Plan](ROLLOUT_PLAN.md)
