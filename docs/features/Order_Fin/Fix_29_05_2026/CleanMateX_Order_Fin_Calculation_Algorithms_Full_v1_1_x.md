# CleanMateX Order Finance Calculation Algorithms — Full Production Specification

**Document Type:** Engineering Algorithm Specification  
**Module:** Order Finance / Order Submit / Order Edit / Settlement / Business Voucher / AR / Tax Documents / Payments / Refunds  
**Version:** v1.1  
**Status:** Production Baseline for Implementation  
**Assumption:** Legacy order amount columns are already dropped. Only canonical Order Fin columns are used.  
**Target Users:** Codex, backend engineers, frontend engineers, QA, finance/accounting reviewers, compliance reviewers  
**Core Rule:** `Order Total` is the full sale/service value. Payments and stored-value credits reduce outstanding, not order total.

---

# 0. Executive Decision

CleanMateX Order Finance must use four separate financial concepts:

```text
1. Order Value
   What the customer bought.

2. Settlement
   How the order was paid, credited, refunded, pending, or failed.

3. Receivable / Collection
   What remains due and whether it is pay-on-collection or AR/customer receivable.

4. Tax Document
   Fiscal/legal/e-invoicing document, separate from AR invoice.
```

The most important non-negotiable rule:

```text
total_amount = full sale value after commercial discounts, tax, and rounding.
total_amount is never reduced by payment, gift card, wallet, advance, credit note, customer credit, loyalty value, pending gateway, or refund.
```

---

# 1. Canonical Vocabulary

## 1.1 Order value

```text
Order value = sale/service amount before settlement.
```

Examples:

```text
base service
piece extra price
preference extra price
delivery charge
express charge
commercial discount
VAT
municipal fee
rounding
```

## 1.2 Real payment

```text
Real payment = actual money movement or confirmed external payment.
```

Examples:

```text
cash
card
gateway
mobile payment
bank transfer
check after clearance
```

## 1.3 Credit application / stored value

```text
Credit application = stored value or customer credit used to settle an order.
```

Examples:

```text
gift card
wallet
customer advance
credit note
customer credit
loyalty value
manual credit
```

Credit applications are not discounts and not real payments.

## 1.4 AR receivable

```text
AR receivable = amount owed by customer under credit invoice/account terms.
```

AR exists only for:

```text
CREDIT_INVOICE
B2B
INVOICE
```

## 1.5 Pay on collection

```text
PAY_ON_COLLECTION = operational retail outstanding to be collected at pickup/delivery.
```

It is not AR.

## 1.6 Tax document

```text
Tax document = fiscal/legal/e-invoicing document.
```

Examples:

```text
standard tax invoice
simplified tax invoice
credit note
debit note
ZATCA/UAE/Oman tax document
```

Tax document total is based on fiscal sale total, not receivable.

---

# 2. Canonical Database Columns

This specification assumes legacy columns have been dropped. The order header contains only canonical snapshot columns.

## 2.1 Order value columns

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
non_taxable_amount numeric(19,4) not null default 0,
exempt_amount numeric(19,4) not null default 0,
zero_rated_amount numeric(19,4) not null default 0,
out_of_scope_amount numeric(19,4) not null default 0,

total_tax_amount numeric(19,4) not null default 0,
rounding_adjustment_amount numeric(19,4) not null default 0,

total_amount numeric(19,4) not null default 0
```

## 2.2 Settlement columns

```sql
total_paid_amount numeric(19,4) not null default 0,
pending_payment_amount numeric(19,4) not null default 0,
authorized_payment_amount numeric(19,4) not null default 0,
failed_payment_amount numeric(19,4) not null default 0,

total_credit_applied_amount numeric(19,4) not null default 0,
pending_credit_application_amount numeric(19,4) not null default 0,
failed_credit_application_amount numeric(19,4) not null default 0,
credit_reversed_amount numeric(19,4) not null default 0,

refunded_amount numeric(19,4) not null default 0,
real_payment_refunded_amount numeric(19,4) not null default 0,
stored_value_restored_amount numeric(19,4) not null default 0,
customer_credit_issued_amount numeric(19,4) not null default 0,

refund_reopens_due_amount numeric(19,4) not null default 0,
credit_reversal_reopens_due_amount numeric(19,4) not null default 0,

net_collected_amount numeric(19,4) not null default 0,

outstanding_amount numeric(19,4) not null default 0,
overpaid_amount numeric(19,4) not null default 0,
change_returned_amount numeric(19,4) not null default 0
```

## 2.3 Receivable and collection columns

```sql
pay_on_collection_amount numeric(19,4) not null default 0,
ar_receivable_amount numeric(19,4) not null default 0,

ar_invoice_id uuid null,
ar_invoice_no text null,
ar_invoice_status varchar(50) null
```

## 2.4 Tax document columns

```sql
tax_document_id uuid null,
tax_document_no text null,
tax_document_status varchar(50) null,
tax_document_type varchar(50) null
```

## 2.5 Currency columns

```sql
currency_code varchar(3) not null,
currency_ex_rate numeric(22,10) not null default 1,
base_currency_code varchar(3) null,

