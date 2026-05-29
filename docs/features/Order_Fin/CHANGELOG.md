# Changelog Ã¢â‚¬â€ Order Financial Platform

## 2026-05-29 — BVM Wiring Phase 3 Round 2: AR invoice = receivable, zero-outstanding gate, TX4 removed

**Surfaced by:** Manual QA scenario M1 — `chk_payments_voucher_required` constraint violation + inflated AR invoice total.

### Shipped

1. **AR writer `expected_total_amount` input** — `createArInvoiceFromOrders` now accepts an optional amount that sizes the invoice header, per-order link, line summary, and AR ledger debit. Single-order callers (submit-order) use it; multi-order API-route callers keep legacy full-sale sizing by omitting it.

2. **Orchestrator: zero-outstanding gate** — `shouldCreateArInvoice = effectiveOutstandingPolicy === 'CREDIT_INVOICE' && plan.outstandingAmount > TOLERANCE`. New ADR `docs/features/AR_Invoice/ADR_no_ar_invoice_when_zero_outstanding.md` documents the rule.

3. **Orchestrator: TX4 AR-allocation block REMOVED.** Cash + credit-application legs are already accounted for by the BVM voucher. The legacy `recordPaymentTransaction` + `allocateArPaymentTx` flow only existed to bring an inflated invoice's outstanding down — now unnecessary. Also closes the `chk_payments_voucher_required` violation (the offending call site is gone). Imports cleaned up.

4. **Orchestrator: AR invoice sized to `plan.outstandingAmount`.** Passes through the new writer input.

### Tests

- `__tests__/services/ar-invoice.service.test.ts` — +2 cases (expected_total override + legacy fallback). Sweep now **120/120 pass**.

### Production AR invoice for the failing M1 order

The pre-Round-2 AR invoice `ARI-000012` (total 2.04, OVERDUE) for order `d9a306fc-e3d7-4b40-9205-a1e5f21e5dcf` is already committed. Recommended cleanup: void it through the AR invoice UI with reason "QA test artifact — Phase 3 Round 1 inflated". The next fresh submit will produce the correct sized invoice.

### Verification

- `npx tsc --noEmit` filtered = 0 errors.
- 120/120 jest pass.
- `npm run build` succeeds.

### Files modified (Round 2)

