Your proposed flow is close, but one key point must be corrected:

```text
Do not let both "create voucher" and "order settlement service" independently create payment/settlement effects.
```

Otherwise you will duplicate:

```text
org_order_payments_dtl
org_cash_drawer_movements_dtl
wallet/advance/gift-card transactions
invoice/payment projections
```

The approved wiring model says voucher transaction lines are the source document, while operational tables are effects/projections linked back to voucher lines. 

# Correct decision

Use this model:

```text
Submit Order API
→ creates order + order financial snapshot
→ prepares settlement plan
→ creates/posts voucher for actual payment/credit/advance/gift-card legs
→ voucher wiring creates operational effects
→ outstanding amount remains on order
→ invoice is created only if the selected payment plan is CREDIT_INVOICE / B2B invoice
```

Do **not** automatically create a formal invoice for every pending retail pay-on-collection amount.

For retail `PAY_ON_COLLECTION`, the pending amount should remain:

```text
order.outstanding_amount
order.payment_status = PENDING_COLLECTION or PARTIALLY_PAID
payment_type_code = PAY_ON_COLLECTION
```

If you need a printable customer document, call it:

```text
order receipt
order bill
pickup payment slip
proforma / pending payment note
```

but not an accounting invoice unless you intentionally want AR/customer credit behavior.

---

# 1. Correct Submit Order API execution flow

## 1.1 Submit Order API endpoint

Recommended endpoint:

```http
POST /api/v1/orders/submit
```

or if order already exists as draft:

```http
POST /api/v1/orders/{orderId}/submit
```

Main orchestrator:

```text
order-submit.service.ts
```

Recommended internal services:

```text
order-calculation.service.ts
order-financial-snapshot.service.ts
order-settlement-planner.service.ts
voucher-create.service.ts
voucher-posting-orchestrator.service.ts
order-invoice.service.ts
order-reconciliation.service.ts
```

---

# 2. Submit Order high-level flow

```text
1. Validate request.
2. Validate tenant, branch, customer, cashier, permissions.
3. Resolve currency.
4. Calculate order financials.
5. Save order and order details.
6. Build settlement plan from payment legs and credit legs.
7. Validate payment/credit legs.
8. Create business voucher for immediate financial legs.
9. Post voucher with wiring enabled.
10. Voucher wiring creates order payments, cash movements, stored-value ledger effects.
11. Recalculate order financial snapshot.
12. Handle pending/outstanding amount.
13. Create AR invoice only if CREDIT_INVOICE / invoice selected.
14. Write audit/outbox.
15. Return order + voucher + settlement result.
```

---

# 3. Detailed execution steps

## Step 1 — Validate request

Validate:

```text
tenant_org_id
branch_id
customer_id if required
order items
service/category/item pricing
payment_type_code
payment legs
credit/stored-value legs
discounts
tax context
cash drawer session if cash payment exists
idempotency key
```

Required validation:

```text
order has at least one item/service
currency_code resolved, no hardcoded DB default
amounts >= 0
payment legs total <= order total unless overpayment allowed
credit legs total <= available balances
cash tendered >= cash retained amount
gateway leg has gateway/provider config
```

---

## Step 2 — Resolve currency

Currency must be resolved before insert:

```text
branch currency override
→ tenant default currency
→ customer/order-specific currency if allowed
```

Never rely on:

```sql
currency_code default 'OMR'
```

Approved behavior:

```text
currency_code is required.
```

---

## Step 3 — Calculate order financials

Call:

```text
order-calculation.service.calculateOrderTotals()
```

Calculate:

```text
subtotal
charges
express charge
delivery charge
service charge
discounts
taxable amount
tax amount
rounding
total amount
```

Important classification:

```text
gift card ≠ discount
wallet ≠ discount
advance ≠ discount
credit note ≠ discount
```

These are credit/stored-value applications.

---

## Step 4 — Save order master and details

Create/update:

```text
org_orders_mst
org_order_items_dtl
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_adjustments_dtl if needed
```

At this point, order exists but payment effects are not yet created.

Initial order snapshot:

```text
total_amount = calculated total
total_paid_amount = 0 or existing confirmed amount
total_credit_applied_amount = 0
outstanding_amount = total_amount
payment_status = UNPAID or PENDING_COLLECTION depending flow
```

---

# 4. Settlement planner flow

## Step 5 — Build settlement plan

Call:

```text
order-settlement-planner.service.buildSettlementPlan()
```

This service should **not directly create final operational payment rows**.

It should produce a plan:

```ts
type SettlementPlan = {
  orderId: string;
  totalAmount: Decimal;
  realPaymentLegs: RealPaymentLeg[];
  creditApplicationLegs: CreditApplicationLeg[];
  outstandingAmount: Decimal;
  outstandingPolicy: 'PAY_ON_COLLECTION' | 'CREDIT_INVOICE' | 'PAY_ON_DELIVERY';
  shouldCreateArInvoice: boolean;
}
```

