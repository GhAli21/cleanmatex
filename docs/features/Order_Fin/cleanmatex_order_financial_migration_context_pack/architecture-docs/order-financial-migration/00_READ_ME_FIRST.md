# CleanMateX Order Financial Migration — Read Me First

## Purpose

This folder is the source-of-truth context pack for migrating the existing CleanMateX order/payment flow into a normalized, production-grade, multi-tenant SaaS financial architecture.

This pack is intended for:
- Claude Code
- Cursor
- Codex
- human developers
- future maintainers

## Critical Instruction

Do **not** rewrite checkout.

The current checkout flow is already a strong transactional backbone and must remain stable while the architecture evolves.

## Current Stable Flow

The current system has:

- `POST /api/v1/orders/preview-payment`
- `POST /api/v1/orders/create-with-payment`
- server-side `calculateOrderTotals()`
- `clientTotals` comparison
- `AMOUNT_MISMATCH` guard
- CSRF/security checks
- `orders:create` permission
- tenant context
- optional `idempotencyKey`
- one `prisma.$transaction`
- order header creation
- order item creation
- piece row creation
- preference row creation
- invoice creation
- optional cash/card/check payment
- promo/gift/discount handling

This must not be broken.

## Migration Strategy

Use:

```text
expand → dual-write → reconcile → switch-read → retire
```

Never use:

```text
big-bang rewrite
delete-and-rebuild
frontend + DB + API refactor together
```

## Target Outcome

The target architecture separates:

```text
Order snapshot
Commercial lines
Physical pieces
Operational preferences
Financial charges
Discounts
Taxes
Stored-value applications
Real payments
Invoices / AR
Ledgers
Audit
Reconciliation
Posting events
```

## Golden Rule

Every AI assistant must first read all files in this folder before editing code.

Before implementation, produce:

1. What you understood
2. Existing files/tables to inspect
3. Exact implementation plan
4. Risks
5. Files likely to change

No implementation before plan review.
