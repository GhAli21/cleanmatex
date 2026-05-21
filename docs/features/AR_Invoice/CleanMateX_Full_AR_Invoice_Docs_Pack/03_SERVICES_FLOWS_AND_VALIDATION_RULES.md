# CleanMateX Full AR Invoice — Services, Flows, and Validation Rules

## Required Services

```text
ar-invoice.service.ts
ar-invoice-line.service.ts
ar-invoice-number.service.ts
ar-invoice-from-order.service.ts
ar-invoice-payment.service.ts
ar-invoice-adjustment.service.ts
ar-invoice-status.service.ts
ar-customer-ledger.service.ts
ar-aging.service.ts
ar-statement.service.ts
ar-validation.service.ts
```

## Core Flows

### Create Single Order Invoice

```text
BEGIN TRANSACTION
1. Validate order, tenant, branch, customer, and currency.
2. Validate order is eligible for CREDIT_INVOICE.
3. Calculate invoice amount using FULL_ORDER, REMAINING_ONLY, or CUSTOM_AMOUNT.
4. Create org_invoice_mst header.
5. Create org_invoice_orders_dtl row.
6. Generate org_invoice_lines_dtl from order details.
7. Recalculate invoice totals.
8. If issuing: set status OPEN, add status history, create AR ledger debit INVOICE_ISSUED.
9. Write audit/outbox.
COMMIT
```

### Create Multi-Order Invoice

```text
BEGIN TRANSACTION
1. Validate customer and all orders.
2. Confirm all orders belong to same tenant/customer unless approved exception exists.
3. Create invoice header.
4. Create org_invoice_orders_dtl rows.
5. Generate summary or detailed invoice lines.
6. Recalculate totals.
7. Issue and create AR ledger debit if requested.
COMMIT
```

### Invoice Payment from Voucher

```text
BEGIN TRANSACTION
1. Lock invoice.
2. Validate invoice status is OPEN/PARTIALLY_PAID/OVERDUE.
3. Validate voucher line is POSTED, role INVOICE_PAYMENT, target INVOICE.
4. Validate amount > 0 and <= outstanding unless overpayment is enabled.
5. Create org_invoice_payments_dtl.
6. Update paid_amount and outstanding_amount.
7. Update status to PARTIALLY_PAID or PAID.
8. Create AR ledger credit INVOICE_PAYMENT.
9. Add status history.
COMMIT
```

### Write-Off

```text
1. Validate ar:invoices:write_off permission.
2. Validate invoice has outstanding amount.
3. Create invoice adjustment WRITE_OFF / DECREASE.
4. Reduce outstanding.
5. Create AR ledger credit WRITE_OFF.
6. Set status WRITTEN_OFF if balance is zero.
```

## Validation Rules

```text
invoice_no unique per tenant
customer_id required
total >= 0
paid_amount >= 0
outstanding_amount >= 0
currency_code required
status uppercase canonical
invoice_type_cd valid
line_no unique per invoice
payment amount > 0
invoice payment cannot exceed outstanding unless overpayment enabled
write-off requires reason and permission
```

## Calculation Rules

```text
subtotal = sum(invoice line subtotal)
discount = sum(invoice line discount)
tax = sum(invoice line tax)
total = sum(invoice line total)
paid_amount = sum(COMPLETED invoice payments)
outstanding_amount = total - paid_amount - approved decreases + approved increases
```

## AR Ledger Rules

```text
Invoice issued = debit
Invoice payment = credit
Credit note = credit
Debit note = debit
Write-off = credit
Refund = debit/reversal depending case
```
