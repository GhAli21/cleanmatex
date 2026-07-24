# CleanMateX Order Workflow V1 — Database and Migration Specification

**Document ID:** CMX-OW-V1-PACK-006  
**Version:** 1.0  
**Status:** Implementation specification  
**Current latest migration:** `0405_fix_cmx_ord_order_live_metrics_qty.sql`

## 1. Strategy

Preserve migrations `0001`–`0405`. Add forward migrations. The exact next prefix must be checked at merge time.

## 2. Planned sequence

```text
0406_order_workflow_v1_state_catalogs.sql
0407_order_workflow_v1_order_summary_fields.sql
0408_order_workflow_v1_hq_definitions.sql
0409_order_workflow_v1_runtime_core.sql
0410_order_workflow_v1_work_groups_stage_executions.sql
0411_order_workflow_v1_conditional_transitions.sql
0412_order_workflow_v1_outsourcing.sql
0413_order_workflow_v1_releases_partial_fulfilment.sql
0414_order_workflow_v1_custody_holds_approvals.sql
0415_order_workflow_v1_permissions_rls.sql
0416_order_workflow_v1_constraints_indexes.sql
0417_order_workflow_v1_hq_reference_data.sql
0418_order_workflow_v1_facade_functions.sql
0419_order_workflow_v1_projection_rebuild.sql
0420_order_workflow_v1_remove_legacy_objects.sql
```

## 3. Status storage

- Lowercase snake_case persisted codes
- Text + CHECK for fixed technical states
- Foreign keys for HQ stage/action/condition catalogs
- No tenant free-text status codes
- Avoid PostgreSQL enums for evolving catalogs

## 4. Order summary fields

Add:

```text
commercial_status
operational_status
fulfilment_status
exception_status
custody_summary_status
customer_milestone_code
workflow_definition_id
workflow_version_id
state_version
```

Payment and invoice remain Order Fin-owned.

Legacy columns coexist only during expand/change.

## 5. HQ tables

Logical objects:

- sys_workflow_definitions_mst
- sys_workflow_versions_mst
- sys_workflow_stages_dtl
- sys_workflow_transitions_dtl
- sys_workflow_transition_rules_dtl
- sys_workflow_rule_conditions_dtl
- sys_workflow_gate_rules_dtl
- sys_workflow_assignments_mst
- sys_workflow_customer_milestones_dtl
- stage/action/condition/operator catalogs

Check collisions against the existing schema before final naming.

## 6. Runtime tables

- org_order_workflow_instances_mst
- org_order_work_groups_mst
- org_order_work_group_items_dtl
- org_order_stage_executions_tr
- org_order_transition_commands_tr
- canonical org_order_history
- central outbox

Workflow instance stores tenant/order, definition/version, status, resolved assignment, immutable snapshot JSONB, state version, and audit.

Work group stores tenant/order/instance, group code/type, current stage, progress, processing branch/location, state version, and audit.

Stage execution stores stage, attempt, execution status, start/completion users/times, skip/failure reasons, and metadata.

## 7. Outsourcing tables

- org_outsource_vendors_mst
- org_outsource_jobs_mst
- org_outsource_job_items_dtl
- org_outsource_job_history_tr

Prevent overlapping active outsource assignment for the same piece.

## 8. Release tables

- org_order_releases_mst
- org_order_release_items_dtl
- org_order_release_attempts_tr
- org_order_release_history_tr

Support piece, item quantity, optional package, collection, delivery, and B2B handover. Prevent overlapping active release assignments.

## 9. Custody/holds/approvals

- org_order_custody_events_tr
- org_order_holds_tr
- org_order_approvals_tr

Custody is append-only and records from/to party/location, scope, quantity, actor, evidence, discrepancy, correlation, and time.

## 10. Tenant consistency

Every org runtime table has `tenant_org_id`, RLS, audit fields, and tenant-consistent foreign keys. Prefer composite `(tenant_org_id,id)` references where practical.

## 11. RLS

- Tenant users see only their tenant.
- Branch restrictions apply where needed.
- HQ drafts/config writes are platform-only.
- Tenants may read assigned published workflow content.
- Support access is explicit and audited.

## 12. Constraints

- Valid status checks
- Published-version immutability
- Assignment overlap prohibition
- Default transition uniqueness
- Priority uniqueness
- No release over outstanding quantity
- No overlapping active piece release/outsource jobs
- Required evidence before delivery completion
- Closed order cannot have blocking holds
- Non-negative state version

## 13. Indexes

Orders:

- tenant, branch, operational status, updated
- tenant, fulfilment status, updated
- tenant, exception status, updated
- tenant, customer, created

Work groups:

- tenant, current stage, progress
- tenant, order

Outsourcing:

- tenant, vendor, status, expected return

Releases:

- tenant, order, status
- tenant, type, status, created

History:

- tenant, order, occurred desc
- correlation ID
- idempotency key

## 14. JSONB

Allowed for immutable snapshots, rule traces, evidence metadata, and extensible non-authoritative data. Core statuses, amounts, ownership, and relationships remain typed columns.

## 15. Reference data

`0417` seeds status codes, stage/action catalogs, conditions/operators, permissions, milestones, reason codes, gate types, and HQ presets using idempotent upserts.

## 16. Projection rebuild

Provide scoped rebuild for operational, fulfilment, exception, custody, milestone, and commercial completion/closure. Never cross tenants.

## 17. Contract migration gate

Before `0420`:

- Static search zero dependencies
- Prisma/schema types updated
- Backend/frontend/driver builds pass
- Public tracking/reports migrated
- DB reset replay passes
- RLS/API/E2E pass
- Backup and rollback evidence exist

Drop old status/current_status/current_stage/preparation_status, legacy item status, writable is_ready, Legacy/Enhanced RPCs, invalid previous_status SQL, duplicate history triggers, and obsolete indexes.

## 18. CI replay

```text
empty DB
→ 0001–0405
→ 0406–0420
→ reference data
→ deterministic seeds
→ schema/RLS tests
→ generated types
→ builds
→ integration/E2E
```

## 19. Acceptance criteria

- Empty replay succeeds.
- Historical migrations remain.
- Every org table has RLS.
- Reference data is deterministic.
- Legacy objects drop only after zero dependency.
- Duplicate release/outsource assignment is impossible.
- Projections can be rebuilt.
