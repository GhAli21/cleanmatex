# AI Assistant Rules

These rules apply to Claude Code, Cursor, Codex, and any AI coding assistant.

## Startup Protocol

Before editing code:

1. Read all files in `/architecture-docs/order-financial-migration`.
2. Inspect relevant code and schema.
3. Produce an implementation plan.
4. List files to change.
5. List risks.
6. Wait for explicit approval if working interactively.

## Required Response Before Implementation

The assistant must produce:

```text
What I understood
Existing files inspected
Existing tables inspected
Planned changes
Risks
Tests to add
Rollback notes
```

## Prohibited Behavior

Do not:

- invent a different architecture
- rename existing tables without instruction
- collapse all concepts into one table
- create `customer_balance` without balance type
- treat gift card as discount
- treat invoice as payment
- put wallet/gift card/customer credit into payments table
- remove legacy logic early
- change UI payload early
- skip tests
- skip tenant isolation
- skip reconciliation

## Required Behavior

Always:

- use tenant-scoped queries
- preserve API compatibility
- keep old behavior working
- write new normalized rows in the same transaction
- make changes phase-by-phase
- document assumptions
- avoid unrelated refactors

## File References

Typical files to inspect:

```text
web-admin/app/api/v1/orders/create-with-payment/route.ts
web-admin/app/api/v1/orders/preview-payment/route.ts
web-admin/lib/services/order-service.ts
web-admin/lib/services/order-calculation.service.ts
web-admin/src/features/orders/hooks/use-order-submission.ts
supabase/migrations
prisma/schema.prisma
```
