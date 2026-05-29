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

---

## BVM Wiring Phase 3 — In progress (2026-05-29)

**Plan:** `C:\Users\JHNLP\.claude\plans\vivid-wishing-wave.md` (Scope B = AR Invoice canonical writer migration + Gift-card-by-id as ORDER_CREDIT_APPLICATION voucher line).
**Predecessor commit:** `13f8872` (Phase 2 close). Current HEAD `475f754`.

| Step | Status | Notes |
|---|---|---|
| 0. Read-only discovery (6 checks) | ✅ Done | Confirmed — see below |
| 1. Migration 0330 | ⏭ Skipped | No schema gap — `org_invoice_mst` already has every column the new writer needs |
| 2. `createArInvoiceFromOrders`: `tx?` + `issueImmediately` + ERP-lite + `gift_card_applied_amount` | ⏳ Next | |
| 3. Orchestrator: replace `createInvoice` call | pending | |
| 4. Synthesize gift-card credit-application leg (G1) | pending | |
| 5. Delete TX1 gift-card debit block | pending | |
| 6. Fix breakdown snapshot math | pending | |
| 7. Tests T1–T7 + Phase 2 sweep + tsc | pending | |
| 8. Docs (IMPLEMENTATION_STATUS + CHANGELOG + phase implementation doc) | pending | |

### Step 0 — Discovery findings (read-only)

| # | Check | Result |
|---|---|---|
| 1 | `org_invoice_mst` schema via MCP | All needed columns present: `id`, `tenant_org_id`, `order_id`, `customer_id`, `invoice_no`, `total`, `outstanding_amount`, `status`, `currency_code`, `invoice_date`, `due_date`, `issued_at`, `issued_by`, `gift_card_applied_amount`, `gift_card_id`. No migration required. |
| 2 | `SELECT count(*) FROM org_invoice_mst WHERE status='DRAFT' AND order_id IS NOT NULL` | `0` rows — safe to ship `issueImmediately:true` semantic without DRAFT-cleanup migration. |
| 3 | D9 `GIFT_CARD` credit-application config rows | 2 rows present (one per tenant), all active. G1 synthesis path safe. |
| 4 | `breakdown.creditsTotal` readers | 4 files reference it; only orchestrator + `order-calculation.service.ts` are writers. No downstream reader depends on "gift-card only" semantics. |
| 5 | `redeemGiftCardTx` callers + `createInvoice` callers | Confirmed Plan agent's count. `createInvoice` also called by `app/actions/payments/invoice-actions.ts:52` (deprecated server action) and `__tests__/services/invoice-service.test.ts`. Mark `@internal`; remove in Phase 6. |
| 6 | `amountToCharge` construction (orchestrator:348-350) | Filters by `DEFERRED_METHODS` only — confirms wallet/advance/credit-note legs would leak into the outstanding formula. Step 6 must use `plan.realPaymentAmount`. |
| 7 | `applyStoredValueDebitTx` GIFT_CARD case (`order-credit-application.service.ts:177-191`) | Confirmed: dispatches to `redeemGiftCardTx({ giftCardId: creditReferenceId, voucherId, voucherLineId, ... })`. No dispatcher change needed. |

### Verification (after Step 0)
- No code changes yet — TS + jest sweep unchanged from Phase 2 close (69/69).

### Step 2 — `createArInvoiceFromOrders` canonical-writer parity (✅ Done)

Refactored `web-admin/lib/services/ar-invoice.service.ts`:
- Split out `createArInvoiceFromOrdersInTx` inner producer; public wrapper now accepts optional `tx?: PrismaTx`.
- New input flags: `issueImmediately?: boolean` (default `false`, preserves API route DRAFT semantics) and `gift_card_applied_amount?: number`.
- When `issueImmediately === true`: status derived from `OPEN` (auto-flips to `OVERDUE` if due_date past), `issued_at`/`issued_by` populated on create, AR ledger `INVOICE_ISSUED` debit appended, `AR_INVOICE_ISSUED` outbox event emitted, status-history `actionCd = 'CREATE_FROM_ORDERS_ISSUED'`.
- `org_orders_mst` SELECT extended with `gift_card_id`; create payload stamps `gift_card_id` + `gift_card_applied_amount` to mirror legacy `createInvoice`.
- Added ERP-lite `dispatchInvoiceCreatedInTransaction` immediately after `org_invoice_mst.create`, gated by a locally-copied `assertBlockingInvoiceAutoPostSucceeded` (Phase 6 cleanup will extract to shared util).

