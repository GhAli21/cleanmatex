---
version: v1.0.0
last_updated: 2026-03-27
author: CleanMateX AI Assistant
document_id: ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT_2026_03_27
status: Draft
---

# ERP-Lite Validated Scope and Decision Report

## 1. Purpose

This document converts earlier ERP-Lite brainstorming into a decision-grade product scope artifact.

It is based on:

- the current CleanMateX repo state
- the ERP-Lite gap analysis
- the existing operational, billing, inventory, B2B, branch, and reporting foundations
- the practical needs of small and medium laundry businesses that may not already have an external ERP

This document should be treated as a **validated product direction proposal**, not a brainstorming note.

---

## 2. Decision Summary

### Strategic Decision

CleanMateX should offer **Laundry ERP-Lite** as an optional tenant-facing add-on for customers who do not already have an ERP.

### Product Positioning

ERP-Lite is **not** intended to become a generic full ERP.

It should be positioned as:

`Finance and operational control for laundries that need basic accounting, receivables visibility, procurement control, and branch profitability inside CleanMateX.`

### Main Product Rule

ERP-Lite should only cover what is necessary to run and financially control a laundry business inside CleanMateX.

If a function is:

- commodity,
- country-specific,
- highly compliance-heavy,
- or better handled by mature external software,

then CleanMateX should prefer:

- integration,
- export,
- or deferral,

instead of building it into v1.

---

## 3. Business Problem

### Original Problem

Some customers will want ERP integration.

But many target customers:

- are small or mid-sized laundries
- operate with spreadsheets, ad hoc bookkeeping, or informal processes
- do not already use an ERP
- still need basic finance, control, and reporting

### If CleanMateX Only Integrates With External ERP

Then these customers face a gap:

- they can run laundry operations
- but they cannot manage finance control well enough inside the platform
- they may delay adoption
- or they may adopt another system that gives both operations and light finance control

### Why ERP-Lite Matters

ERP-Lite closes the operational-to-financial gap without forcing the customer to buy or integrate a full ERP from day one.

That improves:

- product-market fit for smaller laundries
- expansion revenue
- retention
- operational stickiness

---

## 4. Scope Decision Principles

The following principles should govern ERP-Lite scope decisions.

### Principle 1: Laundry-First, Not Generic ERP-First

Build what laundries actually need first:

- receivables visibility
- payments and cash control
- consumables procurement
- basic expense control
- branch visibility
- profitability insight

Do not build broad ERP modules just because they exist in generic ERP products.

### Principle 2: Build the Accounting Backbone Before Expanding Breadth

If ERP-Lite is approved, the first build priority must be:

- chart of accounts
- general ledger
- posting engine

Without that, the rest becomes fragmented operational finance rather than coherent ERP-Lite.

### Principle 3: Reuse Existing CleanMateX Transactions as Accounting Sources

Do not duplicate operational documents unnecessarily.

Existing sources should remain canonical where appropriate:

- invoices
- payments
- refunds
- B2B statements
- branch-linked inventory events

ERP-Lite should consume these through posting and reporting layers.

### Principle 4: Keep ERP-Lite Optional

A tenant must be able to:

- run CleanMateX operations only
- run operations plus ERP-Lite
- run operations plus external ERP integration/export

ERP-Lite must not become a hard dependency for the core product.

### Principle 5: Avoid Jurisdiction-Specific Compliance Depth in v1

ERP-Lite v1 should support business control and internal books.

It should not promise:

- statutory tax filing
- local payroll compliance
- advanced audit/legal compliance packs
- complex multi-entity consolidation

---

## 5. Target Customer Segments

### Primary Segment

Small to medium laundry businesses that:

- operate one or several branches
- manage customer billing and collections internally
- do not use a formal ERP
- need visibility into outstanding balances, branch performance, and expenses

### Secondary Segment

Laundries with external accountants that:

- want internal operational finance control
- want daily books and visibility inside CleanMateX
- still export to external accountant tools periodically

### Not Primary for v1

- large enterprises needing full finance suites
- complex holding groups
- heavily regulated finance operations
- customers expecting full SAP/Odoo-class ERP depth

---

## 6. Repo-Based Reality Check

### Already Strong Foundations

CleanMateX already implements major foundations required by ERP-Lite:

- customer management
- B2B customer structures
- invoices
- payments
- refunds
- receipts
- vouchers
- cash-up reconciliation
- branch-aware inventory stock
- branch-aware operations
- invoice/payment/customer reporting

### Current Limitation

These foundations do **not** yet constitute ERP-Lite.

The repo still lacks:

- chart of accounts
- general ledger
- accounting posting engine
- ERP-Lite feature flags and permissions in active code
- AP/PO modules
- bank reconciliation data model
- branch profitability model

### Product Implication

ERP-Lite should be approved only if CleanMateX is willing to build the accounting backbone first.

