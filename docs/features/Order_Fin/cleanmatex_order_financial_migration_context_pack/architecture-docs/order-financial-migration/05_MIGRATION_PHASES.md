# Migration Phases

## Strategy

Use:

```text
expand → dual-write → reconcile → switch-read → retire
```

## Phase 1 — Audit Only

No code changes.

Tasks:

- inspect current routes
- inspect services
- inspect migrations
- inspect Prisma schema
- inspect current payment/promo/gift/discount logic
- produce gap report
- identify exact files to change

## Phase 2 — Add Financial Detail Tables

Add:

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_credit_apps_dtl
org_order_payments_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
org_order_financial_audit_log
```

No behavior change.

## Phase 3 — Add Order Summary Columns

Add snapshot columns to `org_orders_mst`.

Examples:

```text
total_charges_amount
total_discount_amount
total_tax_amount
total_credit_applied_amount
total_paid_amount
pay_on_collection_amount
rounding_adjustment_amount
change_returned_amount
engine version columns
```

No behavior change.

## Phase 4 — Dual-Write Preference Charges

Current:

```text
preference charges roll into line totals
```

New dual-write:

```text
chargeable preference → org_order_charges_dtl
```

Do not switch read source yet.

## Phase 5 — Dual-Write Discounts

Current promo/discount logic remains.

New dual-write:

```text
auto/manual/promo/coupon discounts → org_order_discounts_dtl
```

Gift cards must not be discounts.

## Phase 6 — Dual-Write Taxes

Extend `calculateOrderTotals()` to return tax breakdown if needed.

Write:

```text
org_order_taxes_dtl
```

## Phase 7 — Dual-Write Payments

Translate current cash/card/check payment into:

```text
org_order_payments_dtl
```

Prepare for multiple payment legs.

## Phase 8 — Rounding and Cash Change

Add:

```text
sys_currency_rounding_rules_cd
rounding adjustment
cash tendered amount
change returned amount
```

## Phase 9 — Gift Card Ledger

Implement:

```text
org_gift_cards_mst
org_gift_card_txn_dtl
org_order_credit_apps_dtl
```

Use row lock for redemption.

## Phase 10 — Wallet / Advance / Customer Credit

Add ledgers and application services.

## Phase 11 — Tenant-Owned Promotions

Add:

```text
org_promotions_*
```

Promotions are tenant-owned.

## Phase 12 — Tax Configuration

Add tenant tax config.

## Phase 13 — Reconciliation Engine

Add views/services to compare:

```text
summary vs detail vs ledger
```

## Phase 14 — Outbox + Posting Events

Add:

```text
org_domain_events_outbox
```

Do not post accounting directly from UI route.

## Phase 15 — Feature-Flag Read Switch

Switch reads from legacy summary to normalized detail tables using feature flags.

## Phase 16 — Historical Backfill

Backfill old data to new tables.

Must support:

```text
dry-run
batching
idempotency
resume
logs
reconciliation
```

## Phase 17 — Strict Constraints

Only after reconciliation passes.

## Phase 18 — Retire Legacy Logic

Deprecate old paths gradually.

Do not drop old columns immediately.
