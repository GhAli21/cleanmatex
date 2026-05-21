# CleanMateX Full AR Invoice Documentation Pack

**Pack Name:** CleanMateX Full AR Invoice Docs Pack  
**Version:** v1.0  
**Status:** Ready for Engineering Review  
**Scope:** Full Accounts Receivable invoice module for CleanMateX, integrated with Order Fin and Business Voucher wiring.

---

# 1. Purpose

This pack defines the full AR Invoice module for CleanMateX.

It covers:

```text
PRD
database design
table improvements
new tables
service flows
validation rules
API contracts
UI/UX requirements
voucher wiring
order integration
B2B statement integration
reporting
testing
implementation roadmap
```

---

# 2. Core Decision

CleanMateX will implement full AR Invoice now.

Approved architecture:

```text
org_invoice_mst
= AR invoice header

org_invoice_lines_dtl
= invoice line details

org_invoice_orders_dtl
= invoice-to-order allocation

org_invoice_payments_dtl
= invoice payment allocation from receipt vouchers

org_invoice_adjustments_dtl
= write-off / rounding / correction / penalty / finance charge

org_invoice_status_history_dtl
= invoice lifecycle audit

org_customer_ar_ledger_dtl
= customer AR ledger
```

Optional later extensions:

```text
org_invoice_attachments_dtl
org_invoice_reminders_dtl
org_customer_ar_account_mst
```

---

# 3. Business Document Separation

The full model must keep this separation:

```text
Order
= laundry operational service request

Invoice
= customer billing / receivable document

Voucher
= finance transaction document for receipt/payment/refund/adjustment

Statement
= B2B/customer periodic summary of invoices
```

Never merge these meanings into one table.

---

# 4. Files in This Pack

| File | Purpose |
|---|---|
| `01_FULL_AR_INVOICE_PRD.md` | Full product requirements for AR invoice. |
| `02_DATABASE_DESIGN_AND_TABLES.md` | Database model, table definitions, improvements, constraints, indexes. |
| `03_SERVICES_FLOWS_AND_VALIDATION_RULES.md` | Backend services, transaction flows, validation rules, lifecycle flows. |
| `04_API_CONTRACTS.md` | REST/API endpoints, payloads, responses, error contracts. |
| `05_UI_UX_AND_REPORTING.md` | UI screens, workflows, reports, dashboards, user experience rules. |
| `06_BUSINESS_VOUCHER_AND_ORDER_FIN_WIRING.md` | Integration with Business Voucher, Order Fin, payments, credit, refunds. |
| `07_TESTING_UAT_AND_ACCEPTANCE_CRITERIA.md` | Unit, integration, UAT, regression tests and acceptance criteria. |
| `08_IMPLEMENTATION_ROADMAP_AND_CLAUDE_PROMPT.md` | Engineering roadmap and prompt for AI coding assistant. |

---

# 5. Important Rules

```text
PAY_ON_COLLECTION does not create invoice.
CREDIT_INVOICE creates AR invoice.
INVOICE_PAYMENT receipt voucher pays AR invoice.
Invoice details must be stored in org_invoice_lines_dtl.
One invoice can include one or many orders through org_invoice_orders_dtl.
Invoice payment allocation is tracked in org_invoice_payments_dtl.
Customer AR ledger tracks debit/credit customer receivable movements.
```

---

# 6. Recommended Implementation Order

```text
1. Upgrade org_invoice_mst safely.
2. Add org_invoice_lines_dtl.
3. Add org_invoice_orders_dtl.
4. Add org_invoice_payments_dtl.
5. Add org_invoice_adjustments_dtl.
6. Add org_invoice_status_history_dtl.
7. Add org_customer_ar_ledger_dtl.
8. Add services and validations.
9. Add APIs.
10. Add UI and reports.
11. Wire CREDIT_INVOICE order flow.
12. Wire INVOICE_PAYMENT voucher flow.
13. Add tests and UAT.
```
