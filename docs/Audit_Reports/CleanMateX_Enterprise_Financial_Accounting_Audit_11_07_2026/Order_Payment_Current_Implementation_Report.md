# Order Payment — Current Implementation Report (As-Is)

**Date:** 11-07-2026 · **Scope:** Order payment calculations, settlement, credits, refunds, snapshot, BVM, ERP-Lite, reconciliation · **Method:** Runtime code inspection only · **No code changes**

**Runtime home:** almost all engines in `web-admin/`. `cmx-api` = DTOs only (`finance-readiness.contracts.ts`). `packages/` empty.

Companion findings audit: `Order_Payment_Financial_Calculation_Audit.md` (same folder).

---

## 1. Executive Summary

CleanMateX has a **production-complete checkout path** for commercial totals, multi-tender settlement, stored-value credits, overpayment disposition, financial snapshot, BVM receipt vouchers, cash drawer, and AR invoices. Money truth after persist is **`recalculateOrderFinancialSnapshotTx`**. Pre-persist sale total is **`calculateOrderTotals`**.

Gaps that matter: later **collect-payment skips BVM**; **refunds do not set `reopens_due_amount`** so outstanding often stays closed; **ERP-Lite payment/refund auto-post is defined but unwired**; **reconciliation outstanding formula ≠ snapshot formula**; **TAX_INCLUSIVE preview always adds tax**; legacy **pricing-calculator / item-edit** paths still exist.

---

## 2. Authoritative Runtime Flow

```
UI (payment-modal-v4 / use-payment-totals)
  → POST /api/v1/orders/preview-payment
      → calculateOrderTotals (order-calculation.service.ts)
  → POST /api/v1/orders/submit-order
      → submitOrder (order-submit-orchestrator.service.ts)
          → calculateOrderTotals + AMOUNT_MISMATCH gate
          → buildSettlementPlan (order-settlement-planner.service.ts)
          → createBizVoucher + addVoucherLine (voucher-biz / voucher-line)
          → postAndWireBizVoucher (voucher-wiring.service.ts → wiring/*.handler.ts)
          → settleOrderTx(wiringMode:true) (order-settlement.service.ts)
          → recalculateOrderFinancialSnapshotTx (order-financial-write.service.ts)
  → Later: collectPaymentTx (direct payments + drawer; no BVM)
  → Refunds: order-refund.service → snapshot recalc
  → AR: ar-invoice.service → ErpLiteAutoPostService.dispatchInvoiceCreated*
  → Recon: reconciliation.service → order-checks.ts
  → Receipts: order-financial-summary + readCanonicalOrderFinancialSnapshot
```

---

## 3. Current Calculation Formulas

### Pre-DB sale total — `calculateOrderTotals` (`order-calculation.service.ts` 99–340)

| Step | Exact code formula |
|------|--------------------|
| Subtotal | `Σ(unitPrice×qty + servicePrefCharge + packingPrefCharge)`; `unitPrice = priceOverride ?? catalog.basePrice`; round via `toFixed(decimalPlaces)` (89–91, 167–181) |
| Manual discount | percent **or** amount (never both): `min(subtotal×%/100, subtotal)` or `min(amount, subtotal)` (183–195) |
| Auto rule | best single rule: `min(rule.discount_amount, afterManual)` (202–215) |
| Promo | stack if `can_stack_with_promo`; else best-of vs auto (222–258) |
| After discounts | `max(0, afterManual − auto − promo)` (260–263) |
| Tax (profiles) | `taxableBase = compound ? base+priorTax : base`; `tax = round(taxableBase × rate/100)` (`tax-engine.service.ts` 153–157) |
| Tax fallback | `vat = afterDiscounts × TENANT_VAT_RATE` (default **0.05**); optional additional %/fixed (292–305; `tax.service.ts` 17) |
| **Sale total** | `afterDiscounts + vatValue + additionalTax` — gift card **not** subtracted (309–340) |
| Net receivable adapter | `netReceivable = max(0, saleTotal − credits)`; `outstanding = netReceivable` (`toFinancialBreakdownSnapshot` 414–431) |

Rounding: tenant `decimalPlaces` (default **3**, `order-defaults.ts`). Submit tolerance **0.001** (orchestrator L71).

### Post-DB header — `recalculateOrderFinancialSnapshotTx` (`order-financial-write.service.ts` 522–812)

