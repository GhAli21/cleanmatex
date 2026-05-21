# CleanMateX Full AR Invoice — Business Voucher and Order Fin Wiring

## Integration Model

```text
Order Fin = order financial snapshot and operational order facts
AR Invoice = customer billing / receivable
Business Voucher = money/credit transaction source document
```

## Submit Order Flow With AR

### PAY_ON_COLLECTION

```text
1. Create order.
2. Set outstanding amount.
3. payment_type_code = PAY_ON_COLLECTION.
4. Do not create AR invoice.
5. Later collection creates receipt voucher.
```

### CREDIT_INVOICE

```text
1. Create order.
2. Calculate outstanding amount.
3. Create AR invoice: org_invoice_mst, org_invoice_lines_dtl, org_invoice_orders_dtl.
4. Create AR ledger debit.
5. Set order invoice status/reference if fields exist.
```

## Invoice Creation from Order

Default allocation policy:

```text
REMAINING_ONLY
```

## Voucher INVOICE_PAYMENT Flow

Receipt voucher line:

```text
line_role = INVOICE_PAYMENT
target_type = INVOICE
invoice_id = org_invoice_mst.id
amount = paid amount
```

Wiring creates:

```text
org_invoice_payments_dtl
org_customer_ar_ledger_dtl movement INVOICE_PAYMENT
```

Updates:

```text
org_invoice_mst.paid_amount
org_invoice_mst.outstanding_amount
org_invoice_mst.status
```

## One Voucher Pays Many Invoices

Recommended simple pattern:

```text
one voucher line per invoice allocation
```

## Reconciliation Rules

```text
invoice.total = sum(invoice lines)
invoice.paid_amount = sum(completed invoice payments)
invoice.outstanding_amount = total - paid - decrease adjustments + increase adjustments
customer AR balance = sum(debits - credits)
receipt voucher invoice payment lines = invoice payment allocations
```

## What Not To Do

```text
Do not create invoice for PAY_ON_COLLECTION.
Do not treat invoice as voucher.
Do not treat gift card as invoice discount unless invoice line explicitly represents credit memo.
Do not write invoice payments directly without voucher source if voucher module is active.
Do not create duplicate payment rows from both voucher and invoice services.
```
