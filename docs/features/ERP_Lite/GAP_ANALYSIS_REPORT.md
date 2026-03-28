---
version: v1.0.0
last_updated: 2026-03-27
author: CleanMateX AI Assistant
document_id: ERP_LITE_GAP_ANALYSIS_2026_03_27
status: Draft
---

# ERP-Lite Gap Analysis Report

## 1. Overview

This report evaluates the current CleanMateX repository against the documented ERP-Lite target defined in:

- `docs/features/ERP_Lite/README.md`
- `docs/features/ERP_Lite/PRD-ERP-Lite.md`
- `docs/features/ERP_Lite/implementation_requirements.md`
- `docs/features/ERP_Lite/ROLLOUT_PLAN.md`

The objective is to determine:

1. what ERP-adjacent capability already exists in the live codebase
2. what can be reused as ERP-Lite foundation
3. what is only documented but not implemented
4. what critical gaps remain before CleanMateX can credibly ship ERP-Lite

This is a repository-based analysis, not a greenfield recommendation.

---

## 2. Executive Summary

### Bottom Line

CleanMateX already has a strong **operational and commercial foundation** for ERP-Lite:

- customer management
- B2B customer/contract/statement scaffolding
- invoicing
- payments
- receipts
- finance vouchers
- payment audit and cash-up reconciliation
- branch-aware inventory
- delivery operations
- operational reporting

However, the actual **ERP-Lite module itself is not yet implemented**.

The repo currently contains:

- ERP-Lite documentation
- ERP-Lite PRD
- ERP-Lite permissions specification
- ERP-Lite feature flag specification
- ERP-Lite rollout plan

But it does **not** yet contain active implementation for:

- ERP-Lite database schema
- ERP-Lite routes
- ERP-Lite screens
- ERP-Lite constants/types
- ERP-Lite feature flags in active code
- ERP-Lite navigation
- ERP-Lite permissions migrations

### Core Finding

CleanMateX is already capable of supporting ERP-Lite as an extension, but it is still an **operations-first system with finance-adjacent features**, not yet a true finance and accounting module.

### Highest-Impact Gaps

1. No Chart of Accounts
2. No General Ledger or double-entry posting engine
3. No ERP-Lite settings, navigation, feature flags, or permissions in active code
4. No Accounts Payable or Purchase Orders
5. No bank account and bank transaction model
6. No formal financial statements
7. No branch profitability or costing engine

---

## 3. Scope and Evaluation Method

The analysis reviewed:

- active UI routes in `web-admin/app/dashboard`
- active API routes in `web-admin/app/api`
- active service layer in `web-admin/lib/services`
- database migrations in `supabase/migrations`
- feature and implementation docs in `docs/features`, `docs/dev`, and `docs/plan`

The assessment classifies each capability as:

- `Implemented`: working code and schema exist in active app paths
- `Partial / Reusable`: some live implementation exists, but not enough to count as a complete ERP-Lite module
- `Documented Only`: appears in PRDs/specs, not in active implementation
- `Missing`: neither meaningfully implemented nor operationally available

---

## 4. Current Implemented Foundations

### 4.1 Customer and Commercial Foundation

#### Current State

Implemented and mature enough to be reused.

#### Evidence

- Customer management page and flows exist in `web-admin/app/dashboard/customers/page.tsx`
- Customer feature implementation history in `docs/features/003_customer_management/IMPLEMENTATION_PROGRESS.md`
- Customer services exist in:
  - `web-admin/lib/services/customers.service.ts`
  - `web-admin/lib/services/customer-addresses.service.ts`
- B2B customer schema exists in `supabase/migrations/0147_b2b_customers_contracts_contacts.sql`
- B2B customer pages and APIs exist under:
  - `web-admin/app/dashboard/b2b/customers/`
  - `web-admin/app/api/v1/b2b-contracts/`
  - `web-admin/app/api/v1/b2b-statements/`

#### ERP-Lite Relevance

This provides the master data basis for:

- Accounts Receivable
- AR aging
- customer statements
- B2B credit workflows
- customer-level finance drilldowns

#### Gap

Customer and B2B entities exist, but they are not yet integrated into a formal ledger or subledger architecture.

---

### 4.2 Invoicing and Payments Foundation

#### Current State

Implemented and strong.

#### Evidence

- Invoice list page in `web-admin/app/dashboard/billing/invoices/page.tsx`
- Payment and invoice services in:
  - `web-admin/lib/services/invoice-service.ts`
  - `web-admin/lib/services/payment-service.ts`
  - `web-admin/lib/services/refund-voucher-service.ts`
  - `web-admin/lib/services/voucher-service.ts`
