Below is the **full non-simplified Order Financial Calculation Rules / Flow** to implement for **all cases and situations**.

This is the canonical logic for:

```text
Order Submit
Order Edit
Order Details Financial Summary
Business Voucher Wiring
Credit Applications
Pending Gateway Payments
PAY_ON_COLLECTION
CREDIT_INVOICE / B2B
Refunds
Tax Documents
AR Invoice
```

---

# 1. Core principle

The system should calculate in this order:

```text
1. Build order value
2. Apply commercial discounts/promotions
3. Calculate tax
4. Calculate final sale total
5. Apply completed real payments
6. Apply stored-value/customer-credit applications
7. Track pending payments separately
8. Calculate outstanding / overpaid
9. Classify outstanding as pay-on-collection or AR receivable
10. Create/update AR invoice only for receivable cases
11. Create/update tax document separately
12. Reconcile and warn if mismatch
```

The most important rule:

```text
Order Total is the sale value.
Payments and credits do not reduce Order Total.
Payments and credits reduce Outstanding Balance.
```

---

# 2. Canonical field meanings

## 2.1 Sale / order value fields

```text
items_base_amount
= base item/service final line amount

piece_extra_price_amount
= breakdown of piece extra prices

preference_extra_price_amount
= breakdown of preference extra prices

service_charge_amount
= service charge

delivery_charge_amount
= delivery charge

express_charge_amount
= express/urgent service charge

other_charges_amount
= manual/system/other charges

total_charges_amount
= charge total used in sale calculation

total_discount_amount
= commercial discounts only

taxable_amount
= taxable base calculated by tax engine

total_tax_amount
= total taxes from order tax rows

rounding_adjustment_amount
= rounding difference

total_amount
= full final sale amount
```

Current mode:

```text
piece_extra_price_amount and preference_extra_price_amount are included inside items_base_amount.

Therefore they are visible breakdowns only and must not be added again to total_charges_amount.
```

---

## 2.2 Settlement fields

```text
total_paid_amount
= completed real payments only

pending_payment_amount
= pending / processing / authorized payment attempts

failed_payment_amount
= failed / refused / cancelled payment attempts, audit only

total_credit_applied_amount
= applied stored-value/customer-credit applications

refunded_amount
= completed refunds

net_collected_amount
= total_paid_amount - refunded_amount

outstanding_amount
= remaining amount due

overpaid_amount
= excess completed payment/credit over order total

change_returned_amount
= cash change returned to customer
```

---

## 2.3 Collection / AR fields

```text
pay_on_collection_amount
= amount to collect at pickup/delivery

ar_receivable_amount
= amount transferred to AR/customer receivable

ar_invoice_id
= linked AR invoice only when receivable exists
```

---

## 2.4 Tax document fields

```text
tax_document_id
tax_document_no
tax_document_status
tax_document_type
```

Tax document is separate from AR invoice.

---

# 3. Step-by-step calculation flow

## Step 1 — Load all source records

For calculation, load:

```text
org_orders_mst
org_order_items_dtl
org_order_item_pieces_dtl
org_order_preferences_dtl
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_payments_dtl
org_order_credit_apps_dtl
org_order_refunds_dtl
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
org_invoice_mst
all org_invoice_* detailed tables of org_invoice_mst
org_tax_documents_mst if exists
```

Rules:

```text
Use active rows only unless audit/debug mode.
Exclude cancelled/reversed rows unless explicitly calculating history.
```

---

# 4. Order value calculation

## 4.1 Items base amount

Current mode:

```text
items_base_amount =
  SUM(active order item final line amounts)
```

The item final line amount may already include:

```text
base service price
piece extra price
preference extra price
item-level add-ons
```

If item line total is not stored:

```text
items_base_amount =
  SUM(quantity * unit_price)
+ SUM(piece extra price if included mode)
+ SUM(preference extra price if included mode)
```

---

## 4.2 Piece extra price amount

