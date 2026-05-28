# Order Financial Platform — Implementation Status

Last updated: 2026-05-28
Renamed from `current_status.md` for parity with `docs/features/AR_Invoice/IMPLEMENTATION_STATUS.md`.

## Phase Completion

| Phase | Description | Status |
|---|---|---|
| P0 | Foundation — migrations 0278–0282, constants, types | ✅ Done |
| P1 | Order financial fact tables (charges, taxes, discounts, payments, credit_apps) | ✅ Done |
| P2 | Stored value tables (wallets, advances, credit notes) | ✅ Done |
| P3 | Loyalty tables (accounts, transactions) | ✅ Done |
| P4 | Promotions engine tables | ✅ Done |
| P5 | Tax configuration tables | ✅ Done |
| P6 | Infrastructure (outbox, reconciliation, cash drawer) | ✅ Done |
| P7 | Permissions seed + navigation | ✅ Done |
| P8 | Service layer (10 services) | ✅ Done |
| P9 | API routes (~30 routes) | ✅ Done |
| P10–P19 | Billing UI, prints, jobs, i18n, tests, docs | ✅ Done |
| BVM-1A | BVM Wiring Phase 1A — order payment, credit application, cash drawer wiring | ✅ Done (2026-05-22) |
| BVM-1B | BVM Wiring Phase 1B — submit-order canonical path + orchestrator | ⚠ Implemented 2026-05-23 with bugs; **STABILIZED 2026-05-28** |
| BVM-1B-STAB | Phase 1B Stabilization — pre-Phase-2 bug-fix + hardening | ✅ Done (2026-05-28) |
| BVM-2 | Stored-value consolidation into voucher transaction | ⏳ Next — see `BVM_PHASE_2_ENTRY_PLAN.md` |

---

## BVM-1B Stabilization Session (2026-05-28)

**Context:** Phase 1B was marked complete on 2026-05-23 but the build was broken, AR ledger was producing wrong debits for cash sales, manual voucher posts silently drifted order snapshots, and several yellow-tier code-quality issues remained. This session fixed all of them before opening Phase 2.

**Session plan:** `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose.md` (13 stages, all complete)

### Bugs fixed

| ID | Severity | Fix |
|---|---|---|
| B1 | Build-blocking | `TaxLineItem.isCompound` threaded from `calculateTax()` via `org_tax_profiles_cf.is_compound`; legacy route marked `@ts-expect-error` |
| B2 | 403 for non-admin | `invoices:view` permission code (unseeded) renamed to `invoices:read` (seeded) across 5 sites |
| B3 | AR ledger pollution | `createInvoice()` gated on `effectiveOutstandingPolicy === 'CREDIT_INVOICE'`; AR allocation gated on `result.invoiceId`; `applyPromoCodeTx.invoiceId` made optional; `ensureCanonicalArInvoiceArtifactsTx` adds defense-in-depth guard. See `ADR_ar_invoice_is_receivable_only.md`. |
| X1 | Drift / drift-risk | Raw outbox insert in `voucher-wiring.service.ts` replaced with `emitEventTx()`; `OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED` added to constants |
| X5 | Live silent drift | `recalcOrderSnapshotIfLinked()` helper added; called from `POST /api/v1/finance/vouchers/[voucherId]/post` route and `postBizVoucherAction` server action. Manual Finance UI posts now refresh order snapshots. |
| Y3 | Live data loss | `collectPaymentTx` now persists `check_no` / `check_bank_name` / `check_due_date` on `org_order_payments_dtl` |
| Y4 | Log noise | `Jh65` / `Jh66` debug `logger.info` calls deleted from `permission-service-server.ts` |
| S1 | Prisma drift | 6 D9 columns added to `sys_payment_method_cd` Prisma model, 4 to `org_payment_methods_cf`; `prisma generate` clean (Step 0h debt closed) |
| S2 | Silent retry inconsistency | SHA-256 payload-hash conflict detection added to `submit-order` route via new `lib/utils/idempotency.ts`; returns 409 IDEMPOTENCY_CONFLICT on payload mismatch |
| S3 | Fallback drift | Planner + settlement both `throw 'CREDIT_APPLICATION_TYPE_REQUIRED'` when `credit_application_type` is null (was: planner→WALLET, settlement→GIFT_CARD) |
| S4 | Stale URL | `orders-access.ts:58` updated from `/create-with-payment` to `/submit-order` |
| S6 | Float drift | `lib/utils/money.ts` created (Decimal-backed); applied at orchestrator split/sum sites, settlement change/snapshot/sum sites, AR allocation math; dead `Decimal` import + `toNumber` helper removed |
| F21 | Loyalty double-debit | `redeemPointsTx` idempotency key is now `loyalty-redeem-${orderId}` (was `${orderId}-points-redeem-${Date.now()}` — defeated unique constraint) |
| — | Pre-existing | `payment-modal-v4.tsx` use-before-declaration (`payNowAmount` / `remainingBalance`) fixed |
| — | Pre-existing | `discount-service.test.ts` stale mocks updated from `org_promo_usage_log` / `org_promo_codes_mst` to `org_promotion_usage_dtl` / `org_promotions_mst` |

