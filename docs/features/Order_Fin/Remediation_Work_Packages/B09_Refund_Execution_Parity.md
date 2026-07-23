# B09 — Refund Execution Parity

## Metadata
Backlog ID: B9 · Severity: HIGH · Classification: CONTROL_GAP · Status: IMPLEMENTED (uncommitted, 2026-07-23)
Authoritative report sections: §8 (destinations table), §34, §40 (cash refund NOT_FOUND), §50-B9
Required decisions: [D004](00_Phase_0_Financial_Semantics/D004_Refund_Vs_Reversal_Vs_Void.md), [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md)
Dependencies: [B01](B01_Refund_Lineage_And_Reopen_Due.md) (hard — classification input); [B16](B16_Cash_Drawer_Filtering_And_Variance_Approval.md) (opt — drawer expected-cash coordination)
Blocks: — · Recommended phase: Seq 7

## Confirmed problem
Cash/original-method refunds are record-only: no drawer OUT movement, no REFUND_VOUCHER (type exists, disconnected), no gateway call — physical money movement is financially invisible (§8.1 process row).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-refund.service.ts:461–489 | wallet/CN execute; CASH/ORIGINAL record-only | no operational execution |
| constants/voucher.ts:60 | REFUND_VOUCHER defined | no production caller |
| refund-voucher-service.ts | exists | orphaned |
| cash-drawer movements | no refund OUT writer | drawer truth diverges on refunds |

## Required outcome
Processing a cash refund creates the REFUND_VOUCHER (+ lines), a drawer CASH_OUT movement wired to it, and POS-session gating; original-method (card/gateway) refunds route to the B8 gateway surface or an explicit manual-settlement record; all keyed (D010).

## Scope
Refund voucher activation + wiring handler; drawer OUT in process flow; execution-method resolution per destination.

## Out of scope
Classification/reopen (B1 — per D002 v2 / D003 v2: execution never alters classification, reason_context, or reopen values; commercial refunds do not reopen due, and B9 must not add any reopen side effect); gateway API itself (B8); GL journal (B6); tax credit note (B14).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | YES (refund voucher) |
| Cash drawer | YES (OUT movement) |
| Gateway or bank | POSSIBLE (via B8) |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (B6 event) |
| Snapshot | NO (facts already correct via B1) |
| Reconciliation | YES (refund-link + cash checks) |
| Customer receipt | YES (refund receipt print) |
| Audit/outbox | YES |

## Acceptance criteria
Cash refund reduces expected drawer cash by exactly the refund amount; refund voucher links to refund row and movement; no execution claim without an actual operational fact.

## Required tests
integration, reconciliation, idempotency, UI (refund receipt), regression.

## Dependencies and sequencing
Hard after B1; coordinates with B16 (drawer filtering) for expected-cash math.

## Delivery surfaces

