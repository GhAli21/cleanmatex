# B23 — Legacy Financial Path Retirement

## Metadata
Backlog ID: B23 · Severity: MEDIUM · Classification: MAINTENANCE_RISK · Status: NOT_STARTED
Authoritative report sections: §18, §50-B23
Required decisions: none
Dependencies: [B12](B12_Order_Amendment_And_Financial_Delta.md) (impl — replaces the item-edit path) · Blocks: —
Recommended phase: Seq 12

## Confirmed problem
Multiple executable secondary calculation/settlement paths remain: legacy invoice-service math (unrounded direct `org_invoice_mst.total` writes), the non-wiring `settleOrderTx` branch, duplicate preview and collect routes, duplicate breakdown adapters, pricing-calculator/orders.ts legacy recompute (§18 table).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| invoice-service.ts:410–519 | legacy invoice calc incl. `applyDiscountToInvoice` direct total write | UNSAFE_DIRECT_UPDATE |
| order-settlement.service.ts:246+ | wiringMode:false direct-write branch | bypasses BVM |
| preview-payment ≡ preview-financials; collect ≡ payments routes | duplicates | contract drift |
| lib/db/orders.ts recalc + pricing-calculator | legacy engine | retired by B12 |

## Required outcome
Legacy paths deleted or hard-deprecated (throw/redirect): one preview route, one collect route, wiring-only settlement, canonical AR math only, item math via B12 — with grep-guards preventing reintroduction.

## Scope
Route consolidation, dead-branch removal, invoice-service calc retirement, adapter unification (`toFinancialBreakdownSnapshot` vs orchestrator inline).

## Out of scope
Amendment service itself (B12); registry cleanup (B22).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO (behavior-preserving removal) |
| Payment facts | NO |
| Credit applications | NO |
| BVM | YES (no non-BVM settle path remains) |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | NO |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Grep-guards green; all callers on canonical paths; full regression suite unchanged outputs.

## Required tests
regression (full suite), API (removed-route behavior), build.

## Dependencies and sequencing
Last of the refactor waves; requires B4/B5 (collect) and B12 (item edit) landed.

## Delivery surfaces

Backend services: removals — invoice-service calc exports, settleOrderTx non-wiring branch, lib/db/orders recalc, duplicate breakdown adapter; route consolidation (one preview, one collect)
Database/schema: none
API/endpoints: deprecated route pair returns 410/redirect during grace window, then removed
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: behavior-preserving deletion of secondary paths; all user flows already on canonical routes after B4/B12
Existing consumer: canonical preview/collect/amendment paths (verified by full regression)
Operational visibility: grep-guard CI tests preventing reintroduction
Failure detection: full jest + build + §49 regression suite unchanged outputs
Recovery method: git revert per removal commit (removals staged one path per commit)
Reusable components/helpers: single breakdown adapter retained
Permissions: none
Validation: no-callers proof per removed symbol before deletion
i18n/RTL: NOT_APPLICABLE
Accessibility: NOT_APPLICABLE
Audit trail: none
Observability: 410 hit counter during grace window
Jobs/workers: none
Feature flag: none (staged commits are the rollback unit)
Rollout: strictly after B4/B5 and B12 verified; one path per commit
Rollback: revert the specific removal commit

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
