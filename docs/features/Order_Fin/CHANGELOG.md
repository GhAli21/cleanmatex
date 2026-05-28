# Changelog Ã¢â‚¬â€ Order Financial Platform

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
