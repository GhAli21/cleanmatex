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

# 1. MASTER DOCUMENT STRUCTURE

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

# 2. REQUIRED CORE DOCUMENTS

# 2.1 Product Requirements Documents (PRDs)

## Required PRDs

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

## PRD Standard Structure

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

# 2.2 Architecture Decision Records (ADRs)

## Required ADRs

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

## ADR Standard Structure

```text
1. Status
2. Context
3. Problem
4. Decision
5. Alternatives Considered
6. Pros
7. Cons
8. Operational Impact
9. Security Impact
10. Migration Impact
11. Future Considerations
```

---

# 2.3 System Architecture Documents

## Required Documents

```text
SYSTEM_OVERVIEW.md
SYSTEM_CONTEXT_DIAGRAM.md
BOUNDED_CONTEXTS.md
SERVICE_BOUNDARIES.md
RUNTIME_ARCHITECTURE.md
EVENT_ARCHITECTURE.md
CHECKOUT_RUNTIME_FLOW.md
SETTLEMENT_RUNTIME_FLOW.md
POSTING_RUNTIME_FLOW.md
PROMOTION_RUNTIME_FLOW.md
TAX_RUNTIME_FLOW.md
```

## Mandatory Architecture Sections

```text
1. High-Level Architecture
2. Bounded Contexts
3. Transaction Boundaries
4. Domain Ownership
5. Service Interactions
6. Data Ownership
7. Event Flow
8. Security Zones
9. Integration Points
10. Async Processing
11. Failure Recovery
12. Scalability Strategy
13. Multi-Tenancy Model
14. Audit Model
15. Reconciliation Model
```

---

# 3. DATABASE DOCUMENTATION

# 3.1 Required Database Docs

```text
DATABASE_OVERVIEW.md
DATABASE_NAMING_CONVENTIONS.md
DATABASE_INDEXING_GUIDE.md
DATABASE_PARTITIONING_GUIDE.md
DATABASE_AUDIT_STRATEGY.md
DATABASE_RLS_STRATEGY.md
DATABASE_MIGRATION_STRATEGY.md
DATABASE_RETENTION_POLICY.md
DATABASE_BACKUP_STRATEGY.md
```

---

# 3.2 Financial Database Docs

```text
DB_ORDER_FINANCIAL_MODEL.md
DB_SETTLEMENT_MODEL.md
DB_STORED_VALUE_MODEL.md
DB_PROMOTION_MODEL.md
DB_TAX_MODEL.md
DB_LOYALTY_MODEL.md
DB_ACCOUNTING_POSTING_MODEL.md
DB_RECONCILIATION_MODEL.md
```

---

# 3.3 ERD Documentation

## Required ERDs

```text
ERD_ORDER_CORE
ERD_PIECE_TRACKING
ERD_PREFERENCE_ENGINE
ERD_PROMOTION_ENGINE
ERD_TAX_ENGINE
ERD_SETTLEMENT_ENGINE
ERD_GIFT_CARD_PLATFORM
ERD_WALLET_PLATFORM
ERD_CUSTOMER_CREDIT_PLATFORM
ERD_LOYALTY_PLATFORM
ERD_INVOICE_AR
ERD_ACCOUNTING_POSTING
ERD_RECONCILIATION
```

## Each ERD Must Define

```text
1. Ownership
2. Cardinality
3. FK strategy
4. Tenant isolation
5. Cascade strategy
6. Audit strategy
7. Soft-delete rules
8. Archival rules
9. Reconciliation dependencies
```

---

# 4. FINANCIAL AND ACCOUNTING DOCUMENTATION

# 4.1 Financial Formula Documents

## Required Docs

```text
FINANCIAL_FORMULAS.md
DISCOUNT_CALCULATION_RULES.md
TAX_CALCULATION_RULES.md
ROUNDING_RULES.md
SETTLEMENT_RULES.md
OUTSTANDING_BALANCE_RULES.md
PAY_ON_COLLECTION_RULES.md
```

## Mandatory Formula Sections

```text
1. Formula Name
2. Formula Expression
3. Input Variables
4. Precision Rules
5. Rounding Rules
6. Tax Timing
7. Discount Timing
8. Currency Handling
9. Reconciliation Expectations
10. Edge Cases
```

---

# 4.2 Accounting Documents

## Required Docs

