# Order Financial Platform — Manual Test Guide

## Prerequisites
- Dev server running: `cd web-admin && npm run dev`
- At least one tenant, branch, and customer seeded
- At least one product in the catalog

---

## 1. Payment Configuration `/dashboard/settings/payments`

**Methods tab**
- [ ] All seeded payment methods appear (CASH, CARD, CHECK, PAY_ON_COLLECTION, etc.)
- [ ] Toggle a method on/off — page reflects change after reload
- [ ] Edit display name (EN + AR)

**Cash Drawers tab**
- [ ] At least one cash drawer appears from seed data
- [ ] Add a new drawer â†’ appears in list

**Terminals tab**
- [ ] Terminal list loads without error

**Branch Overrides tab**
- [ ] Branch-level overrides render without crashing

---

## 2. Tax Setup `/dashboard/settings/tax`

- [ ] Tax profile list loads
- [ ] Create a new tax profile: name, VAT rate (e.g. 15%), type = VAT â†’ saves
- [ ] Set it as the default â†’ saved flag reflected in list
- [ ] Add a tax exemption for a customer category â†’ saves

---

## 3. Cash Drawer Lifecycle `/dashboard/internal_fin/cash-drawers`

- [ ] List page loads all drawers
- [ ] Open a session: click drawer â†’ Open Session â†’ enter opening float (e.g. 500)
- [ ] Session status changes to OPEN
- [ ] Add a cash movement: type = CASH_IN, amount = 100, notes = "test deposit"
- [ ] Movement appears in session detail
- [ ] Close session: enter closing float â†’ session status â†’ CLOSED
- [ ] Print session report — print page renders with movements + totals

---

## 4. Create Order with Multi-Leg Payment (core flow)

Go to **New Order** for an existing customer:

**Single CASH payment:**
- [ ] Add items â†’ payment modal shows correct subtotal + VAT
- [ ] Select CASH, enter amount â†’ order created successfully
- [ ] Navigate to `billing/payments/[id]/print/receipt-voucher` â†’ receipt renders with tax breakdown

**Split payment (CASH + CARD):**
- [ ] Add items â†’ in payment modal, split into two legs: CASH 50 + CARD 50 (or whatever total is)
- [ ] Both legs submitted â†’ order created, no errors

**PAY_ON_COLLECTION:**
- [ ] Select PAY_ON_COLLECTION â†’ order created with status `PENDING_COLLECTION`
- [ ] Go to order detail â†’ Collect Payment â†’ enter CASH amount â†’ payment recorded

---

## 5. Promotions `/dashboard/marketing/promotions`

- [ ] List loads
- [ ] Create a promotion: type = PERCENTAGE, value = 10%, code = TEST10 â†’ saves
- [ ] Go to New Order â†’ enter promo code TEST10 â†’ discount applied in preview
- [ ] Order created with discount recorded

---

## 6. Loyalty `/dashboard/marketing/loyalty`

- [ ] Config page loads showing loyalty program
- [ ] Tier list visible with earn/redeem rates
- [ ] After creating a paid order â†’ check customer record for loyalty points earned (async via outbox — may need a moment)

---

## 7. Stored Value `/dashboard/customers/stored-value`

- [ ] Hub page lists customers with wallet balances
- [ ] Select a customer â†’ Stored Value tab â†’ wallet balance shows
- [ ] Top-up wallet: enter 200 â†’ balance updates
- [ ] Create new order â†’ apply wallet credit in payment modal â†’ deducted correctly from wallet

---

## 8. Refunds `/dashboard/internal_fin/refunds`

- [ ] Refunds list page loads
- [ ] On a completed paid order â†’ initiate refund: select method (CASH), amount â‰¤ paid amount
- [ ] Refund appears in list with status PENDING
- [ ] Approve refund â†’ status â†’ APPROVED
- [ ] Process refund â†’ status â†’ PROCESSED

---

## 9. Reconciliation `/dashboard/internal_fin/reconciliation`

- [ ] List page loads (may be empty if no run triggered)
- [ ] Trigger a reconciliation run via API: `POST /api/v1/finance/reconciliation/runs` with body `{ "runDate": "today's date" }`
- [ ] Run appears in list
- [ ] Click run â†’ detail page shows issues (BLOCKER / WARNING / INFO) or "no issues"
- [ ] Export CSV button â†’ downloads file with correct columns

---

## 10. Financial Reports `/dashboard/reports/financial`