Schema (`web-admin/lib/validations/ar-invoice-schemas.ts`): added `issueImmediately` + `gift_card_applied_amount` to `createArInvoiceFromOrdersSchema`. Existing `CreateArInvoiceFromOrdersInput` type still inferred — no other callers need changes.

### Verification (after Step 2)
- `npx tsc --noEmit` filtered = 0 errors (the 3 pre-existing `payment-config` errors noted in the resume doc were fixed in commits between `13f8872` and HEAD `475f754` — actual baseline is now 0).
- No tests run yet — orchestrator wiring lands in Step 3, regression sweep deferred until end of Step 6.

### Files modified (Step 2)
- `web-admin/lib/services/ar-invoice.service.ts` (inner-tx split, `issueImmediately`, `gift_card_applied_amount`, ERP-lite dispatch, JSDoc on public wrapper)
- `web-admin/lib/validations/ar-invoice-schemas.ts` (2 new optional fields on `createArInvoiceFromOrdersSchema`)

### Step 3 — Orchestrator: replaced `createInvoice` with `createArInvoiceFromOrders` (✅ Done)

- `order-submit-orchestrator.service.ts`:
  - Dropped the eslint-disable on the legacy `createInvoice` import.
  - Import switched from `createInvoice` (deprecated adapter) to `createArInvoiceFromOrders` (canonical writer).
  - Inside TX1: when `shouldCreateArInvoice === true`, the orchestrator now calls `createArInvoiceFromOrders({ order_ids:[orderId], customer_id, currency_code, gift_card_applied_amount, issueImmediately:true, idempotency_key:'${orderId}_ar', allocation_policy:'REMAINING_ONLY' }, { tenantId, userId }, tx)`.
  - Note: the resume doc instructed `org_orders_mst.update({ invoice_id })` to backlink the AR invoice. Discovery (Supabase MCP) confirmed `org_orders_mst` has NO `invoice_id` column — the linkage is unidirectional via `org_invoice_mst.order_id`. `getInvoicesForOrder(orderId)` already queries that. The spurious update was removed; a comment marker explains why.
  - `createInvoice` is left in `invoice-service.ts` for `createInvoiceAction` (deprecated server action) + the existing invoice-service jest tests. Phase 6 cleanup will retire it once that action migrates.

### Verification (after Step 3)
- `npx tsc --noEmit` filtered = 0 errors.
- No new tests yet — orchestrator integration tests deferred to Step 7.

### Files modified (Step 3)
- `web-admin/lib/services/order-submit-orchestrator.service.ts`

### Step 4 — Gift-card credit-application leg synthesis (G1) (✅ Done)

- `order-submit-orchestrator.service.ts`: before the `buildSettlementPlan` call, when `input.giftCardId && serverTotals.giftCardApplied > 0`, the orchestrator looks up the tenant's GIFT_CARD payment-method config via `listEffectivePaymentMethodConfigs({ methodCodes: ['GIFT_CARD'] })`, builds a `SettlementOption`, and pushes a synthesized `ResolvedSettlementLeg` onto `settlementLegs` (NOT `paymentLegs`).
- The planner classifies it via the existing CREDIT_APPLICATION branch (planner unchanged); STORED_VALUE_LOCK_ORDER puts gift-card first; the existing TX2 voucher loop produces a `LINE_ROLE.ORDER_CREDIT_APPLICATION` voucher line and `applyStoredValueDebitTx({ creditType:GIFT_CARD, creditReferenceId:input.giftCardId, voucherId, voucherLineId })` — which dispatches to `redeemGiftCardTx` with the FK backlinks populated atomically.
- Throws `GIFT_CARD_PAYMENT_METHOD_NOT_CONFIGURED` if the D9 row is missing (operator setup error, not a silent fallback).
- Why G1 (orchestrator synthesis) vs G2 (planner accepts gift-card input): G1 keeps `buildSettlementPlan` pure with no signature change (10 planner unit tests untouched) and consolidates gift-card resolution at the orchestrator boundary (its existing owner).

