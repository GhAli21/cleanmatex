# AR Invoice v1 — API Contracts

**Feature:** AR Invoice v1  
**App:** `web-admin`  
**Last Updated:** 2026-05-22

## Scope

This document captures the implemented AR Invoice v1 API surface under `/api/v1/ar/*`.

All endpoints are:

- tenant-scoped
- permission-gated
- validated with Zod
- designed for canonical AR status/type constants that mirror DB values

## Invoice APIs

| Method | Route | Permission | Purpose | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/ar/invoices` | `invoices:read` | List canonical AR invoices | Supports page, limit, search, status, invoice type, date range, sort |
| `POST` | `/api/v1/ar/invoices` | `invoices:create` | Create manual AR invoice | Requires at least one invoice line |
| `POST` | `/api/v1/ar/invoices/from-orders` | `invoices:create` | Create AR invoice from one or more eligible orders | Rejects `PAY_ON_COLLECTION` orders |
| `GET` | `/api/v1/ar/invoices/export` | `invoices:export` | Export the filtered invoice hub result as CSV | Uses canonical invoice list query |
| `GET` | `/api/v1/ar/invoices/[id]` | `invoices:read` | Load AR invoice detail | Includes lines, linked orders, allocations, adjustments, history, ledger |
| `PATCH` | `/api/v1/ar/invoices/[id]` | `invoices:update` | Update editable summary fields | Limited to due date, payment terms, payment method, notes, metadata |
| `POST` | `/api/v1/ar/invoices/[id]/issue` | `invoices:issue` | Issue draft AR invoice | Writes status history and AR ledger |
| `POST` | `/api/v1/ar/invoices/[id]/approve-sensitive` | `invoices:approve_sensitive` | Approve pending sensitive AR action | Used before void, credit memo, debit note, write-off |
| `POST` | `/api/v1/ar/invoices/[id]/void` | `invoices:void` | Void approved AR invoice | Zeroes outstanding and writes reversing ledger entry |
| `POST` | `/api/v1/ar/invoices/[id]/allocations` | `invoices:allocate_payment` | Allocate payment or voucher against invoice | Supports overpayment credit |
| `POST` | `/api/v1/ar/invoices/[id]/allocations/[allocationId]/reverse` | `invoices:allocate_payment` | Reverse a prior allocation | Idempotent and audit-safe |
| `POST` | `/api/v1/ar/invoices/[id]/credit-note` | `invoices:credit_note` | Create credit memo adjustment | Approval-aware |
| `POST` | `/api/v1/ar/invoices/[id]/debit-note` | `invoices:debit_note` | Create debit note adjustment | Approval-aware |
| `POST` | `/api/v1/ar/invoices/[id]/write-off` | `invoices:write_off` | Create write-off adjustment | Approval-aware |
| `GET` | `/api/v1/ar/invoices/[id]/print` | `invoices:print` | Load printable AR invoice payload | Used by print route |

## Customer AR APIs

| Method | Route | Permission | Purpose | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/ar/customers/[customerId]/balance` | `ar_ledger:view` | Customer AR balance snapshot | Used by ledger page context |
| `GET` | `/api/v1/ar/customers/[customerId]/ledger` | `ar_ledger:view` | Customer AR ledger lines | Paginated |
| `GET` | `/api/v1/ar/customers/[customerId]/statements` | `customer_statements:view` | Customer statement view payload | Period-bound |
| `GET` | `/api/v1/ar/customers/[customerId]/statements/print` | `customer_statements:view` | Printable customer statement payload | Used by print route |

## Reporting APIs

| Method | Route | Permission | Purpose | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/ar/reports/aging` | `ar_aging:view` | AR aging report | Reuses shared finance aging logic |

## V1.5 Cleanup And V2 Operations APIs

| Method | Route | Permission | Purpose | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/ar/credits` | `ar_credits:view` | List available unapplied customer credits | Derived from canonical AR ledger credit rows |
| `POST` | `/api/v1/ar/credits/applications` | `ar_credits:apply` | Apply a customer credit to an open invoice | Writes invoice allocation plus credit application record |
| `POST` | `/api/v1/ar/credits/applications/[id]/reverse` | `ar_credits:reverse` | Reverse a prior customer credit allocation | Restores invoice exposure and marks credit application reversed |
| `GET` | `/api/v1/ar/disputes` | `ar_disputes:view` | List AR disputes | Includes invoice and customer context |
| `POST` | `/api/v1/ar/disputes` | `ar_disputes:create` | Open a dispute against an invoice | Sets invoice status to `DISPUTED` and writes status history |
| `POST` | `/api/v1/ar/disputes/[id]/resolve` | `ar_disputes:resolve` | Resolve, reject, or cancel a dispute | Derives the invoice status back from canonical AR facts |
| `GET` | `/api/v1/ar/dunning` | `ar_dunning:view` | List dunning runs | Supports customer, invoice, and status filters |
| `POST` | `/api/v1/ar/dunning/run` | `ar_dunning:run` | Execute an AR dunning action | Supports `EMAIL`, `SMS`, `HOLD`, and `NOTE` |
| `GET` | `/api/v1/ar/statement-cycles` | `ar_stmt_cycles:view` | List statement cycles | Paginated and tenant-scoped |
| `POST` | `/api/v1/ar/statement-cycles` | `ar_stmt_cycles:manage` | Create a statement cycle | Supports all-B2B or custom-customer scope |
| `GET` | `/api/v1/ar/statement-cycles/[id]/preview` | `ar_stmt_cycles:view` | Preview customers for a statement cycle | Used by the V2 planning UI |

## Canonical Financial Rules Enforced

- `PAY_ON_COLLECTION` orders cannot create AR invoices.
- Standard invoice issuance moves `DRAFT` invoices into AR exposure.
- Overpayments remain as unapplied credit in the customer AR ledger.
- Sensitive actions require explicit approval before final posting.
- Allocation reversal restores invoice outstanding and emits a reversal event.
- All money movement paths are tenant-filtered and idempotency-aware.
- Legacy payment and invoice flows now bridge into the same canonical AR allocation and ledger artifacts used by the AR APIs.
