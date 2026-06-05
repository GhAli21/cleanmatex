Below is the **full, non-simplified Financial Summary layout** for the Order Details page.

This version shows everything clearly:

```text
Order value
Discounts / promotions
Taxes
Completed payments
Pending payments
Credit applications
Refunds
Outstanding / overpaid
Pay-on-collection
AR receivable
Tax document
Reconciliation warnings
```

---

# Full Financial Summary — Non-Simplified Layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ FINANCIAL SUMMARY                                                                            │
├──────────────────┬──────────────────┬────────────────────┬──────────────────┬───────────────┤
│ Order Total      │ Paid             │ Pending Payments   │ Credits Applied  │ Balance Due   │
│ 2.140 OMR        │ 1.000 OMR        │ 0.000 OMR          │ 0.150 OMR        │ 0.990 OMR     │
│ Sale value       │ Completed money  │ Not confirmed yet  │ Stored value     │ Still due     │
└──────────────────┴──────────────────┴────────────────────┴──────────────────┴───────────────┘
```

Optional sixth card if refund exists:

```text
┌────────────────────┐
│ Refunded           │
│ 0.000 OMR          │
│ Completed refunds  │
└────────────────────┘
```

---

# 1. Order Value

This section explains **how the sale total was calculated**.

It must not include payments, gift cards, wallet, customer advance, credit notes, or customer credit.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ORDER VALUE                                                                                  │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Base Services / Items                                                        │ 2.000 OMR     │
│ Item / Piece Extras                                                          │ 0.000 OMR     │
│ Preference Extras                                                            │ 0.000 OMR     │
│ Service Charge                                                               │ 0.000 OMR     │
│ Delivery Charge                                                              │ 0.000 OMR     │
│ Express Charge                                                               │ 0.000 OMR     │
│ Other Charges                                                                │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Gross Amount                                                                 │ 2.000 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

## 1.1 Extra charges details

If item/piece/preference extras are currently included inside `items_base_amount`, show them as included breakdowns:

```text
Item / Piece Extras                                                           0.000 OMR
  └─ Included in base services / item line total

Preference Extras                                                             0.000 OMR
  └─ Included in base services / item line total
```

If later they become separate charge rows:

```text
Item / Piece Extras                                                          +0.150 OMR
Preference Extras                                                            +0.050 OMR
```

---

# 2. Discounts / Promotions

This section explains all **commercial price reductions**.

These reduce sale value and may affect taxable amount depending tax policy.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ DISCOUNTS / PROMOTIONS                                                                        │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Line Discount                                                               │ -0.000 OMR    │
│ Manual Discount                                                             │ -0.000 OMR    │
│ Promo Code Discount                                                         │ -0.000 OMR    │
│ Coupon Discount                                                             │ -0.000 OMR    │
│ Campaign / Rule Discount                                                    │ -0.000 OMR    │
│ Loyalty Discount                                                            │ -0.000 OMR    │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Total Commercial Discounts                                                  │ -0.000 OMR    │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

Expandable example:

```text
Promo Code Discount                                                          -0.100 OMR
  └─ Code: SAVE10
  └─ Rule: 10% discount
  └─ Approved By: System

Manual Discount                                                              -0.050 OMR
  └─ Reason: Customer goodwill
  └─ Approved By: Manager
```

## Important rule

These are discounts:

```text
Manual discount
Promo code discount
Coupon discount
Campaign/rule discount
Line discount
Commercial loyalty discount
```

These are **not** discounts:

```text
Gift card
Wallet
Customer advance
Credit note
Customer credit
Stored loyalty value
```

Those belong in **Settlement / Credits Applied**.

---

# 3. Tax Calculation

This section explains the tax base and tax components.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ TAX CALCULATION                                                                               │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Net Before Tax                                                              │ 2.000 OMR     │
│ Taxable Amount                                                              │ 2.000 OMR     │
│ Non-Taxable / Exempt Amount                                                 │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ VAT 5%                                                                      │ 0.100 OMR     │
│ Municipal Fee / Other Tax                                                   │ 0.040 OMR     │
│ Other Tax                                                                   │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Total Tax                                                                   │ 0.140 OMR     │
│ Rounding Adjustment                                                         │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Order Total                                                                 │ 2.140 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

## Tax rule

Gift card and stored-value credits must not reduce:

```text
Taxable Amount
Total Tax
Order Total
Tax Document Total
```

They only reduce the **outstanding balance**.

---

# 4. Settlement

This section explains how the order is paid, credited, pending, or still due.

---

## 4.1 Completed Real Payments

Only completed/confirmed real payments are shown here.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ SETTLEMENT — COMPLETED REAL PAYMENTS                                                          │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Cash                                                                         │ 1.000 OMR     │
│ Card                                                                         │ 0.000 OMR     │
│ Mobile Payment                                                               │ 0.000 OMR     │
│ Bank Transfer                                                                │ 0.000 OMR     │
│ Check                                                                        │ 0.000 OMR     │
│ Gateway Payment                                                              │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Total Completed Payments                                                     │ 1.000 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

Detailed table:

```text
Method           Amount       Status       Voucher       Reference       Date
Cash             1.000        Completed    RV-000123     —               2026-05-29
Gateway          0.000        —            —             —               —
```

---

## 4.2 Pending Payment Attempts

Pending/processing/authorized payments are visible, but **not counted as paid**.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ SETTLEMENT — PENDING PAYMENT ATTEMPTS                                                         │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Gateway Pending                                                             │ 0.000 OMR     │
│ Gateway Processing                                                          │ 0.000 OMR     │
│ Authorized Card                                                             │ 0.000 OMR     │
│ Pending Bank Transfer                                                       │ 0.000 OMR     │
│ Pending Check                                                               │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Total Pending Payments                                                       │ 0.000 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

Detailed table:

```text
Method           Amount       Status       Voucher       Gateway Ref       Expires At
Gateway          1.000        Processing   RV-000124     PGW-77882         2026-05-29 10:30
```

## Pending payment rule

```text
Pending payments do not reduce outstanding_amount.
```

Formula remains:

```text
Outstanding = Order Total - Completed Payments - Applied Credits
```

Optional display-only field:

```text
Expected Balance If Pending Confirms =
  Outstanding - Pending Payment Amount
