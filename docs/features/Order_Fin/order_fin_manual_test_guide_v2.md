# Order Fin Manual Test Guide v2

**Date:** 2026-05-21  
**Purpose:** Manual QA for the newly added Order Fin features and Batch 0 hardening work.  
**Audience:** Product QA, finance QA, admin users, and developer-assisted UAT.

---

## Scope

This guide covers the current Order Fin additions that were recently implemented or hardened:

- Financial preview
- Order financial summary
- Collecting payment on existing orders
- Credit applications on existing orders
- Financial adjustments
- Refund lifecycle: initiate, approve, process
- Order-level reconciliation
- Payment status normalization and deferred collection behavior

This guide is intentionally focused on the new Order Fin surfaces, not the full platform.

---

## Recommended Test Order

Run the flows in this order:

1. Environment and access checks
2. Preview financials
3. Create order with deferred payment
4. Collect partial payment on existing order
5. Apply stored value / credit application
6. Create financial adjustment
7. View financial summary
8. Initiate standard refund
9. Approve refund
10. Process refund
11. Test manual-exception refund
12. Run order-level reconciliation
13. Run edge-case and regression checks

---

## Preconditions

- Dev app is running:
  - `cd web-admin`
  - `npm run dev`
- You are logged in to the tenant app as an authenticated user.
- At least one tenant, branch, customer, and product already exist.
- Payment methods are seeded and active for:
  - `CASH`
  - `CARD`
  - `PAY_ON_COLLECTION`
  - one stored-value-like method used by your tenant for wallet / credit / gift card
- The new migrations are already applied and types are regenerated.
- You have a finance-capable user with these permissions where applicable:
  - `orders:view_financial_breakdown`
  - `orders:collect_payment`
  - `orders:process_refund`
  - `orders:approve_refund`
  - `orders:apply_credit`
  - `orders:create_adjustment`
  - `reconciliation:view`
  - `reconciliation:run`
- For manual-exception refund testing, use a user with:
  - `orders:refunds_manual_exception`

---

## Suggested Test Data

Use simple repeatable values so mismatches are obvious.

### Customer

- Customer: `Test Order Fin Customer`
- Mobile: any valid test number

### Product

- Product A unit price: `100.00`
- Product B unit price: `50.00`

### Order scenario target

- 2 x Product A = `200.00`
- 1 x Product B = `50.00`
- Expected subtotal before tax/discount = `250.00`

If tax is enabled in your tenant, record the expected tax separately before starting.

---

## Test Setup Notes

### How to test APIs safely

For POST and PATCH routes, the easiest path is:

- stay logged in through the browser
- open DevTools on the tenant app
- use the app session and CSRF token pattern already used by the app

If your team already has a Postman collection or internal fetch helper for CSRF-protected routes, use that.  
If not, use the UI-first flows below and treat the API payloads in this guide as reference bodies.

### Capture these IDs during testing

Keep a scratch pad with:

- `orderId`
- `refundId`
- `cashDrawerSessionId` if cash collection requires it
- `paymentMethodId` for each method you use
- `creditReferenceId` if testing linked stored-value balance usage

---

## Flow 1 - Preview Financials

**Endpoint**

- `POST /api/v1/orders/preview-financials`

**Goal**

Verify the financial calculator returns the expected subtotal, charges, discounts, taxes, credits, and total before order creation.

**Test body example**

```json
{
  "branchId": "YOUR_BRANCH_ID",
  "customerId": "YOUR_CUSTOMER_ID",
  "isExpress": false,
  "percentDiscount": 10,
  "amountDiscount": 0,
  "items": [
    {
      "productId": "PRODUCT_A_ID",
      "quantity": 2
    },
    {
      "productId": "PRODUCT_B_ID",
      "quantity": 1
    }
  ]
}
```

**Expected**

- [ ] Response returns `success: true`
- [ ] Subtotal matches expected catalog math
- [ ] Discount is applied correctly
- [ ] Tax is calculated correctly for tenant tax rules
- [ ] Final total is correct
- [ ] No gift card value appears as a discount unless a real discount was used

**Negative checks**

- [ ] Invalid product or malformed body returns `400`
- [ ] Preview does not create any payment, refund, or financial fact rows

---

## Flow 2 - Create Order With Deferred Payment

**Goal**

Verify unpaid retail orders can be created with deferred collection behavior.

**UI path**

- `/dashboard/orders/new`

**Steps**

1. Create an order using the suggested test data.
2. Select deferred payment behavior using `PAY_ON_COLLECTION`.
3. Submit the order.

**Expected**

- [ ] Order is created successfully
- [ ] Order remains unpaid or partially paid based on actual tender entered
- [ ] Deferred remainder is visible in the order finance surface
- [ ] Payment status is normalized to the current Batch 0 contract, not legacy lowercase strings

**Capture**

- Save the created `orderId` for the next flows.

---

## Flow 3 - Collect Partial Payment On Existing Order

**Endpoint**

- `POST /api/v1/orders/[orderId]/payments`

**Goal**

