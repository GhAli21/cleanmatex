---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
document_id: PRD-ERP-Lite
status: Draft
---

# PRD: ERP-Lite — Finance & Accounting Add-on

## 1. Executive Summary

### 1.1 Purpose

ERP-Lite is a subscription add-on that provides small-to-medium laundry businesses with core finance and accounting capabilities when they do not have an external ERP. It enables CleanMateX to serve a broader market segment and increase ARPU.

### 1.2 Goals

- Enable tenants without ERP to manage books within CleanMateX
- Auto-post from existing invoices and payments into General Ledger
- Provide P&L, Balance Sheet, AR aging, and bank reconciliation
- Optional AP, PO, and expense management for Growth+ plans
- Coexist with CSV/API export for tenants who use external accountants

### 1.3 Success Metrics

- Adoption rate of ERP-Lite add-on among eligible tenants
- Reduction in support requests for "export to accounting"
- Revenue from ERP-Lite subscription tier

---

## 2. Scope

### 2.1 In Scope

| Phase | Module | Description |
|-------|--------|-------------|
| 1 | Chart of Accounts | Account hierarchy, types, codes |
| 1 | General Ledger | Double-entry postings, auto-post from invoices/payments |
| 2 | Financial Reports | P&L, Balance Sheet, Cash Flow |
| 2 | AR Aging | Outstanding balances by aging bucket |
| 3 | Bank Reconciliation | Import bank statements, match to payments |
| 4 | AP | Supplier invoices, payments |
| 4 | Purchase Orders | POs for consumables |
| 5 | Expense Management | Expense claims, approvals |
| 5 | Branch P&L | Profitability by branch |

### 2.2 Out of Scope

- Full ERP (inventory costing, manufacturing, complex multi-entity)
- Payroll (future optional module)
- Fixed assets (future optional module)
- Tax filing / compliance (tenant responsibility; consult accountant)

---

## 3. User Personas

| Persona | Need |
|---------|------|
| **Small laundry owner** | Simple P&L, AR aging, bank recon without external software |
| **Finance manager (multi-branch)** | Branch P&L, consolidated reports |
| **Accountant (external)** | Export for year-end; clean GL structure |

---

## 4. Functional Requirements

### 4.1 Chart of Accounts (COA)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-COA-001 | Tenant can define accounts with code, name/name2, type (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE) | P0 |
| FR-COA-002 | Hierarchy via parent_id (optional) | P1 |
| FR-COA-003 | Seed COA template for laundry (revenue, AR, cash, VAT, COGS, expenses) | P0 |
| FR-COA-004 | Accounts cannot be deleted if used in GL; soft-delete (is_active=false) | P0 |

### 4.2 General Ledger (GL)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-GL-001 | Post from org_invoice_mst: DR AR, CR Revenue (+ VAT if applicable) | P0 |
| FR-GL-002 | Post from payments: DR Cash/Bank, CR AR | P0 |
| FR-GL-003 | Post from refunds/credit notes: reverse or offset entries | P0 |
| FR-GL-004 | Idempotency: no duplicate postings per source document | P0 |
| FR-GL-005 | GL entries: account_id, debit, credit, entry_date, reference_type, reference_id, branch_id | P0 |
| FR-GL-006 | Debits = Credits per batch | P0 |

### 4.3 Financial Reports

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RPT-001 | P&L: Revenue − COGS − OpEx by period |
| FR-RPT-002 | Balance Sheet: Assets, Liabilities, Equity |
| FR-RPT-003 | Cash Flow (simplified): Operating, Investing, Financing |
| FR-RPT-004 | Date range: month, quarter, year, custom |
| FR-RPT-005 | Export: PDF, Excel |

### 4.4 AR Aging

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AR-001 | Aging buckets: Current, 30, 60, 90+ days |
| FR-AR-002 | Link to org_invoice_mst, org_customers_mst |
| FR-AR-003 | B2B integration: use existing contracts/statements |

### 4.5 Bank Reconciliation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BR-001 | Bank accounts master |
| FR-BR-002 | Import bank transactions (CSV) |
| FR-BR-003 | Match bank tx to payments |
| FR-BR-004 | Match bank tx to GL entries |
| FR-BR-005 | Reconciliation status: Matched, Unmatched, Reconciled |

### 4.6 AP & PO (Optional)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AP-001 | Supplier invoices |
| FR-AP-002 | AP payments |
| FR-PO-001 | Purchase orders |
| FR-PO-002 | Link PO to receiving |

### 4.7 Expense Management (Optional)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-EXP-001 | Expense claims |
| FR-EXP-002 | Approval workflow |
| FR-EXP-003 | GL posting on reimbursement |

### 4.8 Branch P&L (Optional)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BPL-001 | Revenue by branch |
| FR-BPL-002 | Costs by branch (allocations or direct) |
| FR-BPL-003 | Branch P&L report |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Tenant isolation: all org_fin_* tables use tenant_org_id + RLS |
| NFR-002 | Audit: created_at/_by, updated_at/_by on all tables |
| NFR-003 | Multi-currency: functional currency per tenant |
| NFR-004 | VAT: separate VAT accounts |
| NFR-005 | i18n: EN/AR for all labels |

