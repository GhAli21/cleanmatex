# CleanMateX Order Financial Architecture and Migration Design

**Document Type:** Architecture, System Design, Database Design, Services Design, Migration Blueprint  
**Project:** CleanMateX Multi-Tenant SaaS  
**Scope:** Order financial architecture, checkout migration, pricing, pieces, preferences, charges, discounts, promotions, tax, payments, gift cards, wallet, customer credit, advances, loyalty, invoice/AR, posting, audit, reconciliation  
**Recommended Architecture Style:** Modular Monolith + Strong Domain Boundaries + Transactional Core + Outbox Events + Ledger-Based Finance  
**Status:** Target Reference Architecture and Migration Blueprint  

---

# 1. Executive Summary

CleanMateX already has a strong current checkout foundation:

- `preview-payment` calculates totals without saving.
- `create-with-payment` recalculates totals server-side.
- `clientTotals` are compared with server totals.
- `AMOUNT_MISMATCH` blocks inconsistent submissions.
- A single `prisma.$transaction` persists order, items, pieces, preferences, invoice, optional payment, promo/gift/discount logic.
- The system already supports rich order body data including pieces and preferences.

The correct path is **not** a rewrite.

The correct path is:

```text
expand → dual-write → reconcile → switch-read → retire
```

This means:

1. Add missing normalized financial tables.
2. Keep current checkout route stable.
3. Dual-write new financial facts inside the existing transaction.
4. Reconcile old summary values against new detail/ledger tables.
5. Switch reads gradually using feature flags.
6. Retire legacy logic only after proof.

---

# 2. Business Context

CleanMateX is a multi-tenant SaaS platform for laundry and dry-cleaning operations.

The order domain must support:

- counter/POS order creation
- customer mobile order creation
- laundry/dry-cleaning items
- physical garment tracking
- compound items such as suits
- stains/damage/colors/preferences
- service add-ons
- packing preferences
- pay now
- pay on collection
- invoice / B2B deferred payment
- split payments
- cash/card/check/bank/payment gateway
- gift card redemption
- wallet balance
- customer credit
- customer advance
- loyalty points/credit
- promotions/coupons
- VAT/tax
- rounding and cash return
- accounting posting
- audit and reconciliation

---

# 3. Current System Summary

## 3.1 Current Main APIs

```text
POST /api/v1/orders/preview-payment
POST /api/v1/orders/create-with-payment
```

## 3.2 Current Preview Flow

```text
User opens payment step
→ frontend sends cart/order data
→ preview-payment calculates totals server-side
→ returns totals JSON
→ no DB persistence
```

## 3.3 Current Create-With-Payment Flow

```text
User confirms payment
→ create-with-payment validates CSRF, permission, tenant, request body
→ checks idempotencyKey
→ resolves branch
→ calculateOrderTotals() again
→ compares server totals with clientTotals
→ if mismatch, returns AMOUNT_MISMATCH and writes nothing
→ validates payment/deferred pay rules
→ opens prisma.$transaction
    → creates org_orders_mst
    → creates org_order_items_dtl
    → creates org_order_item_pieces_dtl
    → creates org_order_preferences_dtl
    → creates invoice
    → optionally records payment
    → applies promo/gift/discount logic
    → stores idempotency key
→ commits
→ returns order result
```

## 3.4 Current Strengths

The current design already has:

| Area | Evaluation |
|---|---|
| Server-side totals | Strong |
| Client total validation | Strong |
| Transaction safety | Strong |
| Tenant/security validation | Good |
| Idempotency foundation | Good |
| Pieces/preferences support | Good |
| Invoice integration | Exists |
| Payment integration | Exists |
| Promo/gift/discount hooks | Exists |

## 3.5 Current Gaps

The current system needs improved normalization in:

- charge detail rows
- discount detail rows
- tax detail rows
- credit application rows
- multi-payment rows
- gift card liability ledger
- wallet ledger
- customer advance ledger
- customer credit ledger
- loyalty ledger
- promotion configuration
- tax configuration
- reconciliation
- event outbox
- accounting posting events
- strict audit trail

---

# 4. Core Architecture Principles

## 4.1 Do Not Build One Giant Order Service

Use bounded internal services:

```text
Order Core
Piece Tracking
Preference Engine
Pricing / Charge Engine
Promotion Engine
Discount Engine
Tax Engine
Settlement Engine
Stored Value Engine
Invoice / AR Engine
Loyalty Engine
Accounting Posting Engine
Audit Engine
Reconciliation Engine
```

## 4.2 Use Modular Monolith First

Recommended:

```text
Modular monolith
Single database
Strong service boundaries
Transactional checkout core
Outbox for async work
Ledger-based finance
Tenant-scoped tables
```

Avoid now:

```text
microservices
distributed transactions
multi-database split
event sourcing everywhere
CQRS complexity
```

## 4.3 Separate Operational Facts From Financial Facts

```text
Preferences = what was selected/observed
Charges = what money was charged

Pieces = physical tracking
Items = commercial lines

Credits = stored-value/liability application
Payments = real money collection

Invoice = AR
Payment = settlement
```

## 4.4 Never Treat Gift Card as Discount

Gift card is a stored-value liability.

Correct:

```text
Gift Card Applied
→ org_order_credit_apps_dtl
→ org_gift_card_txn_dtl
```

Wrong:

```text
discount_type = GIFT_CARD
```