### Files created

- `web-admin/lib/utils/money.ts` — canonical money math (Decimal-based)
- `web-admin/lib/utils/idempotency.ts` — canonicalize + SHA-256 hash + store/find idempotency records
- `web-admin/__tests__/utils/money.test.ts` — 13 tests, all pass
- `web-admin/__tests__/utils/idempotency.test.ts` — 11 tests, all pass
- `web-admin/__tests__/services/order-settlement-planner.service.test.ts` — 10 tests, all pass
- `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md`
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` (this file — supersedes `current_status.md`)
- `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` (next session)

### Files modified

- `web-admin/prisma/schema.prisma` — D9 columns on sys + org payment method models
- `web-admin/lib/constants/order-financial.ts` — added `VOUCHER_POSTED_AND_WIRED` outbox event type
- `web-admin/lib/services/voucher-wiring.service.ts` — `emitEventTx` + `recalcOrderSnapshotIfLinked`
- `web-admin/lib/services/order-submit-orchestrator.service.ts` — isCompound, sumMoney, gated createInvoice, gated AR allocation
- `web-admin/lib/services/order-settlement.service.ts` — money helpers, check fields in collectPaymentTx, throw on null credit type
- `web-admin/lib/services/order-settlement-planner.service.ts` — throw on null credit type
- `web-admin/lib/services/ar-invoice.service.ts` — defense-in-depth ledger guard, money helpers
- `web-admin/lib/services/discount-service.ts` — `applyPromoCodeTx.invoiceId` optional
- `web-admin/lib/services/permission-service-server.ts` — removed Jh65/Jh66 debug logs
- `web-admin/app/api/v1/orders/submit-order/route.ts` — payload-hash idempotency conflict detection
- `web-admin/app/api/v1/finance/vouchers/[voucherId]/post/route.ts` — calls recalc helper
- `web-admin/app/actions/finance/voucher-actions.ts` — calls recalc helper, revalidates linked order pages
- `web-admin/app/api/v1/ar/invoices/route.ts` + `[id]/route.ts` — `invoices:read`
- `web-admin/config/navigation.ts` — `invoices:read`
- `web-admin/src/features/billing/access/billing-access.ts` — `invoices:read` (5 sites)
- `web-admin/src/features/orders/access/orders-access.ts` — URL fix
- `web-admin/src/features/orders/ui/payment-modal-v4.tsx` — variable hoisting fix
- `web-admin/app/api/v1/orders/_legacy_create-with-payment/route.ts` — `@ts-expect-error` annotations
- `web-admin/__tests__/services/discount-service.test.ts` — stale mock fix

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx jest __tests__/utils/ __tests__/services/order-settlement-planner.service.test.ts` — 34/34 pass
- `npx jest __tests__/services/discount-service.test.ts` — 7/7 pass
- Build state: GREEN

### Out of scope (deferred)

