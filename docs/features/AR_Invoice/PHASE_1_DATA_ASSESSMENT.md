# AR Invoice v1 — Phase 1 Data Assessment

**Status:** Completed  
**Assessment Date:** 2026-05-22  
**Assessment Source:** Repository code, migrations, Prisma schema, and feature docs  
**Live DB Query Status:** Not executed by assistant

## Objective

Document the current invoice and AR-related implementation state before introducing the AR Invoice v1 runtime, cleanup migrations, and new tenant tables.

## Current State Found

### Existing Canonical Surfaces

- `public.org_invoice_mst` already exists and is the only viable canonical AR invoice header.
- `public.org_payments_dtl_tr` already stores invoice-linked and non-invoice payments.
- `public.org_fin_vouchers_mst` already acts as the stronger finance-document pattern and must remain the source of truth for money movement.
- `public.org_domain_events_outbox` already exists and should be reused for AR domain events.
- DB-side finance document sequencing already exists through `public.fn_next_fin_doc_no(...)`.

### Existing UI / Service Surfaces

- current invoice hub: `/dashboard/internal_fin/invoices`
- current invoice detail: `/dashboard/internal_fin/invoices/[id]`
- current invoice service: `web-admin/lib/services/invoice-service.ts`
- current payment service: `web-admin/lib/services/payment-service.ts`
- current invoice reporting: `web-admin/lib/services/report-service.ts`
- current AR aging reference: `web-admin/lib/services/erp-lite-reporting.service.ts`

### Existing Constraints

- current billing code uses legacy lowercase invoice statuses such as `pending`, `partial`, and `paid`
- current invoice numbering is count-based in legacy services
- `org_invoice_mst` currently supports some B2B links through `b2b_contract_id` and `statement_id`
- current page access for invoice screens is mostly implicit and must be hardened

## Required Cleanup Before Strict Constraints

The future cleanup migration must inventory and normalize:

1. legacy lowercase or mixed invoice statuses
2. legacy/null `invoice_type_cd` values
3. null or blank `currency_code`
4. rows where `paid_amount > total`
5. rows where computed outstanding balance is negative
6. duplicate or malformed invoice numbering patterns

## Target Additive Schema Changes

### `org_invoice_mst`

Planned additive upgrade areas:

- standardize money fields to `numeric(19,4)`
- add `outstanding_amount`
- add canonical uppercase status support
- add canonical invoice type support
- add sensitive approval metadata
- add due-date policy snapshot metadata
- add immutable numbering metadata aligned to finance doc sequencing

### New AR Tables

- `org_invoice_lines_dtl`
- `org_invoice_orders_dtl`
- `org_invoice_payments_dtl`
- `org_invoice_adjustments_dtl`
- `org_invoice_status_history_dtl`
- `org_customer_ar_ledger_dtl`

## Implementation Notes For Phase 2

- migrations must be new sequential files under `supabase/migrations/` using last numeric sequence + 1
- no existing migration may be edited
- new tenant tables require RLS and tenant indexes
- composite FKs must be used where they strengthen tenant isolation
- navigation additions require both `navigation.ts` and `sys_components_cd` seed changes
- new permissions require DB seed migration rows

## Open Runtime Compatibility Tasks

- map legacy lowercase invoice statuses to canonical AR statuses without breaking existing invoice pages
- keep legacy invoice creation flows operational while introducing sequence-based AR issuance
- bridge receipt voucher and payment transaction flows into `org_invoice_payments_dtl`
- expose AR aging under `internal_fin/ar/aging` while reusing shared report logic

## Next Update

This file should be refreshed after:

- cleanup migration authoring as `0313_ar_invoice_cleanup.sql`
- schema migration authoring as `0314_ar_invoice_schema.sql`
- service-layer integration of canonical AR statuses and numbering