## 4.5 Never Treat Invoice as Payment

Invoice means:

```text
Accounts Receivable
```

It is not cash settlement.

---

# 5. Target Domain Model

## 5.1 Main Hierarchy

```text
Order
  → Order Items
      → Order Item Pieces
          → Order Preferences
```

## 5.2 Order

Represents the customer transaction.

Owned by:

```text
org_orders_mst
```

## 5.3 Order Item

Represents the commercial line.

Examples:

```text
Shirt Cleaning x3
Suit Dry Cleaning x2
Carpet Cleaning x1
Abaya Ironing x1
```

Owned by:

```text
org_order_items_dtl
```

## 5.4 Order Piece

Represents the physical garment/unit to track.

Owned by:

```text
org_order_item_pieces_dtl
```

### Quantity Example

```text
Item: Shirt x3

Pieces:
- Shirt #1
- Shirt #2
- Shirt #3
```

### Compound Item Example

```text
Item: Suit x2
Template: Jacket + Trouser

Pieces:
- Group 1 / Jacket
- Group 1 / Trouser
- Group 2 / Jacket
- Group 2 / Trouser
```

## 5.5 Order Preference

Represents selected/observed attributes.

Owned by:

```text
org_order_preferences_dtl
```

Examples:

- packing method
- stain
- damage
- color
- customer note
- operator note
- service add-on
- special handling
- perfume
- hanger
- rush handling

Preferences can exist at:

```text
ORDER
ITEM
PIECE
```

---

# 6. Financial Formula

The target formula must be consistent across backend, DB summaries, invoices, POS, reports, and accounting.

```text
gross_amount
+ total_charges_amount
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
- invoice_ar_amount
= outstanding_amount
```

## 6.1 Meaning of Each Layer

| Layer | Meaning |
|---|---|
| Gross Amount | Item/service commercial value before discounts/charges |
| Charges | Positive billable additions |
| Discounts | Revenue reductions |
| Net Before Tax | Taxable commercial amount |
| Taxes | VAT/other tax liabilities |
| Grand Total | Customer bill value after tax |
| Credits Applied | Stored-value/liability applications |
| Net Receivable | Amount to settle after credits |
| Payments | Real money received |
| Invoice AR | Amount moved to Accounts Receivable |
| Outstanding | Remaining unpaid amount |

---

# 7. Table Ownership Map

| Context | Tables |
|---|---|
| Order Core | `org_orders_mst`, `org_order_items_dtl` |
| Piece Tracking | `org_order_item_pieces_dtl`, `org_order_piece_status_history_dtl`, `org_product_piece_templates_mst`, `org_product_piece_templates_dtl` |
| Preferences | `org_order_preferences_dtl`, `org_order_preference_history_dtl` |
| Charges | `org_order_charges_dtl` |
| Discounts | `org_order_discounts_dtl` |
| Promotions | `org_promotions_mst`, `org_promotion_*_dtl` |
| Tax | `org_tax_profiles_mst`, `org_tax_rates_dtl`, `org_tax_rules_dtl`, `org_order_taxes_dtl` |
| Settlement | `org_order_payments_dtl`, `org_order_credit_apps_dtl`, `org_order_refunds_dtl`, `org_order_adjustments_dtl` |
| Gift Cards | `org_gift_cards_mst`, `org_gift_card_txn_dtl` |
| Wallet | `org_wallet_accounts_mst`, `org_wallet_txn_dtl` |
| Advances | `org_customer_advances_mst`, `org_customer_advance_txn_dtl` |
| Customer Credits | `org_customer_credits_mst`, `org_customer_credit_txn_dtl` |
| Loyalty | `org_loyalty_accounts_mst`, `org_loyalty_txn_dtl` |
| Invoice / AR | `org_invoices_mst`, `org_invoice_lines_dtl`, `org_invoice_payments_dtl` |
| Audit | `org_order_financial_audit_log` |
| Reconciliation | `org_fin_reconciliation_runs_mst`, `org_fin_reconciliation_issues_dtl` |
| Events | `org_domain_events_outbox` |

---

# 8. Database Design Details

## 8.1 Existing Core Tables

Keep and enhance:

```text
org_orders_mst
org_order_items_dtl
org_order_item_pieces_dtl
org_order_preferences_dtl
```

---

## 8.2 `org_orders_mst` Summary Columns

`org_orders_mst` stores the final financial snapshot.

Recommended columns:

```sql
items_gross_amount numeric(19,4) default 0
services_gross_amount numeric(19,4) default 0
gross_amount numeric(19,4) default 0

preference_charges_amount numeric(19,4) default 0
other_charges_amount numeric(19,4) default 0
total_charges_amount numeric(19,4) default 0

auto_discount_amount numeric(19,4) default 0
manual_discount_amount numeric(19,4) default 0
promotion_discount_amount numeric(19,4) default 0
coupon_discount_amount numeric(19,4) default 0
loyalty_discount_amount numeric(19,4) default 0
total_discount_amount numeric(19,4) default 0

net_before_tax_amount numeric(19,4) default 0

vat_amount numeric(19,4) default 0
other_tax_amount numeric(19,4) default 0
total_tax_amount numeric(19,4) default 0

grand_total_amount numeric(19,4) default 0

gift_card_applied_amount numeric(19,4) default 0
wallet_applied_amount numeric(19,4) default 0
advance_applied_amount numeric(19,4) default 0
customer_credit_applied_amount numeric(19,4) default 0
loyalty_credit_applied_amount numeric(19,4) default 0
total_credit_applied_amount numeric(19,4) default 0

net_receivable_amount numeric(19,4) default 0

cash_paid_amount numeric(19,4) default 0
card_paid_amount numeric(19,4) default 0
check_paid_amount numeric(19,4) default 0
bank_transfer_paid_amount numeric(19,4) default 0
payment_gateway_paid_amount numeric(19,4) default 0
total_paid_amount numeric(19,4) default 0

invoice_ar_amount numeric(19,4) default 0
pay_on_collection_amount numeric(19,4) default 0

rounding_adjustment_amount numeric(19,4) default 0
change_returned_amount numeric(19,4) default 0
outstanding_amount numeric(19,4) default 0

pricing_engine_version text
tax_engine_version text
promotion_engine_version text
settlement_engine_version text
```