```text
ACCOUNTING_EVENT_CATALOG.md
POSTING_MAPPING_RULES.md
ACCOUNTING_RESOLVER_RULES.md
ACCOUNTING_VOUCHER_GENERATION.md
ACCOUNTING_REVERSAL_RULES.md
ACCOUNTING_RECONCILIATION.md
ACCOUNTING_ERROR_HANDLING.md
```

## Accounting Event Examples

```text
ORDER_CONFIRMED
ORDER_PAYMENT_RECEIVED
ORDER_INVOICED
ORDER_REFUNDED
GIFT_CARD_REDEEMED
WALLET_APPLIED
ADVANCE_APPLIED
CUSTOMER_CREDIT_APPLIED
LOYALTY_REDEEMED
PROMOTION_DISCOUNT_APPLIED
TAX_RECOGNIZED
```

---

# 5. API DOCUMENTATION

# 5.1 Required API Docs

```text
API_OVERVIEW.md
API_AUTHENTICATION.md
API_AUTHORIZATION.md
API_IDEMPOTENCY.md
API_ERROR_MODEL.md
API_VERSIONING.md
API_RATE_LIMITING.md
```

---

# 5.2 Domain API Specs

```text
API_ORDERS.md
API_PIECES.md
API_PREFERENCES.md
API_PROMOTIONS.md
API_TAX.md
API_SETTLEMENT.md
API_PAYMENTS.md
API_GIFT_CARDS.md
API_WALLET.md
API_CUSTOMER_CREDIT.md
API_ADVANCES.md
API_LOYALTY.md
API_INVOICES.md
API_REFUNDS.md
API_POSTING.md
```

## Every API Spec Must Include

```text
1. Endpoint
2. Method
3. Authentication
4. Authorization
5. Request Schema
6. Response Schema
7. Validation Rules
8. Idempotency Rules
9. Error Codes
10. Retry Rules
11. Audit Behavior
12. Event Publishing
13. Reconciliation Impact
14. Security Considerations
```

---

# 6. DOMAIN RULE DOCUMENTATION

# 6.1 Required Domain Rule Docs

```text
DOMAIN_RULES_GLOBAL.md
DOMAIN_RULES_ORDERS.md
DOMAIN_RULES_SETTLEMENT.md
DOMAIN_RULES_PROMOTIONS.md
DOMAIN_RULES_TAX.md
DOMAIN_RULES_LOYALTY.md
DOMAIN_RULES_ACCOUNTING.md
DOMAIN_RULES_STORED_VALUE.md
```

## Mandatory Rules Examples

```text
Gift card is liability not discount.
Invoice is AR not payment.
Wallet/customer credit/advance are stored-value applications not payments.
Preferences are operational selections not accounting facts.
Charges are financial facts.
Tax occurs before credits/payments.
Payments represent real money collection only.
```

---

# 7. RUNTIME FLOW DOCUMENTATION

# Required Runtime Flows

```text
FLOW_ORDER_CREATION.md
FLOW_ORDER_CONFIRMATION.md
FLOW_CHECKOUT.md
FLOW_MULTI_PAYMENT.md
FLOW_PAY_ON_COLLECTION.md
FLOW_GIFT_CARD_REDEMPTION.md
FLOW_WALLET_APPLICATION.md
FLOW_CUSTOMER_CREDIT_APPLICATION.md
FLOW_ADVANCE_APPLICATION.md
FLOW_PROMOTION_EVALUATION.md
FLOW_TAX_CALCULATION.md
FLOW_REFUND.md
FLOW_RECONCILIATION.md
FLOW_POSTING.md
FLOW_REVERSAL.md
```

## Runtime Flow Standard

```text
1. Trigger
2. Preconditions
3. Validation
4. Transaction Start
5. Main Steps
6. DB Writes
7. Events Emitted
8. Rollback Behavior
9. Retry Rules
10. Failure Handling
11. Reconciliation Impact
12. Audit Impact
```

---

# 8. SECURITY DOCUMENTATION

# Required Security Docs

```text
SECURITY_OVERVIEW.md
RBAC_MODEL.md
TENANT_ISOLATION.md
RLS_POLICY_GUIDE.md
SECRETS_MANAGEMENT.md
CSRF_STRATEGY.md
PAYMENT_SECURITY.md
AUDIT_LOGGING.md
DATA_ACCESS_POLICY.md
```

## Mandatory Security Sections

```text
1. Authentication
2. Authorization
3. Tenant Isolation
4. Row-Level Security
5. Audit Logging
6. Sensitive Data Handling
7. Payment Data Rules
8. Encryption Strategy
9. Secrets Rotation
10. Session Handling
11. API Protection
12. Threat Model
```