Otherwise the result will be a collection of finance-adjacent screens, not a real Lite ERP.

---

## 7. Approved Candidate Scope for ERP-Lite v1

This section defines the recommended approved v1 candidate scope.

### 7.1 Must-Have v1 Scope

#### A. Chart of Accounts

Why included:

- minimum accounting structure
- required for all meaningful finance reporting
- needed to turn invoices and payments into books

Decision:

- Build in v1

#### B. General Ledger and Posting Engine

Why included:

- turns current billing flows into accounting entries
- enables balanced journals
- provides auditability and reversals

Decision:

- Build in v1

#### C. Auto-Post From Existing Documents

Posting sources for v1:

- invoices
- payments
- refunds / reversals

Why included:

- maximum leverage from existing implementation
- avoids duplicate document entry
- fastest path to usable ERP-Lite value

Decision:

- Build in v1

#### D. AR Aging

Why included:

- immediately useful for tenants with B2B and credit customers
- strongly aligned with current invoicing and customer foundation
- high business value with moderate complexity

Decision:

- Build in v1

#### E. Core Financial Reports

Recommended minimum reports:

- trial balance
- profit and loss
- balance sheet

Optional for late v1 or v1.1:

- simplified cash flow

Why included:

- without reports, ERP-Lite has weak business value
- these are core owner/accountant outputs

Decision:

- Build in v1

#### F. ERP-Lite Platform Enablement

Required platform pieces:

- feature flags
- permissions
- navigation
- settings
- i18n namespace

Why included:

- required for safe rollout and subscription packaging

Decision:

- Build in v1

#### G. Basic Expenses

Included scope for v1:

- simple expense voucher entry
- expense category selection
- branch assignment where applicable
- petty cash expense entry
- petty cash top-up entry
- basic petty cash running balance
- posting to expense accounts and cash/bank/payable account as configured
- basic expense listing and filtering

Explicitly not included in v1 basic expenses:

- approval workflow
- reimbursement workflow
- attachment-heavy claims process
- advanced allocations
- policy enforcement engine
- formal petty cash custodian workflow
- petty cash reconciliation workflow
- inter-branch petty cash controls

Why included:

- gives immediate practical value to small laundry owners without requiring full AP maturity
- supports early operational cost visibility
- strengthens later branch profitability foundation

Decision:

- Build in v1 as a simplified expense entry module

---

### 7.2 Should-Have v1.5 / Phase 2 Scope

#### A. Bank Reconciliation

Why not v1 core:

- important, but requires separate data import and matching model
- can delay launch if bundled too early

Why still high priority:

- strong value for owners and accountants
- natural next step after GL

Decision:

- Approve for Phase 2, not day-one v1

#### B. Supplier Master

Why included after v1:

- necessary for AP/PO
- also useful for inventory replenishment

Decision:

- Build in Phase 2 alongside procurement/payables

#### C. Purchase Orders

Why deferred:

- not required to launch core accounting and AR
- better after supplier master and GL foundation

Decision:

- Build in Phase 2

#### D. Accounts Payable

Why deferred:

- important, but v1 can still provide real value as receivables-first finance module
- requires supplier lifecycle and payment posting rules

Decision:

- Build in Phase 2

---

### 7.3 Strategic Differentiator Scope for Phase 3

#### A. Branch P&L

Why valuable:

- directly useful for multi-branch laundry businesses
- much more domain-relevant than generic ERP breadth

Why not early:

- misleading without a cost model

Decision:

- Build only after expenses and cost allocations are credible

#### B. Advanced Expense Management

Scope in this phase:

- approval workflow
- reimbursement handling
- richer categorization and policy controls
- branch allocation rules
- optional attachment and claim workflow
- formal petty cash management
- petty cash custodian controls
- petty cash reconciliation and review

Why valuable:

- supports profitability and branch control
- extends basic expense capture into a controlled finance process

Decision:

- Build in Phase 3 after basic expenses already exist in v1

#### C. Laundry-Specific Costing

Examples:

- consumables per order or per kg
- route/delivery cost allocation
- labor allocation
- branch-level indirect cost allocation

Why valuable:

- strongest long-term differentiator
- much harder for generic ERP tools to match cleanly

Decision:

- Strategic Phase 3+ item

---

## 8. Explicitly Excluded From ERP-Lite v1

The following should be explicitly excluded to prevent scope drift.

### Excluded

- payroll
- fixed assets
- manufacturing / MRP
- full tax engine
- tax filing and statutory compliance packs
- multi-company consolidation
- intercompany accounting
- advanced budgeting
- asset depreciation engine
- full treasury suite
- supplier portal
- deep procurement approvals matrix
- advanced inventory valuation methods beyond what v1 actually needs

Note:
Basic expense entry is not excluded from v1. Only advanced expense workflow depth is excluded.
Basic petty cash entry is also not excluded from v1. Only advanced petty cash control is excluded.

