# Domain Rules

## Order / Item / Piece

```text
Order = customer transaction.
Item = commercial line.
Piece = physical garment/unit.
Preference = operational selection/observation.
```

## Item Pricing

For the current migration:

```text
Item uses item pricing.
Pieces are operational tracking units, not financial pricing source.
```

Future pricing modes may include:

```text
ITEM_PRICE
PIECE_PRICE
WEIGHT_PRICE
PACKAGE_PRICE
COMPOUND_PRICE
MANUAL_PRICE
```

But current target is:

```text
ITEM_PRICE
```

## Piece Generation

### Quantity Expansion

```text
Item: Shirt x3
Pieces:
  Shirt #1
  Shirt #2
  Shirt #3
```

### Compound Item Decomposition

```text
Item: Suit x2
Template: Jacket + Trouser

Pieces:
  Group 1 - Jacket
  Group 1 - Trouser
  Group 2 - Jacket
  Group 2 - Trouser
```

## Preferences

`org_order_preferences_dtl` records:

- packing
- stains
- damage
- colors
- conditions
- service add-ons
- operator notes
- customer notes

Preferences can be:

```text
ORDER level
ITEM level
PIECE level
```

## Preference vs Charge

Critical rule:

```text
Preference records what was selected/observed.
Charge records what money was charged.
```

If a preference has `extra_price`, create a row in:

```text
org_order_charges_dtl
```

Do not rely on `org_order_preferences_dtl.extra_price` alone for accounting.

## Discounts

Discounts are revenue reductions.

Examples:

- auto discount
- manual discount
- promotion discount
- coupon discount
- loyalty discount
- manager goodwill discount

Discounts go to:

```text
org_order_discounts_dtl
```

## Gift Cards

Gift cards are:

```text
stored-value liability instruments
```

They are not:

```text
discounts
cash payments
revenue at sale time
```

Redemption goes to:

```text
org_order_credit_apps_dtl
org_gift_card_txn_dtl
```

## Wallet

Wallet is reusable customer stored value.

Wallet application goes to:

```text
org_order_credit_apps_dtl
org_wallet_txn_dtl
```

## Customer Advance

Advance is deposit/prepayment for future service/order.

Advance application goes to:

```text
org_order_credit_apps_dtl
org_customer_advance_txn_dtl
```

## Customer Credit

Customer credit means the business owes the customer money.

Sources:

- overpayment
- refund converted to credit
- compensation
- cancelled order
- price correction

Application goes to:

```text
org_order_credit_apps_dtl
org_customer_credit_txn_dtl
```

## Loyalty

Points are not money until converted or redeemed.

Loyalty movement goes to:

```text
org_loyalty_accounts_mst
org_loyalty_txn_dtl
```

## Payments

Payments are real money collection only:

```text
CASH
CARD
BANK_TRANSFER
CHECK
PAYMENT_GATEWAY
```

Payments go to:

```text
org_order_payments_dtl
```

Stored-value applications do not go there.

## Invoice / AR

Invoice is not payment.

Invoice means:

```text
Accounts Receivable
```

Invoice amount is stored as:

```text
invoice_ar_amount
```

## Tax

Tax is calculated:

```text
after charges and discounts
before credits and payments
```

Gift cards/wallet/customer credit/advance do not reduce taxable sales value.

## Pay On Collection

Pay on collection means:

```text
outstanding amount remains open until collection.
```

It is not payment.