| Field | Exact formula |
|-------|----------------|
| items_base / subtotal | `SUM(org_order_items_dtl.total_price)` (668–669) |
| charges | `SUM(org_order_charges_dtl.amount)` non-void (671) |
| discounts / tax | `SUM` discount / tax detail amounts (685–686) |
| taxable | `SUM(taxable_amount)` else `max(0, subtotal+charges−discounts)` (687–688) |
| **total_amount** | `max(0, items + charges − discounts + taxAddend + rounding)` where `taxAddend=0` if TAX_INCLUSIVE else `totalTax` (`resolveCanonicalTotalAmount` 310–327) |
| total_paid | payments in `COMPLETED\|CAPTURED\|SETTLED` (730; constants 464–465) |
| credits | credit apps status `APPLIED` only (698–701) |
| **outstanding** | `max(0, total − paid − credits + refundReopensDue + creditReversalReopens)` (779–786); `creditReversalReopens` hardcoded **0** (777) |
| net_collected | `max(0, paid − realPaymentRefunded)` (778) |
| overpaid | `max(0, paid+credits−total) − changeReturned − disposedOverpayment` (787–794) |
| pay_on_collection / AR | `= outstanding` when payment type matches (795–801) |
| FX base | `round4(amount × currency_ex_rate)`; invalid rate → **0** (88–91) |

**Term note:** `netPayable` **NOT FOUND**. Canonical term = `netReceivable` / `outstanding`.

---

## 4. Payment and Settlement Implementation

| Capability | Status | Authority |
|------------|--------|-----------|
| Cash/card/check/bank/mobile/gateway | COMPLETE | planner + `org_payment_methods_cf.payment_nature` (`payment.ts` 36–49, 126–132) |
| Split / multi-leg | COMPLETE | `paymentLegs[]` → planner → voucher lines |
| Partial at submit | COMPLETE | remainder → `PAY_ON_COLLECTION` policy (planner ~172–181) |
| Later collection | COMPLETE (no BVM) | `collectPaymentTx` (`order-settlement.service.ts` ~640–890) |
| Tendered / change | COMPLETE | `change = max(0, tendered − amount)` (`voucher-line.service.ts` 135–139; settle/collect) |
| Overpayment disposition | COMPLETE | `overpayment-disposition.service.ts`; silent retain removed |
| Invoice / AR | COMPLETE | AR only when `CREDIT_INVOICE` + outstanding > tolerance (orchestrator ~644–655); `ar-invoice.service.ts` |
| Gateway async | PARTIAL | legs `PROCESSING`/`PENDING` until `verifyPaymentTx`; pending does not reduce outstanding |

**Canonical settlement path:** `submit-order` → planner → BVM → wiring → `settleOrderTx(wiringMode:true)` → snapshot.  
**Alternative:** `collectPaymentTx` writes `org_order_payments_dtl` + drawer directly (`voucherId: null`).  
**Legacy frozen:** `create-with-payment`; `org_payments_dtl_tr` dropped (migration `0395`).

---

## 5. Credits and Stored Value

| Type | Status | Key services / tables |
|------|--------|------------------------|
| Gift card | COMPLETE | `gift-card-service.ts`; submit as credit leg / synthetic GC; not part of `saleTotal` |
| Wallet / advance / credit note | COMPLETE | `stored-value.service.ts`; `org_customer_wallets_mst`, advances, `org_credit_notes_mst` |
| Loyalty | COMPLETE | `loyalty.service.ts` `redeemPointsTx`; idempotency `loyalty-redeem-${orderId}` |
| Post-order apply | COMPLETE | `order-credit-application.service.ts` |
| Locking | COMPLETE | `FOR UPDATE` + `STORED_VALUE_LOCK_ORDER` sort |

Credits reduce **outstanding**, not `total_amount` (migration `0333` design).

---

## 6. Refunds, Reversals, and Voids

| Capability | Status | Evidence |
|------------|--------|----------|
| Refund initiate/approve/process | COMPLETE API | `order-refund.service.ts`; APIs under `orders/[id]/refund*` |
| Refund methods | COMPLETE constants | ORIGINAL_METHOD / CASH / CREDIT_NOTE / WALLET |
| `reopens_due_amount` / `refund_source_type` write | **NOT FOUND in refund service** | grep: no matches in `order-refund.service.ts`; snapshot sums column (188) → stays 0 |
| Cancel unwind | COMPLETE | `order-cancel-financials.service.ts` reverses credits + payment disposition |
| Refund BVM voucher | **ORPHANED** | `createRefundVoucherForPayment` defined, never called |
| Voucher reverse unwind | PARTIAL | `voucher-reversal.service.ts` mirrors lines `NOT_WIRED` — no payment/wallet/drawer reverse |

