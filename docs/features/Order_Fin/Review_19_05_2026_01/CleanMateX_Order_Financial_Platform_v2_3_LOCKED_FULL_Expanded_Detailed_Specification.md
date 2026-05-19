# CleanMateX Order Financial Platform — v2.2 LOCKED FULL Detailed Specification

**Document Type:** Complete Feature Specification, Business Rules, Runtime Flows, Service Contracts, API Contracts, UI/UX Details, Review Checklist  
**Version:** 2.2 LOCKED  
**Project:** CleanMateX multi-tenant SaaS  
**Domain:** Order Finance / Pricing / Multi-Leg Settlement / Payments / Cash Drawer / Stored Value / Promotions / Tax / Loyalty / AR / Reconciliation / Audit / ERP readiness  
**Purpose:** Give Claude Code / Cursor / developers a complete, detailed, reviewable reference without forcing unnecessary redesign.

> **Important instruction for AI coding assistants:**  
> This document is a review baseline, not a command to rebuild everything from zero. First inspect the existing implementation. Preserve working code when it matches the intent. If the implementation differs, document the difference, risk, and suggested safe adjustment. Do not create duplicate tables or endless redesign loops. Ask clarifying questions only for real conflicts.

---

# Table of Contents

- [0. How to Use This Document](#0-how-to-use-this-document)
- [1. Executive Summary](#1-executive-summary)
- [2. Glossary](#2-glossary)
- [3. Locked Architecture Decisions](#3-locked-architecture-decisions)
- [4. Financial Calculation Model](#4-financial-calculation-model)
- [5. Core Data Model](#5-core-data-model)
- [6. Payment and Settlement Configuration](#6-payment-and-settlement-configuration)
- [7. Multi-Leg Settlement](#7-multi-leg-settlement)
- [8. Unpaid Remainder Classification](#8-unpaid-remainder-classification)
- [9. Runtime Flows](#9-runtime-flows)
- [10. Service Layer Specification](#10-service-layer-specification)
- [11. API Specification](#11-api-specification)
- [12. UI/UX Specification](#12-uiux-specification)
- [13. Cash Drawer Specification](#13-cash-drawer-specification)
- [14. Stored Value Specification](#14-stored-value-specification)
- [15. Promotions Specification](#15-promotions-specification)
- [16. Tax Specification](#16-tax-specification)
- [17. Loyalty Specification](#17-loyalty-specification)
- [18. Refunds and Reversals](#18-refunds-and-reversals)
- [19. Outbox, Idempotency, and Audit](#19-outbox-idempotency-and-audit)
- [20. Reconciliation](#20-reconciliation)
- [21. Permissions and Security](#21-permissions-and-security)
- [22. Reporting and Receipts](#22-reporting-and-receipts)
- [23. Testing Strategy](#23-testing-strategy)
- [24. Implementation Review Checklist](#24-implementation-review-checklist)
- [25. Acceptance Criteria](#25-acceptance-criteria)

---

# 0. How to Use This Document

This document should be used to review the implementation of Order Financial features.

Recommended review sequence:

```text
1. Read the existing migrations and current tables.
2. Map existing tables to this document.
3. Identify matched parts.
4. Identify gaps.
5. Identify intentional deviations.
6. Propose safe additive migrations where needed.
7. Avoid destructive changes without approval.
8. Avoid duplicate concepts with different names.
9. Preserve current working implementation if it meets the intent.
10. Use this document as a stable baseline, not an excuse for endless redesign.
```

When the implementation has equivalent functionality using different names, the AI assistant should document the mapping instead of automatically creating new objects.

---

# 1. Executive Summary

CleanMateX Order Financial Platform is the financial engine behind every order.

It handles:

```text
order pricing
item/service gross amount
piece-aware operational tracking
preferences and add-on charges
manual and automatic discounts
promotion/coupon discounts
VAT/tax calculation
currency rounding
gift card application
wallet application
customer advance application
credit note application
loyalty points redemption
cash payment
card payment
bank transfer
check payment
online gateway payment
pay on collection
pay on delivery
credit invoice / AR
multi-leg settlement
cash drawer sessions
cash drawer movements
refunds
reversals
outbox events
financial reconciliation
audit
ERP/accounting posting readiness
```

The platform must support:

```text
multi-tenant isolation
branch awareness
cashier accountability
customer-level balances
idempotent financial operations
stored-value locking
ledger-based audit
receipt replay
refund-by-leg
reconciliation
future ERP posting
```

Core principle:

```text
org_orders_mst stores summary snapshots.
Detailed financial tables, settlement tables, ledger tables, and cash drawer movement tables are the source of truth.
```

---

# 2. Glossary

| Term | Meaning |
|---|---|
| Order financial snapshot | Summary totals stored on `org_orders_mst` for quick UI and reporting |
| Charge | Additional amount added to the order before discounts/tax |
| Discount | Amount deducted from price due to manual discount, promotion, coupon, or loyalty discount |
| Tax | VAT/GST/other tax calculated from taxable base |
| Real payment | Actual money received: cash/card/bank/check/gateway |
| Credit application | Stored value applied to order: gift card, wallet, advance, credit note, loyalty points |
| Deferred settlement | Remaining balance to be paid later, usually pay on collection/delivery |
| AR allocation | Remaining balance moved to invoice/accounts receivable |
| Settlement event | One business settlement attempt/action for an order |
| Settlement leg | One component inside a settlement event |
| Payment leg | A settlement leg where `payment_nature = REAL_PAYMENT` |
| Stored value | Customer-owned value/balance tracked by master + ledger |
| Cash drawer session | A cashier shift/session for a cash drawer |
| Idempotency key | Key preventing duplicate financial mutation |
| Outbox event | Transactional event for async processing |
| Reconciliation | Validating summaries against detailed rows and ledgers |

---

# 3. Locked Architecture Decisions

## 3.1 Modular Monolith

Use a modular monolith for this stage.

Internal modules:

```text
Order Core
Piece Tracking
Preference Engine
Pricing Engine
Charge Engine
Discount Engine
Promotion Engine
Tax Engine
Settlement Engine
Stored Value Engine
Payment Capture Engine
Cash Drawer Engine
Loyalty Engine
Invoice / AR Engine
Refund Engine
Outbox Engine
Reconciliation Engine
Audit Engine
Accounting Posting Engine
```

Reason:

```text
Financial consistency requires strong transaction boundaries.
A modular monolith is safer than early microservices.
```

## 3.2 `org_payment_methods_cf` Is Unified Checkout Settlement Options

Final meaning:

```text
org_payment_methods_cf = tenant checkout settlement options configuration
```

It controls what appears in checkout.

It is not only a real payment-method table.

Routing field:

```text
payment_nature
```

Allowed values:

```text
REAL_PAYMENT
CREDIT_APPLICATION
DEFERRED_SETTLEMENT
AR_ALLOCATION
INTERNAL_ADJUSTMENT
```

Routing:

| payment_nature | Target |
|---|---|
| REAL_PAYMENT | `org_order_payments_dtl` |
| CREDIT_APPLICATION | `org_order_credit_apps_dtl` + stored-value ledger |
| DEFERRED_SETTLEMENT | settlement leg + order snapshot only |
| AR_ALLOCATION | settlement leg + invoice/AR |
| INTERNAL_ADJUSTMENT | adjustment/admin flow |

## 3.3 `org_order_payments_dtl` Stores Real Payments Only

Allowed:

```text
CASH
CARD
CHECK
BANK_TRANSFER
MOBILE_PAYMENT
PAYMENT_GATEWAY
```

Not allowed:

```text
GIFT_CARD
WALLET
ADVANCE
CREDIT_NOTE
LOYALTY_POINTS
PAY_ON_COLLECTION
PAY_ON_DELIVERY
CREDIT_INVOICE
PROMO_CODE
COUPON
DISCOUNT
```

## 3.4 Stored Value Is Not Payment

Stored value application goes to:

```text
org_order_credit_apps_dtl
```

and the relevant ledger.

Examples:

```text
Gift card → org_gift_card_txn_dtl
Wallet → org_wallet_txn_dtl
Advance → org_advance_txn_dtl
Credit note → org_credit_note_txn_dtl
Loyalty points → org_loyalty_txn_dtl
```

## 3.5 Gift Card Is a Liability

Gift card is not discount and not payment row.

Accounting logic:

```text
Gift card sale:
DR Cash / Bank
CR Gift Card Liability

Gift card redemption:
DR Gift Card Liability
CR Revenue / AR settlement
```

## 3.6 Promotions Are Discounts

Promotion/coupon output is a discount row:

```text
org_order_discounts_dtl
```

Promotion/coupon is not:

```text
payment method
payment row
credit application
stored value
```

## 3.7 Invoice Is AR, Not Payment

Credit invoice uses:

```text
payment_nature = AR_ALLOCATION
settlement_type_code = CREDIT_INVOICE
```

It must not create `org_order_payments_dtl`.

## 3.8 Pay on Collection and Pay on Delivery Are Deferred Settlement

Use:

```text
payment_nature = DEFERRED_SETTLEMENT
settlement_type_code = PAY_ON_COLLECTION / PAY_ON_DELIVERY
```

No payment row is created until real payment is collected later.

## 3.9 Multi-Leg Settlement Is Mandatory

Every checkout/collection/refund event should be represented as:

```text
org_order_settlements_mst = settlement event header
org_order_settlement_legs_dtl = individual legs
```

## 3.10 Unpaid Remainder Must Be Classified

There must be no vague pending balance.

Formula:

```text
REAL_PAYMENT legs
+ CREDIT_APPLICATION legs
+ DEFERRED_SETTLEMENT legs
+ AR_ALLOCATION legs
= net_receivable_amount
```

Retail default:

```text
PAY_ON_COLLECTION
```

Delivery default:

```text
PAY_ON_DELIVERY
```

B2B/credit-approved default:

```text
CREDIT_INVOICE when allowed
```

---

# 4. Financial Calculation Model

## 4.1 Calculation Sequence

Use this calculation sequence:

```text
1. Items/services gross amount
2. Add charge rows
3. Calculate gross before discount
4. Apply manual/auto/promotion/coupon discounts
5. Calculate net before tax
6. Calculate VAT/tax
7. Calculate grand total
8. Apply stored value / credit applications
9. Calculate net receivable
10. Apply real payments
11. Classify any unpaid remainder
12. Calculate outstanding
13. Apply rounding/change handling where needed
```

## 4.2 Formula

```text
items_gross_amount
+ services_gross_amount
+ total_charges_amount
= gross_amount

gross_amount
- total_discount_amount
= net_before_tax_amount

net_before_tax_amount
+ total_tax_amount
= grand_total_amount

grand_total_amount
- total_credit_applied_amount
= net_receivable_amount

net_receivable_amount
- total_paid_amount
- deferred_settlement_amount
- invoice_ar_amount
= unclassified_remaining_amount
```

For valid checkout:

```text
unclassified_remaining_amount must be 0
```

## 4.3 Important Summary Fields on `org_orders_mst`

Recommended snapshot fields:

```text
items_gross_amount
services_gross_amount
gross_amount

preference_charges_amount
other_charges_amount
total_charges_amount

auto_discount_amount
manual_discount_amount
promotion_discount_amount
coupon_discount_amount
loyalty_discount_amount
total_discount_amount

net_before_tax_amount

vat_amount
other_tax_amount
total_tax_amount

grand_total_amount

gift_card_applied_amount
wallet_applied_amount
advance_applied_amount
credit_note_applied_amount
loyalty_points_applied_amount
total_credit_applied_amount

net_receivable_amount

cash_paid_amount
card_paid_amount
check_paid_amount
bank_transfer_paid_amount
payment_gateway_paid_amount
total_paid_amount

deferred_settlement_amount
pay_on_collection_amount
pay_on_delivery_amount
invoice_ar_amount

rounding_adjustment_amount
change_returned_amount
outstanding_amount

settlement_status
payment_type_code

pricing_engine_version
tax_engine_version
promotion_engine_version
settlement_engine_version
```

If some names already differ in code, map equivalent fields instead of duplicating blindly.

## 4.4 Settlement Status Values

Recommended V1 values:

```text
NOT_SETTLED
PARTIALLY_SETTLED
SETTLED
PENDING_COLLECTION
PENDING_DELIVERY_COLLECTION
INVOICED_AR
PARTIALLY_REFUNDED
REFUNDED
VOIDED
```

Minimum V1:

```text
NOT_SETTLED
PARTIALLY_SETTLED
SETTLED
PENDING_COLLECTION
INVOICED_AR
```

---

# 5. Core Data Model

## 5.1 Order Core

Tables:

```text
org_orders_mst
org_order_items_dtl
```

Responsibilities:

```text
store order header
store order lines
store financial snapshot
store current order status
store outstanding amount
store settlement status
```

Rules:

```text
Frontend must not calculate final totals.
Backend financial services must calculate and update snapshots.
```

## 5.2 Pieces

Existing table:

```text
org_order_item_pieces_dtl
```

Purpose:

```text
physical item pieces
piece barcode
scan state
rack location
QA status
packing status
workflow status
```

Examples:

```text
Shirt quantity 3 → 3 pieces.
Suit → 2 or more pieces from template.
```

Recommended product template tables:

```text
org_product_piece_templates_mst
org_product_piece_templates_dtl
```

Rule:

```text
Order item owns price.
Piece owns operational tracking.
```

## 5.3 Preferences

Existing table:

```text
org_order_preferences_dtl
```

Purpose:

```text
order/item/piece-level preferences
service add-ons
stains
damage
color
packing
notes
operator confirmation
```

Rule:

```text
Preference records selected/observed data.
Charge row records financial effect.
```

If `extra_price > 0`, pricing engine should create/refresh corresponding `org_order_charges_dtl`.

## 5.4 Financial Fact Tables

Core financial detail tables:

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_settlements_mst
org_order_settlement_legs_dtl
org_order_credit_apps_dtl
org_order_payments_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
```

---

# 6. Payment and Settlement Configuration

## 6.1 `sys_payment_type_cd`

Authoritative settlement timing table.

Expected values:

```text
PAY_IN_ADVANCE
PAY_ON_COLLECTION
PAY_ON_DELIVERY
CREDIT_INVOICE
```

Do not create or use a competing duplicate table as the main source.

## 6.2 `sys_payment_method_cd`

Payment / checkout option vocabulary.

Expected real payment method codes:

```text
CASH
CARD
CHECK
BANK_TRANSFER
MOBILE_PAYMENT
PAYMENT_GATEWAY
```

Expected credit application codes:

```text
GIFT_CARD
WALLET
ADVANCE
CREDIT_NOTE
LOYALTY_POINTS
```

Possible compatibility settlement codes:

```text
PAY_ON_COLLECTION
PAY_ON_DELIVERY
CREDIT_INVOICE
```

Deprecated legacy rows:

```text
INVOICE
HYPERPAY
PAYTABS
STRIPE
```

Do not seed deprecated rows into tenant checkout configuration.

## 6.3 `sys_payment_gateway_cd`

Official provider catalog.

Expected gateway/provider codes:

```text
STRIPE
HYPERPAY
PAYTABS
MANUAL
```

Tenant gateway options use:

```text
payment_method_code = PAYMENT_GATEWAY
gateway_code = STRIPE / HYPERPAY / PAYTABS
```

Do not create:

```text
sys_payment_gateway_provider_cd
```

## 6.4 `sys_payment_status_cd`

Expected values:

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

Use `COMPLETED` for successful payment in V1.

## 6.5 Tenant Table: `org_payment_methods_cf`

Required meaning:

```text
Tenant checkout settlement options.
```

Important fields:

```text
payment_method_code
gateway_code
payment_nature
settlement_type_code
credit_application_type
requires_cash_drawer
requires_terminal
min_amount
max_amount
min_order_amount
max_order_amount
currency_code
is_enabled
is_active
is_platform_disabled
allowed_in_pos
allowed_in_customer_app
allowed_in_staff_app
allowed_in_admin_app
allowed_for_pay_now
allowed_for_pay_on_collection
allowed_for_invoice_payment
allowed_for_refund
supports_partial_payment
supports_overpayment
supports_change_return
requires_reference
requires_approval
fee_type
fee_amount
fee_rate
gateway_config
ui_config
validation_rules
metadata
display_order
```

## 6.6 Availability Rule

Checkout option is available only when:

```text
org option is active/enabled/not platform disabled
system method is active/enabled/not deprecated/not globally disabled
if gateway exists: gateway is active/enabled/not globally disabled
branch override allows it
channel allows it
customer/order eligibility allows it
amount/order limits allow it
```

---

# 7. Multi-Leg Settlement

## 7.1 Concept

A checkout is not always one payment. It can be multiple settlement legs.

Example:

```text
Order total: 30.000
Gift Card:   5.000
Wallet:      3.000
Cash:       10.000
Visa:        7.000
Mastercard:  5.000
```

This becomes:

```text
Settlement header: 1 row
Settlement legs: 5 rows
Credit application rows: 2 rows
Payment rows: 3 rows
Stored value ledger rows: 2 rows
Cash drawer movement rows: 1 row if cash
```

## 7.2 `org_order_settlements_mst`

Purpose:

```text
Header for one settlement event.
```

Events:

```text
CHECKOUT
COLLECTION
REFUND
ADJUSTMENT
INVOICE_ALLOCATION
```

Important fields:

```text
id
tenant_org_id
branch_id
order_id
customer_id
settlement_no
settlement_type
settlement_status
currency_code
gross_due_amount
credit_applied_amount
paid_amount
deferred_amount
ar_amount
rounding_adjustment_amount
change_returned_amount
outstanding_before_amount
outstanding_after_amount
idempotency_key
performed_by
performed_at
metadata
rec_status
audit fields
```

Statuses:

```text
DRAFT
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
PARTIALLY_REVERSED
REVERSED
```

## 7.3 `org_order_settlement_legs_dtl`

Purpose:

```text
One row per settlement component.
```

Important fields:

```text
id
tenant_org_id
branch_id
settlement_id
order_id
leg_no
org_payment_method_id
payment_method_code
payment_method_name_snapshot
payment_nature
gateway_code
settlement_type_code
credit_application_type
leg_status
amount
currency_code
target_table
target_id
source_id
source_code
reference_no
tendered_amount
change_returned_amount
card_brand_code
card_last4
auth_code
gateway_transaction_id
gateway_reference
bank_reference
check_no
check_bank_name
check_due_date
cash_drawer_id
cash_drawer_session_id
payment_terminal_id
reversal_leg_id
reversed_at
reversed_by
reversal_reason
metadata
rec_status
audit fields
```

Leg statuses:

```text
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
REVERSED
```

## 7.4 Target Links

Every routed leg should store:

```text
target_table
target_id
```

Examples:

```text
REAL_PAYMENT cash leg → target_table = org_order_payments_dtl
CREDIT_APPLICATION gift card leg → target_table = org_order_credit_apps_dtl
DEFERRED_SETTLEMENT leg → target_table = org_orders_mst or null with metadata
AR_ALLOCATION leg → target_table = org_invoices_mst / org_invoice_lines_dtl when generated
```

## 7.5 Required References in Target Tables

Recommended:

```text
settlement_id
settlement_leg_id
```

on:

```text
org_order_payments_dtl
org_order_credit_apps_dtl
org_order_refunds_dtl
org_cash_drawer_movements_dtl
org_order_adjustments_dtl
```

For refund:

```text
original_settlement_leg_id
```

## 7.6 Multi-Card Requirement

Support multiple card legs.

Example:

```text
Visa terminal A 10.000
Visa terminal B 5.000
Mastercard terminal C 7.000
```

Do not aggregate because each leg may have a different authorization/reference/terminal/refund path.

## 7.7 Multi-Gift-Card Requirement

Support multiple gift cards.

Example:

```text
Gift Card A 5.000
Gift Card B 3.000
```

Each card must be separately locked and posted to ledger.

## 7.8 Partial Settlement

Support partial settlement.

Example:

```text
Net receivable: 30.000
Paid now:       10.000
Outstanding:    20.000
```

The 20.000 must be classified as deferred or AR, not left vague.

---

# 8. Unpaid Remainder Classification

## 8.1 Rule

Any unpaid amount after payment/credit legs must be classified.

Valid classifications:

```text
DEFERRED_SETTLEMENT
AR_ALLOCATION
```

Invalid:

```text
Unclassified pending amount
```

## 8.2 Default Logic

| Scenario | Default |
|---|---|
| Retail / walk-in | PAY_ON_COLLECTION |
| Delivery order | PAY_ON_DELIVERY |
| B2B / corporate credit-approved | CREDIT_INVOICE |

The user can decide when multiple options are eligible, but the system should have safe defaults.

## 8.3 Example

```text
Net Receivable: 30.000
Cash:           10.000
Card:            5.000
Bank Transfer:   5.000
Remaining:      10.000
```

Correct legs:

```text
CASH 10.000 REAL_PAYMENT
CARD 5.000 REAL_PAYMENT
BANK_TRANSFER 5.000 REAL_PAYMENT
PAY_ON_COLLECTION 10.000 DEFERRED_SETTLEMENT
```

No payment row is created for `PAY_ON_COLLECTION`.

## 8.4 Backend Validation

Reject checkout when:

```text
remaining_amount > 0
and no DEFERRED_SETTLEMENT or AR_ALLOCATION leg exists
```

unless admin adjustment flow explicitly allows it.

---

# 9. Runtime Flows

## 9.1 Create / Reprice Order

Steps:

```text
1. Authenticate user.
2. Resolve tenant, branch, and channel.
3. Load order and item lines.
4. Validate order is editable.
5. Generate or validate pieces if item quantity or compound product requires pieces.
6. Load order/item/piece preferences.
7. Convert chargeable preferences into charge lines.
8. Calculate base item/service gross.
9. Add charges.
10. Apply discounts.
11. Run promotion engine.
12. Calculate tax.
13. Apply rounding rules.
14. Build FinancialBreakdownSnapshot.
15. Persist financial snapshot to org_orders_mst.
16. Persist/refresh charge, discount, tax rows as needed.
17. Return snapshot to UI.
```

Important:

```text
Client totals are display-only.
Server totals are authoritative.
```

## 9.2 Checkout Settlement

Steps inside one DB transaction:

```text
1. Authenticate user.
2. Resolve tenant, branch, channel, user permissions.
3. Validate idempotency key.
4. Lock order row.
5. Recalculate server financial totals.
6. Compare client totals if submitted.
7. Load selected org_payment_methods_cf rows by IDs.
8. Validate each option is active/allowed.
9. Apply branch overrides.
10. Validate customer eligibility.
11. Validate payment/credit/deferred/AR totals.
12. Create settlement header.
13. Create settlement leg rows.
14. Process CREDIT_APPLICATION legs first.
15. Process REAL_PAYMENT legs second.
16. Process DEFERRED_SETTLEMENT and AR_ALLOCATION legs last.
17. Update target_table/target_id on each leg.
18. Insert cash drawer movement for cash payment legs.
19. Update order snapshot and settlement status.
20. Emit outbox events.
21. Store idempotency result.
22. Commit.
```

## 9.3 Pay on Collection Initial Flow

```text
1. User selects PAY_ON_COLLECTION or system defaults unpaid remainder to it.
2. Create settlement header.
3. Create DEFERRED_SETTLEMENT leg.
4. Do not create payment row.
5. Set outstanding amount.
6. Set settlement status to PENDING_COLLECTION or PARTIALLY_SETTLED.
7. Continue operational workflow.
```

## 9.4 Pay on Collection Final Flow

```text
1. Staff opens order at collection.
2. System shows outstanding amount.
3. Customer pays using REAL_PAYMENT legs.
4. Create COLLECTION settlement header.
5. Create payment legs.
6. Create payment rows.
7. Create cash drawer movement if cash.
8. Reduce outstanding.
9. Mark settlement/order as settled if outstanding becomes zero.
```

## 9.5 Credit Invoice Flow

```text
1. Customer/order is eligible for credit invoice.
2. User selects CREDIT_INVOICE or system defaults for B2B.
3. Create AR_ALLOCATION leg.
4. Do not create payment row.
5. Create/update invoice/AR record depending implementation stage.
6. Update invoice_ar_amount and outstanding.
7. Set settlement status to INVOICED_AR or PARTIALLY_SETTLED.
```

## 9.6 Cash Payment Flow

```text
1. Validate CASH option.
2. Validate open cash drawer session if required.
3. Validate tendered_amount >= amount.
4. Calculate change_returned = tendered_amount - amount.
5. Create settlement leg.
6. Create payment row.
7. Create cash drawer movement with retained amount only.
8. Update order totals.
```

Cash drawer movement amount:

```text
payment amount, not tendered amount
```

## 9.7 Card / Gateway Flow

```text
1. Validate CARD or PAYMENT_GATEWAY option.
2. Validate terminal/gateway/reference if required.
3. Create settlement leg.
4. Create payment row.
5. Store auth/gateway/reference details.
6. No cash drawer movement.
```

## 9.8 Stored Value Application Flow

```text
1. Validate credit application option.
2. Validate source_id/source_code.
3. Lock stored-value master row.
4. Validate sufficient balance/points.
5. Create settlement leg.
6. Create org_order_credit_apps_dtl row.
7. Create ledger transaction row.
8. Update master balance.
9. Store target_table/target_id on leg.
```

## 9.9 Refund Flow

```text
1. Validate refund permission.
2. Load original settlement leg.
3. Validate refundable amount.
4. Lock original payment/credit/stored-value row.
5. Create REFUND settlement header.
6. Create refund settlement leg.
7. Create org_order_refunds_dtl row.
8. Reverse/refund target:
   - cash → cash drawer CASH_REFUND movement
   - card/gateway → refund reference
   - gift card/wallet/advance/credit note/loyalty → restore ledger
9. Update original leg/payment/credit status if needed.
10. Update order refund summary.
11. Emit outbox event.
12. Commit.
```

---

# 10. Service Layer Specification

## 10.1 `checkout-config.service.ts`

### Purpose

Return all checkout settlement options grouped for UI.

### Responsibilities

```text
load org_payment_methods_cf
join sys_payment_method_cd
left join sys_payment_gateway_cd
join branch overrides if available
filter active/enabled/platform/global disabled
filter by channel
filter by branch
filter by customer type
filter by order total limits
enrich display metadata
group by payment_nature
return UI-ready options
```

### Input

```ts
type GetCheckoutOptionsInput = {
  tenantOrgId: string;
  branchId?: string;
  customerId?: string;
  orderId?: string;
  channel: 'POS' | 'CUSTOMER_APP' | 'STAFF_APP' | 'ADMIN';
  orderTotal?: string;
};
```

### Output

```ts
type CheckoutSettlementOptions = {
  paymentMethods: SettlementOption[];
  creditApplications: SettlementOption[];
  deferredSettlement: SettlementOption[];
  arOptions: SettlementOption[];
  internalAdjustments?: SettlementOption[];
};
```

### Business Rules

```text
Cash option should include requiresCashDrawer.
Card/gateway option should include requiresTerminal or reference requirements.
Credit application options should include available balance if customer is known.
Credit invoice should only show if customer is credit-approved or admin override exists.
Pay on delivery should only show for delivery-supported order/channel.
Disabled gateway must hide dependent PAYMENT_GATEWAY option.
```

---

## 10.2 `order-calculation.service.ts`

### Purpose

Calculate all order financial totals.

### Responsibilities

```text
calculate base item/services amount
calculate preference charges
calculate manual charges
calculate discounts
run promotion engine
run tax engine
apply rounding
return financial snapshot
prepare charge/discount/tax rows
```

### Input

```ts
type CalculateOrderInput = {
  tenantOrgId: string;
  branchId?: string;
  orderId: string;
  customerId?: string;
  channel: string;
  pricingMode?: 'PREVIEW' | 'COMMIT';
};
```

### Output

```ts
type FinancialBreakdownSnapshot = {
  itemsGrossAmount: string;
  servicesGrossAmount: string;
  grossAmount: string;
  totalChargesAmount: string;
  totalDiscountAmount: string;
  netBeforeTaxAmount: string;
  totalTaxAmount: string;
  grandTotalAmount: string;
  totalCreditAppliedAmount?: string;
  netReceivableAmount: string;
  totalPaidAmount?: string;
  outstandingAmount?: string;
  roundingAdjustmentAmount: string;
  lines: {
    charges: unknown[];
    discounts: unknown[];
    taxes: unknown[];
  };
};
```

### Rules

```text
Never trust frontend totals.
Amounts must use decimal-safe representation.
Tax calculated after discount.
Stored value does not reduce tax base unless configured by tax policy.
```

---

## 10.3 `order-settlement.service.ts`

### Purpose

Create and process multi-leg settlements.

### Core Methods

```ts
createSettlement(input)
validateSettlementLegs(input)
routeSettlementLeg(tx, settlement, leg)
processRealPaymentLeg(tx, settlement, leg)
processCreditApplicationLeg(tx, settlement, leg)
processDeferredSettlementLeg(tx, settlement, leg)
processArAllocationLeg(tx, settlement, leg)
reverseSettlementLeg(tx, leg)
updateOrderSnapshot(tx, orderId)
emitOutboxEvents(tx)
```

### Input

```ts
type CreateSettlementInput = {
  tenantOrgId: string;
  branchId?: string;
  orderId: string;
  customerId?: string;
  settlementType: 'CHECKOUT' | 'COLLECTION' | 'REFUND' | 'ADJUSTMENT' | 'INVOICE_ALLOCATION';
  idempotencyKey: string;
  performedBy: string;
  legs: CheckoutSettlementLegInput[];
  clientTotals?: FinancialBreakdownSnapshot;
};
```

### Rules

```text
Create one settlement header per event.
Create one settlement leg per selected component.
Route by payment_nature from DB, not frontend.
Credit applications before real payments.
Deferred/AR only for remaining or explicitly selected amount.
Update target_table/target_id after route processing.
All operations in one transaction.
```

---

## 10.4 `payment-capture.service.ts`

### Purpose

Handle real payment leg capture.

### Responsibilities

```text
cash payment
card payment
check payment
bank transfer
gateway payment
payment reference validation
payment status assignment
cash drawer integration for cash
```

### Rules

```text
Only REAL_PAYMENT legs enter this service.
Cash requires drawer if configured.
Card/gateway may be pending/processing if async.
Bank transfer requires reference if configured.
Check requires check number and bank metadata if configured.
```

---

## 10.5 `stored-value.service.ts`

### Purpose

Apply stored value to order and manage ledgers.

### Responsibilities

```text
apply gift card
apply wallet
apply advance
apply credit note
apply loyalty points
lock source row
validate balance
write credit app row
write ledger row
update balance
reverse application
```

### Required Locking

Use transaction locking or equivalent for:

```text
gift card balance
wallet balance
advance balance
credit note balance
loyalty points balance
```

### Idempotency

Every stored-value mutation must be idempotent.

---

## 10.6 `cash-drawer.service.ts`

### Purpose

Manage cash sessions and cash movements.

### Responsibilities

```text
open session
close session
get active session
record cash sale
record cash refund
record cash in
record cash out
record cash drop
calculate expected cash
calculate shortage/overage
force close
```

### Required Inputs for Cash Sale

```ts
type RecordCashSaleInput = {
  tenantOrgId: string;
  branchId: string;
  cashDrawerId: string;
  cashDrawerSessionId: string;
  orderId: string;
  settlementId: string;
  settlementLegId: string;
  orderPaymentId: string;
  amount: string;
  currencyCode: string;
  performedBy: string;
};
```

### Rule

```text
Movement amount = retained cash amount.
Do not record tendered amount as drawer sale.
```

---

## 10.7 `promotion-engine.service.ts`

### Purpose

Evaluate promotions and coupons.

### Responsibilities

```text
load active promotions
validate coupon code
evaluate eligibility
calculate discount
enforce stacking
enforce usage limit
enforce budget
write usage row
return discount rows
```

### Rules

```text
Promotion result is discount.
Promotion is not settlement leg unless it awards stored value separately.
```

---

## 10.8 `tax-engine.service.ts`

### Purpose

Calculate tax snapshot.

### Responsibilities

```text
load tax profile
apply exemptions
calculate inclusive tax
calculate exclusive tax
calculate compound tax
produce org_order_taxes_dtl rows
```

### Rules

```text
Tax before stored value.
Tax rows are snapshot rows.
Tax should be reproducible from stored snapshot.
```

---

## 10.9 `loyalty.service.ts`

### Purpose

Redeem and earn loyalty points.

### Responsibilities

```text
get loyalty account
redeem points during checkout
write ledger row
queue earn points after completion
process earn points from outbox
adjust points
expire points
calculate tier
```

---

## 10.10 `refund.service.ts`

### Purpose

Refund by original settlement leg.

### Responsibilities

```text
load original settlement leg
validate refundable amount
create refund settlement
create refund leg
create refund row
reverse original target
update ledger/payment status
update order summary
emit outbox
```

---

## 10.11 `outbox.service.ts`

### Purpose

Transactionally emit events for async processing.

### Responsibilities

```text
create event in same transaction
claim pending events
retry failed events
mark processed
mark failed
handle backoff
```

Fallback:

```text
If pg_cron/pg_net unavailable, use backend scheduler, external cron, or GitHub Action.
```

---

## 10.12 `reconciliation.service.ts`

### Purpose

Validate financial consistency.

Checks:

```text
PAYMENT_TOTAL_MATCH
CREDIT_APP_BALANCE
STORED_VALUE_LEDGER
TAX_CALCULATION
DISCOUNT_VALIDATION
REFUND_CONSISTENCY
OUTBOX_PROCESSED
SETTLEMENT_HEADER_TOTALS
SETTLEMENT_LEG_TARGET_MATCH
CASH_DRAWER_EXPECTED_MATCH
```

---

# 11. API Specification

## 11.1 GET `/api/v1/orders/checkout-options`

### Purpose

Return grouped checkout options.

### Query

```text
orderId
branchId
customerId
channel
```

### Response

```json
{
  "paymentMethods": [],
  "creditApplications": [],
  "deferredSettlement": [],
  "arOptions": [],
  "warnings": []
}
```

### Rules

```text
Group by payment_nature.
Hide disabled methods.
Hide disabled gateways.
Hide AR if customer is not eligible unless admin override.
Include available balances for credit applications when possible.
```

---

## 11.2 POST `/api/v1/orders/preview-payment`

### Purpose

Preview settlement result before committing.

### Request

```json
{
  "orderId": "uuid",
  "legs": [
    {
      "orgPaymentMethodId": "uuid",
      "amount": "10.000"
    }
  ]
}
```

### Response

```json
{
  "valid": true,
  "summary": {
    "netReceivableAmount": "30.000",
    "totalPaidAmount": "10.000",
    "totalCreditAppliedAmount": "0.000",
    "deferredAmount": "20.000",
    "outstandingAmount": "20.000"
  },
  "requiredRemainderClassification": true,
  "messages": []
}
```

---

## 11.3 POST `/api/v1/orders/create-with-payment`

### Purpose

Create order and settlement in one request.

### Request

```ts
type CreateWithPaymentRequest = {
  orderDraft: unknown;
  settlement: {
    idempotencyKey: string;
    settlementType: 'CHECKOUT';
    legs: CheckoutSettlementLegInput[];
  };
};
```

### Rules

```text
Create order.
Calculate totals.
Validate settlement legs.
Persist everything transactionally.
```

---

## 11.4 POST `/api/v1/orders/[orderId]/collect-payment`

### Purpose

Collect outstanding amount later.

### Request

```json
{
  "idempotencyKey": "string",
  "legs": [
    {
      "orgPaymentMethodId": "uuid",
      "amount": "10.000",
      "tenderedAmount": "10.000",
      "cashDrawerSessionId": "uuid"
    }
  ]
}
```

### Rules

```text
Only outstanding amount can be collected.
Do not allow PAY_ON_COLLECTION as a collection payment leg.
Collection should use REAL_PAYMENT or allowed CREDIT_APPLICATION if policy allows.
```

---

## 11.5 GET `/api/v1/orders/[orderId]/payment-summary`

### Purpose

Return financial and settlement summary.

### Response includes:

```text
financial snapshot
settlement history
settlement legs
payment rows
credit applications
refunds
outstanding amount
available actions
```

---

## 11.6 Cash Drawer APIs

### GET `/api/v1/cash-drawers`

Returns drawers and active sessions.

### POST `/api/v1/cash-drawers/[drawerId]/open-session`

Request:

```json
{
  "openingFloatAmount": "50.000",
  "currencyCode": "OMR",
  "notes": "Morning shift"
}
```

### POST `/api/v1/cash-drawers/[drawerId]/close-session`

Request:

```json
{
  "sessionId": "uuid",
  "countedCashAmount": "250.000",
  "closeNotes": "End shift"
}
```

### POST `/api/v1/cash-drawers/[drawerId]/cash-movement`

Request:

```json
{
  "sessionId": "uuid",
  "movementType": "CASH_IN",
  "amount": "10.000",
  "reason": "Extra float"
}
```

---

## 11.7 Stored Value APIs

```text
GET  /api/v1/customers/[customerId]/stored-value
POST /api/v1/customers/[customerId]/wallet/top-up
GET  /api/v1/customers/[customerId]/wallet/ledger
POST /api/v1/customers/[customerId]/advance/issue
GET  /api/v1/customers/[customerId]/advance/ledger
POST /api/v1/customers/[customerId]/credit-note/issue
GET  /api/v1/customers/[customerId]/credit-notes
GET  /api/v1/gift-cards/[cardCode]/balance
GET  /api/v1/gift-cards/[cardCode]/ledger
```

---

## 11.8 Promotions APIs

```text
GET    /api/v1/marketing/promotions
POST   /api/v1/marketing/promotions
GET    /api/v1/marketing/promotions/[promoId]
PATCH  /api/v1/marketing/promotions/[promoId]
DELETE /api/v1/marketing/promotions/[promoId]
POST   /api/v1/marketing/promotions/validate
```

---

## 11.9 Tax APIs

```text
GET   /api/v1/settings/tax/profiles
POST  /api/v1/settings/tax/profiles
PATCH /api/v1/settings/tax/profiles/[profileId]
GET   /api/v1/settings/tax/exemptions
POST  /api/v1/settings/tax/exemptions
```

---

## 11.10 Payment Config APIs

```text
GET   /api/v1/settings/payments/methods
PATCH /api/v1/settings/payments/methods/[methodId]
GET   /api/v1/settings/payments/terminals
POST  /api/v1/settings/payments/terminals
```

---

# 12. UI/UX Specification

## 12.1 Checkout Layout

Recommended checkout payment area:

```text
1. Financial Summary Panel
2. Credits Applied Section
3. Payment Methods Section
4. Deferred Settlement Section
5. Invoice / AR Section
6. Remaining Amount Decision Panel
7. Settlement Legs Preview
8. Confirm Settlement Button
```

## 12.2 Financial Summary Panel

Show:

```text
Gross amount
Charges
Discounts
Tax/VAT
Grand total
Credits applied
Net receivable
Paid now
Deferred amount
Invoice amount
Outstanding
Rounding
Change returned
```

## 12.3 Credits Applied Section

Show options:

```text
Gift Card
Wallet
Advance
Credit Note
Loyalty Points
```

Each option should show:

```text
available balance
currency
input amount
validation message
source selector/scanner where needed
```

Gift card UI:

```text
enter/scan gift card code
check balance
apply amount
show remaining card balance
```

Wallet UI:

```text
show available wallet balance
apply amount
```

Credit note UI:

```text
select valid credit note
show remaining balance
apply amount
```

## 12.4 Payment Methods Section

Show options:

```text
Cash
Card
Check
Bank Transfer
Payment Gateway
```

Cash fields:

```text
amount
tendered amount
change returned
cash drawer session
```

Card fields:

```text
amount
terminal
card brand
last4 optional
auth/reference
```

Bank transfer fields:

```text
amount
bank reference
transfer date optional
attachment optional in future
```

Check fields:

```text
amount
check number
bank name
due date
check status
```

Gateway fields:

```text
provider
amount
gateway status
gateway reference
```

## 12.5 Deferred Settlement Section

Show:

```text
Pay on Collection
Pay on Delivery
```

When selected:

```text
amount
expected collection stage
notes optional
```

Must clearly display:

```text
This is not a payment now. It keeps the amount outstanding.
```

## 12.6 Invoice / AR Section

Show only if customer is eligible or admin override.

Fields:

```text
amount
customer credit account
payment terms
invoice generation option
PO/reference optional
```

Must clearly display:

```text
This will be recorded as receivable, not as payment.
```

## 12.7 Remaining Amount Decision Panel

If remaining amount > 0:

```text
Remaining Amount: X

How should the remaining amount be handled?
[Pay on Collection]
[Pay on Delivery]
[Credit Invoice]
```

Defaults:

```text
Retail → Pay on Collection
Delivery → Pay on Delivery
B2B credit-approved → Credit Invoice
```

Confirm button disabled until classified.

## 12.8 Settlement Legs Preview

Before final confirmation, show table:

```text
Leg Type
Method
Source/Reference
Amount
Status/Validation
Target
```

Example:

```text
REAL_PAYMENT | CASH | Drawer #1 | 10.000 | Valid
REAL_PAYMENT | CARD | Visa ****1234 | 5.000 | Valid
DEFERRED_SETTLEMENT | PAY_ON_COLLECTION | - | 10.000 | Valid
```

## 12.9 Order Detail Financial Tab

Panels:

```text
FinancialBreakdownCard
SettlementHistoryTable
SettlementLegsTable
OrderPaymentsTable
OrderCreditsAppliedTable
OrderTaxesTable
OrderDiscountsTable
OrderRefundsSection
CashDrawerLinks
Receipt/Invoice actions
Audit timeline
```

## 12.10 Receipt UI

Receipt must replay settlement legs.

Example:

```text
Order Total:              30.000

Credits Applied:
  Gift Card A             -5.000
  Wallet                  -3.000

Payments:
  Cash                    10.000
  Visa ****1234            7.000
  Mastercard ****9999      5.000

Outstanding:               0.000
```

Pay on collection receipt:

```text
Order Total:              30.000
Paid Now:                  0.000
Pay on Collection:        30.000
Outstanding:              30.000
```

## 12.11 Cash Drawer UI

Screens:

```text
Open Session
Current Session Summary
Cash In
Cash Out
Cash Drop
Close Session
Movement History
Close Report
Shortage/Overage Report
```

Current session summary:

```text
Opening float
Cash sales
Cash refunds
Cash in
Cash out
Cash drop
Expected cash
Counted cash
Difference
```

## 12.12 Customer Stored Value UI

Panels:

```text
Wallet balance
Wallet ledger
Advance balance
Advance ledger
Credit notes
Gift card balances
Loyalty points
```

## 12.13 Settings UI

Payment settings:

```text
Tenant checkout options
Branch overrides
Payment terminals
Gateway configs
Cash drawer settings
```

Tax settings:

```text
Tax profiles
Tax rates
Tax exemptions
Tax inclusive/exclusive mode
```

---

# 13. Cash Drawer Specification

## 13.1 Tables

```text
org_cash_drawers_mst
org_cash_drawer_sessions_mst
org_cash_drawer_movements_dtl
```

## 13.2 Open Session Flow

```text
1. User selects drawer.
2. Validate drawer active.
3. Validate no open session for same drawer.
4. Enter opening float.
5. Create session with status OPEN.
6. Create OPENING_FLOAT movement.
7. Expected cash = opening float.
```

## 13.3 Cash Sale Flow

```text
1. Cash settlement leg is processed.
2. Payment row is created.
3. CASH_SALE movement is created.
4. Movement amount = payment amount.
5. Expected cash increases by payment amount.
```

## 13.4 Cash Refund Flow

```text
1. Refund leg is processed.
2. Refund row is created.
3. CASH_REFUND movement is created.
4. Expected cash decreases by refund amount.
```

## 13.5 Cash In / Out / Drop

Cash In:

```text
manual increase of drawer expected cash
requires reason
```

Cash Out:

```text
manual decrease of drawer expected cash
requires reason
may require approval
```

Cash Drop:

```text
remove cash from drawer to safe/back office
requires destination/reference
```

## 13.6 Close Session Flow

```text
1. Calculate expected cash from movements.
2. User enters counted cash.
3. Difference = counted - expected.
4. Create CLOSING_COUNT movement.
5. Create SHORTAGE or OVERAGE record if difference exists.
6. Close session.
```

---

# 14. Stored Value Specification

## 14.1 Common Ledger Rules

Every stored-value type must have:

```text
master/current balance row
ledger transaction rows
balance_before
balance_after
transaction type
source reference
idempotency
locking
audit
```

## 14.2 Gift Card

Lifecycle:

```text
DRAFT
GENERATED
ACTIVE
PARTIALLY_REDEEMED
FULLY_REDEEMED
EXPIRED
VOIDED
SUSPENDED
```

Transactions:

```text
ISSUE
ACTIVATE
REDEEM
REFUND
EXPIRE
ADJUSTMENT
VOID
BONUS_ADD
BONUS_REDEEM
```

Rules:

```text
Cannot redeem inactive/expired/voided card.
Cannot redeem more than available balance.
Can redeem partial amount.
Can use multiple gift cards on one order.
Must lock card during redemption.
```

## 14.3 Wallet

Transactions:

```text
TOP_UP
APPLY_TO_ORDER
REFUND_TO_WALLET
REVERSAL
ADJUSTMENT
BONUS_ADD
EXPIRY
```

## 14.4 Advance

Purpose:

```text
Prepaid customer amount applied later to order.
```

Transactions:

```text
RECEIVE_ADVANCE
APPLY_TO_ORDER
REFUND_ADVANCE
TRANSFER_TO_CREDIT
REVERSAL
ADJUSTMENT
```

## 14.5 Credit Note

Purpose:

```text
Formal credit document for customer.
```

Transactions:

```text
ISSUE
APPLY_TO_ORDER
REFUND
REVERSAL
ADJUSTMENT
VOID
EXPIRE
```

## 14.6 Loyalty Points

Transactions:

```text
EARN
REDEEM
EXPIRE
ADJUST
BONUS
REVERSAL
```

---

# 15. Promotions Specification

## 15.1 Promotion Types

```text
PERCENTAGE
FIXED_AMOUNT
BUY_X_GET_Y
FREE_ITEM
FREE_DELIVERY
LOYALTY_BONUS
WALLET_BONUS
GIFT_CARD_BONUS
```

## 15.2 Eligibility

Promotion may depend on:

```text
date/time
branch
customer segment
customer type
first order
minimum order amount
service category
product/item
payment channel
coupon code
usage count
budget
```

## 15.3 Stacking

Stacking policies:

```text
EXCLUSIVE
STACKABLE
BEST_DISCOUNT_ONLY
MANUAL_APPROVAL
```

## 15.4 Output

Promotion output can be:

```text
discount row
free item/charge adjustment
stored-value bonus ledger
loyalty bonus ledger
```

But promotion/coupon itself is not a payment.

---

# 16. Tax Specification

## 16.1 Calculation Timing

Tax is calculated:

```text
after charges and discounts
before credits and payments
```

## 16.2 Modes

```text
TAX_EXCLUSIVE
TAX_INCLUSIVE
```

## 16.3 Exemptions

Tax exemption can apply by:

```text
customer
product
service category
branch
tenant
specific legal rule
```

## 16.4 Compound Tax

Formula:

```text
compound effective rate = product of (1 + rates) - 1
```

Example:

```text
VAT 5% + service charge 7%
1.05 × 1.07 - 1 = 12.35%
```

---

# 17. Loyalty Specification

## 17.1 Earn

Loyalty earn usually occurs after:

```text
order completed
order delivered
payment confirmed
```

Use outbox event to avoid slowing checkout.

## 17.2 Redeem

Loyalty redemption occurs during settlement as:

```text
payment_nature = CREDIT_APPLICATION
credit_application_type = LOYALTY_POINTS
```

## 17.3 Tier

Tier can depend on:

```text
lifetime points
spend amount
order count
recent activity
```

---

# 18. Refunds and Reversals

## 18.1 Refund by Leg

Refund must reference original settlement leg.

Refund examples:

```text
cash leg → cash refund + cash drawer movement
card leg → card/gateway refund
gift card leg → restore gift card
wallet leg → restore wallet
advance leg → restore advance
credit note leg → restore credit note
loyalty leg → restore points
```

## 18.2 Partial Refund

Support partial refund by leg.

Example:

```text
Original card leg: 10.000
Refund amount: 4.000
Remaining refundable: 6.000
```

## 18.3 Full Reversal

A full reversal reverses all reversible legs in a settlement.

Must not blindly reverse already refunded/reversed legs.

---

# 19. Outbox, Idempotency, and Audit

## 19.1 Idempotency

Financial commands requiring idempotency:

```text
create settlement
capture payment
apply stored value
open drawer
close drawer
refund
cash movement
issue credit note
wallet top-up
advance issue
gift card redemption
```

## 19.2 Outbox Events

Events:

```text
OrderPriced
OrderChargeCreated
OrderDiscountApplied
OrderTaxCalculated
OrderSettlementCreated
OrderSettlementLegCompleted
OrderCreditApplied
OrderPaymentCaptured
OrderDeferredSettlementSelected
OrderInvoiced
OrderSettled
OrderRefunded
GiftCardRedeemed
WalletApplied
AdvanceApplied
CreditNoteApplied
LoyaltyPointsRedeemed
CashDrawerMovementRecorded
AccountingPostingRequested
```

## 19.3 Audit

Audit should capture:

```text
who
when
what changed
old value
new value
reason
source screen/API
correlation id
```

---

# 20. Reconciliation

## 20.1 Required Checks

```text
PAYMENT_TOTAL_MATCH
CREDIT_APP_BALANCE
STORED_VALUE_LEDGER
TAX_CALCULATION
DISCOUNT_VALIDATION
REFUND_CONSISTENCY
OUTBOX_PROCESSED
SETTLEMENT_HEADER_TOTALS
SETTLEMENT_LEG_TARGET_MATCH
CASH_DRAWER_EXPECTED_MATCH
```

## 20.2 Settlement Header Totals

Check:

```text
settlement.paid_amount = sum REAL_PAYMENT legs
settlement.credit_applied_amount = sum CREDIT_APPLICATION legs
settlement.deferred_amount = sum DEFERRED_SETTLEMENT legs
settlement.ar_amount = sum AR_ALLOCATION legs
```

## 20.3 Leg Target Match

Every completed leg should have a valid target when applicable:

```text
REAL_PAYMENT → payment row exists
CREDIT_APPLICATION → credit app row exists
DEFERRED_SETTLEMENT → snapshot/outstanding reflects amount
AR_ALLOCATION → invoice/AR record exists when invoice module is active
```

## 20.4 Cash Drawer Match

Check:

```text
expected_cash =
opening_float
+ cash sales
+ cash in
- cash refunds
- cash out
- cash drop
```

---

# 21. Permissions and Security

Required permissions:

```text
orders:create
orders:update
orders:confirm
orders:void
orders:close

settlement:take_cash
settlement:take_card
settlement:take_check
settlement:take_bank_transfer
settlement:take_gateway
settlement:apply_gift_card
settlement:apply_wallet
settlement:apply_advance
settlement:apply_credit_note
settlement:apply_loyalty_points
settlement:refund

cash_drawer:view
cash_drawer:open
cash_drawer:close
cash_drawer:cash_in
cash_drawer:cash_out
cash_drawer:cash_drop
cash_drawer:force_close

promotion:view
promotion:create
promotion:update
promotion:delete
promotion:validate

tax:view
tax:configure

loyalty:view
loyalty:configure
loyalty:adjust

finance:reconcile
finance:view_audit
finance:post
```

Security rules:

```text
Always enforce tenant_org_id.
Never trust frontend amount routing.
Never allow stored-value redemption without lock.
Never allow cash payment without drawer if required.
Never allow credit invoice without eligibility.
Never allow refund without original leg reference.
```

---

# 22. Reporting and Receipts

## 22.1 Receipt

Receipt must show:

```text
order total
charges
discounts
tax
credits applied
real payments
deferred amount
invoice amount
outstanding
change returned
cashier
branch
settlement number
```

## 22.2 Reports

Required reports:

```text
orders financial summary
payments breakdown
stored value liability
gift card liability
wallet movement
advance liability
credit note balance
tax report
cash drawer close report
promotion usage
refund report
reconciliation issues
```

---

# 23. Testing Strategy

## 23.1 Unit Tests

Test services:

```text
order-calculation.service
checkout-config.service
order-settlement.service
stored-value.service
cash-drawer.service
promotion-engine.service
tax-engine.service
refund.service
reconciliation.service
```

## 23.2 Integration Tests

Required scenarios:

```text
cash-only order
card-only order
cash + card order
gift card + cash order
wallet + card order
advance + pay on collection
credit note + cash
partial retail payment defaults to pay on collection
delivery defaults to pay on delivery
B2B defaults to credit invoice
multiple card legs
multiple gift card legs
cash overpayment and change
cash drawer open/close
cash refund
card refund
gift card reversal
tax inclusive order
tax exclusive order
promotion discount
stored-value ledger reconciliation
idempotency duplicate request
```

## 23.3 Reconciliation Tests

Test:

```text
order summary equals detail rows
settlement header equals legs
legs target rows exist
stored value balance equals ledger
cash drawer expected equals movements
```

---

# 24. Implementation Review Checklist

## 24.1 Tables

```text
[ ] org_order_settlements_mst exists or equivalent.
[ ] org_order_settlement_legs_dtl exists or equivalent.
[ ] org_order_payments_dtl has settlement_id and settlement_leg_id or equivalent.
[ ] org_order_credit_apps_dtl has settlement_id and settlement_leg_id or equivalent.
[ ] org_order_refunds_dtl has settlement_id, settlement_leg_id, original_settlement_leg_id or equivalent.
[ ] org_cash_drawer_movements_dtl has settlement_id and settlement_leg_id or equivalent.
[ ] org_order_adjustments_dtl has settlement_id and settlement_leg_id or equivalent.
```

## 24.2 Routing

```text
[ ] REAL_PAYMENT routes to org_order_payments_dtl.
[ ] CREDIT_APPLICATION routes to org_order_credit_apps_dtl + ledger.
[ ] DEFERRED_SETTLEMENT routes to settlement/order snapshot only.
[ ] AR_ALLOCATION routes to invoice/AR only.
[ ] INTERNAL_ADJUSTMENT is not exposed to normal POS unless enabled.
```

## 24.3 Config

```text
[ ] org_payment_methods_cf is treated as checkout settlement options.
[ ] payment_nature controls grouping and routing.
[ ] sys_payment_type_cd is used for settlement type codes.
[ ] sys_payment_gateway_cd is used for gateways.
[ ] Gateway rows use PAYMENT_GATEWAY + gateway_code.
[ ] Deprecated provider rows are not seeded as tenant payment methods.
```

## 24.4 Multi-Leg

```text
[ ] Checkout API accepts legs[] or equivalent.
[ ] Multiple card legs are possible.
[ ] Multiple gift card legs are possible.
[ ] One settlement header groups all legs.
[ ] Each leg stores target_table and target_id or equivalent.
[ ] Receipt can replay legs.
[ ] Refunds can reverse original leg.
```

## 24.5 Unpaid Remainder

```text
[ ] Remaining unpaid amount is not left unclassified.
[ ] Retail default is PAY_ON_COLLECTION.
[ ] Delivery default is PAY_ON_DELIVERY.
[ ] B2B/credit approved can use CREDIT_INVOICE.
[ ] PAY_ON_COLLECTION/PAY_ON_DELIVERY/CREDIT_INVOICE do not create payment rows.
```

## 24.6 Stored Value

```text
[ ] Gift card uses ledger.
[ ] Wallet uses ledger.
[ ] Advance uses ledger.
[ ] Credit note uses ledger.
[ ] Loyalty redemption uses ledger.
[ ] Balance mutation is locked.
[ ] Idempotency is used.
```

## 24.7 Cash Drawer

```text
[ ] Cash requires open session when configured.
[ ] One open session per drawer is enforced.
[ ] Cash movement uses retained cash, not tendered cash.
[ ] Close session calculates shortage/overage.
```

## 24.8 Reconciliation

```text
[ ] Order snapshot reconciles to detail rows.
[ ] Settlement header reconciles to settlement legs.
[ ] Settlement legs reconcile to target rows.
[ ] Payment rows reconcile to paid amount.
[ ] Credit apps reconcile to ledgers.
[ ] Cash drawer reconciles to movements.
```

---

# 25. Acceptance Criteria

The implementation is acceptable when:

```text
1. Checkout options are grouped by payment_nature.
2. Checkout supports multi-leg settlement.
3. Each settlement event has a settlement header or equivalent.
4. Each selected component has a settlement leg or equivalent.
5. Each real payment leg creates one payment row.
6. Each credit application leg creates one credit app row and ledger row.
7. Deferred settlement creates no payment row.
8. AR allocation creates no payment row.
9. Multiple card legs are supported.
10. Multiple gift card legs are supported.
11. Partial settlement is supported.
12. Any unpaid remainder is classified as DEFERRED_SETTLEMENT or AR_ALLOCATION.
13. Retail unpaid remainder defaults to PAY_ON_COLLECTION.
14. Delivery unpaid remainder defaults to PAY_ON_DELIVERY.
15. B2B credit-approved unpaid remainder may use CREDIT_INVOICE.
16. Refunds reference original settlement leg.
17. Receipt can replay original settlement legs.
18. Cash payment creates cash drawer movement for retained amount only.
19. Gift card is never treated as discount.
20. Wallet/advance/credit note/loyalty are never treated as payment rows.
21. Promotion/coupon is never treated as payment.
22. Tax is calculated before credit/payment settlement.
23. Order snapshot reconciles with financial detail rows.
24. Stored-value balances reconcile with ledgers.
25. Cash drawer expected cash reconciles with movements.
26. Gateway provider disable rules are respected.
27. Tenant isolation is enforced on all org_* tables.
28. Financial mutations use idempotency keys.
29. Outbox events are written inside the same transaction.
30. Existing working implementation is preserved where it matches the intent.
```

---

# 26. Final Implementation Standard

Optimize for:

```text
correct accounting
clean settlement routing
multi-leg auditability
receipt replay
refund-by-leg
cashier accountability
stored-value liability control
tax correctness
tenant configurability
ERP posting readiness
future reconciliation
safe phased delivery
```

Do not optimize only for a fast checkout UI.

This is the v2.2 detailed locked baseline. Future ideas are welcome, but they should be proposed explicitly as improvements rather than silently changing the implementation baseline.

---

# 27. Detailed Database Review Matrix

This section expands the implementation review details table-by-table. It is intended for Claude Code to compare the current implementation against the expected intent without blindly recreating objects.

## 27.1 Table Review Method

For every table below, review:

```text
1. Does the table exist?
2. Is the table tenant-scoped when it is org_*?
3. Does the table use tenant_org_id consistently?
4. Does the table have branch_id when branch-level operation is required?
5. Does the table have rec_status or equivalent lifecycle flag?
6. Does the table have created/updated audit fields?
7. Are financial amounts numeric/decimal, not float?
8. Are currency fields present where amounts exist?
9. Are critical check constraints present?
10. Are unique indexes aligned with business rules?
11. Are foreign keys safe and aligned with delete behavior?
12. Are indexes present for tenant/order/status/date access?
13. Are RLS or tenant filters enforced in application code?
14. Is the table source-of-truth or snapshot?
15. Are updates allowed, or should reversal rows be used?
```

## 27.2 `org_orders_mst` Review

Expected role:

```text
Order master.
Stores operational header and financial snapshot.
Not the full financial source of truth.
```

Expected financial snapshot groups:

```text
gross fields
charge fields
discount fields
tax fields
credit application fields
real payment fields
deferred settlement fields
AR fields
rounding fields
change fields
outstanding fields
engine version fields
settlement status fields
```

Review checks:

```text
[ ] order has tenant_org_id.
[ ] order has branch_id or branch derivation.
[ ] order has customer_id when customer exists.
[ ] order has currency_code.
[ ] order has total/gross/discount/tax/payment/outstanding summary fields.
[ ] summary fields are updated by backend services only.
[ ] frontend cannot directly write totals.
[ ] order settlement_status exists or equivalent.
[ ] order payment_type_code exists or equivalent for main/default settlement timing.
[ ] snapshots can be recalculated from detail rows.
[ ] final/posted orders have controlled financial edits.
```

Important warning:

```text
Do not use org_orders_mst alone as the financial ledger.
```

## 27.3 `org_order_items_dtl` Review

Expected role:

```text
Order item/service line.
Owns pricing at line level.
```

Review checks:

```text
[ ] item has tenant_org_id.
[ ] item has order_id.
[ ] item has product/service reference where applicable.
[ ] item has quantity.
[ ] item has unit price.
[ ] item has line amount.
[ ] item has discount/tax relation or can be joined to financial details.
[ ] item supports piece generation for quantity or compound product.
[ ] item line remains auditable after settlement.
```

## 27.4 `org_order_item_pieces_dtl` Review

Expected role:

```text
Physical/operational piece tracking.
```

Review checks:

```text
[ ] piece has tenant_org_id.
[ ] piece has order_id.
[ ] piece has order_item_id.
[ ] piece_seq unique per order item.
[ ] supports barcode.
[ ] supports scan_state.
[ ] supports piece_status.
[ ] supports piece_stage.
[ ] supports rack_location.
[ ] supports stains/damage flags.
[ ] supports service category.
[ ] supports metadata.
[ ] has branch_id when branch workflows need it.
[ ] financial pricing is not duplicated incorrectly from item line.
```

Piece rule:

```text
Piece rows support operations. Item rows own pricing.
```

## 27.5 `org_order_preferences_dtl` Review

Expected role:

```text
Unified preference/condition/notes/add-on fact table.
```

Levels:

```text
ORDER
ITEM
PIECE
```

Review checks:

```text
[ ] prefs_level controls which FK must be present.
[ ] ORDER rows do not require item/piece.
[ ] ITEM rows require order_item_id.
[ ] PIECE rows require order_item_id and order_item_piece_id.
[ ] preference_sys_kind identifies category/type.
[ ] preference_code is populated.
[ ] preference_content stores display text where needed.
[ ] extra_price is not the final financial source by itself.
[ ] chargeable preferences create org_order_charges_dtl rows.
[ ] processing_confirmed supports workflow confirmation.
```

## 27.6 `org_order_charges_dtl` Review

Expected role:

```text
Financial charge details.
```

Charge examples:

```text
preference add-on charge
rush fee
delivery fee
packing fee
special treatment fee
manual surcharge
COD fee
```

Review checks:

```text
[ ] charge has tenant_org_id.
[ ] charge has order_id.
[ ] charge optionally has order_item_id.
[ ] charge optionally has order_item_piece_id.
[ ] charge optionally links source_preference_id.
[ ] charge_level is ORDER/ITEM/PIECE.
[ ] charge_source indicates engine/manual/preference/system.
[ ] amount is numeric/decimal.
[ ] currency_code exists.
[ ] is_taxable exists.
[ ] tax relation or tax_code exists.
[ ] approval fields exist for manual charges if required.
[ ] amount changes after posting use reversal/adjustment.
```

## 27.7 `org_order_discounts_dtl` Review

Expected role:

```text
Financial discount details.
```

Discount examples:

```text
manual discount
automatic discount
promotion discount
coupon discount
loyalty discount
```

Review checks:

```text
[ ] discount has tenant_org_id.
[ ] discount has order_id.
[ ] discount has discount_type.
[ ] discount has discount_amount.
[ ] discount has basis_amount where needed.
[ ] discount_rate is present for percentage discounts.
[ ] promotion_id/coupon_id exists when promotion/coupon used.
[ ] manual discount has reason and approval when required.
[ ] gift card is not recorded here.
[ ] wallet is not recorded here.
[ ] advance is not recorded here.
[ ] credit note is not recorded here.
```

## 27.8 `org_order_taxes_dtl` Review

Expected role:

```text
Tax/VAT snapshot rows.
```

Review checks:

```text
[ ] tax row has tenant_org_id.
[ ] tax row has order_id.
[ ] tax row has tax_code.
[ ] tax row has tax_rate.
[ ] tax row has taxable_amount.
[ ] tax row has tax_amount.
[ ] tax row has tax_inclusive flag or equivalent.
[ ] tax can be recalculated for reconciliation.
[ ] tax is calculated before stored-value applications.
[ ] tax supports charge/item/order level.
[ ] tax exemption evidence is stored when exempted.
```

## 27.9 `org_order_settlements_mst` Review

Expected role:

```text
Settlement event header.
```

Review checks:

```text
[ ] settlement has tenant_org_id.
[ ] settlement has order_id.
[ ] settlement has settlement_no.
[ ] settlement has settlement_type.
[ ] settlement has settlement_status.
[ ] settlement has currency_code.
[ ] settlement has gross_due_amount.
[ ] settlement has credit_applied_amount.
[ ] settlement has paid_amount.
[ ] settlement has deferred_amount.
[ ] settlement has ar_amount.
[ ] settlement has outstanding_before_amount.
[ ] settlement has outstanding_after_amount.
[ ] settlement has idempotency_key.
[ ] settlement has performed_by.
[ ] settlement has performed_at.
[ ] totals reconcile to settlement legs.
```

Allowed settlement types:

```text
CHECKOUT
COLLECTION
REFUND
ADJUSTMENT
INVOICE_ALLOCATION
```

Allowed settlement statuses:

```text
DRAFT
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
PARTIALLY_REVERSED
REVERSED
```

## 27.10 `org_order_settlement_legs_dtl` Review

Expected role:

```text
One selected settlement component.
Unified audit/routing layer.
```

Review checks:

```text
[ ] leg has tenant_org_id.
[ ] leg has settlement_id.
[ ] leg has order_id.
[ ] leg has leg_no.
[ ] leg has org_payment_method_id.
[ ] leg snapshots payment_method_code.
[ ] leg snapshots payment_nature.
[ ] leg snapshots gateway_code when applicable.
[ ] leg snapshots settlement_type_code when applicable.
[ ] leg snapshots credit_application_type when applicable.
[ ] leg has amount.
[ ] leg has currency_code.
[ ] leg has leg_status.
[ ] leg has target_table and target_id where applicable.
[ ] leg has source_id/source_code for stored value.
[ ] leg has tendered/change for cash.
[ ] leg has card/gateway/check/bank metadata where applicable.
[ ] leg can be used to replay receipt.
[ ] leg can be used to refund original component.
```

## 27.11 `org_order_payments_dtl` Review

Expected role:

```text
Actual real payment rows only.
```

Allowed methods:

```text
CASH
CARD
CHECK
BANK_TRANSFER
MOBILE_PAYMENT
PAYMENT_GATEWAY
```

Review checks:

```text
[ ] has settlement_id.
[ ] has settlement_leg_id.
[ ] has payment_method_code.
[ ] has payment_status.
[ ] has amount.
[ ] has currency_code.
[ ] cash rows support tendered_amount.
[ ] cash rows support change_returned_amount.
[ ] card rows support card_brand_code/card_last4/auth_code.
[ ] gateway rows support gateway_code/gateway_transaction_id.
[ ] bank rows support bank_reference.
[ ] check rows support check_no/check_bank_name/check_due_date.
[ ] no stored-value methods are stored here.
[ ] no pay-on-collection row is stored here.
[ ] no invoice row is stored here.
```

## 27.12 `org_order_credit_apps_dtl` Review

Expected role:

```text
Stored-value/credit application against order.
```

Allowed credit types:

```text
GIFT_CARD
WALLET
ADVANCE
CREDIT_NOTE
LOYALTY_POINTS
```

Review checks:

```text
[ ] has settlement_id.
[ ] has settlement_leg_id.
[ ] has credit_type.
[ ] has source_id.
[ ] has source_txn_id after ledger write.
[ ] has applied_amount.
[ ] has currency_code.
[ ] has application_status.
[ ] reversal fields exist.
[ ] every credit app has matching ledger.
[ ] balance mutation is locked.
```

## 27.13 `org_order_refunds_dtl` Review

Expected role:

```text
Refund lifecycle and financial reversal.
```

Review checks:

```text
[ ] has settlement_id.
[ ] has settlement_leg_id.
[ ] has original_settlement_leg_id.
[ ] has order_id.
[ ] has refund_method.
[ ] has refund_status.
[ ] has amount.
[ ] has currency_code.
[ ] links original_payment_id or credit_application_id.
[ ] has approval fields.
[ ] has processed fields.
[ ] cash refunds create cash drawer movement.
[ ] stored-value refunds create ledger reversal/restoration.
```

## 27.14 `org_cash_drawer_movements_dtl` Review

Expected role:

```text
Every cash movement in drawer session.
```

Review checks:

```text
[ ] has tenant_org_id.
[ ] has branch_id.
[ ] has cash_drawer_id.
[ ] has cash_drawer_session_id.
[ ] has movement_type.
[ ] has direction.
[ ] has amount.
[ ] has currency_code.
[ ] links settlement_id/settlement_leg_id for cash payments/refunds.
[ ] links order_payment_id when cash sale.
[ ] amount records retained cash, not tendered cash.
```

---

# 28. Detailed API Error Codes

Use stable API error codes. Do not rely only on free-text messages.

## 28.1 Settlement Errors

```text
SETTLEMENT_ORDER_NOT_FOUND
SETTLEMENT_ORDER_LOCK_FAILED
SETTLEMENT_ORDER_NOT_EDITABLE
SETTLEMENT_IDEMPOTENCY_CONFLICT
SETTLEMENT_TOTAL_MISMATCH
SETTLEMENT_UNCLASSIFIED_REMAINDER
SETTLEMENT_LEG_AMOUNT_INVALID
SETTLEMENT_LEG_METHOD_NOT_FOUND
SETTLEMENT_LEG_METHOD_DISABLED
SETTLEMENT_LEG_METHOD_NOT_ALLOWED_FOR_BRANCH
SETTLEMENT_LEG_METHOD_NOT_ALLOWED_FOR_CHANNEL
SETTLEMENT_LEG_METHOD_NOT_ALLOWED_FOR_CUSTOMER
SETTLEMENT_LEG_CURRENCY_MISMATCH
SETTLEMENT_LEG_MIN_AMOUNT_VIOLATION
SETTLEMENT_LEG_MAX_AMOUNT_VIOLATION
SETTLEMENT_LEG_MIN_ORDER_AMOUNT_VIOLATION
SETTLEMENT_LEG_MAX_ORDER_AMOUNT_VIOLATION
SETTLEMENT_PAYMENT_NATURE_UNSUPPORTED
```

## 28.2 Cash Drawer Errors

```text
CASH_DRAWER_NOT_FOUND
CASH_DRAWER_DISABLED
CASH_DRAWER_SESSION_REQUIRED
CASH_DRAWER_SESSION_NOT_FOUND
CASH_DRAWER_SESSION_NOT_OPEN
CASH_DRAWER_SESSION_ALREADY_OPEN
CASH_DRAWER_BRANCH_MISMATCH
CASH_DRAWER_CURRENCY_MISMATCH
CASH_TENDERED_LESS_THAN_AMOUNT
CASH_CHANGE_NEGATIVE
CASH_CLOSE_COUNT_INVALID
CASH_MOVEMENT_AMOUNT_INVALID
CASH_MOVEMENT_REASON_REQUIRED
```

## 28.3 Stored Value Errors

```text
GIFT_CARD_NOT_FOUND
GIFT_CARD_NOT_ACTIVE
GIFT_CARD_EXPIRED
GIFT_CARD_BALANCE_INSUFFICIENT
WALLET_NOT_FOUND
WALLET_DISABLED
WALLET_BALANCE_INSUFFICIENT
ADVANCE_NOT_FOUND
ADVANCE_BALANCE_INSUFFICIENT
CREDIT_NOTE_NOT_FOUND
CREDIT_NOTE_EXPIRED
CREDIT_NOTE_BALANCE_INSUFFICIENT
LOYALTY_ACCOUNT_NOT_FOUND
LOYALTY_POINTS_INSUFFICIENT
STORED_VALUE_LOCK_FAILED
STORED_VALUE_IDEMPOTENCY_CONFLICT
```

## 28.4 Gateway Errors

```text
GATEWAY_NOT_FOUND
GATEWAY_DISABLED
GATEWAY_GLOBALLY_DISABLED
GATEWAY_CURRENCY_NOT_SUPPORTED
GATEWAY_AMOUNT_BELOW_MIN
GATEWAY_AMOUNT_ABOVE_MAX
GATEWAY_REFERENCE_REQUIRED
GATEWAY_TRANSACTION_PENDING
GATEWAY_TRANSACTION_FAILED
```

## 28.5 AR / Invoice Errors

```text
CUSTOMER_NOT_CREDIT_APPROVED
CUSTOMER_CREDIT_LIMIT_EXCEEDED
CUSTOMER_PAYMENT_TERMS_MISSING
CREDIT_INVOICE_NOT_ALLOWED_FOR_TENANT
CREDIT_INVOICE_NOT_ALLOWED_FOR_BRANCH
INVOICE_CREATION_FAILED
AR_ALLOCATION_FAILED
```

## 28.6 Refund Errors

```text
REFUND_ORIGINAL_LEG_NOT_FOUND
REFUND_AMOUNT_EXCEEDS_REFUNDABLE
REFUND_LEG_ALREADY_REVERSED
REFUND_METHOD_NOT_ALLOWED
REFUND_CASH_DRAWER_REQUIRED
REFUND_APPROVAL_REQUIRED
REFUND_GATEWAY_FAILED
REFUND_STORED_VALUE_RESTORE_FAILED
```

---

# 29. Detailed UI Screen Specifications

## 29.1 Checkout Screen

### Screen Objective

Allow cashier/staff/customer to settle an order using one or many settlement legs.

### Sections

```text
Order Summary
Financial Breakdown
Credits Applied
Payment Methods
Deferred Settlement
Invoice / AR
Remaining Amount Panel
Settlement Legs Preview
Validation Messages
Confirm Button
```

### Order Summary Fields

```text
Order number
Customer
Branch
Order date
Service category summary
Order status
Currency
```

### Financial Breakdown Fields

```text
Items/services gross
Charges
Discounts
Tax
Grand total
Credits applied
Net receivable
Paid now
Deferred amount
Invoice amount
Outstanding
Rounding
Change
```

### Behavior

```text
Updating a leg recalculates preview.
Invalid leg shows inline message.
Confirm disabled if totals invalid.
Confirm disabled if unpaid remainder is unclassified.
Cash option disabled if drawer required and no open session.
Credit invoice hidden/disabled if customer not eligible.
```

### Suggested Buttons

```text
Apply Gift Card
Apply Wallet
Apply Credit Note
Add Cash
Add Card
Add Bank Transfer
Add Check
Pay on Collection
Pay on Delivery
Credit Invoice
Preview
Confirm Settlement
Cancel
```

---

## 29.2 Settlement Legs Preview Component

Columns:

```text
#
Group
Method
Source/Reference
Amount
Currency
Validation Status
Target
Action
```

Example rows:

```text
1 | Payment | Cash | Drawer #1 | 10.000 | OMR | Valid | Payment
2 | Payment | Visa | Auth 123 | 5.000 | OMR | Valid | Payment
3 | Deferred | Pay on Collection | - | 10.000 | OMR | Valid | Outstanding
```

Actions:

```text
edit amount
remove leg
view details
```

Rules:

```text
Cannot remove required unpaid remainder leg if it causes unclassified remainder.
Cannot edit a completed settlement leg after commit.
```

---

## 29.3 Collection Screen

### Objective

Collect outstanding amount from a ready/delivered order.

### Shows

```text
Order number
Customer
Outstanding amount
Previous settlement history
Allowed collection options
Cash drawer status
```

### Rules

```text
PAY_ON_COLLECTION itself should not be selectable as a collection payment.
Only REAL_PAYMENT and allowed CREDIT_APPLICATION legs should settle outstanding.
```

---

## 29.4 Cash Drawer Session Screen

### Current Session Summary

Show:

```text
Drawer code/name
Branch
Opened by
Opened at
Opening float
Cash sales
Cash refunds
Cash in
Cash out
Cash drop
Expected cash
```

### Actions

```text
Cash In
Cash Out
Cash Drop
Close Session
View Movements
Print Summary
```

### Close Session

Fields:

```text
Counted cash amount
Close notes
```

On submit:

```text
Calculate difference.
Show shortage/overage.
Require confirmation if difference exists.
```

---

## 29.5 Stored Value Customer Tab

Show:

```text
Wallet balance
Wallet ledger
Active gift cards
Gift card ledger
Active advances
Advance ledger
Credit notes
Credit note ledger
Loyalty balance
Loyalty transactions
```

Actions:

```text
Top up wallet
Issue advance
Issue credit note
View ledger
Export ledger
```

---

## 29.6 Refund Screen

### Objective

Refund by original settlement leg.

### Shows

```text
Original settlement history
Original legs
Refundable amount per leg
Refund method
Approval requirement
Reason
```

### Rules

```text
Cannot refund more than refundable balance.
Cash refund needs open drawer if configured.
Stored-value reversal restores original source where possible.
Gateway refund stores gateway reference/status.
```

---

# 30. Detailed Business Scenario Matrix

## 30.1 Cash Full Payment

```text
Net receivable: 10.000
Cash amount: 10.000
Tendered: 10.000
Change: 0.000
```

Expected:

```text
1 settlement header
1 settlement leg REAL_PAYMENT/CASH
1 payment row
1 cash drawer CASH_SALE movement
outstanding = 0
status = SETTLED
```

## 30.2 Cash Overpayment With Change

```text
Net receivable: 7.500
Cash amount: 7.500
Tendered: 10.000
Change: 2.500
```

Expected:

```text
payment amount = 7.500
tendered = 10.000
change = 2.500
cash drawer movement = 7.500
outstanding = 0
```

## 30.3 Cash + Card + Pay on Collection

```text
Net receivable: 30.000
Cash: 10.000
Card: 5.000
Pay on collection: 15.000
```

Expected:

```text
1 settlement header
3 settlement legs
2 payment rows
1 deferred leg
1 cash drawer movement
outstanding = 15.000
pay_on_collection_amount = 15.000
```

## 30.4 Gift Card + Wallet + Card

```text
Net receivable: 20.000
Gift card: 5.000
Wallet: 3.000
Card: 12.000
```

Expected:

```text
3 settlement legs
2 credit app rows
2 stored-value ledger rows
1 payment row
outstanding = 0
```

## 30.5 B2B Credit Invoice

```text
Net receivable: 100.000
Credit invoice: 100.000
```

Expected:

```text
1 AR_ALLOCATION settlement leg
no payment row
invoice_ar_amount = 100.000
invoice/AR record created if module active
outstanding = 100.000
status = INVOICED_AR
```

## 30.6 Multiple Cards

```text
Visa: 10.000
Mastercard: 15.000
```

Expected:

```text
2 settlement legs
2 payment rows
separate auth/reference details
```

## 30.7 Multiple Gift Cards

```text
Gift Card A: 5.000
Gift Card B: 4.000
```

Expected:

```text
2 settlement legs
2 credit app rows
2 gift card ledger rows
2 gift cards locked separately
```

## 30.8 Refund Cash Leg

Expected:

```text
new REFUND settlement
refund leg references original cash leg
refund row created
cash drawer CASH_REFUND movement created
```

## 30.9 Refund Gift Card Leg

Expected:

```text
new REFUND settlement
refund leg references original gift card leg
refund row created
gift card ledger restores balance
```

---

# 31. Developer Notes for Existing Implementation Review

When reviewing existing implementation, Claude Code should not assume absence equals failure. It should classify each item:

```text
MATCHED
PARTIALLY_MATCHED
EQUIVALENT_WITH_DIFFERENT_NAME
MISSING_BUT_OPTIONAL
MISSING_AND_REQUIRED
CONFLICTS_WITH_BASELINE
NEEDS_BUSINESS_DECISION
```

For each gap, provide:

```text
current state
expected baseline
impact
recommended safe fix
migration risk
whether blocking
```

Do not blindly create a table if an equivalent exists.

Do not rename working tables without approval.

Do not remove data.

Do not make destructive migrations.

---

# 32. Final Lock Statement

This v2.2 document is intended to stop redesign churn.

Future improvements are allowed, but they must be proposed as:

```text
Change Request
Reason
Impact
Migration needed?
Backward compatibility
Recommended timing
```

The default expectation is:

```text
review current implementation
fill gaps safely
preserve working code
avoid duplicates
avoid endless re-architecture
```