```text
piece_extra_price_amount =
  SUM(active org_order_item_pieces_dtl.extra_price)
```

If pieces have quantity:

```text
piece_extra_price_amount =
  SUM(piece_quantity * extra_price)
```

Current implementation rule:

```text
piece_extra_price_amount is a breakdown only.
Do not add it again to total_charges_amount if included in items_base_amount.
```

Future separate-charge mode:

```text
piece_extra_price_amount may be projected into org_order_charges_dtl
charge_type = PIECE_EXTRA_PRICE
```

---

## 4.3 Preference extra price amount

```text
preference_extra_price_amount =
  SUM(active org_order_preferences_dtl.extra_price * quantity)
```

Current implementation rule:

```text
preference_extra_price_amount is a breakdown only.
Do not add it again to total_charges_amount if included in items_base_amount.
```

Future separate-charge mode:

```text
preference_extra_price_amount may be projected into org_order_charges_dtl
charge_type = PREFERENCE_EXTRA_PRICE
```

---

## 4.4 Charges

```text
service_charge_amount =
  SUM(active charges where charge_type = SERVICE_CHARGE)

delivery_charge_amount =
  SUM(active charges where charge_type = DELIVERY_CHARGE)

express_charge_amount =
  SUM(active charges where charge_type = EXPRESS_CHARGE)

other_charges_amount =
  SUM(active charges where charge_type in MANUAL_CHARGE, OTHER_CHARGE, SYSTEM_CHARGE)
```

Current mode formula:

```text
total_charges_amount =
  service_charge_amount
+ delivery_charge_amount
+ express_charge_amount
+ other_charges_amount
```

Future separate-charge formula:

```text
total_charges_amount =
  piece_extra_price_amount
+ preference_extra_price_amount
+ service_charge_amount
+ delivery_charge_amount
+ express_charge_amount
+ other_charges_amount
```

Implementation must support a configuration flag:

```text
extra_price_pricing_mode =
  INCLUDED_IN_ITEM_PRICE
  SEPARATE_CHARGE
```

Current default:

```text
INCLUDED_IN_ITEM_PRICE
```

---

## 4.5 Gross amount

```text
gross_amount =
  items_base_amount
+ total_charges_amount
```

Gross amount is before commercial discounts and tax.

---

# 5. Discounts / promotions calculation

## 5.1 Commercial discount types

Include:

```text
LINE_DISCOUNT
MANUAL_DISCOUNT
PROMO_CODE_DISCOUNT
COUPON_DISCOUNT
CAMPAIGN_DISCOUNT
RULE_DISCOUNT
APPROVED_MANAGER_DISCOUNT
LOYALTY_DISCOUNT if promotion-style
```

Exclude:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
LOYALTY_VALUE if stored-value
```

---

## 5.2 Discount amount

```text
total_discount_amount =
  SUM(active applied commercial discounts)
```

Do not calculate:

```text
discount + promo_discount_amount + total_discount_amount
```

`total_discount_amount` is canonical.

Legacy columns are not canonical.

---

## 5.3 Discount validation

Rules:

```text
Discount amount >= 0
Discount cannot exceed eligible gross amount unless negative sale is explicitly allowed
Manual discount may require permission
Discount over threshold may require approval
Promo/coupon must be valid and not expired
Promotion must be allowed for tenant/branch/customer/order type
```

---

## 5.4 Net before tax

```text
net_before_tax_amount =
  MAX(gross_amount - total_discount_amount, 0)
```

If negative sales are explicitly enabled:

```text
net_before_tax_amount =
  gross_amount - total_discount_amount
```

Default:

```text
No negative sale total.
```

---

# 6. Tax calculation

## 6.1 Taxable amount

Tax engine calculates taxable amount from eligible lines:

```text
taxable_amount =
  taxable_items_amount
