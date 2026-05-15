# Technical Specification
# Checkout and Financial Architecture

# 1. Current Stable APIs

```text
POST /api/v1/orders/preview-payment
POST /api/v1/orders/create-with-payment
```

---

# 2. Mandatory Runtime Rules

## Rule 1

Never trust frontend totals.

## Rule 2

Always recalculate server-side.

## Rule 3

Use one transaction.

## Rule 4

Preserve AMOUNT_MISMATCH behavior.

## Rule 5

All financial writes must be idempotent.

---

# 3. Transaction Flow

```text
validate request
→ calculate totals
→ compare totals
→ validate permissions
→ validate stored value
→ begin transaction
    → create order
    → create items
    → create pieces
    → create preferences
    → create charges
    → create discounts
    → create taxes
    → create credit applications
    → create payment rows
    → create invoice
    → write audit
    → enqueue outbox events
→ commit
```

---

# 4. Financial Summary Formula

```text
gross
+ charges
- discounts
= net_before_tax

net_before_tax
+ tax
= grand_total

grand_total
- credits
= net_receivable

net_receivable
- payments
- invoice_ar
= outstanding
```

---

# 5. Idempotency

Use:

```text
org_idempotency_keys_log
```

For:
- order creation
- payment capture
- stored value redemption
- refunds

---

# 6. Locking

Use:

```sql
SELECT ... FOR UPDATE
```

For:
- gift cards
- wallet
- customer credit
- advances