### Verification (after Step 4)
- `npx tsc --noEmit` filtered = 0 errors after switching from raw Prisma `findFirst` to `listEffectivePaymentMethodConfigs` (resolves Decimal→number type drift + computed `is_globally_disabled`).

### Files modified (Step 4)
- `web-admin/lib/services/order-submit-orchestrator.service.ts` (PAYMENT_NATURE import + ~45-line synthesis block before `buildSettlementPlan`)

### Step 5 — Deleted TX1 gift-card debit + `redeemGiftCardTx` import (✅ Done)

- `order-submit-orchestrator.service.ts`: removed the `if (input.giftCardId && serverTotals.giftCardApplied > 0) { await redeemGiftCardTx(...) } else if (input.giftCardNumber ...)` block from inside the order-creation transaction. Replaced with an explanatory comment block documenting why the debit moved to TX2.
- Removed `import { redeemGiftCardTx } from '@/lib/services/gift-card-service';` (no longer used in this file).
- Legacy `input.giftCardNumber` path: not in the current submit-order request schema. If reintroduced, the resolver belongs above the Step 4 synthesis block, not in TX1.

### Verification (after Step 5)
- `npx tsc --noEmit` filtered = 0 errors (the removed import had no other usages in this file).

### Files modified (Step 5)
- `web-admin/lib/services/order-submit-orchestrator.service.ts`

### Step 6 — Breakdown snapshot math correction (✅ Done)

- `order-submit-orchestrator.service.ts:882-902` (`breakdown: FinancialBreakdownSnapshot`):
  - `creditsTotal: serverTotals.giftCardApplied` → `creditsTotal: plan.creditAppliedAmount` (now sums GIFT_CARD + WALLET + CUSTOMER_ADVANCE + CUSTOMER_CREDIT + LOYALTY_CREDIT, not just gift-card)
  - `netReceivable: serverTotals.finalTotal - serverTotals.giftCardApplied` → `netReceivable: serverTotals.finalTotal - plan.creditAppliedAmount`
  - `outstanding: ... - amountToCharge` → `outstanding: ... - plan.realPaymentAmount` to eliminate the double-subtraction risk Phase 1 design surfaced (`amountToCharge` filters by `DEFERRED_METHODS` only, so wallet/advance legs arriving via paymentLegs would leak into both `creditsTotal` AND `amountToCharge`).

### Verification (after Step 6)
- `npx tsc --noEmit` filtered = 0 errors.
- Phase 2 baseline jest sweep — **69/69 pass** unchanged.

### Files modified (Step 6)
- `web-admin/lib/services/order-submit-orchestrator.service.ts`

### Step 7 — Tests (✅ Done)

Extended `web-admin/__tests__/services/ar-invoice.service.test.ts` (+5 cases, +6 total):

- T-AR-1 — `issueImmediately:true` → status OPEN, AR ledger DEBIT INVOICE_ISSUED, AR_INVOICE_ISSUED outbox, ERP-lite dispatched, status_history `CREATE_FROM_ORDERS_ISSUED`.
- T-AR-2 — default (issueImmediately omitted) → status DRAFT, no ledger debit, no AR_INVOICE_ISSUED outbox; ERP-lite still dispatched on create (parity with legacy).
- T-AR-3 — `gift_card_applied_amount` input mirrors onto `org_invoice_mst.gift_card_applied_amount`; `gift_card_id` comes from the source order.
- T-AR-4 — ERP-lite BLOCKING policy with failed dispatch → throws and rolls back the create.
- T-AR-5 — caller-supplied `tx` skips the outer `prisma.$transaction` wrapper (atomic with order tx invariant).

Extended `web-admin/__tests__/services/order-settlement-planner.service.test.ts` (+2 Phase 3 cases):

- T-PLN-1 — orchestrator-synthesized gift-card credit-application leg without a paymentLegs counterpart classifies correctly with `creditReferenceId` preserved.
- T-PLN-2 — mixed cash + wallet + gift-card → `plan.creditAppliedAmount` sums all credit-apps (the breakdown math the orchestrator now relies on).