+ taxable_charges_amount
- taxable_discount_amount
```

Important:

```text
Stored-value credits do not reduce taxable_amount.
```

So these must not reduce taxable amount:

```text
gift card
wallet
customer advance
credit note
customer credit
loyalty stored value
```

---

## 6.2 Tax amount

Tax amount comes from tax detail rows:

```text
total_tax_amount =
  SUM(active org_order_taxes_dtl.tax_amount)
```

Examples:

```text
VAT 5%
Municipal fee
Other local tax
```

Do not calculate:

```text
tax + vat_amount + total_tax_amount
```

Canonical tax summary:

```text
total_tax_amount
```

Preferred source of truth:

```text
org_order_taxes_dtl
```

---

## 6.3 Tax detail example

```text
VAT 5%                         0.100
Municipal Fee                  0.040
Total Tax                      0.140
```

Tax display should show the detail rows, not only the summary.

---

# 7. Rounding calculation

```text
rounding_adjustment_amount =
  configured rounding difference
```

Can be:

```text
positive
zero
negative
```

Example:

```text
pre_round_total = 10.236
rounding_adjustment_amount = -0.006
total_amount = 10.230
```

---

# 8. Final sale total

Canonical formula:

```text
total_amount =
  net_before_tax_amount
+ total_tax_amount
+ rounding_adjustment_amount
```

Expanded:

```text
total_amount =
  (
    items_base_amount
  + total_charges_amount
  - total_discount_amount
  )
+ total_tax_amount
+ rounding_adjustment_amount
```

Current mode:

```text
items_base_amount already includes piece/preference extras
```

So do not add them separately again.

---

# 9. Real payment calculation

## 9.1 Completed real payments

Include only:

```text
payment_status = COMPLETED
```

Formula:

```text
total_paid_amount =
  SUM(org_order_payments_dtl.amount)
  WHERE payment_status = COMPLETED
```

Payment methods included when completed:

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

---

## 9.2 Pending payment attempts

Include:

```text
PENDING
PROCESSING
AUTHORIZED
```

Formula:

```text
pending_payment_amount =
  SUM(org_order_payments_dtl.amount)
  WHERE payment_status IN (PENDING, PROCESSING, AUTHORIZED)
```

Important:

```text
pending_payment_amount does not reduce outstanding_amount.
```

It is visible only.

---

## 9.3 Failed payment attempts

Include:

```text
FAILED
CANCELLED
REFUSED
EXPIRED
```

Formula:

```text
failed_payment_amount =
  SUM(org_order_payments_dtl.amount)
  WHERE payment_status IN (FAILED, CANCELLED, REFUSED, EXPIRED)
```

Important:

```text
failed_payment_amount is audit only.
It does not reduce outstanding_amount.
```

---

## 9.4 Payment status effect matrix

| Payment Row Status |              Count in Paid? | Count in Pending? |  Reduces Outstanding? |
| ------------------ | --------------------------: | ----------------: | --------------------: |
| `PENDING`          |                          No |               Yes |                    No |
| `PROCESSING`       |                          No |               Yes |                    No |
| `AUTHORIZED`       |                          No |               Yes |                    No |
| `COMPLETED`        |                         Yes |                No |                   Yes |
| `FAILED`           |                          No |                No |                    No |
| `CANCELLED`        |                          No |                No |                    No |
| `REFUSED`          |                          No |                No |                    No |
| `EXPIRED`          |                          No |                No |                    No |
| `REVERSED`         |                          No |                No |                    No |
| `REFUNDED`         | No direct; use refund logic |                No | Depends refund policy |

---

# 10. Credit application calculation

## 10.1 Applied credit applications

Include only:

```text
application_status = APPLIED
```

Formula:

```text
total_credit_applied_amount =
  SUM(org_order_credit_apps_dtl.amount)
  WHERE application_status = APPLIED
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

---

## 10.2 Pending credit applications

Optional but recommended:

```text
pending_credit_application_amount =
  SUM(amount)
  WHERE application_status IN (PENDING, RESERVED, PROCESSING)
```

