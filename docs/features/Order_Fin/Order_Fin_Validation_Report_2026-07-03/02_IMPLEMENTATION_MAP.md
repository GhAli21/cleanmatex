# 02 — Implementation Map

How the order financial flow is actually wired, as of 2026-07-03.

## Write path (canonical — the source of truth)

```
New Order UI (payment-modal-v4)
  └─ POST /api/v1/orders/submit-order        ← single atomic tx, staked idempotency
       order-submit-orchestrator.service.ts
         ├─ §5 postAndWireBizVoucher          → org_fin_vouchers_mst + org_fin_voucher_trx_lines_dtl
         │     wiring handlers (lib/services/wiring/):
         │       order-payment  → org_order_payments_dtl (ORDER-only, hard-asserted)
         │       invoice-payment→ org_invoice_payments_dtl (AR allocate, withIdempotencyResource)
         │       statement-pay  → org_b2b_statements_mst + org_b2b_statement_payments_dtl (0380/0381)
         │       cash           → org_cash_drawer_movements (line-anchored idempotency)
         │       stored value   → wallet / advance / credit-note / gift-card ledgers
         ├─ §6 settleOrderTx (order-settlement.service.ts)
         │       charges, taxes, discounts, credit applications (org_order_credit_apps_dtl,
         │       'APPLIED' at :319), payment fact rows when wiring skipped (:230, :800)
         └─ recalculateOrderFinancialSnapshotTx (order-financial-write.service.ts)
                 → org_orders_mst canonical columns (total/paid/credit/outstanding/overpaid/
                   payment_status/financial_snapshot_status/warning codes)
Later collections:
  POST /api/v1/orders/[id]/collect-payment → collectPaymentTx (orders:collect_payment)
  POST /api/v1/orders/[id]/payments        → collectPaymentTx (+ overpayment resolution)
Refunds:
  /api/v1/orders/[id]/refund(s) → order-refund.service.ts (initiate/approve/process;
  uq_refund_idempotency + FOR UPDATE + fn_next_fin_doc_no)
Overpayment:
  overpayment-disposition.service.ts → org_fin_overpay_disp_dtl (FK to sys_fin_overpay_res_cd, 0378)
Customer receipts / allocation:
  /api/v1/customer-receipts/* → customer-receipt-* services (preview→post, auto/manual)
```

## Read path (canonical)

- `order-financial-summary.service.ts` — reads `org_orders_mst`, `org_order_payments_dtl`, `org_order_credit_apps_dtl`, `org_order_charges_dtl`, `org_order_taxes_dtl`, `org_order_adjustments_dtl`, `org_order_refunds_dtl`, `org_tax_documents_mst` (:410) → feeds the order **Financial** tab (`orders-financial-tab-rprt.tsx`) via `getOrderFinancialAction`
- D-09 reconciliation reports — `lib/services/reports/finance-reconciliation-report.service.ts` (4 reports, canonical tables + `withTenantContext`)
- AR/B2B statements — `ar-invoice.service.ts`, b2b statement services (canonical)

## Read path (DEPRECATED ledger — the drift; see FN-01)

`org_payments_dtl_tr` (ADR-002: deprecated 2026-05-30; canonical order flow **stopped writing it** — removal documented at `order-submit-orchestrator.service.ts:981-997`):

| Reader | Path | Surface |
|---|---|---|
| `payment-service.getPaymentsForOrder` (:1265) | `app/dashboard/orders/[id]/full/page.tsx:95` → `allPayments` | Order **Payments tab** (`orders-payments-tab-rprt.tsx`) |
| same | `app/api/v1/orders/[id]/report/payments-rprt/route.ts:86` | Order payments A4 print |
| same | `app/api/v1/orders/[id]/report/invoices-payments-rprt/route.ts` | Order invoices+payments print |
| `report-service.getPaymentsReport` (:268) | `/dashboard/reports` payments report | Tenant **Payments report** (KPIs, method breakdown, export) |
| `cashup-service` (:51) | `app/actions/billing/cashup-actions.ts`, `src/features/billing/ui/cashup-history.tsx` | Legacy cash-up |
| `order-cancel-service.reversePromoAndGiftForOrder` (:63) | cancel flow | Legacy promo/gift reversal |
| `voucher-service` (:295-600) | voucher detail | Payment linkage display |

