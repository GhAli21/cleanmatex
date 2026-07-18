# D009 — Pending-Payment Failure Fallback

## Metadata
Decision ID: D009 · Status: APPROVED (Expert)
Approval status: APPROVED
Approval type: Expert
Selected option: Governed fallback classification with the default policy table below (hybrid direction adopted: policy defaults + MANUAL_REVIEW escape, executed at the B30 transition)
Approved decision: a pending payment may be planned as expected settlement, but every transition to failure/cancellation/expiry/rejection/bounce triggers a governed fallback classification from {RETRY_TENDER, PAY_ON_COLLECTION, AR_CREDIT_INVOICE, CANCEL_ORDER_OR_REVERSE_SERVICE, MANUAL_REVIEW}; a failed pending payment never leaves the balance unclassified; fallback is idempotent, auditable, and reflected in every customer-facing surface
Decision type: Settlement-policy fallback
Authoritative report sections: H8, §31.1, §32, M6, M9
Blocks: B30, B31, B33 · Affects: B8
Owner: Expert (see Approval record) · Approval date: 2026-07-18 · Supersedes: —

## Problem
The settlement plan counts PENDING legs at full value → `outstandingPolicy='NONE'`, no AR invoice, `payment_type=PAY_IN_ADVANCE`. If the leg later fails/bounces/expires/is cancelled (transitions B30/B10 will add), the order holds real outstanding with **no policy, no fallback, no owner** (H8).

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-settlement-planner.service.ts:169–181 | pending legs in `immediateSettlementAmount` | plan optimism must have a failure counterpart |
| order-financial-write.service.ts (payOnCollection/arReceivable derivation) | derive from `payment_type_code` only | failed-leg orders classify as neither |
| §31 | no PAYMENT_FAILED family transitions | fallback fires from B30/B10 transitions |

## Recommended decision
Hybrid: transition requires an explicit fallback choice in the B30 action (validated set per customer type), with a tenant-configurable default; no plan-time change until B33/B31 land. *(Historical recommendation — realized by the Approved decision below as policy defaults + MANUAL_REVIEW.)*

## Approved decision (Expert)

A pending payment may be treated as expected settlement during planning, but any transition to failure, cancellation, expiry, rejection, or bounce must trigger a governed fallback classification.

Allowed fallback classifications:

```text
RETRY_TENDER
PAY_ON_COLLECTION
AR_CREDIT_INVOICE
CANCEL_ORDER_OR_REVERSE_SERVICE
MANUAL_REVIEW
```

Default fallback policy:

```text
Gateway failure before confirmation
→ RETRY_TENDER

Normal retail order not yet collected/delivered
→ PAY_ON_COLLECTION

Approved B2B or credit customer
→ AR_CREDIT_INVOICE

Delivered/completed order with unresolved failed payment
→ MANUAL_REVIEW or AR_CREDIT_INVOICE according to customer policy

Bounced or rejected check
→ MANUAL_REVIEW plus explicit Pay-on-Collection or AR classification
```

Rules:

* A failed pending payment must never leave the balance unclassified.
* Outstanding, settlement plan, receipt wording, payment status, and customer communication must all reflect the fallback.
* Do not continue showing a failed transaction as "paid pending confirmation."
* Fallback processing must be idempotent and auditable (actor, reason, before/after classification — D010 keys).

## Rationale summary
H8's danger is silent unclassified outstanding: an order that looks settled while its funding leg is dead. Fixing the classification at the moment of the D001 failure transition, from a closed set with sensible per-flow defaults and a MANUAL_REVIEW escape, guarantees exactly one owner for every failed-leg balance and keeps every surface (plan, receipt, status, communication) telling the same story.

## Implementation consequences
- B30's transition service executes the fallback at every failure-family transition (FAILED/CANCELLED/EXPIRED/bounce/rejection), applying the default policy table with customer-type validation; MANUAL_REVIEW enters the B30 worklist.
- Bounced/rejected checks (B4-family lifecycles mapped per D001) always produce MANUAL_REVIEW plus an explicit POC/AR classification.
- Fallback writes reclassify `payment_type_code`/outstanding policy so the D005 formula and B33's corrected warnings reflect reality; receipts and customer messaging update accordingly (B30 scope).
- B31 aligns later-collection creation status; B8 wires the gateway failure signals that trigger RETRY_TENDER.
- All fallback actions are idempotent (D010) and audited with actor/reason/before/after.

## Affected work packages
[B30](../B30_Pending_Payment_Backoffice_Lifecycle.md) (fallback execution + worklist), [B31](../B31_Later_Collection_Default_Status.md), [B33](../B33_Pending_Payment_Warning_Semantics.md) (implemented 2026-07-17 — pending buckets are informational; fallback keeps them honest on failure), [B08](../B08_Gateway_Lifecycle_Integration.md), [B04](../B04_Later_Collection_BVM_Parity.md) (check bounce flows).

## Related decisions
[D001](D001_Payment_Lifecycle_And_Status_Transitions.md), [D005](D005_Canonical_Outstanding_Formula.md), [D010](D010_Financial_Idempotency_And_Lineage.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — governed fallback set + default policy table | 2026-07-18 | Recorded from the owner's authoritative decision pack (governance correction pass) |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
| 1.0 | 2026-07-18 | APPROVED (Expert) — fallback classifications + defaults recorded | Expert decision pack |
