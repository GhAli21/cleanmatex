# Phase 3 — ORDER-only Payment Validation + Credit-App Lifecycle

**Status:** Done
**Date:** 2026-06-04
**Plan ref:** [order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md) §Phase 3
**Status tracker:** [order-fin-v1_1-implementation-status.md](order-fin-v1_1-implementation-status.md)

---

## Problem

Phase 3 closed two v1.1 gaps:

1. Order financials needed a reliable way to distinguish true ORDER settlement from other voucher targets without polluting the order-payment fact table.
2. Credit applications needed lifecycle-grade accounting instead of the old `is_active` / `rec_status` approximation.

The final design intentionally keeps `org_order_payments_dtl` as the ORDER real-payment table only. Generic target discrimination stays on `org_fin_voucher_trx_lines_dtl.target_type` and `target_id`, and code-level validation plus reconciliation now enforce the contract.

---

## Corrected decision

The originally drafted Phase 3 idea was adjusted before completion:

- Do **not** add `payment_target_type` to `org_order_payments_dtl`
- Keep `org_order_payments_dtl` only for ORDER real payments
- Use `org_fin_voucher_trx_lines_dtl.target_type` and `target_id` for generic target discrimination
- Enforce:
  - `ORDER_PAYMENT` voucher lines must create `org_order_payments_dtl`
  - `INVOICE_PAYMENT` voucher lines must **not** create `org_order_payments_dtl`
  - `ORDER_CREDIT_APPLICATION` voucher lines must create `org_order_credit_apps_dtl`

This preserves a cleaner fact model: order-payment rows remain semantically narrow, while voucher lines carry the broader settlement target lineage.

---

## Schema state after 0337

[`supabase/migrations/0337_payment_target_and_credit_app_lifecycle.sql`](../../../supabase/migrations/0337_payment_target_and_credit_app_lifecycle.sql) **was applied on 2026-06-04**.

Effective runtime/schema outcome:

- `org_order_credit_apps_dtl.application_status TEXT NOT NULL DEFAULT 'APPLIED'`
- `org_orders_mst.pending_credit_application_amount DECIMAL(19,4) NOT NULL DEFAULT 0`
- `org_orders_mst.failed_credit_application_amount DECIMAL(19,4) NOT NULL DEFAULT 0`
- `org_order_payments_dtl` remains ORDER-only; no durable `payment_target_type` contract is used there

Lifecycle mapping now follows the locked 8-state model:

| Statuses | Header bucket |
|---|---|
| `APPLIED` | `total_credit_applied_amount` |
| `PENDING`, `RESERVED`, `PROCESSING` | `pending_credit_application_amount` |
| `FAILED`, `CANCELLED`, `EXPIRED` | `failed_credit_application_amount` |
| `REVERSED` | `credit_reversed_amount` |

---

## Files modified

### Schema, constants, and types
- [`web-admin/prisma/schema.prisma`](../../../web-admin/prisma/schema.prisma) — added `application_status` on `org_order_credit_apps_dtl` and the two new order-header credit bucket columns.
- [`web-admin/lib/constants/order-financial.ts`](../../../web-admin/lib/constants/order-financial.ts) — added `CREDIT_APPLICATION_STATUSES` and reconciliation names `PAYMENT_TARGET_VS_ORDER_TOTALS` / `CREDIT_APP_LIFECYCLE_CONSISTENCY`.
- [`web-admin/lib/types/order-financial.ts`](../../../web-admin/lib/types/order-financial.ts) — exported `CreditApplicationStatus`; extended `CanonicalOrderFinancialSnapshot` with pending/failed credit-application amounts.
- [`web-admin/lib/types/voucher-wiring.ts`](../../../web-admin/lib/types/voucher-wiring.ts) — extended voucher-line wiring contract with `target_type` and `target_id`.