- [ ] Orders tab: table loads with order financial data
- [ ] Payments tab: payment ledger loads
- [ ] Tax tab: VAT breakdown per period loads
- [ ] Export CSV on any tab â†’ file downloads correctly

---

## 11. Order Financial Tab

- [ ] Open any completed order â†’ `orders/[id]/full` page
- [ ] Financial tab visible â†’ shows charges, taxes, discounts, payment legs breakdown
- [ ] Numbers match what was entered at order creation

---

## Quick Sanity Checks

| Check | Expected |
|---|---|
| Create order with gift card | Gift card balance deducted, `giftCardApplied` shows in receipt |
| Create order with manual % discount | Discount row in financial tab |
| Cash drawer required method without open session | Error: "No open cash drawer session" |
| Promo code used twice by same customer (if limit=1) | Second use rejected |

---

## v1.1 Full Alignment — QA Cases (Phases 1–9)

> Added: 2026-06-05 | Migrations applied: 0336–0341

### Phase 1 — Tax-document mismatch warning

- [ ] Create an order, issue an AR invoice, partially pay it → **no false tax-doc mismatch warning** appears in the financial debug panel
- [ ] Create a CREDIT_INVOICE order with tax document → financial mismatch warning correctly fires only when the document total truly differs from the fiscal sale total

### Phase 2 — Tax-base decomposition

- [ ] Submit an order with taxable + non-taxable items → Order Financial tab shows **Tax base decomposition** section under the tax row with correct bucket values
- [ ] Verify `taxable_amount` + `non_taxable_amount` + `exempt_amount` + `zero_rated_amount` + `out_of_scope_amount` = subtotal
- [ ] When all items are taxable, non-taxable/exempt/zero-rated/out-of-scope rows are hidden (UI shows only taxable row)

### Phase 3 — Credit-application lifecycle

- [ ] Apply a stored-value credit to an order → credit-app row in Financial tab shows `application_status = APPLIED`
- [ ] Trigger a failed credit application → status shows `FAILED` (amber badge)
- [ ] Settlement summary shows **Pending credit applications** and **Failed credit applications** rows (hidden when 0)

### Phase 4 — Base-currency snapshot

- [ ] Create an order in a non-base currency (e.g. AED when base is SAR) → **Base currency** secondary section appears below the 4 KPI cards with 6 converted amounts
- [ ] Verify `base_cur_total_amount = total_amount × currency_ex_rate`
- [ ] Orders in base currency show no secondary base-currency section

### Phase 5 — Tax-inclusive pricing

- [ ] With `FF_TAX_INCLUSIVE_PRICING` enabled and branch set to `TAX_INCLUSIVE`: order total includes tax, not adds it
- [ ] Financial debug panel shows `taxPricingModeAtCalculation = TAX_INCLUSIVE`
- [ ] TAX_EXCLUSIVE orders unaffected — regression: verify `total_amount = subtotal + tax + rounding` for all existing-flow orders

### Phase 6 — Refund source-lineage

- [ ] Issue a cash refund → refund row in Financial tab shows **Source type = Real payment refund**
- [ ] Restore a gift card balance → source type = **Gift card restore**
- [ ] Refund with `reopens_due_amount > 0` → **Reopens balance** column in refund table shows correct amount
- [ ] `MANUAL_EXCEPTION` refund requires elevated permission + reason field (validation blocks empty reason)

### Phase 7 — Tax-document lifecycle

- [ ] Create an order → tax document auto-created in DRAFT state per trigger config
- [ ] Confirm payment → tax document transitions to ISSUED; document number assigned
- [ ] Tax document panel shows status badge (ISSUED = green), fiscal year/sequence, amounts, issued-at
- [ ] Cancel an ISSUED document → status = CANCELLED; cancellation reason required
- [ ] Issue a credit note for a cancelled invoice → credit note appears with `supersedesId` reference
- [ ] Attempt to edit an ISSUED tax document record directly in DB → DB trigger rejects mutation

### Phase 8 — UI consolidation

- [ ] Open an order with all Phase 2–7 data → all panels render without blank/undefined values
- [ ] RTL (Arabic locale): all panels flip correctly, badges readable, amounts aligned right
- [ ] Debug panel shows `taxPricingModeAtCalculation` and `currencyExRate` fields

### Phase 9 — Legacy CI gate

```bash
cd web-admin
npm run check:legacy
# Expected: "Legacy column check passed: no dropped org_orders_mst columns found in source."
# Exit code: 0
```

---

**Start with flows 1 â†’ 2 â†’ 3 â†’ 4** in that order — each depends on the previous being configured. The rest can be tested in any order.