---

## Step 6 — Split payment legs correctly

### A. Real payment legs

These become voucher lines with `line_role = ORDER_PAYMENT`.

Examples:

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

### B. Credit/stored-value legs

These become credit application effects, not real payment rows.

Examples:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
```

### C. Pending amount

Pending amount is not a payment leg.

It is:

```text
outstanding_amount
```

with policy:

```text
PAY_ON_COLLECTION
CREDIT_INVOICE
PAY_ON_DELIVERY later
```

---

# 5. Voucher creation flow

## Step 7 — Create receipt voucher for immediate legs

If there are any real payment or credit/stored-value legs to apply now, create:

```text
org_fin_vouchers_mst
voucher_type = RECEIPT_VOUCHER
direction = IN
party_type = CUSTOMER
customer_id = order.customer_id
source_module = ORDERS
source_ref_type = ORDER
source_ref_id = order_id
```

Voucher total should usually equal the amount being settled now:

```text
voucher.total_amount = sum(immediate settlement legs)
```

Not necessarily the full order total if partial payment.

---

## Step 8 — Create voucher lines from legs

### Real payment leg → voucher line

For each real payment leg:

```text
line_role = ORDER_PAYMENT
line_type = RECEIPT
direction = IN
target_type = ORDER
order_id = order_id
customer_id = customer_id
payment_method_code = CASH/CARD/BANK_TRANSFER/GATEWAY/etc.
amount = leg.amount
currency_code = order.currency_code
```

Cash line includes:

```text
cash_drawer_session_id
tendered_amount
change_returned_amount
```

Gateway line includes:

```text
gateway_code
gateway_reference
gateway_transaction_id if already available
payment_status = PENDING or PROCESSING
```

### Stored-value / credit leg → voucher line

There are two acceptable designs. I recommend **Design A**.

## Design A — Voucher line records credit application to order

For gift card/wallet/advance/credit note used against an order:

```text
line_role = ORDER_CREDIT_APPLICATION
line_type = ADJUSTMENT or CREDIT_APPLICATION
direction = NEUTRAL
target_type = ORDER
order_id = order_id
customer_id = customer_id
amount = leg.amount
source_table = gift_card/wallet/advance/credit_note
source_id = source ledger/card/id
```

Then wiring creates:

```text
org_order_credit_apps_dtl
```

This is clean because no new cash is received.

## Design B — No voucher line for credit application

Let Order Fin directly create `org_order_credit_apps_dtl`.

This is simpler but weaker audit-wise.

My recommendation: use **Design A** once voucher wiring is active.

---

# 6. Voucher posting / wiring flow

## Step 9 — Post voucher with wiring enabled

Call:

```text
voucher-posting-orchestrator.postVoucher({
  voucherId,
  mode: 'WIRE_OPERATIONAL_EFFECTS',
  idempotencyKey
})
```

Posting does:

```text
1. Lock voucher.
2. Validate voucher header and lines.
3. Set voucher status = POSTED.
4. Set line status = POSTED.
5. Dispatch each line to wiring handlers.
6. Create operational effects.
7. Mark wiring_status = WIRED / FAILED.
8. Run reconciliation.
9. Commit transaction.
```

---

# 7. Order settlement wiring details

## 7.1 ORDER_PAYMENT voucher line creates order payment row

For each `ORDER_PAYMENT` line:

Create:

```text
org_order_payments_dtl
```

Map:

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
check_number
fin_voucher_id
fin_voucher_trx_line_id
```

### Payment status rules

```text
CASH → COMPLETED
CARD terminal → COMPLETED only if terminal confirms
BANK_TRANSFER → PENDING unless manually verified
CHECK → PENDING or RECEIVED/COMPLETED based on policy
GATEWAY → PENDING / PROCESSING until provider confirms
```

Only `COMPLETED` real payments increase:

```text
total_paid_amount
```

---

## 7.2 Cash voucher line creates cash drawer movement

If:

```text
payment_method_code = CASH
cash_drawer_session_id is not null
```

Create:

```text
org_cash_drawer_movements_dtl
```

Rule:

```text
cash drawer movement amount = voucher line amount
```

Not:

```text
tendered_amount
```

Example:

```text
order due = 7.500
customer gives = 10.000
change = 2.500

voucher line amount = 7.500
cash drawer movement = 7.500
```

---

## 7.3 Credit application voucher line creates order credit application

For each credit/stored-value leg:

Create:

```text
org_order_credit_apps_dtl
```

