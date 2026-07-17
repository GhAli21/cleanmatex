# B12 — Order Amendment and Financial Delta

## Metadata
Backlog ID: B12 · Severity: HIGH · Classification: BLOCKS_FEATURE / MAINTENANCE_RISK · Status: NOT_STARTED
Authoritative report sections: §10, §29, M4, §50-B12
Required decisions: [D011](00_Phase_0_Financial_Semantics/D011_Order_Amendment_And_Delta_Rules.md), [D003](00_Phase_0_Financial_Semantics/D003_Refund_Reopen_Due_Rules.md), [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: none · Blocks: [B14](B14_Tax_Document_Runtime_Integration.md) (partial), [B23](B23_Legacy_Financial_Path_Retirement.md) (impl)
Recommended phase: Seq 11

## Confirmed problem
Item add/remove flows through a legacy direct-header-update path (UNSAFE_DIRECT_UPDATE, 0.05 VAT fallback, inclusive assumption) with no amendment record, no delta, no settlement consequence — paid orders silently grow outstanding; decreases create undisposed overpayment (§29).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| preparation/[id]/items route → lib/db/orders.ts:867–939 | independent recompute + header overwrite | ungoverned mutation |
| §29 matrix | ~15 mutation types NOT_FOUND/UNSAFE | no OrderAmendmentService |
| §10 | no delta model / immutable record | D011 model unimplemented |

## Required outcome
`OrderAmendmentService` implementing the D011 frozen model: before/after snapshots, canonical repricing, immutable amendment record, delta settlement consequence (collect-additional or overpayment resolution), approval gates, per-mutation idempotency; legacy recalc path retired for governed mutations.

## Scope
Amendment service + record table (migration); item add/remove/qty/price-override mutations first; delta settlement hooks into existing planner/disposition; workflow-stage gating.
**Frontend surface (rule 7):** amendment flow in the order workspace — delta review step (before/after totals), collect-additional dialog (reuses payment modal) for positive deltas, overpayment-resolution dialog for negative deltas, amendment history on the order detail.

## Out of scope
Tax-document adjustments (B14 provides the surface); full mutation catalogue beyond the §29 top set (phased); revenue impact (B25).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | YES |
| Payment facts | POSSIBLE (additional collection) |
| Credit applications | POSSIBLE (D006 reversal on decrease) |
| BVM | POSSIBLE (delta tender voucher) |
| Cash drawer | POSSIBLE |
| Gateway or bank | NO |
| Tax documents | POSSIBLE (via B14) |
| ERP-Lite GL | POSSIBLE (via B6) |
| Snapshot | YES |
| Reconciliation | YES (amendment checks) |
| Customer receipt | YES (amended receipt) |
| Audit/outbox | YES (amendment events) |

## Acceptance criteria
Post-payment item add produces a delta record and an explicit due/collect step (never silent outstanding); decrease produces a governed overpayment resolution; header totals only ever written by the canonical engine.

## Required tests
unit, integration (§49 increase/decrease rows), database, API, idempotency, concurrency, reconciliation, regression.

## Dependencies and sequencing
D011 approval; coordinates with B11 (same engine) and feeds B23 retirement.

## Delivery surfaces

Backend services: OrderAmendmentService (before/after snapshot, canonical repricing, delta, settlement consequence); retires lib/db/orders.ts recalc for governed mutations
Database/schema: amendment record table (immutable rows: before/after totals, delta, actor, reason, lineage) — migration
API/endpoints: POST /orders/[id]/amendments (typed mutation payload + idempotency key); GET amendments list
Frontend page/screen/dialog/action: order workspace amendment flow — delta review step (before/after totals), collect-additional dialog (reuses payment modal) for positive delta, overpayment-resolution dialog for negative delta, amendment history tab on order detail
Reusable components/helpers: payment modal reuse; disposition dialog reuse; delta summary component
Permissions: amendment codes + threshold approvals via B27; workflow-stage gating
Validation: stage legality; repricing via canonical engine only; delta settlement mandatory before commit when positive beyond tolerance
i18n/RTL: EN/AR for amendment flow, deltas, history
Accessibility: multi-step dialog focus order; totals announced
Audit trail: immutable amendment rows; outbox amendment events
Observability: amendment counts; recon amendment checks
Jobs/workers: none
Feature flag: `order_fin.governed_amendments` — legacy item routes blocked when enabled
Rollout: service+table → screens behind flag → staging delta scenarios → enable → retire legacy path (B23)
Rollback: flag off restores legacy item flow (accepting §29 risk, documented)

## End-to-end operational flow

1. Operator edits items on a paid order → amendment preview shows before/after totals and the delta.
2. Positive delta → collect-additional dialog (tender or POC/AR per policy); negative delta → overpayment resolution (change/wallet/CN per D003/D006).
3. Commit writes the amendment record + reprices via the engine + settles the consequence + recalcs snapshot atomically; history tab shows the immutable trail.
4. Retry with the same key replays; recon amendment checks stay green.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (action disabled with reason), duplicate-click protection (in-flight disable + idempotent replay), processing, success, retry on failure; amendment history tab shows the immutable trail.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: only after D011 approval and the legacy path is blocked for governed mutations (no dual write paths)
Required backend gates: legacy item path blocked when flag enabled; B11 recommended first (tax-mode-correct repricing)
Required decision gates: D011, D003, D010 approved
Required verification gates: §49 increase/decrease-after-payment scenarios green; concurrency + replay tests passed

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