Verify partial later collection works and no longer forces full settlement in one event.

**Test body example**

```json
{
  "paymentLegs": [
    {
      "paymentMethodId": "CASH_METHOD_ID",
      "amount": 80,
      "cashTendered": 100
    }
  ],
  "cashDrawerSessionId": "YOUR_OPEN_SESSION_ID"
}
```

**Expected**

- [ ] Response returns `201`
- [ ] Payment row is created
- [ ] Paid amount increases by the completed payment amount
- [ ] Outstanding amount decreases but remains above zero if not fully paid
- [ ] Order is not forced to fully paid unless total outstanding reaches zero
- [ ] Cash change logic does not inflate retained payment amount

**Repeat check**

Run a second partial collection:

```json
{
  "paymentLegs": [
    {
      "paymentMethodId": "CARD_METHOD_ID",
      "amount": 50,
      "reference": "TEST-CARD-001"
    }
  ]
}
```

**Expected**

- [ ] Second collection succeeds
- [ ] Order moves correctly from outstanding to paid only when fully covered

---

## Flow 4 - Apply Credit Application To Existing Order

**Endpoint**

- `POST /api/v1/orders/[orderId]/credit-applications`

**Goal**

Verify stored value is applied through credit applications, not discounts.

**Test body example**

```json
{
  "paymentMethodId": "WALLET_OR_GIFTCARD_METHOD_ID",
  "amount": 30,
  "reference": "TEST-CREDIT-001"
}
```

If your tenant uses a linked balance source:

```json
{
  "paymentMethodId": "WALLET_OR_GIFTCARD_METHOD_ID",
  "amount": 30,
  "creditReferenceId": "SOURCE_LEDGER_OR_BALANCE_ID",
  "reference": "TEST-CREDIT-002"
}
```

**Expected**

- [ ] Response returns `201`
- [ ] Credit application row is created
- [ ] `total_credit_applied_amount` increases
- [ ] Outstanding amount decreases
- [ ] Financial summary shows credit application separately from discounts
- [ ] Gift card or wallet value does not appear in discount lines

**Negative checks**

- [ ] Applying more than available stored value fails
- [ ] Invalid credit reference fails safely

---

## Flow 5 - Create Financial Adjustment

**Endpoint**

- `POST /api/v1/orders/[orderId]/adjustments`

**Goal**

Verify controlled manual financial corrections can be recorded with audit-friendly structure.

**Test body example**

```json
{
  "adjustmentType": "MANUAL_CORRECTION",
  "amount": 5,
  "currencyCode": "OMR",
  "reason": "QA test adjustment",
  "autoApprove": true
}
```

**Expected**

- [ ] Response returns `201`
- [ ] Adjustment row is created
- [ ] Financial summary reflects the adjustment
- [ ] Adjustment is separate from payment, refund, and discount sections
- [ ] Reconciliation can see the adjustment impact

**Negative checks**

- [ ] `amount = 0` returns validation error
- [ ] Missing reason returns validation error

---

## Flow 6 - Review Financial Summary

**Endpoint**

- `GET /api/v1/orders/[orderId]/financial-summary`

**Goal**

Verify the order-level financial read model includes the new sections.

**Expected**

- [ ] Response returns `success: true`
- [ ] Summary includes snapshot
- [ ] Charges section is present
- [ ] Discounts section is present
- [ ] Taxes section is present
- [ ] Payments section is present
- [ ] Credit applications section is present
- [ ] Refunds section is present
- [ ] Adjustments section is present
- [ ] Voucher references section is present if applicable
- [ ] Audit timeline section is present if data exists

**Cross-check**

Verify these values match the steps already executed:

- [ ] Subtotal
- [ ] Discount amount
- [ ] Tax amount
- [ ] Total paid amount
- [ ] Total credit applied amount
- [ ] Outstanding amount
- [ ] Payment status

---

## Flow 7 - Initiate Standard Refund

**Endpoint**

- `POST /api/v1/orders/[id]/refunds`

**Goal**

Verify standard refund initiation works with lineage-aware fields.

**Test body example**

```json
{
  "amount": 20,
  "reason": "OVERCHARGE",
  "method": "CASH",
  "currencyCode": "OMR",
  "notes": "QA standard refund",
  "approvalRequired": true
}
```

If you already have a known payment row, use:

```json
{
  "amount": 20,
  "reason": "OVERCHARGE",
  "method": "ORIGINAL_METHOD",
  "currencyCode": "OMR",
  "originalPaymentId": "PAYMENT_ROW_ID",
  "approvalRequired": true
}
```

**Expected**

- [ ] Response returns `201`
- [ ] Refund row is created
- [ ] Refund appears in `GET /api/v1/orders/[id]/refunds`
- [ ] Refund status starts in the correct pre-processing state
- [ ] Refund does not exceed refundable amount

**Capture**

- Save the returned `refundId`.

---

## Flow 8 - Approve Refund

**Endpoint**

- `PATCH /api/v1/orders/refunds/[refundId]/approve`

**Goal**

Verify approval-only permission and lifecycle transition.

**Expected**

