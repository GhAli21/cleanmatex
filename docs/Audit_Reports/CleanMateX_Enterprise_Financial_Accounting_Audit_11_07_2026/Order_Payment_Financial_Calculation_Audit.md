# Order Payment Financial Calculation Audit

**Date:** 11-07-2026 · **Scope:** Order money math, settlement, credits, refunds, vouchers/GL · **Method:** Code inspection only (no code changes)

## Architecture (authoritative path)

```
UI → preview-payment/submit-order
  → order-calculation.service (preview/submit totals)
  → order-submit-orchestrator + BVM voucher → wiring handlers
  → settleOrderTx / collectPaymentTx
  → recalculateOrderFinancialSnapshotTx (org_orders_mst)
  → receipts/reports via order-financial-summary + effective-snapshot fallback
```

Canonical settlement math: `web-admin/lib/services/order-financial-write.service.ts`  
Canonical commercial totals (new order): `web-admin/lib/services/order-calculation.service.ts`  
`cmx-api`: DTO contracts only — no calculation engine.

## Invariant validation (from implementation)

| Invariant | Status | Implementation |
|-----------|--------|----------------|
| `subtotal ≈ Σ item bases (+ item prefs)` | PASS (preview) | `calculateOrderTotals` item loop |
| Order-level charges in grand total | PASS (snapshot) | `items + charges − discounts + taxAddend + rounding` |
| `taxable ≈ taxes.taxable_amount` else net before tax | PASS | write service ~687–688 |
| `grand_total` tax-exclusive | PASS | `afterDiscounts + tax` / snapshot tax addend |
| `grand_total` tax-inclusive | FAIL | Preview always adds tax; snapshot omits tax addend only |
| `settlement_due = grand − credits` | PASS (conceptual) | No `settlement_due` column; due = `total_amount`; credits separate |
| `outstanding = total − paid − credits + reopens` | PASS (formula) | write ~779–786 |
| `net payments = captured − refunds` | PARTIAL | `netCollectedAmount` computed; **outstanding uses gross `totalPaidAmount`**, not net |
| Cash change = tendered − applied | PASS | settle/collect/voucher-line CASH legs |
| `paid + credits + AR/POC + outstanding ≈ payable` | PASS when reopens correct | POC/AR = outstanding when settlement type matches |
| GL vouchers DR = CR | PASS when posted | ERP-Lite engine + DB `chk_ofj_bal_post` |
| BVM “vouchers” balanced DR/CR | N/A | Operational IN/OUT lines, not double-entry |

---

## Findings

### F1 — CRITICAL: Real refunds do not reopen outstanding

**Evidence:** `order-refund.service.ts` `initiateRefund` create (~311–335) and `processRefund` update (~491–502) never set `refund_source_type` or `reopens_due_amount`. Snapshot outstanding (~779–786) only adds `refundReopensDueAmount` from those columns (default 0).

**Scenario:** Order total 10.000, paid cash 10.000 → PAID. Process cash refund 10.000 → payment row still COMPLETED; outstanding stays 0; header can remain PAID while cash left the till.

**Expected:** Real-money refund sets `refund_source_type=REAL_PAYMENT_REFUND` and `reopens_due_amount` (full or partial) so `outstanding` and `payment_status` reopen; or reduce effective paid for due calculation.

**Fix:** Set lineage + `reopens_due_amount` on initiate/process; align UI/status with `netCollectedAmount`.

### F2 — CRITICAL: Reconciliation outstanding ≠ snapshot outstanding

**Evidence:** `reconciliation/order-checks.ts` ~198–200:  
`expectedOutstanding = total − (paid+credit) + Σ PROCESSED refund_amount`  
Snapshot: `total − paid − credit + reopens_due` only.

**Scenario:** Wallet restore refund (reopens=0) → recon BLOCKER false positive; cash refund with reopens=0 → snapshot “correct” per bug F1 while recon expects reopen → noisy/contradictory controls.

**Fix:** Recon must mirror `classifyRefunds` / `reopens_due_amount` semantics.

### F3 — HIGH: TAX_INCLUSIVE preview/submit double-count risk

**Evidence:** `calculateOrderTotals` always `afterDiscounts + vatValue + additionalTax` (~309–311). `extractTaxFromInclusive` exists (~273–282) but is unused. Snapshot `resolveCanonicalTotalAmount` sets `taxAddend=0` for TAX_INCLUSIVE (~313). Feature flag `tax_inclusive_pricing` exists.

**Scenario:** Enable inclusive mode → preview/submit inflate totals vs snapshot after recalc.

**Fix:** Wire inclusive extraction in calculator + tax line write; keep one mode authority.

### F4 — HIGH: Item-edit path assumes tax-inclusive line prices

**Evidence:** `db/orders.ts` `recalculateOrderTotals` (~910–920): `subtotal = total / (1+vatRate)` treating `item.total_price` as inclusive. Submit path treats catalog `basePrice` as exclusive.

**Scenario:** Edit items on exclusive-priced order → wrong subtotal/tax before snapshot; drift vs charges/discounts detail.

**Fix:** Branch on `tax_pricing_mode`; stop hardcoding inclusive reverse-split.

### F5 — HIGH: BVM voucher reverse does not unwind operational money

**Evidence:** `voucher-reversal.service.ts` mirror lines `wiring_status: 'NOT_WIRED'` (~130). No reverse of `org_order_payments_dtl`, stored-value, cash drawer.

**Scenario:** Reverse posted payment voucher → GL/BVM shows OUT, order still shows paid / wallet still debited.

**Fix:** Require cancel unwind / reverse-wiring handlers before marking voucher REVERSED for order-linked vouchers.

