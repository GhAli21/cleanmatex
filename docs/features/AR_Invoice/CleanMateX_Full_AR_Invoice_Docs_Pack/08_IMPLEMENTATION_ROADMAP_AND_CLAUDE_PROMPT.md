# CleanMateX Full AR Invoice — Implementation Roadmap and Claude Prompt

## Implementation Roadmap

### Phase 1 — Data Assessment

```text
Inspect current org_invoice_mst data.
Identify existing statuses.
Identify null currency_code.
Identify invalid paid > total rows.
Prepare cleanup migration.
```

### Phase 2 — Header Upgrade

```text
Standardize money precision.
Add outstanding_amount.
Backfill currency_code.
Add canonical constraints after cleanup.
```

### Phase 3 — Add Supporting Tables

```text
org_invoice_lines_dtl
org_invoice_orders_dtl
org_invoice_payments_dtl
org_invoice_adjustments_dtl
org_invoice_status_history_dtl
org_customer_ar_ledger_dtl
```

### Phase 4 — Prisma and Types

```text
Run prisma db pull.
Generate Prisma client.
Add TypeScript constants.
Add Zod schemas.
Add DTOs/types.
```

### Phase 5 — Services

```text
ar-invoice.service.ts
ar-invoice-line.service.ts
ar-invoice-from-order.service.ts
ar-invoice-payment.service.ts
ar-invoice-adjustment.service.ts
ar-customer-ledger.service.ts
ar-aging.service.ts
```

### Phase 6 — APIs

```text
Invoice CRUD APIs
From-order/from-orders APIs
Payment allocation APIs
Adjustment APIs
Credit/debit note APIs
Customer AR APIs
Reports APIs
```

### Phase 7 — UI

```text
Invoice list
Invoice create wizard
Invoice detail
Payment allocation
Customer AR balance
Aging report
Customer statement
```

### Phase 8 — Voucher Wiring

```text
INVOICE_PAYMENT voucher line creates invoice payment allocation.
Credit memo/debit note integration.
Refund integration.
Reconciliation checks.
```

### Phase 9 — Testing and UAT

```text
Unit tests
Integration tests
Regression tests
UAT scenarios
```

## AI Coding Assistant Prompt

```text
You are working on CleanMateX, a multi-tenant SaaS laundry/dry-cleaning platform.

Implement the Full AR Invoice module using the approved documentation pack.

Critical rules:
1. Keep org_invoice_mst as AR invoice header. Do not replace it.
2. Add org_invoice_lines_dtl, org_invoice_orders_dtl, org_invoice_payments_dtl, org_invoice_adjustments_dtl, org_invoice_status_history_dtl, and org_customer_ar_ledger_dtl.
3. Do not create invoice for PAY_ON_COLLECTION.
4. CREDIT_INVOICE creates AR invoice.
5. INVOICE_PAYMENT receipt voucher pays AR invoice.
6. Use additive migrations only.
7. Clean existing data before adding strict constraints.
8. Use numeric(19,4) for money.
9. currency_code must be required after backfill, with no hardcoded default.
10. All new statuses must be uppercase canonical values.
11. Implement services, APIs, UI, tests, and RLS-safe tenant isolation.
12. Do not implement GL/AP/bank reconciliation in this module.
13. Do not bypass Business Voucher for invoice payments if voucher module is active.
14. Preserve existing working flows and avoid destructive changes.

Implementation sequence:
1. Create data assessment SQL.
2. Create safe migrations.
3. Update Prisma.
4. Add constants/types/Zod schemas.
5. Implement services.
6. Implement APIs.
7. Implement UI.
8. Implement tests.
9. Provide a summary of changed files, migrations, risks, and test results.

Before coding, inspect the current schema and codebase for existing naming conventions and reuse existing utilities/services where possible.
```

## Done Definition

```text
migrations pass
Prisma generates successfully
services pass unit tests
APIs pass integration tests
UI works for invoice list/create/detail/payment/report
voucher INVOICE_PAYMENT allocation works
AR ledger is accurate
aging report is accurate
PAY_ON_COLLECTION does not create invoice
CREDIT_INVOICE creates invoice
```
