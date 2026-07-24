# CleanMateX Order Workflow V1 — Pre-Production Clean Break and Migration Governance

**Document ID:** CMX-OW-V1-PACK-000C  
**Version:** 1.0  
**Status:** Locked baseline

## 1. Decision

CleanMateX currently has no real customers. Current order and operational records are disposable test data. Order Workflow V1 shall therefore target the correct final architecture rather than permanently preserve obsolete workflow aliases and engines.

This decision does not authorize deleting the platform migration chain.

## 2. Migration governance

- Preserve migrations `0001` through `0405`.
- Continue the existing `NNNN_lowercase_snake_case.sql` convention.
- Add forward Workflow V1 migrations beginning with the next available number.
- Do not squash all platform migrations during this initiative.
- Preserve required platform catalogs, permissions, plans, currencies, settings, and HQ reference data.
- Reset only approved disposable transactional/demo data.
- Preserve schema, data, roles, migration history, reports, and a Git tag before destructive changes.

## 3. Clean V1 target

The final schema shall remove:

- `org_orders_mst.status`
- `org_orders_mst.current_status`, replaced by `operational_status`
- `org_orders_mst.current_stage`
- `org_orders_mst.preparation_status`, replaced by stage executions
- legacy order-item `status`
- independently writable piece `is_ready`
- Legacy and Enhanced transition RPCs
- the invalid `previous_status` assignment
- direct PATCH/bulk/batch status writers
- duplicate/deprecated status history triggers

## 4. Expand–change–contract

### Expand
Add new fields, tables, catalogs, constraints, RLS, indexes, functions, and reference data while legacy code still compiles.

### Change
Migrate backend, frontend, reports, public tracking, driver flows, tests, and generated types to the new contracts.

### Reset and verify
Reset disposable environments, replay all migrations, load deterministic seeds, and run all tests.

### Contract
Drop legacy objects only after static search, build, database tests, E2E tests, and rollback evidence show zero dependency.

## 5. Environment policy

| Environment | Data policy | Reset |
|---|---|---|
| Local | Disposable | Allowed after tag/backup |
| Automated test | Disposable | Recreated by CI |
| Staging | Disposable test data | Controlled full reset |
| Demo | Seeded demo data | Recreate deterministically |
| Production project | No customers, controlled | Explicit approved reset only |

## 6. Source-control safety

- Git tag: `pre-order-workflow-v1-clean-break`
- Archive branch: `archive/order-workflow-pre-v1`
- Export schema/data/roles/migration history
- Preserve current workflow reports
- Record CLI/PostgreSQL versions
- Record migration checksums

## 7. Final rule

Test data may be deleted. The existing 405 platform migrations remain. Workflow V1 ends with one workflow authority and no obsolete status aliases.