### Rule

These are **summary snapshots**, not the full financial source of truth.

---

## 8.3 `org_order_items_dtl`

Represents commercial order lines.

Recommended key fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null
line_no integer not null

line_type text
product_id uuid
service_id uuid
service_category_code text

description text
quantity numeric(19,4)
unit_price numeric(19,4)

pricing_mode text default 'ITEM_PRICE'

gross_line_amount numeric(19,4) default 0
line_preference_charges_amount numeric(19,4) default 0
line_other_charges_amount numeric(19,4) default 0
line_total_charges_amount numeric(19,4) default 0
line_discount_amount numeric(19,4) default 0
line_taxable_amount numeric(19,4) default 0
line_tax_amount numeric(19,4) default 0
line_net_amount numeric(19,4) default 0

is_taxable boolean default true
tax_code text

price_rule_id uuid
price_version_id uuid
is_price_locked boolean default false

metadata jsonb default '{}'
```

---

## 8.4 `org_order_item_pieces_dtl`

Represents physical pieces.

Your current table already has many good fields.

Recommended additions:

```sql
piece_type_code varchar(120)
piece_type_name varchar(255)

piece_group_no integer
parent_piece_id uuid

is_compound_generated boolean default false
compound_template_id uuid
is_main_piece boolean default false

pricing_source text
price_rule_id uuid
price_version_id uuid
is_price_locked boolean default false

ready_at timestamptz
packed_at timestamptz
delivered_at timestamptz
collected_at timestamptz

rejected_at timestamptz
rejected_by uuid
rejection_reason text
```

### Rule

Pieces are operational tracking units.

Do not overload pieces with tax/payment/gift-card logic.

---

## 8.5 Product Piece Templates

Use tenant-owned tables:

```text
org_product_piece_templates_mst
org_product_piece_templates_dtl
```

### `org_product_data_mst` additions

```sql
pieces_per_product integer not null default 1
has_piece_template boolean not null default false
default_piece_template_id uuid null
```

### `org_product_piece_templates_mst`

```sql
id uuid primary key
tenant_org_id uuid not null
main_product_id uuid not null

template_code text not null
template_name text not null

pieces_per_product integer not null default 1
is_default boolean default false
is_active boolean default true

created_at timestamptz default now()
created_by uuid
metadata jsonb default '{}'
```

### `org_product_piece_templates_dtl`

```sql
id uuid primary key
tenant_org_id uuid not null
template_id uuid not null
main_product_id uuid not null
piece_product_id uuid null

piece_type_code text not null
piece_name text not null
piece_qty integer default 1
sort_order integer default 1

is_required boolean default true
is_price_separate boolean default false

metadata jsonb default '{}'
```

---

## 8.6 `org_order_preferences_dtl`

Existing unified table is good.

Enhance with:

```sql
is_chargeable boolean default false
charge_id uuid null
pricing_rule_id uuid null
price_version_id uuid null
tax_code text null
is_taxable boolean null
confirmation_status text null
preference_value jsonb null
media_group_id uuid null
```

### Preference Level Constraint

```sql
check (
  (
    prefs_level = 'ORDER'
    and order_item_id is null
    and order_item_piece_id is null
  )
  or
  (
    prefs_level = 'ITEM'
    and order_item_id is not null
    and order_item_piece_id is null
  )
  or
  (
    prefs_level = 'PIECE'
    and order_item_id is not null
    and order_item_piece_id is not null
  )
)
```

### Notes Best Practice

Use:

```text
preference_code = 'NOTE'
preference_content = actual note text
```

Avoid:

```text
preference_code = note text
```

---

## 8.7 `org_order_charges_dtl`

Purpose:

```text
Positive monetary additions beyond base item price.
```

Examples:

- service preference charge
- packing preference charge
- rush fee
- delivery fee
- COD fee
- stain removal fee
- special handling fee
- manual charge

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null
order_item_id uuid null
order_item_piece_id uuid null
source_preference_id uuid null

charge_level text not null
charge_source text not null
charge_type text not null
charge_code text not null
charge_name text

amount numeric(19,4) not null default 0
currency_code char(3) not null

is_taxable boolean default true
tax_code text
tax_amount numeric(19,4) default 0

approval_status text
approved_by uuid
approved_at timestamptz

rec_status smallint default 1
created_by uuid
created_at timestamptz default now()
updated_by uuid
updated_at timestamptz
metadata jsonb default '{}'
```

---

## 8.8 `org_order_discounts_dtl`

Purpose:

```text
Revenue reductions.
```

Examples:

- auto discount
- manual discount
- promotion discount
- coupon discount
- loyalty discount
- goodwill discount

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null
order_item_id uuid null
order_item_piece_id uuid null

discount_level text not null
discount_type text not null

discount_code text
discount_name text

promotion_id uuid null
coupon_id uuid null

basis_amount numeric(19,4) default 0
discount_rate numeric(9,4)
discount_amount numeric(19,4) not null default 0

applied_before_tax boolean default true
is_taxable_discount boolean default true

reason text
approval_status text
approved_by uuid
approved_at timestamptz

rec_status smallint default 1
created_by uuid
created_at timestamptz default now()
metadata jsonb default '{}'
```

---

## 8.9 `org_order_taxes_dtl`

Purpose:

```text
Historical tax snapshot.
```

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null
order_item_id uuid null
order_item_piece_id uuid null
charge_id uuid null

tax_level text not null
tax_type text not null
tax_code text not null
tax_name text

tax_rate numeric(9,4) not null
taxable_amount numeric(19,4) not null default 0
tax_amount numeric(19,4) not null default 0

tax_inclusive boolean default false
jurisdiction_code text

created_at timestamptz default now()
metadata jsonb default '{}'
```

---

## 8.10 `org_order_credit_apps_dtl`

Purpose:

```text
Stored-value/liability usage against order.
```

Credit types:

```text
GIFT_CARD
WALLET
ADVANCE
CUSTOMER_CREDIT
LOYALTY_CREDIT
```

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null
customer_id uuid null

credit_type text not null
source_id uuid not null
source_txn_id uuid null

applied_amount numeric(19,4) not null
currency_code char(3) not null

application_status text not null
applied_at timestamptz
applied_by uuid

reversal_txn_id uuid
reversed_at timestamptz
reversed_by uuid
reversal_reason text

idempotency_key text
metadata jsonb default '{}'
created_at timestamptz default now()
```

---

## 8.11 `org_order_payments_dtl`

Purpose:

```text
Real money collection only.
```

Payment methods:

```text
CASH
CARD
BANK_TRANSFER
CHECK
PAYMENT_GATEWAY
```

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null
customer_id uuid null

payment_method text not null
payment_status text not null

amount numeric(19,4) not null
currency_code char(3) not null

tendered_amount numeric(19,4)
change_returned_amount numeric(19,4)

paid_at timestamptz
received_by uuid
branch_id uuid
cash_drawer_id uuid

card_brand text
card_last4 text
card_terminal_id text
gateway_provider text
gateway_transaction_id text
auth_code text

check_no text
check_bank_name text
check_due_date date
check_status text

bank_reference text

idempotency_key text
metadata jsonb default '{}'
created_at timestamptz default now()
```

---

## 8.12 Refunds

```text
org_order_refunds_dtl
```

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null
customer_id uuid null

refund_method text not null
refund_status text not null

amount numeric(19,4) not null
currency_code char(3) not null

original_payment_id uuid null
credit_application_id uuid null

refund_reason text
approved_by uuid
approved_at timestamptz
processed_by uuid
processed_at timestamptz

reference_txn_id uuid
metadata jsonb default '{}'
```

---

## 8.13 Adjustments

```text
org_order_adjustments_dtl
```

Used for:

- rounding correction
- price correction
- manager adjustment
- goodwill adjustment
- write-off

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null

adjustment_type text not null
amount numeric(19,4) not null
currency_code char(3) not null

affects_tax boolean default false
affects_revenue boolean default true

reason text not null
approval_status text
approved_by uuid
approved_at timestamptz

created_by uuid
created_at timestamptz default now()
metadata jsonb default '{}'
```

---

## 8.14 Financial Audit Log

```text
org_order_financial_audit_log
```

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
order_id uuid not null

entity_name text not null
entity_id uuid not null

action_type text not null
field_name text
old_value text
new_value text

reason text
performed_by uuid
performed_at timestamptz default now()

metadata jsonb default '{}'
```

---

# 9. Promotion Architecture

## 9.1 Naming Decision

Promotions are tenant-owned.

Use:

```text
org_promotions_mst
org_promotion_rules_dtl
org_promotion_eligibility_dtl
org_promotion_rewards_dtl
org_promotion_limits_dtl
org_promotion_exclusions_dtl
```

Use `sys_*` only for static codes:

```text
sys_promotion_type_cd
sys_promotion_reward_type_cd
sys_promotion_stacking_policy_cd
sys_coupon_type_cd
sys_discount_type_cd
```

## 9.2 Promotion Results

| Promotion Result | Storage |
|---|---|
| Price discount | `org_order_discounts_dtl` |
| Coupon discount | `org_order_discounts_dtl` |
| Free delivery | discount against delivery charge |
| Free item | `org_order_items_dtl` with free-item marker |
| Wallet cashback | `org_wallet_txn_dtl` |
| Gift card bonus | `org_gift_card_txn_dtl` |
| Loyalty points | `org_loyalty_txn_dtl` |
| Customer credit | `org_customer_credit_txn_dtl` |

---

# 10. Tax Architecture

## 10.1 Tax Config Tables

```text
sys_tax_types_cd
org_tax_profiles_mst
org_tax_rates_dtl
org_tax_rules_dtl
org_product_tax_mappings_dtl
org_branch_tax_mappings_dtl
```

## 10.2 Tax Profile

```sql
id uuid primary key
tenant_org_id uuid not null
tax_profile_code text not null
tax_profile_name text not null