base_total_amount numeric(19,4) not null default 0,
base_tax_amount numeric(19,4) not null default 0,
base_paid_amount numeric(19,4) not null default 0,
base_credit_applied_amount numeric(19,4) not null default 0,
base_outstanding_amount numeric(19,4) not null default 0,
base_ar_receivable_amount numeric(19,4) not null default 0
```

## 2.6 Recalculation/audit columns

```sql
financial_engine_version smallint not null default 1,
financial_last_calculated_at timestamptz null,
financial_last_calculated_by uuid null,
financial_snapshot_status varchar(30) not null default 'CURRENT',
financial_mismatch_warning_count integer not null default 0
```

Recommended `financial_snapshot_status` values:

```text
CURRENT
STALE
MISMATCH
RECALCULATION_REQUIRED
LOCKED
```

---

# 3. Source Tables and Ownership

## 3.1 Order header is snapshot only

`org_orders_mst` stores calculated summary values.

It is not the source of truth for individual payments, credits, taxes, discounts, or invoice lines.

## 3.2 Source tables

```text
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
org_tax_documents_mst
```

## 3.3 Snapshot write ownership

Only the financial recalculation service may write canonical financial snapshot columns.

Forbidden:

```text
UI directly updating total_amount
API directly updating total_paid_amount
manual SQL changing outstanding_amount outside migration/repair
payment callback directly editing order total without recalculation service
```

Allowed:

```text
OrderFinancialRecalculationService
approved data repair migration
system backfill job with reconciliation log
```

---

# 4. Money, Precision, Currency, and Rounding Rules

## 4.1 Money type

All calculations must use Decimal/arbitrary precision.

Do not use JavaScript floating-point arithmetic for money.

## 4.2 Storage precision

Recommended storage:

```text
numeric(19,4) for money snapshots
numeric(22,10) for exchange rates
```

## 4.3 Display precision

Display precision is based on:

```text
sys_currency_cd.minor_unit_decimal_places
```

Examples:

```text
OMR → 3 decimals
SAR → 2 decimals
AED → 2 decimals
```

## 4.4 Transaction currency vs base currency

Transaction currency values are authoritative for the order.

Base currency values are reporting snapshots.

Formula:

```text
base_amount = transaction_amount * currency_ex_rate
```

Rules:

```text
currency_code is required
currency_ex_rate > 0
currency must be allowed for tenant/branch
```

## 4.5 Rounding boundaries

Rounding may happen at:

```text
line total
tax row
invoice/tax document total
currency display
```

But the final stored values must reconcile.

---

# 5. Status Models

## 5.1 Payment row statuses

```text
PENDING
PROCESSING
AUTHORIZED
CAPTURE_PENDING
CAPTURED
SETTLED
COMPLETED
FAILED
CANCELLED
REFUSED
EXPIRED
VOIDED
REVERSED
REFUNDED
PARTIALLY_REFUNDED
```

Canonical amount mapping:

| Payment Status | Completed Paid? | Pending? | Authorized? | Failed/Audit? |
|---|---:|---:|---:|---:|
| `PENDING` | No | Yes | No | No |
| `PROCESSING` | No | Yes | No | No |
| `AUTHORIZED` | No | No | Yes | No |
| `CAPTURE_PENDING` | No | Yes | Yes | No |
| `CAPTURED` | Yes | No | No | No |
| `SETTLED` | Yes | No | No | No |
| `COMPLETED` | Yes | No | No | No |
| `FAILED` | No | No | No | Yes |
| `CANCELLED` | No | No | No | Yes |
| `REFUSED` | No | No | No | Yes |
| `EXPIRED` | No | No | No | Yes |
| `VOIDED` | No | No | No | Yes |
| `REVERSED` | No | No | No | Yes |
| `REFUNDED` | No direct; use refund rows | No | No | Audit |

## 5.2 Credit application statuses

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

Only `APPLIED` reduces outstanding.

## 5.3 Refund statuses

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

Only `COMPLETED` affects refund summary.

## 5.4 Order payment statuses

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

# 6. Payment Target Types

Payments do not always target the order.

A payment or voucher line must carry a target classification:

```text
payment_target_type:
  ORDER
  AR_INVOICE
  CUSTOMER_ADVANCE
  GIFT_CARD_TOPUP
  WALLET_TOPUP
  SUPPLIER_PAYMENT
  EXPENSE
```

## 6.1 Order-targeted payment

Only `ORDER` target payments reduce order outstanding through `total_paid_amount`.

```text
ORDER_PAYMENT → org_order_payments_dtl → total_paid_amount when completed
```

## 6.2 Invoice-targeted payment

`AR_INVOICE` target payments reduce invoice/AR outstanding.

```text
INVOICE_PAYMENT → org_invoice_payments_dtl / AR ledger credit
```

They should not create duplicate order payment rows unless an explicit mirror policy exists.

Recommended:

```text
Do not duplicate invoice payments into org_order_payments_dtl.
Order Details should show linked AR invoice status/outstanding from invoice row.
```

## 6.3 Stored value top-up

Gift card/wallet/customer advance top-up is not an order payment.

It creates stored value/liability and may later be applied to an order as credit application.

---

# 7. Core Calculation Order

All calculation flows must follow this order:

```text
1. Load source rows
2. Validate tenant/branch/currency/policy
3. Calculate item/base amounts
4. Calculate extra breakdowns
5. Calculate charges
6. Calculate gross amount
7. Calculate commercial discounts
8. Allocate discounts by tax category
9. Calculate taxable/non-taxable/exempt/zero/out-of-scope bases
10. Calculate taxes
11. Apply rounding
12. Calculate total sale amount
13. Calculate completed payments
14. Calculate pending/authorized/failed payments
15. Calculate applied/pending/failed/reversed credits
16. Calculate refunds/restorations/reopened due
17. Calculate outstanding and overpaid
18. Classify pay-on-collection vs AR receivable
19. Resolve payment status
20. Recalculate base currency snapshots
21. Run reconciliation checks
22. Write order snapshot
23. Trigger AR/tax/voucher follow-up actions
```

---

# 8. Algorithm A — Order Value Calculation

## 8.1 Input

```ts
type OrderValueInput = {
  items: OrderItem[];
  pieces: OrderPiece[];
  preferences: OrderPreference[];
  charges: OrderCharge[];
  discounts: OrderDiscount[];
  taxRows: OrderTax[];
  currency: CurrencyConfig;
  taxPricingMode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';
  extraPricePricingMode: 'INCLUDED_IN_ITEM_PRICE' | 'SEPARATE_CHARGE';
  negativeSaleAllowed: boolean;
};
```

## 8.2 Items base amount

Current default mode:

```text
items_base_amount = SUM(active order item final line amounts)
```

The final line amount already includes item-level extras if the system is configured that way.

Alternative mode:

```text
items_base_amount = SUM(active item base quantity * unit price)
```

## 8.3 Extra breakdowns

```text
piece_extra_price_amount =
  SUM(active piece extra_price * piece_quantity_if_available)