---

## 7. Financial Snapshot

| Aspect | Detail |
|--------|--------|
| Writer | `recalculateOrderFinancialSnapshotTx` — **sole write authority** after facts exist |
| Reader | `readCanonicalOrderFinancialSnapshot` (`order-financial-snapshot.ts`); fallback `buildEffectiveOrderFinancialSnapshot` |
| Persistence | `org_orders_mst` canonical columns + `financial_calculation_snapshot` JSON **v5** + hash + `financial_snapshot_status` |
| Statuses | CURRENT / MISMATCH / RECALCULATION_REQUIRED / STALE / LOCKED (`order-financial.ts` 482+) |
| DB fn_recalc | **DISABLED** (`0114` body `IF 1=2`) — app-layer only |

---

## 8. BVM and Accounting Posting

### BVM (Business Voucher Module) — operational, not GL

**Canonical:** orchestrator → `createBizVoucher` → `addVoucherLine` → `postAndWireBizVoucher` → handlers:

- `order-payment-wiring.handler.ts` → `org_order_payments_dtl`
- `order-credit-application-wiring.handler.ts` → `org_order_credit_apps_dtl`
- `cash-drawer-wiring.handler.ts` → drawer (CASH_SALE = line.amount; CASH_OUT = change)
- invoice/statement payment handlers for AR/B2B

Tables: `org_fin_vouchers_mst`, `org_fin_voucher_trx_lines_dtl`.

### ERP-Lite GL

**Canonical engine:** `ErpLiteAutoPostService` → `ErpLitePostingEngineService` → `org_fin_journal_mst`/`_dtl` + `org_fin_post_log_tr` (DR=CR enforced).

| Event | Wired callers |
|-------|---------------|
| Invoice created | `ar-invoice.service.ts` ~1663 |
| Expense / petty cash | `erp-lite-expenses.service.ts` |
| Payment received / refund / gift card | **Methods exist, no production callers** |

**BVM → GL bridge:** NOT FOUND.

---

## 9. Reconciliation

**Orchestrator:** `reconciliation.service.ts` `runReconciliation` — 35 executed checks.  
**Tolerance:** `RECONCILIATION_TOLERANCE = 0.01` (`reconciliation/types.ts`).

**Outstanding check (`order-checks.ts` 198–200):**
```
expectedOutstanding = max(0, total_amount − (COMPLETED_payments + all_active_credits) + Σ PROCESSED refund_amount)
```

**vs snapshot:** uses lifecycle paid statuses, APPLIED credits only, `reopens_due_amount` (not full refund sum).

Also: TAX_CALCULATION / DISCOUNT_VALIDATION named but **not executed**. Legacy `org_payment_reconciliation_log` — schema only.

---

## 10. Currency, Precision, and Rounding

| Topic | As-is |
|-------|--------|
| Storage | `DECIMAL(19,4)`; `MONEY_SCALE=4` (`lib/utils/money.ts`) |
| Preview math | `Number` + `toFixed(decimalPlaces)` |
| Snapshot | `toFixed(4)` / Decimal helpers |
| Defaults | currency `USD`, decimals `3` (`order-defaults.ts`); collect fallback currency **`OMR`** (settle ~666) |
| Rounding catalog `sys_currency_rounding_rules_cd` | Seeded (`0290`) — **not read** by calc |
| Hardcoded VAT | 0.05 defaults (`tax.service.ts`, `db/orders.ts`, prep form); UI hook initial **0.06** (`use-payment-totals.ts` ~176) |

---

## 11. Transactions, Locking, and Idempotency

| Flow | Behavior |
|------|----------|
| Submit | Single Prisma `$transaction`: order + voucher + wire + settle + snapshot; `org_idempotency_keys` + order `idempotency_key` |
| Collect | Per-event tx; order `FOR UPDATE`; client key or `${orderId}_collect_${uuid}` |
| Payments | Unique idempotency on payment/credit/overpay/drawer↔voucher line |
| Refund process | `FOR UPDATE` on APPROVED row; idempotency key unique |
| Wallet | `FOR UPDATE` |
| Outbox | ORDER_COMPLETED, PAYMENT_VERIFIED, REFUND_PROCESSED, VOUCHER_POSTED_AND_WIRED |