---

## 6. Feature Flags

| Flag | Description | Plans |
|------|-------------|-------|
| `erp_lite_enabled` | Master switch for ERP-Lite module | PRO, ENTERPRISE |
| `erp_lite_gl_enabled` | COA + GL | PRO, ENTERPRISE |
| `erp_lite_reports_enabled` | Financial reports | PRO, ENTERPRISE |
| `erp_lite_ar_enabled` | AR aging | PRO, ENTERPRISE |
| `erp_lite_bank_recon_enabled` | Bank reconciliation | PRO, ENTERPRISE |
| `erp_lite_ap_enabled` | Accounts Payable | ENTERPRISE |
| `erp_lite_po_enabled` | Purchase Orders | ENTERPRISE |
| `erp_lite_expenses_enabled` | Expense management | ENTERPRISE |
| `erp_lite_branch_pl_enabled` | Branch P&L | PRO, ENTERPRISE |

See [FEATURE_FLAGS.md](FEATURE_FLAGS.md) for full specification.

---

## 7. Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `ERP_LITE_ENABLED` | Tenant self-serve disable | true |
| `ERP_LITE_FISCAL_YEAR_START` | Fiscal year start month (1–12) | 1 |
| `ERP_LITE_FIRST_PERIOD_START` | First period start date | null |
| `ERP_LITE_AUTO_POST_INVOICES` | Auto-post invoices to GL | true |
| `ERP_LITE_AUTO_POST_PAYMENTS` | Auto-post payments to GL | true |
| `ERP_LITE_PERIOD_CLOSE` | Allow period close (lock prior months) | false |

See [SETTINGS.md](SETTINGS.md) for full specification.

---

## 8. Permissions

| Permission | Description |
|------------|-------------|
| `erp_lite:view` | View ERP-Lite section |
| `erp_lite_coa:view` | View Chart of Accounts |
| `erp_lite_coa:edit` | Edit Chart of Accounts |
| `erp_lite_gl:view` | View General Ledger |
| `erp_lite_gl:edit` | Post manual GL entries |
| `erp_lite_reports:view` | View financial reports |
| `erp_lite_ar:view` | View AR aging |
| `erp_lite_bank_recon:view` | View bank reconciliation |
| `erp_lite_bank_recon:edit` | Reconcile bank transactions |
| `erp_lite_ap:view` | View AP |
| `erp_lite_ap:edit` | Record AP invoices/payments |
| `erp_lite_po:view` | View POs |
| `erp_lite_po:edit` | Create/edit POs |
| `erp_lite_expenses:view` | View expenses |
| `erp_lite_expenses:edit` | Submit/approve expenses |
| `erp_lite_branch_pl:view` | View branch P&L |

See [PERMISSIONS.md](PERMISSIONS.md) for full specification.

---

## 9. Data Model (Summary)

| Table | Purpose |
|-------|---------|
| `org_fin_chart_of_accounts_mst` | COA |
| `org_fin_gl_entries_tr` | GL entries |
| `org_fin_bank_accounts_mst` | Bank accounts |
| `org_fin_bank_transactions_tr` | Bank statement lines |
| `org_fin_ap_invoices_mst` | Supplier invoices |
| `org_fin_purchase_orders_mst` | POs |
| `org_fin_expenses_mst` | Expense claims |

---

## 10. Rollout Phases

| Phase | Scope | Duration |
|-------|--------|----------|
| 1 | COA + GL + Auto-Post | 8–10 weeks |
| 2 | Reports + AR Aging | 4–6 weeks |
| 3 | Bank Reconciliation | 4 weeks |
| 4 | AP + PO | 6–8 weeks |
| 5 | Expenses + Branch P&L | 4–6 weeks |

---

## 11. Dependencies

- `org_invoice_mst` — source for revenue/AR postings
- `org_payments_*` — source for cash postings
- `org_customers_mst` — AR aging
- `org_branches_mst` — branch P&L
- B2B: `org_b2b_contracts_mst`, `org_b2b_statements_mst` — AR integration

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Posting errors | Idempotency, validation, audit trail |
| Performance | Indexes, partitioning by period |
| Compliance | "Consult your accountant" disclaimer; no tax advice |

---

## 13. Appendix

### A. COA Template (Laundry)

| Code | Name | Type |
|------|------|------|
| 1000 | Cash | ASSET |
| 1100 | Accounts Receivable | ASSET |
| 1101 | VAT Receivable | ASSET |
| 2000 | Accounts Payable | LIABILITY |
| 2100 | VAT Payable | LIABILITY |
| 3000 | Owner's Equity | EQUITY |
| 4000 | Laundry Revenue | REVENUE |
| 5000 | Cost of Sales | EXPENSE |
| 6000 | Operating Expenses | EXPENSE |

### B. Cross-References

- [Implementation Requirements](implementation_requirements.md)
- [Feature Flags](FEATURE_FLAGS.md)
- [Settings](SETTINGS.md)
- [Permissions](PERMISSIONS.md)
