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
- Scheduled expiry: job `credit_note_expiry` (pg_cron `fin-credit-note-expiry`, 02:05 UTC) calls `expireCreditNotes()` — writes `org_credit_note_txn_dtl` `txn_type='EXPIRY'`, sets remaining 0 / status EXPIRED, idempotency `cn-expiry-{id}`. **No ERP-Lite GL** (no credit-note-expired dispatcher). The 0296 raw cron `expire-credit-notes` is unscheduled (0505). Notes already flipped by that cron are not backfilled. Operator hub: [FINANCE_JOBS_HUB.md](FINANCE_JOBS_HUB.md).

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

## Cancellation restores (superseded — no auto Fin unwind)

**Do not restore stored value on order cancel.** ADR_CANCEL_RETURN_RULES (2026-07-25) and the 2026-09-17 cancel alignment: cancellation is operational only. Payments stay COMPLETED and credit applications stay APPLIED until an operator uses an explicit Fin action (B13 voucher reverse, B09 refund, stored-value clawback). D006 restore lives in `credit-application-reversal.service.ts` and is driven by voucher reverse (flag `order_fin_voucher_unwind`), not by cancel.

Historical ADR-053 disposition chooser (REFUND / STORE_CREDIT / KEEP_ON_ACCOUNT) is retired from the cancel dialog. `unwindOrderFinancialsOnCancel` remains as a deprecated helper for tests only.