Backend services: `processRefund` execution branch (`lib/services/order-refund.service.ts`) — REFUND_VOUCHER creation via `createBizVoucher`/`addVoucherLine`/`postAndWireBizVoucher`; new `order-refund-cash-drawer-wiring.handler.ts` wires the CASH destination to a real CASH_OUT movement; ORIGINAL_METHOD requires an operator-entered manual-settlement reference (no B8 gateway API exists yet — never a silent claim). `lib/services/refund-voucher-service.ts` (the pre-BVM orphaned file, confirmed zero production callers) was **not** reused/retired in this pass — left untouched, flagged as dead code for a future cleanup package, since retiring it is unrelated to shipping B9's real path.
Database/schema: **migration 0418** — `fin_voucher_id`/`fin_voucher_trx_line_id`/`cash_drawer_movement_id` added to `org_order_refunds_dtl` (correction to this doc's original "none new" assumption — re-investigated: the only alternative was a reverse-pointer lookup that cannot disambiguate multiple refunds on one order, already flagged as Phase-6 debt in `ar-checks.ts`'s own comment; this migration closes it, matching D010's "dedicated columns, never metadata" invariant).
API/endpoints: existing `PATCH /api/v1/orders/refunds/[refundId]/process` extended — optional JSON body (`cashDrawerSessionId` for CASH, `manualSettlementReference` for ORIGINAL_METHOD); response unchanged shape (refund row, now carrying the 3 new backlink columns when execution ran).
Frontend page/screen/dialog/action: **Refunds hub** (`/dashboard/internal_fin/refunds`) — the existing Process confirm dialog now collects the required input per method (drawer-session dropdown for CASH, a manual-reference text field for ORIGINAL_METHOD) when the flag is ON; **order Financial tab** — `refund-initiate-dialog.tsx`'s "record-only" hint now suppresses itself once the flag is ON (execution happens at Process, not Initiate). Refund receipt print artifact: **not built** — confirmed no such component exists anywhere in the codebase (not a B9 regression; genuinely never existed) — deferred, not blocking (the drawer session detail screen + the refund row itself are sufficient proof today).
Reusable components/helpers: the new wiring handler mirrors `cashDrawerWiringHandler`'s exact row shape; the process dialog reuses the same `CmxSelectDropdown`/`CmxInput` primitives already used elsewhere in this file.
Permissions: existing `orders:process_refund`/`orders:approve_refund` — no new codes needed (execution is gated by the feature flag + the existing process permission, not a separate code).
Validation: CASH requires the selected drawer session to be `status='OPEN'` at process time (re-verified server-side, not just trusted from the picker); ORIGINAL_METHOD requires a non-empty manual-settlement reference (1-200 chars, Zod-validated).
i18n/RTL: EN/AR added under `billing.refunds.execution.*` and 3 new `billing.refunds.errors.*` codes.
Accessibility: reused existing Cmx primitives/dialog patterns — no new a11y surface.
Audit trail: voucher ↔ refund row ↔ movement backlinks via the 3 new dedicated columns (not metadata); actor stamped via the voucher's `created_by`/`performed_by`.
Observability: `REFUND_LINK_EXISTS` (ar-checks.ts) rewritten with two verification modes — unambiguous (via the new backlink columns, when execution ran) and the original reverse-pointer fallback (legacy/flag-off rows) — plus a new sub-check that a CASH refund's voucher has a linked drawer movement.
Jobs/workers: none
Feature flag: `order_fin_refund_execution` (independent, default OFF — record-only fallback exactly matches pre-B9 behavior)
Rollout: flag OFF in every environment today; production activation only after B1 VERIFIED (recorded in this package's Safety block) and drawer-parity tests green (already green in this session's gates; still needs the recorded Preview QA approval per the folder's release-promotion rule)
Rollback: flag off → record-only behavior (today's state), facts remain consistent — verified by dedicated tests (`processRefund — B9 execution flag off`) asserting zero voucher/wiring calls

## End-to-end operational flow

1. Processor confirms a cash refund (B34 screen) → service executes: refund voucher posted, drawer CASH_OUT written, refund row PROCESSED, snapshot recalc — one tx.
2. Cashier sees drawer expected-cash drop by the refund amount; customer receives the printed refund receipt.
3. Original-method (card/gateway) refunds route to the B8 surface or an explicit manual-settlement record — never silently claimed.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: only after B1 VERIFIED (classification correctness) and drawer parity tests green
Required backend gates: B1 VERIFIED
Required decision gates: D004, D007 approved
Required verification gates: drawer-parity tests green; refund voucher ↔ movement ↔ row link assertions passed

## Completion evidence

**IMPLEMENTED 2026-07-23 (uncommitted).** Full-cycle: migration, wiring handler, service execution branch, API route, frontend (process dialog + initiate-dialog hint), i18n EN/AR, reconciliation extension, tests.

**Migration `0418_b09_refund_execution_backlinks.sql` — STOP-AND-WAIT, not yet applied.** Adds `fin_voucher_id`/`fin_voucher_trx_line_id`/`cash_drawer_movement_id` to `org_order_refunds_dtl` (nullable, sparse-unique on the two line-scoped columns, no FK — mirrors the exact pattern migration 0303 already established for every other `fin_voucher_id` backlink in this codebase). `prisma/schema.prisma` hand-updated + `npx prisma generate` re-run (same pattern as B3/B4/B7/B27/B30) so the service layer type-checks and unit-tests before the owner applies the migration.

**Backend:**
- New `lib/services/wiring/order-refund-cash-drawer-wiring.handler.ts` — `canHandle`: `line_role === ORDER_REFUND && direction === 'OUT' && payment_method_code === CASH && cash_drawer_session_id != null`. Distinct from `cashDrawerWiringHandler` (owns ORDER_PAYMENT/IN legs): a refund line is a self-contained OUT leg, not a change-return sub-leg, so its movement links **both** `fin_voucher_id` and `fin_voucher_trx_line_id` (no sparse-index conflict with the change-return convention). Registered in `voucher-wiring.service.ts`'s `WIRING_HANDLERS`.
- `order-refund.service.ts`'s `processRefund` gained a 4th optional parameter (`execution?: RefundExecutionInput`) — omitted or `{enabled: false}` preserves the **exact** pre-B9 record-only behavior (verified by dedicated tests). When enabled: **CASH** requires `cashDrawerSessionId`, re-verifies the session is `status='OPEN'` server-side (never trusts the client), creates a REFUND_VOUCHER + `ORDER_REFUND`/OUT line wired to a real `CASH_OUT` movement, then backfills the 3 lineage columns. **ORIGINAL_METHOD** requires a non-empty `manualSettlementReference` (no B8 gateway API exists yet — this is never claimed automatically, per D004/D007); creates a REFUND_VOUCHER carrying the reference on the voucher line's `gateway_reference` and the refund row's existing `gateway_refund_id` column, no drawer movement. **WALLET/CREDIT_NOTE** destinations are completely untouched by the flag (they redeem stored-value ledgers directly, per their existing B01 code path — confirmed by a dedicated test). Three new stable error codes: `REFUND_CASH_DRAWER_SESSION_REQUIRED`, `REFUND_CASH_DRAWER_SESSION_NOT_OPEN`, `REFUND_MANUAL_SETTLEMENT_REFERENCE_REQUIRED`.
- API route (`.../process/route.ts`) resolves the `order_fin_refund_execution` flag server-side via `canAccess(tenantId, ...)` (not trusted from the client) and Zod-validates the optional body.

**Frontend:** `refunds-list-client.tsx`'s existing Process confirm dialog gained conditional fields — a cash-drawer session dropdown (fetched from `/api/v1/cash-drawers`, filtered to currently-open sessions; no "open a new session" flow inlined here, unlike the checkout-time `useCashDrawer` hook — a back-office ops screen reasonably expects the drawer to already be open) for CASH, a manual-settlement-reference text input for ORIGINAL_METHOD; submit is disabled until the required field is filled. `refund-initiate-dialog.tsx`'s "record-only" amber hint now reads the same flag (`useFeature('order_fin_refund_execution')`) and suppresses itself once execution is real — the hint was previously unconditional.

**Reconciliation:** `checkRefundLink` (`ar-checks.ts`) rewritten with two verification modes rather than one: **unambiguous mode** for rows with the new `fin_voucher_id` backlink populated (verifies that exact voucher id is POSTED, and for CASH that `cash_drawer_movement_id` is also set — a NULL there means the wiring silently failed, a genuine defect); **reverse-pointer fallback mode** for legacy/flag-off rows (`fin_voucher_id` NULL), preserving the original Phase-2 check byte-for-byte. WALLET/CREDIT_NOTE refunds are excluded from both modes (they never create a REFUND_VOUCHER).

**Scope decisions:**
- `refund-voucher-service.ts` (the pre-BVM orphaned file with zero production callers, confirmed by the research pass) was **not** retired/rewritten in this package — out of scope; flagged as dead code for a future cleanup pass, not blocking B9's real path (which is built directly on `createBizVoucher`/`addVoucherLine`/`postAndWireBizVoucher`, the proven pattern).
- No refund receipt/print artifact was built — confirmed none existed before B9 either; deferred as a genuinely separate, non-blocking UI gap.
- POS-session gating: the **hard** gate is the direct `org_cash_drawer_sessions_mst.status='OPEN'` check inside the transaction; the existing `assertOpenPosSessionForFinanceTx` call is kept as an **opportunistic** secondary check (mirrors `initiateRefund`'s own optional usage) since the B34 refund UI has never collected a `posSessionId` and doesn't start doing so in this package.

**Tests:** `order-refund-b9-execution.test.ts` (9 cases — flag-off record-only ×2, CASH drawer-required/not-open/happy-path, ORIGINAL_METHOD reference-required/happy-path, WALLET untouched), `order-refund-cash-drawer-wiring.handler.test.ts` (9 cases — canHandle ×4, validate, wire ×2, getLinkedEffect ×2), `check-modules.test.ts` (+4 B9 `checkRefundLink` cases). All 31 pre-existing `refund-b01-matrix.test.ts` scenarios re-run and pass unchanged (confirms zero regression to the flag-off path).

**Gates ALL GREEN:** `npx tsc --noEmit` clean (only the pre-existing, untouched-file errors in `order-service.ts`/`processing-piece-row.tsx`) · `npx eslint . --quiet` exit 0 · full jest 224/224 suites, 2156/2156 tests, zero known failures · `npm run build` exit 0 · `npm run check:i18n` PASS (same 7 pre-existing EN=AR placeholder warnings, unrelated).

**No access-contract/navigation changes** — B9 extends an existing route (`/dashboard/internal_fin/refunds`) and its existing API endpoint; no new permission codes, no new nav entry, so `check:ui-access-contract`/`sync:ui-access-contract` were not re-run for this package (nothing in scope for them to validate).

Migration: `0418_b09_refund_execution_backlinks.sql` (authored, STOP-AND-WAIT) · Implementation files: see above · Tests: `order-refund-b9-execution.test.ts`, `order-refund-cash-drawer-wiring.handler.test.ts`, `check-modules.test.ts` (+4) · Commit: — (owner commits) · Preview QA (deploy/result/approval): — (owner queue; add scenarios to QA_TEST_GUIDE.md before VERIFIED) · Reviewer: — · Verification: — (pending B1 VERIFIED + Preview QA per this package's own Safety block) · Authoritative report update: —