preference_extra_price_amount =
  SUM(active preference extra_price * quantity_if_available)
```

If quantities do not exist, use `1`.

## 8.4 Charges

```text
service_charge_amount =
  SUM(active charges where charge_type = SERVICE_CHARGE)

delivery_charge_amount =
  SUM(active charges where charge_type = DELIVERY_CHARGE)

express_charge_amount =
  SUM(active charges where charge_type = EXPRESS_CHARGE)

other_charges_amount =
  SUM(active charges where charge_type IN (MANUAL_CHARGE, SYSTEM_CHARGE, OTHER_CHARGE))
```

## 8.5 Total charges

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

## 8.6 Gross amount

```text
gross_amount =
  items_base_amount
+ total_charges_amount
```

## 8.7 Commercial discounts

Commercial discounts include:

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

Stored-value credits are excluded:

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
  SUM(active applied commercial discounts)
```

## 8.8 Discount allocation

Order-level discounts must be allocated across eligible lines before tax calculation.

Default:

```text
Allocate proportionally across eligible taxable/charge lines.
Preserve tax category.
Do not allocate to ineligible lines.
Do not allocate stored-value credits.
```

Discount allocation must output:

```text
discount_by_tax_category
discount_by_line
taxable_discount_amount
non_taxable_discount_amount
```

## 8.9 Net before tax

```text
net_before_tax_amount =
  gross_amount - total_discount_amount
```

Default guard:

```text
if negativeSaleAllowed = false:
  net_before_tax_amount = MAX(net_before_tax_amount, 0)
```

## 8.10 Tax-inclusive vs tax-exclusive pricing

### TAX_EXCLUSIVE

```text
taxable_amount = tax engine taxable base
total_tax_amount = SUM(tax rows)
total_amount = net_before_tax_amount + total_tax_amount + rounding_adjustment_amount
```

### TAX_INCLUSIVE

```text
total_amount_before_rounding = net_before_tax_amount
taxable_amount and total_tax_amount are extracted from tax-inclusive price
total_amount = net_before_tax_amount + rounding_adjustment_amount
```

Example:

```text
tax-inclusive price = 105.000
VAT 5%
taxable_amount = 100.000
total_tax_amount = 5.000
total_amount = 105.000
```

## 8.11 Tax bases

Tax engine must calculate:

```text
taxable_amount
non_taxable_amount
exempt_amount
zero_rated_amount
out_of_scope_amount
```

Stored-value credits must not reduce any tax base.

## 8.12 Total tax amount

```text
total_tax_amount =
  SUM(active org_order_taxes_dtl.tax_amount)
```

Do not double count multiple summary fields.

## 8.13 Rounding

```text
rounding_adjustment_amount = configured rounding difference
```

Can be positive, zero, or negative.

## 8.14 Total amount

For tax-exclusive:

```text
total_amount =
  net_before_tax_amount
+ total_tax_amount
+ rounding_adjustment_amount
```

For tax-inclusive:

```text
total_amount =
  net_before_tax_amount
+ rounding_adjustment_amount
```

## 8.15 Output

```ts
type OrderValueResult = {
  itemsBaseAmount: Decimal;
  subtotalAmount: Decimal;
  pieceExtraPriceAmount: Decimal;
  preferenceExtraPriceAmount: Decimal;

  serviceChargeAmount: Decimal;
  deliveryChargeAmount: Decimal;
  expressChargeAmount: Decimal;
  otherChargesAmount: Decimal;
  totalChargesAmount: Decimal;

  grossAmount: Decimal;
  totalDiscountAmount: Decimal;
  netBeforeTaxAmount: Decimal;

  taxableAmount: Decimal;
  nonTaxableAmount: Decimal;
  exemptAmount: Decimal;
  zeroRatedAmount: Decimal;
  outOfScopeAmount: Decimal;

  totalTaxAmount: Decimal;
  roundingAdjustmentAmount: Decimal;
  totalAmount: Decimal;
};
```

---

# 9. Algorithm B — Payment Calculation

## 9.1 Completed real payments

Only ORDER-targeted completed payments count.

```text
total_paid_amount =
  SUM(payment.amount)
  WHERE payment_target_type = ORDER
  AND payment_status IN (CAPTURED, SETTLED, COMPLETED)
  AND rec_status = 1
```

## 9.2 Pending payments

```text
pending_payment_amount =
  SUM(payment.amount)
  WHERE payment_target_type = ORDER
  AND payment_status IN (PENDING, PROCESSING, CAPTURE_PENDING)
  AND rec_status = 1
```

## 9.3 Authorized payments

```text
authorized_payment_amount =
  SUM(payment.amount)
  WHERE payment_target_type = ORDER
  AND payment_status = AUTHORIZED
  AND rec_status = 1
```

Authorized payments do not count as paid until captured/settled/completed.

## 9.4 Failed payment attempts

