# CleanMateX Order Finance Calculation Algorithms — Full Non-Simplified Specification

**Document Type:** Engineering Algorithm Specification  
**Module:** Order Fin / Order Submit / Order Edit / Settlement / AR / Tax Documents  
**Version:** v1.0  
**Status:** Ready for Implementation  
**Assumption:** Legacy order amount columns have already been dropped. Only canonical columns exist.

---

## 1. Purpose

This document defines the complete, non-simplified financial calculation algorithms for CleanMateX orders.

It covers:

- Order submit
- Order edit / modification
- Completed, pending, failed, refused, and cancelled payments
- Gateway/card/bank/check payment lifecycle
- Gift card, wallet, advance, credit note, customer credit, and loyalty value applications
- PAY_ON_COLLECTION
- CREDIT_INVOICE / B2B / INVOICE
- AR invoice creation and display
- Tax document separation
- Refunds and reversals
- Overpayment and change return
- Reconciliation warnings
- Order Details financial summary

---

## 2. Canonical Design Rules

```text
Order Value
= what the customer bought.

Settlement
= how the order was paid, credited, pending, failed, or refunded.

Receivable / Collection
= what is still owed and whether it is AR or pay-on-collection.

Tax Document
= fiscal/legal/e-invoicing document.
```

Non-negotiable principles:

```text
1. Order total is the sale/service value.
2. Payments do not reduce order total.
3. Credit applications do not reduce order total.
4. Commercial discounts reduce sale value.
5. Stored-value credits reduce outstanding only.
6. Pending payments are visible but do not reduce outstanding.
7. Failed/refused/cancelled payments are audit-only.
8. AR invoice is receivable-only.
9. PAY_ON_COLLECTION is not AR.
10. Tax document is separate from AR invoice.
```

---

## 3. Canonical Columns

### 3.1 Order value columns

```sql
items_base_amount numeric(19,4) not null default 0,
subtotal_amount numeric(19,4) not null default 0,

piece_extra_price_amount numeric(19,4) not null default 0,
preference_extra_price_amount numeric(19,4) not null default 0,

service_charge_amount numeric(19,4) not null default 0,
delivery_charge_amount numeric(19,4) not null default 0,
express_charge_amount numeric(19,4) not null default 0,
other_charges_amount numeric(19,4) not null default 0,
total_charges_amount numeric(19,4) not null default 0,

total_discount_amount numeric(19,4) not null default 0,
taxable_amount numeric(19,4) not null default 0,
total_tax_amount numeric(19,4) not null default 0,
rounding_adjustment_amount numeric(19,4) not null default 0,

total_amount numeric(19,4) not null default 0
```

### 3.2 Settlement columns

```sql
total_paid_amount numeric(19,4) not null default 0,
pending_payment_amount numeric(19,4) not null default 0,
failed_payment_amount numeric(19,4) not null default 0,

total_credit_applied_amount numeric(19,4) not null default 0,
pending_credit_application_amount numeric(19,4) not null default 0,
failed_credit_application_amount numeric(19,4) not null default 0,

refunded_amount numeric(19,4) not null default 0,
net_collected_amount numeric(19,4) not null default 0,

outstanding_amount numeric(19,4) not null default 0,
overpaid_amount numeric(19,4) not null default 0,
change_returned_amount numeric(19,4) not null default 0
```

### 3.3 AR / collection columns

```sql
pay_on_collection_amount numeric(19,4) not null default 0,
ar_receivable_amount numeric(19,4) not null default 0,

ar_invoice_id uuid null,
ar_invoice_no text null,
ar_invoice_status varchar(50) null
```

### 3.4 Tax document columns

```sql
tax_document_id uuid null,
tax_document_no text null,
tax_document_status varchar(50) null,
tax_document_type varchar(50) null
```

### 3.5 Financial audit columns

```sql
financial_engine_version smallint not null default 1,
financial_last_calculated_at timestamptz null,
financial_last_calculated_by uuid null,
financial_snapshot_status varchar(30) not null default 'CURRENT',
financial_mismatch_warning_count integer not null default 0
```

---

## 4. Source Tables

The order header is only a summary snapshot. The source of truth is the detail tables.

Operational sources:

```text
org_orders_mst
org_order_items_dtl
org_order_item_pieces_dtl
org_order_preferences_dtl
```

