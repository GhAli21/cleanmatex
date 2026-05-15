<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# System Overview

## 1. Executive Summary

CleanMateX is a multi-tenant SaaS platform for laundry, dry-cleaning, ironing, alterations, pickup/delivery, retail add-ons, and operational garment tracking.

The system must support:

- order creation
- POS checkout
- pay on collection
- invoice / accounts receivable
- item and piece tracking
- stains/damage/preferences
- chargeable service add-ons
- promotions and coupons
- VAT/tax
- gift cards
- wallet
- customer credit
- customer advances
- loyalty
- refunds
- reconciliation
- accounting posting
- audit trails

## 2. Architecture Style

Recommended architecture:

```text
Modular Monolith
+ Strong Domain Boundaries
+ PostgreSQL/Supabase
+ Prisma ORM
+ Next.js Frontend
+ Transactional Checkout Core
+ Event Outbox
+ Ledger-Based Stored Value
+ Feature-Flagged Migration
```

## 3. Primary Actors

| Actor | Role |
|---|---|
| Customer | Places orders, pays, uses wallet/gift cards |
| Counter Staff | Creates POS orders, accepts payments |
| Processing Staff | Updates piece status/stage |
| Driver | Handles pickup/delivery |
| Branch Manager | Approves overrides/refunds |
| Tenant Admin | Configures tax, promotions, catalog |
| HQ Admin | Controls SaaS platform governance |
| Accountant | Reviews postings, invoices, reconciliation |

## 4. Core Domains

```text
Order Core
Piece Tracking
Preference Engine
Pricing and Charges
Promotion and Discounts
Tax Engine
Settlement and Payments
Stored Value
Loyalty
Invoice and AR
Accounting Posting
Reconciliation
Audit
Security and RBAC
```

## 5. Strategic Position

CleanMateX should not be refactored through a big-bang rewrite. The current checkout transaction is already valuable and must remain stable. The target architecture must be introduced behind that flow using dual-write and reconciliation.