```

---

## 4.3 Failed / Refused / Cancelled Payment Attempts

These are audit/history only.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ SETTLEMENT — FAILED / CANCELLED PAYMENT ATTEMPTS                                              │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Failed Gateway Payments                                                     │ 0.000 OMR     │
│ Refused Card Payments                                                       │ 0.000 OMR     │
│ Cancelled Payment Attempts                                                  │ 0.000 OMR     │
│ Expired Payment Attempts                                                    │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Total Failed / Cancelled Attempts                                            │ 0.000 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

Rule:

```text
Failed/refused/cancelled payments do not reduce outstanding.
```

---

# 5. Credits / Stored Value Applied

This section shows stored-value or customer-credit settlement.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREDITS / STORED VALUE APPLIED                                                                │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Gift Card ****4335                                                        │ -0.150 OMR    │
│ Wallet                                                                     │ -0.000 OMR    │
│ Customer Advance                                                           │ -0.000 OMR    │
│ Credit Note                                                                │ -0.000 OMR    │
│ Customer Credit                                                            │ -0.000 OMR    │
│ Loyalty Value                                                              │ -0.000 OMR    │
│ Manual Credit                                                              │ -0.000 OMR    │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Total Credits Applied                                                       │ 0.150 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

Detailed table:

```text
Credit Type       Source         Amount       Status       Voucher       Reference
Gift Card         ****4335       0.150        Applied      RV-000123     GC-4335
Wallet            —              0.000        —            —             —
```

## Credit rule

Credit rows may be shown as negative reduction lines:

```text
Gift Card ****4335     -0.150 OMR
```

But the summary field is positive:

```text
Total Credits Applied  0.150 OMR
```

---

# 6. Refunds / Reversals

Show only if refunds/reversals exist, or show collapsed by default.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ REFUNDS / REVERSALS                                                                           │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Cash Refunds                                                                 │ 0.000 OMR     │
│ Card / Gateway Refunds                                                       │ 0.000 OMR     │
│ Gift Card Restored                                                           │ 0.000 OMR     │
│ Wallet Restored                                                              │ 0.000 OMR     │
│ Credit Note Issued                                                           │ 0.000 OMR     │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Total Refunded / Reversed                                                    │ 0.000 OMR     │
│ Net Collected                                                                │ 1.000 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

Formula:

```text
Net Collected = Total Completed Payments - Completed Refunds
```

Refund rule:

```text
Refunds must respect original settlement source.
If paid by gift card, restore gift card or create customer credit unless cash refund is explicitly approved.
```

---

# 7. Balance Summary

This section is the final mathematical truth.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ BALANCE SUMMARY                                                                               │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Order Total                                                                 │ 2.140 OMR     │
│ Less: Completed Payments                                                    │ -1.000 OMR    │
│ Less: Credits Applied                                                       │ -0.150 OMR    │
├──────────────────────────────────────────────────────────────────────────────┼───────────────┤
│ Outstanding Balance                                                         │ 0.990 OMR     │
│ Overpaid Amount                                                             │ 0.000 OMR     │
│ Pending Payments                                                            │ 0.000 OMR     │
│ Expected Balance If Pending Confirms                                        │ 0.990 OMR     │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

Canonical formula:

```text
Outstanding Balance =
  Order Total
- Completed Payments
- Credits Applied
```

Pending payments are shown separately:

```text
Expected Balance If Pending Confirms =
  Outstanding Balance - Pending Payment Amount
