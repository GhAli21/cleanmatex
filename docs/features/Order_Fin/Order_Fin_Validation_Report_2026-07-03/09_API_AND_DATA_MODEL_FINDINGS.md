# 09 — API and Data Model Findings

## Data model — strengths (confirmed)

- **Canonical order financial columns** on `org_orders_mst` (total/paid/credit/outstanding/overpaid/ar_receivable/base-currency projections/payment_status/financial_snapshot_status) maintained by exactly one writer (`recalculateOrderFinancialSnapshotTx`) — single-writer snapshot is the right pattern.
- **Fact tables are append/status-oriented:** `org_order_payments_dtl` (ORDER-only), `org_order_credit_apps_dtl`, `org_order_refunds_dtl`, `org_order_adjustments_dtl`, `org_order_charges_dtl`, `org_order_taxes_dtl`, `org_order_discounts_dtl` (+ `is_voided`), `org_fin_overpay_disp_dtl` (FK-governed resolution catalog since 0378).
- **Voucher spine:** `org_fin_vouchers_mst` + `org_fin_voucher_trx_lines_dtl` as canonical transaction lines (ADR-001-BVM / ADR-002-deprecate-tr), with wired-effect linkage and reversal mirror lines.
- **Idempotency:** central `org_idempotency_keys` + `withIdempotency`/`withIdempotencyResource`, plus partial unique indexes at fact level (`uq_refund_idempotency`, `uq_b2b_stmt_pay_idem`, wallet/advance/credit-note/cash-in/disposition uniques). Belt and suspenders — correct for money.
- **Tax documents:** `org_tax_documents_mst` + lines (0341), scoped sequence counters with RLS (0379).
- **B2B:** statement payment detail (0380) + composite tenant FK (0381) closed the audit gap.

## Data model — findings

| ID | Finding |
|---|---|
| FN-01 | **Two payment ledgers, half-migrated.** `org_payments_dtl_tr` is deprecated (ADR-002) but still written by invoice/customer payment flows and read by order/report surfaces. There is no reconciliation between it and `org_order_payments_dtl`/voucher lines — nothing detects the divergence. Decide the end state ([15 Q2](./15_OPEN_QUESTIONS.md)) and finish the migration; add a temporary recon query if `_tr` must live on. |
| FN-02 | **No cancellation semantics in the model.** `org_order_credit_apps_dtl.application_status` has REVERSED in its constant set but no writer; cancelled orders keep COMPLETED payments. The model supports the right design (status transitions + refund/disposition rows) — only the flow is missing. |
| FN-03 | Engine never reads `org_tax_documents_mst.total` as the §16.1 comparand although the linkage (`order.tax_document_id`) and the table exist. |
| — | `org_b2b_statements_mst` has no Prisma model (raw-SQL only) — already worked around (D-12 cluster D); consider generating the model to remove the raw-SQL seam. |

## API boundary findings

| Area | State |
|---|---|
| Money-mutation routes | ✅ Consistent shape: `requirePermission` → `validateCSRF` → Zod schema → service Tx (e.g. `orders/[id]/collect-payment/route.ts:35`, `orders/[id]/payments`). Thin routes, logic in services — matches the architecture rules. |
| Preview endpoints | ✅ `orders/preview-financials` + `orders/preview-payment` run the same `calculateOrderTotals` as submit — preview cannot drift from posting. |
| Report/print endpoints | ❌ FN-04: two order print routes bypass middleware, RBAC, and the shared tenant-context helper; also define response interfaces inline in the route file (`PaymentsRprtResponse`) instead of `lib/types/`. |
| Deprecated-ledger API surface | `app/actions/payments/process-payment.ts` + `app/dashboard/internal_fin/payments/*` still expose the `_tr` CRUD path (list/stats/notes/cancel in `payment-service.ts:1975-2504`). Freeze this surface as part of FN-01. |
| Error handling | Money mutations return typed errors; the cancel path's `console.warn` swallow (`workflow-service-enhanced.ts:335,339`) is the outlier — a failed payment-cancel during order cancel must at minimum surface as a warning on the result and an audit row. |
| Idempotency at API level | Submit stakes an idempotency record before orchestration (conflict → 409-style handling); collect accepts client keys with server UUID fallback. ✅ |

## Service-boundary observations

- Finance services consistently take explicit `tenantId` and run under `withTenantContext`; the exception is `payment-service.getPaymentsForOrder` deriving tenant from session internally (hidden dependency — align it when repointing readers for FN-01).
- `order-cancel-service` and `workflow-service-enhanced` split cancellation across two layers with the financial part in neither — after FN-02 the unwind should live in one settlement-owned service (mirror of `settleOrderTx`, e.g. `unwindOrderFinancialsTx`), not in the workflow layer.
- Dual naming for order routes: both `orders/[id]/refund` and `orders/[id]/refunds`, and both `financial-reconcile` and `financial-reconciliation`, exist side by side — one of each pair should be a deprecated alias; verify before adding clients.