These do not reduce outstanding unless policy says reserved credit is guaranteed.

Default:

```text
Only APPLIED credit reduces outstanding.
```

---

## 10.3 Failed/reversed credits

```text
FAILED
CANCELLED
REVERSED
EXPIRED
```

Do not reduce outstanding.

---

## 10.4 Gift card rule

Gift card:

```text
is credit application
is not discount
is not real payment
does not reduce taxable amount
does not reduce total tax
does not reduce order total
does reduce outstanding after application
```

---

# 11. Refund calculation

## 11.1 Completed refunds

```text
refunded_amount =
  SUM(org_order_refunds_dtl.amount)
  WHERE refund_status = COMPLETED
```

Refund methods may include:

```text
cash refund
card/gateway refund
wallet credit
gift card restoration
customer credit
credit note
```

---

## 11.2 Net collected

```text
net_collected_amount =
  total_paid_amount - cash_or_real_payment_refunded_amount
```

If using one generic `refunded_amount`:

```text
net_collected_amount =
  MAX(total_paid_amount - refunded_amount, 0)
```

Better future split:

```text
real_payment_refunded_amount
credit_reversed_amount
store_credit_issued_amount
```

---

## 11.3 Refund effect on outstanding

Default rule:

```text
Refunds do not automatically reopen outstanding unless refund policy explicitly says so.
```

If refund reopens due:

```text
outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
+ refund_reopens_due_amount
```

Default current formula:

```text
outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

---

# 12. Outstanding and overpaid calculation

## 12.1 Outstanding amount

```text
raw_outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

```text
outstanding_amount =
  MAX(raw_outstanding_amount, 0)
```

If refund reopens due:

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

---

## 12.2 Overpaid amount

```text
overpaid_amount =
  MAX(
    total_paid_amount
  + total_credit_applied_amount
  - total_amount,
    0
  )
```

Overpaid amount may trigger:

```text
change return
customer credit
refund
advance balance
```

---

## 12.3 Change returned

For cash:

```text
change_returned_amount =
  cash_tendered_amount - cash_retained_amount
```

Change returned is not a payment.

Example:

```text
Cash tendered = 5.000
Order due = 2.140
Cash retained = 2.140
Change returned = 2.860
total_paid_amount = 2.140
```

---

# 13. Pending payment calculation

## 13.1 Expected balance if pending confirms

This is display-only:

```text
expected_balance_if_pending_confirms =
  MAX(outstanding_amount - pending_payment_amount, 0)
```

It must not be stored as real outstanding unless required for UI performance.

---

## 13.2 Pending payment examples

### Gateway pending

```text
Order Total = 2.140
Paid = 0.000
Pending Gateway = 1.000
Credit Applied = 0.150
Outstanding = 1.990
Expected if pending confirms = 0.990
```

### Gateway completed

```text
Order Total = 2.140
Paid = 1.000
Pending Gateway = 0.000
Credit Applied = 0.150
Outstanding = 0.990
```

### Gateway refused

```text
Order Total = 2.140
Paid = 0.000
Pending Gateway = 0.000
Failed Payment = 1.000
Credit Applied = 0.150
Outstanding = 1.990
```

---

# 14. Payment plan classification

## 14.1 PAY_NOW / PAY_IN_ADVANCE

If no outstanding:

```text
payment_status = PAID
```

If pending gateway:

```text
payment_status = PENDING_PAYMENT or PENDING_GATEWAY
```

If partially paid:

```text
payment_status = PARTIALLY_PAID
```

---

## 14.2 PAY_ON_COLLECTION

Rules:

```text
pay_on_collection_amount = outstanding_amount
ar_receivable_amount = 0
no AR invoice
no AR ledger debit
```

If paid later:

```text
receipt voucher
order payment row
recalculate total_paid_amount
reduce pay_on_collection_amount
```

---

## 14.3 CREDIT_INVOICE / B2B / INVOICE