Financial sources:

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_payments_dtl
org_order_credit_apps_dtl
org_order_refunds_dtl
```

Source document links:

```text
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
org_invoice_mst
org_tax_documents_mst
```

---

## 5. Status Values

### 5.1 Payment row statuses

```text
PENDING
PROCESSING
AUTHORIZED
COMPLETED
FAILED
CANCELLED
REFUSED
EXPIRED
REVERSED
REFUNDED
PARTIALLY_REFUNDED
```

### 5.2 Credit application statuses

```text
PENDING
RESERVED
PROCESSING
APPLIED
FAILED
CANCELLED
REVERSED
EXPIRED
```

### 5.3 Refund statuses

```text
DRAFT
PENDING_APPROVAL
APPROVED
PROCESSING
COMPLETED
FAILED
CANCELLED
REVERSED
```

### 5.4 Order payment status values

```text
UNPAID
PENDING_PAYMENT
PENDING_GATEWAY
PENDING_COLLECTION
PARTIALLY_PAID
PAID
OVERPAID
PAYMENT_FAILED
PARTIALLY_REFUNDED
REFUNDED
CANCELLED
```

---

## 6. Money Arithmetic Rules

Use Decimal/arbitrary precision arithmetic only.

Do not use JavaScript floating-point `number` math for money.

Rounding happens only at defined boundaries:

```text
line total
tax row
document total
currency minor-unit display
```

Stored summary values are positive amounts.

Example:

```text
total_credit_applied_amount = 0.150
total_discount_amount = 0.250
refunded_amount = 1.000
```

UI may show reduction rows as negative display lines:

```text
Gift Card Applied    -0.150 OMR
Commercial Discount  -0.250 OMR
```

---

## 7. Core Calculation Order

Always calculate in this order:

```text
1. Items base amount
2. Extra price breakdowns
3. Charges
4. Gross amount
5. Commercial discounts/promotions
6. Net before tax
7. Taxable amount
8. Tax amount
9. Rounding
10. Total sale amount
11. Completed payments
12. Pending payments
13. Failed payments
14. Applied credits
15. Pending credits
16. Failed credits
17. Refunds
18. Outstanding
19. Overpaid
20. Pay-on-collection amount
21. AR receivable amount
22. Payment status
23. Reconciliation warnings
24. Snapshot write
```

---

## 8. Algorithm A — Build Order Value

### 8.1 Items base amount

Current mode, where extras are included in item line total:

```text
items_base_amount =
  SUM(active order item final line amounts)
```

The item final line amount may already include:

```text
base service/item price
piece extra price
preference extra price
item-level add-ons
```

Alternative separate-charge mode:

```text
items_base_amount =
  SUM(active order item quantity * unit price)
```

### 8.2 Piece extra price amount

```text
piece_extra_price_amount =
  SUM(active order piece extra_price * quantity_if_available)
```

If piece quantity does not exist:

```text
piece_extra_price_amount =
  SUM(active order piece extra_price)
```

### 8.3 Preference extra price amount

```text
preference_extra_price_amount =
  SUM(active order preference extra_price * quantity_if_available)
```

If preference quantity does not exist:

```text
preference_extra_price_amount =
  SUM(active order preference extra_price)
```

### 8.4 Charges

```text
service_charge_amount =
  SUM(active charges where charge_type = SERVICE_CHARGE)

delivery_charge_amount =
  SUM(active charges where charge_type = DELIVERY_CHARGE)

express_charge_amount =
  SUM(active charges where charge_type = EXPRESS_CHARGE)

other_charges_amount =
  SUM(active charges where charge_type in MANUAL_CHARGE, SYSTEM_CHARGE, OTHER_CHARGE)
```

### 8.5 Total charges

If extras are included in item price:

```text
total_charges_amount =
  service_charge_amount
+ delivery_charge_amount
+ express_charge_amount
+ other_charges_amount
```

If extras are separate charges:

```text
total_charges_amount =
  piece_extra_price_amount
+ preference_extra_price_amount
+ service_charge_amount
+ delivery_charge_amount
+ express_charge_amount
+ other_charges_amount
```

### 8.6 Gross amount

```text
gross_amount =
  items_base_amount
+ total_charges_amount
```

### 8.7 Commercial discounts

Include:

```text
LINE_DISCOUNT
MANUAL_DISCOUNT
PROMO_CODE_DISCOUNT
COUPON_DISCOUNT
CAMPAIGN_DISCOUNT
RULE_DISCOUNT
APPROVED_MANAGER_DISCOUNT
LOYALTY_DISCOUNT when promotion-style
```

Exclude:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
LOYALTY_VALUE when stored-value
MANUAL_CREDIT
```

Formula:

```text
total_discount_amount =
  SUM(active applied commercial discount amount)
```

### 8.8 Net before tax