- `web-admin/lib/validations/ar-invoice-schemas.ts`
- `web-admin/lib/services/ar-invoice.service.ts`
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
- `web-admin/__tests__/services/ar-invoice.service.test.ts`
- `docs/features/AR_Invoice/ADR_no_ar_invoice_when_zero_outstanding.md` (new)
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`
- `docs/features/Order_Fin/CHANGELOG.md`

---

## 2026-05-29 — BVM Wiring Phase 3: AR Invoice canonical writer + Gift-card-as-voucher-line

### Shipped in this session

**No migration** — `org_invoice_mst` already had every column the new writer needs (`gift_card_id`, `gift_card_applied_amount`, `issued_at`, `issued_by`, …). Discovery via Supabase MCP confirmed before any code change. Two D9 `GIFT_CARD` payment-method-config rows already exist (one per tenant) so the synthesis path is safe out of the box.

**Change 1 — AR Invoice canonical writer migration (`createInvoice` → `createArInvoiceFromOrders`)**
- `ar-invoice.service.ts` `createArInvoiceFromOrders` now accepts an optional `tx?: PrismaTx` so submit-order threads its own transaction through. The producer runs inside the caller's tx with no outer `prisma.$transaction` wrapper — guarantees the AR invoice commits atomically with the order header and the voucher.
- New input flags: `issueImmediately?: boolean` (default false; API route DRAFT semantics preserved) and `gift_card_applied_amount?: number`. When `issueImmediately === true`: status derived from OPEN via `deriveArInvoiceStatus`, `issued_at`/`issued_by` populated inline, AR ledger `INVOICE_ISSUED` DEBIT appended, `AR_INVOICE_ISSUED` outbox event emitted, status-history `actionCd = 'CREATE_FROM_ORDERS_ISSUED'`.
- Mirrors the legacy `createInvoice` ERP-lite parity: `ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction` now fires inside the writer, gated by `assertBlockingInvoiceAutoPostSucceeded` (locally copied from `invoice-service.ts` — Phase 6 cleanup will extract a shared util).
- Schema (`ar-invoice-schemas.ts`): `createArInvoiceFromOrdersSchema` now admits the two new optional fields.
- Orchestrator (`order-submit-orchestrator.service.ts:565-588`): replaces `createInvoice(...)` with `createArInvoiceFromOrders({ order_ids:[orderId], ..., issueImmediately:true, idempotency_key:'${orderId}_ar' }, { tenantId, userId }, tx)`. Idempotency key matches the Phase 2 sub-key convention (`${orderId}_vch`, `${orderId}_vch_post`).
- `createInvoice` is left in `invoice-service.ts` for the deprecated `createInvoiceAction` server action and its existing jest tests. Removal is Phase 6.

**Change 2 — Gift-card-by-id as ORDER_CREDIT_APPLICATION voucher line (Phase 2.1 deferred item closed)**
- Gift-card no longer debited in TX1. The orchestrator now synthesises a `ResolvedSettlementLeg` with `paymentNature = CREDIT_APPLICATION, creditApplicationType = GIFT_CARD, creditReferenceId = input.giftCardId, amount = serverTotals.giftCardApplied` and pushes it onto `settlementLegs` (NOT `paymentLegs`) BEFORE `buildSettlementPlan`.
- Planner classification unchanged: the existing CREDIT_APPLICATION branch handles GIFT_CARD via STORED_VALUE_LOCK_ORDER (gift-card rank 0).
- The existing TX2 voucher loop produces a `LINE_ROLE.ORDER_CREDIT_APPLICATION` voucher line + calls `applyStoredValueDebitTx({ creditType: GIFT_CARD, creditReferenceId: input.giftCardId, voucherId, voucherLineId, idempotencyKey: '${orderId}_sv_gc_${legIndex}' })`. Dispatcher (`order-credit-application.service.ts:177-191`) routes to `redeemGiftCardTx` with `fin_voucher_id` + `fin_voucher_trx_line_id` populated atomically — closes the Phase 2.1 deferred gap.
- Throws `GIFT_CARD_PAYMENT_METHOD_NOT_CONFIGURED` if the tenant's D9 GIFT_CARD row is missing (operator setup error, no silent fallback).

**Breakdown snapshot math fix** (`order-submit-orchestrator.service.ts:882-902`)
- `creditsTotal: serverTotals.giftCardApplied` → `plan.creditAppliedAmount` (now sums every credit-application: gift-card + wallet + advance + credit-note + loyalty).
- `outstanding: ... - amountToCharge` → `... - plan.realPaymentAmount` to remove the double-subtraction risk when wallet/advance legs arrive via `paymentLegs` (because `amountToCharge` filters only by `DEFERRED_METHODS`, not `paymentNature`).
- `netReceivable = finalTotal - plan.creditAppliedAmount` (was `finalTotal - giftCardApplied`).

### Tests added

- `__tests__/services/ar-invoice.service.test.ts` — +5 Phase 3 cases (issueImmediately on/off, gift_card mirror, ERP-lite BLOCKING gate, caller-tx atomic invariant).
- `__tests__/services/order-settlement-planner.service.test.ts` — +2 Phase 3 cases (synthesized gift-card leg classification, mixed cash+wallet+gift-card `creditAppliedAmount` sum).

### Verification

- `npx tsc --noEmit` filtered = 0 errors (the 3 pre-existing `payment-config` UI errors noted in the Phase 3 RESUME were closed by the intervening 28_05_2026_4/_5 commits; baseline is now genuinely clean).
- Phase 2 baseline jest sweep (6 suites, 69 tests) **+ Phase 3 (8 new cases)** = **77/77 pass**.
- `__tests__/services/gift-card-service.test.ts` — 40/40 pass (service untouched).
- `npm run build` — succeeds.

### Files modified

- `web-admin/lib/services/ar-invoice.service.ts`
- `web-admin/lib/validations/ar-invoice-schemas.ts`
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
- `web-admin/__tests__/services/ar-invoice.service.test.ts`
- `web-admin/__tests__/services/order-settlement-planner.service.test.ts`

### Follow-ups (carried to Phase 6)

- Retire `createInvoice` from `invoice-service.ts` once `createInvoiceAction` migrates to the canonical writer.
- Extract `assertBlockingInvoiceAutoPostSucceeded` into `lib/services/erp-lite-auto-post.util.ts` (currently duplicated between `invoice-service.ts` and `ar-invoice.service.ts`).

---

## 2026-05-28 (later in day) — BVM Wiring Phase 2: Stored-Value Consolidation

### Closed in this session

**Migration:** `supabase/migrations/0329_phase2_stored_value_voucher_fks.sql`
- Added `fin_voucher_id` + `fin_voucher_trx_line_id` to `org_loyalty_txn_dtl`.
- Added 10 composite FK constraints `(tenant_org_id, <link_id>) → org_fin_vouchers_mst | org_fin_voucher_trx_lines_dtl ON DELETE SET NULL` across all 5 stored-value txn tables.
- Added 10 partial indexes (`WHERE col IS NOT NULL`).

**New invariant — stored-value atomicity:**
- Submit-order's voucher creation, line inserts, every `redeem*Tx` debit, and `postAndWireBizVoucher` now run in **one `prisma.$transaction`**. A failure anywhere inside rolls back the voucher header, every line, every prior balance debit.
- Previously: a mid-flow failure could leave the voucher header committed with no payment fact rows.

**Service contracts standardised:**
- All 5 `redeem*Tx` services accept `idempotencyKey?`, `voucherId?`, `voucherLineId?` with uniform skip-on-existing semantics. `redeemAdvanceTx` and `redeemCreditNoteTx` previously had no idempotency support — Phase 2 closes that drift.
- `createBizVoucher`, `addVoucherLine`, `postAndWireBizVoucher` accept an optional `tx?: PrismaTransactionClient` to join the caller's transaction.
- `applyStoredValueDebitTx` (now exported) forwards `voucherId`/`voucherLineId` to every dispatch path and writes them on `org_order_credit_apps_dtl`.

**Lock-order discipline:**
- New `STORED_VALUE_LOCK_ORDER` constant (`GIFT_CARD → WALLET → CUSTOMER_ADVANCE → CUSTOMER_CREDIT → LOYALTY_CREDIT`).
- Planner sorts `creditApplicationLegs` by `STORED_VALUE_LOCK_RANK` → concurrent submits take row locks in the same sequence — deadlock-free.

**Critical bug prevented (Step 4):**
- `order-settlement.service.ts`: the `CREDIT_APPLICATION` branch now short-circuits with `if (wiringMode) continue;` BEFORE any `redeem*Tx` call. Without this guard, the orchestrator-tx consolidation would have caused `settleOrder` to debit every stored-value balance a second time.

**Legacy retirement:** `app/api/v1/orders/_legacy_create-with-payment/` deleted (Next.js private folder, never served). ESLint rule kept as a future-proof guard.

**Deferred to Phase 2.1:** `input.giftCardId` as a voucher line — needs a voucher-total semantic decision.

**Tests:** +8 contract tests; Phase 2 sweep 69/69 pass.

---

## 2026-05-28

### BVM Wiring Phase 1B — Pre-Phase-2 Stabilization Session

Session plan: `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose.md` (13 stages, all complete)
Status doc: `IMPLEMENTATION_STATUS.md`

**Audit findings resolved:**
- **B1** (build-blocking): `taxLines.push` missing `isCompound` field — threaded from `org_tax_profiles_cf.is_compound` via `calculateTax()`. Build GREEN for the first time in Phase 1B.
- **B2** (live 403 for non-admin): permission code `invoices:view` renamed to `invoices:read` (the actually-seeded code) across 5 sites.
- **B3** (AR ledger pollution): `createInvoice()` gated on `effectiveOutstandingPolicy === 'CREDIT_INVOICE'`. Cash sales no longer produce AR invoice rows or AR ledger debits. See new ADR: `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md`.
- **X1** (drift risk): raw outbox insert in `voucher-wiring.service.ts` replaced with typed `emitEventTx()`; `OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED` added to constants.
- **X5** (live silent drift): manual voucher post via Finance UI now refreshes linked order snapshot via new `recalcOrderSnapshotIfLinked()` helper.
- **Y3** (live data loss): `collectPaymentTx` now persists `check_no`/`check_bank_name`/`check_due_date`.
- **Y4** (log noise): `Jh65`/`Jh66` debug logs deleted from permission service.
- **S1** (Prisma drift): D9 columns added to `sys_payment_method_cd` (6) and `org_payment_methods_cf` (4) Prisma models; Step 0h debt closed.
- **S2** (silent retry inconsistency): SHA-256 payload-hash conflict detection added via new `lib/utils/idempotency.ts`. Submit-order route returns 409 IDEMPOTENCY_CONFLICT on payload mismatch.
- **S3** (fallback drift): planner + settlement both `throw 'CREDIT_APPLICATION_TYPE_REQUIRED'` instead of silent fallback.
- **S4**: `orders-access.ts:58` updated from `/create-with-payment` to `/submit-order`.
- **S6** (float drift): new `lib/utils/money.ts` (Decimal-backed) applied at known drift sites in orchestrator, settlement, and AR invoice services.
- **F21**: `redeemPointsTx` idempotency key is now deterministic (`loyalty-redeem-${orderId}` — was `${orderId}-points-redeem-${Date.now()}`).

**Also fixed (pre-existing, surfaced during stabilization):**
- `payment-modal-v4.tsx` use-before-declaration (`payNowAmount`/`remainingBalance` hoisted).
- `discount-service.test.ts` stale mock table names updated to current schema.

**New files:**
- `lib/utils/money.ts` (Decimal helpers)
- `lib/utils/idempotency.ts` (canonicalize + SHA-256 hash + store/find)
- `__tests__/utils/money.test.ts` (13 tests, all pass)
- `__tests__/utils/idempotency.test.ts` (11 tests, all pass)
- `__tests__/services/order-settlement-planner.service.test.ts` (10 tests, all pass)
- `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md`
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` (new canonical name, supersedes `current_status.md`)
- `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md`

