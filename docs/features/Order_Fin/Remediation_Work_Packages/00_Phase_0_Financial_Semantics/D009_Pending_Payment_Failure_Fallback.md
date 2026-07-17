# D009 — Pending-Payment Failure Fallback

## Metadata
Decision ID: D009 · Status: PROPOSED · Approved decision: NOT YET APPROVED · Decision type: Settlement-policy fallback
Authoritative report sections: H8, §31.1, §32, M6, M9
Blocks: B30, B31, B33 · Affects: B8
Owner: — · Approval date: — · Supersedes: —

## Problem
The settlement plan counts PENDING legs at full value → `outstandingPolicy='NONE'`, no AR invoice, `payment_type=PAY_IN_ADVANCE`. If the leg later fails/bounces/expires/is cancelled (transitions B30/B10 will add), the order holds real outstanding with **no policy, no fallback, no owner** (H8).

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-settlement-planner.service.ts:169–181 | pending legs in `immediateSettlementAmount` | plan optimism must have a failure counterpart |
| order-financial-write.service.ts:795–801 | payOnCollection/arReceivable derive from `payment_type_code` only | failed-leg orders classify as neither |
| §31 | no PAYMENT_FAILED family transitions | fallback fires from B30/B10 transitions |

## Invariants (proposed)
1. A leg failure never silently leaves outstanding unclassified: the transition must end with the order in exactly one of {re-tendered, PAY_ON_COLLECTION, AR/CREDIT_INVOICE, cancelled-with-disposition}.
2. Reclassification is auditable (actor, reason, before/after policy) and replay-safe (D010).
3. Receipt/customer communication reflects the fallback (order no longer "paid pending confirmation").

## Decision scope (options to finalize)
- **Automatic default** (e.g. → PAY_ON_COLLECTION when order not yet delivered; → AR for B2B/CREDIT_INVOICE customers) vs **user-selected** at the B30 worklist action, vs hybrid (auto-default + operator override window).
- Whether plan-time behavior changes (count PENDING as outstanding from the start for non-instant methods) — interacts with B31/B33.
- Order workflow status effect (hold vs continue processing).

## Recommended direction
Hybrid: transition requires an explicit fallback choice in the B30 action (validated set per customer type), with a tenant-configurable default; no plan-time change until B33/B31 land.

## Related decisions / affected packages
[D001](D001_Payment_Lifecycle_And_Status_Transitions.md), [D005](D005_Canonical_Outstanding_Formula.md), [D010](D010_Financial_Idempotency_And_Lineage.md) → [B30](../B30_Pending_Payment_Backoffice_Lifecycle.md), [B31](../B31_Later_Collection_Default_Status.md), [B33](../B33_Pending_Payment_Warning_Semantics.md), [B08](../B08_Gateway_Lifecycle_Integration.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