```text
net_before_tax_amount =
  MAX(gross_amount - total_discount_amount, 0)
```

If negative sales are enabled:

```text
net_before_tax_amount =
  gross_amount - total_discount_amount
```

Default:

```text
negative sales are not allowed
```

### 8.9 Taxable amount

Taxable amount comes from the tax engine.

Generic formula:

```text
taxable_amount =
  SUM(taxable line/charge amounts after commercial discount allocation)
```

Rules:

```text
Commercial discounts may reduce taxable amount according to tax policy.
Stored-value credits never reduce taxable amount.
```

### 8.10 Total tax amount

```text
total_tax_amount =
  SUM(active org_order_taxes_dtl.tax_amount)
```

Examples:

```text
VAT
Municipal Fee
Tourism Fee
Environmental Fee
Other local tax
```

### 8.11 Rounding

```text
rounding_adjustment_amount =
  configured rounding adjustment
```

### 8.12 Total sale amount

```text
total_amount =
  net_before_tax_amount
+ total_tax_amount
+ rounding_adjustment_amount
```

Expanded:

```text
total_amount =
  items_base_amount
+ total_charges_amount
- total_discount_amount
+ total_tax_amount
+ rounding_adjustment_amount
```

---

## 9. Algorithm B — Calculate Real Payments

### 9.1 Completed payments

```text
total_paid_amount =
  SUM(payment.amount)
  WHERE payment_status = COMPLETED
  AND rec_status = 1
```

Methods included when completed:

```text
CASH
CARD
BANK_TRANSFER
CHECK
MOBILE_PAYMENT
GATEWAY
HYPERPAY
PAYTABS
STRIPE
```

### 9.2 Pending payments

```text
pending_payment_amount =
  SUM(payment.amount)
  WHERE payment_status IN (PENDING, PROCESSING, AUTHORIZED)
  AND rec_status = 1
```

Pending payments are visible but do not reduce outstanding.

### 9.3 Failed payments

```text
failed_payment_amount =
  SUM(payment.amount)
  WHERE payment_status IN (FAILED, CANCELLED, REFUSED, EXPIRED)
  AND rec_status = 1
```

Failed payment amount is audit only.

### 9.4 Reversed payments

If payment is reversed before being settled:

```text
do not count in total_paid_amount
do not count in pending_payment_amount
count in audit/history only
```

If a completed payment is later refunded, use refund calculation, not direct subtraction from `total_paid_amount`, unless the original payment row is truly reversed/cancelled by a controlled reversal workflow.

---

## 10. Algorithm C — Calculate Credit Applications

### 10.1 Applied credits

```text
total_credit_applied_amount =
  SUM(credit_app.amount)
  WHERE application_status = APPLIED
  AND rec_status = 1
```

Included credit types:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
LOYALTY_VALUE
MANUAL_CREDIT
```

### 10.2 Pending/reserved credits

```text
pending_credit_application_amount =
  SUM(credit_app.amount)
  WHERE application_status IN (PENDING, RESERVED, PROCESSING)
  AND rec_status = 1
```

Default:

```text
pending/reserved credits do not reduce outstanding
```

### 10.3 Failed/reversed credits

```text
failed_credit_application_amount =
  SUM(credit_app.amount)
  WHERE application_status IN (FAILED, CANCELLED, REVERSED, EXPIRED)
  AND rec_status = 1
```

Failed/reversed credits do not reduce outstanding.

### 10.4 Gift card rule

Gift card redemption must:

```text
increase total_credit_applied_amount when APPLIED
not increase total_paid_amount
not reduce total_amount
not reduce taxable_amount
not reduce total_tax_amount
```

---

## 11. Algorithm D — Calculate Refunds

### 11.1 Completed refunds

```text
refunded_amount =
  SUM(refund.amount)
  WHERE refund_status = COMPLETED
  AND rec_status = 1
```

### 11.2 Refund method classification

Recommended future split:

```text
real_payment_refunded_amount
credit_reversed_amount
stored_value_restored_amount
customer_credit_issued_amount
```

If only one field exists:

```text
refunded_amount = all completed refund/reversal value
```

### 11.3 Net collected

Default:

```text
net_collected_amount =
  MAX(total_paid_amount - refunded_amount, 0)
```

More accurate future formula:

```text
net_collected_amount =
  total_paid_amount - real_payment_refunded_amount
```

### 11.4 Refund and outstanding

Default:

```text
refunds do not automatically reopen outstanding
```

If refund policy explicitly reopens due:

```text
outstanding_amount =
  MAX(
    total_amount
  - total_paid_amount
  - total_credit_applied_amount
  + refund_reopens_due_amount,
    0
  )
