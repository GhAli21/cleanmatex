# B32 — Drawer Status Gating and Status Override

## Metadata
Backlog ID: B32 · Severity: LOW · Classification: CONTROL_GAP · Status: IMPLEMENTED (uncommitted, 2026-07-23)
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

**IMPLEMENTED 2026-07-23 (uncommitted), same session as B30** — the two packages share the wiring-handler layer and were built together per the master sequence.

**1. Handler status gate (M7) — DONE.** `cash-drawer-wiring.handler.ts`'s `canHandle` now requires `resolvePaymentStatus(line) === 'COMPLETED'` in addition to the existing CASH/IN/drawer-session checks. `resolvePaymentStatus` is the exact same helper `order-payment-wiring.handler.ts` already uses internally — exported (was module-private) rather than duplicated, so the two handlers can never disagree on what "effectively COMPLETED" means. **Design note (important):** `WIRING_HANDLERS.filter(h => h.canHandle(line))` runs ONCE per line, for ALL handlers, BEFORE any handler's `wire()` executes (`voucher-wiring.service.ts:210-211`) — so gating on a raw, possibly-null `line.payment_status` field (or relying on `orderPaymentWiringHandler.wire()` to mutate it in-memory first) would not work; the fix instead recomputes the same resolution function `canHandle` needs, which is timing-independent and correct regardless of whether the caller set `payment_status` explicitly on the line or left it to the fallback chain.

**2. Deferred-movement-on-verify hook — DONE**, implemented inside B30's `payment-transition.service.ts` (`maybeCreateDeferredCashMovementTx`) rather than as a separate module, since VERIFY already owns the one place a PENDING/PROCESSING CASH+drawer leg transitions to COMPLETED. When invoked: checks for an existing `CASH_SALE` movement by `order_payment_id` (none should exist, by construction of gate #1); if the drawer session is still OPEN, creates the movement (mirroring `cashDrawerWiringHandler.wire()`'s exact row shape, including the conditional `CASH_OUT` change leg and the `fin_voucher_trx_line_id` backlink when one exists); if the session is no longer OPEN, it deliberately does **not** guess which drawer to credit — it logs a warning and leaves the leg unmoved rather than silently mutating a closed/foreign drawer's expected cash (CLAUDE.md CRITICAL RULE #15).

**3. `allow_status_override` (M8) — investigated, NOT enforced, decision documented (see "Investigation outcome" below).** The field remains captured on settlement legs/effective-configs (read by `validateOverpaymentResolution` and others) but its only plausible consumer — the checkout-time explicit `paymentStatus: 'PENDING'` per-leg override in `buildSettlementPlan`/`collectPaymentTx` — is deliberately left unconditional.

### Investigation outcome: why `allow_status_override` was NOT wired into the explicit checkout override

The first implementation attempt gated the explicit per-leg `paymentStatus: 'PENDING'` override behind `allow_status_override` (throwing `STATUS_OVERRIDE_NOT_ALLOWED_FOR_METHOD` when a method disallows it). Running the full test suite immediately surfaced a real conflict: `order-settlement-planner.service.test.ts`'s pre-existing, already-shipped test **"Phase 6 B7: explicit PENDING on the original leg overrides the COMPLETED fallback"** asserts the opposite — that an explicit PENDING request from checkout must be honored **regardless of config** (BVM Wiring Phase 6 Sub-item 6 / B7 closer, documented in `buildSettlementPlan`'s own inline comment: *"An explicit `'PENDING'` from the request overrides every fallback"*). That is deliberate, tested, shipped production behavior, not an oversight.

Rather than silently regress a verified checkout-time contract to satisfy a dead-config field with no other documented consumer, the decision made was: **do not enforce `allow_status_override` against the explicit per-leg override.** The field stays inert for that path — both `buildSettlementPlan` and `collectPaymentTx` carry a comment explaining why, and both test suites gained an explicit "honored regardless of allow_status_override" pinning test so a future change cannot silently reintroduce the enforcement and regress checkout again. This is a legitimate, reasoned resolution of B32's own "implemented per D001 **or removed**" alternative — the field is not removed (schema/type churn for no behavioral gain) and not enforced against a decision that was already made and shipped by a different, later package; it remains available as a config signal for a future, different consumer (e.g., gating who may use the B30 back-office CANCEL/FAIL_BOUNCE transitions per D001's "controlled supervisor/back-office operation" framing) should one be needed.

**Delivery-surfaces correction:** the doc's original "Backend services" line listed *"allow_status_override implement-or-remove decision execution (per D001)"* as a planned deliverable — the investigation above **is** that decision execution; no code changes resulted from it beyond the two pinning tests and inline comments.

**Tests:** `cash-drawer-wiring.handler.test.ts` (7 cases — true for CASH+session with COMPLETED/no-explicit-status, false for explicit PENDING/no-session/non-CASH/wrong-role/wrong-direction); `payment-transition.service.test.ts` covers the deferred-movement hook (created when session OPEN, skipped + logged when not); `order-settlement-planner.service.test.ts` and `settlement.service.test.ts` each gained one "honored regardless of allow_status_override" pinning test. One pre-existing test-fixture bug found and fixed in the process: `cash-drawer-change.idempotency.test.ts`'s `makeCashLine()` had `payment_status: 'POSTED'` (copy-paste from `line_status`) — harmless before this gate existed, fixed to `'COMPLETED'`.

**Gates ALL GREEN** — see B30's Completion evidence for the shared full run (tsc/eslint/jest/build/i18n/access-contract all pass together, same session).

**Migration note:** B32 itself needs no schema change (pure application-code), but it shares migration `0415_b30_b32_payment_transitions_and_permissions.sql` with B30 (that migration is B30's, not B32's — B32 has no columns/permissions of its own). **`0415` APPLIED (owner, 2026-07-23) to both local and remote, verified via remote DB** — see B30's Completion evidence for the full post-apply verification (columns, permissions, role grants, nav entry, CHECK constraints all confirmed present and correct).

Migration: none of B32's own (shares B30's `0415`, applied) · Implementation files: `cash-drawer-wiring.handler.ts`, `order-payment-wiring.handler.ts` (export only), `payment-transition.service.ts` (shared with B30), `order-settlement-planner.service.ts` + `order-settlement.service.ts` (investigation comments only, no behavior change) · Tests: see above · Commit: — (owner commits) · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
