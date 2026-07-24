# CleanMateX Configurable Order Workflow V1 — Architecture Decision and Strategy Pack

**Document ID:** CMX-OW-V1-PACK-002  
**Version:** 1.0 Draft  
**Status:** Architecture baseline  
**Scope:** Workflow state ownership, migration compatibility, aggregation, configuration, and execution strategy

---

## 1. Purpose

This document locks the principal architecture decisions required before database, API, service, UI, and migration implementation.

The central decision is that an order does not have one complete status. Its business state is multidimensional. A single field may be used as a simple projection for lists and backward compatibility, but it must not become the source of truth for finance, fulfilment, custody, outsourcing, issues, or detailed operational execution.

---

## 2. Decision summary

| Decision | Selected approach |
|---|---|
| Permanent workflow entry point | `OrderWorkflowFacade` |
| Complete order state | Multidimensional |
| Operational summary physical field during migration | Existing `current_status` |
| API/domain name for that meaning | `operational_status` |
| Legacy `status` | Temporary compatibility alias, dual-written |
| Legacy `current_stage` | Temporary compatibility projection; not permanent detailed truth |
| Commercial state | Dedicated `commercial_status` |
| Fulfilment summary | Dedicated `fulfilment_status` |
| Exception summary | Dedicated `exception_status` |
| Custody summary | Dedicated `custody_summary_status` |
| Payment and invoice truth | Order Fin domain |
| Detailed operational truth | Workflow instance/work group, then item and piece |
| Outsourcing truth | Outsource job and lines |
| Release/partial fulfilment truth | Release master and lines |
| Delivery/pickup truth | Delivery/pickup domain records |
| Issue/hold/approval truth | Dedicated domain records |
| Customer-visible status | Derived milestone projection |
| Status literals | Stable lowercase `snake_case` codes |
| Configuration ownership | HQ Platform |
| Tenant configuration | Read-only or very limited HQ-approved choices |
| Published workflow version | Immutable |
| Active-order behavior | Bound to its resolved workflow snapshot/version |
| Aggregation | Deterministic, server-side, centrally tested |
| Direct status writes | Prohibited after facade migration |

---

## 3. ADR-OW-001 — Multidimensional order state

### Context

The existing system uses overlapping order-level fields such as `status`, `current_status`, and `current_stage`. It also maintains item, piece, delivery, payment, and issue states. One field cannot accurately describe mixed-service work, partial fulfilment, outsourcing, payment, custody, and exceptions.

### Decision

The canonical order state consists of these dimensions:

- `commercial_status`
- `operational_status`
- `fulfilment_status`
- `exception_status`
- `custody_summary_status`
- `payment_status` from Order Fin
- `invoice_status` from Order Fin

The dimensions answer different questions and shall not be merged into a combinatorial enum.

### Consequences

- Order lists can remain simple.
- Business rules become explicit.
- Mixed-service and partial-fulfilment orders are representable.
- More projection and aggregation logic is required.
- State ownership must be documented and tested.

---

## 4. ADR-OW-002 — Meaning of `current_status`

### Context

`current_status` is widely read by the current UI and APIs. Replacing or renaming it immediately would increase migration risk.

### Decision

For V1 migration:

- During expand/change, `current_status` may temporarily mirror the canonical order-level operational summary. The final physical/domain/API field is `operational_status`.
- Domain services and new APIs expose its meaning as `operational_status`.
- The old `status` column remains a temporary compatibility alias and is dual-written.
- `current_status` is not the full order state.
- After all legacy readers are removed, the contract migration removes `current_status`; no permanent legacy alias remains.

### Prohibited interpretation

`current_status` shall not be used as the source of truth for:

- Commercial closure.
- Payment.
- Invoice.
- Fulfilment.
- Custody.
- Outsourcing.
- Delivery/pickup details.
- Issues, holds, or approvals.

---

## 5. ADR-OW-003 — Commercial lifecycle

### Decision

`commercial_status` represents the overall business lifecycle:

- `draft`
- `pending_confirmation`
- `confirmed`
- `in_progress`
- `completed`
- `cancelled`
- `voided`
- `closed`

### Meaning

- `completed` means the service and fulfilment obligations are complete.
- `closed` means the order no longer has open operational, fulfilment, financial, issue, return, or dispute obligations according to closure policy.
- `voided` is reserved for invalid or erroneous transactions.
- `cancelled` means a valid order was stopped through a controlled cancellation flow.

Commercial status shall normally be derived or changed through controlled commands, never by arbitrary UI selection.

---

## 6. ADR-OW-004 — Operational summary and detailed stage

### Decision

Order-level `operational_status` values:

- `not_started`
- `preparing`
- `processing`
- `partially_ready`
- `ready`
- `operationally_completed`

Detailed current stage belongs to:

1. Workflow instance/work group.
2. Item where needed.
3. Piece where piece tracking is enabled.

### Rationale

A mixed order may simultaneously contain:

- A laundry work group at QA.
- A carpet work group at an outsourcing vendor.
- A tailoring work group in Processing.
- Already released pieces.

The order summary may remain `processing` or become `partially_ready`, while detailed records preserve the actual stages.

---

## 7. ADR-OW-005 — Fulfilment and release

### Decision

Order-level `fulfilment_status` values:

- `not_fulfilled`
- `partially_fulfilled`
- `fully_fulfilled`

Detailed fulfilment state belongs to release, collection, delivery, and pickup records.

Partial fulfilment is implemented by release records, not by changing the order into multiple commercial child orders.

Split orders remain available for genuinely separate commitments.

---

## 8. ADR-OW-006 — Exceptions, holds, and approvals

### Decision

Order-level `exception_status` values:

- `normal`
- `needs_attention`
- `blocked`
- `on_hold`

Detailed reason and lifecycle belong to:

- Issue records.
- Hold records.
- Approval records.
- Delivery exception records.
- Outsourcing exception records.

Exception type and exception status must remain separate.

---

## 9. ADR-OW-007 — Custody

### Decision

Order-level `custody_summary_status` values:

- `not_received`
- `customer`
- `driver`
- `branch`
- `plant`
- `vendor`
- `release_staging`
- `mixed`
- `released`
- `unknown`

Detailed custody is event-based and piece/package scoped.

The summary is derived from outstanding required physical content.

---

## 10. ADR-OW-008 — Finance ownership

### Decision

Workflow does not redefine or independently calculate payment or invoice status.

- `payment_status` is imported from the canonical Order Fin state.
- `invoice_status` is imported from the canonical Order Fin state.
- Workflow calls a release-policy service to determine whether physical release is allowed.
- Operational Ready and financial release eligibility remain separate.

### Example

An order may have:

- `operational_status = ready`
- `fulfilment_status = not_fulfilled`
- `payment_status = pending`
- release decision = `payment_required`

---

## 11. ADR-OW-009 — HQ-controlled workflow configuration

### Decision

Workflow definitions, versions, stages, transitions, conditions, and assignments are authored and published at HQ Platform level.

Tenant setup is not required.

Tenants may only receive:

- Read-only profile/version details.
- A limited HQ-approved selector when enabled.
- Non-structural preferences.
- Workflow change requests.

---

## 12. ADR-OW-010 — Workflow version and snapshot

### Decision

Every order or work group binds to an immutable HQ-published workflow version.

The runtime resolution records sufficient snapshot information to ensure future HQ changes do not alter active-order behavior.

The exact storage model will be finalized in PACK-006, but it must preserve:

- Definition ID.
- Version ID.
- Effective assignment source.
- Resolved stage/transition semantics.
- Gate policy references.
- Customer milestone mapping.
- Rule version.

---

## 13. ADR-OW-011 — Work groups

### Decision

Mixed-service orders use work groups.

A work group contains compatible items/pieces that share:

- Workflow version.
- Current detailed stage.
- Operational route.
- Processing location.
- Outsourcing behavior.
- SLA policy where enabled.

Order-level summaries are derived from work-group progress.

---

## 14. ADR-OW-012 — Deterministic aggregation