```

For v1:

```text
refund_reopens_due_amount = 0
```

unless a specific workflow sets it.

---

## 12. Algorithm E — Calculate Outstanding / Overpaid

### 12.1 Raw outstanding

```text
raw_outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

### 12.2 Outstanding amount

```text
outstanding_amount =
  MAX(raw_outstanding_amount, 0)
```

### 12.3 Overpaid amount

```text
overpaid_amount =
  MAX(
    total_paid_amount
  + total_credit_applied_amount
  - total_amount,
    0
  )
```

### 12.4 Change returned

For cash tender:

```text
cash_tendered_amount = amount physically given by customer
cash_retained_amount = amount kept as payment
change_returned_amount = cash_tendered_amount - cash_retained_amount
```

Important:

```text
total_paid_amount includes cash_retained_amount, not cash_tendered_amount
```

Example:

```text
Order total = 2.140
Customer gives cash = 5.000
Cash retained = 2.140
Change returned = 2.860
total_paid_amount = 2.140
overpaid_amount = 0
```

If overpayment is intentionally retained:

```text
overpaid_amount > 0
then create customer advance/credit or refund/change workflow
```

---

## 13. Algorithm F — Classify Collection / AR

### 13.1 PAY_ON_COLLECTION

If:

```text
payment_type_code = PAY_ON_COLLECTION
```

Then:

```text
pay_on_collection_amount = outstanding_amount
ar_receivable_amount = 0
ar_invoice_id = null
```

No AR invoice and no AR ledger debit.

### 13.2 CREDIT_INVOICE / B2B / INVOICE

If:

```text
payment_type_code IN (CREDIT_INVOICE, B2B, INVOICE)
```

Then:

```text
ar_receivable_amount = outstanding_amount
pay_on_collection_amount = 0
```

If:

```text
ar_receivable_amount > 0
```

then AR invoice can be created/updated according to AR policy.

If:

```text
ar_receivable_amount = 0
```

no AR invoice is required.

### 13.3 PAY_NOW / PAY_IN_ADVANCE / normal retail

For all other payment plans:

```text
pay_on_collection_amount = 0
ar_receivable_amount = 0
```

Outstanding remains normal unpaid balance unless order flow requires immediate collection or payment retry.

---

## 14. Algorithm G — Resolve Payment Status

### 14.1 Inputs

```ts
type PaymentStatusInput = {
  orderStatus: string;
  paymentTypeCode: string;
  totalAmount: Decimal;
  totalPaidAmount: Decimal;
  pendingPaymentAmount: Decimal;
  failedPaymentAmount: Decimal;
  totalCreditAppliedAmount: Decimal;
  refundedAmount: Decimal;
  outstandingAmount: Decimal;
  overpaidAmount: Decimal;
};
```

### 14.2 Algorithm

```text
if order is CANCELLED:
  return CANCELLED

if refunded_amount > 0 and refunded_amount < total_paid_amount:
  return PARTIALLY_REFUNDED

if refunded_amount >= total_paid_amount and total_paid_amount > 0:
  return REFUNDED

if overpaid_amount > 0:
  return OVERPAID

if outstanding_amount = 0:
  return PAID

if pending_payment_amount > 0 and total_paid_amount = 0 and total_credit_applied_amount = 0:
  return PENDING_PAYMENT

if pending_payment_amount > 0 and (total_paid_amount > 0 or total_credit_applied_amount > 0):
  return PARTIALLY_PAID

if total_paid_amount + total_credit_applied_amount > 0 and outstanding_amount > 0:
  return PARTIALLY_PAID

if payment_type_code = PAY_ON_COLLECTION:
  return PENDING_COLLECTION

if failed_payment_amount > 0 and total_paid_amount = 0 and total_credit_applied_amount = 0:
  return PAYMENT_FAILED

return UNPAID
```

### 14.3 Gateway-specific mapping

If the UI wants gateway specificity:

```text
PENDING_PAYMENT + gateway rows exist → display PENDING_GATEWAY
```

The stored status can remain `PENDING_PAYMENT` if the enum is smaller.

---

## 15. Algorithm H — AR Invoice Handling

### 15.1 Create AR invoice

Create AR invoice only when:

```text
payment_type_code IN (CREDIT_INVOICE, B2B, INVOICE)
AND ar_receivable_amount > 0
```

Do not create AR invoice for:

```text
PAY_ON_COLLECTION
PAY_NOW fully paid
cash/card/mobile/gateway fully paid
fully credit-applied order
```

