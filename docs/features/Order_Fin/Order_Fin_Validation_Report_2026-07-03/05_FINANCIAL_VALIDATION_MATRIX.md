# 05 — Financial Validation Matrix

Rule-by-rule validation of the money math. "Verified" = read in source this pass; "Baseline" = verified live-DB/tests in the 2026-06-18 program and unchanged since (spot-checked file state).

## A. Pricing & line-item math (`lib/services/order-calculation.service.ts`)

| # | Rule | Where | Status |
|---|---|---|---|
| A1 | Subtotal = Σ(unit price × qty) + service/packing preference charges; price override respected | :167-181 | ✅ Verified |
| A2 | Rounding: staged `round(x, decimalPlaces)` at every subtotal/discount/tax boundary; tenant `decimalPlaces` from currency config (default 3 — GCC OMR/BHD/KWD-correct) | :89-91, :131 | ✅ Verified (JS `toFixed` float caveat noted — acceptable at DECIMAL(19,4) storage) |
| A3 | Manual discount: percent XOR amount (percent wins when >0), capped at subtotal | :183-195 | ✅ Verified |
| A4 | Auto-rule discount: best single rule, capped at running base | :202-215 | ✅ Verified |
| A5 | Promo stacking: non-stackable rule → larger of promo/auto wins, never both; stackable → both, promo evaluated on post-rule base | :222-258 | ✅ Verified |
| A6 | Discounts can never drive base negative (`Math.max(0, …)`) | :197-200, :260-263 | ✅ Verified |
| A7 | VAT/GST computed **after** discounts (tax-exclusive model), CUSTOM taxes separated | :265-307 | ✅ Verified — standard GCC treatment |
| A8 | Gift card is a settlement credit, NOT a discount; capped at min(balance, amount-before-gift); excluded from `saleTotal` | :309-340 + ADR-008 | ✅ Verified |
| A9 | `saleTotal` = afterDiscounts + VAT + additional tax (full sale value) | :340 + ADR-007 | ✅ Verified |
| A10 | Discount audit lines emitted per source with bilingual names | :342-… | ✅ Verified (names hardcoded EN/AR in code — cosmetic) |

## B. Snapshot recalculation (`lib/services/order-financial-write.service.ts`)

| # | Rule | Where | Status |
|---|---|---|---|
| B1 | `total_paid` counts only COMPLETED/CAPTURED/SETTLED real payment rows | :721 + `ORDER_PAYMENT_LIFECYCLE_STATUSES` | ✅ Verified |
| B2 | PENDING/PROCESSING/CAPTURE_PENDING and AUTHORIZED excluded from paid; surfaced as warnings | :722-723, :795-827 + gateway-pending tests | ✅ Verified |
| B3 | Credits: only APPLIED count; PENDING/RESERVED/PROCESSING and FAILED/CANCELLED/EXPIRED and REVERSED bucketed separately | :689-712 | ✅ Verified |
| B4 | Charges decomposed SERVICE/DELIVERY/EXPRESS/other; other = max(0, remainder) | :662-675 | ✅ Verified |
| B5 | `outstanding = max(0, total − paid − credit + refundReopensDue)` | :759-766 | ✅ Verified |
| B6 | Overpaid = **unresolved** excess only: gross − changeReturned − disposedOverpayment | :767-774 (+ disposition sum :728-735) | ✅ Verified |
| B7 | Refund classification: real-payment refund vs stored-value restore vs credit issued; unclassified → warning | :737-744, :825 | ✅ Verified |
| B8 | Canonical total: recompute with rounding adjustment; header fallback flagged (`usedHeaderTotalFallback` → warning + snapshot status) | :746-755, :829 | ✅ Verified |
| B9 | PAY_ON_COLLECTION / AR receivable projections from `payment_type_code` | :775-781 | ✅ Verified |
| B10 | Base-currency projections (total/tax/paid/credit/outstanding/AR) via `currency_ex_rate` | :782-792 | ✅ Verified (runtime multi-currency untested — R-07) |
| B11 | Header payment status resolution (UNPAID/PENDING_COLLECTION/PARTIALLY_PAID/PAID/OVERPAID) | :830-836 | ✅ Baseline |
| B12 | Tax-base decomposition per category | :685-688 | ❌ Zeroed — FN-05 |
| B13 | Tax-document fiscal total = order total (§16.1) | :815-824 | ❌ Suppressed — FN-03 |

## C. Payment lifecycle & settlement

| # | Rule | Status |
|---|---|---|
| C1 | Submit = one atomic tx (stake-idempotency → voucher post+wire → settle → recalc) | ✅ Baseline + orchestrator §6 read this pass |
| C2 | `org_order_payments_dtl` is ORDER-only (target hard-assert; `payment_target_type` dropped in 0337) | ✅ Baseline |
| C3 | Collect-payment per-event idempotency (UUID fallback + client key); replay dedupes | ✅ Baseline + DB-integration test |
| C4 | Overpayment: schema accepts overpay; excess routed via disposition (FK-governed catalog, 0378); change-return excluded | ✅ Baseline |
| C5 | Partial payments accumulate; two sequential partials both apply | ✅ Baseline (collect-payment.idempotency.test) |
| C6 | Reversals: voucher reverse blocked from double-reverse (transition table); AR allocation reverse idempotent + reversed_at guard; AR void approval-gated | ✅ Baseline (D-12 §4 review) |
| C7 | Refunds: initiate idempotent replay (uq_refund_idempotency), process FOR UPDATE + keyed credit-note, balance guard on PROCESSED sums, `fn_next_fin_doc_no` numbering | ✅ Verified this pass (:174-472) |
| C8 | Cancellation financial unwind | ❌ Missing — FN-02 |
| C9 | Gateway capture lifecycle (PENDING→CAPTURED via callback) | ❓ Unexercised — R-02 |

## D. Customer balance & downstream rollups

| # | Rule | Status |
|---|---|---|
| D1 | Stored-value liability (wallet+advance+credit-notes) reportable per tenant | ✅ D-09 report 1 |
| D2 | Receipt allocation: preview-before-post; auto (policy-driven, cap, fallback matrix) + manual (over-allocation guard) | ✅ Baseline + Phase 5 UX hardening |
| D3 | AR invoice paid/outstanding move only via allocation service (idempotent), reversal symmetric | ✅ Baseline |
| D4 | B2B statement balance: idempotent apply + detail audit rows (0380/0381) | ✅ Baseline |
| D5 | Open-balance query epsilon | ⚠ literal `0.001` (`customer-open-balance-query.service.ts:220`) — R-08 |

## E. Money storage & precision

- DB money columns DECIMAL(19,4) (project rule; spot-confirmed in 0380 CHECK/columns baseline).
- Float epsilon: `SETTLEMENT_MONEY_EPSILON` used in settlement paths (baseline); recon reports use 0.01 exception threshold by design.
- JS-side `Number` math is bounded by staged rounding + DECIMAL storage; no compounding-rounding pattern found (each stage rounds once).