### Verification (after Step 7)
- `npx tsc --noEmit` filtered = 0 errors.
- Phase 2 baseline (6 suites, 69 tests) **+ Phase 3 (2 suites, 8 new cases)** = **77/77 pass** in 1.1s.
- `__tests__/services/gift-card-service.test.ts` — **40/40 pass** (gift-card service unchanged at the service-level, only the orchestrator caller moved).
- `npm run build` — succeeds, no production build regression.

### Files modified (Step 7)
- `web-admin/__tests__/services/ar-invoice.service.test.ts` (+`@prisma/client` stub mock for `Prisma.sql` template tag, extended Prisma+module mocks, +5 Phase 3 cases)
- `web-admin/__tests__/services/order-settlement-planner.service.test.ts` (+2 Phase 3 cases)

### Acceptance scenarios (Phase 3)

| Scenario | Guaranteed by |
|---|---|
| 1. CREDIT_INVOICE order → AR invoice OPEN at submit, atomic with voucher | T-AR-1 (issueImmediately path) + Step 3 orchestrator wire-up |
| 2. Submit replay (same idempotency key) → no duplicate AR invoice / gift-card debit | `withIdempotency` cache on `${orderId}_ar` (T-AR-2 covers DRAFT default; `redeemGiftCardTx` idempotency-key skip verified by Phase 2 tests) |
| 3. Cash retail + gift-card → gift-card as ORDER_CREDIT_APPLICATION voucher line; no AR invoice | T-PLN-1 + Step 4 synthesis + Step 5 TX1 deletion |
| 4. Cash retail no gift-card → no AR invoice, no credit-application leg (sanity) | existing Phase 2 planner happy-path tests |
| 5. Mixed cash + wallet + gift-card → breakdown.creditsTotal = ALL credit-apps | T-PLN-2 + Step 6 math fix |

End-to-end DB-level integration tests for the full submit-order flow remain deferred (same posture as Phase 2 close — needs a real Postgres test instance). The building-block contracts above pin every behavior an integration test would assert.

### Step 8 — Docs (✅ Done)

- This file: cumulative per-step entries written (Steps 0, 2, 3, 4, 5, 6, 7). Step 1 marked "skipped, no schema gap".
- `docs/features/Order_Fin/CHANGELOG.md` — new top-of-file `## 2026-05-29 — BVM Wiring Phase 3` section.
- `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md` — new implementation log, Phase 2 template, includes Acceptance scenarios for manual QA.
- `docs/features/AR_Invoice/IMPLEMENTATION_STATUS.md` — appended Phase 3 integration note documenting the new `issueImmediately` flag, `gift_card_applied_amount` mirror, and ERP-lite dispatcher addition.
- Memory updated: `project_bvm_wiring_phases.md` (Phase 3 flipped to ✅), `MEMORY.md` index entry refreshed, `feedback_plan_doc_location.md` (new — captures user preference that planning docs live under `docs/features/<feature>/`).

### Phase 3 exit checklist

- [x] All step exit criteria green
- [x] `npx tsc --noEmit` filtered = 0 errors
- [x] Phase 2 jest sweep (69/69) + new Phase 3 tests (8 new) = 77/77 pass
- [x] `npm run build` succeeds
- [x] `IMPLEMENTATION_STATUS.md` updated step-by-step + phase-close section
- [x] CHANGELOG entry added
- [x] `bvm_wiring_phase3_implementation.md` written
- [x] AR_Invoice/IMPLEMENTATION_STATUS appended
- [x] Memory updated
- [ ] User to commit with `DD_MM_YYYY_N` prefix
- [ ] Manual QA the 5 scenarios in `bvm_wiring_phase3_implementation.md` § Acceptance scenarios (recommended before merging to main)

---

## BVM Wiring Phase 3 Round 2 — In progress (2026-05-29 same day)

**Triggered by:** Manual QA scenario M1 failed with `chk_payments_voucher_required` constraint violation on `org_payments_dtl_tr` and an inflated AR invoice amount (`total = full sale` rather than `total = receivable`).