### 15.2 AR invoice amount

At creation time:

```text
ar_invoice.total_amount = ar_receivable_amount
ar_invoice.outstanding_amount = ar_receivable_amount
```

### 15.3 AR invoice after partial settlement

Example:

```text
Order total = 2.140
Cash completed = 1.000
Gift card applied = 0.150
Outstanding = 0.990
Payment type = CREDIT_INVOICE
AR invoice total = 0.990
```

### 15.4 AR invoice display

```text
if ar_invoice exists:
  display_ar_receivable_amount = ar_invoice.outstanding_amount
else if payment_type_code in (CREDIT_INVOICE, B2B, INVOICE):
  display_ar_receivable_amount = order.ar_receivable_amount
else:
  display_ar_receivable_amount = 0
```

If order and invoice disagree:

```text
show AR_RECEIVABLE_MISMATCH
```

---

## 16. Algorithm I — Tax Document Handling

### 16.1 Tax document total

Tax document total is always based on fiscal sale value:

```text
tax_document.total_amount = order.total_amount
```

Not:

```text
outstanding_amount
ar_receivable_amount
payment amount
```

### 16.2 Tax document timing

Configurable by tenant/country:

```text
ON_ORDER_SUBMIT
ON_PAYMENT_CONFIRMATION
ON_SERVICE_COMPLETION
ON_DELIVERY
ON_AR_INVOICE_ISSUE
```

Recommended defaults:

```text
Paid retail sale → ON_PAYMENT_CONFIRMATION
PAY_ON_COLLECTION → ON_PAYMENT_CONFIRMATION or ON_DELIVERY
CREDIT_INVOICE/B2B → ON_AR_INVOICE_ISSUE
```

### 16.3 Tax document and stored value

Gift card, wallet, advance, credit note, and customer credit do not reduce tax document total.

They may appear as payment/settlement information only.

---

## 17. Algorithm J — Pending Gateway Flow

### 17.1 Submit order with gateway pending

```text
1. Calculate order total.
2. Create order.
3. Create voucher/payment attempt.
4. Create org_order_payments_dtl with payment_status = PENDING or PROCESSING.
5. Do not increase total_paid_amount.
6. Increase pending_payment_amount.
7. Recalculate outstanding without pending amount.
8. Show pending payment in UI.
```

Example:

```text
Order Total = 2.140
Gift Card Applied = 0.150
Gateway Pending = 1.000

Paid = 0.000
Pending = 1.000
Credits = 0.150
Outstanding = 1.990
Expected if pending confirms = 0.990
```

### 17.2 Gateway success callback

```text
1. Verify callback signature.
2. Idempotently find payment row.
3. Set payment_status = COMPLETED.
4. Set paid_at / provider confirmation fields.
5. Recalculate snapshot.
6. pending_payment_amount decreases.
7. total_paid_amount increases.
8. outstanding_amount decreases.
9. Recalculate payment_status.
```

### 17.3 Gateway failure/refusal/cancel

```text
1. Verify callback signature.
2. Idempotently find payment row.
3. Set payment_status = FAILED / REFUSED / CANCELLED / EXPIRED.
4. Recalculate snapshot.
5. pending_payment_amount decreases.
6. failed_payment_amount increases.
7. total_paid_amount unchanged.
8. outstanding_amount unchanged.
9. Recalculate payment_status.
```

---

## 18. Algorithm K — Order Submit Full Flow

```text
function submitOrder(request):

  validate tenant/branch/customer/currency/payment policy

  normalize items, pieces, preferences, charges, discounts, taxes

  orderValue = calculateOrderValue(...)

  validate commercial discounts

  validate tax calculation

  settlementPlan = buildSettlementPlan(
    payment legs,
    credit application legs,
    orderValue.totalAmount
  )

  validate:
    completed payment amount >= 0
    pending payment amount >= 0
    applied credit amount >= 0
    credit sources exist and have balance
    gift card is credit application, not discount
    pending payments do not count as paid

  begin transaction

    insert org_orders_mst with canonical value fields

    insert item/piece/preference/charge/discount/tax detail rows

    create Business Voucher if payment/credit exists

    create voucher lines:
      ORDER_PAYMENT for real payments
      ORDER_CREDIT_APPLICATION for credits

    post voucher:
      creates org_order_payments_dtl
      creates org_order_credit_apps_dtl
      creates cash drawer movement if cash completed

    snapshot = recalculateOrderFinancialSnapshot(orderId)

    if snapshot.ar_receivable_amount > 0:
      create AR invoice

    if tax policy requires:
      create tax document according to timing policy

    write history/audit/outbox

  commit

  return order detail with financial summary
```

