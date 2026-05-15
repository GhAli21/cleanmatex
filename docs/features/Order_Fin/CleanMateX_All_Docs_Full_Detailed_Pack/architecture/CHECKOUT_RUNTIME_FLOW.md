<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Checkout Runtime Flow

## 1. Current Stable Flow

The current flow must remain the stable shell:

```text
POST /api/v1/orders/preview-payment
POST /api/v1/orders/create-with-payment
```

## 2. Preview Flow

```text
Frontend opens payment step
→ sends cart/customer/items/pieces/preferences
→ server runs calculateOrderTotals()
→ server returns authoritative totals
→ no database mutation
```

## 3. Create-With-Payment Flow

```text
POST create-with-payment
  → validate CSRF/session
  → validate orders:create permission
  → resolve tenant context
  → validate request body
  → validate idempotencyKey
  → resolve branch
  → run calculateOrderTotals()
  → compare server totals vs clientTotals
  → if mismatch:
       return AMOUNT_MISMATCH
       write nothing
  → validate deferred payment / credit limit if applicable
  → validate payment methods and amount
  → begin prisma.$transaction
      → create order header
      → create order items
      → create item-level preferences
      → create pieces
      → create piece-level preferences
      → create charge detail rows
      → create discount detail rows
      → create tax detail rows
      → create credit application rows
      → create payment rows
      → create invoice / AR
      → create audit logs
      → create outbox events
      → save idempotency key
  → commit
  → return success
```

## 4. No-Break Requirements

- `preview-payment` must never mutate DB.
- `create-with-payment` must recalculate totals.
- `AMOUNT_MISMATCH` must prevent all writes.
- The transaction must remain atomic.
- New financial rows must be written inside the transaction.
