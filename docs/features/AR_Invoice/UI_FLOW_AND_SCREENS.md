# AR Invoice v1 — UI Flow And Screens

**Feature:** AR Invoice v1  
**Primary Area:** `web-admin/app/dashboard/internal_fin/invoices` and `web-admin/app/dashboard/internal_fin/ar/*`  
**Last Updated:** 2026-05-22

## Screen Inventory

| Route | Purpose | Primary Permission |
|---|---|---|
| `/dashboard/internal_fin/invoices` | Canonical AR invoice hub | `invoices:read` |
| `/dashboard/internal_fin/invoices/new` | AR invoice issuance wizard | `invoices:create` |
| `/dashboard/internal_fin/invoices/[id]` | AR invoice detail and actions | `invoices:read` |
| `/dashboard/internal_fin/invoices/[id]/print` | Printable AR invoice | `invoices:print` |
| `/dashboard/internal_fin/ar/customers` | Customer AR balance hub | `ar_ledger:view` |
| `/dashboard/internal_fin/ar/ledger` | Customer AR ledger view | `ar_ledger:view` |
| `/dashboard/internal_fin/ar/aging` | AR aging report | `ar_aging:view` |
| `/dashboard/internal_fin/ar/statements` | Customer statement viewer | `customer_statements:view` |
| `/dashboard/internal_fin/ar/statements/print` | Printable customer statement | `customer_statements:view` |
| `/dashboard/internal_fin/ar/credits` | Customer credit workspace | `ar_credits:view` |
| `/dashboard/internal_fin/ar/disputes` | AR dispute register and resolution | `ar_disputes:view` |
| `/dashboard/internal_fin/ar/dunning` | Dunning execution and history | `ar_dunning:view` |
| `/dashboard/internal_fin/ar/cycles` | B2B statement-cycle planning | `ar_stmt_cycles:view` |

## Invoice Hub

The invoice hub is now backed by the canonical AR service layer.

Implemented UX:

- KPI strip for total, draft, open, paid, and outstanding exposure
- server-side filtering by search, status, invoice type, and date range
- server-side pagination and sorting
- export control for CSV output
- direct navigation to create, detail, and print routes

## Create Wizard

The AR invoice wizard supports two issuance modes:

1. `MANUAL`
2. `FROM_ORDERS`

Implemented steps:

1. Basics
2. Source
3. Review

Implemented validation behaviors:

- manual mode requires `customer_id`
- currency code must be 3 letters
- order mode requires at least one order id
- each manual line requires description and quantity greater than zero
- totals preview updates live for manual lines

## Invoice Detail

The detail page includes:

- summary KPIs
- tabs for lines, linked orders, allocations, adjustments, history, and ledger impact
- guarded action dialogs for edit, issue, approve, allocate, reverse allocation, credit memo, debit note, write-off, void, and print

Action design principles:

- destructive actions are isolated in explicit dialogs
- sensitive flows surface approval state before posting
- payment reversal is a first-class user flow, not an admin-only hidden fix

## Customer AR Views

### Customers

- outstanding and unapplied credit balances
- last activity visibility
- quick links to ledger and statements

### Ledger

- paginated ledger entries
- running balance
- debit/credit distinction

### Statements

- opening and closing balance summary
- statement lines rendered from ledger facts
- printable statement route from the screen header

## V1.5 Cleanup

The platform now routes legacy invoice and payment paths back into the canonical AR artifacts:

- invoice creation bridges ensure AR lines, order links, status history, and opening ledger facts exist
- payment apply, refund, and cancel flows write or reverse canonical AR allocations whenever the data path supports it
- checkout order creation with immediate payment now records payment transactions and allocates against AR through canonical helpers
- credit-limit exposure checks now read canonical uppercase AR statuses

## V2 Operations Screens

### Credits

- server-side credit-source list from unapplied AR ledger credits
- credit apply panel
- credit-application reversal panel

### Disputes

- dispute register with invoice/customer context
- create dispute panel
- resolve/reject/cancel dispute panel

### Dunning

- dunning execution history
- manual run panel for reminder, SMS, hold, and note actions

### Statement Cycles

- cycle register with cadence, scope, terms, and next-run visibility
- create cycle panel
- preview panel for customer inclusion before rollout

## Localization And UI System

- EN and AR keys are implemented for all new AR invoice screens
- print views support RTL-aware locale formatting
- shared Cmx components are used across forms, dialogs, feedback, and data display
- V2 operations pages follow the same internal finance layout and Cmx card/table composition as the canonical v1 routes