---

## 19. Algorithm L — Order Edit Full Flow

```text
function editOrder(orderId, editRequest):

  acquire edit lock

  load before snapshot

  validate edit policy:
    order status
    payment status
    AR invoice status
    tax document status
    permissions

  preview:
    apply proposed changes in memory
    recalculate order value
    keep existing completed payments and applied credits
    calculate new outstanding
    calculate delta:
      delta = new_total_amount - old_total_amount

  determine required action:
    delta = 0 → no financial action
    delta > 0 → additional collection / AR debit note / tax debit note
    delta < 0 → refund / customer credit / AR credit note / tax credit note

  if approval required:
    create approval request and stop

  begin transaction

    apply operational changes

    update financial detail rows as allowed

    recalculate snapshot

    if AR invoice exists and is issued:
      do not mutate original invoice
      create adjustment/credit/debit workflow

    if tax document issued:
      do not mutate original tax document
      create credit/debit note workflow

    write edit history

    release lock

  commit
```

---

## 20. Algorithm M — Reconciliation Checks

Run after:

```text
order submit
order edit
voucher posting
payment callback
credit application update
refund completion
AR invoice creation/update
tax document creation
backfill migration
manual recalculation
```

### 20.1 Order total component check

```text
expected_total =
  items_base_amount
+ total_charges_amount
- total_discount_amount
+ total_tax_amount
+ rounding_adjustment_amount
```

If not equal:

```text
ORDER_TOTAL_COMPONENT_MISMATCH
```

### 20.2 Discount check

```text
expected_discount =
  SUM(active commercial discount detail rows)
```

If not equal:

```text
DISCOUNT_TOTAL_MISMATCH
```

### 20.3 Tax check

```text
expected_tax =
  SUM(active tax detail rows)
```

If not equal:

```text
TAX_TOTAL_MISMATCH
```

### 20.4 Settlement check

```text
expected_outstanding =
  MAX(total_amount - total_paid_amount - total_credit_applied_amount, 0)
```

If not equal:

```text
OUTSTANDING_MISMATCH
```

### 20.5 Pending payment check

If pending payment rows contribute to `total_paid_amount`:

```text
PENDING_PAYMENT_COUNTED_AS_PAID
```

### 20.6 Gift card double-count check

If gift card appears to reduce total amount and also exists in credits:

```text
GIFT_CARD_DOUBLE_COUNTED
```

### 20.7 Credit-as-discount check

If stored-value credit appears in commercial discounts:

```text
CREDIT_APPLICATION_COUNTED_AS_DISCOUNT
```

### 20.8 AR mismatch check

If AR invoice exists, compare:

```text
order.ar_receivable_amount
invoice.outstanding_amount
```

If mismatch:

```text
AR_RECEIVABLE_MISMATCH
```

### 20.9 Tax document mismatch check

If tax document exists:

```text
tax_document.total_amount should equal order.total_amount
```

If mismatch:

```text
TAX_DOCUMENT_TOTAL_MISMATCH
```

---

## 21. Scenario Algorithms

### 21.1 Fully paid cash

```text
total_amount = 2.140
cash completed = 2.140
credits = 0
outstanding = 0
overpaid = 0
pay_on_collection = 0
ar_receivable = 0
payment_status = PAID
no AR invoice
tax document according to tax policy
```

### 21.2 Partial cash + CREDIT_INVOICE

```text
total_amount = 2.140
cash completed = 1.000
credits = 0
outstanding = 1.140
ar_receivable = 1.140
AR invoice = 1.140
payment_status = PARTIALLY_PAID
```

### 21.3 Cash + gift card + CREDIT_INVOICE

```text
total_amount = 2.140
cash completed = 1.000
gift card applied = 0.150
outstanding = 0.990
ar_receivable = 0.990
AR invoice = 0.990
payment_status = PARTIALLY_PAID
```

### 21.4 Gift card fully covers order

```text
total_amount = 2.140
paid = 0
credit applied = 2.140
outstanding = 0
ar_receivable = 0
payment_status = PAID
no AR invoice
```

### 21.5 Gateway pending

```text
total_amount = 2.140
pending gateway = 1.000
paid = 0
credit applied = 0.150
outstanding = 1.990
expected if pending confirms = 0.990
payment_status = PENDING_PAYMENT
```

### 21.6 Gateway completed

```text
total_amount = 2.140
gateway completed = 1.000
paid = 1.000
credit applied = 0.150
outstanding = 0.990
payment_status = PARTIALLY_PAID
```

