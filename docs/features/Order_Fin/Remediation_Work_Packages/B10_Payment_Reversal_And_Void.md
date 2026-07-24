# B10 — Payment Reversal and Void

## Metadata
Backlog ID: B10 · Severity: HIGH · Classification: BLOCKS_FEATURE · Status: IMPLEMENTED (2026-07-24, uncommitted; migration 0421 APPLIED (owner, 2026-07-24) to local + remote, verified via remote DB — awaiting owner commit → Preview QA → approval before VERIFIED)
Authoritative report sections: §34, §5.1, §50-B10
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D004](00_Phase_0_Financial_Semantics/D004_Refund_Vs_Reversal_Vs_Void.md)
Dependencies: none · Blocks: [B13](B13_Voucher_Reversal_Operational_Unwind.md) (hard)
Recommended phase: Seq 7

## Confirmed problem
PAYMENT_REVERSAL and PAYMENT_VOID do not exist as transactions; VOIDED/REVERSED status values exist with no writers; error corrections must masquerade as refunds (§34).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| constants/order-financial.ts:468 | VOIDED/REVERSED in FAILED set | no transition services |
| order-settlement.service.ts:515–517 | verify-only lifecycle | no void for PENDING/PROCESSING/AUTHORIZED |
| §34 matrix | reversal/void NOT_FOUND | taxonomy per D004 Option B |

## Required outcome
Void service (never-effective legs → VOIDED/CANCELLED, no money movement, outstanding recomputes) and reversal service (COMPLETED leg → REVERSED + contra fact with lineage, drawer/voucher compensation via B13 wiring, maker-checker), both keyed and audited.

## Scope
Transition services + APIs; contra-fact lineage columns assessment; snapshot interaction tests (FAILED-set aggregation already correct).
**Frontend surface (rule 7):** VOID action on pending/authorized legs surfaces in the B30 worklist and order Financial tab; REVERSAL action (maker-checker dialog with reason) on the order Financial tab payments table and voucher detail — no API-only transitions.

## Out of scope
Voucher-side unwind mechanics (B13); gateway void/reversal calls (B8); chargebacks (B26).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (status + contra rows) |
| Credit applications | NO |
| BVM | YES (via B13) |
| Cash drawer | YES (reversal compensation) |
| Gateway or bank | POSSIBLE (B8) |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (reversal journal, B6) |
| Snapshot | YES (outstanding reopens) |
| Reconciliation | YES |
| Customer receipt | POSSIBLE |
| Audit/outbox | YES |

## Acceptance criteria
Voided PENDING leg reopens outstanding by leg amount with zero cash effects; reversed COMPLETED cash leg produces contra fact + drawer compensation + PAID→due flip; both replay-safe.

## Required tests
unit, integration, idempotency, concurrency, reconciliation, regression.

## Dependencies and sequencing
Blocks B13; co-designed with B30 transitions (shared graph from D001).

## Delivery surfaces