country_code char(2) not null
currency_code char(3) not null

price_tax_mode text not null
is_active boolean default true
effective_from date not null
effective_to date
```

`price_tax_mode`:

```text
TAX_EXCLUSIVE
TAX_INCLUSIVE
```

## 10.3 Tax Rule

Tax rules can apply to:

```text
PRODUCT
SERVICE_CATEGORY
CHARGE
CUSTOMER
BRANCH
ORDER
```

## 10.4 Tax Timing Rule

```text
taxable_amount = gross + charges - discounts
tax is calculated before credits and payments
```

---

# 11. Stored Value Architecture

## 11.1 Gift Cards

Tables:

```text
org_gift_cards_mst
org_gift_card_txn_dtl
```

Gift card lifecycle:

```text
DRAFT
→ GENERATED
→ ACTIVE
→ PARTIALLY_REDEEMED
→ FULLY_REDEEMED
→ EXPIRED
→ VOIDED
→ SUSPENDED
```

Transaction types:

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

Accounting:

```text
Gift card sold:
DR Cash / Bank
CR Gift Card Liability

Gift card redeemed:
DR Gift Card Liability
CR Revenue / AR Settlement

Gift card expired:
DR Gift Card Liability
CR Breakage Revenue
```

Redemption must use row locking:

```sql
SELECT ... FOR UPDATE
```

## 11.2 Wallet

Wallet is reusable prepaid customer balance.

Tables:

```text
org_wallet_accounts_mst
org_wallet_txn_dtl
```

Transaction types:

```text
TOP_UP
APPLY_TO_ORDER
REFUND_TO_WALLET
REVERSAL
ADJUSTMENT
BONUS_ADD
EXPIRY
```

## 11.3 Customer Advance

Advance is deposit/prepayment for future service/order.

Tables:

```text
org_customer_advances_mst
org_customer_advance_txn_dtl
```

Transaction types:

```text
RECEIVE_ADVANCE
APPLY_TO_ORDER
REFUND_ADVANCE
TRANSFER_TO_CREDIT
REVERSAL
ADJUSTMENT
```

## 11.4 Customer Credit

Customer credit means business owes customer.

Sources:

- overpayment
- refund converted to credit
- compensation
- cancelled order
- price correction

Tables:

```text
org_customer_credits_mst
org_customer_credit_txn_dtl
```

Transaction types:

```text
CREATE_CREDIT
APPLY_TO_ORDER
REFUND_CREDIT
REVERSAL
ADJUSTMENT
EXPIRE
```

---

# 12. Loyalty Architecture

## 12.1 `org_loyalty_accounts_mst`

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
customer_id uuid not null

loyalty_account_no text not null
status text default 'ACTIVE'

points_balance numeric(19,4) default 0
monetary_balance numeric(19,4) default 0

lifetime_points_earned numeric(19,4) default 0
lifetime_points_redeemed numeric(19,4) default 0
lifetime_points_expired numeric(19,4) default 0

tier_code text
tier_started_at timestamptz
tier_expires_at timestamptz

last_earn_at timestamptz
last_redeem_at timestamptz

currency_code char(3)
created_at timestamptz default now()
updated_at timestamptz
metadata jsonb default '{}'
```

## 12.2 `org_loyalty_txn_dtl`

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
loyalty_account_id uuid not null
customer_id uuid not null

txn_type text not null

points_amount numeric(19,4) default 0
monetary_amount numeric(19,4) default 0

points_balance_before numeric(19,4) not null
points_balance_after numeric(19,4) not null

reference_type text
reference_id uuid
order_id uuid

performed_by uuid
performed_at timestamptz default now()