```

But this is informational only.

---

# 8. Receivable / Collection

This section decides whether the remaining amount is AR, pay-on-collection, or normal outstanding.

## 8.1 CREDIT_INVOICE example

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ RECEIVABLE / COLLECTION                                                                       │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Payment Plan                                                                 │ Credit Invoice│
│ Payment Status                                                               │ Partially Paid│
│ Pay on Collection                                                            │ 0.000 OMR     │
│ AR Receivable Amount                                                         │ 0.990 OMR     │
│ AR Invoice                                                                   │ ARI-000016    │
│ AR Invoice Status                                                            │ Overdue       │
│ AR Due Date                                                                  │ 2026-05-30    │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

## 8.2 PAY_ON_COLLECTION example

```text
Payment Plan                     Pay on Collection
Payment Status                   Pending Collection
Pay on Collection                0.990 OMR
AR Receivable Amount             0.000 OMR
AR Invoice                       None
```

## 8.3 Fully paid cash/card/gateway example

```text
Payment Plan                     Pay Now
Payment Status                   Paid
Pay on Collection                0.000 OMR
AR Receivable Amount             0.000 OMR
AR Invoice                       None
```

---

# 9. Tax Document

This section is separate from AR invoice.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ TAX DOCUMENT                                                                                  │
├──────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ Tax Document Type                                                           │ Not generated │
│ Tax Document No                                                             │ —             │
│ Tax Document Status                                                         │ Pending       │
│ Tax Authority Status                                                        │ Not submitted │
│ PDF                                                                         │ Not available │
│ XML                                                                         │ Not available │
│ QR                                                                          │ Not available │
└──────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

When ready:

```text
Tax Document Type                  Simplified Tax Invoice / Standard Tax Invoice
Tax Document No                    TAX-2026-000123
Tax Document Status                Issued
Tax Authority Status               Reported / Cleared / Warning / Failed
PDF/XML/QR                         Available
```

---

# 10. Reconciliation / Warnings

Show this section only if warnings exist.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ FINANCIAL WARNINGS                                                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ AR_RECEIVABLE_MISMATCH                                                                      │
│ Order outstanding amount does not match AR invoice outstanding amount.                        │
│ Order outstanding: 0.840 OMR                                                                  │
│ Invoice outstanding: 0.990 OMR                                                                │
│ Recommended action: Recalculate order financial snapshot.                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ ORDER_TOTAL_COMPONENT_MISMATCH                                                              │
│ Order total does not match subtotal + charges - discounts + tax + rounding.                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Recommended warning codes:

```text
ORDER_TOTAL_COMPONENT_MISMATCH
GIFT_CARD_DOUBLE_COUNTED
CREDIT_APPLICATION_COUNTED_AS_DISCOUNT
PENDING_PAYMENT_COUNTED_AS_PAID
AR_RECEIVABLE_MISMATCH
TAX_TOTAL_MISMATCH
DISCOUNT_DOUBLE_COUNTED
LEGACY_FIELD_USED_IN_SUMMARY
```

---

# 11. Full Example With Your Current Numbers After Fix

```text
FINANCIAL SUMMARY CARDS
Order Total                         2.140 OMR
Paid                                1.000 OMR
Pending Payments                    0.000 OMR
Credits Applied                     0.150 OMR
Balance Due                         0.990 OMR

ORDER VALUE
Base Services                       2.000 OMR
Item / Piece Extras                 0.000 OMR
Preference Extras                   0.000 OMR
Service Charge                      0.000 OMR
Delivery Charge                     0.000 OMR
Express Charge                      0.000 OMR
Other Charges                       0.000 OMR
Gross Amount                        2.000 OMR

DISCOUNTS / PROMOTIONS
Line Discount                       -0.000 OMR
Manual Discount                     -0.000 OMR
Promo Code Discount                 -0.000 OMR
Coupon Discount                     -0.000 OMR
Campaign / Rule Discount            -0.000 OMR
Total Commercial Discounts          -0.000 OMR

TAX CALCULATION
Net Before Tax                      2.000 OMR
Taxable Amount                      2.000 OMR
VAT 5%                              0.100 OMR
Municipal Fee / Other Tax           0.040 OMR
Total Tax                           0.140 OMR
Rounding                            0.000 OMR
Order Total                         2.140 OMR

COMPLETED REAL PAYMENTS
Cash                                1.000 OMR
Total Completed Payments            1.000 OMR

PENDING PAYMENT ATTEMPTS
Gateway Pending                     0.000 OMR
Total Pending Payments              0.000 OMR

CREDITS / STORED VALUE APPLIED
Gift Card ****4335                 -0.150 OMR
Total Credits Applied               0.150 OMR

REFUNDS / REVERSALS
Total Refunded / Reversed           0.000 OMR
Net Collected                       1.000 OMR

BALANCE SUMMARY
Order Total                         2.140 OMR
Less: Completed Payments           -1.000 OMR
Less: Credits Applied              -0.150 OMR
Outstanding Balance                 0.990 OMR
Overpaid Amount                     0.000 OMR
Expected Balance If Pending Confirms 0.990 OMR

RECEIVABLE / COLLECTION
Payment Plan                        Credit Invoice
Payment Status                      Partially Paid
Pay on Collection                   0.000 OMR
AR Receivable Amount                0.990 OMR
AR Invoice                          ARI-000016
AR Invoice Status                   Overdue

TAX DOCUMENT
Tax Document Type                   Not generated
Tax Document No                     —
Tax Document Status                 Pending
Authority Status                    Not submitted
```

This is the **full non-simplified version** that should be implemented.
