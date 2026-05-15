# Current Order / Payment Flow

## Current APIs

### Preview

```text
POST /api/v1/orders/preview-payment
```

Purpose:

- calculate server-side totals
- show user authoritative totals
- do not persist anything

### Create With Payment

```text
POST /api/v1/orders/create-with-payment
```

Purpose:

- recalculate server-side totals
- compare with client totals
- reject mismatch
- persist order and payment-related data inside one transaction

## Current End-to-End Flow

```text
New order page
  → cart / customer / lines / optional pieces / preferences

Payment step opens
  → POST preview-payment
  → calculateOrderTotals()
  → totals JSON returned, no DB save

User confirms payment
  → POST create-with-payment

create-with-payment:
  → validate CSRF
  → validate permission orders:create
  → validate request body
  → resolve tenant context
  → check idempotencyKey
  → resolve branch
  → calculateOrderTotals()
  → compare server totals vs clientTotals
  → if mismatch, return AMOUNT_MISMATCH and write nothing
  → handle credit hold / limit for invoice or pay on collection
  → validate payment method and amountToCharge
  → begin prisma.$transaction
      → create order header
      → create order items
      → create item-level preferences
      → create pieces
      → create piece-level preferences
      → create invoice
      → optionally record cash/card/check payment
      → apply promo
      → redeem gift card if applicable
      → insert discount lines
      → store idempotency key
  → commit
  → return orderId/orderNo
```

## Current Strengths

The current design already has these enterprise-grade foundations:

- server-authoritative totals
- no trust in browser totals
- amount mismatch guard
- single transaction for checkout
- idempotency
- tenant context
- permission checks
- rich order body
- order/items/pieces/preferences hierarchy

## Current Limitations

The current design still needs normalization around:

- charge detail rows
- discount detail rows
- tax detail rows
- credit application rows
- multi-payment rows
- gift card ledger
- wallet ledger
- customer credit ledger
- customer advance ledger
- loyalty ledger
- outbox events
- reconciliation jobs
- accounting posting integration