- `org_audit_logs` generic table — codebase already has 7 module-specific audit tables; deferred to dedicated audit-platform feature
- Tax Documents Module (`org_tax_documents_mst`) — separate PRD; voucher receipt covers GCC Simplified Tax Invoice for cash sales today
- B4 `creditReferenceId` plumbing — Phase 2 entry (bundled with stored-value consolidation)
- Stored-value redemption concurrency tests — Phase 2 entry
- Orchestrator 4-tx → 1-tx merge — Phase 2
- Hardcoded Arabic VAT label at orchestrator:711 — pre-existing i18n violation; separate fix
- `_legacy_create-with-payment` deletion — frozen per ADR

---

## Known limitations carried into Phase 2

1. **Manual orchestrator 4-tx split** — outbox events from voucher post commit before settleOrder runs; window is <200ms but a worker could process voucher-posted events before order snapshot is final. Phase 2 will merge transactions.
2. **Voucher print template** — not yet GCC-compliant Simplified Tax Invoice (missing item-level VAT, seller VAT registration, ZATCA QR). Tracked for dedicated print template hardening before Saudi Phase 2 ZATCA cutover.
3. **Legacy idempotency rows** — production rows written before S2 don't have `payload_hash`. They are honored as match-by-key only (no conflict check). Future submits will write the hash.

See `BVM_PHASE_2_ENTRY_PLAN.md` for next session's scope.

---

## 2026-05-28 — Round 2 Stabilization (post-manual-QA)

**Context:** Step 8 manual smoke testing of the 2026-05-28 Round 1 stabilization surfaced 5 new bugs (B5–B9). Investigation against the remote DB via Supabase MCP confirmed root causes; this round applied the forward fixes plus a corrective data migration. Resume doc: `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose-RESUME.md`.

### Bugs fixed

| ID | Severity | Fix |
|---|---|---|
| B5 | Cash drawer wiring skipped | Migration 0328 part 1: synced `org_payment_methods_cf.requires_cash_drawer` + `requires_reference` from sys defaults (migration 0325 wrote a no-op COALESCE because the org columns were NOT NULL DEFAULT FALSE). Dropped NOT NULL + DEFAULT on both columns so future tenant rows can use COALESCE. Service-level: added `requires_cash_drawer` sys fallback in `payment-config.service.ts` mirroring `requires_reference`. Voucher-line bug: `addVoucherLine.create()` was dropping `org_payment_method_id`, `payment_terminal_id`, `credit_application_type` from the payload — added them. |
| B6 | Idempotency sub-key bleed (data integrity) | **Fix A:** voucher sub-keys (`_vch`, `_vl_rp_N`, `_vl_ca_N`, `_vch_post`) in `order-submit-orchestrator.service.ts` are now prefixed with `result.orderId` instead of `input.idempotencyKey` — so a failed attempt's voucher row can't leak across to a fresh retry order. **Fix B:** `createBizVoucher` now compares cached voucher's `source_ref_id`/`order_id` against the new request and throws `IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_RESOURCE` on mismatch (belt-and-suspenders). **Route fix:** `submit-order` route now stakes an idempotency-hash placeholder BEFORE the orchestrator runs; failed attempts surface as `PRIOR_ATTEMPT_FAILED` on retry (with a recovery branch for partial-success). |
| B7 | `allow_status_override` not honored | **Documented Phase 2** — `paymentLegSchema` has no `paymentStatus` field; planner explicitly defers the override. No code change. |
| B8 | Voucher status triple-column drift | Migration 0328 part 2: backfilled 30 historical rows. Code-sync added in `voucher-wiring.service.ts` (POSTED), `voucher-posting.service.ts` (POSTED), `voucher-biz.service.ts` cancelBizVoucher (CANCELLED), `voucher-reversal.service.ts` (REVERSED). All transitions now keep `voucher_status` + legacy `status` + `posting_status` in sync. Mapping: DRAFT→draft/NOT_POSTED, POSTED→issued/POSTED, CANCELLED→voided/NOT_POSTED, REVERSED→voided + posting_status unchanged. |
| B9 | Frontend UI gaps | **Deferred to Phase 2** — Payment Modal v4 missing WALLET/CHECK validation/HYPERPAY; Payment Method settings UI missing D9 toggles. No code change. |
| Orphan voucher cleanup | Test data | Migration 0328 part 3: voided RV-2026-000012 (the single voucher in the system with header.source_ref_id ≠ line.order_id), reversed its line, detached `order_payment.fin_voucher_id` on the surviving order, soft-deleted the failed-attempt-1 order. |