**Verification:**
- `npx tsc --noEmit` — 0 errors
- 34 new tests + existing discount-service tests all green
- No new migrations (all changes are code + Prisma schema sync)

---

## 2026-05-23

### BVM Wiring Phase 1B — Submit Order Canonical Path

**Migrations applied:** `0324_bvm_wiring_phase1b_line_type.sql`, `0325_payment_method_config_enrichment.sql`

**New files:**
- `lib/types/settlement-plan.ts` — `RealPaymentLeg`, `CreditApplicationLeg`, `SettlementPlan` interfaces
- `lib/services/order-settlement-planner.service.ts` — pure `buildSettlementPlan()` + async `validateSettlementPlan()`
- `lib/services/order-submit-orchestrator.service.ts` — `submitOrder()` orchestrator + `resolveOrderBranch()`
- `app/api/v1/orders/submit-order/route.ts` — canonical order submission endpoint
- `docs/features/Order_Fin/ADR_submit_order_canonical_path.md` — ADR for canonical path decision
- `docs/features/Order_Fin/bvm_wiring_phase1b_implementation.md` — full feature implementation doc

**Modified files:**
- `lib/types/order-financial.ts` — D9 config fields added to `SettlementOption`
- `lib/validations/new-order-payment-schemas.ts` — `submitOrderRequestSchema` + `SubmitOrderRequest` type
- `lib/constants/order-financial.ts` — `CREDIT_APPLICATION_TYPES` fixed to exact DB constraint values
- `lib/constants/voucher.ts` — `LINE_TYPE.CREDIT_APPLICATION` added
- `lib/services/checkout-config.service.ts` — COALESCE JOIN for D9 fields from `sys_payment_method_cd`
- `lib/services/order-credit-application.service.ts` — constant key fixes (CUSTOMER_ADVANCE, CUSTOMER_CREDIT, LOYALTY_CREDIT)
- `lib/services/order-settlement.service.ts` — same constant key fixes
- `app/api/v1/orders/_legacy_create-with-payment/route.ts` — folder renamed, `@deprecated FROZEN` added
- `eslint.config.mjs` — `no-restricted-imports` barricade for legacy path
- `src/features/orders/hooks/use-order-submission.ts` — switched to `submit-order`, updated response parsing, warning toasts + voucher badge
- `messages/en.json` + `ar.json` — 4 new i18n keys (payment warnings + voucherCreated)
- `prisma/schema.prisma` — updated for D9 columns on both payment method tables