Rules:

```text
ar_receivable_amount = outstanding_amount
pay_on_collection_amount = 0
AR invoice may be created for ar_receivable_amount
AR ledger debit created only for AR invoice
```

If no outstanding:

```text
ar_receivable_amount = 0
no AR invoice required
payment_status = PAID
```

---

# 15. AR invoice calculation

## 15.1 When to create AR invoice

Create AR invoice only when:

```text
payment_type_code IN (CREDIT_INVOICE, INVOICE, B2B)
AND outstanding_amount > 0
```

Do not create AR invoice for:

```text
fully paid cash/card/mobile/gateway
PAY_ON_COLLECTION
fully credit-applied order
```

---

## 15.2 AR invoice amount

```text
ar_invoice.total_amount =
  ar_receivable_amount
```

Where:

```text
ar_receivable_amount =
  outstanding_amount
```

for AR payment types.

---

## 15.3 AR invoice after partial payment and credits

Example:

```text
Order total = 2.140
Cash paid = 1.000
Gift card applied = 0.150
Outstanding = 0.990
CREDIT_INVOICE
AR invoice amount = 0.990
```

---

## 15.4 AR invoice display

If AR invoice exists:

```text
display_ar_receivable_amount =
  org_invoice_mst.outstanding_amount
```

If AR invoice does not exist but payment plan is AR:

```text
display_ar_receivable_amount =
  order.outstanding_amount
```

If mismatch:

```text
show AR_RECEIVABLE_MISMATCH warning
```

---

# 16. Tax document calculation

Tax document is fiscal/legal.

## 16.1 Tax document total

```text
tax_document.total_amount =
  order.total_amount
```

Not:

```text
ar_receivable_amount
```

Not:

```text
outstanding_amount
```

---

## 16.2 Tax document payment display

Tax document may show:

```text
total sale
paid amount
credit applied
outstanding/unpaid amount
payment method
```

But its fiscal total remains:

```text
order.total_amount
```

---

## 16.3 Tax document scenarios

| Scenario                  | Tax Document Total |  AR Invoice Amount |
| ------------------------- | -----------------: | -----------------: |
| Cash sale                 |        order total |                  0 |
| Gift card sale settlement |        order total |        0 unless AR |
| PAY_ON_COLLECTION         | depends tax timing |                  0 |
| CREDIT_INVOICE            |        order total |        outstanding |
| Refund                    | credit note amount | depends AR context |

---

# 17. Payment status calculation

## 17.1 Required order-level statuses

Recommended:

```text
UNPAID
PENDING_PAYMENT
PENDING_GATEWAY
PENDING_COLLECTION
PARTIALLY_PAID
PAID
PAYMENT_FAILED
PARTIALLY_REFUNDED
REFUNDED
CANCELLED
```

Optional:

```text
PARTIALLY_PAID_WITH_PENDING
OVERPAID
INVOICED
```

---

## 17.2 Status algorithm

```text
if order is cancelled:
  payment_status = CANCELLED

else if refunded_amount > 0 and refunded_amount < total_paid_amount:
  payment_status = PARTIALLY_REFUNDED

else if refunded_amount >= total_paid_amount and total_paid_amount > 0:
  payment_status = REFUNDED

else if outstanding_amount = 0 and overpaid_amount = 0:
  payment_status = PAID

else if overpaid_amount > 0:
  payment_status = OVERPAID

else if pending_payment_amount > 0 and total_paid_amount = 0:
  payment_status = PENDING_PAYMENT

else if pending_payment_amount > 0 and total_paid_amount > 0:
  payment_status = PARTIALLY_PAID

else if total_paid_amount + total_credit_applied_amount > 0 and outstanding_amount > 0:
  payment_status = PARTIALLY_PAID

else if payment_type_code = PAY_ON_COLLECTION:
  payment_status = PENDING_COLLECTION

else:
  payment_status = UNPAID
```

If using simpler enum, map:

```text
OVERPAID → PAID with overpaid_amount > 0
PARTIALLY_PAID_WITH_PENDING → PARTIALLY_PAID
PENDING_GATEWAY → PENDING_PAYMENT
```

---

# 18. Scenario matrix

## 18.1 Fully paid cash

```text
Order Total = 2.140
Cash Completed = 2.140
Credits = 0
Outstanding = 0
Payment Status = PAID
AR = 0
Pay on Collection = 0
```

---

## 18.2 Cash partial + credit invoice

```text
Order Total = 2.140
Cash Completed = 1.000
Credits = 0
Outstanding = 1.140
Payment Type = CREDIT_INVOICE
AR Receivable = 1.140
AR Invoice = 1.140
Payment Status = PARTIALLY_PAID
```

---

## 18.3 Cash + gift card + credit invoice

```text
Order Total = 2.140
Cash Completed = 1.000
Gift Card Applied = 0.150
Outstanding = 0.990
Payment Type = CREDIT_INVOICE
AR Receivable = 0.990
AR Invoice = 0.990
```

---

## 18.4 Gift card fully covers order

```text
Order Total = 2.140
Paid = 0
Credit Applied = 2.140
Outstanding = 0
Payment Status = PAID
AR Receivable = 0
No AR Invoice
```

---

## 18.5 Gateway pending

```text
Order Total = 2.140
Gateway Pending = 1.000
Paid = 0
Credit Applied = 0.150
Outstanding = 1.990
Expected if pending confirms = 0.990
Payment Status = PENDING_PAYMENT
```

---

## 18.6 Gateway completed

```text
Order Total = 2.140
Gateway Completed = 1.000
Paid = 1.000
Credit Applied = 0.150
Outstanding = 0.990
Payment Status = PARTIALLY_PAID
```

---

## 18.7 Gateway failed/refused

```text
Order Total = 2.140
Gateway Failed = 1.000
Paid = 0
Credit Applied = 0.150
Outstanding = 1.990
Payment Status = UNPAID or PAYMENT_FAILED
```

---

## 18.8 PAY_ON_COLLECTION

```text
Order Total = 2.140
Paid = 0
Credit Applied = 0
Outstanding = 2.140
Pay on Collection = 2.140
AR Receivable = 0
No AR Invoice
Payment Status = PENDING_COLLECTION
```

---

## 18.9 PAY_ON_COLLECTION with partial payment

```text
Order Total = 2.140
Cash Paid = 1.000
Outstanding = 1.140
Pay on Collection = 1.140
AR Receivable = 0
Payment Status = PARTIALLY_PAID or PENDING_COLLECTION depending UI policy
```

Recommended:

```text
payment_status = PARTIALLY_PAID
payment_type_code = PAY_ON_COLLECTION
pay_on_collection_amount = 1.140
```

---

## 18.10 Commercial discount

```text
Gross = 2.500
Commercial Discount = 0.500
Net Before Tax = 2.000
Tax = 0.140
Order Total = 2.140
```

Gift card is not involved in discount.

---

## 18.11 Refund

Original:

```text
Order Total = 2.140
Paid = 2.140
Outstanding = 0
```

Refund cash 1.000:

```text
Refunded = 1.000
Net Collected = 1.140
Outstanding remains 0 unless refund reopens due
Payment Status = PARTIALLY_REFUNDED
```

If refund is because order total reduced:

```text
Order edit creates credit/refund workflow
Tax credit note may be required
```

---

## 18.12 Overpayment

```text
Order Total = 2.140
Paid = 3.000
Credits = 0
Outstanding = 0
Overpaid = 0.860
```

Action:

```text
return change
create customer credit
refund
```

If cash tendered:

```text
cash retained = 2.140
change returned = 0.860
total_paid_amount = 2.140
overpaid_amount = 0
```

If overpayment is intentionally retained:

```text
overpaid_amount = 0.860
customer credit/advance created
```

---