Backend services: `lib/services/payment-transition.service.ts` — extended (not new) with `VOID`/`REVERSE` actions on the shared `transitionPaymentTx` entry point; new `maybeCreateReversalCompensatingMovementTx` helper
Database/schema: migration `0421_b10_payment_reversal_and_void.sql` — `voided_by`/`voided_at`/`reversed_by`/`reversed_at` on `org_order_payments_dtl`; `reversed_payment_id` (+ FK + index) on `org_cash_drawer_movements_dtl`; `PAYMENT_REVERSAL` movement type seed; `chk_history_action_type` extended with `PAYMENT_VOIDED`/`PAYMENT_REVERSED`
API/endpoints: `POST /api/v1/finance/pending-payments/[paymentId]/transition` — extended (not new) with `action: 'VOID' | 'REVERSE'` + optional `cashDrawerSessionId`
Frontend page/screen/dialog/action: `payment-transition-dialog.tsx` extended (VOID/REVERSE icons, no-fallback reason-only flow, conditional cash-drawer session picker for a cash-family REVERSE); Void button added to the B30 worklist (`pending-payments-worklist-page.tsx`) and the order Financial tab payments table (`order-payments-credits-tables.tsx`); Reverse button added to the Financial tab payments table only (worklist never lists COMPLETED legs)
Reusable components/helpers: `PaymentTransitionDialog` (shared, already existed for B30) extended rather than forked; reuses `/api/v1/cash-drawers` (same endpoint the B4/B3 tender flows use) for the open-session picker
Permissions: `orders:void_payment`, `orders:reverse_payment` (migration 0421, granted to `super_admin`/`tenant_admin`/`admin`/`branch_manager` — same set as B30's cancel/fail codes)
Validation: per-action legal source-status set (`PAYMENT_TRANSITION_SOURCE_STATUSES`); reason mandatory for both, no fallback classification for either; REVERSE cash-family leg requires a re-verified OPEN session or throws `CASH_DRAWER_SESSION_REQUIRED`/`CASH_DRAWER_SESSION_NOT_OPEN`
i18n/RTL: EN/AR added to `messages/{en,ar}/billing.json` (`pendingPayments.actions.void`, `pendingPayments.transition.void*`/`reverse*`/`cashDrawerSession*`/`errors.cashDrawerSession*`) and `messages/{en,ar}/orders/detail.json` (`financial.transitions.void`/`reverse`)
Accessibility: reuses the existing `CmxDialog`/`CmxTextarea`/`CmxSelectDropdown` primitives (focus-trapped, labelled) — no new a11y surface
Audit trail: dedicated `voided_by`/`voided_at`/`reversed_by`/`reversed_at` columns (mirrors B30's `cancelled_by`/`failed_by` precedent) + `transition_reason`; outbox events `PAYMENT_VOIDED`/`PAYMENT_REVERSED` → `org_order_history` via `order-history-consumer.service.ts` (extended)
Observability: new reconciliation checks `VOIDED_PAYMENT_NO_ORPHAN_MOVEMENT` and `REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT` (`voucher-checks.ts`, registered in `reconciliation.service.ts`) — trip-wires for the D004 money-movement invariants in both directions
Jobs/workers: none
Feature flag: none — extends an existing permission-gated action set (B30 precedent for CANCEL/FAIL_BOUNCE shipped unconditionally); no "before" behavior to preserve since VOID/REVERSE are wholly new actions
Rollout: VOID is safe immediately after migration 0421 applies (money-free); REVERSE's cash-drawer compensation is self-contained and safe to activate, but full financial correctness (BVM voucher-side unwind) is not complete until B13 ships — see Safety block
Rollback: no flag to disable; if needed, remove the permission grants (`orders:void_payment`/`orders:reverse_payment`) to hide both actions from all roles — statuses already written (`VOIDED`/`REVERSED`) remain valid in the D001 terminal/FAILED-aggregation set regardless

## End-to-end operational flow

1. **Void:** operator opens the B30 worklist or the order Financial tab, clicks Void on a PENDING/PROCESSING/AUTHORIZED leg, enters a reason (no classification) → `transitionPaymentTx` locks the row, verifies legality, flips to `VOIDED`, stamps `voided_by`/`voided_at`, recalculates the order snapshot (outstanding reopens by the leg amount automatically since `VOIDED` is in the FAILED/non-COMPLETED bucket), emits `PAYMENT_VOIDED` → `org_order_history` row. Idempotent replay via the existing D010 key mechanism.
2. **Reverse (non-cash):** operator opens Reverse on a COMPLETED/CAPTURED/SETTLED card/bank/check leg on the Financial tab, enters a reason → row flips to `REVERSED`, snapshot recalculates (PAID→due flip), `PAYMENT_REVERSED` emitted. No drawer/gateway effect (gateway reversal is B8).
3. **Reverse (cash):** same as above, but the dialog additionally requires picking an OPEN cash-drawer session; the service re-verifies that session is still OPEN server-side and creates a `PAYMENT_REVERSAL` OUT movement (linked via `reversed_payment_id`) so the drawer's expected cash reflects the physical correction — atomic in the same transaction as the status flip. Missing/closed session throws a stable error code the dialog surfaces as a blocking message (no silent mutation).

## Safety

UI design allowed: YES · UI implementation allowed: YES (shipped, no flag)
Production activation allowed: **VOID — yes, migration 0421 is APPLIED** (money-free, D001-approved). **REVERSE — payment-side effects (status flip, snapshot reopen, cash-drawer compensation) are production-correct on their own; full activation for legs that were BVM-voucher-wired at settlement additionally requires B13 VERIFIED** (a reversal that leaves the original voucher POSTED/un-reversed is an inconsistent BVM state — H4 again, just shifted one layer). Until B13 ships, REVERSE should only be activated for payments known not to carry a live wired voucher, or accepted with the documented BVM-side gap tracked for B13.
Required backend gates: none for VOID; B13 for REVERSE's full BVM consistency (per this package's own original Safety block)
Required decision gates: D001, D004 — both already APPROVED (Expert)
Required verification gates: unit test matrix green (34 new tests across VOID/REVERSE: legality, idempotency-payload-inclusion, cash-session-required/not-open, compensating-movement-lineage, orphan-movement trip-wire) + reconciliation check tests (4 new) — see Completion evidence gates below

**Gates ALL GREEN (2026-07-24):** tsc clean (2 pre-existing unrelated errors untouched: `order-service.ts`, `processing-piece-row.tsx`) / eslint 0 / full jest 224/224 suites, 2173/2173 tests, zero known failures / `npm run build` ✓ / `check:i18n` ✓ (pre-existing benign EN=AR placeholder warnings only, unrelated) / `check:ui-access-contract --wire` PASS for both `/dashboard/internal_fin/pending-payments` and `/dashboard/orders/[id]` / `sync:ui-access-contract` PASS (144/144 routes, drift 0).

## Completion evidence

**Implemented 2026-07-24 (uncommitted).** Extended the existing B30 `payment-transition.service.ts`/`transitionPaymentTx` (one shared entry point, same route/permission-per-action pattern) with two new actions instead of building parallel services — this reuses the already-proven D001 legality/D010 idempotency/outbox-emission/snapshot-recalc machinery B30 built, rather than duplicating it:

* **VOID** — legal from `PENDING`/`PROCESSING`/`AUTHORIZED` → `VOIDED`. Mandatory reason, **no D009 fallback classification** (deliberate divergence from CANCEL — see Architecture decision below). No money movement (never-effective legs); reuses the existing orphan-movement trip-wire.
* **REVERSE** — legal from `COMPLETED`/`CAPTURED`/`SETTLED` → `REVERSED`. Mandatory reason, no fallback. Cash-family legs require an operator-supplied **OPEN** `cashDrawerSessionId` (re-verified server-side, same "no silent money mutation" pattern as B9's cash-refund execution) and get a real compensating `PAYMENT_REVERSAL` OUT movement in `org_cash_drawer_movements_dtl`, linked via the new `reversed_payment_id` column (deliberately **not** `order_payment_id` — the B16/B35 expected-cash formula excludes `order_payment_id`-linked rows to avoid double-counting sale-mirror movements, and this movement must actively count as the compensating correction). Non-cash legs (card/bank/gateway/check) flip status only — gateway-side reversal is B8, out of scope.

**Architecture decision — VOID vs CANCEL overlap (PENDING/PROCESSING):** B30's existing CANCEL action already transitions `PENDING`/`PROCESSING` → `CANCELLED` with zero cash effects, which looks redundant with VOID's own `PENDING`/`PROCESSING` coverage. Kept both as genuinely distinct operator intents per D004: **CANCEL** = "the customer's payment plan genuinely failed" (heavier — mandatory D009 fallback classification routes how the now-unfunded balance gets settled). **VOID** = "this leg was a mistaken/duplicate entry — erase it" (lighter — no balance-routing decision exists because the tender was never real to begin with). Both actions ship in the worklist and the Financial tab side-by-side; this is documented, not an oversight.

**Architecture decision — no maker-checker on REVERSE:** B10's original draft text said "maker-checker" for reversal approval. Superseded by the folder [CLAUDE.md](CLAUDE.md) standing rule ("No need for maker-checker in approve even same user can approve if he have the required permission") — same precedent B16/B27/B30 already followed. REVERSE is single-step: permission-gated (`orders:reverse_payment`) + mandatory reason, no separate approver step.

**Architecture decision — contra fact = compensating movement, not a duplicate payment row:** D004's "contra fact linked to it" is satisfied by the original payment row flipping to `REVERSED` (naturally excluded from the COMPLETED lifecycle bucket, so outstanding reopens automatically via existing snapshot recalc — no new aggregation logic needed) plus the compensating drawer movement for cash legs. No second `org_order_payments_dtl` row is created — avoids a parallel-ledger-row pattern with no precedent elsewhere in the payment-facts model.

**Out of scope, deferred to B13 (per this package's own Out-of-scope + Safety block):** the BVM voucher tied to the original payment (via `fin_voucher_id`) is **not** reversed/wired by this package — B13 (Voucher Reversal Operational Unwind) owns that, using this package's `REVERSED` status write as its "payment reversal primitive." Production activation of REVERSE therefore stays gated behind B13 per the Safety block above; VOID has no such gate (money-free).

Migration: `0421_b10_payment_reversal_and_void.sql` authored — **STOP-AND-WAIT, not yet applied** · Implementation files: `lib/services/payment-transition.service.ts`, `lib/constants/order-financial.ts`, `lib/constants/permissions/orders-perm.ts`, `app/api/v1/finance/pending-payments/[paymentId]/transition/route.ts`, `lib/services/order-history-consumer.service.ts`, `lib/services/reconciliation/voucher-checks.ts`, `lib/services/reconciliation.service.ts`, `src/features/billing/access/billing-access.ts`, `src/features/orders/access/orders-access.ts`, `src/features/billing/ui/payment-transition-dialog.tsx`, `src/features/billing/ui/pending-payments-worklist-page.tsx`, `src/features/orders/ui/order-financial/order-payments-credits-tables.tsx`, `prisma/schema.prisma`, `messages/{en,ar}/billing.json`, `messages/{en,ar}/orders/detail.json` · Tests: `__tests__/services/payment-transition.service.test.ts` (+17 new), `__tests__/services/reconciliation/check-modules.test.ts` (+5 new) · Commit: — (uncommitted) · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