```text
failed_payment_amount =
  SUM(payment.amount)
  WHERE payment_target_type = ORDER
  AND payment_status IN (FAILED, CANCELLED, REFUSED, EXPIRED, VOIDED, REVERSED)
  AND rec_status = 1
```

## 9.5 Pending/authorized do not reduce outstanding

```text
outstanding_amount excludes pending_payment_amount and authorized_payment_amount.
```

Display-only:

```text
expected_balance_if_pending_confirms =
  MAX(outstanding_amount - pending_payment_amount - authorized_payment_amount, 0)
```

This is derived and should not be stored unless required for performance.

---

# 10. Algorithm C — Credit Application Calculation

## 10.1 Source reference required

Every credit application must have a source reference.

| Credit Type | Required Source |
|---|---|
| `GIFT_CARD` | gift card id/source id |
| `WALLET` | wallet id/account id |
| `CUSTOMER_ADVANCE` | advance/account id |
| `CREDIT_NOTE` | credit note id |
| `CUSTOMER_CREDIT` | customer credit/reference id |
| `LOYALTY_VALUE` | loyalty credit/account id |
| `MANUAL_CREDIT` | approved manual source/reason |

Missing source reference must throw a specific validation error.

## 10.2 Balance validation

Before application:

```text
source exists
source is active
source belongs to tenant
source belongs to same customer unless cross-customer policy allows
source has sufficient balance
source is not expired/blocked
amount > 0
```

## 10.3 Applied credits

```text
total_credit_applied_amount =
  SUM(credit_app.amount)
  WHERE application_status = APPLIED
  AND rec_status = 1
```

## 10.4 Pending credits

```text
pending_credit_application_amount =
  SUM(credit_app.amount)
  WHERE application_status IN (PENDING, RESERVED, PROCESSING)
  AND rec_status = 1
```

Default: pending/reserved credits do not reduce outstanding.

## 10.5 Failed credits

```text
failed_credit_application_amount =
  SUM(credit_app.amount)
  WHERE application_status IN (FAILED, CANCELLED, EXPIRED)
  AND rec_status = 1
```

## 10.6 Reversed credits

```text
credit_reversed_amount =
  SUM(credit_app.amount)
  WHERE application_status = REVERSED
  AND rec_status = 1
```

If applied credit is reversed after settlement:

```text
credit_reversal_reopens_due_amount =
  reversed amount unless replaced by another settlement source
```

---

# 11. Algorithm D — Refunds and Restorations

Refunds must preserve source lineage.

## 11.1 Refund source types

```text
REAL_PAYMENT_REFUND
GIFT_CARD_RESTORE
WALLET_RESTORE
CUSTOMER_ADVANCE_RESTORE
CUSTOMER_CREDIT_ISSUE
CREDIT_NOTE_ISSUE
MANUAL_EXCEPTION
```

## 11.2 Completed refunds

```text
refunded_amount =
  SUM(refund.amount)
  WHERE refund_status = COMPLETED
  AND rec_status = 1
```

## 11.3 Real payment refunded amount

```text
real_payment_refunded_amount =
  SUM(refund.amount)
  WHERE refund_status = COMPLETED
  AND refund_source_type = REAL_PAYMENT_REFUND
```

## 11.4 Stored value restored

```text
stored_value_restored_amount =
  SUM(refund.amount)
  WHERE refund_status = COMPLETED
  AND refund_source_type IN (GIFT_CARD_RESTORE, WALLET_RESTORE, CUSTOMER_ADVANCE_RESTORE)
```

## 11.5 Customer credit issued

```text
customer_credit_issued_amount =
  SUM(refund.amount)
  WHERE refund_status = COMPLETED
  AND refund_source_type IN (CUSTOMER_CREDIT_ISSUE, CREDIT_NOTE_ISSUE)
```

## 11.6 Net collected

```text
net_collected_amount =
  MAX(total_paid_amount - real_payment_refunded_amount, 0)
```

Do not subtract gift card restoration from real cash collection.

## 11.7 Refund reopen due

Default:

```text
refund_reopens_due_amount = 0
```

If refund policy reopens due:

```text
refund_reopens_due_amount = amount that must become due again
```

Manual exception refunds must require:

```text
elevated permission
reason
audit log
source lineage
```

---

# 12. Algorithm E — Outstanding and Overpaid

## 12.1 Raw outstanding

```text
raw_outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
+ refund_reopens_due_amount
+ credit_reversal_reopens_due_amount
```

## 12.2 Outstanding

```text
outstanding_amount =
  MAX(raw_outstanding_amount, 0)
```

## 12.3 Overpaid

```text
overpaid_amount =
  MAX(
    total_paid_amount
  + total_credit_applied_amount
  - total_amount
  - refund_reopens_due_amount
  - credit_reversal_reopens_due_amount,
    0
  )
```

## 12.4 Cash change

For cash tender:

```text
cash_tendered_amount = physical cash received
cash_retained_amount = allocated order payment
change_returned_amount = cash_tendered_amount - cash_retained_amount
```

Only retained amount is counted as paid.

---

# 13. Algorithm F — Collection and AR Classification

## 13.1 PAY_ON_COLLECTION

```text
pay_on_collection_amount = outstanding_amount
ar_receivable_amount = 0
ar_invoice_id = null
```

No AR invoice.

## 13.2 CREDIT_INVOICE / B2B / INVOICE

```text
pay_on_collection_amount = 0
ar_receivable_amount = outstanding_amount
```

If `ar_receivable_amount > 0`, AR invoice is created.

If zero, no AR invoice is required.

## 13.3 PAY_NOW / PAY_IN_ADVANCE / retail

