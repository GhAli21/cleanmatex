# B32 — Drawer Status Gating and Status Override

## Metadata
Backlog ID: B32 · Severity: LOW · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: M7, M8, §31.1, §50-B32
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md)
Dependencies: [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) (impl — the deferred-movement-on-verify hook needs B30's transition service; the `canHandle` status gate itself is independent and may land first) · Blocks: — · Recommended phase: Seq 6 (with the B30 wave)

## Confirmed problem
Two defensive gaps: (M7) the cash-drawer wiring handler creates CASH_SALE movements without checking payment status — a drawer-required method configured PENDING would record cash-in while paid=0 (edge case: CASH normally completes instantly); (M8) `allow_status_override` is stored on legs but never consulted — dead config.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| wiring/cash-drawer-wiring.handler.ts:22–29 | canHandle ignores payment_status | movement for pending money possible |
| order-settlement-planner.service.ts:93 | allowStatusOverride captured, unused | CONFIGURED_ONLY |

## Required outcome
Drawer movement created only for effective (COMPLETED-set) legs; when a gated leg later completes/cancels (B30), the movement is created/skipped accordingly; `allow_status_override` either implemented per D001 (who may override what) or removed from config + types.

## Scope
Handler status gate; verify-transition hook for deferred movement; override decision execution.

## Out of scope
Drawer close filtering (B16); collect path status (B31).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | YES (movement timing) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | YES (movement-link timing) |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
PENDING drawer-required leg produces no movement until completion; misconfig cannot put phantom cash in expected totals; override field either works with tests or no longer exists.

## Required tests
unit (handler gate), integration (verify-then-move), regression.

## Dependencies and sequencing
After D001; pairs naturally with B30 wave.

## Delivery surfaces

Backend services: cash-drawer wiring handler status gate; deferred-movement hook on verify transition; allow_status_override implement-or-remove decision execution (per D001)
Database/schema: none (or column drop if override removed — additive-first deprecation)
API/endpoints: none new
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: internal gating correction — movement timing changes are visible only through existing drawer session/report screens, which require no modification
Existing consumer: drawer session detail + close screens (B16 math benefits automatically)
Operational visibility: recon CASH_MOVEMENT_LINK timing checks
Failure detection: unit tests for gate + verify-then-move; recon fixtures
Recovery method: revert handler gate (movement returns to wiring time)
Reusable components/helpers: transition hooks (B30 service)
Permissions: none
Validation: movement created exactly once per effective leg
i18n/RTL: NOT_APPLICABLE
Accessibility: NOT_APPLICABLE
Audit trail: movement rows unchanged in shape
Observability: gated-movement counter
Jobs/workers: none
Feature flag: rides `order_fin.pending_worklist` wave
Rollout: with B30 (verify hook dependency)
Rollback: revert gate

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
