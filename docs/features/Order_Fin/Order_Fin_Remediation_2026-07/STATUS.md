# Order Financial Remediation Program — STATUS

**Plan:** [PLAN.md](./PLAN.md) · **Findings source:** `../Order_Fin_Validation_Report_2026-07-03/`
**Started:** 2026-07-03 · **Completed:** 2026-07-04 — ✅ **ALL 8 PHASES DONE** (migrations 0393/0394/0395 ⛔ await user apply)

## Phase tracker

| Phase | Scope | Status | Gates | Docs refreshed (PLAN §doc-tasks) | Migration |
|---|---|---|---|---|---|
| 0 | Pre-flight verification | 🟡 PROVISIONAL (guards in 0395) | — | ✅ pre-flight table | — |
| 1 | Canonical read fn + repoint + print RBAC + cancel interim guard | ✅ DONE | jest 1594 · build ✓ | ✅ | none |
| 2 | Payments report → canonical + money-position tile | ✅ DONE | jest 1601 · build ✓ | ✅ | none |
| 3 | Write-path migration + retire internal_fin/payments + nav dual-write | ✅ DONE | jest 1601 · build ✓ · inventories PASS | ✅ | 0393 ⛔ user applies |
| 4 | Cancellation disposition flow + ADR-053 | ✅ DONE | jest 1612 · build ✓ | ✅ | none |
| 5 | 🔥 full ledger demolition (code+Prisma+drop mig) | ✅ DONE | jest 1597 · build ✓ · grep-zero | ✅ | 0394+0395 ⛔ user applies |
| 6 | FN-03 comparand + multi-currency fixture + epsilon | ✅ DONE | jest 1602 · build ✓ | ✅ | none |
| 7 | FN-11 locale sweep + FN-12 registries + FN-09/10/13 | ✅ DONE | jest 1602 · build ✓ | ✅ | none |
| 8 | ADR renumber + 16_RESOLUTION_ADDENDUM + close-out | ✅ DONE | docs-only | ✅ | none |

