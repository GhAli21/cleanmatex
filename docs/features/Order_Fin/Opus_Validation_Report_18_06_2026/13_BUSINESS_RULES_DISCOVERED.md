# 13 — Business Rules Discovered From Code

Rules the implementation **actually enforces** (not what docs claim). Format: Rule · Where · Documented? · Correct? · Risk if wrong.

## Payment / credit separation
1. **`org_order_payments_dtl` holds only ORDER real payments.** `0337` drop of `payment_target_type`; `order-payment-wiring.handler:46-50` asserts `target_type='ORDER' AND target_id=order_id`. Documented ✅ · Correct ✅ · Risk: payment/credit conflation, wrong totals.
2. **Generic settlement targeting lives on the voucher line** (`target_type`/`target_id`), not the payment table. `0301`/`0357` CHECKs. Documented ✅ · Correct ✅.
3. **Stored value (gift/wallet/advance/credit) is a credit application, never a real payment.** `stored-value.service` (no payment-row writes); recalc `isClearlyRealPaymentRow` nature filter. Documented ✅ · Correct ✅ · Risk: overstating cash collected.
4. **Only COMPLETED/CAPTURED/SETTLED real payments count as paid.** `ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED` (order-financial.ts:446); `sumPaymentStatusAmount`. Documented ✅ · Correct ✅ · Risk: counting pending money.
5. **Only APPLIED credits reduce outstanding.** recalc 689-692; `application_status` lifecycle. Documented ✅ · Correct ✅.
6. **Pending/authorized are tracked but excluded from outstanding** + raise warnings. recalc 722-723, 388-393. Documented ✅ · Correct ✅.

## Overpayment / excess
7. **`overpaid_amount` = unresolved excess only** = `max(0, gross − change − disposed)`. recalc 767-774. Documented ✅ · Correct ✅ · Risk: "money hanging nowhere," reconciliation gaps.
8. **Excess > ε must be explicitly resolved before submit.** validator throws `OVERPAYMENT_RESOLUTION_REQUIRED`. Documented ✅ · Correct ✅.
9. **RETURN_CASH_CHANGE is cash-only and capped to tender capacity.** validator 132-159; catalog `allowed_for_cash`. Documented ✅ · Correct ✅.
10. **Fallback for unresolved customer-receipt excess defaults to CUSTOMER_ADVANCE.** `0357` policy seed. Documented ✅ · Correct ✅.
11. **Wallet/advance/credit disposition requires a linked customer (walk-in blocked).** disposition svc 89/102/121; UI hides for walk-in. Documented ✅ · Correct ✅.

## AR / B2B / pay-on-collection
12. **If an order owns an open AR invoice, allocate to the invoice, not the order.** open-balance query skips orders with open linked invoices (161). Documented 🟡 (implied) · Correct ✅ · Risk: paying the order while the invoice stays open → double-count.
13. **AR invoice is receivable-only; tax documents are separate.** `ar-invoice.service`; `org_tax_documents_mst` (`0341`). Documented ✅ · Correct ✅.
14. **PAY_ON_COLLECTION is operational due, not AR.** recalc splits `pay_on_collection_amount` vs `ar_receivable_amount`. Documented ✅ · Correct ✅.
15. **Discounts/promotions reduce order value; stored value does not.** `resolveCanonicalTotalAmount` subtracts discount only. Documented ✅ · Correct ✅.

## Numbering / sequencing / idempotency (implied rules)
16. **Tax document numbers are gap-free, per (tenant, type, fiscal year), starting at 1 (0=legacy).** `tax-document-sequence.service` `FOR UPDATE`. Documented 🟡 · Correct ✅ · **Risk: RLS gap (F-01) means the DB doesn't enforce per-tenant isolation of the counter.**
17. **AR allocation is idempotent via a central key cache; effect tables (order/wallet/advance/CN/cash-in) via partial unique indexes.** `org_idempotency_keys` + index sweep. Documented 🔴 (undocumented) · Correct ✅ · **Risk: B2B has neither (F-02).**
18. **Submit/collect post all financial effects in one transaction.** orchestrator 719; `collectPaymentTx`. Documented 🟡 · Correct ✅ · Risk: partial financial state.

## Rules that are **implied but NOT fully enforced** (gaps)
19. **"No customer balance allocation without an audit trail"** — true for AR (detail rows) and order/wallet/advance/CN; **B2B has no detail table** (F-04), only the voucher line. Risk: weaker statement-payment auditability.
20. **"Feature rollout is flag-gated"** (per ADR-047) — **NOT enforced** (F-03). Flags are dead seeds.
21. **"Tax base decomposes into taxable/exempt/zero-rated/out-of-scope"** (implied by schema/UI) — **stubbed to 0** (F-05).
