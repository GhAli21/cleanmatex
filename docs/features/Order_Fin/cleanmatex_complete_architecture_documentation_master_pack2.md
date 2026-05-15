# CleanMateX Complete Architecture Documentation Master Pack

## Document Purpose

This document defines the complete documentation architecture required for CleanMateX as a production-grade multi-tenant SaaS platform with financial, accounting, order-management, operational workflow, promotion, taxation, settlement, loyalty, wallet, gift card, and ERP posting capabilities.

This master pack acts as:

- Enterprise architecture source of truth
- Engineering governance reference
- AI assistant operational context
- Backend/frontend contract baseline
- Migration governance framework
- Finance/accounting reference model
- Implementation coordination document
- Operational readiness guide

---

# 1. Master Document Structure

```text
/docs
  /architecture
  /adr
  /prd
  /technical
  /database
  /api
  /security
  /finance
  /operations
  /testing
  /runbooks
  /ai-rules
  /ux
  /mobile
  /devops
  /compliance
  /events
  /errors
  /reconciliation
```

---

# 2. System Overview

CleanMateX is a production-grade multi-tenant SaaS platform for laundry, dry-cleaning, alterations, ironing, pickup/delivery, and related garment operations.

The platform supports:

- Customer-facing ordering
- Branch POS operations
- Operational garment tracking
- Financial settlement
- Accounting posting
- Invoice and AR management
- Loyalty and stored-value systems
- Tax and VAT handling
- Promotions and discounts
- Reconciliation and auditability

## Primary Actors

| Actor | Description |
|---|---|
| Customer | Creates orders and performs payments |
| Counter Staff | Handles POS and intake |
| Processing Staff | Handles garments/pieces |
| Driver | Pickup/delivery |
| Branch Manager | Operational approvals |
| Tenant Admin | Tenant configuration |
| HQ Admin | SaaS governance |
| Accountant | Financial review and posting |

## High-Level Domains

```text
Order Core
Piece Tracking
Preference Engine
Pricing Engine
Promotion Engine
Tax Engine
Settlement Engine
Stored Value Engine
Invoice / AR
Loyalty Engine
Accounting Posting
Reconciliation
Audit
```

## Architecture Style

```text
Modular Monolith
+ PostgreSQL/Supabase
+ Prisma ORM
+ Next.js frontend
+ Outbox events
+ Ledger-based financial architecture
+ Tenant-scoped ownership
```

## Core Runtime Principle

```text
Current checkout flow remains the stable transactional shell.
Normalized financial facts are added around it through phased migration.
```

---

# 3. Required Core Documents

## 3.1 Product Requirements Documents

```text
PRD_ORDER_MANAGEMENT.md
PRD_ORDER_FINANCIAL_PLATFORM.md
PRD_PIECE_TRACKING.md
PRD_PREFERENCE_ENGINE.md
PRD_PROMOTION_ENGINE.md
PRD_GIFT_CARD_PLATFORM.md
PRD_WALLET_PLATFORM.md
PRD_CUSTOMER_CREDIT_PLATFORM.md
PRD_CUSTOMER_ADVANCE_PLATFORM.md
PRD_LOYALTY_PLATFORM.md
PRD_TAX_ENGINE.md
PRD_PAYMENT_SETTLEMENT.md
PRD_INVOICE_AR.md
PRD_ACCOUNTING_POSTING.md
PRD_RECONCILIATION.md
PRD_MULTI_TENANCY.md
PRD_BRANCH_OPERATIONS.md
PRD_CUSTOMER_MOBILE_APP.md
PRD_STAFF_APP.md
PRD_DRIVER_APP.md
PRD_HQ_ADMIN_PLATFORM.md
PRD_TENANT_ADMIN_PLATFORM.md
```

Every PRD must contain:

```text
1. Executive Summary
2. Business Problem
3. Business Goals
4. Non-Goals
5. Personas
6. Actors
7. Functional Requirements
8. Non-Functional Requirements
9. Business Rules
10. User Stories
11. Acceptance Criteria
12. UI/UX Expectations
13. APIs Impacted
14. Database Impacted
15. Security Requirements
16. Audit Requirements
17. Reporting Requirements
18. Migration Considerations
19. Risks
20. Dependencies
21. Success Metrics
22. Rollout Strategy
```

---

# 4. Domain Rules

## Rule 1 — Gift Card

```text
Gift card is liability, not discount.
```

Correct:

```text
org_order_credit_apps_dtl
org_gift_card_txn_dtl
```

Wrong:

```text
discount_type = GIFT_CARD
```

## Rule 2 — Invoice

```text
Invoice is AR, not payment.
```

## Rule 3 — Wallet / Credit / Advance

```text
Wallet/customer credit/advance are stored-value applications, not payments.
```

## Rule 4 — Preferences

```text
Preferences are operational selections.
Charges are accounting facts.
```

## Rule 5 — Tax Timing

```text
Tax is calculated after charges/discounts and before credits/payments.
```

## Rule 6 — Payments

Payments represent:

```text
Real money collection only.
```

Allowed:

```text
CASH
CARD
CHECK
BANK_TRANSFER
PAYMENT_GATEWAY
```

---

# 5. Financial Formulas

## Main Settlement Formula

```text
gross_amount
+ total_charges_amount
- total_discount_amount
= net_before_tax_amount

net_before_tax_amount
+ total_tax_amount
= grand_total_amount

grand_total_amount
- total_credit_applied_amount
= net_receivable_amount

net_receivable_amount
- total_paid_amount
- invoice_ar_amount
= outstanding_amount
```

## Formula Definitions

| Variable | Meaning |
|---|---|
| gross_amount | Commercial item/service total |
| charges | Billable additions |
| discounts | Revenue reductions |
| taxes | VAT/other taxes |
| credits | Gift card/wallet/etc |
| payments | Real money |
| invoice_ar | Deferred receivable |
| outstanding | Remaining unpaid balance |

## Rounding Rules

Use:

```text
numeric(19,4)
```

Never use:

```text
float
double
```

---

# 6. Checkout Runtime Flow

```text
Customer/Staff creates order draft
  → frontend cart state

POST preview-payment
  → calculateOrderTotals()
  → no DB mutation
  → totals returned

User confirms checkout

POST create-with-payment
  → validate auth
  → validate tenant
  → validate permission
  → validate payload
  → validate idempotency
  → recalculate totals
  → compare clientTotals
  → if mismatch:
       return AMOUNT_MISMATCH
       no DB writes

  → validate credits/payments

  → prisma.$transaction:
       create org_orders_mst
       create org_order_items_dtl
       create org_order_item_pieces_dtl
       create org_order_preferences_dtl
       create org_order_charges_dtl
       create org_order_discounts_dtl
       create org_order_taxes_dtl
       create org_order_credit_apps_dtl
       create org_order_payments_dtl
       create invoice
       create audit logs
       create outbox events

  → commit
  → return response
```

---

# 7. Database Model

## Core Tables

### Order Summary

```text
org_orders_mst
```

Stores:

- Commercial snapshot
- Settlement snapshot
- Financial totals
- Outstanding values
- Operational status

### Commercial Lines

```text
org_order_items_dtl
```

Stores:

- Item pricing
- Quantity
- Taxability
- Line totals

### Physical Pieces

```text
org_order_item_pieces_dtl
```

Stores:

- Physical garment tracking
- Rack location
- Workflow status
- Barcode
- Rejection state

### Preferences

```text
org_order_preferences_dtl
```

Stores:

- Stains
- Damage
- Colors
- Packing
- Notes
- Service add-ons

### Charges

```text
org_order_charges_dtl
```

Stores:

- Preference charges
- Rush fees
- Delivery fees
- Handling fees
- Manual charges

### Discounts

```text
org_order_discounts_dtl
```

Stores:

- Manual discounts
- Promotions
- Coupons
- Loyalty discounts

### Taxes

```text
org_order_taxes_dtl
```

Stores:

- VAT snapshot
- Tax breakdown
- Taxable base

### Credit Applications

```text
org_order_credit_apps_dtl
```

Stores:

- Gift card applications
- Wallet applications
- Customer credit usage
- Advance usage
- Loyalty credit usage

### Payments

```text
org_order_payments_dtl
```

Stores:

- Cash
- Cards
- Checks
- Bank transfers
- Gateway payments

---

# 8. Settlement API Spec

## POST /api/client/v1/orders/:id/payments

### Purpose

Capture real-money settlement against an order.

### Request Example

```json
{
  "payments": [
    {
      "method": "CASH",
      "amount": 10
    },
    {
      "method": "CARD",
      "cardBrand": "VISA",
      "amount": 5
    }
  ],
  "credits": [
    {
      "type": "GIFT_CARD",
      "sourceId": "uuid",
      "amount": 5
    }
  ],
  "idempotencyKey": "abc123"
}
```

### Runtime Rules

```text
Payments = real money only.
Credits = stored-value applications.
```

### Validation

- order exists
- tenant matches
- order not closed
- idempotency valid
- gift card active
- wallet balance sufficient
- customer credit sufficient
- no negative values

### Success Response

```json
{
  "success": true,
  "outstandingAmount": 0,
  "settlementStatus": "SETTLED"
}
```

---

# 9. Reconciliation Strategy

## Philosophy

Every financial summary must reconcile with:

```text
charges details
discount details
tax details
credit applications
payment rows
ledger balances
invoice balances
```

## Mandatory Checks

```text
sum(charges) = order.total_charges_amount
sum(discounts) = order.total_discount_amount
sum(taxes) = order.total_tax_amount
sum(credits) = order.total_credit_applied_amount
sum(payments) = order.total_paid_amount
```

## Reconciliation Severity

| Severity | Meaning |
|---|---|
| INFO | cosmetic issue |
| WARNING | requires review |
| BLOCKER | financial inconsistency |

## Migration Rule

```text
No feature-flag read switch before reconciliation passes.
```

---

# 10. Migration Phases

## Migration Strategy

```text
expand
→ dual-write
→ reconcile
→ switch-read
→ retire
```