# 19. Business Voucher integration flow

## 19.1 Submit order with settlement

```text
1. Calculate order value.
2. Save order/items/pieces/preferences/charges/discounts/taxes.
3. Build settlement plan.
4. Create receipt voucher if payment/credit exists.
5. Create ORDER_PAYMENT voucher lines for real payments.
6. Create ORDER_CREDIT_APPLICATION voucher lines for stored-value credits.
7. Post voucher.
8. Voucher wiring creates org_order_payments_dtl and org_order_credit_apps_dtl.
9. Recalculate order financial snapshot.
10. Create AR invoice only if AR receivable exists.
11. Create tax document according to tax policy.
```

---

## 19.2 Gateway pending voucher

```text
ORDER_PAYMENT voucher line
payment_status = PENDING / PROCESSING
org_order_payments_dtl.payment_status = PENDING / PROCESSING
total_paid_amount not increased
pending_payment_amount increased
outstanding unchanged
```

---

## 19.3 Gateway callback success

```text
payment_status = COMPLETED
pending_payment_amount decreases
total_paid_amount increases
outstanding recalculates
payment_status recalculates
```

---

## 19.4 Gateway callback failure

```text
payment_status = FAILED / REFUSED / CANCELLED
pending_payment_amount decreases
failed_payment_amount increases
total_paid_amount unchanged
outstanding unchanged
```

---

# 20. Order edit recalculation flow

When editing an order:

```text
1. Lock order.
2. Load before financial snapshot.
3. Apply item/piece/preference/charge/discount/tax changes.
4. Recalculate total_amount.
5. Keep existing completed payments and applied credits.
6. Recalculate outstanding_amount.
7. Compare old total vs new total.
8. Determine delta.
```

Delta:

```text
delta = new_total_amount - old_total_amount
```

Cases:

```text
delta = 0 → no financial action
delta > 0 → additional amount due / debit note / AR adjustment
delta < 0 → refund / customer credit / credit note / reduce outstanding
```

Issued tax document:

```text
do not mutate
use credit note or debit note
```

Issued AR invoice:

```text
do not silently rewrite
use AR adjustment/credit/debit note depending status
```

---

# 21. Reconciliation checks

Run after submit/edit/payment callback/refund/backfill.

## 21.1 Order total component check

```text
expected_total_amount =
  items_base_amount
+ total_charges_amount
- total_discount_amount
+ total_tax_amount
+ rounding_adjustment_amount
```

Warning if:

```text
expected_total_amount != total_amount
```

Code:

```text
ORDER_TOTAL_COMPONENT_MISMATCH
```

---

## 21.2 Credit double-count check

If gift card applied:

```text
gift card must not reduce total_amount
gift card must be included in total_credit_applied_amount
```

Warning if:

```text
GIFT_CARD_DOUBLE_COUNTED
```

---

## 21.3 Settlement check

```text
expected_outstanding =
  MAX(total_amount - total_paid_amount - total_credit_applied_amount, 0)
```

Warning if:

```text
expected_outstanding != outstanding_amount
```

Code:

```text
OUTSTANDING_MISMATCH
```

---

## 21.4 Pending payment check

Warning if:

```text
pending payments are counted in total_paid_amount
```

Code:

```text
PENDING_PAYMENT_COUNTED_AS_PAID
```

---

## 21.5 AR invoice check

If AR invoice exists:

```text
order.ar_receivable_amount should equal invoice.outstanding_amount
```

Warning if mismatch:

```text
AR_RECEIVABLE_MISMATCH
```

---

## 21.6 Tax check

```text
total_tax_amount = sum(org_order_taxes_dtl.tax_amount)
```

Warning if mismatch:

```text
TAX_TOTAL_MISMATCH
```

---

## 21.7 Discount check

```text
total_discount_amount = sum(active commercial discount rows)
```

Warning if mismatch:

```text
DISCOUNT_TOTAL_MISMATCH
```

---

