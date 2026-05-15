# Copy-Ready Prompts for AI Coding Assistants

## Prompt 1 — Read Context First

```text
Read all files under /architecture-docs/order-financial-migration.

Treat them as source-of-truth architecture.

Do not implement anything yet.

First produce:
1. What you understood
2. Existing code/schema files you need to inspect
3. Exact implementation plan
4. Risks
5. Files likely to change

Important:
Do not rewrite checkout.
Do not break preview-payment or create-with-payment.
Do not remove legacy fields.
Use expand → dual-write → reconcile → switch-read → retire.
```

## Prompt 2 — Schema Discovery Only

```text
Before creating any migration, inspect the current database/schema structure.

This task is schema discovery only. Do not create or edit files yet.

Inspect:
1. Existing Supabase migrations under supabase/migrations
2. Prisma schema if used
3. Existing tables:
   - org_orders_mst
   - org_order_items_dtl
   - org_order_item_pieces_dtl
   - org_order_preferences_dtl
   - org_invoices_mst
   - existing payment tables
   - existing discount/promo/gift-card tables
   - org_tenants_mst
   - org_branches_mst
   - customer tables
   - user/staff tables
4. Existing naming conventions:
   - primary key naming
   - FK naming
   - audit columns
   - rec_status usage
   - created_by / updated_by type
   - timestamp type
   - tenant_org_id pattern
   - branch_id pattern
   - indexes pattern
5. Existing enums/check constraints
6. Existing RLS policies if any

Produce a report with:
- exact existing table names
- important columns
- FK patterns
- index patterns
- audit column conventions
- data types used for user IDs
- naming style to follow
- recommended migration style for this project

Do not generate new tables yet.
```

## Prompt 3 — Phase 1 Audit

```text
Audit the current CleanMateX order/payment implementation only. Do not change code.

Focus on:
- create-with-payment route
- preview-payment route
- OrderService.createOrderInTransaction
- calculateOrderTotals
- invoice creation
- payment recording
- promo/gift/discount logic
- order/items/pieces/preferences persistence

Produce:
1. Current flow summary
2. Current DB tables used
3. Current financial calculation formula
4. Current payment behavior
5. Current promo/discount/gift-card behavior
6. Current gaps vs target architecture
7. Safe migration plan with exact files to change
8. Risks and no-break rules

Important:
Do not rewrite.
Do not refactor.
Do not edit files yet.
```

## Prompt 4 — Phase 2 Tables Only

```text
Implement Phase 2 only: create normalized financial detail tables.

Create migration for:
- org_order_charges_dtl
- org_order_discounts_dtl
- org_order_taxes_dtl
- org_order_credit_apps_dtl
- org_order_payments_dtl
- org_order_refunds_dtl
- org_order_adjustments_dtl
- org_order_financial_audit_log

Do not modify checkout logic.
Do not modify frontend.
Do not remove old columns.
Make migration safe and tenant-scoped.
Follow the exact schema conventions discovered in the schema discovery phase.
```

## Prompt 5 — Review Implementation

```text
Review the implemented migration code as a senior SaaS architect and finance-aware backend engineer.

Check:
1. No breaking change to preview-payment or create-with-payment.
2. Transaction boundaries are correct.
3. No financial writes outside transaction unless intentionally async.
4. Idempotency is respected.
5. tenant_org_id exists in all queries.
6. No gift card written as discount.
7. No wallet/customer credit/advance written as payment.
8. No invoice treated as payment.
9. Tax is calculated before credits/payments.
10. Preference extra_price creates charge rows.
11. Detail totals reconcile with order summary.
12. Race conditions handled with row locks where needed.
13. Tests cover rollback and duplicate submissions.
14. SQL indexes are tenant-aware.
15. Migration is safe for existing data.
16. No unrelated refactor.
17. Prisma generated types updated.
18. API response compatibility preserved.

Return:
- critical issues
- medium issues
- minor improvements
- required fixes before merge
- optional enhancements later
```