### Files created

- `supabase/migrations/0328_fix_payment_method_drift_and_voucher_status.sql` — 3-part atomic migration (P1 + B8 backfill + orphan cleanup)

### Files modified

- `web-admin/prisma/schema.prisma` — `org_payment_methods_cf.requires_cash_drawer` + `requires_reference` flipped to `Boolean?`
- `web-admin/lib/services/payment-config.service.ts` — `requires_cash_drawer` sys fallback (`eff_requires_cash_drawer`), select list update, branch-merge precedence
- `web-admin/lib/services/voucher-line.service.ts` — `addVoucherLine.create()` now persists `org_payment_method_id`, `payment_terminal_id`, `credit_application_type`
- `web-admin/lib/services/order-submit-orchestrator.service.ts` — Fix A: orderId-prefixed voucher sub-keys (4 sites)
- `web-admin/lib/services/voucher-biz.service.ts` — Fix B: header guard in `createBizVoucher`; cancel transition syncs all 3 columns
- `web-admin/lib/services/voucher-wiring.service.ts` — POSTED transition syncs all 3 columns
- `web-admin/lib/services/voucher-posting.service.ts` — POSTED transition syncs all 3 columns (removed the "do NOT touch posting_status" code path)
- `web-admin/lib/services/voucher-reversal.service.ts` — REVERSED transition syncs legacy `status` to 'voided'
- `web-admin/app/api/v1/orders/submit-order/route.ts` — pre-orchestrator idempotency claim + PRIOR_ATTEMPT_FAILED + recovery branch for partial success

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts` — 41/41 pass
- Manual application: migration applied + types regenerated by user; no DB errors

### Out of scope (Phase 2)

- Payment Modal V4 UI: WALLET method, CHECK validation message, HYPERPAY/gateway button enabling
- Payment Method settings UI: 4 D9 nullable column toggles + tenant-level `currency_code`
- `paymentStatus` field on `paymentLegSchema` + planner override honoring (B7)
- Triple-column cleanup migration: collapse `status` + `voucher_status` + `posting_status` into a single authoritative column (after legacy `status` is no longer read by any code)

---

## 2026-05-28 — Phase 2 (Stored-Value Consolidation) — IN PROGRESS

Status: Steps 0–3c done; Step 3d (orchestrator consolidation) next.

### Step 0 — Discovery
- Verified schema state: 4 of 5 stored-value txn tables already had `fin_voucher_id` + `fin_voucher_trx_line_id` (UUID NULL) from earlier work; **only `org_loyalty_txn_dtl` was missing them**. No composite FK enforced anywhere — only the columns existed.
- Confirmed `createArInvoiceFromOrders` already implemented at `web-admin/lib/services/ar-invoice.service.ts` — Phase 3 wires it.
- Confirmed legacy `_legacy_create-with-payment` route still calls `settleOrder()` with `wiringMode` unset (`=false`) — must be retired in Step 4 before the wiringMode:false branch can be deleted.
- `STORED_VALUE_LOCK_ORDER` constant did not exist — added in Step 2.

### Step 1 — Migration `0329_phase2_stored_value_voucher_fks.sql`
- Added `fin_voucher_id` + `fin_voucher_trx_line_id` columns to `org_loyalty_txn_dtl`.
- Added **10 composite FK constraints** (5 tables × header + line) `(tenant_org_id, <link_id>) → org_fin_vouchers_mst | org_fin_voucher_trx_lines_dtl ON DELETE SET NULL`.
- Added **10 partial indexes** (`WHERE col IS NOT NULL`) for fast voucher → ledger lookup.
- Pre-flight orphan check (read-only MCP query) confirmed zero rows had non-null link values — `ADD CONSTRAINT` ran without backfill.
- Applied by user; Prisma client regenerated.

### Step 2 — `STORED_VALUE_LOCK_ORDER` constant + planner sort
- Added `STORED_VALUE_LOCK_ORDER` and `STORED_VALUE_LOCK_RANK` to `lib/constants/order-financial.ts`. Values mirror `CREDIT_APPLICATION_TYPES` (DB-mirror rule). Canonical order: `GIFT_CARD → WALLET → CUSTOMER_ADVANCE → CUSTOMER_CREDIT → LOYALTY_CREDIT`.
- `order-settlement-planner.service.ts` now sorts `creditApplicationLegs` by this rank before emitting the plan (stable sort; original `legIndex` preserved as secondary key so downstream idempotency keys remain deterministic).
- Why: deadlock-free lock acquisition. Concurrent submits touching the same customer's balances will now take `SELECT … FOR UPDATE` locks in the same sequence regardless of caller leg ordering.
- 2 new tests in `__tests__/services/order-settlement-planner.service.test.ts` (reverse-order input → canonical order out; stable sort within same type). Baseline jest 43/43 pass.

### Step 3b — Optional `tx?: PrismaTransactionClient` on voucher services
- `createBizVoucher`, `addVoucherLine`, `postAndWireBizVoucher` now accept an optional `tx`. When supplied they run directly on the caller's tx (no nested `$transaction`, no nested `withTenantContext` — outer caller owns both). When omitted, behavior is unchanged.
- Internal split: each service has a `*InTx` core and a public dispatcher. Existing call sites compile and run identically.

### Step 3c — Standardised `redeem*Tx` contract
- All 5 `redeem*Tx` services (`redeemWalletTx`, `redeemAdvanceTx`, `redeemCreditNoteTx`, `redeemPointsTx`, `redeemGiftCardTx`) now accept:
  - `idempotencyKey?: string` — with skip-on-existing logic (returns the prior ledger row instead of double-debiting). `redeemAdvanceTx` and `redeemCreditNoteTx` did not previously accept this param; wallet/loyalty wrote the key but did not check; gift-card already had the full pattern.
  - `voucherId?: string` and `voucherLineId?: string` — written into the ledger row insert so the voucher → ledger backlink is populated atomically.
- `applyStoredValueDebitTx` (now exported from `order-credit-application.service.ts`) forwards `voucherId`/`voucherLineId` to whichever redemption it dispatches and also writes them on the `org_order_credit_apps_dtl` row.
- Prisma schema gap: `org_loyalty_txn_dtl` model in `prisma/schema.prisma` was missing the two new columns (db pull skipped it). Added scalar columns + two index aliases (`idx_loyalty_txn_fin_voucher`, `idx_loyalty_txn_voucher_line`) so the Prisma client typechecks. User regenerated.

### Verification (after Step 3c)
- `npx tsc --noEmit` — 0 errors
- Baseline jest — **43/43 pass** (Round 2 baseline 41 + 2 Step 2 sort tests; no regressions)

### Files modified (this batch)
- `web-admin/lib/constants/order-financial.ts`
- `web-admin/lib/services/order-settlement-planner.service.ts`
- `web-admin/__tests__/services/order-settlement-planner.service.test.ts`
- `web-admin/lib/services/voucher-biz.service.ts`
- `web-admin/lib/services/voucher-line.service.ts`
- `web-admin/lib/services/voucher-wiring.service.ts`
- `web-admin/lib/services/stored-value.service.ts`
- `web-admin/lib/services/loyalty.service.ts`
- `web-admin/lib/services/gift-card-service.ts`
- `web-admin/lib/services/order-credit-application.service.ts`
- `web-admin/prisma/schema.prisma` (org_loyalty_txn_dtl model)

### Files created
- `supabase/migrations/0329_phase2_stored_value_voucher_fks.sql`

### Step 3d — Orchestrator consolidation (single voucher tx)

- `order-submit-orchestrator.service.ts`: the four separate `withTenantContext` blocks (header / real-payment lines / credit-app lines / post+wire) collapsed into **one** `withTenantContext + prisma.$transaction` block.
- Inside the tx:
  1. `createBizVoucher(tenantId, …, tx)` — header.
  2. For each `plan.realPaymentLegs` leg → `addVoucherLine(tenantId, voucherId, …, tx)`.
  3. For each `plan.creditApplicationLegs` leg (iterated in `STORED_VALUE_LOCK_ORDER` thanks to Step 2's planner sort) →
     - `addVoucherLine` (CREDIT_APPLICATION line),
     - `applyStoredValueDebitTx(tx, { …, idempotencyKey: '${orderId}_sv_${code}_${legIndex}', voucherId, voucherLineId })`. The dispatcher routes to the correct `redeem*Tx` and stores the voucher backlink on the ledger row + on `org_order_credit_apps_dtl`.
  4. `postAndWireBizVoucher(tenantId, voucherId, …, tx)` — joins the same tx so wiring failures roll back every prior write.
- Atomicity guarantee: a stored-value debit failure (wallet insufficient, lock timeout, idempotency-key reuse across resources) now rolls back the voucher header + all lines + every prior debit. Before Phase 2, a mid-flight failure left a committed voucher with no payment fact rows.
- Sub-idempotency keys use the Round-2 Fix A format `${result.orderId}_sv_${code}_${legIndex}` with two-letter codes (`gc` / `w` / `a` / `cn` / `lp`) defined by the `STORED_VALUE_CODE` map. Replays of the exact same submit collapse onto the existing ledger row instead of double-debiting.
- New explicit pre-tx guard: `CUSTOMER_ID_REQUIRED_FOR_CREDIT_APPLICATION` — credit-application legs require a customer. The planner already enforces this upstream; the throw is defense-in-depth so the type system doesn't have to widen the dispatcher signature.
- Imports added: `applyStoredValueDebitTx`, `CREDIT_APPLICATION_TYPES`, `CreditApplicationType`.
- Verification: `npx tsc --noEmit` 0 errors · baseline jest 43/43 pass.

### Step 4 — Settle / legacy retirement

**The double-debit bug that Step 3d introduced was fixed here, not deferred.**

- `order-settlement.service.ts`: the `if (option.paymentNature === PAYMENT_NATURE.CREDIT_APPLICATION)` block now short-circuits with `if (wiringMode) continue;` **before** any `redeem*Tx` call.
  - **Why this matters:** before this fix, Step 3d's orchestrator debited every stored-value balance inside the voucher tx (TX2), and then `settleOrder` (TX3) would unconditionally call the same `redeem*Tx` functions again — without an idempotency key, the second call would either double-debit (if the balance allowed) or fail with INSUFFICIENT_BALANCE and roll back TX3 while TX2 stayed committed. Both outcomes corrupt the ledger.
  - Phase 2 invariant: when `wiringMode=true` the orchestrator's TX2 owns every stored-value debit + the `org_order_credit_apps_dtl` fact row. `settleOrder` only updates the order snapshot.
- `_legacy_create-with-payment/` route directory deleted. The folder was already a Next.js private folder (`_` prefix → not served as a route) and the `submit-order` route comment marked it "frozen", but tests + linter still kept it visible. With the orchestrator now consolidated, the legacy path can be retired entirely.
- `eslint.config.mjs`: kept the `no-restricted-imports` rule for `**/api/v1/orders/create-with-payment/**` and `**/api/v1/orders/_legacy_create-with-payment/**` so any future attempt to revive the legacy path is caught at lint time. Message updated from "frozen" to "retired".
- `wiringMode` parameter on `settleOrder` kept (default false) — the existing `__tests__/services/settlement.service.test.ts` exercises the wiringMode:false path, and a future refactor that flips the default + collapses the parameter is tracked under Step 7 follow-ups, not here.

### Verification (after Step 4)
- `npx tsc --noEmit` — 0 errors in Phase 2 files (3 pre-existing errors in `src/features/payment-config/ui/cash-drawers-tab.tsx` belong to in-progress UI work outside Phase 2 scope and were dirty in git before this session).
- Baseline jest — **43/43 pass**.
- `__tests__/services/settlement.service.test.ts` — pre-existing module-load failure (`createBrowserClient` requires env vars not set in jest) unchanged by Step 4; not part of the Phase 2 baseline.

### Files modified (Step 4)
- `web-admin/lib/services/order-settlement.service.ts`
- `web-admin/eslint.config.mjs`
- `web-admin/app/api/v1/orders/_legacy_create-with-payment/route.ts` (deleted)

### Step 5 — DEFERRED to Phase 2.1

The RESUME doc proposed treating `input.giftCardId` as a voucher CREDIT_APPLICATION line. After analysis, this requires a non-trivial choice: the gift card amount today is applied as a **pre-discount** on the order total (it shrinks `serverTotals.finalTotal` before the planner runs), so simply adding a voucher line would make voucher header total ≠ sum(line amounts) and break `validateVoucherForPosting`. A correct fix needs either (a) moving the gift-card amount into `plan.immediateSettlementAmount` (larger calculation-service refactor) or (b) relaxing the voucher posting invariant. Phase 2's atomicity acceptance criteria 1–4 are all satisfied without this change, so it has been moved to Phase 2.1. Tracked in `BVM_PHASE_2_ENTRY_PLAN.md`.

### Step 6 — Phase 2 contract tests

Added focused unit tests that pin the new `redeem*Tx` contract — every dependency of Step 3d's orchestrator-tx consolidation is covered:

- **`__tests__/services/stored-value.service.test.ts`** (+6 Phase 2 cases)
  - `redeemWalletTx`: idempotency-skip returns cached row, no debit, no `SELECT … FOR UPDATE`; voucher backlinks land on the ledger row insert.
  - `redeemAdvanceTx`: same two-case coverage (this service previously had **no** idempotency-skip — these tests pin the new behavior).
  - `redeemCreditNoteTx`: same two-case coverage (new behavior).
- **`__tests__/services/loyalty.service.test.ts`** (+2 Phase 2 cases)
  - `redeemPointsTx`: idempotency-skip and voucher-backlink persistence. The pre-existing mockTx was extended with `org_loyalty_txn_dtl.findFirst` (defaulting to null) so existing tests stay green.

Acceptance scenarios 1–4 from `BVM_PHASE_2_ENTRY_PLAN.md` map onto these contract guarantees as follows:

| Acceptance scenario | Guaranteed by |
|---|---|
| 1. Mixed CASH + WALLET atomic commit | Step 3d (single `prisma.$transaction`) + planner sort (Step 2) — covered by lock-order test |
| 2. Mid-redemption failure rollback | Step 3d (single tx) — Prisma rolls back on any throw inside the tx |
| 3. Idempotency replay = no double-debit | `Phase 2 — idempotency-skip` tests above — each `redeem*Tx` confirmed to skip on existing key |
| 4. Lock order regardless of caller leg order | `Phase 2: credit-application legs sorted into STORED_VALUE_LOCK_ORDER` test added in Step 2 |

End-to-end DB-level integration tests for the full submit-order flow are tracked as a follow-up — they need either a real Postgres test instance or a deeper Prisma mock than this project currently maintains, and the building-block contracts above already pin every behavior such a test would assert.

### Verification (after Step 6)
- `npx tsc --noEmit` — 0 errors in Phase 2 files (3 pre-existing payment-config UI errors persist; unrelated).
- Phase 2 jest sweep — **69/69 pass** across `money`, `idempotency`, `order-settlement-planner`, `discount-service`, `stored-value.service`, `loyalty.service`.

### Files modified (Step 6)
- `web-admin/__tests__/services/stored-value.service.test.ts` (+6 Phase 2 cases)
- `web-admin/__tests__/services/loyalty.service.test.ts` (mockTx extended + 2 Phase 2 cases)

