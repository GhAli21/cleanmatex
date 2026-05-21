# CleanMateX Full AR Invoice Module — PRD

**Document Type:** Product Requirements Document  
**Module:** Full AR Invoice / Customer Receivables  
**Version:** v1.0  
**Status:** Ready for Engineering Review  
**Project:** CleanMateX Business / SaaS Platform  
**Primary Scope:** Full customer invoice and receivables module integrated with Order Fin and Business Voucher.

---

# Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Product Vision](#2-product-vision)
- [3. Business Goals](#3-business-goals)
- [4. Non-Goals](#4-non-goals)
- [5. Core Concepts](#5-core-concepts)
- [6. Business Scenarios](#6-business-scenarios)
- [7. Functional Requirements](#7-functional-requirements)
- [8. Invoice Lifecycle](#8-invoice-lifecycle)
- [9. Payment and Allocation Requirements](#9-payment-and-allocation-requirements)
- [10. Credit/Debit Note Requirements](#10-creditdebit-note-requirements)
- [11. Customer AR Ledger Requirements](#11-customer-ar-ledger-requirements)
- [12. B2B and Statement Requirements](#12-b2b-and-statement-requirements)
- [13. Reporting Requirements](#13-reporting-requirements)
- [14. Security and Audit](#14-security-and-audit)
- [15. Acceptance Criteria](#15-acceptance-criteria)

---

# 1. Executive Summary

The Full AR Invoice module provides CleanMateX with complete customer receivables capabilities.

It supports:

```text
single-order invoices
multi-order invoices
B2B contract invoices
statement-linked invoices
manual AR invoices
credit memos
debit notes
partial invoice payments
multi-voucher invoice payments
invoice payment allocation
invoice adjustments
write-offs
overdue tracking
customer AR ledger
customer statement
aging reports
```

The existing table `org_invoice_mst` will be retained and upgraded as the AR invoice header.

New supporting tables complete the model:

```text
org_invoice_lines_dtl
org_invoice_orders_dtl
org_invoice_payments_dtl
org_invoice_adjustments_dtl
org_invoice_status_history_dtl
org_customer_ar_ledger_dtl
```

---

# 2. Product Vision

CleanMateX must support simple and advanced receivables without redesign later. The module should let a tenant invoice one order, invoice many orders, invoice B2B customers monthly, track due dates, collect partial payments, allocate one payment across multiple invoices, issue credit/debit notes, write off balances, track customer receivable balance, and produce statements and aging reports.

---

# 3. Business Goals

```text
1. Provide complete AR invoice lifecycle.
2. Support B2B laundries and retail credit customers.
3. Separate invoice from voucher and order.
4. Allow multiple orders per invoice.
5. Allow partial payments and allocations.
6. Connect invoice payment to Business Voucher receipt lines.
7. Track customer receivable ledger.
8. Enable aging and statement reporting.
9. Preserve audit trail.
10. Avoid turning PAY_ON_COLLECTION into AR invoice.
```

---

# 4. Non-Goals

This module does not implement full GL posting, supplier AP invoices, bank reconciliation, tax filing, inventory accounting, payroll, or full ERP Lite posting engine. It prepares clean data for future ERP Lite.

---

# 5. Core Concepts

## 5.1 Invoice

An invoice is a customer billing / receivable document. It means the customer owes the business this amount.

## 5.2 Voucher

A voucher is a finance transaction document, such as Receipt Voucher, Refund Voucher, Adjustment Voucher, or Payment Voucher. A voucher does not replace an invoice.

## 5.3 Order

An order is the operational laundry transaction. An invoice can be generated from one or many orders.

## 5.4 Statement

A statement is a customer/B2B periodic summary of invoices, payments, and balances.

---

# 6. Business Scenarios

## 6.1 Retail Pay on Collection

```text
Order total = 10
Payment type = PAY_ON_COLLECTION
Outstanding = 10
```

No invoice is created.

## 6.2 Credit Invoice for One Order

```text
Order total = 20
Customer chooses CREDIT_INVOICE
Invoice total = 20 or remaining amount based policy
Invoice status = OPEN
```

Create `org_invoice_mst`, `org_invoice_lines_dtl`, `org_invoice_orders_dtl`, and an AR ledger movement `INVOICE_ISSUED`.

## 6.3 Partial Payment + Invoice Remaining

```text
Order total = 100
Cash paid = 30
Remaining = 70
Customer chooses CREDIT_INVOICE
Invoice total = 70
```

Default policy is `REMAINING_ONLY`.

## 6.4 Monthly B2B Invoice

Customer has many orders during the month. Generate one invoice linked to many orders. Invoice lines may be summary or detailed.

## 6.5 Invoice Payment

Customer pays invoice later. Create Receipt Voucher with voucher line role `INVOICE_PAYMENT`; voucher wiring creates invoice payment allocation and AR ledger credit.

## 6.6 One Receipt Pays Multiple Invoices

One receipt voucher can include multiple invoice payment lines, one per invoice allocation.

## 6.7 Credit Memo

Business reduces customer receivable using `invoice_type_cd = CREDIT_MEMO`, creating AR ledger credit movement.

## 6.8 Debit Note

Business increases customer receivable using `invoice_type_cd = DEBIT_NOTE`, creating AR ledger debit movement.

## 6.9 Write-Off

Business writes off unpaid amount using invoice adjustment and AR ledger credit movement.

---

# 7. Functional Requirements

## 7.1 Invoice Creation

System must create invoices from single order, multiple selected orders, B2B statement, manual invoice, debit note, and credit memo.

## 7.2 Invoice Lines

System must store invoice details in `org_invoice_lines_dtl`. Supported line types include `SERVICE`, `ITEM`, `ORDER_SUMMARY`, `CHARGE`, `DISCOUNT`, `TAX`, `DELIVERY`, `EXPRESS`, `ROUNDING`, `MANUAL`, `CREDIT_MEMO`, and `DEBIT_NOTE`.

## 7.3 Invoice-to-Order Link

System must support one invoice to one order and one invoice to many orders using `org_invoice_orders_dtl`.

## 7.4 Invoice Payments

System must support full payment, partial payment, multiple payments, one receipt allocated to multiple invoices, and payment reversal using `org_invoice_payments_dtl`.

## 7.5 Invoice Adjustments

System must support write-off, rounding, penalty, finance charge, manual correction, credit adjustment, and debit adjustment.

## 7.6 Status History

Every status transition must be recorded in `org_invoice_status_history_dtl`.

## 7.7 Customer AR Ledger

Every receivable movement must create a customer AR ledger row.

---

# 8. Invoice Lifecycle

Approved statuses:

```text
DRAFT
OPEN
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
VOID
PARTIALLY_REFUNDED
REFUNDED
WRITTEN_OFF
DISPUTED
```

Approved transitions:

```text
DRAFT → OPEN
DRAFT → VOID
OPEN → PARTIALLY_PAID
OPEN → PAID
OPEN → OVERDUE
OPEN → CANCELLED
OPEN → VOID
OPEN → WRITTEN_OFF
OPEN → DISPUTED
PARTIALLY_PAID → PAID
PARTIALLY_PAID → OVERDUE
PARTIALLY_PAID → WRITTEN_OFF
PARTIALLY_PAID → DISPUTED
PAID → PARTIALLY_REFUNDED
PAID → REFUNDED
```

---

# 9. Payment and Allocation Requirements

Invoice payment must come from Business Voucher when voucher module is active:

```text
Receipt Voucher
line_role = INVOICE_PAYMENT
target_type = INVOICE
```

Wiring creates `org_invoice_payments_dtl`.

Payment allocation rules:

```text
paid_amount > 0
cannot exceed invoice outstanding unless overpayment allowed
gateway payment cannot count as completed until confirmed
cash payment may complete immediately if accepted
bank transfer/check may require verification
```

---

# 10. Credit/Debit Note Requirements

Credit memo reduces customer receivable, can be linked to original invoice, and creates AR ledger credit.

Debit note increases customer receivable, can be linked to original invoice/order/customer, and creates AR ledger debit.

---

# 11. Customer AR Ledger Requirements

Debit means customer owes more. Credit means customer owes less.

```text
Invoice issued = debit
Invoice payment = credit
Credit note = credit
Debit note = debit
Write off = credit
Refund of payment = debit or reversal depending case
```

---

# 12. B2B and Statement Requirements

B2B invoices can link to `b2b_contract_id`, `statement_id`, `po_number`, `customer_reference`, and `payment_terms`.

Monthly statement can group invoices, payments, credits, debits, opening balance, and closing balance.

---

# 13. Reporting Requirements

Required reports:

```text
AR invoice list
Invoice detail
Customer balance
Customer statement
Aging report
Overdue invoices
Invoice payments report
Invoice adjustments report
Credit/debit note report
B2B statement report
AR ledger report
```

Aging buckets:

```text
Current
1-30 days
31-60 days
61-90 days
90+ days
```

---

# 14. Security and Audit

Permissions:

```text
ar:invoices:view
ar:invoices:create
ar:invoices:update
ar:invoices:issue
ar:invoices:void
ar:invoices:cancel
ar:invoices:write_off
ar:invoices:dispute
ar:invoices:print
ar:invoices:export
ar:payments:allocate
ar:payments:reverse
ar:adjustments:create
ar:credit_memos:create
ar:debit_notes:create
ar:ledger:view
ar:reports:view
```

Audit must track invoice creation, issue, update, payment allocation, adjustment, status change, void, cancel, write-off, and refund.

---

# 15. Acceptance Criteria

```text
1. One-order invoice can be created.
2. Multi-order invoice can be created.
3. Invoice lines are stored and printable.
4. Invoice status lifecycle works.
5. Invoice payments are allocated from receipt voucher lines.
6. Partial payments update invoice status.
7. Customer AR ledger is updated.
8. Credit memo and debit note are supported.
9. Write-off and adjustment are supported.
10. Aging report is accurate.
11. PAY_ON_COLLECTION does not create invoice.
12. CREDIT_INVOICE creates invoice.
13. Voucher INVOICE_PAYMENT updates invoice.
14. All critical actions are audited.
```
