# Feature Documentation Pack Audit

version: v1.0.0
last_updated: 2026-07-16
author: Codex

## Overview

This audit reviews `docs/features/` against the current CleanMateX feature documentation pack standard.

Audit date: `2026-07-16`

Target pack per feature or meaningful sub-scope:

- `README.md`
- `development_plan.md`
- `progress_summary.md`
- `current_status.md`
- `developer_guide.md`
- `developer_guide_mermaid.md`
- `user_guide.md`
- `user_guide_mermaid.md`
- `deploy_guide.md`
- `testing_guide_and_scenarios.md`
- `CHANGELOG.md`
- `version.txt`
- `technical_docs/`
- lookup/index files where needed

This audit is descriptive, not normative. Some folders are legacy PRD dumps, some are active feature packs, and some are mixed. The purpose of this file is to show current gaps and define a practical cleanup order.

## Summary

- Feature directories audited: `45`
- Fully complete packs: `0`
- Near-complete packs with `1-2` missing files: `3`
- Partial packs with `3-8` missing files: `4`
- Major-gap packs with `9+` missing files: `38`
- Feature folders missing `README.md`: `12`
- Feature folders with `technical_docs/`: `6`
- Feature folders with a lookup file: `4`

## Strongest Findings

- No feature folder currently has a full documentation pack.
- `testing_guide_and_scenarios.md` exists in `0` of `45` audited feature folders.
- `development_plan.md` exists in only `3` feature folders.
- `deploy_guide.md` exists in only `3` feature folders.
- `user_guide_mermaid.md` exists in only `3` feature folders.
- `developer_guide_mermaid.md` exists in only `4` feature folders.
- `progress_summary.md` exists in only `5` feature folders.
- `current_status.md` exists in only `6` feature folders.
- `README.md` is the healthiest file type, but `12` feature folders still do not have one.
- Naming remains inconsistent across `docs/features/`, with a mix of numeric PRD folders, underscored feature folders, title-case folders, and spaces in folder names.

## Required File Coverage Snapshot

| File | Present In Feature Folders |
| --- | ---: |
| `README.md` | 33 |
| `development_plan.md` | 3 |
| `progress_summary.md` | 5 |
| `current_status.md` | 6 |
| `developer_guide.md` | 10 |
| `developer_guide_mermaid.md` | 4 |
| `user_guide.md` | 10 |
| `user_guide_mermaid.md` | 3 |
| `deploy_guide.md` | 3 |
| `testing_guide_and_scenarios.md` | 0 |
| `CHANGELOG.md` | 9 |
| `version.txt` | 7 |

## Readiness Tiers

### Tier 1: Near Complete

These are the fastest wins and should be completed first.

| Feature | Missing Files |
| --- | --- |
| `B2B_Feature` | `testing_guide_and_scenarios.md` |
| `Order_Service_Preferences` | `testing_guide_and_scenarios.md` |
| `orders_workflow_migration` | `deploy_guide.md`, `testing_guide_and_scenarios.md` |

### Tier 2: Partial But Recoverable

These already have meaningful structure and should be upgraded in a focused second wave.

| Feature | Missing Count |
| --- | ---: |
| `007_admin_dashboard` | 5 |
| `inventory_stock_management` | 7 |
| `Order_Fin` | 7 |
| `RBAC` | 7 |

### Tier 3: Major Gaps

These folders are still missing most of the pack and likely need a mix of restructuring, canon selection, and new file creation.

| Feature | Missing Count |
| --- | ---: |
| `005_basic_workflow` | 9 |
| `Business_Voucher_Module` | 9 |
| `Notification_And_Communication_Hub` | 9 |
| `pricing` | 9 |
| `001_auth_dev_prd` | 10 |
| `003_customer_management` | 10 |
| `user_management` | 10 |
| `002_tenant_management_dev_prd` | 11 |
| `004_order_intake` | 11 |
| `006_digital_receipts` | 11 |
| `008_order_intake_quick_drop_dev_prd` | 11 |
| `008_service_catalog_dev_prd` | 11 |
| `009 – Order Preparation & Itemization (Dev PRD)` | 11 |
| `009_assembly_qa` | 11 |
| `009_assembly_qa_dev_prd` | 11 |
| `010 - Order Workflow Engine (Dev Plan)` | 11 |
| `010_2_Payment Feature for Order Module` | 11 |
| `010_advanced_orders` | 11 |
| `013_delivery_management` | 11 |
| `Customer Data Management Global and Tenant` | 11 |
| `Customer_Order_Item_Pieces_Preferences` | 11 |
| `Dashboard_Feature` | 11 |
| `Discount_Audit_Trail` | 11 |
| `ERP_Lite` | 11 |
| `Gift_Cards` | 11 |
| `Promotions` | 11 |
| `Promotions_and_Gift_Cards` | 11 |
| `Session_Activity` | 11 |
| `AR_Invoice` | 12 |
| `Images` | 12 |
| `JhTest_Issues` | 12 |
| `Money_And_Currency` | 12 |
| `Order_Item_Pieces` | 12 |
| `Order_Payment_Model` | 12 |
| `orders` | 12 |
| `Payment_Config_Setup` | 12 |
| `Report_Tool` | 12 |
| `setttings_feature_flags_plans_limits` | 12 |

