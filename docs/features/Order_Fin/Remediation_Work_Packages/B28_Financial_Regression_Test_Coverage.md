# B28 — Financial Regression Test Coverage

## Metadata
Backlog ID: B28 · Severity: HIGH · Classification: CONTROL_GAP · Status: IN_PROGRESS (continuous — this is a per-wave-growing umbrella, never "done"; audited 2026-07-25/26, all 5 follow-up items from that audit now resolved — 4 closed with real DB-integration/schema-parity tests, 1 (#5) resolved as a documented, not-yet-approved recommendation. Follow-up #4 additionally surfaced a NEW, higher-severity finding than originally scoped — see below)
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
| Order increase/decrease after payment (B12) | **CLOSED 2026-07-26** | `order-amendment.service.test.ts` only unit-tests the 4 exported functions with `prisma` fully mocked — no test drove the real `updateOrder` glue. **Closed in two passes**: (1) the settlement-completion route (`.../edit-history/[editHistoryId]/settlement/route.ts`) had zero coverage — new `__tests__/api/v1/orders/amendment-settlement.route.test.ts` (9/9 passing). (2) The larger end-to-end gap — new `__tests__/db-integration/order-amendment-governed-flow.db.test.ts` (2/2 passing) calls the real `OrderService.updateOrder` against a real seeded order + real prior payment on the local DB, proving the reason-required gate AND the full governed-increase flow, including that `outstanding_amount` reflects the REAL `recalculateOrderFinancialSnapshotTx` recompute (not a naive overwrite — the exact bug B12 fixed) end-to-end. See its own file header for the precisely-scoped mocks (feature flag, permission check, Next.js request-scoped cookies, and `calculateOrderTotals`/tenant-currency-config — both of which need network infrastructure this test correctly declines to depend on, since their own correctness is covered elsewhere). |
| Refund cash/original method (B1/B9) | PARTIAL | `order-refund-b9-execution.test.ts` genuinely covers CASH → drawer OUT + REFUND_VOUCHER, ORIGINAL_METHOD → manual reference, via the real `processRefund`. Gap: no test calls the real `recalculateOrderFinancialSnapshotTx` with refund fixtures to positively prove snapshot=reconciliation equality end-to-end (only proxy-tested via an inline formula in `refund-b01-matrix.test.ts`). |
| Duplicate retry (collect) (B5) | **REAL COVERAGE** | `settlement.service.test.ts`'s `'idempotency (B5/D010)'` block calls the real `collectPaymentTx` for identical-payload replay and different-payload conflict — genuine, path-specific. |
| Concurrent payment/refund | **CLOSED 2026-07-26** | Existing "concurrency" tests mock `$queryRaw` to simulate a lock-miss (`refund-b01-matrix.test.ts` #12, `refund.service.test.ts` F-R2) — they test the code's *reaction* to a lock already being held, not two real simultaneous transactions racing for it. New `__tests__/db-integration/refund-concurrent-processing.db.test.ts` (2/2 passing) fires two genuinely concurrent `processRefund()` calls (real Postgres connections, real `FOR UPDATE` row lock) against the same APPROVED refund on the local DB — proves exactly one processes and the other is rejected by the lock, matching the double-issue scenario the code comment describes. **Related finding, NOT a bug, recorded for awareness**: the analogous concurrency test attempted for `OrderService.updateOrder`'s idempotency key (two concurrent calls, same key+payload) did NOT reliably replay — both created their own edit-history row. Traced precisely: `stakeAmendmentIdempotency` only marks a key "already completed" via `completeAmendmentIdempotency`, called at the very end of `updateOrder`'s transaction — two calls that both reach the stake check before either finishes both see no completed record and both proceed. This is not reachable by a real caller in practice: `updateOrder`'s own earlier `checkOrderLock` step requires the caller to hold the order's edit lock, which the UI always acquires first — a genuine second concurrent editor is rejected with "Order is locked" before ever reaching the idempotency stake. Not fixed or asserted as a passing test here (would need a dedicated, reviewed investigation of the lock+idempotency interaction under true concurrency); documented in full in `order-amendment-governed-flow.db.test.ts`'s trailing comment rather than silently dropped or papered over with an unrealistic test. |
| D9 PENDING at later collection (B31/B32) | **REAL COVERAGE** | `settlement.service.test.ts` has explicit tests calling the real `collectPaymentTx` for both the D9-config resolution and the explicit-override path. |
| Cancel partially/fully paid (B1/B9/B6) | **CLOSED 2026-07-26 (chain), PARTIAL (unwind-only) — scope caveat below** | `order-cancel-financials.service.test.ts` (FN-02) is solid for ledger reversal/disposition-gating/promo-reversal/emits with `initiateRefund`/`recalculateOrderFinancialSnapshotTx` mocked. New `__tests__/db-integration/order-cancel-chain-flow.db.test.ts` (2/2 passing) closes the chain gap: real `unwindOrderFinancialsOnCancel` (REFUND disposition) → real `initiateRefund` → real `approveRefund` → real `processRefund` → real snapshot recalc, against a real seeded paid order — proves the D003 v2 "cancellation unwind never reopens the customer's due" rule end-to-end (`refund_reopens_due_amount`/`outstanding_amount` both stay 0 after a full refund) and surfaces a real, non-obvious characteristic: `payment_status` stays `'PAID'` even after the entire payment is refunded, because `resolveHeaderPaymentStatus` compares the gross `total_paid_amount` (unaffected by refunds) against `total_amount`, not the refund-aware `net_collected_amount` — documented, not changed (arguably correct as designed; not evaluated further here). A second test covers the STORE_CREDIT disposition branch (synchronous credit-note issuance, no separate approve/process step) and documents that it leaves the order's own snapshot numbers untouched (the credit note is issued to the customer, not applied against the now-cancelled order). Residual, still-PARTIAL: no test chains a real `initiateRefund` triggered from the ORIGINAL (non-cancellation) refund-request path end-to-end through disposition — only the cancel-unwind-initiated refund path is covered by the new chain test. **Scope caveat (found while cross-checking `docs/features/Workflow_Order_Advance/ADR_CANCEL_RETURN_RULES.md`, 2026-07-25, at the owner's request):** `unwindOrderFinancialsOnCancel` is the LEGACY "Enhanced" cancel path — real, live, and the DEFAULT for every tenant today (`isWorkflowEngineV2Enabled()` defaults false). The ADR **supersedes** this design going forward: Workflow Engine V2's `CANCEL_ORDER` action (already implemented, `lib/services/workflow/workflow-engine.service.ts`) performs **no automatic financial unwind at all** and restricts cancel to `draft`/`intake`/incomplete-`preparing` only — money moves solely through separate, explicit "Fin screen" actions the ADR itself says are not yet built. `cancel-order-dialog.tsx` is already engine-aware (disposition picker only renders/sends under the legacy engine). This test protects real, currently-default production behavior, but is expected to become obsolete once Engine V2 becomes the tenant default and the legacy disposition path is retired — noted here so it isn't mistaken for validating the ADR-compliant, forward design. See the test file's own header for the full trace. |
| Tax-inclusive order (B11) | **REAL COVERAGE, direct** (formula) — **real gap found under "parity", see below** | `order-calculation.service.test.ts`'s `'calculateOrderTotals TAX_INCLUSIVE (B11)'` block calls the actual orchestrator function directly (not just the underlying formula) — 4 tests including a combined B11+B17 case. `b11-tax-inclusive-consistency.test.ts` additionally proves the extraction/reconstruction formulas agree, though it simulates preview-vs-submit by calling `calculateTax` twice rather than diffing the real preview-route vs. submit-orchestrator code paths. The FORMULA is correct and well-covered; investigating the "route-level param-mapping parity" angle (follow-up #4) found a genuine, higher-severity REQUEST-SCHEMA gap unrelated to TAX_INCLUSIVE specifically — see "New finding from follow-up #4" below. |
| Rounding adjustment (B17) | **REAL COVERAGE, direct** | Same file, `'calculateOrderTotals currency rounding (B17)'` block — 4 tests against the real orchestrator, including the combined-with-B11 case. No rounding-specific parity gap found (see below — the found gap is in the legacy no-tax-profile fallback params, not rounding). |

## Required follow-up (precisely scoped, for a reviewed session — not attempted unattended)
1. ~~`OrderService.updateOrder` governed-amendment end-to-end test~~ — **CLOSED 2026-07-26**, see table above.
2. ~~A real concurrent payment/refund test~~ — **CLOSED 2026-07-26**, see table above.
3. ~~Cancel-chain real end-to-end test~~ — **CLOSED 2026-08-13** — `__tests__/db-integration/order-cancel-chain-flow.db.test.ts` (2/2), see table above.
4. ~~Preview-route vs. submit-orchestrator parameter-mapping parity~~ — **CLOSED 2026-08-13, upgraded to a real finding** (not just a theoretical parity nitpick — see "New finding from follow-up #4" below). New `__tests__/validations/preview-submit-param-parity.test.ts` (4/4) proves it at the schema level.
5. **Idempotency-vs-edit-lock design decision** — **RESOLVED as a recommendation 2026-08-13** (Recommended decision below; **Approved decision: NOT YET APPROVED** — owner has not authorized the implementation change).

### ✅ RESOLVED 2026-08-13 — follow-up #4's finding was FIXED by removal (owner-authorized)

**Outcome first:** the ad-hoc `additionalTaxRate` / `additionalTaxAmount` client override was **removed entirely** rather than mirrored onto the preview schema. Owner discussed the options and chose the removal route ("what if we consider the tax only if there is a configured tax profile"), which is the better fix — it eliminates the parity gap permanently instead of requiring two schemas to be kept in sync forever.

**Severity correction (recorded honestly):** the original write-up below called this a live money bug. Tracing the full client→submit path before fixing showed it was **dead code in practice**, not actively mis-charging anyone: `use-payment-totals.ts` hardcodes the client's `totals.taxRate` to `0` in *both* branches of its totals memo (lines 408 and 440), so `use-order-submission.ts`'s `payload.totals.taxRate > 0` send condition could never fire; a repo-wide grep confirmed no other caller (B2B, public API, any route) sent either field. So the schema gap was real, but no tenant was being mis-charged. Fixing by removal was therefore zero-risk.

**What was removed:**
- `OrderCalculationParams.additionalTaxRate` / `.additionalTaxAmount` + the override branch inside `calculateOrderTotals`'s no-profile fallback (`order-calculation.service.ts`).
- Both fields from `createWithPaymentRequestSchema` (`new-order-payment-schemas.ts`) — which also removes them from `submitOrderRequestSchema`/`SubmitOrderRequest`, since those derive from it.
- The two now-dead consumers in `order-submit-orchestrator.service.ts`: the pass-through into `calculateOrderTotals`, the `taxRate` fallback-derivation ternary, and the synthesized `'Additional Tax'` CUSTOM tax line (unreachable — `additionalTaxAmount` is derived from CUSTOM *profile* lines, which cannot exist when `taxBreakdown` is empty, which is the only case that branch ran in).
- The conditional send block in `use-order-submission.ts`.

**What deliberately stayed:** `OrderCalculationResult.additionalTaxAmount` (still meaningful — it is the sum of `CUSTOM`-type **tax-profile** lines, reported separately from VAT/GST) and its consumers in `use-payment-totals.ts` / the orchestrator's snapshot. Tax now resolves from exactly two authoritative sources: **configured tax profiles**, and the server-resolved **`TENANT_VAT_RATE`** fallback (already zero-by-default per B15's "no invented tax" policy).

**Database: nothing to drop.** The owner asked whether matching DB columns should be removed too. Checked the remote DB directly: no `additional_tax*` (or any `additional%`) column exists in `public` — the override was purely a request param feeding an in-memory calculation, never persisted under its own column. **Specifically do NOT drop `org_orders_mst.tax_rate`**, which looks like a candidate but is not: it stores the CUSTOM tax-**profile** rate, is written by the surviving profile-driven path (`order-service.ts:1257`), and holds real data on 72 of 74 live orders (`tax_rate = 2.000`, the Municipality profile). No migration was needed or authored for this change.

**Regression guard:** `__tests__/validations/preview-submit-param-parity.test.ts` (4/4) rewritten from "proves the gap exists" to "fails if anyone re-introduces a client-supplied tax override on submit without wiring it into preview," plus assertions that `taxProfileIds` is accepted identically by both schemas and that the two remaining, deliberate asymmetries (`promoCodeId`, `serviceCategories`) stay documented rather than drifting unnoticed. Reference docs corrected: `Order_Fin_Docs/TAX_ENGINE_GUIDE.md` (§ Additional Tax rewritten with a removal note) and `Order_Fin_Docs/ORDER_FINANCIAL_PLATFORM.md` (grand-total formula line).

**Gates after the fix:** tsc clean (3 pre-existing/unrelated errors, none touched) · eslint 0 on all changed files · full jest **251/251 suites, 2393/2393 tests** · `npm run build` ✓ (exit 0, 271 static pages).

---

### Original finding from follow-up #4 (2026-08-13) — kept for the record; see resolution above

`previewPaymentRequestSchema` (used by BOTH `/api/v1/orders/preview-payment` and `/api/v1/orders/preview-financials` — the routes that compute what the payment modal shows before submit) has **no `additionalTaxRate`, `additionalTaxAmount`, or `promoCodeId` fields at all**. `createWithPaymentRequestSchema` (the real submit path) has all three. Zod's default `.object()` mode silently *strips* unrecognized keys rather than erroring — so even if a client sent these fields to preview, they would vanish before reaching `calculateOrderTotals`.

Why this matters: `additionalTaxRate`/`additionalTaxAmount` are the ad-hoc, order-level tax fallback `calculateOrderTotals` applies **only when a tenant has no tax profile configured at all** (`order-calculation.service.ts:346-365`). `use-order-submission.ts` genuinely sends them on submit whenever `taxProfileIds` is empty and the client's own locally-computed `totals.taxRate`/`taxAmount` is positive — i.e. this is a real, live, currently-reachable path for any tenant that hasn't configured a tax profile yet (a plausible, non-hypothetical tenant state — new tenants during onboarding, or regions with no VAT profile configured). For such a tenant: the payment-modal preview total silently **omits** this tax component (schema strips it before the preview route can forward it), while the actual submitted/charged total **includes** it — the same shape of bug as B18's 4th iteration (client fetch body missing a field the submit path already had), just on a different field. Proven and locked in by `__tests__/validations/preview-submit-param-parity.test.ts` (schema-level, no DB needed — the two schema definitions are ground truth).

Not fixed here — an application-code/schema change is out of scope for a test-coverage pass and needs its own scoped review (add the 3 fields to `previewPaymentRequestSchema` + thread them through both preview routes' `calculateOrderTotals` calls, mirroring how `orderServicePrefs`→`orderCharges` was already threaded). Flagged directly to the owner in-session; recommend scoping as its own small fix package (or folding into B28's "financial regression" umbrella as a direct fix, since it's a test-coverage session that surfaced a real bug rather than a hypothetical one).

Secondary, lower-confidence note (not asserted as a bug): `serviceCategories` is client-supplied on the preview schema but **server-derived** from `items[].serviceCategoryCode` in the real submit orchestrator (`order-submit-orchestrator.service.ts:301`) and isn't part of `createWithPaymentRequestSchema` at all — a different derivation source between preview and submit. Whether the New Order UI always keeps its client-supplied value in sync with the items array wasn't independently re-verified; recorded as a documented characteristic only.

### ✅ RESOLVED 2026-08-14 — follow-up #5 IMPLEMENTED (owner-authorized), with a material correction to its own premise

**Shipped:** a new atomic primitive `claimIdempotencyKey()` in `lib/utils/idempotency.ts`, adopted by `stakeAmendmentIdempotency()`. It uses `INSERT ... ON CONFLICT (tenant_org_id, key, resource_type) DO NOTHING RETURNING id` against the existing `uq_idempotency_key` unique index, which is what makes "I created this row" distinguishable from "someone else staked it and is still running" — the distinction the old read-then-write `stakeIdempotencyHash` structurally could not make (both racers saw `resourceId: null` and both proceeded). Returns a discriminated union `CLAIMED | IN_FLIGHT | COMPLETED | CONFLICT`; the amendment path maps `IN_FLIGHT` to a new `AmendmentGovernanceError('IDEMPOTENCY_IN_PROGRESS')`. Hash-mismatch is checked *before* both `IN_FLIGHT` and `COMPLETED`, so a mutated retry is never mistaken for a duplicate or replayed against unrelated prior work.

**Scope discipline — deliberately additive.** `stakeIdempotencyHash` was left exactly as-is, so its other two consumers (`app/api/v1/orders/submit-order/route.ts`, `lib/services/workflow/workflow-engine.service.ts`) are byte-for-byte unaffected. This was a considered call, not laziness: `workflow-engine.service.ts` and `order-service.ts` are both inside a very large in-flight owner WIP (582 changed paths at the time), and submit-order has its own extensively-documented idempotency design (P3 placeholder / `PRIOR_ATTEMPT_FAILED` / B6 orphan-voucher lessons). The new primitive is available for them to adopt in their own reviewed pass. Only one line changed in `order-service.ts` (widening the `UpdateOrderResult.errorCode` union), chosen to minimise collision with the active WIP.

**Correction to this item's own premise (important — the recommendation below was aimed at the wrong lever).** While implementing, tracing the actual client showed `use-order-submission.ts`'s `saveOrderUpdate` mints a **fresh `crypto.randomUUID()` per call** (line ~930, with its own comment explaining why that is safe for the reason-retry flow). Consequences:

- A **double-click** on Save produces **two different idempotency keys**, so idempotency — hardened or not — can never dedupe it. The write-up below implied this hardening would close that scenario. It does not.
- What this hardening *does* close is a genuine, narrower hole: any caller that sends the **same** key twice concurrently — an HTTP-level retry, a proxy replay, a future mobile client or `cmx-api` consumer reusing a key. On a money-bearing path that must not double-apply, that is worth closing on its own merits (defense-in-depth), and it is now closed and proven.
- The **actual** residual exposure for concurrent double-submit is that `updateOrder`'s optimistic-lock check (`expectedUpdatedAt`) is a **read-then-compare, not an atomic compare-and-set** — two requests that both read the order before either commits will both pass it. Sequential retries are correctly rejected; only the true overlap window slips through.

**The residual is NOT fixed here, deliberately, and this is the recommendation to carry forward.** The correct fix is an atomic CAS on the order row (conditional `UPDATE ... WHERE updated_at = $expected`, or `SELECT ... FOR UPDATE` at the top of the edit transaction). That was **not** implemented because the owner's in-flight workflow-engine work already introduces exactly such a mechanism — `org_orders_mst.state_version`, with a real `AND COALESCE(state_version,0) = $expected` CAS in `workflow-engine.service.ts`'s UPDATE. Adding a second, independently-designed optimistic-lock mechanism to `updateOrder` mid-WIP would recreate precisely the "two competing mechanisms for one concern" problem B17 already flagged for `sys_currency_cd` vs `sys_currency_rounding_rules_cd`. **Recommended: once the workflow-engine WIP lands, have `updateOrder` adopt the same `state_version` CAS rather than growing its own.** Approved decision: NOT YET APPROVED.

**Tests:** `__tests__/db-integration/idempotency-claim-concurrency.db.test.ts` (new, 4/4) — 8 genuinely simultaneous claims against real Postgres prove exactly one `CLAIMED` and seven `IN_FLIGHT` with exactly one row persisted; plus completion→replay, hash-conflict precedence (both in-flight and post-completion), and tenant/resource-type scoping. `order-amendment.service.test.ts` updated for the new primitive (+2 tests: `IN_FLIGHT` mapping, and that `orderId` participates in the payload hash so the same key on a different order conflicts).

**Gates:** tsc clean (3 pre-existing/unrelated, none touched) · eslint 0 · full jest **251/251 suites, 2395/2395 tests** · `test:db-integration` **11/11 suites, 34/34 tests** · build ✓ (exit 0, 271 pages).

---

### Original recommendation for follow-up #5 (superseded by the correction above)

Traced precisely (see `order-amendment-governed-flow.db.test.ts`'s trailing comment for the original finding): `stakeAmendmentIdempotency` uses `stakeIdempotencyHash`'s atomic upsert, which correctly protects against a **different-payload** collision on a reused key, but does **not** distinguish "nobody has staked this key yet" from "someone is currently in flight" — both states read as `resourceId: null`, so two concurrent stakers with the identical key+payload both proceed.

Re-examined `checkOrderLock` (`order-service.ts:2910-2916`) precisely for this write-up: it only rejects a caller when the lock is held by a **different** `userId` (`lockStatus.isLocked && lockStatus.lock?.lockedBy !== userId`) — it does **not** block a second call from the *same* user, and does nothing at all when no lock was ever acquired for the order (the lock is opt-in via a separate `lockOrderForEdit` call, not enforced by `updateOrder` itself). This means the original framing ("not reachable by a real caller — the edit-lock always blocks a second concurrent editor") is only true for a genuinely different concurrent user. It does **not** cover the single most common real trigger for idempotency-key logic in the first place: the **same user's client double-submitting** (double-click, or a retry after an ambiguous timeout where the first request actually succeeded slowly) before the first request's transaction commits.

**Recommendation:** harden `stakeAmendmentIdempotency` with an atomic claim-vs-in-flight distinction — e.g. a raw `INSERT ... ON CONFLICT (tenant_org_id, key, resource_type) DO NOTHING RETURNING id` to detect whether *this* call created the row (winner: proceed) vs. hit an existing, not-yet-completed row (loser: reject as `IDEMPOTENCY_IN_PROGRESS` rather than silently creating a second edit-history row), mirroring the standard idempotency-key pattern (Stripe-style: created / in-flight / completed, not just present/absent). This is real application code in `lib/utils/idempotency.ts` + `order-amendment.service.ts` — not implemented in this pass (test-coverage session, and the folder's own working rules require explicit authorization before implementation). **Approved decision: NOT YET APPROVED.**

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
Migration: none (test-only package, per its own Delivery surfaces — no migration ever expected) · Implementation files: none (test-only) · Tests:
- `__tests__/api/v1/orders/amendment-settlement.route.test.ts` (9/9 passing) — settlement-completion route, previously zero coverage.
- `__tests__/db-integration/refund-concurrent-processing.db.test.ts` (2/2 passing) — real concurrent-transaction lock-ordering proof for `processRefund`, against the local DB.
- `__tests__/db-integration/order-amendment-governed-flow.db.test.ts` (2/2 passing) — real end-to-end `OrderService.updateOrder` governed-amendment flow against the local DB, including the real `outstanding_amount` recompute.
- `__tests__/db-integration/order-cancel-chain-flow.db.test.ts` (new, 2/2 passing) — real `unwindOrderFinancialsOnCancel` → `initiateRefund` → `approveRefund` → `processRefund` → real snapshot recalc chain (REFUND disposition), plus the STORE_CREDIT disposition branch, against the local DB.
- `__tests__/validations/preview-submit-param-parity.test.ts` (new, 4/4 passing) — schema-level proof of the preview-vs-submit request parity gap (`additionalTaxRate`/`additionalTaxAmount`/`promoCodeId` silently stripped by the preview schema; `serviceCategories` derivation-source divergence documented).

Full audit of 8 §49 scenario rows against current test files recorded in Current evidence above: 2 confirmed real/direct coverage, 2 genuine gaps closed 2026-07-26 with real DB-integration tests (items #1/#2), 1 more genuine gap closed 2026-08-13 with a real DB-integration test (item #3, cancel-chain), 1 route-parity gap closed 2026-08-13 at the schema level and upgraded to a real, live finding worth its own fix (item #4), and 1 design-decision item resolved as a documented, not-yet-approved recommendation rather than a test (item #5).

Gates (2026-08-13 pass, all 4 new files included): tsc clean (3 pre-existing/unrelated errors, none touched) · eslint 0 (all new files) · full jest **247/247 suites, 2376/2376 tests, zero regressions** · full `npm run test:db-integration` **10/10 suites, 30/30 tests passing** (includes the 3 db-integration files from this package alongside 7 pre-existing ones) · `npm run build` ✓ (exit 0) · local DB test debris verified cleaned (0 leftover rows post-run, both before and after the cancel-chain test).

Commit: pending (owner) · Preview QA: n/a (test-only, no user-facing behavior) · Reviewer: — · Verification: this package is never "VERIFIED" in the usual sense — it's continuous or per its own doc; treat as ongoing · Authoritative report update: not filed separately, per this session's established precedent. **Open item for the owner**: the follow-up #4 finding (preview silently drops the no-tax-profile `additionalTaxRate`/`additionalTaxAmount` fallback) is a real, live bug candidate, not just a test-coverage note — recommend deciding whether to authorize a fix now or track it as its own scoped package.
