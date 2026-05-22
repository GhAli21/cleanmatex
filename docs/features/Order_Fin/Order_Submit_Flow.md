# CleanMateX — suggested Refined Submit Order Flow

**Document Type:** Implementation Flow Specification  
**Module:** Submit Order / Order Fin / Business Voucher / Full AR Invoice  
**Version:** v1.1  
**Status:** Ready for Engineering Review  
**Scope:** Final production-grade Submit Order execution model using the current order tables, Business Voucher wiring, Order Fin, Full AR Invoice, piece `extra_price`, preference `extra_price`, real payment legs, and credit application legs.

---

# Table of Contents

- [1. Final Production Model](#1-final-production-model)
- [2. Critical Non-Duplication Rule](#2-critical-non-duplication-rule)
- [3. Order Table Responsibility Map](#3-order-table-responsibility-map)
- [4. Main Endpoint and Services](#4-main-endpoint-and-services)
- [5. Submit Order Transaction Flow](#5-submit-order-transaction-flow)
- [6. Validate Operational Order Details](#6-validate-operational-order-details)
- [7. Calculate Order Financials](#7-calculate-order-financials)
- [8. Create Operational Order Rows](#8-create-operational-order-rows)
- [9. Create Financial Projection Charge Rows](#9-create-financial-projection-charge-rows)
- [10. Create Discounts and Taxes](#10-create-discounts-and-taxes)
- [11. Create Initial Order Financial Snapshot](#11-create-initial-order-financial-snapshot)
- [12. Build Settlement Plan](#12-build-settlement-plan)
- [13. Classify Settlement Legs](#13-classify-settlement-legs)
- [14. Validate Settlement Plan](#14-validate-settlement-plan)
- [15. Create Receipt Voucher for Immediate Settlement](#15-create-receipt-voucher-for-immediate-settlement)
- [16. Create Voucher Lines](#16-create-voucher-lines)
- [17. Post Voucher with Operational Wiring](#17-post-voucher-with-operational-wiring)
- [18. Voucher Wiring Outputs](#18-voucher-wiring-outputs)
- [19. Recalculate Order Financial Snapshot](#19-recalculate-order-financial-snapshot)
- [20. Handle Outstanding Amount](#20-handle-outstanding-amount)
- [21. AR Invoice Line Generation](#21-ar-invoice-line-generation)
- [22. History, Status, Audit](#22-history-status-audit)
- [23. Reconciliation Checks](#23-reconciliation-checks)
- [24. Final Response Contract](#24-final-response-contract)
- [25. Final Refined Rule](#25-final-refined-rule)

---

# 1. Final Production Model

```text
Submit Order API
→ validates request
→ calculates order financials
→ saves operational order details
→ projects all financial add-ons into org_order_charges_dtl
→ builds settlement plan
→ creates Business Voucher lines for immediate real-payment and credit-application legs
→ posts voucher with wiring
→ voucher wiring creates org_order_payments_dtl and org_order_credit_apps_dtl
→ recalculates order financial snapshot
→ creates full AR invoice only for CREDIT_INVOICE
→ writes history/audit/reconciliation
```

This flow is designed to prevent double posting, hidden pricing gaps, and inconsistent order financial snapshots.

---

# 2. Critical Non-Duplication Rule

```text
org_order_payments_dtl and org_order_credit_apps_dtl are real order financial effect tables.
```

However:

```text
When Business Voucher wiring is active, Submit Order must not write them directly as independent steps.
```

Correct chain:

```text
Submit Order
→ settlement legs
→ voucher lines
→ voucher posting/wiring
→ operational effect rows
```

Wrong chain:

```text
Submit Order
→ writes org_order_payments_dtl directly
→ also creates voucher lines
→ voucher wiring writes org_order_payments_dtl again
```

That causes:

```text
duplicate payments
wrong paid amount
wrong outstanding amount
cash drawer mismatch
voucher reconciliation failure
```

---

# 3. Order Table Responsibility Map

| Table | Responsibility in Submit Order | Writer |
|---|---|---|
| `org_orders_mst` | Order header + financial snapshot | Submit Order |
| `org_order_items_dtl` | Main service/item lines | Submit Order |
| `org_order_item_pieces_dtl` | Physical pieces under items | Submit Order |
| `org_order_preferences_dtl` | Selected preferences/add-ons | Submit Order |
| `org_order_charges_dtl` | Financial charges: delivery, express, piece extra, preference extra, manual charges | Submit Order |
| `org_order_discounts_dtl` | Commercial discounts only | Submit Order |
| `org_order_taxes_dtl` | Tax facts | Submit Order |
| `org_order_payments_dtl` | Real payment effects | Voucher wiring |
| `org_order_credit_apps_dtl` | Gift card/wallet/advance/credit-note applications | Voucher wiring |
| `org_order_refunds_dtl` | Refund effects | Refund voucher wiring |
| `org_order_adjustments_dtl` | Post-submit/manual financial adjustments | Adjustment service |
| `org_order_history` | General order audit/history | Submit Order / workflow |
| `org_order_status_history` | Status transition history | Submit Order / workflow |
| `org_order_edit_history` | Edit audit after submit | Edit service |
| `org_order_edit_locks` | Concurrent edit locking | Edit service |
| `org_order_item_issues` | Item defects/issues/rework | Operations / QA |
| `org_order_item_processing_steps` | Production workflow | Operations |
| `org_order_piece_hist_tr` | Piece-level movement/history | Operations |
| `org_order_status_history_legacy` | Legacy only | Do not expand |

---

# 4. Main Endpoint and Services

## 4.1 Endpoint

```http
POST /api/v1/orders/submit
```

For draft order:

```http
POST /api/v1/orders/{orderId}/submit
```

## 4.2 Main Service

```text
order-submit-orchestrator.service.ts
```

## 4.3 Supporting Services

```text
order-validation.service.ts
order-calculation.service.ts
order-piece-pricing.service.ts
order-preference-pricing.service.ts
order-charge-projection.service.ts
order-financial-snapshot.service.ts
order-settlement-planner.service.ts
voucher-create.service.ts
voucher-line.service.ts
voucher-posting-orchestrator.service.ts
ar-invoice-from-order.service.ts
order-reconciliation.service.ts
order-history.service.ts
```

---

# 5. Submit Order Transaction Flow

## Step 1 — Start Transaction and Idempotency

```text
BEGIN TRANSACTION
```

Validate:

```text
idempotency_key is required
same key + same payload returns previous result
same key + different payload is rejected
```

Errors:

```text
IDEMPOTENCY_KEY_REQUIRED
IDEMPOTENCY_CONFLICT
```

## Step 2 — Validate Tenant, Branch, User, Customer

Validate:

```text
tenant exists
branch exists and belongs to tenant
current user belongs to tenant
customer exists if provided
customer is required if CREDIT_INVOICE is selected
branch accepts orders
cash drawer session exists if cash leg exists
payment methods are enabled for tenant/channel
```

Permissions:

```text
orders:create
orders:submit
orders:payments:create
orders:credits:apply
finance:vouchers:create
finance:vouchers:post
```

If invoice is selected:

```text
ar:invoices:create
```

If manual discount exists:

```text
orders:discounts:apply
```

If approval threshold exceeded:

```text
orders:discounts:approve
```

## Step 3 — Resolve Currency

Resolution order:

```text
1. order-specific currency if allowed
2. branch currency
3. tenant default currency
```

Rules:

```text
currency_code is required
currency_code has no hardcoded DB default
currency_ex_rate > 0
currency must be allowed for tenant/branch
```

Errors:

```text
ORDER_CURRENCY_REQUIRED
ORDER_CURRENCY_NOT_ALLOWED
ORDER_CURRENCY_EX_RATE_INVALID
```

---

# 6. Validate Operational Order Details

## 6.1 Validate Order Items

For each item:

```text
item/service exists
service is active
service is available in branch
quantity > 0
unit_price >= 0
service category is valid
pricing policy is valid
```

Errors:

```text
ORDER_EMPTY
ORDER_ITEM_INVALID
ORDER_ITEM_QUANTITY_INVALID
ORDER_ITEM_PRICE_INVALID
SERVICE_NOT_AVAILABLE
```

## 6.2 Validate Pieces

For each piece in `org_order_item_pieces_dtl`:

```text
piece belongs to order item
piece quantity/count is valid

```

Errors:

```text
ORDER_PIECE_INVALID
```

Approved rule:

```text
piece exists
```

## 6.3 Validate Preferences

For each selected preference in `org_order_preferences_dtl`:

```text
preference exists
preference is active
preference is allowed for order/item/piece
extra_price >= 0
taxability is resolved
discount eligibility is resolved
```

Errors:

```text
ORDER_PREFERENCE_INVALID
ORDER_PREFERENCE_NOT_ALLOWED
PREFERENCE_EXTRA_PRICE_NEGATIVE
PREFERENCE_EXTRA_PRICE_TAX_POLICY_REQUIRED
PREFERENCE_EXTRA_PRICE_DISCOUNT_POLICY_REQUIRED
```

Approved rule:

```text
preference extra_price is not payment and not discount.
It is a charge component.
```

---

# 7. Calculate Order Financials

Call:

```text
order-calculation.service.calculate()
```

Final calculation model:

```text
items_base_amount
= sum(org_order_items_dtl.quantity * unit_price)

preferences_extra_price_amount
= sum(org_order_preferences_dtl.extra_price)

total_charges_amount
= preferences_extra_price_amount
[+ express_charge_amount] if not included in item price 
+ other_charge_amount

gross_amount
= items_base_amount + total_charges_amount

net_amount
= gross_amount - commercial_discount_amount

total_amount
= net_amount + tax_amount + rounding_amount
```

Use:

```text
express
```

not:

```text
rush
```

---

# 8. Create Operational Order Rows

Save in this order:

```text
1. org_orders_mst
2. org_order_items_dtl
3. org_order_item_pieces_dtl
4. org_order_preferences_dtl
```

At this point, the system has the operational details, but the full financial projection is not complete until charge, discount, and tax rows are created.

---

# 9. Create Financial Projection Charge Rows

`org_order_charges_dtl` is the unified financial charge bridge.

Create charge rows for:

```text
SERVICE_CHARGE
DELIVERY_CHARGE
EXPRESS_CHARGE
PIECE_EXTRA_PRICE
PREFERENCE_EXTRA_PRICE
MANUAL_CHARGE
ROUNDING_CHARGE
OTHER_CHARGE
```

## 9.1 Piece Extra Price Projection

no extra price in piece 
## 9.2 Preference Extra Price Projection

From:

```text
org_order_preferences_dtl
```

Create:

```text
org_order_charges_dtl
charge_type = PREFERENCE_EXTRA_PRICE
source_type = ORDER_PREFERENCE
source_order_preference_id = org_order_preferences_dtl.id
amount = preference.extra_price * quantity
```

## 9.3 Duplicate Prevention

If extra price is already included in item price, do not create a charge row.

Pricing modes:

```text
INCLUDED_IN_ITEM_PRICE
SEPARATE_CHARGE
FREE
```

Recommended default:

```text
SEPARATE_CHARGE
```

Errors:

```text
PIECE_EXTRA_PRICE_DUPLICATED
PREFERENCE_EXTRA_PRICE_DUPLICATED
```

---

# 10. Create Discounts and Taxes

## 10.1 Discounts

Save commercial discounts only:

```text
org_order_discounts_dtl
```

Discounts include:

```text
manual discount
promotion discount
coupon discount
campaign discount
```

Not discounts:

```text
gift card
wallet
customer advance
credit note
customer credit
```

## 10.2 Taxes

Save tax rows:

```text
org_order_taxes_dtl
```

Tax base:

```text
taxable_amount =
  taxable item/service amount
+ [taxable piece extra price]
+ taxable preference extra price
+ taxable charges
- taxable discounts
```

---

# 11. Create Initial Order Financial Snapshot

Update:

```text
org_orders_mst
```

Snapshot fields conceptually:

```text
subtotal_amount
total_charges_amount
discount_amount
tax_amount
rounding_amount
total_amount
total_paid_amount = 0
total_credit_applied_amount = 0
outstanding_amount = total_amount
payment_status
payment_type_code
pay_on_collection_amount
invoice_amount
currency_code
financial_version
```

Use existing live schema names where already present.

Initial status:

```text
if no payment and PAY_ON_COLLECTION:
  payment_status = PENDING_COLLECTION

else:
  payment_status = UNPAID
```

---

# 12. Build Settlement Plan

Call:

```text
order-settlement-planner.service.buildPlan()
```

Important:

```text
Settlement planner does not create payments.
Settlement planner does not create credit applications.
Settlement planner does not create cash movements.
It only validates and builds settlement instructions.
```

Output:

```ts
type SettlementPlan = {
  orderId: string;
  totalAmount: Decimal;

  realPaymentLegs: RealPaymentLeg[];
  creditApplicationLegs: CreditApplicationLeg[];

  realPaymentAmount: Decimal;
  creditAppliedAmount: Decimal;
  immediateSettlementAmount: Decimal;

  outstandingAmount: Decimal;

  outstandingPolicy:
    | 'NONE'
    | 'PAY_ON_COLLECTION'
    | 'CREDIT_INVOICE'
    | 'PAY_ON_DELIVERY';

  shouldCreateReceiptVoucher: boolean;
  shouldCreateArInvoice: boolean;
};
```

---

# 13. Classify Settlement Legs

## 13.1 Real Payment Legs

Real money received:

```text
CASH
CARD
BANK_TRANSFER
CHECK
HYPERPAY
PAYTABS
STRIPE
MOBILE_PAYMENT
```

These must become:

```text
org_order_payments_dtl
```

But through this chain:

```text
realPaymentLeg
→ ORDER_PAYMENT voucher line
→ voucher wiring
→ org_order_payments_dtl
```

Not direct independent write from Submit Order.

## 13.2 Credit Application Legs

Stored-value / customer credit used:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
LOYALTY_VALUE
```

These must become:

```text
org_order_credit_apps_dtl
```

But through this chain:

```text
creditApplicationLeg
→ ORDER_CREDIT_APPLICATION voucher line
→ voucher wiring
→ org_order_credit_apps_dtl
```

Not direct independent write from Submit Order.

## 13.3 Pending Amount

Pending amount is not a leg.

It remains:

```text
outstanding_amount
```

Then classified as:

```text
PAY_ON_COLLECTION
CREDIT_INVOICE
PAY_ON_DELIVERY later
```

---

# 14. Validate Settlement Plan

Rules:

```text
real_payment_total >= 0
credit_application_total >= 0
immediate_settlement_amount <= order total unless overpayment is allowed
credit source balance is sufficient
cash tendered >= cash retained amount
cash drawer session is open if cash
gateway config exists if gateway
bank/check reference exists if required
partial later collection is allowed by default
tenant setting can override partial later collection
```

Errors:

```text
SETTLEMENT_AMOUNT_INVALID
SETTLEMENT_EXCEEDS_ORDER_TOTAL
CASH_TENDERED_LESS_THAN_AMOUNT
CASH_DRAWER_SESSION_REQUIRED
CASH_DRAWER_SESSION_CLOSED
GATEWAY_NOT_CONFIGURED
PAYMENT_REFERENCE_REQUIRED
CREDIT_BALANCE_INSUFFICIENT
GIFT_CARD_INVALID_OR_INSUFFICIENT
WALLET_BALANCE_INSUFFICIENT
ADVANCE_BALANCE_INSUFFICIENT
CREDIT_NOTE_BALANCE_INSUFFICIENT
```

---

# 15. Create Receipt Voucher for Immediate Settlement

If:

```text
realPaymentLegs.length > 0
or creditApplicationLegs.length > 0
```

create:

```text
org_fin_vouchers_mst
```

Header:

```text
voucher_type = RECEIPT_VOUCHER
direction = IN
party_type = CUSTOMER
customer_id = order.customer_id
source_module = ORDERS
source_ref_type = ORDER
source_ref_id = order_id
currency_code = order.currency_code
total_amount = immediateSettlementAmount
voucher_status = DRAFT
posting_status = NOT_POSTED
```

Important:

```text
voucher total = immediate settlement amount
```

not always full order total.

---

# 16. Create Voucher Lines

## 16.1 Real Payment Leg → `ORDER_PAYMENT`

Create:

```text
org_fin_voucher_trx_lines_dtl
line_role = ORDER_PAYMENT
line_type = RECEIPT
direction = IN
target_type = ORDER
order_id = order_id
customer_id = customer_id
payment_method_code = leg.paymentMethodCode
amount = leg.amount
currency_code = order.currency_code
```

Cash fields:

```text
cash_drawer_session_id
tendered_amount
change_returned_amount
```

Gateway fields:

```text
gateway_code
gateway_reference
gateway_transaction_id
payment_status = PENDING or PROCESSING
```

Bank/check fields:

```text
bank_reference
check_number
check_bank
check_date
```

## 16.2 Credit Application Leg → `ORDER_CREDIT_APPLICATION`

Create:

```text
org_fin_voucher_trx_lines_dtl
line_role = ORDER_CREDIT_APPLICATION
line_type = CREDIT_APPLICATION
direction = NEUTRAL
target_type = ORDER
order_id = order_id
customer_id = customer_id
amount = leg.amount
source_table = leg.sourceTable
source_id = leg.sourceId
metadata.credit_type = GIFT_CARD / WALLET / CUSTOMER_ADVANCE / CREDIT_NOTE / CUSTOMER_CREDIT
```

---

# 17. Post Voucher with Operational Wiring

Call:

```ts
voucherPostingOrchestrator.postVoucher({
  voucherId,
  mode: 'WIRE_OPERATIONAL_EFFECTS',
  idempotencyKey
});
```

Voucher posting does:

```text
1. Lock voucher.
2. Validate voucher status is DRAFT.
3. Validate voucher lines.
4. Set voucher_status = POSTED.
5. Set voucher line_status = POSTED.
6. Dispatch wiring handlers.
7. Create operational effects.
8. Update line wiring_status = WIRED.
9. Run reconciliation.
```

---

# 18. Voucher Wiring Outputs

## 18.1 `ORDER_PAYMENT` Wiring Creates `org_order_payments_dtl`

This is where real payment legs are saved.

Fields:

```text
order_id
customer_id
payment_method_code
amount
currency_code
payment_status
cash_drawer_session_id
gateway_reference
bank_reference
fin_voucher_id
fin_voucher_trx_line_id
```

Payment status rules:

```text
CASH = COMPLETED
CARD = COMPLETED only if terminal/provider confirms
BANK_TRANSFER = PENDING unless manually verified
CHECK = PENDING unless policy says confirmed
GATEWAY = PENDING or PROCESSING until provider confirms
```

Only `COMPLETED` rows increase:

```text
total_paid_amount
```

## 18.2 Cash `ORDER_PAYMENT` Also Creates Cash Drawer Movement

If:

```text
payment_method_code = CASH
```

create:

```text
org_cash_drawer_movements_dtl
```

Rules:

```text
cash drawer session must be open
movement amount = voucher line amount
movement amount != tendered_amount
change_returned_amount is not retained cash
```

## 18.3 `ORDER_CREDIT_APPLICATION` Wiring Creates `org_order_credit_apps_dtl`

This is where stored-value/credit legs are saved.

Fields:

```text
order_id
customer_id
credit_type
source_table
source_id
amount
currency_code
application_status = APPLIED
fin_voucher_id
fin_voucher_trx_line_id
```

Rules:

```text
does not create org_order_payments_dtl
does not increase total_paid_amount
does increase total_credit_applied_amount
does reduce outstanding_amount
does not appear as discount
```

---

# 19. Recalculate Order Financial Snapshot

After voucher wiring, recalculate from actual effect tables:

```text
total_paid_amount =
  sum(org_order_payments_dtl.amount where payment_status = COMPLETED)

total_credit_applied_amount =
  sum(org_order_credit_apps_dtl.amount where application_status = APPLIED)

outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

Set:

```text
payment_status
pay_on_collection_amount
invoice_amount
last_payment_at
financial_version
financial_last_calculated_at
```

Status rules:

```text
if outstanding_amount = 0:
  payment_status = PAID

if paid/credit applied > 0 and outstanding_amount > 0:
  payment_status = PARTIALLY_PAID

if paid/credit applied = 0 and payment_type_code = PAY_ON_COLLECTION:
  payment_status = PENDING_COLLECTION
```

Gateway pending rule:

```text
gateway pending does not count as paid until confirmed
```

---

# 20. Handle Outstanding Amount

## 20.1 If Fully Settled

```text
outstanding_amount = 0
payment_status = PAID
no invoice
```

## 20.2 If PAY_ON_COLLECTION

```text
outstanding_amount > 0
payment_type_code = PAY_ON_COLLECTION
pay_on_collection_amount = outstanding_amount
do not create AR invoice
```

## 20.3 If CREDIT_INVOICE

```text
outstanding_amount > 0
payment_type_code = CREDIT_INVOICE
create full AR invoice
```

Create:

```text
org_invoice_mst
org_invoice_lines_dtl
org_invoice_orders_dtl
org_customer_ar_ledger_dtl
org_invoice_status_history_dtl
```

Default allocation policy:

```text
REMAINING_ONLY
```

---

# 21. AR Invoice Line Generation

If `CREDIT_INVOICE`, generate invoice lines from financial order sources:

```text
org_order_items_dtl
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
```

Recommended mappings:

| Source | Invoice line |
|---|---|
| `org_order_items_dtl` | `SERVICE` / `ITEM` |
| `org_order_charges_dtl` with `PIECE_EXTRA_PRICE` | `CHARGE` |
| `org_order_charges_dtl` with `PREFERENCE_EXTRA_PRICE` | `CHARGE` |
| `org_order_discounts_dtl` | `DISCOUNT` |
| `org_order_taxes_dtl` | `TAX` |

For single-order invoice:

```text
lineMode = ORDER_DETAIL
```

For B2B/monthly summary:

```text
lineMode = ORDER_SUMMARY
```

---

# 22. History, Status, Audit

Create:

```text
org_order_history
org_order_status_history
```

Examples:

```text
ORDER_CREATED
ORDER_SUBMITTED
FINANCIAL_CALCULATED
PIECE_EXTRA_PRICE_APPLIED
PREFERENCE_EXTRA_PRICE_APPLIED
PAYMENT_VOUCHER_POSTED
CREDIT_APPLICATION_APPLIED
INVOICE_CREATED
```

Do not expand:

```text
org_order_status_history_legacy
```

---

# 23. Reconciliation Checks

Run:

```text
order-reconciliation.service.reconcile(orderId)
```

Checks:

```text
ORDER_TOTAL_MATCHES_COMPONENTS
ORDER_CHARGES_MATCH_SNAPSHOT
PIECE_EXTRA_PRICE_INCLUDED_ONCE
PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE
ORDER_PIECES_MATCH_CHARGES
ORDER_PREFERENCES_MATCH_CHARGES
VOUCHER_TOTAL_MISMATCH
ORDER_PAYMENT_LINK_MISSING
ORDER_CREDIT_APPLICATION_LINK_MISSING
CASH_MOVEMENT_AMOUNT_MISMATCH
INVOICE_TOTAL_MISMATCH
AR_LEDGER_MISMATCH
```

Formulas:

```text
sum(org_order_item_pieces_dtl.extra_price)
=
sum(org_order_charges_dtl.amount where charge_type = PIECE_EXTRA_PRICE)
```

```text
sum(org_order_preferences_dtl.extra_price * quantity)
=
sum(org_order_charges_dtl.amount where charge_type = PREFERENCE_EXTRA_PRICE)
```

```text
sum(org_order_payments_dtl.amount where payment_status = COMPLETED)
=
order.total_paid_amount
```

```text
sum(org_order_credit_apps_dtl.amount where application_status = APPLIED)
=
order.total_credit_applied_amount
```

---

# 24. Final Response Contract

Return:

```ts
type SubmitOrderResponse = {
  order: {
    id: string;
    orderNo: string;
    totalAmount: string;
    totalChargesAmount: string;
    pieceExtraPriceAmount: string;
    preferenceExtraPriceAmount: string;
    totalPaidAmount: string;
    totalCreditAppliedAmount: string;
    outstandingAmount: string;
    paymentStatus: string;
    paymentTypeCode: string;
  };

  voucher?: {
    id: string;
    voucherNo: string;
    status: 'POSTED';
    wiringStatus: 'WIRED' | 'PARTIALLY_WIRED';
  };

  invoice?: {
    id: string;
    invoiceNo: string;
    status: 'OPEN';
    total: string;
    outstandingAmount: string;
    dueDate: string;
  };

  effects: {
    orderPayments: any[];
    creditApplications: any[];
    cashMovements: any[];
    invoiceLines?: any[];
  };

  warnings: string[];
};
```

---

# 25. Final Refined Rule

```text
org_order_items_dtl, org_order_item_pieces_dtl, and org_order_preferences_dtl are operational order details.

org_order_charges_dtl is the financial charge projection table.

org_order_payments_dtl is the real-payment operational effect table.

org_order_credit_apps_dtl is the credit/stored-value application operational effect table.

When Business Voucher wiring is active:
- Submit Order creates settlement legs and voucher lines.
- Voucher ORDER_PAYMENT wiring creates org_order_payments_dtl.
- Voucher ORDER_CREDIT_APPLICATION wiring creates org_order_credit_apps_dtl.

PAY_ON_COLLECTION:
- no invoice
- outstanding remains on order

CREDIT_INVOICE:
- create full AR invoice
```

This is the suggested clean execution model.