## Structural Risks

### Canonical Folder Risk

Several folders look like parallel representations of nearby domains rather than clearly separated features. Examples:

- `orders`
- `004_order_intake`
- `008_order_intake_quick_drop_dev_prd`
- `010_advanced_orders`
- `Order_Fin`
- `Order_Item_Pieces`
- `Order_Payment_Model`

These should be reviewed before large-scale doc generation so the cleanup does not reinforce duplicate sources of truth.

### PRD Dump Risk

Several folders appear PRD-first rather than pack-first, especially older numbered folders such as:

- `001_auth_dev_prd`
- `002_tenant_management_dev_prd`
- `008_service_catalog_dev_prd`
- `009 – Order Preparation & Itemization (Dev PRD)`
- `010 - Order Workflow Engine (Dev Plan)`

These likely need canonical `README.md` plus pack scaffolding, then selective linking to legacy PRDs instead of trying to force every existing file into the new pack shape.

### Naming Consistency Risk

Current names mix:

- underscored folders
- title-case folders
- folder names with spaces
- numbered PRD folders
- typo-prone names such as `setttings_feature_flags_plans_limits`

This makes indexing, lookup maintenance, and cross-linking harder than it needs to be.

## Recommended Cleanup Waves

### Wave 1: Fast Completion

Finish the three near-complete feature packs:

- `B2B_Feature`
- `Order_Service_Preferences`
- `orders_workflow_migration`

Expected outcome:

- `3` complete reference-quality packs
- immediate examples for future cleanup work
- reusable templates for deploy and testing guide content

### Wave 2: Establish Reusable Missing File Templates

Create reusable content patterns for the most consistently missing files:

- `testing_guide_and_scenarios.md`
- `deploy_guide.md`
- `developer_guide_mermaid.md`
- `user_guide_mermaid.md`
- `development_plan.md`

Expected outcome:

- lower friction for the rest of the migration
- better consistency across feature packs

### Wave 3: Upgrade Partial Active Domains

Bring these active-looking feature folders up to standard next:

- `007_admin_dashboard`
- `inventory_stock_management`
- `Order_Fin`
- `RBAC`

Expected outcome:

- better quality in visible, likely-maintained documentation
- broader examples across UI, finance, inventory, and access-control domains

### Wave 4: Canonicalization Pass

Before mass file generation, review overlapping or ambiguous domains and decide the canonical folder for:

- order lifecycle and intake
- payments and finance
- customer domains
- dashboard/admin domains
- settings/flags/plans domains

Expected outcome:

- fewer duplicate sources of truth
- safer future documentation generation

### Wave 5: Legacy PRD Conversion

For older PRD-heavy folders, do not start by writing every missing file blindly. Instead:

1. add or normalize `README.md`
2. define scope boundaries and canonical references
3. create `current_status.md` and `progress_summary.md`
4. add `developer_guide.md` and `user_guide.md` only after the canonical scope is clear

## Suggested Execution Order

1. Complete `B2B_Feature`
2. Complete `Order_Service_Preferences`
3. Complete `orders_workflow_migration`
4. Add baseline testing-guide and deploy-guide templates
5. Upgrade `Order_Fin`
6. Upgrade `RBAC`
7. Upgrade `007_admin_dashboard`
8. Run canonical-folder review for order-related feature folders
9. Upgrade PRD-heavy legacy folders in batches

## Candidate Follow-Up Tasks

- add `testing_guide_and_scenarios.md` to the three near-complete folders
- add `deploy_guide.md` to `orders_workflow_migration`
- create a feature-pack scaffold template under `docs/features/_templates/`
- normalize `docs/features/folders_lookup.md` so it tracks canonical feature packs rather than a small subset
- identify folders that should become aliases, archive entries, or cross-link stubs instead of full standalone packs

## Notes

- `_templates` was excluded from the main readiness counts because it is a support folder, not a feature folder.
- This audit checks pack-file presence only. It does not yet verify content quality, stale facts, broken links, or whether existing files reflect current code.
- The next audit pass should score content quality for Tier 1 and Tier 2 folders after the fast-completion wave is done.
