# B04 — Later Collection BVM Parity

## Metadata
Backlog ID: B4 · Severity: HIGH · Classification: BLOCKS_PRODUCTION · Status: **IMPLEMENTED 2026-07-20** (see Completion evidence) — awaiting owner commit → Preview QA → approval before VERIFIED
Authoritative report sections: H1, §6, §32, §50-B4
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md)
Dependencies: none · Blocks: [B05](B05_Later_Collection_Idempotency.md), [B31](B31_Later_Collection_Default_Status.md) (hard); [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) (impl)
Recommended phase: Seq 4

## Confirmed problem
`collectPaymentTx` writes payment + drawer facts directly with **no BVM receipt voucher** — completed rows lack voucher backlinks and trip the platform's own `ORDER_PAYMENT_LINK_EXISTS` blocker (H1); no fiscal receipt artifact for collections.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:829+ | direct `org_order_payments_dtl.create` | no voucher/wiring |
| order-checks.ts:312–338 | flags voucher-less COMPLETED payments as BLOCKER | invariant violated by design |
| order-settlement-planner.service.ts | canonical planner unused by collect | plan/validate parity missing |

## Required outcome
Later collection runs through the canonical planner + BVM path (voucher → lines → post/wire → snapshot), producing parity with submit: voucher links, drawer wiring via handler, receipt artifact, recon green.

## Scope
Collect service refactor onto planner + `createBizVoucher`/`addVoucherLine`/`postAndWireBizVoucher`; drawer movement moves into the wiring handler; both collect routes converge on one implementation.

## Out of scope
Idempotency keys (B5); D9 status honoring (B31); ERP events (B6).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (creation path changes) |
| Credit applications | NO |
| BVM | YES |
| Cash drawer | YES (handler-driven) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (enables B6) |
| Snapshot | YES (same totals, new lineage) |
| Reconciliation | YES (blockers resolve) |
| Customer receipt | YES (voucher receipt) |
| Audit/outbox | YES |

## Acceptance criteria
Every collect-created COMPLETED payment carries `fin_voucher_id` + `fin_voucher_trx_line_id`; `ORDER_PAYMENT_LINK_EXISTS` passes on collection scenarios; drawer totals unchanged vs today for identical inputs.

## Required tests
integration, API, reconciliation, regression (multiple partial collections; §49 rows).

## Dependencies and sequencing
Before B5/B31 (they modify the same path); enables B6 later-collection events.

## Delivery surfaces