```text
pay_on_collection_amount = 0
ar_receivable_amount = 0
```

Outstanding must be collected immediately, retried, converted by policy, or shown as unpaid.

---

# 14. Algorithm G — Payment Status Resolver

## 14.1 Resolver

```text
if order_status = CANCELLED:
  return CANCELLED

if overpaid_amount > 0:
  return OVERPAID

if refunded_amount > 0 and outstanding_amount = 0 and refunded_amount < total_paid_amount:
  return PARTIALLY_REFUNDED

if refunded_amount > 0 and outstanding_amount = 0 and refunded_amount >= total_paid_amount and total_paid_amount > 0:
  return REFUNDED

if outstanding_amount = 0:
  return PAID

if pending_payment_amount > 0 or authorized_payment_amount > 0:
  if total_paid_amount > 0 or total_credit_applied_amount > 0:
    return PARTIALLY_PAID
  else:
    return PENDING_PAYMENT

if total_paid_amount + total_credit_applied_amount > 0 and outstanding_amount > 0:
  return PARTIALLY_PAID

if payment_type_code = PAY_ON_COLLECTION:
  return PENDING_COLLECTION

if failed_payment_amount > 0 and total_paid_amount = 0 and total_credit_applied_amount = 0:
  return PAYMENT_FAILED

return UNPAID
```

## 14.2 Gateway display mapping

If pending payment is from gateway:

```text
display status = PENDING_GATEWAY
stored status may remain PENDING_PAYMENT
```

---

# 15. Algorithm H — AR Invoice Handling

## 15.1 Create AR invoice

Create AR invoice only when:

```text
payment_type_code IN (CREDIT_INVOICE, B2B, INVOICE)
AND ar_receivable_amount > 0
```

## 15.2 Do not create AR invoice for

```text
PAY_ON_COLLECTION
fully paid cash/card/mobile/gateway
fully credit-applied order
PAY_NOW with no receivable
```

## 15.3 AR invoice amount

```text
ar_invoice.total_amount = ar_receivable_amount
ar_invoice.outstanding_amount = ar_receivable_amount
```

## 15.4 AR invoice payment

Later invoice payment uses:

```text
INVOICE_PAYMENT voucher line
org_invoice_payments_dtl or equivalent invoice allocation table
org_customer_ar_ledger_dtl credit/payment
```

Rules:

```text
Do not duplicate invoice payment into org_order_payments_dtl unless mirror policy is explicitly enabled.
Order Details should display linked invoice outstanding from org_invoice_mst.
```

## 15.5 AR invoice display

```text
if AR invoice exists:
  display amount = org_invoice_mst.outstanding_amount
else if payment_type_code in (CREDIT_INVOICE, B2B, INVOICE):
  display amount = order.ar_receivable_amount
else:
  display amount = 0
```

If mismatch:

```text
AR_RECEIVABLE_MISMATCH
```

---

# 16. Algorithm I — Tax Document Handling

## 16.1 Tax document total

```text
tax_document.total_amount = order.total_amount
```

Not:

```text
outstanding_amount
ar_receivable_amount
paid amount
```

## 16.2 Tax document timing policy

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
Gateway pending → wait until payment confirmation unless country policy says otherwise
PAY_ON_COLLECTION → ON_PAYMENT_CONFIRMATION or ON_DELIVERY
CREDIT_INVOICE/B2B → ON_AR_INVOICE_ISSUE
```

## 16.3 Tax document immutability

If tax document is issued/reported/cleared:

```text
do not mutate original tax document
use CREDIT_NOTE or DEBIT_NOTE
```

---

# 17. Algorithm J — Business Voucher Integration

## 17.1 Submit order settlement

```text
ORDER_PAYMENT
→ real payment line
→ org_order_payments_dtl when posted

ORDER_CREDIT_APPLICATION
→ stored-value credit line
→ org_order_credit_apps_dtl when posted

INVOICE_PAYMENT
→ invoice/AR payment
→ invoice payment allocation / AR ledger credit
```

## 17.2 Cash drawer effects

```text
Completed CASH ORDER_PAYMENT
→ cash drawer movement IN

Cash refund
→ cash drawer movement OUT

Cash change returned
→ record change_returned_amount
→ cash drawer handling depends POS drawer policy
```

If drawer tracks tender and change:

```text
cash tendered IN
change OUT
net retained = order payment amount
```

If drawer tracks retained cash only:

```text
cash retained IN only
change not posted separately
```

Choose one drawer policy and document it.

---

# 18. Algorithm K — Payment Gateway Lifecycle

## 18.1 Submit with pending gateway

```text
1. Create order.
2. Create gateway payment attempt.
3. Create ORDER_PAYMENT voucher line.
4. Create org_order_payments_dtl row with PENDING/PROCESSING/AUTHORIZED.
5. Do not increase total_paid_amount.
6. Recalculate snapshot.
7. Show pending/authorized amount separately.
```

## 18.2 Authorization

```text
AUTHORIZED → authorized_payment_amount
does not count as paid
does not reduce outstanding
```

## 18.3 Capture success

```text
CAPTURED/SETTLED/COMPLETED
→ total_paid_amount
→ reduces outstanding
```

## 18.4 Failure/cancel/refusal

```text
FAILED/CANCELLED/REFUSED/EXPIRED/VOIDED
→ failed_payment_amount
→ does not reduce outstanding
```

## 18.5 Idempotency

Gateway callbacks must be idempotent:

```text
same provider transaction id cannot complete payment twice
same callback replay cannot duplicate voucher/payment rows
status transition must be monotonic or explicitly reversible
```

---

# 19. Algorithm L — Order Submit Flow

```text
function submitOrder(request):

  validate tenant, branch, customer, currency, permissions

  validate order source and payment policy

  validate items, pieces, preferences, charges

  validate commercial discounts/promotions

  validate credit application sources and balances

  validate payment legs and gateway state

  calculate order value

  calculate tax

  build settlement plan

  begin transaction

    insert order header with canonical value fields

    insert detail rows:
      items
      pieces
      preferences
      charges
      discounts
      taxes

    create Business Voucher if payment/credit exists

    create voucher lines:
      ORDER_PAYMENT
      ORDER_CREDIT_APPLICATION

    post voucher idempotently

    voucher wiring creates:
      org_order_payments_dtl
      org_order_credit_apps_dtl
      cash drawer movement if applicable

    recalculate order financial snapshot

    if ar_receivable_amount > 0:
      create AR invoice idempotently

    if tax policy requires tax document:
      create tax document idempotently

    write audit/history/outbox

  commit

  return order financial summary
