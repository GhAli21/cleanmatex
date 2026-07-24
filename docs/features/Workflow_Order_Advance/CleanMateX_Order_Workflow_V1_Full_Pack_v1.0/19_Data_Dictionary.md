# CleanMateX Order Workflow V1 — Data Dictionary

**Document ID:** CMX-OW-V1-PACK-019  
**Version:** 1.0  
**Status:** Logical dictionary

## 1. Order summaries

| Field | Required | Owner | Meaning |
|---|---:|---|---|
| commercial_status | Yes | Order | Business lifecycle |
| operational_status | Yes | Aggregator | Production summary |
| fulfilment_status | Yes | Releases | Fulfilment summary |
| exception_status | Yes | Exceptions | Attention/blocker |
| custody_summary_status | Yes | Custody | Outstanding custody |
| payment_status | Yes | Order Fin | Payment |
| invoice_status | Yes | Order Fin | Invoice |
| workflow_definition_id | After confirmation | Workflow | Definition |
| workflow_version_id | After confirmation | Workflow | Immutable version |
| customer_milestone_code | Optional | Projection | Customer status |
| state_version | Yes | Workflow | Concurrency |

## 2. Workflow definition/version

Definition: id, code, English/Arabic name, description, status, system flag, audit.

Version: id, definition, version number, lifecycle status, effective date, publish actor/time, content hash, audit.

Stage: version, stage type, sequence, labels, required/skippable, permission, milestone, SLA, gates.

Transition: version, from stage, action, to stage, priority, default, type.

## 3. Runtime

Instance: tenant/order, definition/version, instance status, assignment, snapshot JSONB, state version.

Work group: tenant/order/instance, code/type, current stage, progress, processing branch/location, state version.

Stage execution: tenant/order/group, stage, attempt, execution status, start/complete actors/times, skip/failure reasons, metadata.

## 4. Outsourcing

Vendor: tenant, code, labels, contacts, services, active, turnaround, currency, notes.

Job: tenant/order/group/vendor, status, return date, costs/currency, reference, custody, audit.

Line: job, item/piece, quantity, vendor service, status, discrepancy.

## 5. Release

Master: tenant/order, number, type, status, recipient/driver, finance decision, value/currency, verification/POD, timestamps.

Line: release, item/piece, quantity, optional package, line status, value snapshot.

Attempt: release, number, status, failure reason, evidence, driver/time/location.

## 6. Custody

Tenant/order/item/piece/package, from/to party/location, quantity, type, actor/time, evidence, discrepancy, correlation.

## 7. Hold

Scope, reason, status, blocking flag, owner, start/resolve, SLA pause, notes/evidence.

## 8. Approval

Type, status, requester/decision actors/times, reason, expiry, related entity/action.

## 9. Idempotency

Command, tenant, action, key hash, payload hash, status, result, timestamps, correlation.

## 10. History

Tenant/order/group, action, entity, previous/new facts, version, actor/source, reason, approval, correlation/idempotency, time.

## 11. Conventions

Lowercase snake_case codes, UUID IDs, timestamptz time, approved numeric money precision, audit fields, and tenant_org_id for runtime tables.

## 12. Deprecated final removals

Order status/current_status/current_stage/preparation_status, item generic status, writable piece is_ready, and nonexistent/invalid previous_status usage.
