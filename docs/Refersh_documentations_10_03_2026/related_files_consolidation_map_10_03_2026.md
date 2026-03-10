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

## Next Recommended Physical Consolidation

- move older dashboard continuation/progress notes into `docs/features/007_admin_dashboard/history/`
- move payment/workflow sub-feature notes into subfolders under `docs/features/010_advanced_orders/`
- after moves, replace old folders with short archive pointers or relocate them into `docs/_archive/` per the approved cleanup direction
