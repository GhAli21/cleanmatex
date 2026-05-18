# Order Financial Platform — Developer Guide

## Service Dependency Graph

```
order-calculation.service
  ├── pricing.service
  ├── tax.service (getTaxRate)
  ├── tenant-settings.service (getCurrencyConfig)
  ├── discount-service (getBestDiscount, validatePromoCode)
  └── gift-card-service (validateGiftCard, validateGiftCardByIdForCalculation)

checkout-config.service
  └── org_payment_methods_cf (reads active payment methods + branch overrides)

order-settlement.service
  ├── stored-value.service (redeemWalletTx, redeemAdvanceTx, redeemCreditNoteTx)
  ├── loyalty.service (redeemPointsTx, queueEarnPoints)
  ├── gift-card-service (redeemGiftCardTx)
  └── outbox.service (emitEventTx → ORDER_COMPLETED)

order-refund.service
  ├── stored-value.service (topUpWalletTx, issueCreditNote)
  └── outbox.service (emitEventTx → REFUND_PROCESSED)

tax-engine.service
  └── org_tax_profiles_cf, org_tax_exemptions_cf

reconciliation.service
  └── org_reconciliation_runs_mst, org_reconciliation_issues_dtl

cash-drawer.service
  └── org_cash_drawer_sessions_mst, org_cash_drawer_movements_dtl
```

## Multi-Leg Settlement Flow Walkthrough

```
Client submits: { orderId, breakdown, settlementLegs: [cashLeg, walletLeg] }

1. settleOrder() opens prisma.$transaction(async tx => { ... })

2. Fact table writes (in order):
   a. org_order_charges_dtl  — one row per charge line
   b. org_order_taxes_dtl    — one row per tax line
   c. org_order_discounts_dtl — one row per discount line (seq numbered)

3. Leg routing loop — for each leg:
   paymentNature === 'REAL_PAYMENT'
     → create org_order_payments_dtl row (status=COMPLETED)
     → accumulate totalRealPayments + changeReturned

   paymentNature === 'CREDIT_APPLICATION'
     → look up customer_id from org_orders_mst
     → creditApplicationType === 'WALLET'   → redeemWalletTx(tx, ...)
     → creditApplicationType === 'ADVANCE'  → redeemAdvanceTx(tx, ...)
     → creditApplicationType === 'CREDIT_NOTE' → redeemCreditNoteTx(tx, ...)
     → creditApplicationType === 'LOYALTY_POINTS' → redeemPointsTx(tx, ...)
     → create org_order_credit_apps_dtl row

   paymentNature === 'DEFERRED_SETTLEMENT'
     → isDeferred = true (no payment row; order stays PENDING_COLLECTION)

4. Update org_orders_mst snapshot:
   - total_paid_amount, total_discount_amount, total_tax_amount
   - outstanding_amount, payment_status, change_returned_amount

5. emitEventTx(tx, tenantId, 'ORDER_COMPLETED', 'order', orderId, payload)
   → appends to org_domain_events_outbox (PENDING status)

6. queueEarnPoints(tx, ...) — appends loyalty earn event to outbox
```

## SELECT FOR UPDATE Pattern (Stored Value)

All stored-value mutation functions (`redeemWalletTx`, `redeemAdvanceTx`, `redeemGiftCardTx`) use raw SQL to lock the account row before computing the new balance:

```typescript
const rows = await tx.$queryRaw<...[]>`
  SELECT id, balance::float8, currency_code
  FROM org_customer_wallets_mst
  WHERE tenant_org_id = ${tenantId}::uuid
    AND customer_id   = ${customerId}::uuid
    AND is_active     = true
  FOR UPDATE
`;
```

This prevents TOCTOU (time-of-check-time-of-use) double-debit when two requests arrive simultaneously for the same wallet. The lock is held for the duration of the outer `prisma.$transaction`.

## Idempotency Key Usage

`redeemGiftCardTx` and `topUpWalletTx` accept an `idempotencyKey` parameter:

```typescript
// Check before mutating
const existing = await tx.org_gift_card_txn_dtl.findFirst({
  where: { tenant_org_id: tenantOrgId, idempotency_key: idempotencyKey },
});
if (existing) return { newBalance: existing.balance_after, skipped: true };
```

Pass the idempotency key from the client on retry. The key is stored in the transaction row and checked on every call to prevent double-credit/debit.

## Outbox Event Emission and Worker Consumption

### Emitting

