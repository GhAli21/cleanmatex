# B28 — Financial Regression Test Coverage

## Metadata
Backlog ID: B28 · Severity: HIGH · Classification: CONTROL_GAP · Status: IN_PROGRESS (continuous — this is a per-wave-growing umbrella, never "done"; audited + one concrete gap closed 2026-07-25)
Authoritative report sections: §49 (Tests column), §50-B28
Required decisions: none
Dependencies: B1–B5 (test — grows per wave; every wave contributes its slice) · Blocks: —
Recommended phase: continuous

## Confirmed problem
§49 shows `none`/`partial` test coverage on every NOT_READY scenario: refund-outstanding, collect retry, amendments after payment, cancellation variants, D9 PENDING flows, concurrent payment/refund — the flows most likely to corrupt money are the least tested.

## Current evidence — re-audited against live test files 2026-07-25 (§49's 2026-07-15 snapshot is heavily stale; almost every package it references has since shipped its own tests as part of implementation — this is the actual B28 "per-wave slice" contribution, just not previously cataloged under this label)

**Re-verified each still-relevant §49 row against the CURRENT `__tests__/` tree** (chargeback/closed-period/voucher-unwind rows skipped — their underlying features are still NOT_STARTED, B26/B24/B13, so there is nothing to test yet; that is a feature gap, not a test gap):