```

---

# 20. Algorithm M — Order Edit Flow

```text
function editOrder(orderId, editRequest):

  acquire order edit lock

  load order, details, settlement, AR invoice, tax document

  validate:
    order status allows edit
    user permissions
    accounting period open
    tax document state
    AR invoice state
    payment/refund state

  preview:
    calculate before snapshot
    apply proposed changes in memory
    calculate after snapshot
    delta = after.total_amount - before.total_amount

  determine action:
    delta = 0 → update only
    delta > 0 → additional collection / debit note / AR adjustment
    delta < 0 → refund / customer credit / credit note

  if approval required:
    create approval task and stop

  begin transaction

    write allowed detail changes

    recalculate snapshot

    if issued AR invoice exists:
      do not silently rewrite
      create AR adjustment/debit/credit workflow

    if issued tax document exists:
      do not silently rewrite
      create tax credit/debit note

    write edit history

    release lock

  commit
```

---

# 21. Closed Period and Issued Document Restrictions

## 21.1 Closed accounting period

If financial period is closed:

```text
no direct financial mutation
use adjustment document
require elevated permission
write audit trail
```

## 21.2 Issued AR invoice

If AR invoice is issued/open/paid:

```text
do not silently rewrite original invoice amount
use adjustment, credit note, debit note, or invoice correction workflow
```

## 21.3 Issued tax document

If tax document is issued/reported/cleared:

```text
do not mutate original fiscal document
use tax CREDIT_NOTE or DEBIT_NOTE
```

---

# 22. Tenant and Branch Policies

## 22.1 Partial later collection

Default:

```text
allow_partial_later_collection = true
```

Resolution order:

```text
1. branch override if exists
2. tenant setting if exists
3. system default true
```

## 22.2 Tax pricing mode

```text
TAX_EXCLUSIVE
TAX_INCLUSIVE
```

## 22.3 Extra price mode

```text
INCLUDED_IN_ITEM_PRICE
SEPARATE_CHARGE
```

## 22.4 Credit cross-customer policy

Default:

```text
credit source must belong to same customer
```

Cross-customer application requires explicit policy and permission.

---

# 23. Idempotency and Duplicate Prevention

All write flows must be idempotent:

```text
submit order
post voucher
create order payment row
create credit application row
gateway callback
AR invoice creation
invoice payment allocation
tax document creation
refund processing
order recalculation
```

Recommended uniqueness:

```text
unique tenant + idempotency_key
unique voucher trx line effect target
unique gateway provider transaction id
unique order AR invoice where active
unique tax document per source + type + trigger where active
unique credit application source redemption reference
```

---

# 24. Reconciliation Checks

Run after submit, edit, payment callback, voucher post, refund, credit reversal, AR invoice update, tax document update, and repair migration.

## 24.1 Order total component mismatch

```text
expected_total =
  items_base_amount
+ total_charges_amount
- total_discount_amount
+ total_tax_amount
+ rounding_adjustment_amount
```

For tax-inclusive pricing, expected total uses tax-inclusive algorithm.

Warning:

```text
ORDER_TOTAL_COMPONENT_MISMATCH
```

## 24.2 Discount total mismatch

```text
total_discount_amount != sum active commercial discount rows
```

Warning:

```text
DISCOUNT_TOTAL_MISMATCH
```

## 24.3 Tax total mismatch

```text
total_tax_amount != sum active tax rows
```

Warning:

```text
TAX_TOTAL_MISMATCH
```

## 24.4 Outstanding mismatch

```text
expected_outstanding =
  MAX(total_amount - total_paid_amount - total_credit_applied_amount
      + refund_reopens_due_amount
      + credit_reversal_reopens_due_amount, 0)
