# Loyalty Guide — Earn, Redeem, Tiers

## Earn Rules

Loyalty points are earned **asynchronously** via the outbox pattern:

1. At order settlement, `queueEarnPoints(tx, { tenantId, customerId, orderId, orderAmount })` appends a `LOYALTY_EARN_QUEUED` event to `org_domain_events_outbox`
2. The outbox worker picks up the event and calls the loyalty earn processor
3. Processor queries the tenant's earn rate config and computes `pointsEarned = floor(orderAmount × earnRate)`
4. Appends a row to `org_loyalty_txn_dtl` (txn_type=EARN) and increments `lifetime_earned` + `points_balance`

This async design means earn is fire-and-forget — settlement is never delayed by loyalty calculation.

## Redeem Rules

Points redemption is **synchronous** inside the settlement transaction:

```typescript
await redeemPointsTx(tx, {
  tenantId, customerId, pointsToRedeem,
  monetaryAmount, orderId, idempotencyKey
});
```

- Uses SELECT FOR UPDATE on `org_loyalty_accounts_mst`
- Appends REDEEM row to ledger
- Decrements `points_balance` (never decrements `lifetime_earned`)
- Idempotency key prevents double-redeem on retry

## Tier Logic

Tier is determined by `lifetime_earned` (cumulative points, never decremented):

| Tier | Minimum lifetime_earned |
|---|---|
| BRONZE | 0 |
| SILVER | Configured per tenant |
| GOLD | Configured per tenant |
| PLATINUM | Configured per tenant |

Tier is recalculated on every earn event. Tier upgrades are immediate; tier downgrades are NOT applied (tier can only go up based on lifetime_earned).

## Points Balance vs Lifetime Earned

- `points_balance` — spendable balance (earn - redeem - expiry)
- `lifetime_earned` — monotonically increasing total, used for tier calculation
- Reconciliation check `LOYALTY_LEDGER` verifies: `points_balance = lifetime_earned - lifetime_redeemed`

## txn_type Values

| Type | When |
|---|---|
| EARN | Points credited from order |
| REDEEM | Points spent at checkout |
| ADJUSTMENT | Manual correction by staff |
| EXPIRY | Points expired per tenant policy |
