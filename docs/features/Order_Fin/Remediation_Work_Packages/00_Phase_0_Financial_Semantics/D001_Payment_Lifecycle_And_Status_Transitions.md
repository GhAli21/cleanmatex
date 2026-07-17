# D001 — Payment Lifecycle and Status Transitions

## Metadata
Decision ID: D001 · Status: PROPOSED · Approved decision: NOT YET APPROVED · Decision type: Status-taxonomy policy
Authoritative report sections: §5.1, §31, §31.1, H8, M6, M8
Blocks: B30, B31, B32, B33 · Affects: B4, B5, B8, B10, B16, B22, B26
Owner: — · Approval date: — · Supersedes: —

## Problem
The status vocabulary is ahead of the runtime: COMPLETED/PENDING/AUTHORIZED/FAILED sets exist and aggregate correctly, but the only implemented transition is PENDING→COMPLETED (`verifyPaymentTx`). PROCESSING gateway legs have no completion path; CANCELLED/EXPIRED/VOIDED/REFUSED/REVERSED have no writers; `allow_status_override` is dead config; collect ignores D9 creation status.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| constants/order-financial.ts:464–469 | four status sets incl. synonyms COMPLETED/CAPTURED/SETTLED | keep synonyms distinct or normalize? |
| order-settlement.service.ts:515–517 | verify accepts only PENDING | full transition graph undefined |
| order-settlement-planner.service.ts:35–39, 93 | method-family creation-status fallbacks; `allowStatusOverride` unused | creation + override rules undecided |
| order-settlement.service.ts:827 | collect hardcodes non-gateway → COMPLETED | creation-status custody per entry point |

## Invariants (proposed)
1. One transition graph, owned by one service; illegal transitions throw.
2. Every transition records actor, timestamp, reason (where non-obvious), and is replay-safe (D010).
3. Creation status always resolves from D9 config with the frozen fallback chain — identical on every entry point (submit, collect, gateway).
4. Method-specific sub-lifecycles (check deposit/clear/bounce; bank verify/clear/reject; gateway auth/capture/settle) map onto the shared sets — no parallel vocabularies.

## Decision scope (to finalize on approval)
- Allowed transitions per family (cash, card, check, bank, gateway) incl. verification, cancellation, failure, bounce, expiry, void, reversal.
- Whether COMPLETED/CAPTURED/SETTLED stay distinct values (gateway settlement reporting) or collapse to COMPLETED.
- `allow_status_override` semantics: implement (who may override what) or remove (B32).
- Transition permissions mapping (feeds B27/B30).

## Options
**A (recommended):** keep the four sets; keep the three completed synonyms (gateway clearing needs them); define the explicit graph PENDING→{COMPLETED, CANCELLED, FAILED}, PROCESSING→{COMPLETED, FAILED, CANCELLED}, AUTHORIZED→{CAPTURED, VOIDED, EXPIRED}, terminal states immutable except REVERSED via D004 reversal.
**B:** collapse synonyms to COMPLETED — simpler, loses settlement granularity for B8/B26.

## Recommended decision
Option A, finalized alongside B30 design.

## Financial / runtime / database impact
Feeds §31.1 workstation actions, B31 collect alignment, B33 warning logic; likely no schema change (status column already free-text with registry).

## Related decisions / affected packages
[D004](D004_Refund_Vs_Reversal_Vs_Void.md), [D009](D009_Pending_Payment_Failure_Fallback.md), [D010](D010_Financial_Idempotency_And_Lineage.md) → [B30](../B30_Pending_Payment_Backoffice_Lifecycle.md), [B31](../B31_Later_Collection_Default_Status.md), [B32](../B32_Drawer_Status_Gating_And_Status_Override.md), [B33](../B33_Pending_Payment_Warning_Semantics.md), [B08](../B08_Gateway_Lifecycle_Integration.md), [B10](../B10_Payment_Reversal_And_Void.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
