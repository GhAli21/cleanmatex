# Target Order Financial Architecture

## Architecture Goal

Build a modular, audit-safe, IFRS-aware, multi-tenant order-finance engine supporting:

```text
orders
items
pieces
preferences
charges
discounts
promotions
tax
gift cards
wallet
customer credit
advance
loyalty
multi-payment
pay on collection
rounding
cash return
invoice / AR
ERP posting
audit
reconciliation
```

## Bounded Contexts

### 1. Order Core

Owns:

```text
org_orders_mst
org_order_items_dtl
```

Responsibilities:

- create order
- manage commercial order lines
- store financial summary snapshot
- track order status

### 2. Piece Tracking

Owns:

```text
org_order_item_pieces_dtl
org_order_piece_status_history_dtl
org_product_piece_templates_mst
org_product_piece_templates_dtl
```

Responsibilities:

- generate physical pieces
- support quantity expansion
- support compound item decomposition
- barcode tracking
- rack tracking
- workflow status/stage
- rejected/lost/damaged handling

### 3. Preference Engine

Owns:

```text
org_order_preferences_dtl
org_order_preference_history_dtl
```

Responsibilities:

- service add-ons
- packing
- stains
- damage
- colors
- operator notes
- customer notes
- confirmation workflow

### 4. Pricing / Charges

Owns:

```text
org_order_charges_dtl
```

Responsibilities:

- preference charges
- rush fee
- delivery fee
- packing fee
- handling fee
- COD fee
- manual charge

### 5. Discount / Promotion

Owns:

```text
org_promotions_mst
org_promotion_rules_dtl
org_promotion_eligibility_dtl
org_promotion_rewards_dtl
org_promotion_limits_dtl
org_promotion_exclusions_dtl
org_order_discounts_dtl
```

Responsibilities:

- tenant-owned promotions
- coupons
- auto discounts
- manual discounts
- promotion limits
- promotion rewards

### 6. Tax

Owns:

```text
org_tax_profiles_mst
org_tax_rates_dtl
org_tax_rules_dtl
org_product_tax_mappings_dtl
org_branch_tax_mappings_dtl
org_order_taxes_dtl
```

Responsibilities:

- VAT
- tax-inclusive / tax-exclusive prices
- tax exemption
- tax snapshot

### 7. Settlement

Owns:

```text
org_order_payments_dtl
org_order_credit_apps_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
```

Responsibilities:

- cash/card/check/bank/payment gateway payments
- multi-payment
- pay on collection
- rounding
- change returned
- refunds

### 8. Stored Value

Owns:

```text
org_gift_cards_mst
org_gift_card_txn_dtl
org_wallet_accounts_mst
org_wallet_txn_dtl
org_customer_advances_mst
org_customer_advance_txn_dtl
org_customer_credits_mst
org_customer_credit_txn_dtl
```

Responsibilities:

- gift card liability
- wallet liability
- customer advance liability
- customer credit liability
- balance locking
- ledger transactions

### 9. Loyalty

Owns:

```text
org_loyalty_accounts_mst
org_loyalty_txn_dtl
```

Responsibilities:

- points balance
- monetary loyalty balance if enabled
- tiers
- earning
- redemption
- expiry

### 10. Invoice / AR

Owns:

```text
org_invoices_mst
org_invoice_lines_dtl
org_invoice_payments_dtl
```

Responsibilities:

- invoice generation
- AR allocation
- invoice payment
- credit note

### 11. Accounting Posting

Owns existing finance/accounting posting structures.

Responsibilities:

- event-to-journal posting
- mapping rules
- voucher generation
- reversal
- posting reconciliation

## Target Runtime Flow

```text
Create Order:
  validate tenant/security
  create order draft
  add items
  generate pieces
  add preferences
  convert chargeable preferences to charges
  apply promotions/discounts
  calculate tax
  calculate totals
  save snapshot

Checkout:
  revalidate totals
  lock order
  apply credits
  capture payments
  handle rounding/change
  create invoice/AR if needed
  update outstanding
  write audit
  write outbox events
  commit
```