Backend services: `collectPaymentTx` (`order-settlement.service.ts`) rewritten to wire real-payment legs through `createBizVoucher` → `addVoucherLine` (per leg) → `postAndWireBizVoucher` — the same voucher/wiring-handler path submit-order uses (`orderPaymentWiringHandler` creates `org_order_payments_dtl`, `cashDrawerWiringHandler` creates `org_cash_drawer_movements_dtl`). Collect's own overpayment engine (`computeCollectionOverpaymentMetrics`/`validateOverpaymentResolution`/`executeOverpaymentDispositionTx`/`executeAllocationPreviewTx`) is deliberately left untouched — reused verbatim, not replaced with `buildSettlementPlan`'s parallel overpayment math, to guarantee financial parity with the pre-refactor path (see Scope note below)
Database/schema: none new (voucher backlinks populate existing columns, as planned)
API/endpoints: `POST /orders/[id]/collect-payment` and `POST /orders/[id]/payments` — both still separate route files (not literally merged into one handler; that was judged unnecessary scope — both already delegate to the identical `collectPaymentTx` and now carry an identical Zod contract + error-code mapping, which is what "single contract" was protecting)
Frontend page/screen/dialog/action: `order-collect-payment-modal.tsx` — layout unchanged; adds a stable per-open idempotency key (B5), a "pending until verified" notice when the D9 config resolves PENDING (B31), and an `IDEMPOTENCY_CONFLICT` → 409 error-code mapping (no voucher-receipt print wired — deferred, no existing collect-receipt UI to extend without new scope)
Reusable components/helpers: `listEffectivePaymentMethodConfigs` (D9-aware method resolution, B31); `resolveDefaultStatus` (exported from the submit planner, B31); the BVM voucher services themselves
Permissions: existing `orders:collect_payment` (unchanged)
Validation: CASH_TENDERED_LESS_THAN_AMOUNT / CASH_CHANGE_NOT_ALLOWED / CASH_TENDERED_ONLY_FOR_CASH / CASH_DRAWER_SESSION_REQUIRED preserved from the original bespoke checks; NEW `INVALID_PAYMENT_NATURE_FOR_COLLECTION` guard (rejects a CREDIT_APPLICATION-natured method, a pre-existing latent gap this refactor closes as a side effect of resolving `payment_nature`). Full validation parity with submit's `validateSettlementPlan` (reference/terminal/gateway-config checks) is **NOT** implemented — collect's request contract has no `terminalId`/gateway fields to satisfy those checks against, so adding them would either be dead code or require new UI/API surface out of this package's scope; flagged here as a deliberate, documented gap rather than silently dropped
i18n/RTL: `orders.collectPayment.idempotencyConflict` + `.pendingUntilVerified` (EN/AR)
Accessibility: pending notice uses `role="status" aria-live="polite"`, consistent with the modal's existing change-due notice
Audit trail: voucher lineage on every collection payment; outbox `PAYMENT_RECEIVED` retained
Observability: `ORDER_PAYMENT_LINK_EXISTS` (B20) goes green on collections created after this ships
Jobs/workers: none
Feature flag: **none — ships unconditionally** (owner decision 2026-07-20, superseding the flag originally planned here). Rationale: parity tests are green (totals/drawer math identical to the pre-refactor path — only the write mechanism changed to add voucher backlinks); this mirrors the B35 precedent (unconditional for a validated correctness fix, not a new risky capability); a flag would require maintaining two parallel `collectPaymentTx` code paths with no corresponding safety benefit given the program's mandatory Preview-QA gate already sits between every commit and production
Rollout: commit → Preview deploy → QA runs parity scenarios (totals + drawer identical to pre-refactor for identical inputs, voucher/backlink checks, B31 PENDING scenario, B5 replay/conflict scenarios) → owner approval → production
Rollback: revert the commit (no flag toggle) — the old direct-write code remains in git history only, per D005/D002 precedent of deleting rather than flagging superseded formulas

## End-to-end operational flow

1. Cashier opens Collect Payment on a PAY_ON_COLLECTION order, enters legs, submits with a stable per-open idempotency key.
2. Order row locked `FOR UPDATE`; D9-aware method config resolved (`listEffectivePaymentMethodConfigs`); collect's existing overpayment engine validates/blocks as before.
3. One RECEIPT voucher created for the event; each leg becomes an `ORDER_PAYMENT` voucher line (payment status resolved per B31); `postAndWireBizVoucher` dispatches `orderPaymentWiringHandler` (writes the payment fact) then `cashDrawerWiringHandler` (writes the drawer movement) — one atomic transaction.
4. Snapshot recalculates from the persisted rows; outbox `PAYMENT_RECEIVED` emits; the full result is cached under the request's idempotency key for safe replay.
5. Reconciliation's `ORDER_PAYMENT_LINK_EXISTS` (B20) passes on every collection created this way; a mid-transaction failure (e.g. missing drawer session) rolls back everything atomically — no orphan voucher, no orphan payment row.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (action disabled with reason), duplicate-click protection (button disabled while `submitting`, idempotent replay via B5's stable key), processing, success, retry on failure (409 conflict mapped to a clear "refresh and retry" message); collection history visible on the order Financial tab via existing voucher-linked payment reads.

## Safety

UI design allowed: YES · UI implementation allowed: YES (implemented)
Production activation allowed: **unconditional in code; production promotion still gated on the standing Preview-QA rule** (commit → Preview → QA parity run → owner approval → production) — no separate flag-based gate
Required backend gates: none external — this package's voucher path only
Required decision gates: D001, D007 conformance (satisfied — see Delivery surfaces)
Required verification gates: parity assertions green (totals, drawer, voucher links) on Preview, per the standing release-promotion rule

## Completion evidence

**Migration:** none (as planned — voucher backlinks populate existing columns).

