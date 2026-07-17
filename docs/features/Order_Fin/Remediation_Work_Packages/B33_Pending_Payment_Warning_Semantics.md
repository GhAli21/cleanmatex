# B33 — Pending Payment Warning Semantics

## Metadata
Backlog ID: B33 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: §5.1, §5.2, M9, H8, §50-B33
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D005](00_Phase_0_Financial_Semantics/D005_Canonical_Outstanding_Formula.md), [D009](00_Phase_0_Financial_Semantics/D009_Pending_Payment_Failure_Fallback.md) (reference)
Dependencies: [B02](B02_Shared_Financial_Aggregation.md) (impl — formula alignment); **independent of the B30 worklist — may be implemented separately**
Blocks: — · Recommended phase: Seq 2 (with/after B2)

## Confirmed problem
Correct the financial snapshot warning logic so a valid PENDING, PROCESSING, CAPTURE_PENDING, or AUTHORIZED payment does not emit `PENDING_PAYMENT_COUNTED_AS_PAID` or force MISMATCH merely because the pending or authorized amount exists. The warning may only be emitted when an amount from a non-completed status was actually included in `total_paid_amount` or otherwise treated as financially completed (M9 — today it fires unconditionally on `pending_payment_amount > 0`, marking healthy check/bank orders MISMATCH).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-financial-write.service.ts:397–402 | warning on any pending/authorized amount | fires on by-design states |
| order-financial-write.service.ts:361–429 → status resolver | any warning → MISMATCH | healthy orders flagged |
| §5.1 | pending/authorized excluded from paid by construction | warning contradicts own aggregation |

## Required outcome
Warning emitted only on the genuine defect condition (non-completed amount detected inside paid totals — via the D005 shared aggregation's own cross-check); by-design pending/authorized orders stay `CURRENT` with informational buckets; MISMATCH reserved for real drift.

## Scope
Warning-condition rewrite; snapshot-status mapping for the informational case; backfill-free (statuses recompute on next recalc); fixture updates.

## Out of scope
Worklist/transitions (B30); failure fallback (D009/B30); aggregation module (B2).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | YES (status/warnings only, amounts unchanged) |
| Reconciliation | YES (fewer false MISMATCH inputs) |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
D9-PENDING check order snapshots as CURRENT with pending bucket visible; injected pending-counted-as-paid corruption still fires the warning; no amount column changes.

## Required tests
unit (warning matrix across all §5.1 sets), integration (D9 PENDING scenario), reconciliation, regression.

## Dependencies and sequencing
Best after B2 (shared aggregation provides the cross-check); may proceed standalone on the current writer if B2 slips — flag the duplication for B2 cleanup.

## Delivery surfaces

Backend services: buildWarningCodes condition rewrite + snapshot-status mapping (order-financial-write.service.ts); cross-check via B2 shared aggregation
Database/schema: none (statuses recompute on next recalc)
API/endpoints: none new
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: warning-logic correction inside the snapshot writer; results render through existing surfaces
Existing consumer: order Financial tab summary, financial-debug panel, reconciliation screens (all display the corrected status/warnings automatically)
Operational visibility: MISMATCH-rate metric drops to true-defect baseline
Failure detection: warning-matrix unit tests across all §5.1 status sets; injected pending-counted-as-paid fixture must still fire
Recovery method: revert condition commit; amounts never change
Reusable components/helpers: B2 module cross-check
Permissions: none
Validation: warning fires only when non-completed amounts leak into paid totals
i18n/RTL: existing warning-label keys reused (verify EN/AR text still accurate for the narrowed meaning)
Accessibility: NOT_APPLICABLE
Audit trail: snapshot JSON records warning set as today
Observability: warning-frequency dashboard split by code
Jobs/workers: none
Feature flag: none (correction)
Rollout: after B2 preferred; standalone acceptable with duplication flagged for B2 cleanup
Rollback: revert commit

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
