# B16 — Cash Drawer Filtering and Variance Approval

## Metadata
Backlog ID: B16 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: M2, §17, §40, §50-B16
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md) (status sets)
Dependencies: none · Blocks: — · Recommended phase: Seq 3

## Confirmed problem
Drawer-close expected-cash sums ALL session-linked payments — no `payment_status` COMPLETED filter, no `is_active` filter (cash-drawer.service.ts:1428) — pending checks/gateway legs inflate expected cash; variance has no approval workflow (§40).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| cash-drawer.service.ts:1426–1457 | unfiltered aggregate → expected/variance | wrong variance possible |
| session summary/report path | same aggregation | consistent but equally wrong |
| §40 | variance approval NOT_FOUND | stored, ungated |

## Required outcome
Expected cash includes only active, financially successful cash facts (COMPLETED set, is_active, CASH-family) plus movements; variance beyond a configurable threshold requires an approval action with reason (permission via B27); close report reflects the filtered math.

## Scope
Aggregate filter fix (close + summary + report); variance approval gate + audit fields.

## Out of scope
Safe/bank-deposit operations (B26); refund OUT movements (B9); PENDING drawer gating (B32).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | YES (expected/variance math) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (variance journal later, B6) |
| Snapshot | NO |
| Reconciliation | YES (drawer checks) |
| Customer receipt | NO |
| Audit/outbox | YES (approval record) |

## Acceptance criteria
Session with a pending check leg closes with expected cash excluding it; variance above threshold blocks close until approved with reason.

## Required tests
unit, integration (close scenarios), UI (approval), regression.

## Dependencies and sequencing
Independent; coordinate the status set with D001.

## Delivery surfaces

Backend services: closeSession/loadSummaryData aggregate filter (COMPLETED set + is_active + CASH family); variance-approval gate service
Database/schema: variance approval columns on session close (approver, reason, threshold snapshot) — assess additive
API/endpoints: close endpoint gains approval sub-flow (threshold exceeded → requires approval payload)
Frontend page/screen/dialog/action: drawer close screen — expected-cash breakdown shows only effective facts; variance-over-threshold triggers an approval dialog (approver + mandatory reason); session detail displays approval record
Reusable components/helpers: approval dialog pattern (shared with B24/B12)
Permissions: variance-approval code via B27
Validation: threshold from tenant config; approver ≠ closer
i18n/RTL: EN/AR close/approval strings
Accessibility: dialog focus; variance announced as text
Audit trail: approval actor/reason on session row
Observability: variance distribution metric; recon drawer checks
Jobs/workers: cash-close escalation deferred (B19/§45)
Feature flag: `order_fin.drawer_close_v2`
Rollout: staging parity (filtered expected vs physical counts) → enable
Rollback: flag off restores current aggregate (documented known M2)

## End-to-end operational flow

1. Cashier closes drawer → expected cash computed from effective facts only; pending checks visibly excluded with a note.
2. Variance within threshold → close completes; beyond threshold → approval dialog; approver confirms with reason → close records both actors.
3. Session detail and drawer report show the same filtered math and the approval trail.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (approval action disabled with reason), duplicate-click protection (in-flight disable), processing, success, retry on failure; approval trail visible on the session record.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind `order_fin.drawer_close_v2`
Production activation allowed: ships as one unit with the corrected aggregate — the new close screen never renders over the unfiltered math
Required backend gates: filtered expected-cash aggregate in the same release
Required decision gates: D001 (COMPLETED-set conformance)
Required verification gates: close-parity tests (filtered vs physical counts) green

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