```

Warning:

```text
OUTSTANDING_MISMATCH
```

## 24.5 Pending payment counted as paid

If pending/authorized payment contributes to `total_paid_amount`:

```text
PENDING_PAYMENT_COUNTED_AS_PAID
```

## 24.6 Gift card double counted

If gift card reduces `total_amount` and is also in `total_credit_applied_amount`:

```text
GIFT_CARD_DOUBLE_COUNTED
```

## 24.7 Credit counted as discount

If stored-value credit appears in commercial discount rows:

```text
CREDIT_APPLICATION_COUNTED_AS_DISCOUNT
```

## 24.8 AR mismatch

If AR invoice exists and invoice outstanding differs from order AR receivable:

```text
AR_RECEIVABLE_MISMATCH
```

## 24.9 Tax document mismatch

If tax document exists and tax document total differs from order total:

```text
TAX_DOCUMENT_TOTAL_MISMATCH
```

---

# 25. Snapshot Write Algorithm

```text
update org_orders_mst set
  items_base_amount = orderValue.itemsBaseAmount,
  subtotal_amount = orderValue.subtotalAmount,

  piece_extra_price_amount = orderValue.pieceExtraPriceAmount,
  preference_extra_price_amount = orderValue.preferenceExtraPriceAmount,

  service_charge_amount = orderValue.serviceChargeAmount,
  delivery_charge_amount = orderValue.deliveryChargeAmount,
  express_charge_amount = orderValue.expressChargeAmount,
  other_charges_amount = orderValue.otherChargesAmount,
  total_charges_amount = orderValue.totalChargesAmount,

  total_discount_amount = orderValue.totalDiscountAmount,

  taxable_amount = orderValue.taxableAmount,
  non_taxable_amount = orderValue.nonTaxableAmount,
  exempt_amount = orderValue.exemptAmount,
  zero_rated_amount = orderValue.zeroRatedAmount,
  out_of_scope_amount = orderValue.outOfScopeAmount,

  total_tax_amount = orderValue.totalTaxAmount,
  rounding_adjustment_amount = orderValue.roundingAdjustmentAmount,
  total_amount = orderValue.totalAmount,

  total_paid_amount = payment.totalPaidAmount,
  pending_payment_amount = payment.pendingPaymentAmount,
  authorized_payment_amount = payment.authorizedPaymentAmount,
  failed_payment_amount = payment.failedPaymentAmount,

  total_credit_applied_amount = credit.totalCreditAppliedAmount,
  pending_credit_application_amount = credit.pendingCreditApplicationAmount,
  failed_credit_application_amount = credit.failedCreditApplicationAmount,
  credit_reversed_amount = credit.creditReversedAmount,

  refunded_amount = refund.refundedAmount,
  real_payment_refunded_amount = refund.realPaymentRefundedAmount,
  stored_value_restored_amount = refund.storedValueRestoredAmount,
  customer_credit_issued_amount = refund.customerCreditIssuedAmount,

  refund_reopens_due_amount = refund.refundReopensDueAmount,
  credit_reversal_reopens_due_amount = credit.creditReversalReopensDueAmount,

  net_collected_amount = refund.netCollectedAmount,

  outstanding_amount = balance.outstandingAmount,
  overpaid_amount = balance.overpaidAmount,
  change_returned_amount = balance.changeReturnedAmount,

  pay_on_collection_amount = collection.payOnCollectionAmount,
  ar_receivable_amount = collection.arReceivableAmount,

  base_total_amount = currency.baseTotalAmount,
  base_tax_amount = currency.baseTaxAmount,
  base_paid_amount = currency.basePaidAmount,
  base_credit_applied_amount = currency.baseCreditAppliedAmount,
  base_outstanding_amount = currency.baseOutstandingAmount,
  base_ar_receivable_amount = currency.baseArReceivableAmount,

  payment_status = resolvedPaymentStatus,

  financial_last_calculated_at = now(),
  financial_last_calculated_by = actorId,
  financial_snapshot_status = case when warnings.length = 0 then 'CURRENT' else 'MISMATCH' end,
  financial_mismatch_warning_count = warnings.length
where id = orderId
  and tenant_org_id = tenantOrgId;
```

---

# 26. Scenario Matrix

## 26.1 Fully paid cash

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

## 26.2 Partial cash + CREDIT_INVOICE

```text
total_amount = 2.140
cash completed = 1.000
credits = 0
outstanding = 1.140
ar_receivable = 1.140
AR invoice = 1.140
payment_status = PARTIALLY_PAID
```

## 26.3 Cash + gift card + CREDIT_INVOICE

```text
total_amount = 2.140
cash completed = 1.000
gift card applied = 0.150
outstanding = 0.990
ar_receivable = 0.990
AR invoice = 0.990
payment_status = PARTIALLY_PAID
```

## 26.4 Gift card fully covers order

```text
total_amount = 2.140
paid = 0
credit applied = 2.140
outstanding = 0
ar_receivable = 0
payment_status = PAID
no AR invoice
```

## 26.5 Gateway authorized

```text
total_amount = 2.140
authorized = 1.000
paid = 0
credit applied = 0.150
outstanding = 1.990
expected if authorized captures = 0.990
payment_status = PENDING_PAYMENT
```

## 26.6 Gateway captured/completed

```text
total_amount = 2.140
gateway completed = 1.000
paid = 1.000
credit applied = 0.150
outstanding = 0.990
payment_status = PARTIALLY_PAID
```

## 26.7 Gateway refused

```text
total_amount = 2.140
gateway refused = 1.000
paid = 0
failed_payment_amount = 1.000
credit applied = 0.150
outstanding = 1.990
payment_status = PAYMENT_FAILED or UNPAID
```

## 26.8 PAY_ON_COLLECTION unpaid

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

## 26.9 PAY_ON_COLLECTION partially paid

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

## 26.10 Commercial discount

```text
gross_amount = 2.500
total_discount_amount = 0.500
net_before_tax = 2.000
tax = 0.140
total_amount = 2.140
```

## 26.11 Overpayment with change returned

```text
order total = 2.140
cash tendered = 5.000
cash retained = 2.140
change returned = 2.860
total_paid_amount = 2.140
overpaid_amount = 0
payment_status = PAID
```

## 26.12 Overpayment retained as customer advance

Recommended treatment:

```text
order total = 2.140
cash received = 3.000
order payment allocation = 2.140
customer advance = 0.860
total_paid_amount on order = 2.140
overpaid_amount = 0
payment_status = PAID
```

## 26.13 Refund after full payment

```text
original:
total = 2.140
paid = 2.140
outstanding = 0