- Finance guide in `docs/dev/finance_invoices_payments_dev_guide.md`
- Payment actions in:
  - `web-admin/app/actions/payments/process-payment.ts`
  - `web-admin/app/actions/payments/payment-crud-actions.ts`
  - `web-admin/app/actions/payments/invoice-actions.ts`

#### Strengths

- invoice creation and listing
- partial payments
- unapplied payments
- deposits and advance flows
- refunds
- payment cancellation
- payment audit log
- voucher model for receipts and refunds

#### ERP-Lite Relevance

This is the most important operational source for Phase 1 ERP-Lite auto-posting:

- invoice posting to AR and revenue
- payment posting to cash/bank and AR
- refund reversal posting

#### Gap

The source transactions exist, but no accounting posting layer consumes them.

---

### 4.3 Receipts, Vouchers, and Cash-Up

#### Current State

Implemented, but operational rather than full accounting.

#### Evidence

- Receipt schema in `supabase/migrations/0064_org_rcpt_receipts_system.sql`
- Voucher schema in `supabase/migrations/0100_org_fin_vouchers_and_receipt_voucher_id.sql`
- Cash-up service in `web-admin/lib/services/cashup-service.ts`
- Cash-up pages in `web-admin/app/dashboard/billing/cashup/`
- Payment reconciliation log migration in `supabase/migrations/0093_create_payment_reconciliation_log.sql`

#### Strengths

- end-of-day expected vs actual by payment method
- voucher issuance and voiding
- payment audit
- refund voucher generation

#### ERP-Lite Relevance

These are reusable for:

- treasury controls
- branch cash handling
- bank/cash matching workflows
- audit trail expectations

#### Gap

Current cash-up is not bank reconciliation and not GL cashbook accounting. It reconciles operational payment totals, not bank statement lines or ledger balances.

---

### 4.4 Inventory and Branch Stock

#### Current State

Implemented for stock tracking only.

#### Evidence

- Inventory page in `web-admin/app/dashboard/inventory/stock/page.tsx`
- Inventory schema in `supabase/migrations/0101_inventory_stock_management.sql`
- Inventory status doc in `docs/features/inventory_stock_management/current_status.md`
- Feature doc in `docs/features/inventory_stock_management/inventory_stock_management.md`

#### Strengths

- branch-wise quantities
- stock adjustments
- stock transaction history
- negative stock support
- audit fields

#### ERP-Lite Relevance

This is strong groundwork for:

- consumables control
- purchase receipt impact
- future cost allocations
- branch-level stock visibility

#### Gap

The inventory module explicitly states that the following are still future work:

- supplier management
- purchase orders
- usage-per-order allocation
- batch/lot tracking

This means inventory is currently a stock ledger, not procurement or inventory accounting.

---

### 4.5 Delivery and Branch Operations

#### Current State

Implemented.

#### Evidence

- Delivery page in `web-admin/app/dashboard/delivery/page.tsx`
- Delivery schema in `supabase/migrations/0065_org_dlv_delivery_management.sql`
- Delivery summary in `docs/features/013_delivery_management/IMPLEMENTATION_SUMMARY.md`

#### ERP-Lite Relevance

This supports future branch profitability and route costing, especially when expenses and allocations are introduced.

#### Gap

Delivery cost is not currently allocated into branch P&L or customer profitability.

---

### 4.6 Reporting

#### Current State

Implemented, but mainly operational and commercial.

#### Evidence

- Invoice report page in `web-admin/app/dashboard/reports/invoices/page.tsx`
- Payment report page in `web-admin/app/dashboard/reports/payments/page.tsx`
- Customer report page in `web-admin/app/dashboard/reports/customers/page.tsx`

#### Strengths

- invoice status KPIs
- outstanding totals
- payment trends
- customer revenue views
- aging bucket visualization inside invoice reporting

#### ERP-Lite Relevance

The reporting stack and UX patterns are reusable for ERP-Lite reports.

#### Gap

These are not formal financial reports:

- no P&L
- no balance sheet
- no cash flow
- no trial balance
- no general ledger inquiry

---

## 5. ERP-Lite Target vs Current Gap Matrix