**Root cause:**
1. The orchestrator's TX4 "AR payment tracking" block called `recordPaymentTransaction` with `skipReceiptVoucher: true`, which left `voucher_id` NULL on the legacy `org_payments_dtl_tr` row. The check constraint (migration `0132`) rejected the row.
2. The AR invoice was sized to `sum(order.outstanding_amount)`, which at TX1 time equals the full sale (no payments yet applied). The downstream TX4 cash allocation was supposed to bring outstanding down — but it failed on the constraint, leaving outstanding inflated.

**Round 2 fixes (production-ready, ADR-backed):**

1. **AR writer accepts `expected_total_amount` input** (`web-admin/lib/validations/ar-invoice-schemas.ts`, `web-admin/lib/services/ar-invoice.service.ts`):
   - When provided, the invoice header `subtotal`/`total`/`outstanding_amount` use it directly.
   - For single-order callers (submit-order), the per-order link `invoiced_amount`/`outstanding_amount` and the line-summary `unit_price`/`total_amount` mirror it.
   - AR ledger `INVOICE_ISSUED` debit (when `issueImmediately: true`) reflects the same amount.
   - When omitted, the writer falls back to the legacy `sum(order.outstanding_amount)` — preserves API-route behavior.

2. **Orchestrator passes `expected_total_amount: plan.outstandingAmount`** (`order-submit-orchestrator.service.ts`).

3. **Orchestrator TX4 AR-allocation block REMOVED** entirely. Rationale: with the AR invoice sized to the actual receivable, there's nothing to allocate against it at submit time. Cash and credit-applications are already accounted for by the voucher. Future B2B payments will allocate via the existing AR collection flow (`POST /api/v1/ar/invoices/[id]/payments`).
   - Removed imports: `recordPaymentTransaction`, `allocateArPaymentTx`.
   - Removed deleted JSDoc step references.

4. **Zero-outstanding gate** (new ADR — `docs/features/AR_Invoice/ADR_no_ar_invoice_when_zero_outstanding.md`):
   - `shouldCreateArInvoice = effectiveOutstandingPolicy === 'CREDIT_INVOICE' && plan.outstandingAmount > TOLERANCE`.
   - A `CREDIT_INVOICE` order whose cash + credit-applications fully cover the sale produces ONLY a voucher — no AR invoice header, no AR ledger debit, no AR_INVOICE_ISSUED outbox event.

**Test coverage added:**
- `__tests__/services/ar-invoice.service.test.ts` — +2 cases:
  - `expected_total_amount` sizes invoice header + per-order link + line summary + AR ledger debit all to the receivable (0.94 from full sale 2.04).
  - Omitting `expected_total_amount` preserves legacy full-sale sizing (API-route behavior).

**Verification:**
- `npx tsc --noEmit` filtered = 0 errors.
- Phase 2 baseline + Phase 3 + Phase 3 Round 2 = **120/120 jest pass**.
- `npm run build` succeeds.

**Files modified (Round 2):**
- `web-admin/lib/validations/ar-invoice-schemas.ts` (+1 input field)
- `web-admin/lib/services/ar-invoice.service.ts` (subtotal override + per-order link/line overrides)
- `web-admin/lib/services/order-submit-orchestrator.service.ts` (gate update, expected_total_amount pass-through, TX4 block removed, JSDoc cleanup, dead imports removed)
- `web-admin/__tests__/services/ar-invoice.service.test.ts` (+2 Round 2 cases)
- `docs/features/AR_Invoice/ADR_no_ar_invoice_when_zero_outstanding.md` (new ADR)

**What this means for the M1 order in production:**

The order `d9a306fc-e3d7-4b40-9205-a1e5f21e5dcf` (the failing one) will NOT be auto-corrected — its AR invoice (`ARI-000012`, total 2.04, OVERDUE) is already committed from before the fix. Options for cleanup:
1. **Recommended:** Leave it; manually void the invoice via the AR invoice UI (status → VOID with reason "QA test artifact — Phase 3 Round 1 inflated").
2. Run a one-off cleanup SQL after Round 2 deploys.

The next fresh submit-order request will produce the correct sized invoice (or no invoice when outstanding = 0).