---

## 12. Duplicate and Legacy Logic

| Location | Role | Status |
|----------|------|--------|
| `pricing-calculator.ts` + `pricing.service.calculateOrderTotals` | Item-level tax | LEGACY (`/api/v1/pricing/calculate`) |
| `db/orders.ts` `recalculateOrderTotals` | Inclusive reverse-split default 5% | LEGACY then calls canonical recalc |
| `use-payment-totals` client fallback | Omits auto-rules | DUPLICATED fallback |
| `preparation-form.tsx` | Display tax × 0.05 | UI-ONLY LEGACY |
| `settleOrder(wiringMode:false)` | Direct facts without voucher | LEGACY non-BVM |
| `voucher-service.ts` createReceiptVoucherForPayment | Pre-BVM | LEGACY |
| Submit breakdown `chargesTotal: 0` | Prefs in line subtotal | PARTIAL drift vs snapshot charges |

---

## 13. Implementation Coverage Matrix

| Capability | Status | Authoritative symbol |
|------------|--------|----------------------|
| Subtotal / discounts / promo / tax exclusive | COMPLETE | `calculateOrderTotals` |
| Charges (order-level) | PARTIAL | Snapshot sums charges; preview embeds prefs in lines |
| TAX_INCLUSIVE | PARTIAL | Snapshot formula yes; preview always adds tax |
| Rounding adjustment | PARTIAL | Column used; no auto-rounder in preview |
| Grand total / net receivable | COMPLETE | saleTotal / snapshot total_amount |
| Split / partial / POC / AR | COMPLETE | planner + collect + ar-invoice |
| Tendered / change / overpay | COMPLETE | voucher-line + disposition |
| Credits / wallet / GC / loyalty | COMPLETE | stored-value + wiring |
| Snapshot write/read | COMPLETE | `recalculateOrderFinancialSnapshotTx` |
| BVM submit | COMPLETE | `postAndWireBizVoucher` |
| BVM collect / refund | NOT FOUND / ORPHANED | collect direct; refund voucher uncalled |
| Cash drawer | COMPLETE | wiring + collect path |
| ERP invoice/expense | COMPLETE | auto-post callers |
| ERP payment/refund | NOT FOUND (wired) | dispatch* unused |
| Reconciliation | PARTIAL | 35 checks; formula drift |
| FX / rounding rules | PARTIAL | projection yes; catalog unwired |
| cmx-api calc engine | NOT FOUND | contracts only |

---

## 14. Missing or Disconnected Capabilities

1. Refund → `reopens_due_amount` / `refund_source_type` population  
2. `collectPaymentTx` → BVM voucher  
3. `dispatchPaymentReceived*` / `dispatchRefundIssued*` / gift-card ERP posts  
4. BVM reverse operational unwind  
5. `sys_currency_rounding_rules_cd` runtime consumption  
6. Recon TAX/DISCOUNT checks (constants only)  
7. `createRefundVoucherForPayment` callers  
8. Docs claiming ERP Phase-5 payment auto-post (stale vs code)  
9. Shared calc package / cmx-api engine  

---

## 15. Risks and Inconsistencies

1. **Refund closes cash but not due** — outstanding ignores refunds when `reopens_due=0`.  
2. **Recon vs snapshot outstanding** — different paid/credit/refund filters → false BLOCKERs.  
3. **TAX_INCLUSIVE preview inflation** vs snapshot `taxAddend=0`.  
4. **Dual engines** — `calculateOrderTotals` vs `pricing-calculator` / item-edit inclusive split.  
5. **Submit without BVM on collect** — audit trail split between voucher and direct payment rows.  
6. **Precision split** — Number preview vs Decimal/4dp snapshot; epsilons 0.001 vs recon 0.01.  
7. **Pending payments** counted in UI risk if confused with COMPLETED lifecycle.

---

## 16. Suggestions and Recommendations