expiry_date date
reason text
metadata jsonb default '{}'
```

---

# 13. Payment and Settlement Architecture

## 13.1 Multi-Payment

Support one row per payment leg.

Example:

```text
Cash 10
Visa A 10
Visa B 5
Mastercard C 7
```

Rows:

```text
org_order_payments_dtl:
- CASH 10
- CARD VISA 10
- CARD VISA 5
- CARD MASTERCARD 7
```

Stored-value applications:

```text
Gift Card 5
Wallet 5
Customer Credit 3
```

Rows:

```text
org_order_credit_apps_dtl:
- GIFT_CARD 5
- WALLET 5
- CUSTOMER_CREDIT 3
```

## 13.2 Pay On Collection

Pay on collection means outstanding remains open.

Recommended fields:

```text
payment_timing
pay_on_collection_amount
outstanding_amount
settlement_status
```

Payment timing values:

```text
PAY_NOW
PAY_ON_COLLECTION
PARTIAL_NOW_REST_ON_COLLECTION
CREDIT_ACCOUNT
```

## 13.3 Rounding

Use:

```text
sys_currency_rounding_rules_cd
```

Fields:

```sql
currency_code
rounding_context
rounding_mode
rounding_increment
decimal_places
is_active
effective_from
effective_to
```

Rounding contexts:

```text
CASH
CARD
INVOICE
TAX
DISPLAY
```

## 13.4 Cash Change

For cash payment:

```text
tendered_amount
change_returned_amount
```

Example:

```text
Net due = 9.700
Cash tendered = 10.000
Change returned = 0.300
```

---

# 14. Services Design

## 14.1 Service List

```text
OrderCommandService
OrderQueryService
PieceGenerationService
PieceWorkflowService
PreferenceCommandService
PreferenceConfirmationService
PricingEngineService
ChargeCalculationService
PromotionEvaluationService
DiscountCalculationService
TaxCalculationService
SettlementPreviewService
SettlementService
PaymentCaptureService
StoredValueApplicationService
GiftCardRedemptionService
WalletApplicationService
CustomerAdvanceApplicationService
CustomerCreditApplicationService
LoyaltyService
InvoiceService
RefundService
OrderFinancialRecalculationService
ReconciliationService
OutboxService
AccountingPostingService
AuditTrailService
```

## 14.2 Service Responsibilities

### OrderCommandService

- create order
- update order
- confirm order
- close order
- void order
- orchestrate transactional order mutation

### PieceGenerationService

- generate normal quantity pieces
- generate compound template pieces
- assign group number
- assign piece sequence
- assign piece code/barcode

### PreferenceCommandService

- create order/item/piece preferences
- validate preference level
- detect chargeable preferences
- support confirmation workflow

### PricingEngineService

- calculate item gross amounts
- apply item pricing mode
- calculate base commercial totals

### ChargeCalculationService

- convert chargeable preferences to charges
- calculate delivery/rush/packing/COD fees
- write charge detail rows

### PromotionEvaluationService

- evaluate eligible promotions
- enforce budgets
- enforce limits
- enforce stacking policies
- produce discount/reward results

### TaxCalculationService

- evaluate tax profile
- calculate tax-inclusive/tax-exclusive tax
- return tax breakdown rows
- preserve historical snapshot

### SettlementService

- calculate amount due
- apply credits
- apply payments
- calculate pay-on-collection
- calculate outstanding

### StoredValueApplicationService

- orchestrate gift card/wallet/advance/customer credit application
- validate currency/status/balance
- write credit application rows
- write ledger rows

### GiftCardRedemptionService

- lock gift card balance
- validate expiry/status/currency
- write redemption transaction
- update balance

### PaymentCaptureService

- record cash/card/check/bank/payment gateway payments
- support one row per payment leg
- handle tendered/change values

### InvoiceService

- create invoice
- allocate AR
- update invoice status
- record invoice payments

### ReconciliationService

- compare summary vs details vs ledgers
- create reconciliation run
- create reconciliation issues

### OutboxService

- enqueue events inside transaction
- process events later
- retry failed events

### AccountingPostingService

- map business events to vouchers
- validate tenant COA bindings
- post/reverse vouchers

---

# 15. API Design

## 15.1 Current APIs To Preserve

```text
POST /api/v1/orders/preview-payment
POST /api/v1/orders/create-with-payment
```

## 15.2 Future APIs

### Orders

```text
POST /api/client/v1/orders
GET  /api/client/v1/orders/:id
POST /api/client/v1/orders/:id/reprice
POST /api/client/v1/orders/:id/confirm
POST /api/client/v1/orders/:id/void
POST /api/client/v1/orders/:id/close
```

### Pieces

```text
POST /api/client/v1/orders/:id/items/:itemId/generate-pieces
PATCH /api/client/v1/order-pieces/:pieceId/status
PATCH /api/client/v1/order-pieces/:pieceId/rack
GET   /api/client/v1/orders/:id/pieces
```

### Preferences

```text
POST /api/client/v1/orders/:id/preferences
POST /api/client/v1/order-items/:itemId/preferences
POST /api/client/v1/order-pieces/:pieceId/preferences
PATCH /api/client/v1/order-preferences/:id/confirm
DELETE /api/client/v1/order-preferences/:id
```

### Settlement

```text
POST /api/client/v1/orders/:id/apply-credit
POST /api/client/v1/orders/:id/payments
POST /api/client/v1/orders/:id/refunds
POST /api/client/v1/orders/:id/pay-on-collection
GET  /api/client/v1/orders/:id/settlement-summary
```

### Invoice

```text
POST /api/client/v1/orders/:id/invoice
GET  /api/client/v1/invoices/:id
POST /api/client/v1/invoices/:id/payments
```

---

# 16. Event and Outbox Design

## 16.1 Outbox Table

```text
org_domain_events_outbox
```

Recommended fields:

```sql
id uuid primary key
tenant_org_id uuid not null
event_type text not null
aggregate_type text not null
aggregate_id uuid not null
payload jsonb not null
status text not null default 'PENDING'
retry_count integer default 0
error_message text
created_at timestamptz default now()
processed_at timestamptz
```

## 16.2 Events

```text
OrderCreated
OrderItemAdded
OrderPiecesGenerated
OrderPreferenceAdded
OrderChargeCreated
OrderPromotionApplied
OrderTaxCalculated
OrderPriced
OrderCreditApplied
OrderPaymentCaptured
OrderInvoiced
OrderSettled
OrderClosed
OrderRefunded
GiftCardRedeemed
WalletApplied
AdvanceApplied
CustomerCreditApplied
LoyaltyPointsEarned
AccountingPostingRequested
AccountingPosted
```

## 16.3 Rule

Events are written inside the same transaction.

Processing happens after commit.

---

# 17. Accounting Posting Design

## 17.1 Posting Strategy

Do not post directly from UI route.

Use:

```text
business event
→ outbox event
→ posting worker
→ mapping rule resolver
→ voucher draft
→ validation
→ posted voucher
```

## 17.2 Posting Events

```text
ORDER_CONFIRMED
ORDER_CHARGE_RECOGNIZED
ORDER_DISCOUNT_APPLIED
ORDER_TAX_RECOGNIZED
ORDER_PAYMENT_RECEIVED
ORDER_GIFT_CARD_REDEEMED
ORDER_WALLET_APPLIED
ORDER_ADVANCE_APPLIED
ORDER_CUSTOMER_CREDIT_APPLIED
ORDER_LOYALTY_CREDIT_APPLIED
ORDER_INVOICED_AR
ORDER_REFUNDED
ORDER_VOIDED
ORDER_ADJUSTED
GIFT_CARD_SOLD
GIFT_CARD_EXPIRED
WALLET_TOPPED_UP
CUSTOMER_ADVANCE_RECEIVED
CUSTOMER_CREDIT_CREATED
```

---

# 18. Security, Tenancy, and Idempotency

## 18.1 Tenancy

Every tenant-owned table must include:

```text
tenant_org_id
```

All queries must be tenant-scoped.

Recommended indexes:

```sql
(tenant_org_id, order_id)
(tenant_org_id, customer_id)
(tenant_org_id, branch_id)
(tenant_org_id, created_at desc)
```

## 18.2 Idempotency

Every financial mutation must support:

```text
idempotency_key
```

Examples:

- create order
- payment capture
- gift card redemption
- wallet application
- customer credit application
- refund
- invoice creation
- posting

Recommended table:

```text
org_idempotency_keys_log
```

Fields:

```sql
tenant_org_id
idempotency_key
request_hash
response_payload
status
created_at
expires_at
```

## 18.3 Locking

Use row locks for stored-value balances:

```sql
SELECT ... FOR UPDATE
```

Required for:

- gift card redemption
- wallet application
- customer credit application
- advance application
- loyalty monetary redemption

---

# 19. Reconciliation Design

## 19.1 Reconciliation Tables

```text
org_fin_reconciliation_runs_mst
org_fin_reconciliation_issues_dtl
```

## 19.2 Recommended Views

```text
v_order_charges_reconciliation
v_order_discounts_reconciliation
v_order_taxes_reconciliation
v_order_payments_reconciliation
v_order_credits_reconciliation
v_order_financial_summary_reconciliation
```

## 19.3 Checks

```text
sum(charges) = org_orders_mst.total_charges_amount
sum(discounts) = org_orders_mst.total_discount_amount
sum(taxes) = org_orders_mst.total_tax_amount
sum(credit applications) = org_orders_mst.total_credit_applied_amount
sum(payments) = org_orders_mst.total_paid_amount