| ERP-Lite Capability | Target Status in Docs | Current Repo Status | Assessment |
|---|---|---|---|
| Chart of Accounts | Required in Phase 1 | No schema, no routes, no UI | Missing |
| General Ledger | Required in Phase 1 | No schema, no posting engine, no viewer | Missing |
| Auto-post invoices/payments/refunds | Required in Phase 1 | Source transactions exist, no posting hooks | Missing with reusable sources |
| Financial Reports | Required in Phase 2 | Operational reports exist, no financial statements | Partial / reusable |
| AR Aging | Required in Phase 2 | Invoice aging-like data appears in reporting and B2B statements, but no formal AR aging module | Partial / reusable |
| Bank Reconciliation | Required in Phase 3 | Cash-up exists, but no bank accounts, bank tx import, match engine | Partial concept only |
| Accounts Payable | Required in Phase 4 | No AP schema, no supplier invoices, no AP screens | Missing |
| Purchase Orders | Required in Phase 4 | Only planned in docs; not implemented | Missing |
| Expense Management | Required in Phase 5 | No expense claim workflow found | Missing |
| Branch P&L | Required in Phase 5 | Branch dimension exists, no profitability model/report | Missing |
| ERP-Lite feature flags | Required platform setup | Spec exists only in docs; no active constants/migrations found | Documented only |
| ERP-Lite permissions | Required platform setup | Spec exists only in docs; no active permission migration found | Documented only |
| ERP-Lite navigation | Required platform setup | Spec exists only in docs; no dashboard/erp-lite routes found | Documented only |
| ERP-Lite settings | Required platform setup | Spec exists only in docs; no active setting migration found | Documented only |

---

## 6. Detailed Gaps by Domain

### 6.1 Platform Readiness Gap

The ERP-Lite product is specified but not yet wired into the platform.

#### Missing from active implementation

- no `erp_lite_*` feature flags in active code or migrations
- no `erp_lite_*` permissions in active code or migrations
- no `dashboard/erp-lite/*` routes
- no ERP-Lite navigation tree records in implementation
- no ERP-Lite settings in active system settings implementation
- no `web-admin/lib/constants/erp-lite.ts`
- no `web-admin/lib/types/erp-lite.ts`

#### Impact

Even if finance logic were built, it cannot be safely exposed, gated, or sold as a plan-bound add-on without this platform work.

---

### 6.2 Data Model Gap

The Phase 1 ERP-Lite schema does not exist.

#### Expected by ERP-Lite docs

- `org_fin_chart_of_accounts_mst`
- `org_fin_gl_entries_tr`
- later: `org_fin_bank_*`, `org_fin_ap_*`, `org_fin_po_*`, `org_fin_expenses_*`

#### Current reality

None of these were found in active migrations or active code paths.

#### Impact

There is no persistent accounting model yet. Existing vouchers are document artifacts, not a full accounting subledger or general ledger.

---

### 6.3 Accounting Engine Gap

This is the largest functional gap.

#### Missing

- double-entry rule engine
- posting batches
- idempotency control per source document
- debit/credit validation
- reversal model for accounting entries
- period controls
- manual journal entry workflow

#### Current reusable assets

- invoice transactions
- payment transactions
- refund flows
- voucher lifecycle
- branch references
- audit expectations

#### Impact

Without the accounting engine, CleanMateX cannot claim ERP-Lite finance functionality even if reports are later added.

---

### 6.4 Receivables Gap

Receivables are operationally present, but not formalized as an ERP submodule.

#### Already available

- invoices
- balances via `paid_amount`
- B2B statements
- overdue reporting concepts
- dunning-related routes

#### Missing

- AR aging screen under ERP-Lite
- customer ledger statements as finance records
- credit control workflow integrated with ERP-Lite permissions/settings
- write-off handling with GL effect

#### Assessment

AR is the closest ERP-Lite module to being achievable quickly because the operational data model already exists.

---

### 6.5 Bank Reconciliation Gap

There is a strong risk of overestimating current readiness here.

#### Existing capability

- cash-up by payment method
- payment reconciliation log

#### Missing

- bank accounts master
- bank statement import
- bank transaction table
- matching engine
- unmatched vs matched queue
- reconciliation approval/finalization
- bank-to-GL matching

#### Assessment

Cash-up is useful groundwork, but it is not bank reconciliation.

---

### 6.6 Procurement and Accounts Payable Gap

This is almost entirely unimplemented.

#### Existing related capability

- inventory stock tables
- feature flags for supplier management in generic platform constants
- docs and PRDs referencing supplier management and PO

#### Missing

- supplier master
- supplier contacts and terms
- purchase requisitions
- purchase orders
- goods receipt note flow
- purchase invoice entry
- AP aging
- supplier payments
- supplier returns

#### Assessment

AP/PO is a genuine greenfield module inside this repo and should not be treated as “almost there.”

---

### 6.7 Expense Management Gap

Missing as a live module.

#### Missing

- expense claims
- approver workflow
- reimbursement flow
- expense categories mapped to accounts
- branch assignment for expenses
- attachment workflow

#### Assessment

This is independent enough to build later, but branch P&L quality will remain weak without it.

---

### 6.8 Branch P&L and Costing Gap

This is strategically important and currently absent.

#### Existing foundations

- branch-aware orders
- branch-aware payments
- branch-aware stock
- branch-aware delivery operations

#### Missing

- expense allocation by branch
- stock consumption costing by branch
- direct vs allocated cost model
- branch profitability report
- service profitability
- customer profitability
- route/delivery cost allocation

