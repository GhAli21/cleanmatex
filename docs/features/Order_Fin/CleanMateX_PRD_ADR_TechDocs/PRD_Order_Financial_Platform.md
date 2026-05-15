# Product Requirements Document (PRD)
# CleanMateX Order Financial Platform

## 1. Objective

Build a production-grade multi-tenant order financial platform for CleanMateX supporting:

- laundry/dry-cleaning operations
- POS settlement
- pay on collection
- invoice / AR
- gift cards
- wallet
- customer credit
- customer advance
- loyalty
- promotions
- VAT/tax
- multi-payment
- accounting posting
- reconciliation
- auditability

---

# 2. Business Goals

## Primary Goals

- Normalize financial architecture
- Improve accounting accuracy
- Support enterprise-grade settlement flows
- Prevent financial inconsistencies
- Enable future ERP integration
- Support KSA/Oman VAT requirements
- Support scalable SaaS tenancy

## Non-Goals

- Full microservices migration
- Event sourcing rewrite
- Frontend redesign
- Checkout rewrite

---

# 3. User Types

| User | Responsibilities |
|---|---|
| Counter Staff | Create orders and collect payments |
| Processing Staff | Handle pieces/preferences |
| Branch Manager | Override discounts/refunds |
| Tenant Admin | Configure promotions/tax/settings |
| HQ Admin | SaaS governance |
| Customer | Pay/redeem/store value |
| Accountant | Reconciliation/posting |

---

# 4. Functional Requirements

## FR-001 Order Creation

System must support:
- item-based orders
- quantity expansion
- compound piece generation
- preferences at order/item/piece level

## FR-002 Financial Calculation

System must:
- calculate server-side totals
- reject mismatched client totals
- support charges/discounts/tax/credits/payments

## FR-003 Multi-Payment

System must support:
- multiple payment rows
- multiple card legs
- mixed payment methods

## FR-004 Stored Value

System must support:
- gift cards
- wallet
- customer advance
- customer credit
- loyalty credit

## FR-005 Promotions

System must support:
- tenant-owned promotions
- coupons
- auto discounts
- stacking rules
- limits/budgets

## FR-006 Tax

System must support:
- VAT
- tax-inclusive pricing
- tax-exclusive pricing
- branch/product tax mapping

## FR-007 Pay On Collection

System must support:
- deferred payment
- partial now + remaining later
- invoice / AR

## FR-008 Auditability

System must:
- preserve financial snapshots
- support reconciliation
- preserve financial audit logs

---

# 5. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Availability | 99.9% |
| Transaction Integrity | ACID |
| Tenant Isolation | Mandatory |
| Idempotency | Mandatory |
| Performance | p95 checkout < 800ms |
| Auditability | Mandatory |
| Reconciliation | Mandatory |
| Security | Role + tenant scoped |
| Extensibility | Modular services |

---

# 6. Success Metrics

- Zero duplicate financial mutations
- Zero unreconciled payment drift
- <0.01% financial mismatch rate
- Successful reconciliation jobs
- Stable checkout migration with no downtime
