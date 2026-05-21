# CleanMateX Full AR Invoice — UI/UX and Reporting Specification

## Navigation

```text
Finance
  ├── AR Invoices
  ├── New Invoice
  ├── Customer Balances
  ├── AR Aging
  ├── AR Ledger
  └── Customer Statements
```

## Invoice List Screen

Columns:

```text
Invoice No, Customer, Invoice Type, Invoice Date, Due Date, Status, Total, Paid, Outstanding, Currency, Branch, B2B Contract, Statement, Actions
```

Filters:

```text
customer, branch, status, invoice type, date range, due date range, overdue only, B2B contract, statement, amount range, search
```

## Invoice Detail Screen

Sections:

```text
Header Summary
Customer Details
Invoice Lines
Linked Orders
Payments
Adjustments
AR Ledger Movements
Status History
Attachments
Actions
```

## Create Invoice Wizard

```text
1. Choose invoice source.
2. Select customer/orders.
3. Generate lines.
4. Review amounts/tax.
5. Set payment terms/due date.
6. Issue or save draft.
```

## Payment Allocation UI

Show invoice outstanding, receipt voucher line, payment method, allocation amount, payment status, and reference.

## Customer AR Balance Screen

Cards:

```text
Total Open Balance
Overdue Balance
Current Balance
Credit Balance
Last Payment
Oldest Open Invoice
```

## AR Aging Report

Buckets:

```text
Current, 1-30, 31-60, 61-90, 90+
```

## Invoice Print Template

Must include tenant logo, invoice no, date, due date, customer, PO number, terms, lines, subtotal, discount, tax/VAT, total, paid, outstanding, payment instructions, terms, QR/payment reference if available.

## UX Rules

```text
DRAFT invoice can be edited.
OPEN invoice cannot edit lines directly.
OPEN invoice can receive payment, adjustment, credit/debit note.
PAID invoice cannot receive extra payment unless overpayment enabled.
VOID invoice is read-only.
PAY_ON_COLLECTION orders must not show as AR invoices.
```

## Dashboard KPIs

```text
Total AR Outstanding
Overdue AR
Current AR
Invoices Due This Week
Invoices Over 90 Days
Top Debtor Customers
Collection Rate
Average Days to Pay
```
