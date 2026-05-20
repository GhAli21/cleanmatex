# CleanMateX Order Financial Platform — PRD

**Document Type:** Product Requirements Document (PRD)  
**Module:** Order Financial Platform / Order Fin  
**Version:** v1.0  
**Status:** Draft for Review  
**Project:** CleanMateX Business / SaaS Platform  
**Primary Scope:** Order-level financial calculation, payment state, outstanding balance, credit/stored-value applications, refunds, and operational payment projections  
**Strategic Dependency:** Business Voucher Module  
**Voucher Foundation:** `org_fin_vouchers_mst`, `org_fin_voucher_trx_lines_dtl`  
**Primary Order Financial Tables:**  
- `org_orders_mst`
- `org_order_items_dtl`
- `org_order_charges_dtl`
- `org_order_discounts_dtl`
- `org_order_taxes_dtl`
- `org_order_payments_dtl`
- `org_order_credit_apps_dtl`
- `org_order_refunds_dtl`
- `org_order_adjustments_dtl`

**Important Architecture Position:**  
Order Fin is an operational order-finance domain. It is not the universal finance source-document model. The Business Voucher module is the business-finance source-document layer. Order Fin records order-specific financial facts, snapshots, projections, and user-facing order financial state. Voucher transaction lines later become the source-document reference for order payments, refunds, cash drawer movements, wallet/advance/gift-card activity, and other operational effects.

---

# Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Background and Problem Statement](#2-background-and-problem-statement)
- [3. Product Vision](#3-product-vision)
- [4. Goals and Non-Goals](#4-goals-and-non-goals)
- [5. Scope](#5-scope)
- [6. Architecture Position](#6-architecture-position)
- [7. Core Business Concepts](#7-core-business-concepts)
- [8. Users and Personas](#8-users-and-personas)
- [9. Order Financial Lifecycle](#9-order-financial-lifecycle)
- [10. Business Use Cases](#10-business-use-cases)
- [11. Functional Requirements](#11-functional-requirements)
- [12. Financial Calculation Requirements](#12-financial-calculation-requirements)
- [13. Payment and Settlement Requirements](#13-payment-and-settlement-requirements)
- [14. Stored-Value and Credit Application Requirements](#14-stored-value-and-credit-application-requirements)
- [15. Refund Requirements](#15-refund-requirements)
- [16. Tax and Discount Requirements](#16-tax-and-discount-requirements)
- [17. Data Model Requirements](#17-data-model-requirements)
- [18. Backend Service Requirements](#18-backend-service-requirements)
- [19. API Requirements](#19-api-requirements)
- [20. UI/UX Requirements](#20-uiux-requirements)
- [21. Business Rules and Validation](#21-business-rules-and-validation)
- [22. Runtime Flows](#22-runtime-flows)
- [23. Security, RBAC, and Audit](#23-security-rbac-and-audit)
- [24. Reporting Requirements](#24-reporting-requirements)
- [25. Integration Requirements](#25-integration-requirements)
- [26. Migration and Compatibility](#26-migration-and-compatibility)
- [27. Non-Functional Requirements](#27-non-functional-requirements)
- [28. Testing and Acceptance Criteria](#28-testing-and-acceptance-criteria)
- [29. Release Plan](#29-release-plan)
- [30. Risks and Open Decisions](#30-risks-and-open-decisions)
- [31. Implementation Checklist](#31-implementation-checklist)

---

# 1. Executive Summary

The Order Financial Platform, referred to as **Order Fin**, manages the financial state of a CleanMateX order.

It answers:

```text
What is the order total?
What charges were added?
What discounts were applied?
What taxes were calculated?
What has been paid?
What was paid by each method?
What was applied from stored value or credit?
What remains outstanding?
What was refunded?
What changed after adjustment?
```

Order Fin is responsible for:

```text
order financial snapshots
item/charge/discount/tax facts
payment projections for the order
credit/stored-value applications to the order
refund facts
adjustments
outstanding amount
payment status
user-facing order financial UI
order-level reporting
```

Order Fin is **not** the universal receipt/payment/expense voucher module.

The new source-document foundation is:

```text
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
```

Order Fin will eventually link order payment/refund facts to voucher transaction lines:

```text
org_order_payments_dtl.fin_voucher_id
org_order_payments_dtl.fin_voucher_trx_line_id
org_order_refunds_dtl.fin_voucher_id
org_order_refunds_dtl.fin_voucher_trx_line_id
org_order_credit_apps_dtl.source_voucher_trx_line_id where applicable
```

The implementation should preserve existing working order finance behavior while aligning future payment/refund flows with the Business Voucher module.

---

# 2. Background and Problem Statement

CleanMateX supports laundry and dry-cleaning operations where orders can be paid:

```text
during creation
on collection
on delivery
partially now and partially later
by cash
by card
by bank transfer
by gateway
by wallet
by customer advance
by gift card
by credit note
by B2B invoice/credit
```

The previous architecture discussion identified several risks:

```text
old payment transaction paths may overlap with newer order finance facts
gift card can be misclassified as discount
gateway payments must not be marked completed before external confirmation
cash tendered/change must not distort retained cash
stored-value ledgers must be separated from real payment rows
order screens need a clear financial breakdown
```

The revised platform direction separates responsibilities:

```text
Business Voucher module:
source business-finance document lines

Order Fin:
order-specific financial facts, projections, snapshots, and UI state
```

This prevents Order Fin from becoming an ERP ledger while still giving operators a clear order-level financial picture.

---

# 3. Product Vision

Order Fin should give CleanMateX users one reliable, simple, and auditable financial view per order.

The vision:

```text
Every order has a clear financial truth:
calculated amount,
applied discount/tax/credit/payment,
remaining outstanding,
and refund/adjustment history.
```

Order Fin should support both simple laundries and more advanced tenants:

```text
simple mode:
cash / pay on collection / basic discount / VAT optional

advanced mode:
multi-payment, stored value, gift card, credit note, invoice, refund, reporting, reconciliation
```

Order Fin should be designed to integrate with the Business Voucher module but must remain usable independently during phased rollout.

---

# 4. Goals and Non-Goals

## 4.1 Goals

Order Fin must:

```text
1. Provide accurate order totals and financial breakdown.
2. Track order-level payments by method.
3. Track credit/stored-value applications separately from real payments.
4. Track refunds and adjustments.
5. Support partial payments and outstanding balances.
6. Support pay-on-collection and invoice/deferred payment behavior.
7. Keep gift card and stored value separate from discounts.
8. Support cash tendered/change display and retained-cash logic.
9. Support voucher-line linkage when Business Voucher wiring is implemented.
10. Provide clear APIs, services, UI, reports, tests, and reconciliation.
```

## 4.2 Non-Goals

Order Fin does not initially implement:

```text
full ERP Lite
general ledger posting
accounts payable
supplier payment processing
expense vouchers
bank reconciliation
full AR aging
purchase invoice lifecycle
payroll
inventory costing
full tax filing
```

Those belong to Business Voucher, ERP Lite, or later finance modules.

---

# 5. Scope

## 5.1 In Scope

```text
order financial snapshot
order item pricing
extra charges
discount rows
tax rows
real payment rows
credit/stored-value application rows
refund rows
adjustment rows
outstanding amount
payment state
pay-on-collection support
partial payment support
multi-method order payment projection
gift card/wallet/advance/credit-note application classification
gateway payment state
cash tender/change display for order payments
order financial tab
checkout payment summary
order payment/refund APIs
order finance reports
voucher-line link fields for future wiring
reconciliation checks
tests
```

## 5.2 Out of Scope

```text
Business Voucher foundation implementation
operational voucher wiring implementation
supplier/expense outgoing payments
full AP
full GL
settlement header/leg persistence unless approved later
bank reconciliation
```

---

# 6. Architecture Position

## 6.1 Layer Model

```text
Business Voucher Layer
  org_fin_vouchers_mst
  org_fin_voucher_trx_lines_dtl
  = source business-finance document

Order Fin Layer
  org_order_* financial tables
  = order-specific operational facts/projections

Operational Control Layer
  cash drawer, wallet, gift card, advance, credit note ledgers
  = module-specific ledgers/effects
```

## 6.2 Order Fin Responsibility

Order Fin answers:

```text
For this order, what happened financially?
```

## 6.3 Business Voucher Responsibility

Business Voucher answers:

```text
What business finance document/line was posted?
```

## 6.4 Operational Ledger Responsibility

Operational ledgers answer:

```text
How did a specific module balance or control state change?
```

Examples:

```text
wallet balance
gift card balance
advance balance
cash drawer expected cash
invoice paid amount
```

---

# 7. Core Business Concepts

## 7.1 Order Financial Snapshot

Snapshot fields on `org_orders_mst` summarize the current order financial state.

Examples:

currency_code text, -- no default value 
currency_ex_rate numeric(18,6) not null default 1,

subtotal_amount numeric(19,4) not null default 0,
total_charges_amount numeric(19,4) not null default 0,
total_discount_amount numeric(19,4) not null default 0,
total_taxable_amount numeric(19,4) not null default 0,
total_tax_amount numeric(19,4) not null default 0,
rounding_amount numeric(19,4) not null default 0,
total_amount numeric(19,4) not null default 0,

total_paid_amount numeric(19,4) not null default 0,
total_credit_applied_amount numeric(19,4) not null default 0,
total_refunded_amount numeric(19,4) not null default 0,
outstanding_amount numeric(19,4) not null default 0,

total_gift_card_applied_amount numeric(19,4) not null default 0,
total_wallet_applied_amount numeric(19,4) not null default 0,
total_advance_applied_amount numeric(19,4) not null default 0,
total_credit_note_applied_amount numeric(19,4) not null default 0,

payment_type_code text null,
payment_status_code text not null default 'UNPAID',
settlement_status_code text null,

last_payment_at timestamptz null,
last_refund_at timestamptz null,

financial_version integer not null default 1,
financial_recalc_required boolean not null default false,
financial_last_calculated_at timestamptz null,
financial_metadata jsonb not null default '{}'::jsonb

```text
subtotal_amount
total_charges_amount
total_discount_amount
total_tax_amount
total_amount
total_paid_amount
total_credit_applied_amount
net_receivable_amount
pay_on_collection_amount
rounding_adjustment_amount
change_returned_amount
refunded_amount
outstanding_amount
payment_status
payment_type_code
```

## 7.2 Charges

Charges represent positive financial additions to an order.

Examples:

```text
service charge
express fee
delivery fee
extra preference fee
manual charge
rounding charge
```

## 7.3 Discounts

Discounts represent commercial reductions.

Examples:

```text
manual discount
rules discount 
promotion discount
coupon discount
manager discount
```

Not discounts:

```text
gift card redemption
wallet usage
customer advance usage
credit note application
```

## 7.4 Taxes

Taxes represent statutory or configured tax amounts.

Examples:

```text
VAT
sales tax
municipality tax
service tax
```

## 7.5 Real Payments

Real payments are actual money received for the order.

Examples:

```text
cash
card
bank transfer
gateway
check
mobile payment
```

Stored value is not a real payment at the time of order application.

## 7.6 Credit / Stored-Value Applications

Credit applications represent using existing customer value or liability against an order.

Examples:

```text
gift card redemption
wallet balance
customer advance
credit note
loyalty redemption if monetary
```

## 7.7 Deferred Amount / Outstanding Amount

Outstanding amount represents the unpaid remainder.

It can be classified as:

```text
PAY_ON_COLLECTION
PAY_ON_DELIVERY
CREDIT_INVOICE
CUSTOMER_BALANCE
```

For V1, default retail remainder may remain `CASH`/current behavior until business approves pay-on-collection default.

---

# 8. Users and Personas

## 8.1 Cashier

Uses Order Fin to:

```text
create order with payments , default PAY_ON_COLLECTION
collect outstanding order amount
take cash/card
see amount due
print receipt
```

## 8.2 Branch Manager

Uses Order Fin to:

```text
review order financial breakdown
approve discounts/refunds
check cash discrepancies
review daily paid/outstanding orders
```

## 8.3 Accountant / Finance User

Uses Order Fin to:

```text
review order payment facts
review discounts/taxes/stored-value applications
verify reports
reconcile order facts with voucher lines later
```

## 8.4 Tenant Admin

Uses Order Fin to:

```text
configure payment methods
control allowed payment behavior
control tax/discount behavior
review financial reports
```

---

# 9. Order Financial Lifecycle

## 9.1 Draft / Calculation Stage

Order items, services, preferences, charges, discounts, and taxes are calculated.

## 9.2 Checkout / Payment Decision Stage

User chooses:

```text
pay now
pay partially
pay on collection
invoice/credit
apply gift card/wallet/advance/credit note
```

## 9.3 Order Creation / Confirmation Stage

Financial snapshot is stored.

Payment rows and credit application rows are created if applicable.

## 9.4 Collection Stage

Outstanding amount can be collected later.

## 9.5 Refund / Adjustment Stage

Refunds or adjustments are recorded with traceability.

## 9.6 Voucher Wiring Stage

Later, order payment/refund facts link to voucher transaction lines.

---

# 10. Business Use Cases

## 10.1 Fully Paid at Order Creation

```text
Order total = 10
Customer pays cash = 10
Outstanding = 0
Payment status = PAID
```

Creates:

```text
order payment row
financial snapshot
future voucher line link when wired
```

## 10.2 Pay on Collection

```text
Order total = 10
Paid now = 0
Outstanding = 10
Payment type = PAY_ON_COLLECTION
```

No real payment is recorded until collection.

## 10.3 Partial Payment Now, Remaining Later

```text
Order total = 20
Cash paid now = 5
Outstanding = 15
Remainder = PAY_ON_COLLECTION or CREDIT_INVOICE depending user/customer
```

Creates:

```text
payment row for 5
outstanding amount 15
deferred classification
```

## 10.4 Multi-Method Order Payment

```text
Order total = 42
Cash = 10
Visa A = 10
Visa B = 5
Mastercard = 7
Gift Card = 5
Wallet = 5
```

Real payments:

```text
cash/card rows in org_order_payments_dtl
```

Credit/stored value:

```text
gift card/wallet rows in org_order_credit_apps_dtl
```

## 10.5 Gift Card Application

Gift card redemption reduces order outstanding but is not a discount.

## 10.6 Wallet Application

Wallet usage reduces order outstanding but is not a real payment received at this order time.

## 10.7 Customer Advance Application

Advance usage reduces order outstanding but no new cash is received.

## 10.8 Credit Note Application

Credit note usage reduces order outstanding but is not discount.

## 10.9 Refund

Customer refund references original payment or future voucher line where available.

## 10.10 Order Adjustment

After order creation, authorized user may adjust charges/discounts/taxes with reason and audit trail.

---

# 11. Functional Requirements

## 11.1 Financial Snapshot

System must maintain order-level financial snapshot.

Snapshot must include:

```text
subtotal
charges
discounts
taxes
total
real paid amount
credit/stored-value applied amount
refunded amount
outstanding amount
payment status
payment type
```

## 11.2 Charges

System must support charge rows with:

```text
charge type
source
amount
taxability
reason
created_by
```

## 11.3 Discounts

System must support discount rows with:

```text
discount type
source
promotion/coupon reference
manual reason
amount
```

Gift card/wallet/advance/credit note must not be stored or displayed as discounts.

## 11.4 Taxes

System must support tax rows with:

```text
tax profile
tax rate
taxable base
tax amount
inclusive/exclusive flag
```

## 11.5 Payments

System must support order real payment rows:

```text
cash
card
bank transfer
gateway
check
mobile payment
```

Each payment row should support:

```text
amount
currency
method
status
reference
gateway reference
terminal reference
cash drawer session
voucher link when wired
```

## 11.6 Credit Applications

System must support applying:

```text
gift card
wallet
advance
credit note
loyalty monetary value if enabled
```

## 11.7 Refunds

System must support:

```text
full refund
partial refund
cash refund
gateway/card refund
stored-value reversal
credit-note refund
```

## 11.8 Outstanding Balance

System must classify remaining due amount.

Possible classifications:

```text
PAY_ON_COLLECTION
PAY_ON_DELIVERY
CREDIT_INVOICE
CUSTOMER_BALANCE
```

## 11.9 Order Financial UI

System must show:

```text
breakdown
payment rows
credit applications
refunds
adjustments
outstanding balance
linked voucher references when available
```

---

# 12. Financial Calculation Requirements

## 12.1 Formula

```text
subtotal
+ charges
- commercial discounts
+ taxes
+ rounding adjustments
= order total

order total
- real payments completed
- credit/stored-value applications
+ refunds/reversals where applicable
= outstanding amount
```

## 12.2 Commercial Discounts

Commercial discounts include:

```text
manual discount
promotion discount
coupon discount
campaign discount
```

They exclude:

```text
gift card
wallet
advance
credit note
invoice settlement
```

## 12.3 Tax Timing

Tax calculation must happen before final settlement.

Tax must be calculated on the correct taxable base after applicable discounts.

## 12.4 Rounding

System must support:

```text
currency rounding
cash rounding
rounding adjustment row
```

## 12.5 Cash Tender and Change

For cash payment:

```text
amount = amount retained for the order
tendered_amount = cash handed by customer
change_returned_amount = tendered_amount - amount
```

Cash drawer retained amount is `amount`, not `tendered_amount`.

---

# 13. Payment and Settlement Requirements

## 13.1 Payment Type

Payment type defines order payment plan:

```text
PAY_IN_ADVANCE
PAY_ON_COLLECTION
PAY_ON_DELIVERY
CREDIT_INVOICE
```

## 13.2 Payment Method

Payment method defines how money is received:

```text
CASH
CARD
BANK_TRANSFER
CHECK
GATEWAY
MOBILE_PAYMENT
```

## 13.3 Real Payment Row Rule

Only real received money should create `org_order_payments_dtl`.

Examples:

```text
cash
card
gateway confirmed payment
bank transfer
check
```

Not real payment rows:

```text
gift card redemption
wallet application
advance application
credit note application
promotion discount
manual discount
```

## 13.4 Gateway Status

Gateway payments must not be treated as completed until externally confirmed.

Allowed payment statuses:

```text
PENDING
PROCESSING
AUTHORIZED
COMPLETED
FAILED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

## 13.5 Voucher Link

Future voucher wiring will add:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

to order payment rows.

Before wiring, these can be null.

---

# 14. Stored-Value and Credit Application Requirements

## 14.1 Credit Application Table

Stored-value usage should be recorded in:

```text
org_order_credit_apps_dtl
```

or equivalent.

## 14.2 Credit Application Types

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
LOYALTY_VALUE
CUSTOMER_CREDIT
```

## 14.3 Rules

```text
credit applications reduce outstanding amount
credit applications do not create real payment rows
credit applications do not appear as discounts
credit applications must reference source ledger where available
```

## 14.4 Voucher Link

When wired to Business Voucher, credit applications may reference voucher lines if the source value came from a voucher transaction.

---

# 15. Refund Requirements

## 15.1 Refund Types

```text
ORDER_REFUND
PAYMENT_REFUND
STORED_VALUE_REVERSAL
CREDIT_NOTE_REFUND
MANUAL_REFUND
```

## 15.2 Refund Lineage

For current V1:

```text
payment-row linkage can be preserved
```

For new voucher-wired flow:

```text
refund should reference original voucher trx line where available
```

## 15.3 Rules

```text
refund cannot exceed refundable amount
refund must preserve original payment/application row
cash refund must affect cash drawer when wired
gateway refund may remain pending until provider confirms
refund reason is required
```

---

# 16. Tax and Discount Requirements

## 16.1 Tax

Tax rows must support:

```text
profile
rate
taxable amount
tax amount
inclusive/exclusive
exemption
```

## 16.2 Discounts

Discount rows must support:

```text
manual
promotion
coupon
campaign
loyalty discount if configured as discount
```

## 16.3 Classification Rule

```text
Gift card, wallet, advance, and credit note are not discounts.
```

---

# 17. Data Model Requirements

## 17.1 `org_orders_mst`

Must include or derive:

```text
subtotal_amount
charges_amount
discount_amount
tax_amount
rounding_amount
total_amount
paid_amount
credit_applied_amount
refunded_amount
outstanding_amount
payment_status
payment_type_code
currency_code
```

## 17.2 `org_order_charges_dtl`

Purpose:

```text
positive order financial additions
```

Fields:

```text
id
tenant_org_id
order_id
charge_type
source_type
source_id
amount
taxable_flag
description
created_at
created_by
```

## 17.3 `org_order_discounts_dtl`

Purpose:

```text
commercial discounts only
```

Fields:

```text
id
tenant_org_id
order_id
discount_type
source_type
source_id
amount
reason
created_at
created_by
```

## 17.4 `org_order_taxes_dtl`

Purpose:

```text
tax facts for order
```

Fields:

```text
id
tenant_org_id
order_id
tax_profile_id
tax_code
tax_rate
taxable_amount
tax_amount
inclusive_flag
created_at
created_by
```

## 17.5 `org_order_payments_dtl`

Purpose:

```text
real payment facts for the order
```

Fields:

```text
id
tenant_org_id
branch_id
order_id
customer_id
payment_method_code
org_payment_method_id
amount
currency_code
payment_status
paid_at
received_by
cash_drawer_session_id
payment_terminal_id
gateway_code
gateway_reference
bank_reference
check_number
card_brand_code
card_last4
fin_voucher_id
fin_voucher_trx_line_id
metadata
```

## 17.6 `org_order_credit_apps_dtl`

Purpose:

```text
stored-value / credit applications against order
```

Fields:

```text
id
tenant_org_id
order_id
customer_id
credit_type
source_table
source_id
amount
currency_code
applied_at
applied_by
fin_voucher_id
fin_voucher_trx_line_id
metadata
```

## 17.7 `org_order_refunds_dtl`

Purpose:

```text
refund facts for order
```

Fields:

```text
id
tenant_org_id
order_id
customer_id
refund_type
original_payment_id
original_credit_app_id
original_fin_voucher_trx_line_id
amount
currency_code
refund_status
reason
refunded_at
refunded_by
fin_voucher_id
fin_voucher_trx_line_id
metadata
```

## 17.8 `org_order_adjustments_dtl`

Purpose:

```text
post-order financial adjustments
```

Fields:

```text
id
tenant_org_id
order_id
adjustment_type
amount
reason
approved_by
created_at
created_by
metadata
```

---

# 18. Backend Service Requirements

Required services:

```text
order-financial-calculation.service.ts
order-payment.service.ts
order-credit-application.service.ts
order-refund.service.ts
order-adjustment.service.ts
order-financial-summary.service.ts
order-financial-reconciliation.service.ts
```

## 18.1 Calculation Service

Responsibilities:

```text
calculate subtotal
calculate charges
calculate discounts
calculate taxes
calculate total
calculate outstanding
produce breakdown
```

## 18.2 Payment Service

Responsibilities:

```text
create real payment row
validate payment method
handle gateway pending/completion
handle cash tender/change
update order paid/outstanding snapshot
```

## 18.3 Credit Application Service

Responsibilities:

```text
apply gift card/wallet/advance/credit note
validate source balance
create credit application row
update outstanding snapshot
```

## 18.4 Refund Service

Responsibilities:

```text
validate refundable amount
create refund row
handle refund status
update order snapshot
prepare voucher-line linkage when wired
```

## 18.5 Summary Service

Responsibilities:

```text
produce order financial tab data
separate discounts from credit applications
show payments/refunds/adjustments/taxes
```

---

# 19. API Requirements

## 19.1 Order Financial Summary

```text
GET /api/v1/orders/[orderId]/financial-summary
```

Returns:

```text
snapshot
charges
discounts
taxes
payments
credit applications
refunds
adjustments
outstanding
linked voucher references if available
```

## 19.2 Preview Calculation

```text
POST /api/v1/orders/preview-financials
```

## 19.3 Collect Payment

```text
POST /api/v1/orders/[orderId]/payments
```

## 19.4 Apply Credit

```text
POST /api/v1/orders/[orderId]/credit-applications
```

## 19.5 Refund

```text
POST /api/v1/orders/[orderId]/refunds
```

## 19.6 Adjustments

```text
POST /api/v1/orders/[orderId]/adjustments
```

## 19.7 Reconciliation

```text
POST /api/v1/orders/[orderId]/financial-reconcile
GET  /api/v1/orders/[orderId]/financial-reconciliation
```

---

# 20. UI/UX Requirements

## 20.1 Checkout Financial Panel

Must show:

```text
subtotal
charges
discounts
taxes
total
payment method selection
credit/stored-value application section
outstanding amount
cash tender/change
```

## 20.2 Order Financial Tab

Sections:

```text
summary cards
charges
discounts
taxes
payments
credit applications
refunds
adjustments
voucher links
audit timeline
```

## 20.3 Payment Collection UI

Supports:

```text
single method
multi-method
partial payment
pay on collection
invoice/credit
cash tender/change
```

## 20.4 Classification Display

The UI must clearly separate:

```text
discounts
credit/stored-value applications
real payments
refunds
```

---

# 21. Business Rules and Validation

```text
Order total cannot be negative.
Payment amount cannot be negative.
Credit application amount cannot exceed source balance.
Refund amount cannot exceed refundable amount.
Gift card/wallet/advance/credit note are not discounts.
Gateway payment is completed only after external confirmation.
Cash retained amount equals payment amount, not tendered amount.
Outstanding amount must reconcile with total minus completed payments and applied credits.
Posted voucher links, when present, must not be silently changed.
```

---

# 22. Runtime Flows

## 22.1 Create Order with No Payment

```text
calculate financials
save order snapshot
no payment rows
outstanding = total
payment type = PAY_ON_COLLECTION or approved default
```

## 22.2 Create Order with Payment

```text
calculate financials
validate payment
create payment rows
update paid/outstanding
future: create voucher line and link payment row
```

## 22.3 Apply Stored Value

```text
validate source balance
create credit application row
update outstanding
future: link to source voucher/ledger where applicable
```

## 22.4 Collect Outstanding Later

```text
load outstanding
collect payment
create payment row
update outstanding
future: create receipt voucher line
```

## 22.5 Refund

```text
validate refundable amount
create refund row
update payment/refund status
future: create refund voucher line
```

---

# 23. Security, RBAC, and Audit

Permissions:

```text
orders:financial:view
orders:payments:create
orders:payments:refund
orders:credits:apply
orders:adjustments:create
orders:discounts:approve
orders:financial:reconcile
```

Audit:

```text
financial calculation changed
payment added
credit application added
refund added
adjustment added
manual discount added
tax changed
voucher link created
```

---

# 24. Reporting Requirements

Reports:

```text
Order payment summary
Outstanding orders
Pay-on-collection orders
Payment method breakdown
Discount report
Tax report
Stored-value application report
Refund report
Order financial reconciliation report
Voucher-linked order payment report after wiring
```

---

# 25. Integration Requirements

## 25.1 Business Voucher Module

Future linkage:

```text
ORDER_PAYMENT voucher line → org_order_payments_dtl
ORDER_REFUND voucher line → org_order_refunds_dtl
stored-value voucher line → source ledger → credit application
```

## 25.2 Cash Drawer

Cash payment/refund rows should later link to cash drawer movements through voucher wiring.

## 25.3 Stored Value

Credit applications must validate against:

```text
gift card ledger
wallet ledger
advance ledger
credit note ledger
```

## 25.4 Tax and Promotion

Order calculation must consume approved tax and promotion engines/configuration.

---

# 26. Migration and Compatibility

Do not remove old flows immediately.

Migration strategy:

```text
preserve current order financial facts
add voucher link fields additively when wiring begins
do not backfill until voucher module is stable
do not use org_payments_dtl_tr for new order payment expansion
map legacy rows later if needed
```

---

# 27. Non-Functional Requirements

```text
financial summary response under 500ms for normal order
paginated reports
transactional payment/credit/refund writes
idempotency for payment/refund APIs
tenant isolation
branch access control
clear audit trail
English/Arabic UI labels
```

---

# 28. Testing and Acceptance Criteria

## 28.1 P0 Tests

```text
calculate order total
create order with no payment
create order with cash payment
create partial payment
collect outstanding later
gift card not shown as discount
cash tender/change retained cash
gateway pending/completed logic
refund validation
```

## 28.2 P1 Tests

```text
cash + card
wallet + card
advance + pay on collection
credit note + cash
gift card + cash
tax inclusive/exclusive
manual discount
promotion discount
idempotency duplicate submit
```

## 28.3 Acceptance Criteria

Order Fin is accepted when:

```text
1. Order financial summary is accurate.
2. Payments and credits are separated correctly.
3. Gift card/wallet/advance/credit note are not discounts.
4. Outstanding amount is correct.
5. Partial payment and later collection work.
6. Refunds are traceable.
7. Cash tender/change is correct.
8. Gateway payment state is safe.
9. Order financial UI clearly explains the order.
10. Future voucher link fields are supported when wiring begins.
```

---

# 29. Release Plan

## Phase 1 — Preserve and Stabilize Current Order Fin

```text
fix classification
fix gateway semantics
fix payment settings mismatch if applicable
add missing tests
```

## Phase 2 — Improve Order Financial UI

```text
summary tab
payments
credits
discounts
taxes
refunds
adjustments
```

## Phase 3 — Reporting and Reconciliation

```text
outstanding
stored value applications
refunds
payment method breakdown
```

## Phase 4 — Voucher Wiring

```text
link order payment/refund facts to voucher transaction lines
```

---

# 30. Risks and Open Decisions

Risks:

```text
confusing voucher source document with order projection
gift card classification regression
gateway state mismatch
cash tender/change mismatch
overcomplicated settlement persistence
```

Open decisions:

```text
retail default CASH vs PAY_ON_COLLECTION
PAY_ON_DELIVERY inclusion
refund lineage strictness before voucher wiring
which stored-value options are UI-enabled
```

---

# 31. Implementation Checklist

```text
[ ] Review current order financial schema.
[ ] Confirm payment/credit/refund table responsibilities.
[ ] Fix gift-card classification.
[ ] Fix gateway completion semantics.
[ ] Verify payment settings route/schema mismatch.
[ ] Add/confirm order financial summary API.
[ ] Improve order financial tab.
[ ] Add tests for mixed payments.
[ ] Add tests for retained cash.
[ ] Add tests for credit applications.
[ ] Prepare voucher link fields only when wiring begins.
[ ] Do not implement operational voucher wiring inside this PRD.
```

---

# Final Product Decision

Order Fin remains the order-specific operational financial domain.

The Business Voucher module is the business-finance source-document foundation.

Order Fin should preserve existing working order financial tables, improve classification, UI, reports, tests, and reconciliation, and later link to voucher transaction lines during the wiring phase.

Final model:

```text
Business Voucher:
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl

Order Fin:
org_order_* financial facts and projections

Future Wiring:
voucher trx line → order payment/refund/credit projection
```