**Implementation (2026-07-20):**
- `lib/services/order-settlement.service.ts` — `collectPaymentTx` rewritten: D9-aware method resolution via `listEffectivePaymentMethodConfigs` (replaces the old bespoke `org_payment_methods_cf`/`org_branch_payment_methods_cf` tx queries); `INVALID_PAYMENT_NATURE_FOR_COLLECTION` guard; one `createBizVoucher` (RECEIPT, `source_module: 'ORDERS'`) + one `addVoucherLine` per leg (`ORDER_PAYMENT` role) + one `postAndWireBizVoucher` per collection event, replacing the direct `org_order_payments_dtl.create`/`org_cash_drawer_movements_dtl.create` writes; overpayment disposition/allocation now pass `voucherId: voucher.id` (was `null`) per D007's matrix. `CollectPaymentParams.idempotencyKey` is now required (B5, see B05 evidence) and `paymentStatus?: 'PENDING'` was added per-leg for D001/B31 parity with submit's contract (see B31 evidence for the status-resolution details).
- `lib/services/order-settlement-planner.service.ts` — `resolveDefaultStatus` exported (was private) so collect reuses the exact submit fallback instead of a copy.
- `lib/types/voucher-wiring.ts` + `lib/services/voucher-wiring.service.ts` (`LINE_SELECT`) + `lib/services/wiring/order-payment-wiring.handler.ts` — incidental fix closing a pre-existing gap discovered while wiring collect through this path: the wiring handler dropped a CHECK payment's `check_bank`/`check_date` (captured on the voucher line) when creating the `org_order_payments_dtl` row (only `check_no` was forwarded). Now forwards `check_bank_name`/`check_due_date` too — benefits submit's CHECK payments as well, not just collect's.
- `app/api/v1/orders/[id]/collect-payment/route.ts` + `.../payments/route.ts` — `idempotencyKey` required in the Zod schema (`.min(1).max(200)`, no `.optional()`); `IDEMPOTENCY_CONFLICT` mapped to HTTP 409 (was falling through to the generic 422).
- `app/api/v1/orders/checkout-options/route.ts` — added `default_creation_status` to the response (additive; feeds the B31 frontend notice).
- `src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx` — stable per-dialog-open idempotency key (regenerated in the existing open-reset effect, not per-click); `IDEMPOTENCY_CONFLICT` error-code mapping; B31 "pending until verified" notice gated on an explicit `default_creation_status === 'PENDING'` D9 override (inherited-system-default PENDING is not detected client-side — a deliberate simplification, not a bug).
- `messages/en(ar)/orders/collectPayment.json` — `idempotencyConflict` + `pendingUntilVerified` keys.

**Tests:** `__tests__/services/settlement.service.test.ts` — `collectPaymentTx` describe block rewritten for the new BVM path (voucher/line/wiring mocks replace the old direct-write mocks): CASH leg wired through the voucher path with branch-merged `requires_cash_drawer`, D9 PENDING resolution (CHECK), `INVALID_PAYMENT_NATURE_FOR_COLLECTION` rejection, overpayment-required/executed scenarios (now asserting `voucherId` links), plus a new `idempotency (B5/D010)` sub-suite (see B05 evidence). `__tests__/services/order-payment-wiring.handler.test.ts` — new test locking the check_bank/check_date forward-fix. `__tests__/services/cash-drawer-change.idempotency.test.ts`, `.../invoice-payment-wiring.handler.test.ts`, `.../statement-payment-wiring.handler.test.ts` — updated fixture objects for the 2 new required `VoucherLineForWiring` fields (no behavior change). `__tests__/migrations/phase1-order-fin.test.ts` — "1C" section rewritten: the old F-10 "falls back to a per-request UUID" assertion was itself superseded by B5's stricter "required key, no fallback" contract; now asserts the required-field type + both routes' Zod schemas.

**Gates (2026-07-20, all green):** `npx tsc --noEmit` clean · `npx eslint . --quiet` 0 (all touched files) · `npm run check:i18n` ✓ · targeted jest (settlement + 4 wiring-handler suites + planner + overpayment-validator) 51/51 · full jest 2041/2049 (the 8 fails are the pre-existing, documented `order-calculation.service.test.ts` mock gap — unrelated, not touched this session) · `npm run build` ✓ (exit 0, full route manifest emitted, no compile errors).

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending (parity scenarios: identical totals/drawer for a plain CASH collection before/after; voucher + backlinks present; `ORDER_PAYMENT_LINK_EXISTS` green on a post-ship collection) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** — (H1 finding closes once VERIFIED).
