# Order Financial Remediation Program — STATUS

**Plan:** [PLAN.md](./PLAN.md) · **Findings source:** `../Order_Fin_Validation_Report_2026-07-03/`
**Started:** — (not started) · **Last update:** 2026-07-03 (program planned)

## Phase tracker

| Phase | Scope | Status | Gates | Docs refreshed (PLAN §doc-tasks) | Migration |
|---|---|---|---|---|---|
| 0 | Pre-flight verification (4 counts, local+remote; seq check) | ⬜ NOT STARTED | — | ⬜ STATUS pre-flight table | — |
| 1 | Canonical read fn + repoint Payments tab/prints/voucher-linkage + print RBAC + cancel interim guard | ⬜ | — | ⬜ tech_api · tech_data_model · ORDER_FINANCIAL_PLATFORM · QA guides | none |
| 2 | Payments report → canonical + money-position tile | ⬜ | — | ⬜ RECONCILIATION_GUIDE · tech_api · developer_guide | none |
| 3 | Write-path migration (ready/customers/b2b → AR/receipts) + retire internal_fin/payments + nav dual-write | ⬜ | — | ⬜ inventories regen (nav+page) · access-contract docs · developer_guide · ORDER_FINANCIAL_PLATFORM · prd-rules checklist | nav removal (⛔ user applies) |
| 4 | Cancellation disposition flow (`unwindOrderFinancialsTx`, dialog, canonical promo/gift reversal) + ADR | ⬜ | — | ⬜ new Cancellation ADR · ORDER_FINANCIAL_PLATFORM · STORED_VALUE_GUIDE · user guide · QA guides | none expected |
| 5 | 🔥 `org_payments_dtl_tr` full demolition (code + Prisma + drop migration + audit-log + oip.payment_id) | ⬜ | — | ⬜ ADR-002→Removed · new Single-Payment-Read-Model ADR · tech_data_model · tech_api · CASH_DRAWER_GUIDE · repo-wide doc grep · IMPLEMENTATION_STATUS/current_status/progress_summary | drop migration (⛔ user applies) |
| 6 | FN-03 fiscal comparand + multi-currency fixture + epsilon | ⬜ | — | ⬜ TAX_ENGINE_GUIDE · F-05 doc + ADR-052 amendment · tech_data_model | none |
| 7 | FN-11 locale formatting + FN-12 perm registry + FN-09/10/13 hygiene | ⬜ | — | ⬜ unification audit doc · developer_guide formatter rule · inventories refresh (api+page) | none |
| 8 | ADR renumber + new ADRs + resolution addendum + close-out | ⬜ | — | ⬜ ADR index/renumber + link fixes · 16_RESOLUTION_ADDENDUM in validation report · final status docs · memory | none |

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
| — | — | — | — | — | — |

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
  - i18n `orders.cancel.disposition.*` (EN+AR). ADR: `ADR-FIN-053-order-cancellation-financial-disposition.md`. Docs: STORED_VALUE_GUIDE + QA guide Phase-4 addendum.
  - Tests: `order-cancel-financials.service.test.ts` (9) + `workflow-cancel-guard.test.ts` rewritten (7) + tenant-isolation suite updated. **Full jest 1612/1612.** eslint 0 (set-state-in-effect fixed via close-reset pattern) · tsc 0 (refund reason/method now constants) · i18n ✅ · build RUNNING.