gross + charges - discounts = net_before_tax
net_before_tax + tax = grand_total
grand_total - credits = net_receivable
net_receivable - payments - invoice_ar = outstanding
```

## 19.4 Issue Severity

```text
INFO
WARNING
BLOCKER
```

Switch-read is not allowed while `BLOCKER` issues exist.

---

# 20. Migration Blueprint

## 20.1 Phase 1 — Audit Only

No code changes.

Deliver:

- current implementation map
- table map
- API map
- gap analysis
- file change list
- risk list

## 20.2 Phase 2 — Add Financial Detail Tables

Add:

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_credit_apps_dtl
org_order_payments_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
org_order_financial_audit_log
```

No behavior change.

## 20.3 Phase 3 — Add Summary Columns

Add snapshot columns to `org_orders_mst`.

No behavior change.

## 20.4 Phase 4 — Dual-Write Preference Charges

Inside existing transaction:

```text
preference.extra_price
→ org_order_charges_dtl
```

Do not switch reads yet.

## 20.5 Phase 5 — Dual-Write Discounts

Inside existing transaction:

```text
promo/manual/auto/coupon discounts
→ org_order_discounts_dtl
```

Do not write gift cards as discounts.

## 20.6 Phase 6 — Dual-Write Taxes

Inside existing transaction:

```text
calculateOrderTotals.taxBreakdown
→ org_order_taxes_dtl
```

## 20.7 Phase 7 — Dual-Write Payments

Inside existing transaction:

```text
cash/card/check
→ org_order_payments_dtl
```

Prepare for multiple payment legs.

## 20.8 Phase 8 — Rounding and Cash Change

Add rounding config and cash tender/change handling.

## 20.9 Phase 9 — Gift Card Ledger

Implement:

```text
org_gift_cards_mst
org_gift_card_txn_dtl
org_order_credit_apps_dtl
```

## 20.10 Phase 10 — Wallet / Advance / Customer Credit

Add ledgers and application services.

## 20.11 Phase 11 — Tenant-Owned Promotions

Add:

```text
org_promotions_*
```

## 20.12 Phase 12 — Tax Config

Add tenant-owned tax config.

## 20.13 Phase 13 — Reconciliation Engine

Add reconciliation runs, issues, views, jobs.

## 20.14 Phase 14 — Outbox + Posting Events

Add outbox and posting event flow.

## 20.15 Phase 15 — Feature-Flag Read Switch

Switch read source gradually.

## 20.16 Phase 16 — Historical Backfill

Backfill old orders into normalized tables.

Must support:

- dry-run
- batching
- idempotency
- resume
- reconciliation

## 20.17 Phase 17 — Strict Constraints

Only after reconciliation passes.

## 20.18 Phase 18 — Retire Legacy

Deprecate old logic.

Do not drop old columns immediately.

---

# 21. Feature Flags

Recommended flags:

```text
new_charge_engine_enabled
new_discount_engine_enabled
new_tax_engine_enabled
new_payment_detail_enabled
new_credit_application_enabled
new_financial_summary_read_enabled
gift_cards_ledger_enabled
wallet_enabled
customer_credit_enabled
customer_advance_enabled
loyalty_enabled
new_promotion_engine_enabled
new_posting_engine_enabled
```

---

# 22. Testing Strategy

## 22.1 Mandatory Test Areas

1. Preview/payment mismatch guard
2. Transaction rollback
3. Items/pieces/preferences persistence
4. Preference charge dual-write
5. Discount dual-write
6. Tax detail write
7. Payment detail write
8. Gift card redemption ledger
9. Wallet application
10. Customer credit application
11. Advance application
12. Pay on collection
13. Multi-payment
14. Rounding and cash change
15. Invoice/AR allocation
16. Reconciliation
17. Idempotency
18. Tenant isolation
19. Permission checks
20. Race condition / double redemption

## 22.2 Critical Test Scenarios

### Amount Mismatch

```text
clientTotals != serverTotals
→ AMOUNT_MISMATCH
→ no DB write
```

### Preference Charge

```text
chargeable preference
→ preference row
→ charge row
→ summary still matches
```

### Gift Card

```text
gift card applied
→ credit application row
→ gift card ledger row
→ balance reduced
→ no discount row
→ no payment row
```

### Multi-Payment

```text
Cash 10
Visa 10
Visa 5
Mastercard 7
→ four payment rows
```

### Pay On Collection

```text
net_receivable > paid + credits
→ outstanding remains open
```

### Rounding

```text
cash tendered > rounded due
→ change returned
```

---

# 23. UI / UX Design

## 23.1 POS Summary Panel

Recommended layout:

```text
Commercial
--------------------
Items & Services
Preference Charges
Other Charges
Discounts
Net Before Tax

Taxes
--------------------
VAT
Other Tax
Grand Total

Credits Applied
--------------------
Gift Card
Wallet
Advance
Customer Credit
Loyalty Credit
Net Due

Settlement
--------------------
Cash
Card
Bank Transfer
Check
Invoice / AR
Outstanding
Change

Savings
--------------------
Total Savings
```

## 23.2 Order Entry

Show:

```text
Item
  → pieces
      → preferences
```

Example:

```text
Suit Dry Cleaning x2
  Group 1
    Jacket
      Color: Black
      Stain: Oil
    Trouser
      Damage: Torn

  Group 2
    Jacket
    Trouser
```

## 23.3 Payment Splitter

Support:

```text
Cash
Card
Check
Bank Transfer
Gift Card
Wallet
Customer Credit
Advance
Pay on Collection
Invoice / AR
```

But internally separate:

```text
real payments → org_order_payments_dtl
stored-value usage → org_order_credit_apps_dtl
invoice → AR
```

---

# 24. No-Break Rules

Do not:

- rewrite checkout
- break `preview-payment`
- break `create-with-payment`
- remove `AMOUNT_MISMATCH`
- remove old fields early
- change frontend payload first
- treat gift cards as discounts
- treat wallet/customer credit/advance as payments
- treat invoice as payment
- update stored-value balance without ledger
- redeem stored value without row lock
- switch reads before reconciliation
- skip tenant scoping
- skip idempotency

Always:

- preserve current transaction shell
- dual-write before switch-read
- reconcile before retiring legacy
- use feature flags
- add tests
- document assumptions

---

# 25. AI Coding Assistant Instructions

Before coding, any AI assistant must:

```text
1. Read this document.
2. Inspect current code and DB schema.
3. Produce an implementation plan.
4. List exact files to change.
5. List risks.
6. Wait for approval if interactive.
```

Do not let the AI assistant jump directly to code.

---

# 26. Recommended First Implementation Sprint

## Sprint 1: Audit + Tables

Deliver:

```text
1. Current implementation audit
2. Schema discovery report
3. Migration for financial detail tables
4. Prisma type update
5. SQL verification queries
```

No checkout behavior change.

## Sprint 2: Preference Charges

Deliver:

```text
1. Dual-write preference charges
2. Charge reconciliation query
3. Unit/integration tests
```

## Sprint 3: Discounts + Taxes

Deliver:

```text
1. Dual-write discounts
2. Tax breakdown output
3. Tax detail rows
4. Reconciliation
```

## Sprint 4: Payments

Deliver:

```text
1. Normalize payments
2. Add cash tender/change
3. Prepare multi-payment payload
```

## Sprint 5: Gift Card Ledger

Deliver:

```text
1. Gift card liability model
2. Credit application row
3. Ledger row
4. Row locking
5. Idempotency
```

---

# 27. Final Architecture Decision

The correct CleanMateX architecture is:

```text
Modular monolith first
Transactional checkout core
Normalized financial facts
Ledger-based stored value
Tenant-owned promotions
Tenant-owned tax config
Outbox-based posting
Reconciliation-first migration
Feature-flag read switch
```

This provides:

- safer migration
- better accounting
- better auditability
- better multi-payment support
- better future ERP integration
- better tenant flexibility
- lower refactor risk

The current checkout flow is not the problem.

The missing layer is the normalized financial fact and ledger architecture around it.

---

# 28. Final One-Line Rule

```text
Preserve the current checkout shell, add normalized financial facts through dual-write, prove correctness through reconciliation, then switch reads using feature flags.
```