**Architecture change:** `POST /api/v1/orders/submit-order` is now the single canonical path. The orchestrator follows the sequence: settlement plan → validate → create voucher + lines → post + wire → `settleOrder(wiringMode: true)`. `settleOrder` skips the `org_order_payments_dtl` / `org_order_credit_apps_dtl` direct writes when wiring has already created them.

## 2026-05-22

### BVM Wiring Phase 1A — Order Payment + Credit Application + Cash Drawer Wiring
- Implemented wiring layer: `postAndWireBizVoucher()`, handler services, `getVoucherLinkedEffects()`
- Added `fin_vouchers:wire` and `fin_vouchers:view_effects` permissions
- Added wiring status UI to vouchers page
- Migrations: `0318_bvm_wiring_phase1a_schema.sql`, `0319_bvm_wiring_phase1a_permissions.sql`

## 2026-05-18

### Documentation
- Created full P19 documentation suite (README, developer_guide, current_status, progress_summary, technical_docs, Order_Fin_Docs)

### Tests
- 126 tests across 16 suites Ã¢â‚¬â€ all passing
- Integration tests: refund-flow, gift-card-redemption, checkout-multi-payment, reconciliation-run
- Unit tests: tax-engine, loyalty, outbox, stored-value, cash-drawer, refund, reconciliation, promotion-engine, order-calculation, settlement
- E2E stubs: cash-drawer, stored-value, promotions, tax-setup, reconciliation
- Validation tests: financial-schemas, financial-tenant-isolation