```typescript
import { emitEventTx } from '@/lib/services/outbox.service';

// Always call inside an existing prisma.$transaction
await emitEventTx(tx, tenantId, 'ORDER_COMPLETED', 'order', orderId, {
  paymentStatus, grandTotal, settled,
});
```

This creates a row in `org_domain_events_outbox` with `status='PENDING'` and a retry schedule.

### Worker Consumption

The Supabase Edge Function at `supabase/functions/outbox-worker/index.ts`:
1. Calls `claimBatch(50)` — sets matching rows to `PROCESSING`
2. Publishes each event to the downstream bus (webhook/queue)
3. On success: marks `COMPLETED`
4. On failure: increments `attempts`, resets to `PENDING` with exponential back-off (`next_retry_at`)
5. After `max_attempts` (6): marks `FAILED`

Retry schedule in minutes: `1 → 5 → 15 → 60 → 240 → FAILED`

The pg_cron job (migration 0296) triggers the worker on a schedule.

## Refund Lifecycle

```
initiateRefund(tenantId, { orderId, amount, reason, method, requestedBy })
  → creates org_order_refunds_dtl with status='PENDING_APPROVAL'

approveRefund(tenantId, refundId, approverId)
  → requires refund_status='PENDING_APPROVAL' (findFirstOrThrow with status filter)
  → moves to 'APPROVED'

processRefund(tenantId, refundId)  ← runs inside prisma.$transaction
  → requires refund_status='APPROVED'
  → method='WALLET'      → topUpWalletTx (credits wallet)
  → method='CREDIT_NOTE' → issueCreditNote (creates credit note document)
  → method='CASH'/'ORIGINAL_METHOD' → no ledger write (physical reversal)
  → moves to 'PROCESSED'
  → updates org_orders_mst.payment_status='PARTIALLY_REFUNDED'
  → emits REFUND_PROCESSED outbox event
```

## Cash Drawer Session Lifecycle

```
openSession(tenantId, { drawerId, openedBy, openingBalance })
  → creates org_cash_drawer_sessions_mst status='OPEN'

recordMovement(tenantId, drawerId, { type, amount, ... })
  → appends to org_cash_drawer_movements_dtl
  → supported types: CASH_IN, CASH_OUT, OPENING_BALANCE, CLOSING_COUNT

closeSession(tenantId, drawerId, { closedBy, closingBalance })
  → finds OPEN session for drawer
  → aggregates org_order_payments_dtl (CASH payments in session window)
  → computes variance = closingBalance - expectedBalance
  → moves session to 'CLOSED'
```

## Reconciliation Checks

`runReconciliation(tenantId, params)` executes 7 checks per run:

| Check ID | What it verifies |
|---|---|
| PAYMENT_TOTAL_MATCH | Sum of payment rows matches order.total_paid_amount |
| STORED_VALUE_LEDGER | Wallet balance = sum of all wallet txn rows |
| GIFT_CARD_LEDGER | Gift card available_amount = original - sum(redeem txns) |
| REFUND_APPROVED | No refunds stuck in PENDING_APPROVAL > 48 hours |
| OUTBOX_STUCK | No outbox events PENDING/FAILED > 1 hour |
| CASH_DRAWER_VARIANCE | Absolute variance > threshold |
| LOYALTY_LEDGER | Loyalty points_balance = lifetime_earned - lifetime_redeemed |

Results are written to `org_reconciliation_runs_mst` (PASSED/FAILED/PARTIAL) and issues to `org_reconciliation_issues_dtl`.

## Permissions Reference

All financial permissions are seeded via migration 0294. Key codes:

| Code | Description |
|---|---|
| `orders.payments.view` | View payment details on orders |
| `orders.payments.settle` | Settle an order |
| `orders.refunds.initiate` | Request a refund |
| `orders.refunds.approve` | Approve a pending refund |
| `billing.cash-drawers.manage` | Open/close cash drawer sessions |
| `billing.reconciliation.run` | Trigger reconciliation runs |
| `billing.reconciliation.view` | View reconciliation results |
| `marketing.promotions.manage` | Create/edit promotions |
| `customers.stored-value.manage` | Top-up wallet/advance |
| `settings.tax.manage` | Configure tax profiles |

## Environment Setup

No additional environment variables required beyond the base Supabase config. The outbox worker uses the `SUPABASE_SERVICE_ROLE_KEY` edge function secret already configured.

For local development, run migrations 0278–0296 via `supabase db push` after they are reviewed and applied.
