# Related Files Consolidation Map

This file tracks cases where documentation for the same feature or PRD is still spread across multiple folders.

## Rule Used In This Pass

- same feature family should have one obvious canonical folder
- split or historical folders must point back to that canonical folder
- when a full physical move is not yet safe, add a grouped index in the canonical folder first

## Consolidation Batches

### Dashboard feature family

- canonical folder: `docs/features/007_admin_dashboard/`
- split legacy folder: `docs/features/Dashboard_Feature/`
- grouped legacy index added at: `docs/features/007_admin_dashboard/history/dashboard_feature_legacy_index.md`
- legacy folder README updated to point to canonical dashboard history grouping

### Order feature family

- canonical folder: `docs/features/010_advanced_orders/`
- split related folders:
  - `docs/features/010_2_Payment Feature for Order Module/`
  - `docs/features/010 - Order Workflow Engine (Dev Plan)/`
  - `docs/features/004_order_intake/`
- grouped related-doc index added at: `docs/features/010_advanced_orders/related_docs_index.md`
- split-folder READMEs updated to point back to the canonical order folder

## Structural Closure In This Pass

- canonical history folder entrypoint added at `docs/features/007_admin_dashboard/history/README.md`
- canonical payment subdomain entrypoint added at `docs/features/010_advanced_orders/payment/README.md`
- canonical workflow subdomain entrypoint added at `docs/features/010_advanced_orders/workflow/README.md`
- canonical customer history entrypoint added at `docs/features/003_customer_management/history/README.md`
- `docs/plan_cr/README.md` added to demote `plan_cr` from equal-authority status and point back to `docs/plan/`

## Physical Relocation Completed

- legacy dashboard files were moved from `docs/features/Dashboard_Feature/` into `docs/features/007_admin_dashboard/history/`
- order-payment files were moved from `docs/features/010_2_Payment Feature for Order Module/` into `docs/features/010_advanced_orders/payment/`
- order-workflow files were moved from `docs/features/010 - Order Workflow Engine (Dev Plan)/` into `docs/features/010_advanced_orders/workflow/`
- customer-domain overlap notes were moved from `docs/features/Customer Data Management Global and Tenant/` into `docs/features/003_customer_management/history/`
- the former sibling folders now contain archive-pointer READMEs only

## Current Outcome

- related docs now have one obvious canonical feature, history, or subdomain folder to point to
- old split folders remain discoverable as archive pointers only and no longer present themselves as equal authorities
- remaining future file-by-file archive moves are optional cleanup in other unrelated areas, not blockers for documentation clarity
