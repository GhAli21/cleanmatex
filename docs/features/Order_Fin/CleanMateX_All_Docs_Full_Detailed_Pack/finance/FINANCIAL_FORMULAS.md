<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Financial Formulas

## 1. Main Order Formula

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

## 2. Gross Amount

```text
gross_amount = sum(order item base amounts)
```

## 3. Charges

```text
total_charges_amount = sum(org_order_charges_dtl.amount where rec_status = active)
```

Charge types:
- preference charge
- packing charge
- rush fee
- delivery fee
- handling fee
- manual fee

## 4. Discounts

```text
total_discount_amount = sum(org_order_discounts_dtl.discount_amount)
```

Discounts reduce revenue.

## 5. Taxable Amount

```text
taxable_amount = gross_amount + charges - discounts
```

## 6. Grand Total

```text
grand_total_amount = net_before_tax_amount + total_tax_amount
```

## 7. Credits

```text
total_credit_applied_amount =
gift_card_applied_amount
+ wallet_applied_amount
+ advance_applied_amount
+ customer_credit_applied_amount
+ loyalty_credit_applied_amount
```

## 8. Net Receivable

```text
net_receivable_amount = grand_total_amount - total_credit_applied_amount
```

## 9. Payments

```text
total_paid_amount =
cash_paid_amount
+ card_paid_amount
+ check_paid_amount
+ bank_transfer_paid_amount
+ payment_gateway_paid_amount
```

## 10. Outstanding

```text
outstanding_amount = net_receivable_amount - total_paid_amount - invoice_ar_amount
```

## 11. Precision

Use `numeric(19,4)` for all money.

## 12. Rounding

Rounding should be rule-based by currency and context:
- CASH
- CARD
- INVOICE
- TAX
- DISPLAY