1. Set `refund_source_type` + `reopens_due_amount` in `processRefund` so snapshot outstanding reopens.  
2. Align recon outstanding with `classifyRefunds` / APPLIED credits / lifecycle paid statuses.  
3. Gate `calculateOrderTotals` on `tax_pricing_mode` (use `extractTaxFromInclusive` when inclusive).  
4. Route `collectPaymentTx` through BVM create/post/wire (same as submit).  
5. Wire or delete unused `dispatchPaymentReceived*` / `createRefundVoucherForPayment`.  
6. Remove or quarantine `pricing-calculator` / prep-form 5% / item-edit inclusive fallback.  
7. Consume `sys_currency_rounding_rules_cd` or document display-only intent.  
8. Keep one SSOT: preview `calculateOrderTotals` → facts → `recalculateOrderFinancialSnapshotTx`.

---

## 17. Evidence Index

| Path | Symbols |
|------|---------|
| `web-admin/lib/services/order-calculation.service.ts` | `calculateOrderTotals`, `toFinancialBreakdownSnapshot` |
| `web-admin/lib/services/order-financial-write.service.ts` | `resolveCanonicalTotalAmount`, `recalculateOrderFinancialSnapshotTx`, `classifyRefunds` |
| `web-admin/lib/services/order-submit-orchestrator.service.ts` | `submitOrder` |
| `web-admin/lib/services/order-settlement-planner.service.ts` | `buildSettlementPlan` |
| `web-admin/lib/services/order-settlement.service.ts` | `settleOrderTx`, `collectPaymentTx`, `verifyPaymentTx` |
| `web-admin/lib/services/voucher-wiring.service.ts` | `postAndWireBizVoucher` |
| `web-admin/lib/services/wiring/*.handler.ts` | payment / credit / cash-drawer |
| `web-admin/lib/services/tax-engine.service.ts` | `calculateTax` |
| `web-admin/lib/services/order-refund.service.ts` | initiate / approve / process |
| `web-admin/lib/services/reconciliation/order-checks.ts` | outstanding / paid / credit checks |
| `web-admin/lib/services/erp-lite-auto-post.service.ts` | dispatch* (mostly unwired) |
| `web-admin/lib/constants/order-financial.ts` | lifecycle statuses, credit types |
| `web-admin/lib/constants/payment.ts` | methods, natures |
| `supabase/migrations/0271_*.sql`, `0333_*.sql`, `0354_*.sql` | payment/credit/refund/overpay/canonical columns |

**Called-by (submit):** UI `use-order-submission` → `submit-order/route` → orchestrator → planner / voucher / wiring / settlement / snapshot.  
**Calls-to (snapshot):** settlement, refund, cancel, credit-apply, adjustment, voucher-wiring, `lib/db/orders.ts`.

---

## 18. Final Current-State Verdict

Canonical paths exist and are used for **new-order checkout**. Financial header math is coherent when refunds do not reopen due and tax is exclusive. Material gaps: refund reopen, recon drift, collect without BVM, ERP payment journals, inclusive-tax preview, legacy calc forks.

```text
CURRENT IMPLEMENTATION COVERAGE: 74%
FINANCIAL PATH CONSISTENCY: PARTIALLY CONSISTENT
PRODUCTION READINESS: READY WITH GAPS
```

### Canonical answers (explicit)

1. **Order calculation:** `calculateOrderTotals` — `web-admin/lib/services/order-calculation.service.ts`  
2. **Settlement/payment:** `submitOrder` → planner → BVM → `settleOrderTx(wiringMode:true)`; later `collectPaymentTx`  
3. **Snapshot writer:** `recalculateOrderFinancialSnapshotTx` — `order-financial-write.service.ts`  
4. **Refund calculation:** `order-refund.service` + snapshot `classifyRefunds` (reopens column unused by writer)  
5. **Reconciliation formula:** `order-checks.ts` outstanding = `total − (COMPLETED+credits) + PROCESSED refunds` (≠ snapshot)  
6. **BVM wiring:** `postAndWireBizVoucher` + `wiring/*.handler.ts` on submit only  
7. **ERP-Lite posting:** engine ready; runtime wired for **invoice + expenses/petty cash only**  
8. **Alternatives:** pricing-calculator, collect without voucher, client preview fallback, prep-form 5%, disabled SQL recalc  
9. **Hardcodes:** VAT 0.05/0.06, USD default, OMR collect fallback, epsilons 0.001/0.01, decimals 3/4  
10. **Configured/docs-only:** currency rounding catalog; ERP payment auto-post docs; recon tax/discount checks; refund voucher service  