Examples:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
```

Rules:

```text
does not create org_order_payments_dtl
does not increase total_paid_amount
does increase total_credit_applied_amount
does reduce outstanding_amount
does not appear in discounts
```

---

# 8. Order recalculation after voucher posting

## Step 10 — Recalculate order financial snapshot

After voucher wiring:

```text
completed_real_paid = sum(org_order_payments_dtl where payment_status = COMPLETED)
credit_applied = sum(org_order_credit_apps_dtl)
refunds = sum(org_order_refunds_dtl completed)
```

Calculate:

```text
outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

Use:

```text
max(outstanding_amount, 0)
```

unless overpayment handling is enabled.

Set:

```text
total_paid_amount
total_credit_applied_amount
outstanding_amount
pay_on_collection_amount
invoice_amount
payment_status
```

---

# 9. Pending / outstanding amount decision

Your proposed step says:

> if there pending/outstanding amount then if not invoice selected so it is pay on collection and in both situation create invoice for that customer_id and order_id for that pending amount.

I would change it.

## Correct rule

```text
If pending amount exists and invoice is NOT selected:
  classify it as PAY_ON_COLLECTION.
  Do not create formal AR invoice.
```

```text
If pending amount exists and CREDIT_INVOICE is selected:
  create customer invoice / AR invoice for the pending amount.
```

## Why not create invoice in both cases?

Because `PAY_ON_COLLECTION` is an operational pending collection, not customer credit.

If you create invoices for every retail pending order:

```text
you turn every pickup payment into accounts receivable
you complicate customer statements
you distort invoice reports
you confuse retail cashiers
you create unnecessary invoice lifecycle
```

Better:

```text
Retail pending = order outstanding due at collection.
B2B/credit pending = invoice/AR.
```

---

# 10. Pending amount handling flow

## Case A — Full paid

```text
order.total = 10
paid = 10
outstanding = 0
payment_status = PAID
payment_type_code = PAY_IN_ADVANCE or PAID_NOW
no invoice
```

## Case B — No payment, retail pickup

```text
order.total = 10
paid = 0
outstanding = 10
payment_type_code = PAY_ON_COLLECTION
payment_status = PENDING_COLLECTION
pay_on_collection_amount = 10
no AR invoice
```

## Case C — Partial payment, retail pickup

```text
order.total = 20
cash paid = 5
outstanding = 15
payment_type_code = PAY_ON_COLLECTION
payment_status = PARTIALLY_PAID or PENDING_COLLECTION
pay_on_collection_amount = 15
no AR invoice
```

## Case D — Credit/invoice customer

```text
order.total = 100
paid = 0 or partial
outstanding = 100 or remaining
payment_type_code = CREDIT_INVOICE
payment_status = PARTIALLY_PAID or PENDING_INVOICE
invoice_amount = outstanding
create AR invoice
```

## Case E — Mixed payment + invoice

```text
order.total = 100
cash = 30
invoice selected for remaining = 70
payment_status = PARTIALLY_PAID
invoice_amount = 70
create AR invoice for 70
```

---

# 11. Invoice creation rules

## Create invoice only when

```text
payment_type_code = CREDIT_INVOICE
or customer/account policy requires invoice
or B2B contract flow is selected
or user explicitly selects "Invoice to Account"
```

## Do not create AR invoice when

```text
payment_type_code = PAY_ON_COLLECTION
retail customer simply pays later at pickup
temporary pending amount exists
gateway payment is pending
cashier skipped payment for pickup
```

## Optional document for pay-on-collection

You may generate:

```text
order bill
pickup receipt
pending payment slip
```

but not AR invoice.

---

# 12. Full recommended submit order procedure

```text
BEGIN TRANSACTION

1. Validate submit request and idempotency key.

2. Resolve tenant, branch, cashier, customer, currency.

3. Calculate order totals:
   - subtotal
   - charges
   - express charge
   - discounts
   - tax
   - total

4. Persist order:
   - org_orders_mst
   - org_order_items_dtl
   - org_order_charges_dtl
   - org_order_discounts_dtl
   - org_order_taxes_dtl

5. Build settlement plan:
   - real payment legs
   - credit/stored-value application legs
   - outstanding amount
   - outstanding policy

6. Validate settlement plan:
   - payment total <= order total unless overpayment allowed
   - credit sources have available balance
   - cash drawer is open if cash
   - gateway method has valid config
   - partial later collection policy is respected

7. If immediate legs exist:
   7.1 Create RECEIPT_VOUCHER.
   7.2 Create voucher lines:
       - ORDER_PAYMENT for real payment legs
       - ORDER_CREDIT_APPLICATION for stored-value/credit legs
   7.3 Post voucher with WIRE_OPERATIONAL_EFFECTS.
   7.4 Voucher wiring creates:
       - org_order_payments_dtl for real payments
       - org_order_credit_apps_dtl for credit applications
       - org_cash_drawer_movements_dtl for cash movements
       - gateway pending records where applicable

8. Recalculate order financial snapshot:
   - total_paid_amount
   - total_credit_applied_amount
   - outstanding_amount
   - pay_on_collection_amount
   - invoice_amount
   - payment_status

9. If outstanding_amount > 0:
   if payment_type_code = CREDIT_INVOICE:
      create AR/customer invoice for outstanding amount
      set invoice_amount = outstanding_amount
   else:
      set payment_type_code = PAY_ON_COLLECTION
      set pay_on_collection_amount = outstanding_amount
      do not create AR invoice

10. Write audit/outbox events.

11. Run reconciliation:
   - voucher total = lines
   - order payment amount = voucher payment lines
   - cash movement = retained cash
   - credit applications = credit voucher lines
   - outstanding is correct

COMMIT

Return:
- order
- financial summary
- voucher id
- voucher lines
- payment rows
- credit application rows
- invoice id if created
- outstanding amount
- warnings
```

