# ADR: submit-order as Canonical Order Submission Path

**Date:** 2026-05-23
**Status:** Accepted
**Deciders:** Engineering

---

## Context

Two code paths existed for order submission:

- `POST /api/v1/orders/create-with-payment` — original; all business logic inline in the route handler
- `POST /api/v1/orders/submit-order` — new; thin route + `order-submit-orchestrator.service.ts`

The BVM Wiring Phase 1B integration required extracting business logic into a dedicated orchestrator service to support:

- Pre-wiring validation (`validateSettlementPlan`) that fires before any DB rows are written
- Receipt voucher creation → lines → post+wire before `settleOrder()`
- Config-driven payment status resolution (D9 dual-table architecture)
- Idempotency ownership at the route level while keeping the orchestrator idempotency-unaware (D11)
- Richer response shape: order snapshot + voucher summary + linked effects + warnings

---

## Decision

`POST /api/v1/orders/submit-order` is the **single canonical path** for order submission.

- All new order submission features go into `lib/services/order-submit-orchestrator.service.ts`
- `create-with-payment` is renamed to `_legacy_create-with-payment` and is NOT served by Next.js
- ESLint `no-restricted-imports` prevents accidental import of the legacy path
- No new callers, no new features on the legacy route

---

## Consequences

**Positive:**
- One place to read, one place to test, one place to fix
- Orchestrator is reusable — future mobile API or background jobs call `submitOrder()` directly
- Thin routes make it trivial to add middleware, versioning, or gateway logic later
- Idempotency is explicitly owned at the route boundary — orchestrator is deterministic and testable

**Negative (accepted):**
- Legacy route preserved in source for reference — minor cognitive overhead, offset by clear naming + ESLint guard
- Phase 1B limitation: stored-value debits still happen in `settleOrder()`, not in the voucher transaction (Phase 2 scope)
- Phase 1B limitation: gift card via `input.giftCardId` not yet wired as a voucher line (Phase 2 scope)

---

## Key Files

| Role | File |
|---|---|
| Canonical route | `app/api/v1/orders/submit-order/route.ts` |
| Orchestrator | `lib/services/order-submit-orchestrator.service.ts` |
| Settlement planner | `lib/services/order-settlement-planner.service.ts` |
| Settlement plan types | `lib/types/settlement-plan.ts` |
| Frozen legacy route | `app/api/v1/orders/_legacy_create-with-payment/route.ts` |
