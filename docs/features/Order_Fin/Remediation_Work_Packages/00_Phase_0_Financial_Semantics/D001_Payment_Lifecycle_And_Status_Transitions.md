# D001 — Payment Lifecycle and Status Transitions

## Metadata
Decision ID: D001 · Status: APPROVED (Expert)
Approval status: APPROVED
Approval type: Expert
Selected option: Option A (kept-distinct statuses + explicit transition graph, extended with the approved terminal/override rules below)
Approved decision: keep distinct lifecycle statuses where they represent different financial or gateway events; one explicit transition graph with immutable terminal states; REVERSED is lineage-bearing, never a failure; overrides only through a controlled, permissioned, fully audited back-office operation
Decision type: Status-taxonomy policy
Authoritative report sections: §5.1, §31, §31.1, H8, M6, M8
Blocks: B30, B31, B32, B33 · Affects: B4, B5, B8, B10, B16, B22, B26
Owner: Expert (see Approval record) · Approval date: 2026-07-18 · Supersedes: —

## Problem
The status vocabulary is ahead of the runtime: COMPLETED/PENDING/AUTHORIZED/FAILED sets exist and aggregate correctly, but the only implemented transition is PENDING→COMPLETED (`verifyPaymentTx`). PROCESSING gateway legs have no completion path; CANCELLED/EXPIRED/VOIDED/REFUSED/REVERSED have no writers; `allow_status_override` is dead config; collect ignores D9 creation status.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| constants/order-financial.ts:464–469 | four status sets incl. synonyms COMPLETED/CAPTURED/SETTLED | keep synonyms distinct or normalize? |
| order-settlement.service.ts:515–517 | verify accepts only PENDING | full transition graph undefined |
| order-settlement-planner.service.ts:35–39, 93 | method-family creation-status fallbacks; `allowStatusOverride` unused | creation + override rules undecided |
| order-settlement.service.ts:827 | collect hardcodes non-gateway → COMPLETED | creation-status custody per entry point |

## Invariants
1. One transition graph, owned by one service; illegal transitions throw.
2. Every transition records actor, timestamp, reason (where non-obvious), and is replay-safe (D010).
3. Creation status always resolves from D9 config with the frozen fallback chain — identical on every entry point (submit, collect, gateway).
4. Method-specific sub-lifecycles (check deposit/clear/bounce; bank verify/clear/reject; gateway auth/capture/settle) map onto the shared sets — no parallel vocabularies.

## Options (historical alternatives, pre-approval)
**A (recommended):** keep the four sets; keep the three completed synonyms (gateway clearing needs them); define the explicit graph PENDING→{COMPLETED, CANCELLED, FAILED}, PROCESSING→{COMPLETED, FAILED, CANCELLED}, AUTHORIZED→{CAPTURED, VOIDED, EXPIRED}, terminal states immutable except REVERSED via D004 reversal.
**B (rejected):** collapse synonyms to COMPLETED — simpler, loses settlement granularity for B8/B26.

## Recommended decision
Option A, finalized alongside B30 design. *(Historical recommendation — superseded by the binding Approved decision below, which adopts and extends it.)*

## Approved decision (Expert)

Keep distinct payment lifecycle statuses where they represent different financial or gateway events.

Canonical transitions:

```text
PENDING
  → PROCESSING
  → COMPLETED
  → CANCELLED
  → FAILED
  → EXPIRED

PROCESSING
  → COMPLETED
  → FAILED
  → CANCELLED

AUTHORIZED
  → CAPTURED
  → VOIDED
  → EXPIRED

CAPTURED
  → SETTLED
  → REVERSED

COMPLETED
  → REVERSED

SETTLED
  → REVERSED
```

Terminal/immutable statuses:

```text
FAILED
CANCELLED
VOIDED
EXPIRED
REVERSED
```

Rules:

* `COMPLETED`, `CAPTURED`, and `SETTLED` remain distinct.
* `REVERSED` is not a failure status.
* A reversal requires explicit lineage to the original financial transaction.
* Status overrides are permitted only through a controlled supervisor/back-office operation.
* Any override requires:
  * permission;
  * mandatory reason;
  * previous status;
  * new status;
  * audit event;
  * actor;
  * timestamp;
  * idempotency key.
* Do not expose unrestricted payment-status editing in ordinary UI.

## Rationale summary
The lifecycle statuses encode genuinely different financial/gateway events (authorization vs capture vs settlement), so collapsing them would destroy the granularity B8/B26 gateway settlement and reconciliation need. One explicit graph with immutable terminal states makes illegal writes impossible instead of merely unlikely, REVERSED-with-lineage keeps invalidation auditable and distinct from failure, and the controlled-override rule turns the dead `allow_status_override` config into a governed back-office capability rather than an uncontrolled editing surface.

## Implementation consequences
- One transition-graph authority service (B30) implements the canonical graph; every other writer (verify, collect, gateway callbacks, drawer gating) calls it — illegal transitions throw.
- `REVERSED` writers arrive with B10 (payment reversal/void) carrying mandatory lineage per D004/D010; reversal effects flow through D005 status-set membership, never refund rows.
- Status override becomes a permissioned back-office operation (B32 + B27 permission code) with the full audit payload listed above; ordinary UI never edits payment status directly.
- Creation-status custody per entry point aligns to the D9 config chain (B31); B33's corrected warning semantics already treat pending/authorized as reported buckets.
- No schema change expected (status column is TEXT with the frozen constants registry); the D001 graph feeds B27/B30 permission mapping.

## Affected work packages
[B30](../B30_Pending_Payment_Backoffice_Lifecycle.md) (transition service + worklist), [B31](../B31_Later_Collection_Default_Status.md) (creation-status alignment), [B32](../B32_Drawer_Status_Gating_And_Status_Override.md) (override implementation), [B33](../B33_Pending_Payment_Warning_Semantics.md) (warning semantics — implemented 2026-07-17), [B08](../B08_Gateway_Lifecycle_Integration.md) (gateway sub-lifecycle mapping), [B10](../B10_Payment_Reversal_And_Void.md) (REVERSED writers), [B04](../B04_Later_Collection_BVM_Parity.md)/[B05](../B05_Later_Collection_Idempotency.md) (later-collection alignment), [B16](../B16_Cash_Drawer_Filtering_And_Variance_Approval.md), [B22](../B22_Financial_Registry_Consolidation.md), [B26](../B26_Enterprise_FX_Bank_Gateway_And_ECL.md).

## Related decisions
[D004](D004_Refund_Vs_Reversal_Vs_Void.md), [D009](D009_Pending_Payment_Failure_Fallback.md), [D010](D010_Financial_Idempotency_And_Lineage.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — Option A with the extended canonical graph, terminal set, and controlled-override rules | 2026-07-18 | Recorded from the owner's authoritative decision pack (governance correction pass) |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
| 1.0 | 2026-07-18 | APPROVED (Expert) — canonical transition graph, terminal statuses, override governance recorded | Expert decision pack |