- [ ] Response returns `success: true`
- [ ] Refund status changes to approved
- [ ] Approval fails for users without `orders:approve_refund`
- [ ] Duplicate or invalid approval transitions fail safely

---

## Flow 9 - Process Refund

**Endpoint**

- `PATCH /api/v1/orders/refunds/[refundId]/process`

**Goal**

Verify the final refund stage updates financial state correctly.

**Expected**

- [ ] Response returns `success: true`
- [ ] Refund status changes to processed
- [ ] Refunded amount is reflected in financial summary
- [ ] Outstanding / payment snapshot updates correctly
- [ ] Reprocessing the same refund is blocked or safely idempotent

---

## Flow 10 - Manual-Exception Refund

**Endpoint**

- `POST /api/v1/orders/[id]/refunds`

**Goal**

Verify the guarded manual-exception path works only for authorized users.

**Test body example**

```json
{
  "amount": 10,
  "reason": "OTHER",
  "method": "WALLET",
  "currencyCode": "OMR",
  "notes": "QA manual exception refund",
  "refundScope": "MANUAL_EXCEPTION",
  "approvalRequired": true
}
```

**Expected with authorized user**

- [ ] Refund is created successfully
- [ ] Special permission `orders:refunds_manual_exception` is honored
- [ ] Refund can continue through approval and processing if workflow requires it

**Expected with unauthorized user**

- [ ] API returns `403`

**Business-rule checks**

- [ ] Manual exception is rejected if valid lineage should have been used instead
- [ ] Reason is mandatory

---

## Flow 11 - Order-Level Reconciliation

**Endpoints**

- `POST /api/v1/orders/[orderId]/financial-reconcile`
- `GET /api/v1/orders/[orderId]/financial-reconciliation`

**Goal**

Verify the order-scoped reconciliation view works after multiple financial mutations.

**Expected**

- [ ] POST returns a live reconciliation result with `checkedAt`
- [ ] GET returns the current reconciliation view
- [ ] Reconciliation reflects payments, credits, refunds, and adjustments
- [ ] No false mismatch is reported for a valid order

**Useful scenario**

Run reconciliation after:

- deferred order creation
- two partial payments
- one credit application
- one adjustment
- one refund

That gives the richest possible verification path.

---

## Flow 12 - UI Verification

### Order financial tab

Open:

- `/dashboard/orders/[id]/full`

Verify:

- [ ] Summary cards render
- [ ] Charges section renders
- [ ] Discounts section renders
- [ ] Taxes section renders
- [ ] Payments section renders
- [ ] Credit applications section renders
- [ ] Refunds section renders
- [ ] Adjustments section renders
- [ ] Values match the API summary

### Existing order payment collection

If your UI exposes collection actions:

- [ ] Collect payment action works for partially outstanding orders
- [ ] UI does not force full payment only
- [ ] Result is reflected immediately on refresh

### Refunds UI

If your UI exposes refund actions:

- [ ] Initiate refund works
- [ ] Approve refund works with the correct role
- [ ] Process refund works with the correct role

---

## Edge Cases

Run these after the happy paths.

### Payment and status

- [ ] Partial payment leaves order partially paid, not fully paid
- [ ] Full final payment moves order to paid
- [ ] No new write stores legacy lowercase payment status values

### Credits

- [ ] Gift card application appears under credits, not discounts
- [ ] Credit application larger than remaining outstanding is rejected or safely capped per business rule

### Refunds

- [ ] Refund amount greater than refundable balance is rejected
- [ ] Approving an already approved refund fails safely
- [ ] Processing an unapproved refund fails if approval is required

### Adjustments

- [ ] Negative adjustment works if your tenant allows it
- [ ] Adjustment reason is always stored

### Reconciliation

- [ ] Clean order returns no blocker-level mismatch
- [ ] Intentionally inconsistent order, if created in lower environments, is flagged

---

## Pass / Fail Checklist

Mark the release ready only if all are true:

- [ ] Financial preview is correct
- [ ] Deferred orders can be created
- [ ] Partial later collection works
- [ ] Credit applications work and stay separate from discounts
- [ ] Adjustments can be created
- [ ] Financial summary includes all expected sections
- [ ] Refund lifecycle completes successfully
- [ ] Manual-exception refund permission is enforced
- [ ] Reconciliation works for order-level checks
- [ ] UI reflects the same values as the API
- [ ] No blocking validation, permission, or status-regression issue is found

---

## Defect Log Template

Use this for every issue found.

```text
Title:
Environment:
User / Role:
Order ID:
Route / Screen:
Request body:
Actual result:
Expected result:
Screenshot / JSON:
Severity:
Notes:
```

---

## Notes For This Release

- This guide assumes voucher integration is link-ready only and not fully posted through Order Fin.
- The strongest single regression detector is:
  - create deferred order
  - collect two partial payments
  - apply one credit
  - add one adjustment
  - initiate, approve, process one refund
  - check summary and reconciliation

If that end-to-end chain passes cleanly, the core Order Fin Batch 0 additions are in strong shape.
