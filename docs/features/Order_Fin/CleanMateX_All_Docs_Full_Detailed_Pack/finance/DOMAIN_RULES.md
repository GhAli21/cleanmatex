<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Domain Rules

## 1. Gift Cards

Gift cards are stored-value liabilities. They are not revenue at sale time and are not discounts at redemption.

Correct redemption storage:

```text
org_order_credit_apps_dtl
org_gift_card_txn_dtl
```

Wrong:

```text
org_order_discounts_dtl with discount_type = GIFT_CARD
```

## 2. Wallet

Wallet is reusable customer prepaid stored value.

Application goes to:

```text
org_order_credit_apps_dtl
org_wallet_txn_dtl
```

## 3. Customer Advance

Advance is a deposit/prepayment for future service/order.

Application goes to:

```text
org_order_credit_apps_dtl
org_customer_advance_txn_dtl
```

## 4. Customer Credit

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

## 5. Invoice

Invoice is Accounts Receivable, not payment.

## 6. Payments

Payments are real money only:

```text
CASH
CARD
CHECK
BANK_TRANSFER
PAYMENT_GATEWAY
```

## 7. Preferences

Preferences record operational choices or observations.

Charges record financial money additions.

## 8. Tax

Tax is calculated after charges/discounts and before credits/payments.

## 9. Pieces

Pieces are physical tracking units. Current pricing source is the item line, not piece rows.

## 10. Reconciliation

No feature can switch to normalized reads until reconciliation proves the new facts match legacy summaries.