### 21.7 Gateway refused

```text
total_amount = 2.140
gateway refused = 1.000
paid = 0
failed payment amount = 1.000
credit applied = 0.150
outstanding = 1.990
payment_status = PAYMENT_FAILED or UNPAID
```

### 21.8 PAY_ON_COLLECTION unpaid

```text
total_amount = 2.140
paid = 0
credits = 0
outstanding = 2.140
pay_on_collection = 2.140
ar_receivable = 0
payment_status = PENDING_COLLECTION
no AR invoice
```

### 21.9 PAY_ON_COLLECTION partially paid

```text
total_amount = 2.140
cash completed = 1.000
credits = 0
outstanding = 1.140
pay_on_collection = 1.140
ar_receivable = 0
payment_status = PARTIALLY_PAID
no AR invoice
```

### 21.10 Commercial discount

```text
gross_amount = 2.500
total_discount_amount = 0.500
net_before_tax = 2.000
tax = 0.140
total_amount = 2.140
```

Gift card is not involved.

### 21.11 Overpayment with change returned

```text
order total = 2.140
cash tendered = 5.000
cash retained = 2.140
change returned = 2.860
total_paid_amount = 2.140
overpaid_amount = 0
payment_status = PAID
```

### 21.12 Overpayment retained as customer credit

```text
order total = 2.140
cash received/retained = 3.000
total_paid_amount = 3.000
overpaid_amount = 0.860
then create customer credit/advance = 0.860
```

Recommended treatment:

```text
allocate only 2.140 to order payment
move 0.860 to customer advance
overpaid_amount = 0
```

### 21.13 Refund after full payment

Original:

```text
total = 2.140
paid = 2.140
outstanding = 0
```

Refund:

```text
refund = 1.000
refunded_amount = 1.000
net_collected = 1.140
payment_status = PARTIALLY_REFUNDED
outstanding remains 0 unless refund reopens due
```

---

## 22. Snapshot Write Algorithm

```text
update org_orders_mst set
  items_base_amount = result.itemsBaseAmount,
  subtotal_amount = result.itemsBaseAmount,

  piece_extra_price_amount = result.pieceExtraPriceAmount,
  preference_extra_price_amount = result.preferenceExtraPriceAmount,

  service_charge_amount = result.serviceChargeAmount,
  delivery_charge_amount = result.deliveryChargeAmount,
  express_charge_amount = result.expressChargeAmount,
  other_charges_amount = result.otherChargesAmount,
  total_charges_amount = result.totalChargesAmount,

  total_discount_amount = result.totalDiscountAmount,
  taxable_amount = result.taxableAmount,
  total_tax_amount = result.totalTaxAmount,
  rounding_adjustment_amount = result.roundingAdjustmentAmount,

  total_amount = result.totalAmount,

  total_paid_amount = settlement.totalPaidAmount,
  pending_payment_amount = settlement.pendingPaymentAmount,
  failed_payment_amount = settlement.failedPaymentAmount,

  total_credit_applied_amount = settlement.totalCreditAppliedAmount,
  pending_credit_application_amount = settlement.pendingCreditApplicationAmount,
  failed_credit_application_amount = settlement.failedCreditApplicationAmount,

  refunded_amount = refund.refundedAmount,
  net_collected_amount = refund.netCollectedAmount,

  outstanding_amount = balance.outstandingAmount,
  overpaid_amount = balance.overpaidAmount,
  change_returned_amount = balance.changeReturnedAmount,

  pay_on_collection_amount = collection.payOnCollectionAmount,
  ar_receivable_amount = collection.arReceivableAmount,

  payment_status = resolvedPaymentStatus,

  financial_last_calculated_at = now(),
  financial_last_calculated_by = current_user,
  financial_snapshot_status = warnings.empty ? 'CURRENT' : 'MISMATCH',
  financial_mismatch_warning_count = warnings.length
where id = order_id
  and tenant_org_id = tenant_org_id;
```

---

## 23. Required Tests

### 23.1 Sale total tests

```text
gift card does not reduce total_amount
wallet does not reduce total_amount
customer advance does not reduce total_amount
credit note does not reduce total_amount
commercial discount reduces total_amount
tax row increases total_amount
```

### 23.2 Settlement tests

```text
completed payment reduces outstanding
pending payment does not reduce outstanding
failed payment does not reduce outstanding
applied credit reduces outstanding
pending credit does not reduce outstanding
```

### 23.3 AR tests

