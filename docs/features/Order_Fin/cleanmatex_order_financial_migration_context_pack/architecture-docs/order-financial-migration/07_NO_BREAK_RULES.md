# No-Break Rules

## Absolute Rules

Do not:

- rewrite checkout
- remove current `preview-payment`
- remove current `create-with-payment`
- remove `AMOUNT_MISMATCH`
- trust frontend totals
- remove existing fields during migration
- change frontend contract first
- treat gift cards as discounts
- treat wallet/customer credit/advance as payments
- treat invoice as payment
- silently mutate financial totals without audit
- post accounting directly from UI route
- skip tenant_org_id
- bypass idempotency for financial mutations
- update stored-value balances without ledger rows
- redeem stored value without row locking
- switch reads before reconciliation

## Required Always

Always:

- preserve transaction boundaries
- keep server recalculation
- use `prisma.$transaction` for checkout mutation
- add new tables/columns first
- dual-write before switching reads
- reconcile before retiring legacy
- use feature flags
- write tests
- make migrations reversible or clearly document rollback
- follow project naming conventions
- inspect current schema before adding migrations

## Correct Migration Mental Model

```text
Current checkout route = stable shell.
New architecture = added behind the shell.
Read switch = feature-flagged.
Legacy retirement = last step.
```
