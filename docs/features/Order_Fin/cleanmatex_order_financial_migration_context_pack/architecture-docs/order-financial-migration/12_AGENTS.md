# Agent Instructions — Order Financial Migration

This repo contains a migration context pack at:

```text
/architecture-docs/order-financial-migration
```

Any agent working on order, payment, tax, promotion, gift card, wallet, customer credit, loyalty, invoice, or accounting posting must read that folder first.

## Required First Step

Before implementation, produce:

1. What you understood
2. Files inspected
3. Tables inspected
4. Plan
5. Risks
6. Tests

## No-Break Requirements

- Preserve current checkout route.
- Preserve server-side recalculation.
- Preserve `AMOUNT_MISMATCH`.
- Preserve one transaction.
- Preserve idempotency.
- Preserve tenant context.
- Do not remove old logic until reconciliation and read switch are complete.
