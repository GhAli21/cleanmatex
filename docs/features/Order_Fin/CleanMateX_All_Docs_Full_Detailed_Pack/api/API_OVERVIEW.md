<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# API Overview

## 1. API Principles

- API-first
- tenant-scoped
- permission-guarded
- idempotent for financial mutations
- server-calculated totals
- stable contracts during migration

## 2. Current APIs To Preserve

```text
POST /api/v1/orders/preview-payment
POST /api/v1/orders/create-with-payment
```

## 3. Future API Groups

```text
/orders
/order-pieces
/order-preferences
/payments
/settlement
/gift-cards
/wallet
/customer-credits
/advances
/loyalty
/invoices
/refunds
/promotions
/tax
/reconciliation
```

## 4. Financial Mutation Requirements

Every financial mutation must include:
- tenant context
- permission guard
- validation
- idempotency key
- audit
- transaction safety
