# B30 — Pending-Payment Back-office Lifecycle

## Metadata
Backlog ID: B30 · Severity: HIGH · Classification: BLOCKS_FEATURE / CONTROL_GAP · Status: IMPLEMENTED (uncommitted, 2026-07-23)
Authoritative report sections: H8, §31.1 (current vs required tables), §50-B30
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D009](00_Phase_0_Financial_Semantics/D009_Pending_Payment_Failure_Fallback.md), [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: [B07](B07_Financial_Outbox_Processor.md) **only for outbox-based durable history; the pending-payment worklist and lifecycle transitions are independent** · [B27](B27_Financial_Permissions_And_Approvals.md) — **correction (2026-07-23): B27 did NOT seed cancel/fail permission codes** (re-verified against migration 0411 — it only confirmed the unrelated, orphaned `payments:cancel` code from 0095). The three codes this package needs (`orders:pending_payments_view`, `orders:cancel_payment`, `orders:fail_payment`) are seeded by **this package's own migration 0415**.
Blocks: [B08](B08_Gateway_Lifecycle_Integration.md) (impl — shares transition service)
Recommended phase: Seq 6

## Confirmed problem
Pending-payment lifecycle is verify-only: no cancel/fail/bounce/reject transition, no reason capture, no cross-order worklist (per-order Verify button only), no durable actor audit (`verified_by` exists only in the unconsumed outbox payload), PROCESSING gateway legs have no completion path, and a failed leg would strand outstanding with `outstandingPolicy='NONE'` (H8, §31.1).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:515–533 | verify PENDING→COMPLETED only; generic updated_by | no other transitions; no dedicated audit columns |
| order-payments-credits-tables.tsx:283 | per-order Verify button | no cross-order worklist |
| order-settlement-planner.service.ts:36, 169–181 | PROCESSING creation; pending counted in plan settlement | no completion path; no failure fallback |

## Required outcome
Per §31.1 target-state table: tenant/branch pending/authorized worklist (method, amount, age, reference, order link); actions VERIFY / CANCEL / FAIL-BOUNCE with mandatory reason and per-action permissions; completion path for PROCESSING legs; on cancel/fail — snapshot recalc + D009 outstanding-policy fallback + drawer/gateway compensation where a movement existed; dedicated actor-audit columns (verified_by/at, cancelled_by/at, reason) or working history via B7; replay-safe transitions.

## Scope
Transition service (D001 graph subset), worklist API + screen (Cmx components, EN/AR), audit columns migration assessment, action permissions wiring (B27 codes).

## Out of scope
Gateway webhooks (B8); reversal of COMPLETED legs (B10); warning-code fix (B33); plan-time counting change (D009 scope note).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (new transitions) |
| Credit applications | NO |
| BVM | POSSIBLE (line status sync) |
| Cash drawer | POSSIBLE (compensation on cancel of moved cash) |
| Gateway or bank | POSSIBLE (B8 later) |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | YES (failed set aggregation live) |
| Reconciliation | YES |
| Customer receipt | POSSIBLE (status display) |
| Audit/outbox | YES (durable actions log) |

## Acceptance criteria
Accountant finds an aged pending check in the worklist, marks it BOUNCED with reason → leg FAILED, outstanding reclassified per D009 choice, durable audit row exists; PROCESSING leg completable; every action replay-safe and permission-gated.

## Required tests
unit (transitions), integration, API, UI, idempotency, concurrency, reconciliation, regression.

## Dependencies and sequencing
After D001/D009 approval + B27 codes; independent of B7 except durable-history option.

## Delivery surfaces

Backend services: payment transition service (D001 graph subset: verify/cancel/fail-bounce; PROCESSING completion path); worklist query service; D009 fallback executor
Database/schema: actor-audit columns on org_order_payments_dtl (verified_by/at, cancelled_by/at, transition_reason) — assess additive
API/endpoints: GET pending-payments worklist (filters: branch, method, age, status); POST transition endpoints per action (reason required, replay-safe)
Frontend page/screen/dialog/action: pending-payments worklist screen (tenant/branch scope, age badges from B19 sweep, order links); per-row actions VERIFY / CANCEL / MARK FAILED-BOUNCED with reason dialog; D009 fallback chooser on cancel/fail; loading/empty/error/retry/success/disabled states per Cmx patterns
Reusable components/helpers: transition service shared with B8/B10; reason dialog (B27 pattern); status chips
Permissions: `orders:verify_payment` (exists, migration 0332) + `orders:pending_payments_view` / `orders:cancel_payment` / `orders:fail_payment` (new, migration 0415 — correction: B27 did not seed these, see Metadata)
Validation: transition legality; maker identity recorded; fallback choice from the D009 allowed set
i18n/RTL: EN/AR worklist + actions + fallback labels; RTL table
Accessibility: keyboard row actions; dialog focus; status as text
Audit trail: dedicated actor columns or B7 history (both acceptable per B7-optional dependency); every action durable and user-visible
Observability: worklist aging metrics; transition failure counts
Jobs/workers: aging sweep (B19) feeds the list
Feature flag: `order_fin.pending_worklist`
Rollout: worklist read-only first → verify action (parity with existing button) → cancel/fail actions with D009 flow
Rollback: flag off → per-order Verify button remains (current state)

## End-to-end operational flow

1. Accountant opens the worklist → filters aged pending checks → opens a row.
2. Bank confirms: VERIFY with note → leg COMPLETED, paid_at set, snapshot recalc, audit row; check bounced: MARK FAILED with reason → leg FAILED → D009 fallback chooser (re-tender / POC / AR) → outstanding reclassified.
3. Every action is permission-gated, replay-safe, and visible in the order history; the list refreshes with success feedback; failures show retryable errors.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: verify-parity mode anytime; cancel/fail actions only after D001 + D009 approval (transitions must have defined financial consequences before operators can trigger them)
Required backend gates: transition service implemented; B27 cancel/fail codes seeded
Required decision gates: D001, D009, D010 approved (cancel/fail actions); none for verify-parity mode
Required verification gates: transition test suite green (legality, replay, concurrency, D009 fallback outcomes)

## Completion evidence

**IMPLEMENTED 2026-07-23 (uncommitted).** Full-cycle: transition service, worklist query service + API routes, worklist screen, per-order table wiring, permissions, i18n EN/AR, reconciliation trip-wire, tests. B32 (Drawer Status Gating) implemented in the same session — see its own file; both packages touch the same wiring-handler layer and were done together per the master sequence ("Seq 6 ← NOW → B3, B30, B32").

**Migration `0415_b30_b32_payment_transitions_and_permissions.sql` — APPLIED (owner, 2026-07-23) to both local and remote, verified via remote DB.** Adds 8 dedicated actor-audit/fallback-classification columns to `org_order_payments_dtl` (`verified_by/at`, `cancelled_by/at`, `failed_by/at`, `transition_reason`, `fallback_classification` + CHECK), a worklist scan index, seeds `orders:pending_payments_view`/`orders:cancel_payment`/`orders:fail_payment` + role grants, extends `chk_history_action_type` with `PAYMENT_CANCELLED`/`PAYMENT_FAILED`, and seeds the `billing_pending_payments` nav entry. **Post-apply verification (remote, read-only queries):** all 8 columns present on `org_order_payments_dtl`; all 3 permissions seeded + active; role grants correct (`orders:cancel_payment`/`orders:fail_payment` → super_admin/tenant_admin/admin/branch_manager; `orders:pending_payments_view` → those 4 + finance_manager); `billing_pending_payments` nav entry present with `parent_comp_id` resolved and correct `main_permission_code`; both `chk_ord_pay_fallback_classification` and the updated `chk_history_action_type` CHECK constraints present. `prisma/schema.prisma` was hand-updated to mirror the 8 columns + `npx prisma generate` re-run BEFORE the apply (same pattern as B3/B4/B7/B27), so the schema now genuinely matches the live DB rather than just anticipating it.

**Backend — `lib/services/payment-transition.service.ts` (new):** one `transitionPaymentTx()` entry point for VERIFY/CANCEL/FAIL_BOUNCE (D001 canonical graph subset: only PENDING/PROCESSING sources; REAL_PAYMENT legs only — a COMPLETED leg needs B10 reversal, out of scope here). Idempotent (D010): replay of the same key+payload returns the cached result with zero new effects; a changed payload throws `IDEMPOTENCY_CONFLICT` (mirrors `collectPaymentTx`'s in-tx `org_idempotency_keys` pattern, not the generic `stakeIdempotencyHash` helper — chosen for atomicity with the single owning transaction). CANCEL/FAIL_BOUNCE require a mandatory `reason` and a D009 `fallbackClassification` from the 5-value governed set; VERIFY needs neither. D009 fallback: `PAY_ON_COLLECTION`/`AR_CREDIT_INVOICE` reclassify `org_orders_mst.payment_type_code` (the first writer of that column outside order-creation — confirmed via Explore that no such writer existed before); `RETRY_TENDER`/`MANUAL_REVIEW`/`CANCEL_ORDER_OR_REVERSE_SERVICE` are recorded but do NOT auto-mutate the order (those describe an operator action still to be taken — auto-mutating would itself be a CLAUDE.md CRITICAL RULE #15 silent-money-mutation violation). Every transition emits an outbox event (`PAYMENT_VERIFIED` reused; new `PAYMENT_CANCELLED`/`PAYMENT_FAILED`) consumed by `order-history-consumer.service.ts`'s existing async path (two new `case` blocks added, same aggregate-resolution shape as `PAYMENT_VERIFIED`). B32's deferred-cash-movement hook lives here too (`maybeCreateDeferredCashMovementTx`) — see B32's own file.

**API — `app/api/v1/finance/pending-payments/route.ts`** (GET worklist, `orders:pending_payments_view`) **+ `app/api/v1/finance/pending-payments/[paymentId]/transition/route.ts`** (POST, Zod-validated body, permission resolved dynamically per `action` after body validation — VERIFY→`orders:verify_payment`, CANCEL→`orders:cancel_payment`, FAIL_BOUNCE→`orders:fail_payment` — since the three actions carry different permissions on the same route). Stable error-code→HTTP-status map (`PAYMENT_NOT_FOUND`→404, `ILLEGAL_TRANSITION`/`IDEMPOTENCY_CONFLICT`/race→409, validation→400/422).

**Worklist query — `lib/services/pending-payments-worklist.service.ts` (new):** tenant/branch/method/status-filtered scan of PENDING/PROCESSING REAL_PAYMENT legs with health counts, joined client-side to branch/customer/order-no (no direct Prisma relation from `org_order_payments_dtl` to `org_orders_mst` exists in the schema — confirmed by a real tsc error during implementation, fixed with a separate `findMany` + in-memory join, same pattern already used for branch/customer names).

**Frontend:** `pending-payments-worklist-page.tsx` (mirrors B7's `outbox-monitor-page.tsx` structural pattern: health tiles + `CmxDataTable` + status filter + per-row action buttons gated by `useHasPermissionCode`), `payment-transition-dialog.tsx` (reusable — shared by the worklist AND the per-order Payments tab; VERIFY needs no reason, CANCEL/FAIL_BOUNCE require reason + D009 fallback dropdown, submit disabled until both filled — mirrors the B16 variance-approval-dialog convention including its stable-per-dialog-open idempotency key pattern from B4/B5), route at `/dashboard/internal_fin/pending-payments`. **Full-cycle addition beyond the worklist:** `order-payments-credits-tables.tsx` (existing per-order Payments tab) gained Cancel/Fail-Bounce buttons next to the existing Verify button for PENDING/PROCESSING legs, reusing the same shared dialog — the existing Verify flow (`verifyPaymentTx`/its route) was left completely untouched for backward compatibility.

**Access contract + navigation:** `billing-access.ts` new entry for `/dashboard/internal_fin/pending-payments` (page permission + 3 actions + 2 apiDependencies), `navigation.ts` new `billing_pending_payments` entry. **Tooling gotcha hit and hand-fixed:** `npm run derive:ui-access-contract -- --apply` over-generated ~350 lines of noise into the contract entry — duplicate snake_case actions (`create`/`read`/`update`/`export`/`verify_payment` etc., inferred from every other permission sharing the `orders:` resource prefix anywhere in the codebase) and ~30 unrelated `apiDependencies` entries (AR invoices, disputes, dunning, statement-cycles, refunds, outbox routes this page never calls) — all confined to this one new route block (verified via `git diff`, no other routes touched), hand-trimmed back to the 3 real actions + 2 real API deps. `check:ui-access-contract --wire` PASS (page/API gates OK), `sync:ui-access-contract` PASS (144/144 routes, drift 0), `check:platform-info-inventories` PASS.

**Reconciliation:** new `CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT` check (`voucher-checks.ts`) — defense-in-depth trip-wire asserting a CANCELLED/FAILED payment never carries a live `CASH_SALE` movement (structurally unreachable post-B32, per the same reasoning as the service-level `warnIfOrphanMovementExistsTx` warn-not-reverse guard). `EXECUTED_CHECK_NAMES`/`RECONCILIATION_TOTAL_CHECKS` updated (dynamic constant, no hardcoded count to bump elsewhere).

**Tests:** `payment-transition.service.test.ts` (19 cases: VERIFY happy/idempotent/deferred-movement/closed-session, CANCEL/FAIL_BOUNCE reason/fallback validation + PAY_ON_COLLECTION reclassification + MANUAL_REVIEW non-reclassification + orphan-movement warn, D001 legality, D010 replay/conflict/race), `cash-drawer-wiring.handler.test.ts` (7 cases, B32 gate — see B32's own evidence), reconciliation check-modules.test.ts +2 cases. **One pre-existing test-fixture bug surfaced and fixed:** `cash-drawer-change.idempotency.test.ts`'s `makeCashLine()` fixture had `payment_status: 'POSTED'` (a copy-paste of `line_status` immediately above it) — harmless before B32 since nothing gated on it, now exposed by the new status gate; fixed to `'COMPLETED'` (the fixture models an immediate cash sale).

**Gates ALL GREEN:** `npx tsc --noEmit` clean (only the 2 pre-existing, untouched-file errors: `order-service.ts:2158` and `processing-piece-row.tsx:207` — confirmed via `git status` these files are not part of this change) · `npx eslint . --quiet` exit 0 · full jest 222/222 suites, 2135/2135 tests, zero known failures (one transient Windows Prisma-engine file-lock flake on the first run, self-resolved on retry — not a code issue) · `npm run build` exit 0 · `npm run check:i18n` PASS (7 pre-existing EN=AR placeholder warnings, unrelated) · `check:ui-access-contract --wire` PASS · `sync:ui-access-contract` PASS (144/144, drift 0) · `check:platform-info-inventories` PASS.

**Scope decisions:** PROCESSING-leg completion (gateway async capture) is covered by VERIFY/FAIL_BOUNCE acting on PROCESSING same as PENDING — no separate "complete a PROCESSING leg" action was needed since the D001 graph subset already treats both as transitionable sources. B19's aging sweep (mentioned in the original doc's "age badges") does not exist yet (Seq 10) — the worklist instead sorts by `created_at` ascending and shows the raw creation timestamp; age-bucket badges are a natural B19 follow-on, not blocking.

Migration: `0415_b30_b32_payment_transitions_and_permissions.sql` (APPLIED owner 2026-07-23, local+remote, verified) · Implementation files: see above · Tests: `payment-transition.service.test.ts`, `cash-drawer-wiring.handler.test.ts`, `check-modules.test.ts` (+2), `order-settlement-planner.service.test.ts` (+1 investigation test), `settlement.service.test.ts` (+1 investigation test) · Commit: — (owner commits) · Preview QA (deploy/result/approval): — (owner queue; QA_TEST_GUIDE.md §15 scenarios already added, ready to run once deployed) · Reviewer: — · Verification: — (pending Preview QA per folder CLAUDE.md release-promotion rule) · Authoritative report update: —
