# CleanMateX Configurable Order Workflow V1 — Work Packages and Delivery Plan

**Document ID:** CMX-OW-V1-PACK-016  
**Status:** Initial plan

## WP-00 Production discovery

- Measure `status` / `current_status` drift.
- Identify production workflow flags.
- Identify template assignments.
- Identify all direct workflow writers.
- Verify custom tenant roles and permissions.
- Record delivery-in-progress and ready-with-balance cases.

Exit: production facts are known and approved.

## WP-01 Unified facade

- Define command/result contracts.
- Add idempotency and concurrency.
- Add tenant and permission checks.
- Add legacy/enhanced adapters.
- Add structured telemetry.
- Preserve current behavior.

Exit: facade works without cutover.

## WP-02 Caller migration

- Preparation
- Processing
- Assembly
- QA
- Packing
- Ready
- Delivery POD
- Cancel/return
- Direct PATCH
- Bulk update
- Batch auto-ready
- Item auto-ready

Exit: all state writers route through facade.


## WP-03 Multidimensional state foundation and compatibility

- Add canonical code catalogs for commercial, operational, fulfilment, exception, custody, and customer milestones.
- Add `operational_status` as the target field; mirror `current_status` only during cutover.
- Expose `operational_status` in new domain/API contracts.
- Add `commercial_status`.
- Add `fulfilment_status`.
- Add `exception_status`.
- Add `custody_summary_status`.
- Add workflow-version reference.
- Temporarily mirror legacy `status` only until all readers are migrated.
- Define contextual compatibility mappings.
- Do not globally map ambiguous `completed`.
- Add drift and unsupported-combination diagnostics.
- Add projection rebuild capability.

Exit: each order-level dimension has one owner, one catalog, one migration rule, and tested compatibility.

## WP-03A Work-group and detailed state ownership

- Introduce/normalize workflow instance and work-group state.
- Move detailed current stage ownership to work groups.
- Define item and piece state catalogs.
- Define QA state.
- Define release-line state.
- Define outsource-line state.
- Treat `current_stage` as temporary compatibility projection.
- Add mixed-service aggregation.

Exit: detailed execution no longer depends on one order-level stage.

## WP-03B Aggregation and closure policies

- Implement deterministic operational aggregation.
- Implement fulfilment aggregation.
- Implement exception priority aggregation.
- Implement custody aggregation.
- Implement commercial completion and closure evaluation.
- Implement customer milestone projection.
- Add rebuild jobs/commands and drift telemetry.
- Prevent clients from authoring projections.

Exit: all order summary states are rebuildable and consistent with authoritative records.

## WP-04 Workflow definitions and versions

- Stage type catalog.
- Definitions.
- Versions.
- Stages.
- Transitions.
- Assignments.
- Snapshots.
- Publish/retire rules.

Exit: immutable published workflows work for new orders.

## WP-04A Configuration governance

- Define HQ author, reviewer, approver, and publisher permissions.
- Define tenant read-only workflow visibility.
- Define optional HQ-approved tenant profile selection.
- Define change-request flow.
- Remove tenant workflow authoring and publishing paths.

Exit: configuration ownership is enforced at API, service, UI, and database layers.

## WP-05 HQ presets, assignment, and inheritance

- Simple
- Standard
- Quality Controlled
- Outsourcing Enabled
- Pickup and Delivery
- HQ-managed tenant/service/branch profile resolution

Exit: effective workflow resolution is deterministic.

## WP-06 Conditional rule engine

- Supported fields/operators.
- Priority.
- Default route.
- Validation.
- Simulation.
- Trace output.

Exit: deterministic rules pass unit/property tests.

## WP-07 Available actions

- Backend action resolver.
- Blockers.
- Required fields.
- Permission metadata.
- UI rendering.

Exit: screens no longer calculate authoritative next states.

## WP-08 HQ Platform configuration UI

- HQ guided setup.
- Preset and assignment management.
- Stage settings.
- Rule builder.
- Preview.
- Validation.
- Test mode.
- Publish.
- Version history.

Exit: authorized HQ users can configure, approve, assign, and publish safely; tenant users require no workflow setup.

## WP-09 Outsourcing

- Vendor master.
- Job master/detail.
- Custody events.
- Send/receive.
- Reconciliation.
- Internal QA.
- Costs.
- Notifications.

Exit: selected pieces can leave and return without custody ambiguity.

## WP-10 Releases and partial fulfilment

- Release master/detail.
- Eligibility.
- Selected items/pieces.
- Partial/full summary.
- Duplicate-release prevention.
- Handover evidence.

Exit: multiple releases from one order are safe.

## WP-11 Customer collection

- Recipient verification.
- Payment/release gate.
- Item/piece/package selection.
- Proof of handover.
- Partial collection.

Exit: collection is distinct from delivery.

## WP-12 Delivery integration

- Route/stop integration.
- Dispatch release.
- POD.
- Failed attempts.
- Return to branch.
- Partial delivery.
- Facade transition.

Exit: delivery and order fulfilment remain consistent.

## WP-13 Pickup option

- Request.
- Slot.
- Driver assignment.
- Pickup evidence.
- Branch receipt.
- Custody events.

Exit: optional pickup preset is operational.

## WP-14 Security and audit

- Permission catalog.
- Platform workflow-authoring roles.
- Tenant operational custom roles.
- RLS.
- audit.
- overrides.
- sensitive-action reasons.

Exit: security and tenant isolation tests pass.

## WP-15 Test and rollout

- Unit
- SQL
- RLS
- API
- Playwright
- RTL
- concurrency
- idempotency
- multidimensional projection rebuild and drift tests
- mixed-service aggregation tests
- partial fulfilment aggregation tests
- custody and exception aggregation tests
- shadow comparison
- pilot tenant
- rollback

Exit: production readiness checklist signed off.


## WP-16 Documentation and handoff

- Finalize PACK-000 through PACK-020.
- Link requirements to design, migrations, APIs, UI, and tests.
- Add implementation evidence, generated OpenAPI, migration replay evidence, screenshots, and QA reports.
- Finalize the operations runbook.

Exit: repository contains a complete authoritative implementation record.