**Remaining writer:** `payment-service.recordPaymentTransaction`/`processPayment` (:1096 create; also creates a receipt voucher) — used by `app/actions/payments/process-payment.ts` from `app/dashboard/customers/[id]/page.tsx:148`, `app/dashboard/b2b/customers/[id]/page.tsx:132`, `app/dashboard/ready/[id]/page.tsx:416` (invoice/customer payments), and `app/dashboard/internal_fin/payments/new/page.tsx`.

## Status constants (all verified against write sites)

| Constant | File | Values | Stored in |
|---|---|---|---|
| `ORDER_PAYMENT_LIFECYCLE_STATUSES` | `lib/constants/order-financial.ts:453` | UPPERCASE buckets (COMPLETED/CAPTURED/SETTLED · PENDING/PROCESSING/CAPTURE_PENDING · AUTHORIZED · FAILED/…) | `org_order_payments_dtl.payment_status` |
| `ORDER_PAYMENT_STATUS` (header) | `lib/constants/order-financial.ts:531` | UNPAID/PENDING_COLLECTION/PARTIALLY_PAID/PAID/OVERPAID | `org_orders_mst.payment_status` |
| `VOUCHER_LINE_PAYMENT_STATUS` | `lib/constants/voucher.ts:222` | UPPERCASE | voucher trx lines |
| `ORDER_PAYMENT_STATUSES` (row) | `lib/constants/payment.ts:215` | UPPERCASE | (row-level, note duplicate type name — FN-09) |
| `PAYMENT_STATUSES` | `lib/constants/payment.ts:113` | **lowercase** — matches `org_payments_dtl_tr.status` but has **0 usages** (FN-08) | deprecated ledger |
| `REFUND_STATUSES` | `lib/constants/payment.ts:224` | PENDING/APPROVED/PROCESSED/FAILED/CANCELLED | `org_order_refunds_dtl.refund_status` |
| `PAYMENT_METHODS` | `lib/constants/payment.ts:36` | canonical + gateway-provider codes; `normalizePaymentMethodCode` folds HYPERPAY/PAYTABS/STRIPE → PAYMENT_GATEWAY | method columns |

## UI surfaces (finance-facing)

- **New Order payment:** `payment-modal-v4.tsx` (shell) → `payment-full-view.tsx` (container: mode state, submit) → `payment-simple-view.tsx` / full workbench; engine hooks under `src/features/orders/ui/hooks/`; reusables under `src/features/orders/ui/payment-modal/`. Legacy v3/enhanced-02 retired to `*.tsx.bak`.
- **Order details (full):** tabs — Financial (canonical), Payments (`_tr` — FN-01), Vouchers, Receipts, Invoices, Edit-history; financial summary panel reads canonical snapshot.
- **Collect payment:** `src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx` (per-event idempotency key).
- **Pay-extra / allocation:** `payment-modal/pay-extra/`, `payment-modal/allocation/` (auto/manual drawers; over-allocation guard added Phase 5).
- **Refund/adjustment/cancel dialogs:** order actions on the details view (`orders:process_refund`, `orders:approve_refund`, `orders:create_adjustment` gates).
- **Reports hub:** `/dashboard/reports` (orders/payments/customers/invoices + revenue breakdown) and `/dashboard/reports/reconciliation` (D-09 ×4).
- **Billing:** cash drawer sessions print, receipt voucher print, cashup history (legacy).
- **AR/B2B:** invoice print, customer statement print, b2b statements print.
