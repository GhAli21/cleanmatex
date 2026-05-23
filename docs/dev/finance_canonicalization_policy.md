# Finance Canonicalization Policy

## Purpose

This policy defines the single canonical path for finance and order-financial behavior in `cleanmatex` so legacy flows do not silently diverge from production truth.

## Canonical Ownership

| Domain | Canonical path | Notes |
|---|---|---|
| AR invoices and receivables | `web-admin/lib/services/ar-invoice.service.ts` and `/api/v1/ar/*` | Source of truth for invoice lifecycle, allocations, adjustments, aging, statements, and ledger |
| Business vouchers | `web-admin/lib/services/voucher-biz.service.ts` | Canonical voucher CRUD and state transitions |
| Voucher posting and linked effects | `web-admin/lib/services/voucher-wiring.service.ts` | Canonical writer for voucher-derived operational effects |
| Order settlement facts | `web-admin/lib/services/order-settlement.service.ts` | Canonical order payment and credit application writer |
| Order financial summary and reporting | `web-admin/lib/services/order-financial-summary.service.ts` | Canonical read-model for order financial tabs and reports |
| Payment execution | `web-admin/lib/services/payment-service.ts` | Canonical payment orchestration, but not an independent source of invoice truth |

## Legacy Compatibility Rules

Legacy or compatibility entrypoints may remain temporarily when user-visible routes still depend on them, but they must follow all of these rules:

1. They must delegate to canonical services wherever possible.
2. They must not introduce new finance writes that bypass canonical AR, voucher, or settlement services.
3. They must be clearly marked `@deprecated` in code.
4. They must not be used by new screens, APIs, or reports.

## Import Enforcement

- New code must not import `@/lib/services/invoice-service`.
- New AR work must import `@/lib/services/ar-invoice.service`.
- Allowed compatibility imports are limited to explicitly approved bridge files and targeted tests.

## Deletion Standard

A legacy finance file can be deleted only when:

- every runtime caller has migrated
- any useful business rules have been moved into canonical services
- tests cover the migrated behavior
- the route/access/docs inventory has been updated

## `cmx-api` Readiness

`cmx-api` should receive shared finance DTOs and governance documentation only in this phase. It must not introduce a second finance business-logic stack before a dedicated finance module program is approved.