| §49 scenario | Verdict | Detail |
|---|---|---|
| Order increase/decrease after payment (B12) | **GENUINE GAP** | `order-amendment.service.test.ts` only unit-tests the 4 exported functions with `prisma` fully mocked. No test drives `OrderService.updateOrder`'s governed-amendment gate (`order-service.ts` ~lines 2971–3425) with a real prior payment and asserts the resulting `financialDelta`/outstanding snapshot end-to-end. **Fixed this pass**: the settlement-completion route (`.../edit-history/[editHistoryId]/settlement/route.ts`) had zero coverage — new `__tests__/api/v1/orders/amendment-settlement.route.test.ts` (9/9 passing) closes that specific piece (permission/CSRF gates, schema validation, `issuedBy` attribution, error-code mapping, idempotent-replay passthrough). The larger `OrderService.updateOrder` end-to-end gap remains — see Required follow-up below. |
| Refund cash/original method (B1/B9) | PARTIAL | `order-refund-b9-execution.test.ts` genuinely covers CASH → drawer OUT + REFUND_VOUCHER, ORIGINAL_METHOD → manual reference, via the real `processRefund`. Gap: no test calls the real `recalculateOrderFinancialSnapshotTx` with refund fixtures to positively prove snapshot=reconciliation equality end-to-end (only proxy-tested via an inline formula in `refund-b01-matrix.test.ts`). |
| Duplicate retry (collect) (B5) | **REAL COVERAGE** | `settlement.service.test.ts`'s `'idempotency (B5/D010)'` block calls the real `collectPaymentTx` for identical-payload replay and different-payload conflict — genuine, path-specific. |
| Concurrent payment/refund | **GENUINE GAP** | Existing "concurrency" tests mock `$queryRaw` to simulate a lock-miss (`refund-b01-matrix.test.ts` #12, `refund.service.test.ts` F-R2) — they test the code's *reaction* to a lock already being held, not two real simultaneous transactions racing for it. No test proves actual lock ordering under real concurrent execution. |
| D9 PENDING at later collection (B31/B32) | **REAL COVERAGE** | `settlement.service.test.ts` has explicit tests calling the real `collectPaymentTx` for both the D9-config resolution and the explicit-override path. |
| Cancel partially/fully paid (B1/B9/B6) | PARTIAL | `order-cancel-financials.service.test.ts` (FN-02) is solid for ledger reversal/disposition-gating/promo-reversal/emits, but `initiateRefund` and `recalculateOrderFinancialSnapshotTx` are mocked stubs — no test chains real unwind → real `initiateRefund` → `approveRefund` → real `processRefund` → real snapshot recalc as one flow. |
| Tax-inclusive order (B11) | **REAL COVERAGE, direct** | `order-calculation.service.test.ts`'s `'calculateOrderTotals TAX_INCLUSIVE (B11)'` block calls the actual orchestrator function directly (not just the underlying formula) — 4 tests including a combined B11+B17 case. `b11-tax-inclusive-consistency.test.ts` additionally proves the extraction/reconstruction formulas agree, though it simulates preview-vs-submit by calling `calculateTax` twice rather than diffing the real preview-route vs. submit-orchestrator code paths — a narrower, lower-priority residual gap (route-level param-mapping parity, not calculation correctness). |
| Rounding adjustment (B17) | **REAL COVERAGE, direct** | Same file, `'calculateOrderTotals currency rounding (B17)'` block — 4 tests against the real orchestrator, including the combined-with-B11 case. Same narrower residual as above (route-level parity, not formula correctness). |

## Required follow-up (precisely scoped, for a reviewed session — not attempted unattended)
1. **`OrderService.updateOrder` governed-amendment end-to-end test.** Mock `getOrderById`, `checkOrderLock`, `calculateOrderTotals` (dry-run reprice), `createEditAudit`, `unlockOrder`, and the Prisma `$transaction` client at the model level (mirror `order-refund-b9-execution.test.ts`'s "call the real exported function, mock its dependencies" pattern) — call the real `OrderService.updateOrder` with an order that has `total_paid_amount > 0` and an item change, assert `financialDelta`/`editHistoryId`/`requiresSettlement` are correctly derived and that `computeAmendmentDelta`/`assertGovernedAmendmentAllowed`/`stakeAmendmentIdempotency` (already-tested pure functions) are wired with the right inputs — this test proves the *glue*, not functions already covered in isolation. Deliberately not attempted in this pass: building it correctly requires mocking ~10 collaborators without a live DB to validate the mock shapes against, and an incorrectly-mocked integration test is worse than no test (false confidence) — better done with a human able to spot-check the mock fidelity.
2. **A real concurrent payment/refund test** — likely needs the `__tests__/db-integration/` pattern (a real local test DB, as already used by `tax-document-einvoice-status.db.test.ts`) rather than a mocked-Prisma unit test, since true lock-ordering can't be proven without two actual concurrent transactions. Infra decision (which local DB, how CI runs it) belongs to a reviewed session, not an unattended one.
3. **Cancel-chain real end-to-end test** (unwind → refund → snapshot as one flow) — same shape/effort as #1.
4. **Preview-route vs. submit-orchestrator parameter-mapping parity** for TAX_INCLUSIVE/rounding — lower priority; the calculation engine itself is already directly and correctly tested (see table above), this would only catch a request-mapping divergence between the two routes, not a formula bug.

## Required outcome
A scenario-matrix regression suite mirroring §49 rows: each implemented row gets formula assertion, fact-row assertion, BVM parity, snapshot==recon equality (post-B2), duplicate-retry and concurrency variants; suite gates every remediation wave's VERIFIED status.

## Scope
Suite skeleton + fixtures library (tenants, currencies, tax modes, methods); per-wave additions owned by each Bxx but landed under this umbrella's structure; CI wiring.

## Out of scope
Implementing the flows (respective packages); manual QA scripts.

## Financial effects
| Area | Impact |
|---|---|
| All areas | NO (test-only) — protects every YES elsewhere |

## Acceptance criteria
Every §49 scenario implemented-to-date has a green matrix entry; a wave cannot be VERIFIED with a red or missing slice; suite runs in CI.

## Required tests
This package IS the tests: unit, integration, database, API, idempotency, concurrency, reconciliation, accounting (as flows land), regression.

## Dependencies and sequencing
Skeleton early; slices per wave (B1 slice first).

## Delivery surfaces

Backend services: NOT_APPLICABLE (test-only package)
Database/schema: test fixtures/seeds only (never production migrations)
API/endpoints: exercised, not created
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: regression-suite umbrella — it verifies other packages' surfaces (including their UI flows via UI tests) without shipping any
Existing consumer: CI pipeline; every Bxx VERIFIED gate
Operational visibility: CI results per wave slice; §49 matrix coverage report
Failure detection: red slice blocks the owning package's VERIFIED status
Recovery method: NOT_APPLICABLE (tests)
Reusable components/helpers: fixtures library (tenants, currencies, tax modes, methods)
Permissions: NOT_APPLICABLE
Validation: scenario↔§49 row traceability
i18n/RTL: NOT_APPLICABLE
Accessibility: NOT_APPLICABLE (UI a11y assertions live in each package's UI tests)
Audit trail: NOT_APPLICABLE
Observability: coverage trend per §49 row
Jobs/workers: CI scheduling only
Feature flag: none
Rollout: skeleton + B1 slice first; grows per wave
Rollback: NOT_APPLICABLE

## Completion evidence
Migration: none (test-only package, per its own Delivery surfaces — no migration ever expected) · Implementation files: none (test-only) · Tests: new `__tests__/api/v1/orders/amendment-settlement.route.test.ts` (9/9 passing) — closes the settlement-completion route's previously-zero coverage; full audit of 8 §49 scenario rows against current test files recorded in Current evidence above (2 confirmed real/direct, 3 partial with precisely-named residual gaps, 1 confirmed genuine gap now partially closed, 2 confirmed genuine gaps left as scoped follow-up items #2/#3 above) · Gates: tsc clean (4 pre-existing/unrelated errors, none touched) / eslint 0 / full jest includes the new suite, zero regressions / `npm run build` unaffected (test-only change) · Commit: pending (owner) · Preview QA: n/a (test-only, no user-facing behavior) · Reviewer: — · Verification: this package is never "VERIFIED" in the usual sense — it's continuous or per its own doc; treat as ongoing · Authoritative report update: not filed separately, per this session's established precedent.