# 22. Final implementation algorithm

Use this algorithm in calculation service:

```text
function recalculateOrderFinancialSnapshot(orderId):

  source = loadOrderFinancialSources(orderId)

  itemsBaseAmount = calculateItemsBaseAmount(source.items, source.pieces, source.preferences)

  pieceExtraPriceAmount = calculatePieceExtraBreakdown(source.pieces)

  preferenceExtraPriceAmount = calculatePreferenceExtraBreakdown(source.preferences)

  chargeBreakdown = calculateCharges(source.charges)

  if extraPricingMode = INCLUDED_IN_ITEM_PRICE:
    totalChargesAmount =
      serviceChargeAmount
    + deliveryChargeAmount
    + expressChargeAmount
    + otherChargesAmount
  else:
    totalChargesAmount =
      pieceExtraPriceAmount
    + preferenceExtraPriceAmount
    + serviceChargeAmount
    + deliveryChargeAmount
    + expressChargeAmount
    + otherChargesAmount

  grossAmount =
    itemsBaseAmount
  + totalChargesAmount

  totalDiscountAmount =
    sumAppliedCommercialDiscounts(source.discounts)

  netBeforeTaxAmount =
    max(grossAmount - totalDiscountAmount, 0)

  taxResult =
    calculateTax(source.taxRows, netBeforeTaxAmount)

  taxableAmount =
    taxResult.taxableAmount

  totalTaxAmount =
    taxResult.totalTaxAmount

  totalAmount =
    netBeforeTaxAmount
  + totalTaxAmount
  + roundingAdjustmentAmount

  totalPaidAmount =
    sumPaymentsByStatus(source.payments, COMPLETED)

  pendingPaymentAmount =
    sumPaymentsByStatus(source.payments, PENDING, PROCESSING, AUTHORIZED)

  failedPaymentAmount =
    sumPaymentsByStatus(source.payments, FAILED, CANCELLED, REFUSED, EXPIRED)

  totalCreditAppliedAmount =
    sumCreditAppsByStatus(source.creditApps, APPLIED)

  refundedAmount =
    sumRefundsByStatus(source.refunds, COMPLETED)

  netCollectedAmount =
    max(totalPaidAmount - refundedAmount, 0)

  rawOutstanding =
    totalAmount - totalPaidAmount - totalCreditAppliedAmount

  outstandingAmount =
    max(rawOutstanding, 0)

  overpaidAmount =
    max(totalPaidAmount + totalCreditAppliedAmount - totalAmount, 0)

  if paymentTypeCode = PAY_ON_COLLECTION:
    payOnCollectionAmount = outstandingAmount
    arReceivableAmount = 0
  else if paymentTypeCode in CREDIT_INVOICE, INVOICE, B2B:
    payOnCollectionAmount = 0
    arReceivableAmount = outstandingAmount
  else:
    payOnCollectionAmount = 0
    arReceivableAmount = 0

  paymentStatus =
    resolvePaymentStatus(
      totalAmount,
      totalPaidAmount,
      pendingPaymentAmount,
      totalCreditAppliedAmount,
      outstandingAmount,
      overpaidAmount,
      refundedAmount,
      paymentTypeCode
    )

  warnings =
    runReconciliationChecks(...)

  update org_orders_mst snapshot
```

---

# 23. Final implementation rules

```text
1. Gift card is never a discount.
2. Wallet/advance/credit note/customer credit are never discounts.
3. Pending payment is never paid.
4. Failed payment is never paid.
5. Order total is never reduced by payment or credit.
6. AR invoice is created only for receivable amount.
7. PAY_ON_COLLECTION is not AR.
8. Tax document total equals sale total, not receivable.
9. Issued tax documents are immutable.
10. Issued AR invoices are not silently rewritten.
11. Legacy fields must not drive new financial summary.
12. Reconciliation warnings must expose mismatches.
```

This is the full non-simplified calculation rule set that should be implemented.