### Write path and voucher wiring
- [`web-admin/lib/services/order-financial-write.service.ts`](../../../web-admin/lib/services/order-financial-write.service.ts) — derives credit-app lifecycle buckets from `application_status`, persists the two new order-header columns, and includes them in snapshot `derivedTotals`.
- [`web-admin/lib/services/voucher-wiring.service.ts`](../../../web-admin/lib/services/voucher-wiring.service.ts) — reads voucher-line `target_type` / `target_id`.
- [`web-admin/lib/services/wiring/order-payment-wiring.handler.ts`](../../../web-admin/lib/services/wiring/order-payment-wiring.handler.ts) — validates `target_type='ORDER'` and `target_id=order_id` before creating an order-payment row.
- [`web-admin/lib/services/wiring/order-credit-application-wiring.handler.ts`](../../../web-admin/lib/services/wiring/order-credit-application-wiring.handler.ts) — validates ORDER target lineage and writes `application_status='APPLIED'`.
- [`web-admin/lib/services/order-settlement.service.ts`](../../../web-admin/lib/services/order-settlement.service.ts) — direct credit-app creation path now stamps `application_status='APPLIED'`.
- [`web-admin/lib/services/order-credit-application.service.ts`](../../../web-admin/lib/services/order-credit-application.service.ts) — stored-value debit path now stamps `application_status='APPLIED'`.

### Read path and view model
- [`web-admin/lib/services/order-financial-summary.service.ts`](../../../web-admin/lib/services/order-financial-summary.service.ts) — surfaces pending/failed credit-app buckets, includes `application_status` in credit rows, and keeps lifecycle rows visible to the read model.
- [`web-admin/lib/utils/order-financial-effective-snapshot.ts`](../../../web-admin/lib/utils/order-financial-effective-snapshot.ts) — derives fallback pending/failed/applied/reversed credit buckets from `application_status`.
- [`web-admin/src/features/orders/model/order-financial-summary-view.ts`](../../../web-admin/src/features/orders/model/order-financial-summary-view.ts) — added pending/failed credit-app amounts to the view contract.
- [`web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`](../../../web-admin/lib/map-order-financial-summary-view.ts) — passes the new bucket amounts through and only counts `APPLIED` gift-card credits in the warning logic.

### Reconciliation
- [`web-admin/lib/services/reconciliation/order-checks.ts`](../../../web-admin/lib/services/reconciliation/order-checks.ts) — added:
  - `checkPaymentTargetVsOrderTotals`
  - `checkCreditAppLifecycleConsistency`
- [`web-admin/lib/services/reconciliation.service.ts`](../../../web-admin/lib/services/reconciliation.service.ts) — executes both new checks as part of the reconciliation run.

### i18n
- [`web-admin/messages/en.json`](../../../web-admin/messages/en.json) — added `OrderFinancial.paymentTarget.*` and `OrderFinancial.creditApp.status.*`.
- [`web-admin/messages/ar.json`](../../../web-admin/messages/ar.json) — matching Arabic keys.

### Tests
- [`web-admin/__tests__/utils/order-financial-effective-snapshot.test.ts`](../../../web-admin/__tests__/utils/order-financial-effective-snapshot.test.ts) — lifecycle bucket derivation coverage.
- [`web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts`](../../../web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts) — snapshot/view-model coverage for pending and failed credit-app buckets.
- [`web-admin/__tests__/services/reconciliation/check-modules.test.ts`](../../../web-admin/__tests__/services/reconciliation/check-modules.test.ts) — new reconciliation tests for missing ORDER-payment rows and lifecycle/header drift.

---

## Validation and reconciliation behavior

Phase 3 now enforces these invariants:

- ORDER payment rows can only be created from voucher lines targeted to the same ORDER.
- INVOICE payment voucher lines do not belong in `org_order_payments_dtl`.
- ORDER credit-application voucher lines must yield `org_order_credit_apps_dtl` rows.
- Header snapshot amounts must reconcile against lifecycle-derived credit sums and ORDER-payment completion totals.

The two new reconciliation checks are:

- `PAYMENT_TARGET_VS_ORDER_TOTALS`
- `CREDIT_APP_LIFECYCLE_CONSISTENCY`

---

## Verification gates

| Gate | Status |
|---|---|
| `npm run prisma:generate` | ✓ clean |
| `npm run typecheck` | ✓ clean |
| `npm run check:i18n` | ✓ EN/AR parity OK |
| Targeted Jest (4 suites / 51 tests) | ✓ green |
| `npm run build` | ✓ green |

---

## Phase 4 handoff

Phase 4 is next: base-currency snapshot support.

Next migration to draft:

- `supabase/migrations/0338_order_fin_base_currency_snapshot.sql`

Per repo rule, create the Phase 4 migration file and then **stop for user review/apply before writing any Phase 4 code**.