> Doc-task detail per phase lives in [PLAN.md §Documentation update / refresh tasks](./PLAN.md#documentation-update--refresh-tasks-mandatory-per-phase). A phase may not be marked ✅ while its Docs column is ⬜. Phases 3 and 5 additionally gate on `npm run check:platform-info-inventories`.

## Decisions log

| ID | Decision | State |
|---|---|---|
| D-1 | Retire internal_fin/payments screens | DEFAULT set — awaiting confirm-or-override |
| D-2 | Cancel disposition = Refund / Store credit / Keep-on-account (approval-gated); auto-restore stored value | DEFAULT set |
| D-3 | Drop `org_payment_audit_log` + retire payment-audit.service | DEFAULT set — **conditional on Phase 0 count = 0** |
| D-4 | Drop `org_invoice_payments_dtl.payment_id` FK + column | DEFAULT set — **conditional on Phase 0 count = 0** |
| D-5 | Money-position tile on /dashboard/reports | DEFAULT set |
| D-6 | Print routes gated with `orders:read` | DEFAULT set |

## Pre-flight results (Phase 0 — 2026-07-03)

| Check | Local | Remote |
|---|---|---|
| `org_payments_dtl_tr` rows | ⚠ stack not running | ⚠ MCP unauthorized — **user attestation: 0** (+ user edited ADR-002 confirming "the table is empty now") |
| `org_payment_audit_log` rows | ⚠ not verified | ⚠ not verified — Phase-5 migration carries an ABORT-if-rows guard |
| `org_invoice_payments_dtl.payment_id` non-null | ⚠ not verified | ⚠ not verified — Phase-5 migration carries an ABORT-if-non-null guard |
| Migrations 0385–0392 applied | n/a | ⚠ unverified (MCP auth) — re-check before Phase-5 apply |
| Next free migration seq | **0393** (filesystem-verified: last = `0392_fix_credit_apps_type_constraint.sql`) | same |

**Phase 0 verdict:** 🟡 PASSED PROVISIONALLY. DB counts could not be executed (local stack down; remote MCP needs `SUPABASE_ACCESS_TOKEN` auth — authorize via `/mcp` in an interactive session). Mitigation: D-3/D-4 remain conditional and the Phase-5 drop migration MUST include row-count/non-null guards that raise and abort if the premise is false. Counts to be re-run at Phase-5 review time.

## Migration ledger (actual)

| Seq | File | Created | Reviewed | Applied local | Applied remote |
|---|---|---|---|---|---|
| 0393 | `0393_nav_retire_billing_payments.sql` | ✅ 2026-07-04 | ⛔ pending user | ❌ | ❌ |
| 0394 | `0394_nav_retire_billing_cashup.sql` | ✅ 2026-07-04 | ⛔ pending user | ❌ | ❌ |
| 0395 | `0395_drop_org_payments_dtl_tr.sql` (ABORT guards) | ✅ 2026-07-04 | ⛔ pending user | ❌ | ❌ |

## Session log

- **2026-07-03** — Program planned. PLAN.md + STATUS.md created from the 2026-07-03 validation report. No code changed yet.
- **2026-07-03 (exec 1)** — **Phase 0** 🟡 provisional (see pre-flight table; MCP unauthorized, local stack down; Phase-5 migration must carry ABORT guards). **Phase 1 code COMPLETE:**
  - `getOrderPaymentsCanonical()` + extended `OrderPaymentRow` (+`mapOrderPaymentRow`) in `lib/services/order-financial-summary.service.ts`.
  - Payments tab (`orders-payments-tab-rprt.tsx`) rewritten to canonical rows (voucher filter/link; invoice search removed; tendered/change shown).
  - Both order pages (`orders/[id]/page.tsx`, `orders/[id]/full/page.tsx`) no longer fetch `_tr`; full-view tab fed from `financialData.payments`; legacy record-deposit form + unapplied/apply-to-invoice UI + actions **deleted** from both clients (they wrote/read the deprecated ledger).
  - Print routes rewritten: `report/payments-rprt` + `report/invoices-payments-rprt` now `requirePermission('orders:read')` + centralized tenant context; payments from canonical order rows / AR allocations (`org_invoice_payments_dtl`, reversed excluded). Print components adapted.
  - `voucher-service.getVoucherData` dropped the dead `_tr` include (mapper never consumed it).
  - **FN-02 interim guard:** `CANCEL_BLOCKED_PAID_ORDER` in `workflow-service-enhanced.ts` (before old/new fork; blocks cancel when canonical paid or applied credit > 0.001); dead `_tr` cancel/return loops removed with explanatory comments.
  - i18n: +3 keys `orders.detailFull.{tenderedAmount,changeReturned,checkNumber}` EN+AR; `check:i18n` ✅.
  - Tests: `workflow-cancel-guard.test.ts` (5) + `order-payments-canonical-read.test.ts` (3) green; tenant-isolation suite green.
  - Gates: eslint (changed) 0 · `tsc --noEmit` 0 · i18n ✅ · full jest RUNNING (result to be logged) · build pending.
  - Remaining `_tr` readers by design (die in P3/P5): `getVoucherDataByPaymentId`, `listVouchers.payment_id`, ~~report-service~~ (done P2), cashup, order-cancel promo/gift, delete-order, payment-service internals.
- **2026-07-03 (exec 1, cont.)** — **Phase 1 gates ALL GREEN:** full jest **1594/1594 (159 suites)** · `npm run build` exit 0 · eslint 0 · tsc 0 · i18n ✅. Phase-1 docs done (tech_api §read-surfaces, tech_data_model §deprecated-ledger, QA guide addendum). **Phase 1 ✅ COMPLETE.**
- **2026-07-03 (exec 1, cont.)** — **Phase 2 code COMPLETE:**
  - `getPaymentsReport` (report-service.ts) rewritten on `org_order_payments_dtl`: COMPLETED-bucket KPIs, canonical status breakdown, refunds KPI from `org_order_refunds_dtl` (PROCESSED), bucket-name status filters expanded via `ORDER_PAYMENT_LIFECYCLE_STATUSES`, paginated table via raw-SQL join (orders+customers, tenant filter on every table). Client updates: canonical `STATUS_BADGE` keys (payments-report-table), bucket filter options (reports/payments/page.tsx).
  - Money-position (D-5): `finance-money-position.service.ts` + `GET /api/v1/finance/reports/money-position` (`finance_reports:view`) + `money-position-cards-rprt.tsx` rendered atop `/dashboard/reports/financial`. i18n `reports.moneyPosition.*` (8 keys EN+AR, surgical insert).
  - Tests: `payments-report-canonical.test.ts` (5, node env) + `finance-money-position.service.test.ts` (2) — green. tsc 0 · eslint 0 · i18n ✅. Docs: tech_api + RECONCILIATION_GUIDE updated.
  - Note: access-contract `apiDependencies` refresh for `/dashboard/reports/financial` (new money-position dep) folded into the Phase-3 inventories run.
  - Pending phase gates: full jest + build (will run with Phase-3 gate batch).
- **2026-07-04 (exec 2)** — **Phase 3 code COMPLETE:**
  - **Write-path off `_tr`:** ready page per-invoice RecordPayment form → replaced with CTA to the canonical Customer Account Receipt flow; customers + b2b customer pages' inline record-advance forms → replaced with canonical stored-value balance (`GET /api/v1/customers/[id]/stored-value`) + account-receipt CTA; `ready-order-actions.ts` rewritten on canonical snapshot + `getOrderPaymentsCanonical`.
  - **Deleted:** `app/dashboard/internal_fin/payments/**` (8 files), `internal_fin/invoices/[id]/record-payment-client.tsx`, `app/actions/payments/{process-payment,payment-crud-actions,payment-list-actions}.ts`, `src/features/billing/ui/{payments-table,payment-filters-bar,cancel-payment-dialog,refund-payment-dialog}.tsx`.
  - **Inbound links fixed:** voucher detail + vouchers tab source links (PAYMENTS → unlinked), financial-tab refund payment id (copyable, no link), vouchers-table print icon → voucher detail.
  - **Contracts/nav:** billing-access payments contracts removed; navigation.ts `billing_payments` removed; **migration `0393_nav_retire_billing_payments.sql` created (soft-retire, idempotent) — ⛔ AWAITING USER REVIEW + APPLY (local then remote)**.
  - **Bonus root-cause fix (pre-existing, surfaced by inventory rebuild):** catalog-access.ts used identifier-referenced `page: CATALOG_SECTION_PAGE` which the static extractor can't resolve → 8 routes reported "missing contract". Inlined literal page requirements (`admin:manage`) at all 8 sites. Drift 0 / 0 after rebuild.
  - **Gates:** tsc 0 · eslint 0 · i18n ✅ · `sync:ui-access-contract` PASS (140 contracts, 0 missing) · `check:platform-info-inventories` PASS · full jest **1601/1601** · build RUNNING (result to be logged).
  - i18n: `workflow.ready.paymentSection.{receiveAccountPayment,receiveAccountPaymentHint}` + `customers.{receiveAccountPayment,receiveAccountPaymentHint}` EN+AR.
  - Docs: ORDER_FINANCIAL_PLATFORM §money-entry surfaces + QA guide Phase-3 addendum; inventories/GENERATED_* regenerated.
  - Note: `cashup` screen + `getVoucherDataByPaymentId` + `listVouchers.payment_id` intentionally left for Phase 5 demolition.
- **2026-07-04 (exec 2, cont.)** — **Phase 3 build gate GREEN (exit 0). Phase 3 ✅ COMPLETE** (migration 0393 still ⛔ awaiting user apply).
- **2026-07-04 (exec 2, cont.)** — **Phase 4 code COMPLETE (FN-02 full flow):**
  - New `lib/services/order-cancel-financials.service.ts` — `unwindOrderFinancialsOnCancel`: CAS-guarded APPLIED→REVERSED credit reversal restoring gift/wallet/advance/credit-note to source ledgers (LOYALTY → warning), disposition routing for real payments (REFUND → per-payment keyed `initiateRefund` with `reason=CANCELLED`/`method=ORIGINAL_METHOD`; STORE_CREDIT → one keyed credit note for net collected; KEEP_ON_ACCOUNT → audit-only), promo-usage reversal, snapshot recalc, outbox audit event `ORDER_CANCEL_FINANCIAL_UNWIND` (new constant; history consumer intentionally ignores it — no migration).
  - `workflow-service-enhanced.ts` — interim hard block replaced by the disposition gate (`CANCEL_DISPOSITION_REQUIRED`; KEEP_ON_ACCOUNT gated by `orders:approve_refund` via `hasPermissionServer`); unwind wired on BOTH old and new workflow paths; unwind failure surfaces `CANCEL_UNWIND_FAILED` (retry-safe).
  - `cancel-order-dialog.tsx` — fetches canonical paid via `/orders/[id]/state` on open; amount-aware 3-option disposition chooser (amber fieldset, EN/AR, RTL); submit blocked until the paid check resolves.
  - i18n `orders.cancel.disposition.*` (EN+AR). ADR: `ADR-053-Order-Cancellation-Financial-Disposition.md`. Docs: STORED_VALUE_GUIDE + QA guide Phase-4 addendum.
  - Tests: `order-cancel-financials.service.test.ts` (9) + `workflow-cancel-guard.test.ts` rewritten (7) + tenant-isolation suite updated. **Full jest 1612/1612.** eslint 0 (set-state-in-effect fixed via close-reset pattern) · tsc 0 (refund reason/method now constants) · i18n ✅ · build exit 0. **Phase 4 ✅ COMPLETE.**
- **2026-07-04 (exec 2, cont.)** — **Phase 5 code COMPLETE (full demolition):**
  - **Migrations created (⛔ user review + apply, local then remote):** `0394_nav_retire_billing_cashup.sql` (soft-retire) + `0395_drop_org_payments_dtl_tr.sql` (ABORT guards: `_tr` rows=0, audit rows=0, `oip.payment_id` all-NULL; drops FK `fk_payment_audit_payment` → table `org_payment_audit_log` → FK `fk_oip_pay` + column `payment_id` → table `org_payments_dtl_tr`; RESTRICT-only, manifest header).
  - **Deleted:** `payment-service.ts` (whole), `payment-audit.service.ts`, `cashup-service.ts` + cashup actions/UI/page (+nav+contract), `order-cancel-service.ts`, `order-return-service.ts`, `payment-crud-schemas.ts`, `payment-stats-cards.tsx`, deprecated `refundToGiftCard(Tx)` wrappers, `getVoucherDataByPaymentId` (+action), voucher list `_tr` include/payment_id, delete-order `_tr` deleteMany, legacy tests (payment-service, order-cancel-service, order-return-service).
  - **AR voucher-only allocations:** `allocateArPaymentSchema` payment_id removed; `ar-invoice.service.ts` fully payment_id-free (creates/events/ledger metadata/reversals ×13 sites); `ArInvoicePaymentAllocation.payment_id` removed; AR UI allocation dialog voucher-only + allocations tab column dropped; `ar-credit.service` lookup adjusted; schema test rewritten (voucher accepted, legacy key rejected via `.strict()`).
  - **Prisma:** models `org_payments_dtl_tr` + `org_payment_audit_log` removed (+17 back-relations); `org_invoice_payments_dtl.payment_id` + `idx_oip_pay` removed; **stale-drift fix:** cash-drawer-movements relation repointed to `org_order_payments_dtl` (the table its DB FK `fk_org_cdm_order_payment` actually references). `prisma validate` + `generate` ✅.
  - **Types:** `PaymentTransaction`/`PaymentTransactionMetadata`/`CreatePaymentTransactionInput`/`ProcessPayment*`/`RefundPayment*`/`PaymentList*`/`PaymentStats`/`CashUp*` blocks removed from `lib/types/payment.ts`; lowercase `PAYMENT_STATUSES`+`PaymentStatus` removed from constants (FN-08 done early).
  - **"Never existed" sweep:** `grep org_payments_dtl_tr` over app/lib/src/config/prisma/__tests__ = **0 hits** (name survives only in historical migrations + ADR/docs).
  - **Drift fix (user commit 46e72b9e surfaced):** `billing_vouchers` nav entry now mirrors the contract gate `fin_vouchers:view`; inventories rebuilt → drift 0/0.
  - **ADRs/docs:** ADR-002 → Implemented/REMOVED + completion section; new `ADR-055-Single-Payment-Read-Model.md`; tech_data_model, CASH_DRAWER_GUIDE, QA guide Phase-5 addendum.
  - **Gates:** tsc 0 · eslint 0 · **full jest 1597/1597** · i18n ✅ · inventories drift 0 · build RUNNING (result to be logged).
- **2026-07-04 (exec 3)** — **Phases 6+7+8 COMPLETE → PROGRAM DONE.**
  - **P6:** FN-03 comparand wired (engine reads linked `org_tax_documents_mst.total_amount` in-tx; stale comments fixed); `projectBaseCurrencyAmount` exported + fixture suite (5 tests, R-07); open-balance epsilons → `SETTLEMENT_MONEY_EPSILON` (R-08). TAX_ENGINE_GUIDE updated.
  - **P7:** FN-11 repo-wide region-neutral locale sweep (36 files incl. shared `format-money` + its test contract); FN-12 `orders-perm.ts` + `finance-perm.ts` registries (literals stay at gate sites — extractor constraint documented); FN-09 `OrderPaymentRowStatus` rename; FN-10 `CREDIT_APPLICATION_STATUSES.APPLIED`; FN-13 verified already fixed; orphaned AR `paymentId` i18n keys removed EN+AR.
  - **P8:** ADR governance — decision pack → `ADR-PACK-nnn-*` (30 files), canonical `ADR-nnn` authoritative, new ADRs folded in as **ADR-053** (cancellation disposition) + **ADR-055** (single payment read model; 054 = user's POS sessions); `ADR/README.md` regenerated (55 canonical + 30 pack + 1 special); no live links broken (verified). `16_RESOLUTION_ADDENDUM.md` added to the validation report (+README index + must-fix banner); IMPLEMENTATION_STATUS updated.
  - **Final gates:** tsc 0 · eslint 0 · **jest 1602/1602 (162 suites)** · build exit 0 · i18n ✅ · inventories drift 0/0 · contracts sync PASS.
  - **User actions remaining:** review + apply migrations **0393 / 0394 / 0395** (local → remote; 0395 re-verifies the empty-table premise via ABORT guards); optional: re-run Phase-0 counts before 0395; commit.