refund real payment = 1.000
real_payment_refunded_amount = 1.000
refunded_amount = 1.000
net_collected = 1.140
payment_status = PARTIALLY_REFUNDED
outstanding remains 0 unless refund reopens due
```

---

# 27. Required Test Coverage

## 27.1 Order value

```text
commercial discount reduces total
gift card does not reduce total
wallet does not reduce total
customer advance does not reduce total
credit note does not reduce total
tax-inclusive mode extracts tax correctly
tax-exclusive mode adds tax correctly
```

## 27.2 Settlement

```text
completed payment reduces outstanding
pending payment does not reduce outstanding
authorized payment does not reduce outstanding
failed payment does not reduce outstanding
applied credit reduces outstanding
pending credit does not reduce outstanding
reversed credit reopens due when not replaced
```

## 27.3 AR

```text
PAY_ON_COLLECTION creates no AR invoice
fully paid cash creates no AR invoice
credit invoice creates AR invoice for outstanding
invoice payment updates invoice/AR not duplicate order payment
AR display prefers invoice outstanding
```

## 27.4 Tax

```text
stored-value credits do not reduce taxable amount
stored-value credits do not reduce tax amount
tax document total equals order total
issued tax document cannot be silently mutated
```

## 27.5 Gateway

```text
authorized is not paid
capture success becomes paid
failed/refused remains audit only
callback idempotency prevents duplicate completion
```

## 27.6 Refund

```text
cash refund updates real_payment_refunded_amount
gift card restoration updates stored_value_restored_amount
net_collected subtracts only real payment refunds
manual exception requires permission and reason
```

## 27.7 Reconciliation

```text
detect component mismatch
detect tax mismatch
detect discount mismatch
detect gift card double count
detect pending counted as paid
detect AR mismatch
detect tax document mismatch
```

---

# 28. Implementation Checklist

```text
[ ] Confirm legacy columns dropped and no code references them.
[ ] Confirm canonical columns exist.
[ ] Implement Decimal money utility.
[ ] Implement OrderValueCalculator.
[ ] Implement DiscountAllocationService.
[ ] Implement TaxCalculationService with tax-inclusive/tax-exclusive support.
[ ] Implement PaymentSettlementCalculator.
[ ] Implement CreditApplicationCalculator.
[ ] Implement RefundSettlementCalculator.
[ ] Implement OutstandingBalanceCalculator.
[ ] Implement CollectionClassificationService.
[ ] Implement PaymentStatusResolver.
[ ] Implement CurrencySnapshotCalculator.
[ ] Implement ReconciliationService.
[ ] Implement SnapshotWriter.
[ ] Implement Business Voucher idempotent effect posting.
[ ] Implement AR invoice creation and invoice payment allocation.
[ ] Implement Tax Document decision hooks.
[ ] Implement Order Details read model.
[ ] Implement tests for all scenario matrix cases.
```

---

# 29. Final Formula Block

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
  calculated by tax engine after commercial discount allocation

total_tax_amount =
  SUM(active tax row amounts)

total_amount =
  if TAX_EXCLUSIVE:
    net_before_tax_amount + total_tax_amount + rounding_adjustment_amount

  if TAX_INCLUSIVE:
    net_before_tax_amount + rounding_adjustment_amount

total_paid_amount =
  SUM(completed/captured/settled ORDER-targeted real payments)

pending_payment_amount =
  SUM(pending/processing/capture_pending ORDER-targeted payment attempts)

authorized_payment_amount =
  SUM(authorized ORDER-targeted payment attempts)

failed_payment_amount =
  SUM(failed/refused/cancelled/expired/voided ORDER-targeted payment attempts)

total_credit_applied_amount =
  SUM(applied stored-value/customer-credit applications)

pending_credit_application_amount =
  SUM(pending/reserved/processing credit applications)

failed_credit_application_amount =
  SUM(failed/cancelled/expired credit applications)

credit_reversed_amount =
  SUM(reversed credit applications)

refunded_amount =
  SUM(completed refunds/restorations)

real_payment_refunded_amount =
  SUM(completed real payment refunds)

stored_value_restored_amount =
  SUM(completed stored-value restorations)

customer_credit_issued_amount =
  SUM(completed customer credit/credit note issuances)

net_collected_amount =
  MAX(total_paid_amount - real_payment_refunded_amount, 0)

outstanding_amount =
  MAX(
    total_amount
  - total_paid_amount
  - total_credit_applied_amount
  + refund_reopens_due_amount
  + credit_reversal_reopens_due_amount,
    0
  )

overpaid_amount =
  MAX(
    total_paid_amount
  + total_credit_applied_amount
  - total_amount
  - refund_reopens_due_amount
  - credit_reversal_reopens_due_amount,
    0
  )

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

# 30. Final Non-Negotiable Rules

```text
1. total_amount is never reduced by payment or stored-value credit.
2. Gift card is never a discount.
3. Wallet is never a discount.
4. Customer advance is never a discount.
5. Credit note/customer credit is never a discount.
6. Loyalty must be explicitly classified as LOYALTY_DISCOUNT or LOYALTY_VALUE.
7. Pending payment is never paid.
8. Authorized payment is never paid until captured/settled/completed.
9. Failed/refused/cancelled/expired payment is audit-only.
10. PAY_ON_COLLECTION is not AR.
11. AR invoice amount is receivable only.
12. Invoice payment updates invoice/AR, not duplicate order payment.
13. Tax document amount is fiscal sale total.
14. Stored-value credits do not reduce taxable amount or tax amount.
15. Issued AR/tax documents are not silently rewritten.
16. Closed accounting periods require adjustment documents.
17. Every voucher/payment/credit/tax/AR operation must be idempotent.
18. Reconciliation warnings must expose mismatches, not hide them.