### Why Excluded

These functions:

- are not necessary to win the initial ERP-Lite use case
- create long delivery timelines
- increase accounting and compliance complexity
- dilute laundry-specific value

---

## 9. Build vs Integrate vs Export Decisions

### Build Inside CleanMateX

Approve build for:

- chart of accounts
- general ledger
- invoice/payment/refund auto-posting
- AR aging
- core financial reports
- basic expenses
- basic petty cash
- supplier master
- AP/PO basic workflow
- advanced expenses
- advanced petty cash controls
- branch profitability

### Integrate or Export

Prefer integration/export for:

- external accountant tools
- advanced tax/compliance workflows
- country-specific payroll
- advanced bank feeds where CSV import is not enough
- enterprise BI beyond operational and branch finance views

### Decision Rule

If the feature is:

- generic,
- compliance-heavy,
- or not laundry-differentiating,

then integration or export should be preferred over native build.

---

## 10. Product Packaging Recommendation

### Recommended Packaging

#### Tier A: Core Operations

- customers
- orders
- workflow
- invoices
- payments
- receipts
- inventory stock
- delivery

#### Tier B: ERP-Lite Core

- chart of accounts
- general ledger
- auto-posting
- AR aging
- trial balance
- P&L
- balance sheet
- basic expenses
- basic petty cash

#### Tier C: ERP-Lite Advanced

- bank reconciliation
- supplier master
- purchase orders
- accounts payable
- advanced expenses
- advanced petty cash controls
- branch P&L

### Why This Packaging Works

- aligns with actual development phases
- matches different customer maturity levels
- avoids forcing small customers into unnecessary modules
- creates clearer expansion revenue path

---

## 11. Architecture Direction Decision

### Approved Direction

ERP-Lite should be built as a **modular finance layer on top of current operational transactions**.

### Architectural Rules

#### Rule 1

Existing operational documents remain the source of truth where already established:

- `org_invoice_mst`
- `org_payments_dtl_tr`
- refund and voucher flows

#### Rule 2

ERP-Lite adds:

- accounting structures
- posting services
- finance inquiry/reporting
- optional procurement/payables domains

#### Rule 3

Accounting posting logic must live in services/use-cases, not in UI pages or thin route glue.

#### Rule 4

Posted accounting records must be immutable except by reversal/adjustment pattern.

#### Rule 5

ERP-Lite must remain tenant-scoped and branch-aware where relevant.

---

## 12. Approved MVP Definition

### ERP-Lite MVP

The recommended MVP is:

- ERP-Lite feature flags and permissions
- Finance & Accounting navigation shell
- Chart of Accounts
- General Ledger
- invoice auto-posting
- payment auto-posting
- refund/reversal posting
- basic expense entry
- basic petty cash entry and top-up
- trial balance
- profit and loss
- balance sheet
- AR aging

### Why This Is the Correct MVP

This gives a customer without ERP:

- internal books foundation
- receivables visibility
- basic operating expense capture
- basic petty cash visibility
- financial reporting
- reuse of current CleanMateX operational flows

Without this, the product is still mostly operational billing, not ERP-Lite.

---

## 13. Deferred Scope

### Defer to Phase 2

- bank reconciliation
- supplier master
- purchase orders
- AP

### Defer to Phase 3

- advanced expenses
- advanced petty cash controls
- branch P&L
- laundry-specific costing

### Defer to Later or Integration

- payroll
- fixed assets
- advanced compliance
- advanced treasury
- enterprise BI depth

---

## 14. Go / No-Go Recommendation

### Recommendation

`Go`, but only under these conditions:

1. CleanMateX commits to building the accounting backbone first
2. ERP-Lite scope is kept narrow and laundry-relevant
3. v1 excludes full ERP breadth
4. integration/export remains part of the strategy for advanced needs

### No-Go Conditions

Do **not** proceed if the intention is:

- to build generic ERP breadth before accounting backbone
- to ship branch profitability without cost logic
- to promise full compliance-heavy finance features early
- to treat existing billing screens as if ERP-Lite is already mostly done

---

## 15. Final Product Decision

### Decision Statement

CleanMateX should move forward with **Laundry ERP-Lite** as an optional add-on.

But the approved direction is:

- **v1 = accounting backbone + receivables reporting + basic expenses + basic petty cash**
- **v2 = bank + supplier/payables/procurement**
- **v3 = advanced expenses + advanced petty cash controls + branch profitability + laundry-specific costing**

This is the highest-signal, lowest-regret path.

It uses what CleanMateX already built, avoids false ERP breadth, and creates a credible route from operations platform to finance-enabled laundry system.

---

## 16. Recommended Next Document

The next artifact should be:

- `docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md`

That document should include:

- approved phase breakdown
- schema sequence
- feature flag and permission rollout
- API and service boundaries
- UI route map
- posting engine architecture
- dependency order
- estimate by phase