## 2026-05-15

### UI Pages (P10Ã¢â‚¬â€œP14)
- `app/dashboard/internal_fin/cash-drawers/` Ã¢â‚¬â€ cash drawer list + detail + session print
- `app/dashboard/internal_fin/refunds/` Ã¢â‚¬â€ refunds list
- `app/dashboard/internal_fin/reconciliation/` Ã¢â‚¬â€ reconciliation list + detail
- `app/dashboard/marketing/promotions/` Ã¢â‚¬â€ promotions list
- `app/dashboard/settings/tax/` Ã¢â‚¬â€ tax profiles + exemptions

### Print & Export (P15)
- `app/dashboard/internal_fin/payments/[id]/print/receipt-voucher/` Ã¢â‚¬â€ receipt voucher print
- `app/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]/print/` Ã¢â‚¬â€ session summary print

### Background Jobs (P16)
- `supabase/migrations/0296_pg_cron_jobs.sql` Ã¢â‚¬â€ pg_cron schedule for outbox worker
- `supabase/functions/outbox-worker/index.ts` Ã¢â‚¬â€ Edge Function

### i18n (P17)
- Added ~200 translation keys to `messages/en.json` and `messages/ar.json`

## 2026-05-14

### API Routes (P9)
- Cash drawers: open/close session, cash movement, session summary
- Customers: wallet top-up, wallet ledger, advance issue, advance ledger, credit note issue, credit notes list, loyalty, stored-value hub
- Orders: refund initiation, refund list, refund approval, payment collection
- Finance: reconciliation runs, reconciliation issues, financial reports (orders summary, payments breakdown, tax report)
- Gift cards: balance lookup, ledger
- Loyalty: config, tiers
- Marketing: promotions CRUD, promo validation
- Settings: payment methods, terminals, tax profiles, tax exemptions