```text
PAY_ON_COLLECTION creates no AR invoice
fully paid cash creates no AR invoice
CREDIT_INVOICE creates AR invoice for outstanding
gift card + cash + CREDIT_INVOICE creates AR invoice for remaining amount
AR display prefers invoice outstanding
```

### 23.4 Tax tests

```text
gift card does not reduce taxable_amount
gift card does not reduce total_tax_amount
tax document total equals order total
commercial discount affects taxable amount according to policy
multiple tax rows sum into total_tax_amount
```

### 23.5 Gateway tests

```text
gateway pending appears in pending_payment_amount
gateway pending not in total_paid_amount
gateway success moves amount to total_paid_amount
gateway failure moves amount to failed_payment_amount
```

### 23.6 Refund tests

```text
cash refund updates refunded_amount
net_collected_amount decreases after refund
gift card restoration does not create cash refund
refund does not reopen outstanding unless policy says so
```

### 23.7 Reconciliation tests

```text
detect total component mismatch
detect tax mismatch
detect discount mismatch
detect pending payment counted as paid
detect AR receivable mismatch
detect gift card double count
```

---

## 24. Implementation Checklist

```text
[ ] Confirm canonical columns only.
[ ] Remove all legacy-column usage from new logic.
[ ] Implement Decimal-based calculation service.
[ ] Implement settlement calculation service.
[ ] Implement credit application calculation service.
[ ] Implement refund calculation service.
[ ] Implement AR classification service.
[ ] Implement tax document decision service.
[ ] Implement payment status resolver.
[ ] Implement reconciliation service.
[ ] Implement snapshot writer.
[ ] Implement Order Details read model.
[ ] Implement test suite for all scenarios.
[ ] Add repair/backfill scripts for historical rows only if needed.
```

---

## 25. Final Canonical Formula Block

```text
items_base_amount =
  SUM(active item final line amounts)

piece_extra_price_amount =
  SUM(active piece extra prices)

preference_extra_price_amount =
  SUM(active preference extra prices)

total_charges_amount =
  if extra_price_pricing_mode = INCLUDED_IN_ITEM_PRICE:
    service_charge_amount
  + delivery_charge_amount
  + express_charge_amount
  + other_charges_amount

  if extra_price_pricing_mode = SEPARATE_CHARGE:
    piece_extra_price_amount
  + preference_extra_price_amount
  + service_charge_amount
  + delivery_charge_amount
  + express_charge_amount
  + other_charges_amount

gross_amount =
  items_base_amount
+ total_charges_amount

total_discount_amount =
  SUM(active applied commercial discounts)

net_before_tax_amount =
  MAX(gross_amount - total_discount_amount, 0)

taxable_amount =
  SUM(taxable amounts from tax engine/detail rows)

total_tax_amount =
  SUM(active tax row amounts)

total_amount =
  net_before_tax_amount
+ total_tax_amount
+ rounding_adjustment_amount

total_paid_amount =
  SUM(completed real payments)

pending_payment_amount =
  SUM(pending/processing/authorized real payment attempts)

failed_payment_amount =
  SUM(failed/refused/cancelled/expired real payment attempts)

total_credit_applied_amount =
  SUM(applied stored-value/customer-credit applications)

pending_credit_application_amount =
  SUM(pending/reserved/processing credit applications)

failed_credit_application_amount =
  SUM(failed/cancelled/reversed/expired credit applications)

refunded_amount =
  SUM(completed refunds)

net_collected_amount =
  MAX(total_paid_amount - refunded_amount, 0)

outstanding_amount =
  MAX(total_amount - total_paid_amount - total_credit_applied_amount, 0)

overpaid_amount =
  MAX(total_paid_amount + total_credit_applied_amount - total_amount, 0)

pay_on_collection_amount =
  if payment_type_code = PAY_ON_COLLECTION:
    outstanding_amount
  else:
    0

ar_receivable_amount =
  if payment_type_code in (CREDIT_INVOICE, B2B, INVOICE):
    outstanding_amount
  else:
    0

tax_document_total_amount =
  total_amount
```

---

## 26. Final Non-Negotiable Rules

```text
1. total_amount is never reduced by payment or stored-value credit.
2. Gift card is never a discount.
3. Wallet is never a discount.
4. Customer advance is never a discount.
5. Credit note/customer credit is never a discount.
6. Pending payment is never paid.
7. Failed payment is never paid.
8. PAY_ON_COLLECTION is not AR.
9. AR invoice amount is receivable only.
10. Tax document amount is fiscal sale total.
11. Issued AR/tax documents are not silently rewritten.
12. Reconciliation warnings must expose mismatch, not hide it.
```
