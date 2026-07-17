# B02 — Shared Financial Aggregation

## Metadata
Backlog ID: B2 · Severity: CRITICAL · Classification: BLOCKS_PRODUCTION · Status: NOT_STARTED
Authoritative report sections: C2, §5, §13, §50-B2
Required decisions: [D005](00_Phase_0_Financial_Semantics/D005_Canonical_Outstanding_Formula.md)
Dependencies: [B01](B01_Refund_Lineage_And_Reopen_Due.md) (hard — reopen facts must exist)
Blocks: [B20](B20_Missing_Reconciliation_Checks.md), [B33](B33_Pending_Payment_Warning_Semantics.md) (impl)
Recommended phase: Seq 2

## Confirmed problem
Snapshot and reconciliation compute outstanding with different formulas (four drift sources: status set, credit filter, refund treatment, reversal semantics) — any processed refund creates a permanent false blocker (C2, §13 side-by-side).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-financial-write.service.ts:779–786 | lifecycle-set formula + reopen columns | not shared |
| reconciliation/order-checks.ts:159/140/200 | literal 'COMPLETED'; any-active credits; + all refunds | independent re-derivation |
| receipts/summary/balance readers | read header columns | fine post-refactor, must not re-derive |

## Required outcome
One aggregation module (per D005 frozen definitions) consumed by snapshot writer, reconciliation, receipts, order summary, customer balance, AR sizing, and close controls; recon verifies facts-vs-snapshot through it; snapshot output unchanged for non-refund orders. Refund expectation follows D003 v2: recon's `+ all processed refunds` term is removed — commercial refunds do not reopen due; the `refundReopens` term carries only explicit REFUND_AND_REBILL / MANUAL_EXCEPTION rows, and reversal/void/bounce/chargeback effects arrive via payment-status membership.

## Scope
Shared module; snapshot-writer internal refactor; recon order-checks rewrite; consumer repointing; equality regression suite (snapshot == recon for every §49 scenario).

## Out of scope
Reopen policy values (B1); new recon checks (B20); warning semantics (B33).

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
| Snapshot | YES (internal refactor, same outputs) |
| Reconciliation | YES |
| Customer receipt | YES (reader repoint) |
| Audit/outbox | NO |

## Acceptance criteria
Recon and snapshot agree (tolerance 0.001) on every scenario incl. refund-bearing orders; no consumer contains its own status set or credit filter; grep-guard test for literal `'COMPLETED'` in recon.

## Required tests
unit (module), integration (snapshot==recon matrix), reconciliation, regression.

## Dependencies and sequencing
After B1 VERIFIED; before B20/B33 implementation.

## Delivery surfaces

Backend services: new shared aggregation module (lib/services — consumed by order-financial-write, reconciliation/order-checks, order-financial-summary, customer-open-balance-query, AR sizing)
Database/schema: none (reads existing fact tables)
API/endpoints: none new — existing summary/reconciliation routes return the same shapes from the shared module
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: internal refactor — one formula authority replacing per-consumer re-derivation; outputs unchanged for non-refund orders
Existing consumer: order Financial tab, receipts/prints, reconciliation screens, customer balance views (all repointed, visually unchanged)
Operational visibility: reconciliation run results + snapshot warning counts (existing screens)
Failure detection: snapshot==recon equality regression suite; OUTSTANDING_TOTAL_MATCH going green on refund fixtures
Recovery method: module is pure; revert consumer repointing commit; snapshot history untouched
Reusable components/helpers: the aggregation module itself; grep-guard test forbidding literal 'COMPLETED' in recon
Permissions: none new
Validation: D005 frozen component definitions enforced in one place
i18n/RTL: NOT_APPLICABLE (no new strings)
Accessibility: NOT_APPLICABLE (no UI)
Audit trail: none new (no fact writes)
Observability: equality-check metric in recon run output
Jobs/workers: none
Feature flag: none — cutover by consumer repointing in one reviewed change
Rollout: module + writer refactor first (output-identical), then recon, then readers
Rollback: revert repointing; old formulas remain in git history only (deleted, not toggled)

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