---

# 9. RECONCILIATION DOCUMENTATION

# Required Docs

```text
RECONCILIATION_STRATEGY.md
RECONCILIATION_RUNBOOK.md
RECONCILIATION_QUERIES.md
RECONCILIATION_ALERTS.md
RECONCILIATION_FAILURE_HANDLING.md
```

## Reconciliation Categories

```text
Charges reconciliation
Discount reconciliation
Tax reconciliation
Payment reconciliation
Stored-value reconciliation
Invoice reconciliation
Accounting reconciliation
Ledger reconciliation
```

## Mandatory Reconciliation Rules

```text
No switch-read before reconciliation passes.
All detail totals must reconcile with order summary.
All stored-value balances must reconcile with ledgers.
```

---

# 10. TESTING DOCUMENTATION

# Required Docs

```text
TESTING_STRATEGY.md
UNIT_TEST_GUIDELINES.md
INTEGRATION_TEST_GUIDELINES.md
E2E_TEST_GUIDELINES.md
FINANCIAL_TEST_SCENARIOS.md
LOAD_TESTING.md
CHAOS_TESTING.md
ROLLBACK_TESTING.md
```

## Mandatory Financial Tests

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
```

---

# 11. OPERATIONS DOCUMENTATION

# Required Docs

```text
OPERATIONS_OVERVIEW.md
DEPLOYMENT_RUNBOOK.md
ROLLBACK_RUNBOOK.md
INCIDENT_RESPONSE.md
OBSERVABILITY_GUIDE.md
MONITORING_GUIDE.md
ALERTING_GUIDE.md
SCALING_GUIDE.md
```

## Mandatory Operational Areas

```text
1. Deployments
2. Rollbacks
3. Monitoring
4. Metrics
5. Logs
6. Traces
7. Alerts
8. Capacity
9. Database Maintenance
10. Incident Recovery
```

---

# 12. DEVOPS DOCUMENTATION

# Required Docs

```text
DEVOPS_ARCHITECTURE.md
CI_CD_PIPELINES.md
ENVIRONMENT_STRATEGY.md
BACKUP_AND_RESTORE.md
DISASTER_RECOVERY.md
KUBERNETES_ARCHITECTURE.md
SECRETS_AND_CONFIG.md
```

## Environment Strategy

```text
local
integration
staging
production
hq-production
tenant-production
```

---

# 13. EVENT DOCUMENTATION

# Required Docs

```text
EVENT_CATALOG.md
OUTBOX_STRATEGY.md
EVENT_RETRY_POLICY.md
EVENT_VERSIONING.md
EVENT_PAYLOAD_CONTRACTS.md
```

## Event Standard

```text
1. Event Name
2. Aggregate Type
3. Trigger
4. Payload Schema
5. Publisher
6. Consumers
7. Retry Rules
8. Ordering Rules
9. Idempotency Rules
10. Failure Handling
```

---

# 14. ERROR DOCUMENTATION

# Required Docs

```text
ERROR_CATALOG.md
ERROR_HANDLING_STRATEGY.md
ERROR_RESPONSE_MODEL.md
```

## Mandatory Error Definitions

```text
AMOUNT_MISMATCH
INSUFFICIENT_WALLET_BALANCE
GIFT_CARD_EXPIRED
GIFT_CARD_SUSPENDED
PAYMENT_CAPTURE_FAILED
PROMOTION_NOT_ELIGIBLE
TAX_CONFIGURATION_MISSING
RECONCILIATION_FAILURE
POSTING_VALIDATION_FAILED
IDEMPOTENCY_CONFLICT
```

## Error Standard

```text
1. Error Code
2. HTTP Status
3. Description
4. User Message
5. Retryability
6. Severity
7. Audit Requirement
8. Alert Requirement
```

---

# 15. AI ASSISTANT DOCUMENTATION

# Required Docs

```text
AI_ASSISTANT_RULES.md
CLAUDE.md
AGENTS.md
CURSOR_RULES.mdc
MIGRATION_GUARDRAILS.md
NO_BREAK_RULES.md
```

## Mandatory AI Rules

```text
Do not rewrite checkout.
Do not remove AMOUNT_MISMATCH.
Do not treat gift card as discount.
Do not treat invoice as payment.
Use expand → dual-write → reconcile → switch-read → retire.
Never remove old fields before reconciliation.
Always preserve tenant isolation.
Always preserve transaction boundaries.
```

---

# 16. UX / UI DOCUMENTATION

# Required Docs

```text
UX_ORDER_FLOW.md
UX_CHECKOUT_FLOW.md
UX_SPLIT_PAYMENT.md
UX_PAY_ON_COLLECTION.md
UX_REFUND_FLOW.md
UX_PIECE_TRACKING.md
UX_PREFERENCE_SELECTION.md
UX_PROMOTION_APPLICATION.md
```

## UI State Machines

```text
ORDER_STATUS_STATE_MACHINE.md
PAYMENT_STATUS_STATE_MACHINE.md
INVOICE_STATUS_STATE_MACHINE.md
PIECE_STATUS_STATE_MACHINE.md
REFUND_STATUS_STATE_MACHINE.md
```

---

# 17. MOBILE DOCUMENTATION

# Required Docs

```text
MOBILE_ARCHITECTURE.md
MOBILE_API_STRATEGY.md
MOBILE_OFFLINE_STRATEGY.md
MOBILE_SYNC_STRATEGY.md
MOBILE_SECURITY.md
```

## Mobile Apps

```text
Customer App
Staff App
Driver App
```

---

# 18. COMPLIANCE DOCUMENTATION

# Required Docs

```text
VAT_COMPLIANCE.md
DATA_RETENTION_POLICY.md
AUDIT_COMPLIANCE.md
FINANCIAL_RECORD_RETENTION.md
PRIVACY_POLICY_ARCHITECTURE.md
```

## Mandatory Compliance Areas

```text
Invoice retention
Tax retention
Audit immutability
Payment history
Refund traceability
Customer consent
Data deletion policy
```

---

# 19. IMPLEMENTATION GOVERNANCE

# Required Governance Docs

```text
IMPLEMENTATION_ROADMAP.md
SPRINT_STRATEGY.md
MIGRATION_PHASES.md
RELEASE_STRATEGY.md
FEATURE_FLAG_STRATEGY.md
```

## Required Migration Strategy

```text
expand
→ dual-write
→ reconcile
→ switch-read
→ retire
```

---

# 20. PRIORITY ORDER FOR CLEANMATEX

# Highest Priority Documents

```text
1. SYSTEM_OVERVIEW
2. DOMAIN_RULES_GLOBAL
3. DB_ORDER_FINANCIAL_MODEL
4. FINANCIAL_FORMULAS
5. CHECKOUT_RUNTIME_FLOW
6. API_SETTLEMENT
7. RECONCILIATION_STRATEGY
8. ACCOUNTING_EVENT_CATALOG
9. MIGRATION_PHASES
10. AI_ASSISTANT_RULES
```

---

# 21. FINAL ARCHITECTURAL GOVERNANCE RULE

```text
CleanMateX architecture must preserve the current transactional checkout shell while gradually introducing normalized financial facts, ledger-based stored value, reconciliation-first migration, and event-driven accounting integration through controlled phased evolution.
```

---

# 22. FINAL ENTERPRISE RULE

```text
No developer, AI assistant, migration, feature, or refactor is allowed to violate domain rules, financial formulas, reconciliation guarantees, tenant isolation, transaction integrity, or accounting truth.
```

---

# 23. REAL DOCUMENTS — PRODUCTION CONTENT

# SYSTEM_OVERVIEW.md

## Purpose

CleanMateX is a production-grade multi-tenant SaaS platform for laundry, dry-cleaning, alterations, ironing, pickup/delivery, and related garment operations.

The platform supports:

- customer-facing ordering
- branch POS operations
- operational garment tracking
- financial settlement
- accounting posting
- invoice and AR management
- loyalty and stored-value systems
- tax and VAT handling
- promotions and discounts
- reconciliation and auditability

---

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

---

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

---

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

---

## Core Runtime Principle

```text
Current checkout flow remains the stable transactional shell.
Normalized financial facts are added around it through phased migration.
```

---

# DOMAIN_RULES_GLOBAL.md

# Financial Truth Rules

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

---

## Rule 2 — Invoice

```text
Invoice is AR, not payment.
```

---

## Rule 3 — Wallet / Credit / Advance

```text
Wallet/customer credit/advance are stored-value applications, not payments.
```

---

## Rule 4 — Preferences

```text
Preferences are operational selections.
Charges are accounting facts.
```

---

## Rule 5 — Tax Timing

```text
Tax is calculated after charges/discounts and before credits/payments.
```

---

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

# FINANCIAL_FORMULAS.md

# Main Settlement Formula

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

---

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

---

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

# CHECKOUT_RUNTIME_FLOW.md

# Current Runtime Flow

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

# DB_ORDER_FINANCIAL_MODEL.md

# Core Tables

## Order Summary

```text
org_orders_mst
```

Stores:

- commercial snapshot
- settlement snapshot
- financial totals
- outstanding values
- operational status

---

## Commercial Lines

```text
org_order_items_dtl
```

Stores:

- item pricing
- quantity
- taxability
- line totals

---

## Physical Pieces

```text
org_order_item_pieces_dtl
```

Stores:

- physical garment tracking
- rack location
- workflow status
- barcode
- rejection state

---

## Preferences

```text
org_order_preferences_dtl
```

Stores:

- stains
- damage
- colors
- packing
- notes
- service add-ons

---

## Charges

```text
org_order_charges_dtl
```

Stores:

- preference charges
- rush fees
- delivery fees
- handling fees
- manual charges

---

## Discounts

```text
org_order_discounts_dtl
```

Stores:

- manual discounts
- promotions
- coupons
- loyalty discounts

---

## Taxes

```text
org_order_taxes_dtl
```

Stores:

- VAT snapshot
- tax breakdown
- taxable base

---

## Credit Applications

```text
org_order_credit_apps_dtl
```

Stores:

- gift card applications
- wallet applications
- customer credit usage
- advance usage
- loyalty credit usage

---

## Payments

```text
org_order_payments_dtl
```

Stores:

- cash
- cards
- checks
- bank transfers
- gateway payments

---

# API_SETTLEMENT.md

# POST /api/client/v1/orders/:id/payments

## Purpose

Capture real-money settlement against an order.

---

## Request Example

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

---

## Runtime Rules

```text
Payments = real money only.
Credits = stored-value applications.
```

---

## Validation

- order exists
- tenant matches
- order not closed
- idempotency valid
- gift card active
- wallet balance sufficient
- customer credit sufficient
- no negative values

---

## Success Response

```json
{
  "success": true,
  "outstandingAmount": 0,
  "settlementStatus": "SETTLED"
}
```

---

# RECONCILIATION_STRATEGY.md

# Reconciliation Philosophy

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

---

# Mandatory Checks

```text
sum(charges) = order.total_charges_amount
sum(discounts) = order.total_discount_amount
sum(taxes) = order.total_tax_amount
sum(credits) = order.total_credit_applied_amount
sum(payments) = order.total_paid_amount
```

---

# Reconciliation Severity

| Severity | Meaning |
|---|---|
| INFO | cosmetic issue |
| WARNING | requires review |
| BLOCKER | financial inconsistency |

---

# Migration Rule

```text
No feature-flag read switch before reconciliation passes.
```

---

# MIGRATION_PHASES.md

# Migration Strategy

```text
expand
→ dual-write
→ reconcile
→ switch-read
→ retire
```

---

# Phase 1 — Audit

Deliver:

- schema discovery
- current flow analysis
- risk analysis
- migration planning

---

# Phase 2 — Add Tables

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

---

# Phase 3 — Add Summary Columns

Enhance:

```text
org_orders_mst
```

with financial snapshots.

---

# Phase 4 — Charges

Dual-write chargeable preferences.

---

# Phase 5 — Discounts

Dual-write promotions and discounts.

---

# Phase 6 — Taxes

Write normalized tax rows.

---

# Phase 7 — Payments

Normalize payment rows.

---

# Phase 8 — Stored Value

Implement:

```text
gift cards
wallet
customer credits
advances
```

---

# AI_ASSISTANT_RULES.md

# Mandatory Rules

## Never

```text
Never rewrite checkout.
Never remove AMOUNT_MISMATCH.
Never trust frontend totals.
Never treat gift card as discount.
Never treat invoice as payment.
Never remove old fields early.
```

---

## Always

```text
Always preserve transaction boundaries.
Always use tenant_org_id.
Always support reconciliation.
Always use idempotency.
Always dual-write before switch-read.
```

---

# ACCOUNTING_EVENT_CATALOG.md

# Main Accounting Events

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

# EVENT_CATALOG.md

# Main Runtime Events

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

# ERROR_CATALOG.md

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

# RBAC_MODEL.md

# Main Permission Domains

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

# FINAL GOVERNANCE RULE

```text
The current checkout route is the stable transactional shell.
The migration strategy is to gradually add normalized financial facts around it without breaking operational continuity.
```