### Decision

All order summary fields are produced through one server-side aggregation service or equivalent transactional projection mechanism.

Aggregation must be:

- Deterministic.
- Tenant-scoped.
- Idempotent.
- Rebuildable from authoritative records.
- Covered by unit and integration tests.
- Invoked after relevant state changes.
- Protected from client-authored values.

The client may display projections but may not calculate or submit authoritative summary states.

---

## 15. ADR-OW-013 — Customer milestones

### Decision

Customer-facing status is a derived milestone projection with a small controlled catalog:

- `order_received`
- `cleaning_in_progress`
- `final_checks`
- `ready`
- `partially_completed`
- `out_for_delivery`
- `completed`
- `needs_attention`

Customer milestones do not replace internal state and are not used to authorize transitions.

---

## 16. ADR-OW-014 — Stable status codes

### Decision

All persisted status codes use lowercase `snake_case`.

Display labels are localized separately.

Codes shall not be renamed in place after release. A compatibility map and migration are required.

No tenant-defined free-text status code is allowed.

---

## 17. ADR-OW-015 — One transition facade

### Decision

All business workflow actions use `OrderWorkflowFacade`.

The facade owns:

- Permission.
- Workflow version.
- Available-action validation.
- Conditional routing.
- Domain gates.
- Idempotency.
- Optimistic concurrency.
- Persistence.
- Projection refresh.
- History.
- Outbox.
- Compatibility dual-write during migration.

Callers submit action codes, not target status strings.

---

## 18. ADR-OW-016 — State transition and projection atomicity

### Decision

The authoritative domain transition, history write, outbox write, and directly dependent summary updates must be committed atomically where practical.

Where a projection is asynchronous:

- The authoritative record remains clear.
- Projection lag is observable.
- Rebuild/retry is supported.
- Authorization never relies only on stale asynchronous projection.
- UI clearly handles temporary refresh.

---

## 19. ADR-OW-017 — Closure policy

### Decision

Order closure is not a manual equivalent of delivery.

Commercial completion requires:

- Operational obligation completed.
- Fulfilment obligation completed.
- No unresolved customer service obligation.

Closure additionally requires:

- Financial closure policy satisfied.
- No blocking issue, claim, return, dispute, or approval.
- Required audit side effects completed.

The exact closure policy is centrally configurable at HQ within supported rules.

---

## 20. Migration strategy

### Stage 1

- Add and use `operational_status` as the target field.
- Temporarily mirror legacy fields only during source-code cutover.
- Continue existing readers through compatibility serializers.

### Stage 2

- Add commercial, fulfilment, exception, custody, and workflow-version fields.
- Backfill only from evidence-based rules.
- Introduce work groups and detailed state ownership.

### Stage 3

- Move all callers to the facade.
- Stop direct status writers.
- Introduce aggregation and drift monitoring.

### Stage 4

- Migrate APIs and UI to explicit multidimensional fields.
- Retire `current_stage` as detailed truth.
- Audit remaining `status` readers.

### Stage 5

- Drop `status`, `current_status`, `current_stage`, legacy functions, and duplicate triggers after zero-reader criteria are met.

---

## 21. Architecture invariants

1. No single status represents the complete order state.
2. Every persisted status has one documented owner.
3. Summary fields are projections, not substitutes for detailed records.
4. Clients cannot author summary status values.
5. A piece cannot be in two active releases.
6. A piece cannot be in two active outsource jobs.
7. Operational Ready does not imply release eligibility.
8. Fulfilment does not imply financial closure.
9. Post-delivery issues do not erase original fulfilment.
10. Published workflow versions are immutable.
11. HQ owns workflow configuration.
12. Tenant isolation applies to every runtime record.
13. Every sensitive override is permissioned and audited.
14. Every action is idempotent or explicitly non-repeatable.
15. Every transition is traceable to an action and actor.

---

## 22. Required downstream alignment

PACK-003 through PACK-020 must use this state architecture.

Any document proposing one generic order status as the complete state is invalid unless it explicitly refers to a UI projection only.