### F6 — HIGH: Order checkout does not auto-post ERP-Lite payment journals

**Evidence:** `ErpLiteAutoPostService.dispatchPaymentReceived*` exists; **not** called from `order-submit-orchestrator` / settlement. AR invoice path posts; expenses post. Order cash/card BVM posts operationally only.

**Scenario:** Period GL cash/AR ≠ POS collections; IFRS/ERP trial balance incomplete for retail settlement.

**Fix:** Dispatch payment (and refund) GL events in same transaction as wire+snapshot, with idempotency.

### F7 — MEDIUM: Recon payment/credit filters diverge from snapshot

**Evidence:** Recon paid sum filters `payment_status === 'COMPLETED'` only (~158–159); snapshot includes `CAPTURED`/`SETTLED` (`ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED`). Credit agg uses all `is_active` rows (~140–143); snapshot counts `APPLIED` only (~700–726).

**Fix:** Align status sets and `application_status` filters.

### F8 — MEDIUM: Duplicate/legacy UI tax math (wrong rate)

**Evidence:** `useOrderState.ts` hardcoded `0.05`; `use-payment-totals.ts` init `0.06` then error fallback `0.05`; `preparation` preview API defaults `0.05`. Server preview is authoritative when available.

**Scenario:** Offline/fallback UI shows wrong VAT vs tenant profiles.

### F9 — MEDIUM: Precision — preview JS `toFixed` vs Decimal(19,4) / `money.ts`

**Evidence:** Preview/tax-engine use number+`toFixed`; settlement/snapshot prefer Decimal helpers / 4 dp. Currency rounding rules seeded (`0290`) not applied in order calc.

**Scenario:** 3-dp currencies + compound tax → 0.001 tolerance masks drift; cash drawer vs header mismatch edge cases.

### F10 — MEDIUM: Processed cash/original refunds lack REFUND_VOUCHER

**Evidence:** `processRefund` comment (~488–489): no BVM refund voucher for CASH/ORIGINAL_METHOD. Recon AR refund-link expects posted `REFUND_VOUCHER`.

**Scenario:** Cash refunds invisible to voucher audit trail.

### F11 — LOW: FX base snapshot zeros on bad rate; collection adapter hardcodes `OMR`

**Evidence:** `projectBaseCurrencyAmount` → 0 if rate invalid; `collection-overpayment.ts` currency `'OMR'`.

---

## Calculation matrix

| Case | Expected | Actual risk |
|------|----------|-------------|
| Normal exclusive + VAT | net + tax = total; paid clears outstanding | OK on canonical path |
| Zero total | unpaid/paid edge | OK if no phantom legs |
| Partial / POC | outstanding = remainder; POC amount = outstanding | OK |
| Split cash+card | Σ legs; deferred alone | Validated in orchestrator |
| Overpay + change | change = tendered−applied; excess disposition | OK if disposition required |
| Overpay → wallet/advance | liability issue, not revenue | OK via disposition service |
| Stored-value redeem | credit apps, not paid | OK (ADR-009) |
| Tax inclusive flag on | extract tax; no double add | **FAIL F3** |
| Rounding adj | included in total | OK at snapshot |
| Refund real cash | reopen due / reduce net paid | **FAIL F1** |
| Refund wallet restore | restore liability; usually no reopen | OK if reopens=0; recon **FAIL F2** |
| Cancel unwind | reverse credits + payment disposition | Stronger than voucher reverse |
| Concurrent retry | idempotency keys + FOR UPDATE | Generally OK |
| CAPTURED payment | counts as paid | Snapshot OK; recon **F7** |

---

## Targeted tests (add / extend)

**Unit**
1. `classifyRefunds` + outstanding: PROCESSED cash refund with/without `reopens_due_amount`.
2. `resolveCanonicalTotalAmount` TAX_INCLUSIVE vs EXCLUSIVE with same tax rows.
3. `calculateOrderTotals` must call inclusive extraction when mode=INCLUSIVE.
4. Recon helpers: expected outstanding === write-service formula.
5. Payment status set: CAPTURED/SETTLED parity with snapshot.

**Integration / DB**
6. Submit paid → processRefund CASH → assert `outstanding`/`payment_status`/`reopens_due`.
7. Split + gift card: `total_paid` vs `total_credit_applied`; tax base unchanged by gift card.
8. Concurrent `collectPaymentTx` same order: single applied sum, no double credit.
9. `reverseBizVoucher` on wired order payment: must fail or unwind facts (policy test).
10. Item edit exclusive order: totals match `recalculateOrderFinancialSnapshotTx`.

**Playwright**
11. Checkout: exclusive VAT, pay cash with tendered>due → change + PAID.
12. Partial POC → later collect remainder → PAID.
13. Apply wallet+card split → receipt shows credit vs paid separately.
14. Refund full cash after PAID → UI outstanding/status reflects reopen.
15. Enable tax-inclusive (flag) → cart total equals receipt total (no double VAT).

---

## Strengths (keep)

- Clear REAL_PAYMENT vs CREDIT_APPLICATION separation and lock order for stored value.
- Single snapshot writer + financial hash/engine version.
- Submit idempotency, payment verify FOR UPDATE, gift/wallet redeem idempotency.
- Overpayment disposition catalog (change / advance / wallet / credit note).
- ERP-Lite journal balance enforcement when auto-post runs.

---

## Verdict

```text
FAIL — FINANCIAL RISK
```

Primary blockers: **F1** (refunds do not reopen due / leave PAID after cash-out) and **F2** (reconciliation cannot reliably detect F1). Close **F3–F5** before enabling tax-inclusive or relying on voucher reverse as a money void.