#### Assessment

Branch P&L should not start as a simple revenue report. It needs an explicit cost model or it will mislead users.

---

## 7. Documentation-to-Implementation Gap

The ERP-Lite feature is unusually well documented compared with its implementation status.

### Present in docs

- product positioning
- scope and phases
- feature flags
- settings
- permissions
- navigation
- API surface expectations
- schema expectations
- rollout plan

### Absent in code

- all ERP-Lite-specific screens
- all ERP-Lite APIs
- all ERP-Lite schema migrations
- all ERP-Lite constants/types
- all ERP-Lite plan gating

### Implication

ERP-Lite is currently in a **product-definition stage**, not an implementation stage.

This is positive from planning clarity, but risky if internal stakeholders assume the module is already partly built because of the richness of the documentation.

---

## 8. Architectural Risks

### 8.1 Risk: Building Reports Before Ledger

If financial reports are built directly from invoices/payments without a GL layer:

- report logic becomes duplicated
- reversals and adjustments become hard to reason about
- AP and expenses will not join cleanly later
- auditability weakens

### 8.2 Risk: Treating Vouchers as Full Accounting

Current vouchers are important, but they are not a replacement for:

- chart of accounts
- journal lines
- balanced postings
- periodized reporting

### 8.3 Risk: Treating Cash-Up as Bank Reconciliation

Cash-up validates operational collections, not bank settlement reality.

### 8.4 Risk: Launching Branch P&L Too Early

Branch P&L without expenses and costing will mostly be branch revenue reporting, not profitability.

### 8.5 Risk: Building AP/PO Before GL Rules

It is possible to build procurement screens first, but if AP is built without posting design, the finance architecture will likely need rework.

---

## 9. Recommended Build Sequence

### Phase A: Platform Enablement

Build first:

- ERP-Lite feature flags
- ERP-Lite permissions
- ERP-Lite navigation tree
- ERP-Lite settings
- ERP-Lite constants/types
- ERP-Lite base route shell

Reason:
This creates controlled rollout and avoids mixing unfinished finance features into current billing screens.

### Phase B: Phase 1 ERP Core

Build next:

- Chart of Accounts
- General Ledger tables
- posting engine
- invoice auto-post
- payment auto-post
- refund auto-post
- GL inquiry UI

Reason:
This is the minimum viable accounting backbone.

### Phase C: Phase 2 Reporting

Build after GL:

- P&L
- Balance Sheet
- Cash Flow
- AR Aging

Reason:
Reports should read from accounting structure, not from ad hoc invoice queries only.

### Phase D: Phase 3 Treasury

- bank accounts
- bank statement import
- bank transaction matching
- reconciliation workflow

### Phase E: Phase 4 AP/PO

- supplier master
- purchase orders
- receiving
- supplier invoices
- AP payments

### Phase F: Phase 5 Profitability

- expenses
- branch P&L
- cost allocations
- laundry-specific costing

---

## 10. Priority Gap Ratings

| Gap | Severity | Why |
|---|---|---|
| No GL / COA | Critical | ERP-Lite cannot exist without accounting foundation |
| No ERP-Lite platform wiring | Critical | Cannot gate, sell, or navigate module |
| No auto-posting engine | Critical | Existing finance flows cannot feed accounting |
| No AP/PO | High | Limits Lite ERP to receivables-only scenario |
| No bank reconciliation | High | Weak finance completeness for owner/accountant personas |
| No financial reports | High | Product promise not met |
| No branch P&L / costing | Medium-High | Differentiator remains unrealized |
| No expenses | Medium | Important for later branch profitability and OpEx visibility |

---

## 11. Final Conclusion

CleanMateX has already built much of the **transactional operating system** that ERP-Lite needs:

- customer entities
- invoice/payment lifecycle
- receipts and vouchers
- branch structure
- stock control
- reporting patterns

That foundation is strong and materially reduces ERP-Lite implementation risk.

But the repo still lacks the core components that make a product an ERP-Lite finance module:

- accounting data model
- posting engine
- financial controls
- financial statements
- payable/procurement domain
- ERP-Lite-specific platform integration

### Practical Conclusion

CleanMateX is currently:

- **strongly prepared** for ERP-Lite implementation
- **not yet partially implemented** as ERP-Lite in the strict sense

The nearest path to a real ERP-Lite launch is:

1. platform wiring
2. COA + GL + auto-posting
3. financial statements + AR aging
4. bank reconciliation
5. AP/PO
6. expenses + branch profitability

---

## 12. Recommended Next Artifact

Use this report to produce a follow-up execution document with:

- module-by-module gap closure plan
- migration sequence
- service architecture
- UI route map
- permissions and feature-flag rollout order
- delivery estimates by phase

Suggested next document:

- `docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md`

