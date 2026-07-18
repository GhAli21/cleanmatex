# B02 — Shared Financial Aggregation

## Metadata
Backlog ID: B2 · Severity: CRITICAL · Classification: BLOCKS_PRODUCTION · Status: **IMPLEMENTED 2026-07-17 (overnight continuation directive)** — awaiting owner commit → Preview QA → approval before VERIFIED; B1 predecessor is itself IMPLEMENTED-not-yet-VERIFIED (start-gate deferred to implementation-order per the recorded overnight extension; nothing promotes to production before both QAs)
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

**Migration:** none (as planned — reads existing fact tables).

**Implementation files (2026-07-17):**
- `web-admin/lib/services/order-financial-aggregation.ts` — NEW: the D005 aggregation authority (pure module, client-safe). Frozen components: `sumEffectivePayments` (COMPLETED set {COMPLETED, CAPTURED, SETTLED} + `isClearlyRealPaymentRow` nature filter — canonical union of the pre-B02 writer/read-fallback marker sets), `sumEffectiveCredits` (APPLIED-only, NULL→APPLIED), `sumRefundReopens` / `sumProcessedRefunds` (PROCESSED-only), `computeOutstanding` (max(0, round4(…))), `aggregateOrderFinancials`, `classifyRefunds` + `RefundFactRow` (moved from the writer; legacy heuristic's stored-value alias list corrected to the metadata strings 0340 actually wrote), `ORDER_FINANCIAL_COMPARISON_TOLERANCE = 0.001` (D005 invariant 4)
- `web-admin/lib/services/order-financial-write.service.ts` — internal refactor, output-identical: local `isClearlyRealPaymentRow`/`sumPaymentStatusAmount`/`sumCreditApplicationStatusAmount`/`hasAmbiguousHistoricalPaymentRow`/`classifyRefunds` deleted; components + outstanding via the module; `classifyRefunds`/`RefundFactRow` re-exported for existing consumers
- `web-admin/lib/services/reconciliation/order-checks.ts` — `runOrderBalanceChecks` rewritten through `aggregateOrderFinancials`: literal completed-status filter, any-active credit sum, and the `+ processedRefunds` term removed; order-level checks compare at 0.001; `checkOrderPaymentLink` uses the frozen COMPLETED set; gateway-pending uses `isCompletedPaymentStatus`; `checkRefundSourceLineageClassification` accepts LEGACY_REFUND_SOURCE_TYPES (read-only pre-0404 values) while still flagging MANUAL_EXCEPTION/unknown
- `web-admin/lib/utils/order-financial-effective-snapshot.ts` — read fallback repointed to the module (payments/credits/refund classification); outstanding fallback now includes the previously-dropped refundReopens term; refunds input extended with optional B01 facts
- `web-admin/lib/services/order-financial-summary.service.ts` — supplies `refund_source_type`/`reopens_due_amount`/`metadata` to the read fallback

**Tests:** `web-admin/__tests__/services/order-financial-aggregation.test.ts` (NEW — 29 tests: frozen component definitions, formula clamp/round, 12-scenario snapshot==recon equality matrix incl. refund-bearing orders, proof that the retired `+ processedRefunds` formula diverges [the C2 defect], grep-guard forbidding literal completed-status strings under `lib/services/reconciliation/**`) · updated: `reconciliation/check-modules.test.ts` (fetch-shape + two OUTSTANDING_TOTAL_MATCH refund scenarios: commercial refund clean, explicit reopen flagged).

**Gates (2026-07-17):** `npx eslint . --quiet` ✅ 0 · `npx tsc --noEmit` — B02 files clean (same 2 pre-existing errors in owner-committed keypad/split-tender files as recorded in B01 evidence) · targeted suites 139/139 ✅ · full jest + build: recorded below.

**Commit:** — (owner commits) · **Preview QA (deploy/result/approval):** — pending · **Reviewer:** — · **Verification:** — (VERIFIED requires Preview QA approval; B1+B2 QA naturally batch) · **Authoritative report update:** —
