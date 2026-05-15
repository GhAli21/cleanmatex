# Claude Code Instructions — Order Financial Migration

Before working on order/payment/financial migration tasks:

1. Read all files under:

```text
/architecture-docs/order-financial-migration
```

2. Treat them as source-of-truth.

3. Do not implement before producing a plan.

4. Never break:

```text
POST /api/v1/orders/preview-payment
POST /api/v1/orders/create-with-payment
AMOUNT_MISMATCH guard
prisma.$transaction checkout flow
```

5. Migration strategy:

```text
expand → dual-write → reconcile → switch-read → retire
```

6. Never treat:

```text
gift card as discount
wallet/customer credit/advance as payment
invoice as payment
preference as accounting fact
```

7. Always preserve:

```text
tenant_org_id
idempotency
transaction safety
server-side recalculation
existing API compatibility
```
