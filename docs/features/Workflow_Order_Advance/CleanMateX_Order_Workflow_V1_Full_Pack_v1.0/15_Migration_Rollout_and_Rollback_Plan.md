# CleanMateX Order Workflow V1 — Migration, Rollout, and Rollback Plan

**Document ID:** CMX-OW-V1-PACK-015  
**Version:** 1.0  
**Status:** Deployment specification

## 1. Context

No real customers exist; transactions are disposable. The full migration chain covers many modules and remains preserved.

## 2. Pre-work

Git tag/archive branch, database backups, replay baseline, schema/reference-data inventory, code reader/writer inventory, report preservation, environment/reset approvals.

## 3. Phases

### Phase 0 — Discovery
Verify latest migration, replay current chain, classify data, inventory dependencies/integrations.

### Phase 1 — Expand
Apply 0406–0419; old fields remain.

### Phase 2 — Source cutover
Facade, APIs, UI, work groups, stages, outsourcing, releases, driver flows, reports, tracking, types/tests.

### Phase 3 — Reset
Reset approved local/test/staging/demo data and seed deterministically.

### Phase 4 — Verify
Replay, builds, tests, performance, security, manual QA, RTL.

### Phase 5 — Contract
Apply 0420 and remove old code/objects.

### Phase 6 — Baseline release
Tag and enable approved profiles.

## 4. Data classification

Platform reference, HQ configuration, tenant configuration, transactional, audit, test-only, external integration. Delete only approved disposable classes.

## 5. Reset

Use dependency-aware reviewed script or full database reset. Do not randomly truncate tables. Recreate demo data from seeds.

## 6. Code search

Classify and eliminate:

```text
status
current_status
current_stage
preparation_status
physical_intake_status
item_status
item_stage
piece_status
piece_stage
is_ready
previous_status
cmx_order_transition
cmx_ord_execute_transition
```

## 7. Rollback before contract

Disable V1 feature flag and restore prior application while old fields still exist.

## 8. Rollback after contract

Restore pre-contract backup or recreate at prior tag/migration. Roll back app and DB together. Do not recreate legacy fields ad hoc.

## 9. Feature flags

- workflow_v1_enabled
- workflow_v1_hq_config_enabled
- workflow_v1_outsourcing_enabled
- workflow_v1_partial_fulfilment_enabled
- workflow_v1_pickup_enabled

Flags manage rollout, not permanent engine forks.

## 10. Deployment order

Database expand, compatible backend, HQ config, tenant UI, driver app, reference/seed, tests, reset, contract, cleanup.

## 11. Monitoring

Command failures, conflicts, drift, outbox lag, release conflicts, outsourcing reconciliation, RLS denials, 5xx, and queue latency.

## 12. Approval

Product, architecture, database, security, QA, operations. For solo development, store explicit checklist evidence in repo.

## 13. Acceptance criteria

Environments reproducible, reset documented, migration chain preserved, rollback proven, no old writer remains, observability active.