---

# 13. What `order settlement service` should do now

Do **not** let it independently create everything after voucher creation.

Refactor/define it as one of these:

## Option A — Settlement planner only

Best clean design:

```text
order-settlement.service
= validates and builds settlement plan
```

Voucher posting/wiring creates the actual operational effects.

## Option B — Settlement effect service called by voucher wiring

Also acceptable:

```text
voucher-order-payment-wiring-handler
→ calls order-settlement.service.createOrderPaymentEffect()
```

But this method must be called only from voucher wiring and must require:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

## Avoid Option C

Bad design:

```text
submit order creates voucher
then settlement service creates payments separately
then voucher wiring also creates payments
```

This causes duplicates.

---

# 14. Recommended API/service structure

## Submit Order API

```text
POST /api/v1/orders/submit
```

Calls:

```text
order-submit-orchestrator.submit()
```

## Order submit orchestrator

```text
validate request
calculate order
save order
build settlement plan
create/post voucher
recalculate order financials
handle invoice/pay-on-collection
return response
```

## Settlement planner

```text
order-settlement-planner.buildPlan()
order-settlement-planner.validatePlan()
```

## Voucher services

```text
voucher.service.createReceiptVoucher()
voucher-line.service.createLinesFromSettlementPlan()
voucher-posting-orchestrator.postWithOperationalWiring()
```

## Wiring handlers

```text
voucher-order-payment-wiring.handler
voucher-cash-drawer-wiring.handler
voucher-order-credit-application-wiring.handler
voucher-gateway-wiring.handler
```

## Invoice service

```text
order-invoice.service.createInvoiceForOutstanding()
```

Only called when:

```text
payment_type_code = CREDIT_INVOICE
```

---

# 15. Final filled flow based on your numbering

```text
1. Submit Order API starts transaction.

1.1. Validate order request, customer, branch, currency, items, payment legs, and idempotency.

1.2. Calculate and persist order financial snapshot and detail rows.

1.3. Build settlement plan:
     - real payment legs
     - credit/stored-value legs
     - pending/outstanding amount
     - selected pending policy

1.4. If immediate settlement legs exist:
     1.4.1. Create RECEIPT_VOUCHER.
     1.4.2. Create voucher lines from order payment legs:
            - ORDER_PAYMENT for real payment legs
            - ORDER_CREDIT_APPLICATION for stored-value/credit legs
     1.4.3. Post voucher with WIRE_OPERATIONAL_EFFECTS.

1.5. Voucher posting/wiring executes:
     1.5.1. ORDER_PAYMENT → org_order_payments_dtl.
     1.5.2. CASH → org_cash_drawer_movements_dtl.
     1.5.3. CREDIT/STORED_VALUE → org_order_credit_apps_dtl.
     1.5.4. GATEWAY → pending/processing until provider confirmation.
     1.5.5. Mark voucher lines WIRED.
     1.5.6. Run reconciliation.

1.6. Recalculate order financial snapshot:
     - total_paid_amount
     - total_credit_applied_amount
     - outstanding_amount
     - payment_status
     - pay_on_collection_amount
     - invoice_amount

1.7. If outstanding_amount > 0:
     if user selected CREDIT_INVOICE or customer policy is invoice:
        create AR/customer invoice for outstanding amount.
        set payment_type_code = CREDIT_INVOICE.
        set invoice_amount = outstanding_amount.
     else:
        set payment_type_code = PAY_ON_COLLECTION.
        set pay_on_collection_amount = outstanding_amount.
        do not create AR invoice.

1.8. Write audit/outbox events.

1.9. Commit transaction.

1.10. Return order financial summary, voucher info, payment/credit effects, invoice info if created, and outstanding amount.
```

---

# Final recommendation

Your direction is correct, but change this part:

```text
"in both situation create invoice"
```

to:

```text
Create invoice only for CREDIT_INVOICE / B2B / invoice-to-account.
For PAY_ON_COLLECTION, keep outstanding amount on the order and collect it later.
```

That is the clean retail + finance model.
