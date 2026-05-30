It means these are **three backend logic maybe blocks** you must check if needed implement after adding/renaming the columns. They are not just UI changes.

---

# 7. Implement pending / authorized / failed payment logic

This means your system must treat payment attempts differently depending on their status.

Not every payment row is “paid”.

## Example

Customer starts online payment through gateway:

```text
Order Total = 10.000
Gateway payment attempt = 10.000
Status = PENDING
```

Wrong behavior:

```text
total_paid_amount = 10.000
outstanding_amount = 0.000
payment_status = PAID
```

Correct behavior:

```text
total_paid_amount = 0.000
pending_payment_amount = 10.000
outstanding_amount = 10.000
payment_status = PENDING_PAYMENT
```

Because the gateway did not confirm yet.

## Correct rules

```text
COMPLETED / CAPTURED / SETTLED
→ count in total_paid_amount
→ reduce outstanding_amount

PENDING / PROCESSING / CAPTURE_PENDING
→ count in pending_payment_amount
→ do not reduce outstanding_amount

AUTHORIZED
→ count in authorized_payment_amount
→ do not reduce outstanding_amount until captured

FAILED / REFUSED / CANCELLED / EXPIRED / VOIDED
→ count in failed_payment_amount
→ do not reduce outstanding_amount
```

So this implementation updates your calculation service to do this:

```text
total_paid_amount =
  sum completed/captured/settled payments only

pending_payment_amount =
  sum pending/processing/capture-pending payments

authorized_payment_amount =
  sum authorized payments

failed_payment_amount =
  sum failed/refused/cancelled/expired payments

outstanding_amount =
  total_amount
- total_paid_amount
- total_credit_applied_amount
```

Pending/authorized payments are visible, but not financially settled yet.

---

# 8. Implement AR receivable and PAY_ON_COLLECTION classification

This means after calculating `outstanding_amount`, the system must decide **what type of outstanding this is**.

Not all outstanding is AR.

## Case A — PAY_ON_COLLECTION

Customer will pay when collecting clothes.

```text
total_amount = 10.000
paid = 0.000
credits = 0.000
outstanding = 10.000
payment_type_code = PAY_ON_COLLECTION
```

Correct result:

```text
pay_on_collection_amount = 10.000
ar_receivable_amount = 0.000
ar_invoice_id = null
```

Meaning:

```text
This is operational collection due.
It is not AR.
No org_invoice_mst.
No AR ledger debit.
```

## Case B — CREDIT_INVOICE / B2B / INVOICE

Customer is allowed to pay later through account/invoice.

```text
total_amount = 10.000
paid = 3.000
credits = 2.000
outstanding = 5.000
payment_type_code = CREDIT_INVOICE
```

Correct result:

```text
pay_on_collection_amount = 0.000
ar_receivable_amount = 5.000
ar_invoice_id = created invoice id
```

Meaning:

```text
This is a real customer receivable.
Create AR invoice.
Create AR ledger debit.
Show in AR aging/customer statement.
```

## Case C — Normal cash/card/gateway

```text
payment_type_code = PAY_NOW
outstanding = 0
```

Correct result:

```text
pay_on_collection_amount = 0
ar_receivable_amount = 0
no AR invoice
```

The classification algorithm is:

```text
if payment_type_code = PAY_ON_COLLECTION:
  pay_on_collection_amount = outstanding_amount
  ar_receivable_amount = 0

else if payment_type_code in CREDIT_INVOICE, B2B, INVOICE:
  pay_on_collection_amount = 0
  ar_receivable_amount = outstanding_amount

else:
  pay_on_collection_amount = 0
  ar_receivable_amount = 0
```

---

# 9. Implement reconciliation warnings

This means the system should detect when the financial snapshot is inconsistent or suspicious.

It should not silently show wrong numbers.

## Example: gift card double-counted

Wrong data:

```text
total_amount = 1.990
paid = 1.000
credit_applied = 0.150
outstanding = 0.840
```

But correct sale total should be:

```text
2.140
```

The system should raise warning:

```text
GIFT_CARD_DOUBLE_COUNTED
```

## Example: AR invoice mismatch

Order says:

```text
ar_receivable_amount = 0.840
```

Invoice says:

```text
invoice.outstanding_amount = 0.990
```

The system should raise:

```text
AR_RECEIVABLE_MISMATCH
```

## Example: pending gateway counted as paid

Payment row:

```text
payment_status = PENDING
amount = 10.000
```

But order says:

```text
total_paid_amount = 10.000
```

The system should raise:

```text
PENDING_PAYMENT_COUNTED_AS_PAID
```

## Recommended warning checks

```text
ORDER_TOTAL_COMPONENT_MISMATCH
= total_amount does not match items + charges - discounts + tax + rounding

OUTSTANDING_MISMATCH
= outstanding_amount does not match total - paid - credits

PENDING_PAYMENT_COUNTED_AS_PAID
= pending/authorized payments are included in total_paid_amount

GIFT_CARD_DOUBLE_COUNTED
= gift card reduced total_amount and also appears in credit applications

CREDIT_APPLICATION_COUNTED_AS_DISCOUNT
= gift card/wallet/advance appears as discount

AR_RECEIVABLE_MISMATCH
= order AR amount differs from linked invoice outstanding

TAX_TOTAL_MISMATCH
= total_tax_amount differs from tax detail rows

DISCOUNT_TOTAL_MISMATCH
= total_discount_amount differs from discount detail rows
```

These warnings should update:

```text
financial_snapshot_status = MISMATCH
financial_mismatch_warning_count = number of warnings
financial_calculation_snapshot.warnings = warning details
```

---

# In simple implementation terms

You need three services or functions:

```text
1. PaymentSettlementCalculator
   Calculates paid, pending, authorized, failed payment amounts.

2. CollectionClassificationService
   Decides pay_on_collection_amount vs ar_receivable_amount.

3. FinancialReconciliationService
   Detects calculation mismatches and stores warnings.
```

# Final meaning

Those three lines mean:

```text
Do not just add columns.
You must also implement the calculation intelligence that fills those columns correctly.
```

Otherwise the database names will be clean, but the numbers can still be wrong.