### Services (P8)
- `lib/services/order-settlement.service.ts` Ã¢â‚¬â€ multi-leg atomic settlement
- `lib/services/order-refund.service.ts` Ã¢â‚¬â€ 3-step refund lifecycle
- `lib/services/stored-value.service.ts` Ã¢â‚¬â€ wallet, advance, credit note ops
- `lib/services/loyalty.service.ts` Ã¢â‚¬â€ earn/redeem points
- `lib/services/promotion-engine.service.ts` Ã¢â‚¬â€ discount calculation + usage tracking
- `lib/services/tax-engine.service.ts` Ã¢â‚¬â€ profile-based tax with exemptions
- `lib/services/reconciliation.service.ts` Ã¢â‚¬â€ 7-check financial reconciliation
- `lib/services/cash-drawer.service.ts` Ã¢â‚¬â€ session lifecycle + movement recording
- `lib/services/outbox.service.ts` Ã¢â‚¬â€ domain event append + batch claim
- `lib/services/order-calculation.service.ts` Ã¢â‚¬â€ server-side totals calculation

## 2026-05-07 Ã¢â‚¬â€œ 2026-05-14

### Migrations (P0Ã¢â‚¬â€œP7)
- `0278` Ã¢â‚¬â€ rename org_order_discounts_dtl
- `0279` Ã¢â‚¬â€ sys financial lookup tables (payment nature, credit application types, etc.)
- `0280` Ã¢â‚¬â€ org_order_charges_dtl
- `0281` Ã¢â‚¬â€ org_order_taxes_dtl
- `0282` Ã¢â‚¬â€ org_orders_mst financial snapshot columns
- `0283` Ã¢â‚¬â€ harden credit_apps + refunds
- `0284` Ã¢â‚¬â€ org_customer_wallets_mst + org_wallet_txn_dtl
- `0285` Ã¢â‚¬â€ org_customer_advances_mst + org_advance_txn_dtl
- `0286` Ã¢â‚¬â€ org_credit_notes_mst + org_credit_note_txn_dtl
- `0287` Ã¢â‚¬â€ org_loyalty_accounts_mst + org_loyalty_txn_dtl
- `0288` Ã¢â‚¬â€ extend promotions tables (stacking, usage limits)
- `0289` Ã¢â‚¬â€ org_tax_profiles_cf + org_tax_exemptions_cf
- `0290` Ã¢â‚¬â€ currency rounding config
- `0291` Ã¢â‚¬â€ payment config seed (payment methods, cash payment nature)
- `0292` Ã¢â‚¬â€ org_domain_events_outbox (idempotency + retry)
- `0293` Ã¢â‚¬â€ org_reconciliation_runs_mst + org_reconciliation_issues_dtl
- `0294` Ã¢â‚¬â€ financial permissions seed
- `0295` Ã¢â‚¬â€ financial navigation (sys_components_cd)
- `0296` Ã¢â‚¬â€ pg_cron jobs

### Constants & Types
- `lib/constants/order-financial.ts` Ã¢â‚¬â€ all financial enums + status codes
- `lib/types/order-financial.ts` Ã¢â‚¬â€ FinancialBreakdownSnapshot, SettlementOption, ResolvedSettlementLeg, etc.