## Phase 1 — Audit

Deliver:

- schema discovery
- current flow analysis
- risk analysis
- migration planning

## Phase 2 — Add Tables

Add:

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_credit_apps_dtl
org_order_payments_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
```

No behavior change.

## Phase 3 — Add Summary Columns

Enhance:

```text
org_orders_mst
```

with financial snapshots.

## Phase 4 — Charges

Dual-write chargeable preferences.

## Phase 5 — Discounts

Dual-write promotions and discounts.

## Phase 6 — Taxes

Write normalized tax rows.

## Phase 7 — Payments

Normalize payment rows.

## Phase 8 — Stored Value

Implement:

```text
gift cards
wallet
customer credits
advances
```

---

# 11. AI Assistant Rules

## Never

```text
Never rewrite checkout.
Never remove AMOUNT_MISMATCH.
Never trust frontend totals.
Never treat gift card as discount.
Never treat invoice as payment.
Never remove old fields early.
```

## Always

```text
Always preserve transaction boundaries.
Always use tenant_org_id.
Always support reconciliation.
Always use idempotency.
Always dual-write before switch-read.
```

---

# 12. Accounting Event Catalog

| Event | Description |
|---|---|
| ORDER_CONFIRMED | Revenue recognition candidate |
| ORDER_PAYMENT_RECEIVED | Cash settlement |
| ORDER_INVOICED | AR creation |
| GIFT_CARD_REDEEMED | Liability reduction |
| WALLET_APPLIED | Liability settlement |
| ADVANCE_APPLIED | Advance liability settlement |
| CUSTOMER_CREDIT_APPLIED | Customer liability settlement |
| TAX_RECOGNIZED | VAT liability recognition |
| ORDER_REFUNDED | Refund accounting |

---

# 13. Event Catalog

```text
OrderCreated
OrderConfirmed
OrderPiecesGenerated
OrderPreferenceAdded
OrderChargeCreated
OrderDiscountApplied
OrderTaxCalculated
OrderPaymentCaptured
OrderCreditApplied
OrderInvoiced
OrderRefunded
AccountingPostingRequested
AccountingPosted
```

---

# 14. Error Catalog

| Error Code | Meaning |
|---|---|
| AMOUNT_MISMATCH | Client/server totals mismatch |
| GIFT_CARD_EXPIRED | Gift card expired |
| GIFT_CARD_SUSPENDED | Gift card suspended |
| WALLET_INSUFFICIENT_BALANCE | Wallet insufficient |
| CREDIT_LIMIT_EXCEEDED | Credit limit exceeded |
| TAX_CONFIGURATION_MISSING | Tax rules missing |
| IDEMPOTENCY_CONFLICT | Duplicate request |
| PAYMENT_CAPTURE_FAILED | Gateway/payment failure |

---

# 15. RBAC Model

## Main Permission Domains

```text
orders:*
payments:*
refunds:*
promotions:*
giftcards:*
wallet:*
loyalty:*
invoices:*
accounting:*
reconciliation:*
```

---

# 16. ADRs Required

```text
ADR_001_MODULAR_MONOLITH.md
ADR_002_LEDGER_BASED_FINANCE.md
ADR_003_DUAL_WRITE_MIGRATION.md
ADR_004_OUTBOX_PATTERN.md
ADR_005_POSTGRESQL_SUPABASE.md
ADR_006_PRISMA_ORM.md
ADR_007_TENANT_ISOLATION.md
ADR_008_RLS_STRATEGY.md
ADR_009_FINANCIAL_SUMMARY_SNAPSHOTS.md
ADR_010_PIECE_TRACKING_MODEL.md
ADR_011_PROMOTION_ENGINE_STRATEGY.md
ADR_012_TAX_CALCULATION_STRATEGY.md
ADR_013_IDEMPOTENCY_STRATEGY.md
ADR_014_RECONCILIATION_FIRST_MIGRATION.md
ADR_015_EVENT_DRIVEN_POSTING.md
ADR_016_FEATURE_FLAG_STRATEGY.md
ADR_017_MULTI_PAYMENT_STRATEGY.md
ADR_018_STORED_VALUE_ARCHITECTURE.md
ADR_019_AUDIT_LOGGING_STRATEGY.md
ADR_020_RUNTIME_CALCULATION_RULES.md
```

---

# 17. Testing Requirements

Mandatory tests:

```text
AMOUNT_MISMATCH
Duplicate idempotency requests
Gift card double redemption
Wallet insufficient balance
Tax recalculation
Multi-payment reconciliation
Refund reversal
Partial payment
Pay-on-collection
Invoice outstanding
Transaction rollback
Tenant isolation
```

---

# 18. Final Governance Rule

```text
The current checkout route is the stable transactional shell.
The migration strategy is to gradually add normalized financial facts around it without breaking operational continuity.
```

# 19. Final Enterprise Rule

```text
No developer, AI assistant, migration, feature, or refactor is allowed to violate domain rules, financial formulas, reconciliation guarantees, tenant isolation, transaction integrity, or accounting truth.
```
