<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# AI Assistant Rules

## Startup Protocol

Before editing code:

1. Read this documentation pack.
2. Inspect current code and schema.
3. Produce implementation plan.
4. List files to change.
5. List risks.
6. Add tests.

## Never

```text
Never rewrite checkout.
Never remove AMOUNT_MISMATCH.
Never trust frontend totals.
Never treat gift card as discount.
Never treat invoice as payment.
Never remove old fields early.
Never switch reads before reconciliation.
```

## Always

```text
Always preserve transaction boundaries.
Always use tenant_org_id.
Always support reconciliation.
Always use idempotency.
Always dual-write before switch-read.
Always use feature flags.
```
