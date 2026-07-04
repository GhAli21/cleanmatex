# Stored Value Guide — Wallet, Advance, Credit Note

## Overview

Three distinct stored-value instruments, each with its own ledger:

| Instrument | Table | Use Case |
|---|---|---|
| Wallet | org_customer_wallets_mst + org_wallet_txn_dtl | Customer prepaid balance for any order |
| Advance | org_customer_advances_mst + org_advance_txn_dtl | Corporate/B2B prepaid credit |
| Credit Note | org_credit_notes_mst | Document-based refund credit (not a running balance) |

## Wallet Business Rules

- One wallet per customer per tenant (created lazily on first top-up)
- Top-up: unlimited; redemption: capped at current balance
- txn_type values: `TOP_UP`, `REDEMPTION`, `REFUND_CREDIT`, `ADJUSTMENT`, `EXPIRY`
- Wallet redemption at checkout: `redeemWalletTx(tx, { tenantId, customerId, amount, orderId })`
- Refund to wallet: `topUpWalletTx(tx, { tenantId, customerId, amount, orderId, notes })`

## Advance Business Rules

- Separate from wallet — for B2B customers with pre-negotiated credit
- Same ledger pattern as wallet
- Redemption function: `redeemAdvanceTx(tx, ...)`

## Credit Note Business Rules

- Document-based — each note has `original_amount` and `remaining_balance`
- Multiple active credit notes per customer — each can be partially redeemed
- Expiry date enforced at redemption time
- No consolidation — each note tracked independently
- Sequential numbering: `CN-{tenantId[0:8]}-{seq:05d}`
- `issueCreditNote(tenantId, { customerId, amount, currencyCode, reason, issuedBy })`
- `redeemCreditNoteTx(tx, { tenantId, customerId, creditNoteId, amount, orderId })`

## SELECT FOR UPDATE Pattern

All redemption functions lock the account row before balance check:

```sql
SELECT id, balance::float8, currency_code
FROM org_customer_wallets_mst
WHERE tenant_org_id = $1::uuid AND customer_id = $2::uuid AND is_active = true
FOR UPDATE
```

This prevents two concurrent requests from both passing the "balance >= amount" check and both deducting from the same balance.

## Idempotency

`topUpWalletTx` accepts an optional `orderId`. The redemption check uses `order_id` to detect duplicate redemption attempts:

```typescript
const existing = await tx.org_wallet_txn_dtl.findFirst({
  where: { wallet_id: wallet.id, order_id: orderId, txn_type: 'REDEMPTION' }
});
if (existing) return; // already redeemed for this order
```

## Error Codes

| Error | Thrown when |
|---|---|
| `INSUFFICIENT_BALANCE` | Wallet/advance balance < requested amount |
| Credit note not found | Credit note not active or wrong tenant |
| Insufficient credit note balance | note.remaining_balance < amount |

---

## Cancellation restores (Remediation 2026-07 Phase 4 — ADR-053)

When an order is cancelled, `unwindOrderFinancialsOnCancel` reverses every APPLIED credit application back to its source ledger (gift card refund, wallet top-up, advance re-issue, fresh credit note), CAS-guarded so retries never double-restore. Collected real payments follow the operator's disposition: REFUND (maker-checker refund per payment), STORE_CREDIT (one credit note for the net collected amount), or KEEP_ON_ACCOUNT (approval-gated retention). `LOYALTY_POINTS` applications are flipped to REVERSED with a manual-restore warning. Audit: outbox event `ORDER_CANCEL_FINANCIAL_UNWIND`.
