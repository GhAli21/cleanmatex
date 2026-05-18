# Order Financial Platform — Architecture & Financial Flow

## Formula

```
subtotal         = Σ(item.basePrice × quantity) + servicePrefCharges + packingPrefCharges
manualDiscount   = percent OR amount (prefer percent when > 0, never add both)
autoRuleDiscount = best matching discount rule (no code needed)
promoDiscount    = valid promo code discount
afterDiscounts   = subtotal - manualDiscount - autoRuleDiscount - promoDiscount
taxAmount        = afterDiscounts × taxRate
additionalTax    = additionalTaxRate/100 × afterDiscounts (if configured)
grandTotal       = afterDiscounts + taxAmount + additionalTaxAmount + chargesTotal
creditsTotal     = sum of CREDIT_APPLICATION legs (wallet + advance + credit note + gift card)
netReceivable    = grandTotal - creditsTotal
outstanding      = max(0, netReceivable - totalRealPayments)
```

## Financial Flow

```
┌──────────────────────────────────────────────────┐
│              Order Calculation                    │
│  (server-side, before order exists in DB)         │
│  Input: items, discounts, promoCode, giftCardId   │
│  Output: FinancialBreakdownSnapshot               │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│              Settlement                           │
│  One atomic prisma.$transaction                   │
│  Writes: charges + taxes + discounts + payments   │
│  Routes: REAL_PAYMENT / CREDIT_APPLICATION /      │
│          DEFERRED_SETTLEMENT                      │
│  Emits: ORDER_COMPLETED via outbox                │
└──────────────────┬───────────────────────────────┘
                   │
           ┌───────┴────────┐
           ▼                ▼
    COMPLETED            PENDING_COLLECTION
    (paid now)           (pay later)
                             │
                             ▼
                    collectPaymentTx()
                    (second-step collection)
```

## Architecture Decisions

### Why payment_nature on the payment method?

The routing enum on `org_payment_methods_cf.payment_nature` means adding a new payment method (e.g. Apple Pay) doesn't require code changes — only a new config row with `payment_nature = 'REAL_PAYMENT'`. The settlement service loops over legs and switches on nature.

### Why fact tables instead of embedded JSONB?

`org_order_charges_dtl`, `org_order_taxes_dtl`, `org_order_discounts_dtl` are normalized fact tables rather than JSONB columns on `org_orders_mst` because:
- Each row is independently queryable for reporting
- Index-based aggregations (SUM, GROUP BY) work at DB level
- Audit trail is immutable (append-only, no updates)

### Why outbox instead of direct event publishing?

Outbox ensures the event is committed atomically with the business change. If the downstream event bus is down, the outbox row exists and will be retried. Direct publishing inside a transaction would lose the event if the bus call fails before commit.

### Why SELECT FOR UPDATE for stored value?

Prisma's `{ decrement: N }` uses a SQL `UPDATE ... SET balance = balance - N` which is safe for single-row updates. But stored-value operations need to:
1. Read current balance
2. Validate (balance >= amount)
3. Compute new balance
4. Write

Steps 1–4 must be atomic. If two transactions race, both could read the same balance and both pass the validation. SELECT FOR UPDATE locks the row at step 1, preventing the race.
