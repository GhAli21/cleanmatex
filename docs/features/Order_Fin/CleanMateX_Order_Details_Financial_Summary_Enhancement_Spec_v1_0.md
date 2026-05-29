# CleanMateX Order Details Financial Summary Enhancement Specification

**Document Type:** UI/UX + Functional Specification  
**Feature:** Order Details Financial Summary Redesign  
**Version:** v1.0  
**Status:** Ready for AI Coding Assistant Implementation  
**Target Area:** CleanMateX Web Admin / Order Details Page  
**Related Architecture:** Order Fin, Business Voucher Wiring, AR Invoice Receivable-Only ADR, Tax Document Module, Order Submit Flow  
**Primary Goal:** Replace the old page order details, with financial panel with a clear, production-grade financial summary that separates order value, real payments, credit applications, receivables, pay-on-collection, and tax document status.
https://cmx.cleanmatex.com/dashboard/orders/[id]
---

# Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Current Problems](#2-current-problems)
- [3. Final Architecture Rules](#3-final-architecture-rules)
- [4. Feature Scope](#4-feature-scope)
- [5. New Page Layout](#5-new-page-layout)
- [6. Header and Context](#6-header-and-context)
- [7. Financial Summary Cards](#7-financial-summary-cards)
- [8. Financial Summary Tab](#8-financial-summary-tab)
- [9. Order Value Section](#9-order-value-section)
- [10. Settlement Section](#10-settlement-section)
- [11. Receivable / Collection Section](#11-receivable--collection-section)
- [12. Tax Document Section](#12-tax-document-section)
- [13. Items & Pieces Tab](#13-items--pieces-tab)
- [14. Payments & Credits Tab](#14-payments--credits-tab)
- [15. Invoice / Tax Tab](#15-invoice--tax-tab)
- [16. History Tab](#16-history-tab)
- [17. Debug Tab](#17-debug-tab)
- [18. Critical Calculation Rules](#18-critical-calculation-rules)
- [19. Warning and Validation Messages](#19-warning-and-validation-messages)
- [20. Recommended Components](#20-recommended-components)
- [21. Data Mapping Interface](#21-data-mapping-interface)
- [22. Formatting Rules](#22-formatting-rules)
- [23. Localization Keys](#23-localization-keys)
- [24. Acceptance Criteria](#24-acceptance-criteria)
- [25. Implementation Plan](#25-implementation-plan)
- [26. Prompt for AI Coding Assistant](#26-prompt-for-ai-coding-assistant)
- [27. Final Design Decision](#27-final-design-decision)

---

# 1. Executive Summary

The current **Full Order Details** financial view is a long label/value list. It is useful for debugging but weak for production because it does not clearly separate:

```text
Order value
Commercial discounts
Taxes
Real payments
Credit/stored-value applications
Outstanding balance
Pay on collection
AR invoice receivable
Tax/fiscal document
```

The new design must introduce a structured financial summary layout with cards, sections, and tabs.

The most important business rule:

```text
Order Total = sale/service value.
Paid Amount = completed real payments only.
Credits Applied = gift card/wallet/advance/credit-note/customer-credit applications.
Balance Due = Order Total - Paid Amount - Credits Applied.
AR Invoice = receivable only.
Tax Document = fiscal/legal compliance document.
```

---

# 2. Current Problems

The old screen shows values like:

```text
Subtotal
Line Discount
Rule Discount
Promo Discount
Net after discounts
VAT
Tax
Total
Gift Card Applied
Paid Amount
Balance Due
```

Problems:

```text
1. Discounts are repeated in multiple places.
2. Gift card/credit applications are not visually separated from real payments.
3. Balance Due may be calculated without subtracting credits.
4. AR invoice vs tax invoice vs payment receipt is unclear.
5. Screen is too long and report-like.
6. Users cannot quickly understand what is owed, what was paid, and what is credit.
7. Debug fields are shown to normal users.
8. Settlement section uses negative credit values but does not clearly show whether they are applied or pending.
```

Critical example from the old screen:

```text
Total = 2.040 OMR
Gift Card Applied = -0.100 OMR
Paid Amount = 0.000 OMR
Balance Due = 2.040 OMR
```

If the gift card is actually applied, the expected balance is:

```text
2.040 - 0.100 = 1.940 OMR
```

If the gift card is not applied, the UI must show it as pending and not subtract it.

---

# 3. Final Architecture Rules

The UI must reflect these accepted rules:

```text
1. org_orders_mst contains the financial snapshot.
2. org_order_payments_dtl contains real payment effects.
3. org_order_credit_apps_dtl contains stored-value/customer-credit applications.
4. org_invoice_mst is AR/receivable-only.
5. org_tax_documents_mst will own fiscal/tax/ZATCA/UAE compliance documents.
6. PAY_ON_COLLECTION does not create AR invoice.
7. CREDIT_INVOICE creates AR invoice for receivable amount only.
8. Fully paid cash/card/mobile/gateway orders do not create AR invoice.
9. Tax document can exist even if AR invoice does not.
10. Credits are not discounts.
11. Credits are not real payments.
12. Gift card/wallet/advance/credit note/customer credit must appear in credit applications.
```

---

# 4. Feature Scope

## 4.1 Included

This enhancement includes:

```text
Financial summary cards
Order Value section
Settlement section
Receivable / Collection section
Tax Document section
Payments & Credits detail tables
Items & Pieces financial details
Business Voucher posting
AR invoice creation
Refund processing
Order editing workflow
Debug / Raw Snapshot tab
Calculation consistency checks
Status badges and warnings
Responsive layout
Dark mode support
Localization support
```

## 4.2 Not Included

This enhancement does not implement:

```text
Tax Document Module creation
ZATCA XML submission
```

It only improves the Order Details UI using existing or planned data.

---

# 5. New Page Layout

The new Order Details page should use this structure:

```text
New Order Details
├── Header / Context
├── Financial Summary Cards
├── Tabs
│   ├── Order Master Data
│   ├── Financial Summary
│   ├── Items & Pieces
│   ├── Preferences 
│   ├── Financial Details ( Charges, Discounts, Taxes, Payments , Credit Applications, Refunds, Adjustments )
│   ├── Receipt Vouchers
│   ├── Invoices
│   ├── Order History
│   ├── Order Edit History
│   └── Debug
```

## 5.1 Default Tab

Default tab:

```text
Financial Summary
```

---

# 6. Header and Context

At the top of the page, show:

```text
Order No
Customer
Branch
Order Status
Payment Status
Payment Plan
Created Date
Currency
```

Recommended visual:

```text
Order #ORD-000123     Customer: Ahmed Ali       Status: In Process
Payment: Credit Invoice / Partially Paid        Currency: OMR
```

Status badges:

```text
PAID = green
PARTIALLY_PAID = blue/orange
PENDING_COLLECTION = orange
UNPAID = gray/red
CREDIT_INVOICE = purple/blue
CANCELLED = gray/red
```

---

# 7. Financial Summary Cards

Show 4 primary cards at the top of the financial area.

## 7.1 Card 1 — Order Total

Label:

```text
Order Total
```

Value:

```text
total_amount
```

Meaning:

```text
Final sale/service amount after charges, discounts, tax, and rounding.
```

## 7.2 Card 2 — Paid

Label:

```text
Paid
```

Value:

```text
total_paid_amount
```

Meaning:

```text
Completed real money payments only.
```

Includes:

```text
cash
card
bank transfer if completed
check if cleared/completed
mobile payment if confirmed
gateway if provider confirmed
```

Excludes:

```text
gift card
wallet
customer advance
credit note
customer credit
loyalty value
```

## 7.3 Card 3 — Credits Applied

Label:

```text
Credits Applied
```

Value:

```text
total_credit_applied_amount
```

Meaning:

```text
Stored-value/customer-credit applications that reduce balance due but are not real payments received now.
```

Includes:

```text
gift card
wallet
customer advance
credit note
customer credit
loyalty value
manual credit
```

## 7.4 Card 4 — Balance Due

Label:

```text
Balance Due
```

Value:

```text
outstanding_amount
```

Formula:

```text
Balance Due = total_amount - total_paid_amount - total_credit_applied_amount
```

Use warning style if:

```text
outstanding_amount > 0
```

Use success style if:

```text
outstanding_amount = 0
```

---

# 8. Financial Summary Tab

The Financial Summary tab must contain four sections:

```text
1. Order Value
2. Settlement
3. Receivable / Collection
4. Tax Document
```

Recommended layout:

```text
Two-column desktop layout:
- Left column: Order Value
- Right column: Settlement + Receivable / Collection + Tax Document

Mobile:
- Single stacked column
```

---

# 9. Order Value Section

Purpose:

```text
Explain how the order total was built.
```

Display rows:

```text
Base services
Item / piece extras
Preference extras
Service charge
Delivery charge
Express charge
Other charges
Gross amount
Discounts
Net before tax
VAT
Other tax
Rounding
Order total
```

## 9.1 Source Fields

| UI Label | Source Field |
|---|---|
| Base services | `items_base_amount` |
| Item / piece extras | `piece_extra_price_amount` |
| Preference extras | `preference_extra_price_amount` |
| Service charge | `service_charge_amount` |
| Delivery charge | `delivery_charge_amount` |
| Express charge | `express_charge_amount` |
| Other charges | `other_charges_amount` |
| Gross amount | `gross_amount` or calculated |
| Discounts | `discount_amount` |
| Net before tax | `net_before_tax_amount` or calculated |
| Taxable amount | `taxable_amount` |
| VAT / Tax | `tax_amount` or split from `org_order_taxes_dtl` |
| Rounding | `rounding_amount` |
| Order total | `total_amount` |

## 9.2 Current Calculation Mode

Important current assumption:

```text
For now, item/piece/preference extra charges are included inside items_base_amount.
```

Therefore:

```text
piece_extra_price_amount and preference_extra_price_amount are breakdown/reporting fields only.
Do not add them again to total_charges_amount.
```

Current formula:

```text
items_base_amount =
  SUM(active order item final line amounts)

piece_extra_price_amount =
  SUM(active order item pieces extra_price)

preference_extra_price_amount =
  SUM(active order preferences extra_price * quantity)

total_charges_amount =
  service_charge_amount
  + delivery_charge_amount
  + express_charge_amount
  + other_charges_amount

subtotal_amount =
  items_base_amount

gross_amount =
  subtotal_amount
  + total_charges_amount

discount_amount =
  SUM(active applied commercial discounts)

net_before_tax_amount =
  MAX(gross_amount - discount_amount, 0)

taxable_amount =
  SUM(order tax taxable amounts)

tax_amount =
  SUM(order tax amounts)

total_amount =
  net_before_tax_amount
  + tax_amount
  + rounding_amount
```

## 9.3 UI Treatment

Use plus/minus visual semantics:

```text
Base services                         2.000 OMR
Item / piece extras                   Included
Preference extras                     Included
Service charge                        0.000 OMR
Delivery charge                       0.000 OMR
Express charge                        0.000 OMR
Other charges                         0.000 OMR
------------------------------------------------
Gross amount                          2.000 OMR
Discounts                            -0.000 OMR
Net before tax                        2.000 OMR
VAT / Tax                             0.040 OMR
Rounding                              0.000 OMR
------------------------------------------------
Order total                           2.040 OMR
```

If extra amounts are included in items base amount, show them as:

```text
Item / piece extras                   0.100 OMR included in base services
Preference extras                     0.050 OMR included in base services
```

This avoids double-counting confusion.

---

# 10. Settlement Section

Purpose:

```text
Explain how the order has been settled or will be settled.
```

Split into:

```text
Real payments
Credit applications
Balance
```

## 10.1 Real Payments

Label:

```text
Real payments received
```

Source:

```text
org_order_payments_dtl
payment_status = COMPLETED
```

Display summary:

```text
Cash / Card / Bank / Gateway          0.000 OMR
```

Or grouped by method:

```text
Cash                                  1.000 OMR
Card                                  0.500 OMR
Gateway                               0.000 OMR
```

## 10.2 Credit Applications

Label:

```text
Credits / stored value applied
```

Source:

```text
org_order_credit_apps_dtl
application_status = APPLIED
```

Examples:

```text
Gift card ****4335                   -0.100 OMR
Wallet                               -0.000 OMR
Customer advance                     -0.000 OMR
Credit note                          -0.000 OMR
Customer credit                      -0.000 OMR
```

Important:

```text
Credits are not discounts.
Credits are not real payments.
Credits reduce balance due.
```

## 10.3 Balance

Display:

```text
Total paid                            0.000 OMR
Total credits applied                -0.100 OMR
Balance due                           1.940 OMR
```

Formula:

```text
balance_due =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

## 10.4 Status Display

If credit application is shown but not applied, display status:

```text
Gift card ****4335                  -0.100 OMR     Pending
```

Do not subtract pending credit from balance.

---

# 11. Receivable / Collection Section

Purpose:

```text
Explain whether the outstanding amount is pay-on-collection, AR receivable, or already settled.
```

Display fields:

```text
Payment plan
Payment status
Pay on collection amount
AR invoice amount
AR invoice no/status
Receivable status
```

## 11.1 Source Fields

| UI Label | Source Field |
|---|---|
| Payment plan | `payment_type_code` |
| Payment status | `payment_status` |
| Pay on collection | `pay_on_collection_amount` |
| AR receivable amount | `invoice_amount` or `ar_invoice_amount` |
| AR invoice | `ar_invoice_id`, `ar_invoice_no`, `ar_invoice_status` |
| Outstanding balance | `outstanding_amount` |

## 11.2 Rules

For `PAY_ON_COLLECTION`:

```text
Pay on collection amount = outstanding_amount
AR invoice amount = 0
AR invoice = none
```

For `CREDIT_INVOICE`:

```text
AR invoice amount = outstanding_amount
Pay on collection amount = 0
AR invoice should exist or be pending creation
```

For fully paid cash/card/mobile/gateway:

```text
Pay on collection amount = 0
AR invoice amount = 0
AR invoice = none
```

---

# 12. Tax Document Section

Purpose:

```text
Explain fiscal/tax/ZATCA document state separately from AR invoice.
```

Display fields:

```text
Tax document type
Tax document no
Tax document status
Authority status
PDF/XML/QR availability
```

## 12.1 Source Fields

| UI Label | Source |
|---|---|
| Tax document type | `tax_document_type` |
| Tax document no | `tax_document_no` |
| Tax document status | `tax_document_status` |
| Authority status | `authority_status` from tax document module |
| QR | tax document payload |
| PDF/XML | tax document payloads |

## 12.2 Rules

```text
Tax document is not AR invoice.
Tax document does not create AR ledger debit.
Cash sales may have tax documents.
PAY_ON_COLLECTION may generate tax document at collection/delivery depending policy.
CREDIT_INVOICE/B2B may have both AR invoice and tax document.
```

## 12.3 Placeholder for Phase

If Tax Document Module is not implemented yet, show:

```text
Tax document: Not available yet
Temporary receipt: Voucher receipt
```

---

# 13. Items & Pieces Tab

Purpose:

```text
Show item-level and piece/preference financial details.
```

## 13.1 Main Item Table

Columns:

```text
Item / Service
Qty
Base Amount
Included Extras
Discount
Tax
Total
```

Example:

```text
Shirt Washing     1     2.000     0.000     0.000     0.040     2.040
```

## 13.2 Expandable Item Details

Each item row can expand to show:

```text
Pieces
Preferences
Item charges
Item discounts
Item taxes
```

### Pieces

```text
Piece              Extra Price        Reason
Shirt piece 1      0.000 OMR          —
```

### Preferences

```text
Preference         Qty      Extra Price       Total
Perfume            1        0.100 OMR         0.100 OMR
Hanger             1        0.000 OMR         0.000 OMR
```

## 13.3 Important UI Note

If piece/preference extra price is included in item line total, show:

```text
Included in item total
```

not as an extra charge added again.

---

# 14. Payments & Credits Tab

Purpose:

```text
Show detailed payment and credit application effects.
```

Split into two tables.

## 14.1 Real Payments Table

Source:

```text
org_order_payments_dtl
```

Columns:

```text
Method
Amount
Status
Voucher No
Reference
Date
Created By
```

Status badges:

```text
COMPLETED = green
PENDING = orange
PROCESSING = blue
FAILED = red
CANCELLED = gray
REFUNDED = purple
```

Rules:

```text
Only COMPLETED payments contribute to total_paid_amount.
Pending gateway/bank/check payments must not increase paid amount.
```

## 14.2 Credit Applications Table

Source:

```text
org_order_credit_apps_dtl
```

Columns:

```text
Credit Type
Source
Amount
Status
Voucher No
Reference
Date
Created By
```

Credit types:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
LOYALTY_VALUE
MANUAL_CREDIT
```

Rules:

```text
Applied credits contribute to total_credit_applied_amount.
Credits do not appear in org_order_payments_dtl.
Credits do not appear in discounts.
```

---

# 15. Invoice / Tax Tab

Purpose:

```text
Separate AR invoice from tax/fiscal document.
```

Sections:

```text
AR Invoice
Tax Document
Related Vouchers
```

## 15.1 AR Invoice Section

Fields:

```text
AR invoice no
AR invoice amount
AR invoice status
AR ledger status
Due date
Paid amount
Outstanding amount
```

Rules:

```text
Show empty/none for cash sales and PAY_ON_COLLECTION.
Show for CREDIT_INVOICE/B2B only.
```

## 15.2 Tax Document Section

Fields:

```text
Tax document no
Tax document type
Authority status
Issue date
Total
VAT
QR
PDF
XML
```

Rules:

```text
Show future/placeholder if module not ready.
```

## 15.3 Related Vouchers

Show:

```text
Receipt voucher
Refund voucher
Adjustment voucher
```

Columns:

```text
Voucher No
Type
Amount
Status
Date
```

---

# 16. History Tab

Purpose:

```text
Show lifecycle and audit history.
```

Sources:

```text
org_order_history
org_order_status_history
org_order_edit_history
org_order_piece_hist_tr
voucher events
tax document events
```

Group by:

```text
Order events
Payment events
Credit application events
Invoice/tax events
Edit events
```

---

# 17. Debug Tab

Purpose:

```text
Show raw financial snapshot for admin/support/developer.
```

Access:

```text
Only users with admin/support/debug permission.
```

Fields:

```text
subtotal_amount
items_base_amount
piece_extra_price_amount
preference_extra_price_amount
service_charge_amount
delivery_charge_amount
express_charge_amount
other_charges_amount
total_charges_amount
discount_amount
taxable_amount
tax_amount
rounding_amount
total_amount
total_paid_amount
total_credit_applied_amount
refunded_amount
net_collected_amount
outstanding_amount
pay_on_collection_amount
invoice_amount
payment_type_code
payment_status
ar_invoice_id
tax_document_id
currency_code
currency_ex_rate
financial_version
financial_last_calculated_at
```

Also show reconciliation result:

```text
OK / Warning / Error
```

---

# 18. Critical Calculation Rules

## 18.1 Balance Due

```text
balance_due =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

With guard:

```text
balance_due = MAX(balance_due, 0)
```

## 18.2 Overpaid

```text
overpaid_amount =
  MAX(total_paid_amount + total_credit_applied_amount - total_amount, 0)
```

## 18.3 Pay on Collection

```text
if payment_type_code = PAY_ON_COLLECTION:
  pay_on_collection_amount = outstanding_amount
else:
  pay_on_collection_amount = 0
```

## 18.4 AR Invoice Amount

```text
if payment_type_code in CREDIT_INVOICE / INVOICE / B2B:
  invoice_amount = outstanding_amount
else:
  invoice_amount = 0
```

## 18.5 Tax Document Amount

```text
tax_document_total_amount = total_amount
```

Tax document total is the fiscal sale amount, not AR receivable amount.

---

# 19. Warning and Validation Messages

Show warnings if:

```text
1. Gift card/credit is displayed but not included in total_credit_applied_amount.
2. Balance due does not equal total - paid - credits.
3. Pending payment is counted as paid.
4. Credit application is counted as discount.
5. PAY_ON_COLLECTION has AR invoice id.
6. Cash/paid order has AR invoice id.
7. CREDIT_INVOICE has outstanding amount but no AR invoice.
8. Tax document required but not generated.
9. Order financial snapshot is stale.
10. Financial version mismatch.
```

Example warning:

```text
Balance mismatch: Order total is 2.040, paid is 0.000, credits applied is 0.100, expected balance is 1.940 but stored balance is 2.040.
```

---

# 20. Recommended Components

Create reusable components:

```text
OrderFinancialSummaryCards
OrderValueBreakdown
OrderSettlementSummary
OrderReceivableCollectionPanel
OrderTaxDocumentPanel
OrderItemsFinancialTable
OrderPaymentsTable
OrderCreditApplicationsTable
OrderInvoiceTaxTab
OrderFinancialDebugPanel
OrderFinancialWarningBanner
MoneyValue
StatusBadge
FinancialSectionCard
```

---

# 21. Data Mapping Interface

Recommended frontend data shape:

```ts
type OrderFinancialSummaryViewModel = {
  orderId: string;
  orderNo: string;
  currencyCode: string;

  amounts: {
    itemsBaseAmount: string;
    pieceExtraPriceAmount: string;
    preferenceExtraPriceAmount: string;

    serviceChargeAmount: string;
    deliveryChargeAmount: string;
    expressChargeAmount: string;
    otherChargesAmount: string;
    totalChargesAmount: string;

    subtotalAmount: string;
    grossAmount: string;
    discountAmount: string;
    netBeforeTaxAmount: string;
    taxableAmount: string;
    taxAmount: string;
    roundingAmount: string;
    totalAmount: string;

    totalPaidAmount: string;
    totalCreditAppliedAmount: string;
    refundedAmount: string;
    netCollectedAmount: string;
    outstandingAmount: string;
    overpaidAmount: string;

    payOnCollectionAmount: string;
    invoiceAmount: string;
  };

  payment: {
    paymentTypeCode: string;
    paymentStatus: string;
  };

  arInvoice?: {
    id: string;
    invoiceNo: string;
    status: string;
    amount: string;
    dueDate?: string;
  } | null;

  taxDocument?: {
    id: string;
    documentNo: string;
    documentType: string;
    status: string;
    authorityStatus?: string;
  } | null;

  payments: OrderPaymentViewModel[];
  creditApplications: OrderCreditApplicationViewModel[];
  items: OrderItemFinancialViewModel[];
  warnings: FinancialWarning[];
};
```

---

# 22. Formatting Rules

Money:

```text
3 decimals for OMR if tenant currency minor unit requires 3
2 decimals for SAR/AED if configured
Use currency_code suffix or localized symbol
Right-align money values
Negative values in green for credits/reductions
Balance due in orange/red when > 0
Paid/settled in green
```

Examples:

```text
2.040 OMR
-0.100 OMR
0.000 OMR
```

---

# 23. Localization Keys

Suggested keys:

```json
{
  "order.financial.summary.title": "Financial Summary",
  "order.financial.card.orderTotal": "Order Total",
  "order.financial.card.paid": "Paid",
  "order.financial.card.creditsApplied": "Credits Applied",
  "order.financial.card.balanceDue": "Balance Due",

  "order.financial.section.orderValue": "Order Value",
  "order.financial.section.settlement": "Settlement",
  "order.financial.section.receivableCollection": "Receivable / Collection",
  "order.financial.section.taxDocument": "Tax Document",

  "order.financial.baseServices": "Base services",
  "order.financial.itemPieceExtras": "Item / piece extras",
  "order.financial.preferenceExtras": "Preference extras",
  "order.financial.serviceCharge": "Service charge",
  "order.financial.deliveryCharge": "Delivery charge",
  "order.financial.expressCharge": "Express charge",
  "order.financial.otherCharges": "Other charges",
  "order.financial.grossAmount": "Gross amount",
  "order.financial.discounts": "Discounts",
  "order.financial.netBeforeTax": "Net before tax",
  "order.financial.taxableAmount": "Taxable amount",
  "order.financial.tax": "Tax",
  "order.financial.rounding": "Rounding",
  "order.financial.total": "Order total",

  "order.financial.realPayments": "Real payments received",
  "order.financial.creditApplications": "Credits / stored value applied",
  "order.financial.totalPaid": "Total paid",
  "order.financial.totalCreditsApplied": "Total credits applied",
  "order.financial.outstandingBalance": "Outstanding balance",

  "order.financial.paymentPlan": "Payment plan",
  "order.financial.paymentStatus": "Payment status",
  "order.financial.payOnCollection": "Pay on collection",
  "order.financial.arReceivableAmount": "AR receivable amount",
  "order.financial.arInvoice": "AR invoice",

  "order.financial.taxDocumentType": "Tax document type",
  "order.financial.taxDocumentNo": "Tax document no",
  "order.financial.authorityStatus": "Authority status",

  "order.financial.debug.rawSnapshot": "Raw Financial Snapshot",
  "order.financial.warning.balanceMismatch": "Balance mismatch"
}
```

Arabic equivalents should be added in the project’s Arabic localization file.

---

# 24. Acceptance Criteria

The enhancement is accepted when:

```text
1. Financial summary cards show order total, paid, credits applied, and balance due.
2. Balance due subtracts both real payments and credit applications.
3. Gift card/wallet/advance/credit note are shown as credits, not discounts.
4. Real payments and credit applications are shown in separate tables.
5. PAY_ON_COLLECTION shows pay-on-collection amount and no AR invoice.
6. CREDIT_INVOICE shows AR receivable amount and AR invoice details.
7. Fully paid cash/card/mobile/gateway order shows no AR invoice.
8. Tax document section is separate from AR invoice.
9. Item/piece/preference extra amounts are visible without double-counting.
10. Debug tab shows raw snapshot only for authorized users.
11. Warnings show when stored snapshot is inconsistent.
12. UI is responsive and supports dark mode.
13. Money formatting respects currency precision.
14. Localization keys are used for all labels.
```

---

# 25. Implementation Plan

## Phase 1 — View Model and Calculation Check

```text
Create OrderFinancialSummaryViewModel.
Add API mapper or frontend selector.
Add derived calculations:
- grossAmount
- netBeforeTaxAmount
- expectedOutstandingAmount
- overpaidAmount
Add warning generator.
```

## Phase 2 — Financial Summary Cards

```text
Implement OrderFinancialSummaryCards.
Show four cards.
Add status colors and currency formatting.
```

## Phase 3 — Financial Summary Tab

```text
Implement OrderValueBreakdown.
Implement OrderSettlementSummary.
Implement OrderReceivableCollectionPanel.
Implement OrderTaxDocumentPanel.
```

## Phase 4 — Detail Tabs

```text
Implement Items & Pieces tab enhancements.
Implement Payments & Credits tab.
Implement Invoice / Tax tab.
Implement Debug tab.
```

## Phase 5 — QA and Edge Cases

Test:

```text
fully paid cash
partially paid
gift card applied
wallet applied
PAY_ON_COLLECTION
CREDIT_INVOICE
gateway pending
tax document exists
AR invoice exists
balance mismatch warning
```

---

# 26. Prompt for AI Coding Assistant

Use this prompt with Claude Code or any coding assistant:

```text
You are working on CleanMateX Web Admin. Implement the Order Details Financial Summary enhancement using the specification in this document.

Core rules:
1. Separate order value, settlement, receivable/collection, and tax document.
2. total_paid_amount means completed real payments only.
3. total_credit_applied_amount means gift card/wallet/advance/credit-note/customer-credit applications.
4. outstanding_amount = total_amount - total_paid_amount - total_credit_applied_amount.
5. Credits are not discounts and not real payments.
6. AR invoice is receivable-only.
7. Tax document is separate from AR invoice.
8. PAY_ON_COLLECTION must not show AR invoice.
9. CREDIT_INVOICE must show AR receivable amount.
10. For now, piece/preference extra amounts are included in items_base_amount, so show them as included breakdowns and do not double-count them in total_charges_amount.

Implementation tasks:
- Create view model mapper/selector.
- Create financial summary cards.
- Create Order Value section.
- Create Settlement section.
- Create Receivable / Collection section.
- Create Tax Document section.
- Split payments and credits into separate tables.
- Add Invoice / Tax tab.
- Add Debug tab behind permission.
- Add warning banner for mismatched balance or stale snapshot.
- Use existing styling, dark mode, responsive layout, localization, and money formatting standards.
```

---

# 27. Final Design Decision

The new Order Details financial UI must communicate this:

```text
Order Value
= what the customer bought

Settlement
= how the order was paid or credited

Receivable / Collection
= what is still owed and how it will be collected

Tax Document
= fiscal/legal compliance document

AR Invoice
= receivable only, not a generic sales receipt
```

This design aligns the UI with CleanMateX’s final finance architecture and prevents staff, developers, and auditors from confusing payments, credits, AR, tax invoices, and order totals.
