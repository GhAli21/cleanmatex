# CleanMateX Configurable Order Workflow V1 — Product Requirements Document

**Document ID:** CMX-OW-V1-PACK-001  
**Version:** 1.0 Draft  
**Status:** Product baseline for architecture and implementation  
**Product:** CleanMateX Laundry Management System  
**Language:** English, with Arabic/RTL requirements included  
**Audience:** Product owner, business analyst, architect, database designer, frontend/backend developers, QA, support, AI coding assistants

---

## 1. Document purpose

This PRD defines the complete business and product requirements for CleanMateX Configurable Order Workflow V1.

It establishes:

- What the product must support.
- How laundries configure workflow without technical complexity.
- How daily staff execute work through simple actions.
- How workflow changes remain safe for active orders.
- How conditional transitions operate.
- How outsourcing is controlled.
- How partial fulfilment is handled.
- How collection, delivery, payment, issues, and audit integrate.
- What constitutes production readiness.

This document describes the required product behavior. Technical schemas, APIs, database migrations, and implementation details are specified in later pack documents.

---

## 2. Product vision

CleanMateX shall provide one configurable Order Workflow platform that can support:

- A small counter-based laundry.
- A growing multi-branch laundry.
- A quality-controlled dry cleaner.
- A pickup-and-delivery operation.
- A central plant.
- A business outsourcing specialist services.
- A B2B laundry serving hotels, restaurants, hospitals, uniforms, and corporate customers.

The platform must remain simple during daily use.

The internal system may handle workflow versions, transition conditions, release records, custody, financial gates, and audit trails, but staff should mainly see:

- What needs attention.
- What action to perform.
- What is blocked.
- What happens next.

---

## 3. Background and current-state context

The current CleanMateX implementation already contains substantial workflow functionality, including:

- New Order creation.
- Quick Drop.
- Preparation.
- Processing.
- Item and piece tracking.
- Assembly.
- Quality Assurance.
- Packing.
- Ready.
- Rack assignment.
- Split orders.
- Issues and rework.
- Delivery routes.
- OTP and proof of delivery.
- Customer handover.
- Payments, invoices, refunds, and pay-on-collection.
- Cancellation and customer return.
- Order history.

The current implementation also contains structural risks:

- Legacy and Enhanced workflow engines coexist.
- Some callers bypass both engines.
- `status`, `current_status`, and `current_stage` can drift.
- UI screens duplicate next-stage logic.
- Payment release checks can be UI-only.
- Delivery and customer collection can end in the same status.
- Partial fulfilment is not a complete runtime capability.
- Pickup, outsourcing, packages, holds, and advanced fulfilment are incomplete or absent.

V1 shall improve and consolidate the existing implementation rather than rebuild the product from zero.

---

## 4. Product objectives

### 4.1 Primary objectives

1. Provide one authoritative workflow transition entry point.
2. Preserve existing operational capabilities.
3. Make workflow configurable through presets and guided settings.
4. Keep operator screens simple and action-oriented.
5. Support deterministic conditional transitions.
6. Support outsourcing of selected items or pieces.
7. Support multiple releases and partial fulfilment.
8. Separate operational readiness from financial and physical release.
9. Preserve tenant isolation, auditability, and financial correctness.
10. Allow safe migration of active orders.
11. Support English and Arabic/RTL from V1.
12. Provide production-grade testing, rollout, monitoring, and rollback.

### 4.2 Business objectives

- Reduce manual status mistakes.
- Reduce missed or lost pieces.
- Reduce incorrect handover.
- Support more laundry operating models without custom code.
- Allow small laundries to start with a simple preset.
- Allow larger laundries to enable advanced stages.
- Improve staff training and speed.
- Improve order visibility for customers and managers.
- Support future plan-based workflow features.

---

## 5. Product principles

### 5.1 Simple business interface

The daily interface shall:

- Present one primary action per screen.
- Hide disabled or irrelevant stages.
- Show blockers only when they exist.
- Avoid technical status codes.
- Avoid arbitrary status dropdowns for normal staff.
- Use plain business language.
- Provide clear English and Arabic labels.

### 5.2 HQ-controlled configurability

Workflow authoring and publishing shall be controlled at CleanMateX HQ Platform level.

HQ shall own:

- The supported stage catalog.
- System workflow presets.
- Workflow definitions and immutable versions.
- Allowed transitions.
- Conditional rules.
- Readiness and release-policy templates.
- Customer milestone mappings.
- Plan and market availability.
- Assignment of approved workflow profiles to tenants, services, and branches.

Tenant workflow setup shall not be required for normal onboarding or daily operation.

V1 shall not provide tenants with a workflow designer, transition-rule editor, stage reordering, workflow publishing, or arbitrary workflow overrides.

Where HQ enables limited tenant choice, the tenant may only:

- View the currently assigned workflow profile and version.
- Select from a small HQ-approved list when permitted by plan and policy.
- Request a workflow-profile change from HQ.
- Change non-structural operational preferences explicitly exposed by HQ.
- Manage normal tenant business records such as vendors, staff, branches, and service data.

Neither HQ nor tenants may provide arbitrary SQL, JavaScript, executable scripts, unsupported status values, direct database updates, or uncontrolled financial and audit logic.

### 5.3 One workflow authority

All runtime workflow actions shall pass through one workflow facade.

No new direct state writer shall be introduced.

### 5.4 Immutable published versions

Once published, a workflow version shall not be edited.

Configuration changes shall create a new version.

Existing orders shall continue using their assigned version unless an explicitly authorized migration occurs.

### 5.5 Operational truth separated from release truth

An order may be operationally Ready while:

- Payment remains due.
- Customer collection is pending.
- Delivery is not scheduled.
- One release was completed and another remains.
- A manager approval is required.

### 5.6 Evidence and audit

Every significant workflow action shall identify:

- Tenant.
- Order.
- Actor.
- Action.
- Previous state.
- New state.
- Time.
- Source channel.
- Reason where required.
- Idempotency key.
- Correlation ID.
- Relevant payload.
- Override or approval evidence.

---

## 6. Personas and roles

### 6.1 Platform roles

- SaaS Super Admin
- HQ Workflow Product Administrator
- HQ Workflow Publisher
- SaaS Support
- SaaS Auditor

### 6.2 Tenant management roles

- Tenant Owner
- General Manager
- Branch Manager
- Operations Manager
- Finance Manager

### 6.3 Operational roles

- Receptionist
- Preparation Staff
- Processing Staff
- Assembly Staff
- QA Staff
- Packing Staff
- Dispatcher
- Driver
- Customer Service
- Outsourcing Coordinator
- Cashier

### 6.4 External actors

- Customer
- Authorized Customer Representative
- B2B Contact
- Outsourcing Vendor
- Marketplace
- Payment Gateway
- Messaging Provider

Role capabilities shall be permission-based rather than dependent only on role name.

---

## 7. Scope

### 7.1 In scope

- Workflow consolidation.
- HQ workflow presets.
- HQ workflow definitions and immutable versions.
- HQ-controlled stage enablement and ordering.
- HQ-managed tenant, service-category, service, and branch profile assignments.
- HQ-authored conditional transition rules.
- Backend available actions.
- Quick Drop.
- Mixed-service order routing.
- Item and piece execution.
- Assembly, QA, Packing, Ready.
- Holds and blockers.
- Outsourcing.
- Partial fulfilment.
- Customer collection.
- Driver delivery.
- Optional pickup.
- Proof of handover and POD.
- Payment/release policy.
- B2B release.
- Issues and rework.
- Cancellation and return.
- Audit, notifications, security, and migration.
- Configuration UI.
- Operational UI improvements.
- English and Arabic/RTL.

### 7.2 Out of scope for V1

- General-purpose BPMN engine.
- Free-form scripting.
- Arbitrary tenant-defined code.
- Vendor portal.
- Vendor mobile app.
- Procurement bidding.
- Multi-level subcontracting.
- Full supplier/AP automation.
- Machine automation.
- Full production batch optimization.
- Route-optimization engine replacement.
- Full accounting redesign.
- Fully visual node-canvas workflow designer.
- Complex AI workflow generation.
- Cross-company workflow federation.

---

## 8. Definitions

| Term | Definition |
|---|---|
| Workflow definition | Logical workflow identity such as Standard Laundry |
| Workflow version | Immutable published version of a workflow definition |
| Stage type | Platform-supported stage behavior such as QA or Packing |
| Stage | A configured occurrence of a stage type in a workflow version |
| Transition | Allowed movement from one stage to another through an action |
| Conditional transition | Transition selected by deterministic supported conditions |
| Action | Business command such as PASS_QA or MARK_READY |
| Work group | Subset of order items/pieces sharing one operational route |
| Workflow snapshot | Resolved version/configuration attached to an order or work group |
| Outsource job | Controlled external-processing job for selected items/pieces |
| Fulfilment | The process of collection or delivery to the customer |
| Release | A record of specific items/pieces leaving laundry custody |
| Partial fulfilment | Order with some, but not all, required items/pieces released |
| Ready gate | Operational validation required before Ready |
| Release gate | Validation required before physical handover or dispatch |
| Blocker | Condition preventing an action |
| Hold | Explicit suspension requiring resolution |
| Override | Authorized bypass requiring permission, reason, and audit |

---


## 9. Complete status architecture

### 9.1 Core rule

No single order-status field represents the complete business state.

The canonical order state contains separate dimensions:

- Commercial lifecycle.
- Operational summary.
- Fulfilment summary.
- Exception summary.
- Custody summary.
- Payment state from Order Fin.
- Invoice state from Order Fin.

Detailed execution state belongs to workflow instances/work groups, items, pieces, outsource jobs, releases, delivery/pickup records, issues, holds, and approvals.

### 9.2 Migration treatment of existing fields

- During expand/change, existing `current_status` may temporarily mirror the new operational summary.
- The final database, domain contracts, and APIs use `operational_status`.
- Existing `status` is temporary and removed in the contract migration.
- Existing `current_stage` remains temporary compatibility data and is not the permanent detailed-stage authority.
- No blind global mapping of ambiguous values such as `completed` is permitted.

### 9.3 Commercial status

Canonical values:

- `draft`
- `pending_confirmation`
- `confirmed`
- `in_progress`
- `completed`
- `cancelled`
- `voided`
- `closed`

Commercial `completed` and `closed` have different meanings.

### 9.4 Operational status

Canonical order-level summary values:

- `not_started`
- `preparing`
- `processing`
- `partially_ready`
- `ready`
- `operationally_completed`

The detailed current stage is stored on the active workflow instance/work group.

### 9.5 Fulfilment status

- `not_fulfilled`
- `partially_fulfilled`
- `fully_fulfilled`

Fulfilment is derived from release obligations and release lines.

### 9.6 Exception status

- `normal`
- `needs_attention`
- `blocked`
- `on_hold`

Detailed types and reasons remain in issue, hold, approval, outsourcing, and delivery records.

### 9.7 Custody summary status

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

Detailed custody is piece/package/event based.

### 9.8 Finance status

Payment and invoice statuses remain authoritative in Order Fin.

Workflow shall consume:

- Payment state.
- Invoice state.
- Release eligibility.
- Financial closure eligibility.

Workflow shall not independently calculate or redefine accounting status.

### 9.9 Detailed domain statuses

The complete catalogs for work groups, items, pieces, QA, outsourcing, releases, delivery, pickup, issues, holds, approvals, and workflow configuration are defined in CMX-OW-V1-PACK-003.

### 9.10 Visible work states

The daily UI shall remain simple and may display:

- Received.
- In Progress.
- Ready.
- Partially Completed.
- Completed.
- Cancelled.
- Needs Attention.

These are UI projections and localized labels, not the full canonical backend state.

### 9.11 Customer milestones

Controlled customer milestones:

- `order_received`
- `cleaning_in_progress`
- `final_checks`
- `ready`
- `partially_completed`
- `out_for_delivery`
- `completed`
- `needs_attention`

### 9.12 Aggregation

Order-level summaries shall be calculated server-side from authoritative domain records.

Clients shall not submit or calculate authoritative order summary statuses.

### 9.13 Required ownership

| Concern | Owner |
|---|---|
| Commercial lifecycle | Order |
| Operational summary | Aggregation of work groups/items/pieces |
| Detailed stage | Workflow instance/work group |
| Fulfilment | Releases |
| Custody | Custody events and physical units |
| Outsourcing | Outsource jobs |
| Payment and invoice | Order Fin |
| Exceptions | Issues, holds, approvals, and domain exceptions |
| Customer status | Milestone projection |

---

## 10. Workflow presets

### 10.1 Simple Laundry

Internal route:

`Intake → Processing → Ready → Collection/Delivery`

Intended for:

- Small laundries.
- Counter operations.
- Minimal stage separation.

### 10.2 Standard Laundry

`Intake → Preparation → Processing → Packing → Ready → Collection/Delivery`

### 10.3 Quality Controlled

`Intake → Preparation → Processing → Assembly → QA → Packing → Ready → Collection/Delivery`

### 10.4 Outsourcing Enabled

`Intake → Preparation → Processing → Conditional Outsourcing → QA → Packing → Ready → Collection/Delivery`

### 10.5 Pickup and Delivery

`Pickup → Intake → Preparation → Processing → Ready → Dispatch → Delivery`

### 10.6 Preset requirements

- Presets shall be authored, validated, published, and retired by CleanMateX HQ.
- Every tenant shall receive a default HQ-approved workflow profile during provisioning or onboarding.
- Tenant workflow setup shall not be required.
- HQ may assign a preset or a derived HQ-managed profile by tenant, service category, service, or branch.
- Tenants shall not clone presets, create workflow drafts, edit stages, author conditions, or publish versions.
- Where explicitly enabled, a tenant owner may select only from a small HQ-approved list without changing the preset definition.
- Presets shall include labels, permissions, gates, milestones, notifications, outsourcing behavior, and partial-fulfilment behavior.
- Optional stages and capabilities shall remain hidden when the assigned profile disables them.

---

## 11. HQ configuration hierarchy and runtime resolution

The effective workflow shall be resolved using:

1. HQ-supported stage, action, condition, and gate catalog.
2. HQ subscription-plan and market availability.
3. HQ-assigned tenant operating profile.
4. HQ-managed service-category assignment.
5. HQ-managed service-specific assignment.
6. HQ-managed branch assignment.
7. Order/work-group workflow snapshot.

### 11.1 Resolution requirements

- Resolution shall be deterministic and server-side.
- The system shall explain which HQ assignment won.
- Conflicting HQ assignments shall be rejected or explicitly resolved before publication.
- HQ administrators shall be able to preview the effective workflow for a tenant, branch, and service.
- Tenant managers may view the effective workflow but shall not edit its structure.
- An order shall store the resolved workflow version.
- Mixed-service orders may create separate work groups.
- Each work group may use a different HQ-published workflow version.
- Publishing a new version shall affect new orders only by default.
- Tenant onboarding shall work with the assigned default profile without any workflow configuration step.

---


## 11A. Workflow configuration governance

### 11A.1 HQ ownership

Only authorized CleanMateX HQ Platform roles may:

- Create workflow definitions.
- Clone workflow drafts.
- Add, remove, or reorder stages.
- Author conditional transitions.
- Configure gates and approval requirements.
- Publish, retire, or restore versions.
- Assign profiles to tenants, services, and branches.
- Change plan or market availability.

### 11A.2 Tenant boundaries

Tenant users shall not:

- Create workflow definitions.
- Edit transition graphs.
- Add custom stages.
- Author conditional rules.
- Publish versions.
- Change immutable workflow snapshots.
- Override platform-level financial, audit, security, or custody behavior.

### 11A.3 Limited optional tenant controls

HQ may optionally expose a small set of safe controls, such as:

- Select one of a limited list of HQ-approved operating profiles.
- Choose notification preferences.
- Choose supported customer milestone wording.
- Set ordinary operational defaults that do not change transition topology.
- Request HQ to change the assigned workflow profile.

These controls shall have safe defaults and shall not be required during onboarding.

### 11A.4 Tenant business data

Tenants continue to manage normal business data required to operate the assigned workflow, including:

- Staff and role assignments.
- Branches.
- Services and prices.
- Outsourcing vendors.
- Delivery zones and drivers.
- Rack/storage records.
- Customer and B2B data.

Managing these records does not grant permission to change the workflow engine or workflow graph.

---

## 12. Workflow lifecycle

### 12.1 Draft

An HQ workflow configuration may be edited by authorized platform users while in Draft.

### 12.2 Validation

Before publishing, the system shall validate:

- At least one start stage.
- At least one valid terminal path.
- No missing default conditional transition.
- No duplicate priority in one decision set.
- No transition to disabled stage.
- No unreachable enabled stage.
- No invalid loop.
- No terminal stage with normal outgoing transitions.
- Supported action codes only.
- Supported conditions and operators only.
- Required permission exists.
- Required translations exist.
- Required gate configuration is complete.
- Service/branch assignments reference a valid version.

### 12.3 Simulation

An authorized HQ workflow administrator shall be able to simulate scenarios before publishing.

Minimum scenarios:

- Normal order.
- Quick Drop.
- QA required.
- QA failure.
- Outsourcing required.
- Customer collection.
- Delivery.
- Outstanding payment.
- Partial fulfilment.
- Cancellation.

### 12.4 Publish

Publishing shall:

- Create an immutable version.
- Record actor and timestamp.
- Validate all requirements.
- Store effective date.
- Create audit history.
- Prevent in-place modification.

### 12.5 Retire

A published version may be retired for new assignments.

Active orders using it shall continue.

### 12.6 Rollback

Authorized HQ users may restore a prior published version as the assigned version for future orders.

Where HQ exposes a limited preset selector, tenant selection remains restricted to HQ-approved versions.

Rollback shall not automatically rewrite active orders.

---

## 13. Stage configuration requirements

Each configured stage shall support:

- Stage code.
- Stage type.
- English name.
- Arabic name.
- Sequence.
- Enabled state.
- Required/optional state.
- Customer-visible state.
- Customer milestone mapping.
- Required permission.
- Allowed roles.
- Require all pieces.
- Require all items.
- Require scan.
- Require rack/storage.
- Require QA result.
- Require reason on skip.
- Allow manager override.
- SLA minutes.
- Warning threshold.
- Notification triggers.
- Help text.
- Icon reference.
- Display order.

### 13.1 Stage ordering

- A stage may be reordered only when resulting transitions remain valid.
- The UI shall prevent invalid reorder.
- Sequence changes shall create a new draft/version.
- Published sequence shall be immutable.

### 13.2 Stage skipping

Skipping may be enabled only for supported stages.

A skip shall require:

- Permission.
- Reason.
- Optional manager approval.
- Audit entry.
- Clear next-stage resolution.

---

## 14. Canonical action catalog

Minimum V1 actions:

### Order creation and intake

- `CREATE_ORDER`
- `CONFIRM_ORDER`
- `CONFIRM_PHYSICAL_INTAKE`
- `START_PREPARATION`
- `COMPLETE_PREPARATION`

### Processing

- `START_PROCESSING`
- `COMPLETE_PROCESSING`
- `COMPLETE_ITEM_STEP`
- `COMPLETE_PIECE_STEP`

### Assembly and QA

- `START_ASSEMBLY`
- `COMPLETE_ASSEMBLY`
- `START_QA`
- `PASS_QA`
- `FAIL_QA`
- `APPROVE_QA_OVERRIDE`

### Packing and Ready

- `START_PACKING`
- `COMPLETE_PACKING`
- `ASSIGN_STORAGE`
- `MARK_READY`

### Outsourcing

- `REQUEST_OUTSOURCING`
- `APPROVE_OUTSOURCING`
- `SEND_TO_VENDOR`
- `CONFIRM_VENDOR_RECEIPT`
- `UPDATE_VENDOR_STATUS`
- `RECEIVE_FROM_VENDOR`
- `RECONCILE_VENDOR_RETURN`
- `COMPLETE_OUTSOURCE_QA`

### Fulfilment and release

- `CREATE_RELEASE`
- `VERIFY_RELEASE`
- `CONFIRM_COLLECTION`
- `DISPATCH_RELEASE`
- `MARK_OUT_FOR_DELIVERY`
- `CONFIRM_DELIVERY`
- `REPORT_DELIVERY_FAILURE`
- `RETURN_RELEASE_TO_BRANCH`

### Exceptions

- `REPORT_ISSUE`
- `PLACE_ON_HOLD`
- `RESUME_FROM_HOLD`
- `REQUEST_MANAGER_APPROVAL`
- `APPROVE_OVERRIDE`
- `REJECT_OVERRIDE`
- `RETURN_FOR_REWORK`

### Commercial outcomes

- `CANCEL_ORDER`
- `VOID_DRAFT`
- `CLOSE_ORDER`
- `CUSTOMER_RETURN`

Actions shall not be represented as arbitrary target status updates.

---

## 15. Conditional transition requirements

### 15.1 Supported fields

V1 shall support conditions on:

- Service category.
- Service code.
- Order type.
- Order subtype.
- Fulfilment method.
- Customer type.
- B2B status.
- Branch.
- Priority.
- Express/rush flag.
- Blocking issue.
- QA result.
- Outsourcing requirement.
- Payment status.
- Outstanding balance.
- All pieces ready.
- All pieces scanned.
- Manager approval.
- Work-group type.
- Vendor return result.

### 15.2 Supported operators

- Equals.
- Not equals.
- In.
- Not in.
- Greater than.
- Greater than or equal.
- Less than.
- Less than or equal.
- Is true.
- Is false.
- Exists.
- Not exists.

### 15.3 Rule evaluation

- Rules shall be evaluated in ascending priority.
- Exactly one default rule shall exist for each conditional decision set.
- Evaluation shall be deterministic.
- Evaluation shall return a trace suitable for audit and troubleshooting.
- Conditions shall be validated at publish time.
- Unsupported fields or operators shall be rejected.
- Free-form code shall not be accepted.

### 15.4 V1 logical grouping

V1 shall support:

- AND within one rule group.
- Multiple priority-ordered rule groups.
- One default transition.

Nested arbitrary expressions are excluded.

### 15.5 Example

From Processing:

1. If outsourcing required, go to Outsourcing.
2. Else if QA required, go to QA.
3. Else go to Packing.

### 15.6 Loop control

Loops shall be allowed only for explicit supported purposes, including:

- QA fail → Processing.
- Vendor return fail → Outsourcing or Processing.
- Delivery failure → Ready for Dispatch or Return to Branch.
- Manager-approved rework.

Unbounded loops shall be rejected.

---

## 16. Workflow facade requirements

The unified workflow facade shall:

1. Authenticate the caller.
2. Resolve tenant and branch.
3. Load the order/work group.
4. Validate tenant isolation.
5. Validate permission.
6. Validate idempotency key.
7. Validate expected version or update timestamp.
8. Resolve workflow snapshot.
9. Verify action availability.
10. Evaluate conditional transition.
11. Run stage-specific gates.
12. Run release/financial policy where applicable.
13. Persist the transition atomically.
14. Update compatibility fields during migration.
15. Insert history.
16. Emit one outbox event.
17. Return updated state, available actions, blockers, and warnings.

### 16.1 Facade output

The result shall include:

- Success.
- Order/work-group ID.
- Action.
- Previous state.
- New state.
- Workflow version.
- Transition ID.
- Warnings.
- Blockers.
- Current available actions.
- Audit/history ID.
- Correlation ID.

### 16.2 Idempotency

Repeating the same request with the same idempotency key shall not:

- Apply the transition twice.
- Duplicate history.
- Duplicate notification.
- Duplicate payment.
- Duplicate release.
- Duplicate POD.
- Duplicate financial reversal.

### 16.3 Concurrency

Conflicting transitions shall be rejected with a clear stale-state error.

The client shall reload available actions.

---

## 17. Available-actions requirements

The backend shall expose the actions currently available for an order/work group.

Each action shall include:

- Action code.
- English and Arabic label.
- Enabled state.
- Blockers.
- Warnings.
- Required fields.
- Required permission.
- Confirmation requirement.
- Manager approval requirement.
- Expected next stage, when appropriate.
- Primary/secondary action classification.

The frontend shall not calculate authoritative next stage.

---

## 18. Order and work-group requirements

### 18.1 Order

The order remains the commercial container.

It includes:

- Customer.
- Branch.
- Source.
- Currency.
- Financial summary.
- Fulfilment preference.
- Overall progress.
- Parent/child relationships.
- Commercial closure.

### 18.2 Work group

A work group represents selected items/pieces sharing one operational route.

Examples:

- Internal laundry items.
- Dry-cleaning items.
- Outsourced carpet.
- Tailoring.
- Shoe cleaning.

### 18.3 Mixed-service order

The system shall:

- Resolve workflow per item/service.
- Group compatible items.
- Track work-group progress.
- Derive order-level summary.
- Avoid forcing all items through the same detailed route.
- Allow partial fulfilment from completed work groups.

---

## 19. Quick Drop requirements

Quick Drop shall support:

- Order creation before full itemization.
- Bag/container count.
- Declared quantity.
- Temporary identification.
- Preparation queue.
- Actual itemization.
- Variance recording.
- Piece creation.
- Pricing recalculation.
- Ready-by recalculation.
- Customer approval when configured.
- Transition to resolved processing workflow.

The initial declared quantity shall not become authoritative item inventory.

---

## 20. Item and piece tracking requirements

### 20.1 Item level

Track:

- Service.
- Quantity.
- Price.
- Preferences.
- Current operational stage.
- QA result.
- Outsourcing status.
- Release quantity.
- Issues.

### 20.2 Piece level

When enabled, track:

- Piece code/barcode.
- Item relationship.
- Current stage.
- Scan state.
- Storage location.
- QA result.
- Outsourcing job.
- Release.
- Custody history.
- Issue history.

### 20.3 Aggregation

Order/work-group state shall be derived from item/piece progress using defined aggregation rules.

One ready item shall not make the full order Ready.

---

## 21. Preparation requirements

Preparation may include:

- Quick Drop itemization.
- Item confirmation.
- Service selection.
- Quantity confirmation.
- Piece creation.
- Stain/damage capture.
- Photo capture.
- Preferences.
- Pricing recalculation.
- Ready-by recalculation.
- Customer approval.
- Outsourcing requirement selection.

Preparation completion shall validate all mandatory data.

---

## 22. Processing requirements

Processing shall support:

- Order-level progress.
- Item-level steps.
- Piece-level progress where enabled.
- Configured processing steps.
- Required scans.
- Completion validation.
- Mixed-service work groups.
- Automatic next action resolution.
- Internal rework.
- Time-in-stage metrics.

Processing stages may remain simple for small tenants.

---

## 23. Assembly requirements

When enabled, Assembly shall:

- Show expected pieces.
- Require configured scans.
- Identify missing or wrong pieces.
- Allow issue creation.
- Support partial progress.
- Prevent completion while blocking discrepancies exist.
- Record assembler and timestamps.
- Advance according to workflow rules.

---

## 24. Quality Assurance requirements

QA shall support:

- Order, item, or piece scope.
- Pass.
- Fail.
- Pass with note where configured.
- Inspection fields.
- Photos.
- Stain/damage result.
- Issue creation.
- Rework routing.
- Manager override.
- Audit.
- Conditional next stage.

A QA failure before release may return the same work group to Processing.

A complaint after fulfilment shall not erase fulfilment history.

---

## 25. Packing requirements

Packing shall support:

- Fold/hang preference.
- Package type where package tracking is enabled.
- Packing notes.
- Packing list.
- Barcode/label generation.
- Storage/rack assignment.
- Multi-package order.
- Completion gate.
- Customer-visible milestone mapping.

Package tracking may be enabled per tenant.

---

## 26. Ready requirements

An order/work group may become Ready only when configured operational gates pass.

Possible gates:

- Required processing complete.
- Required pieces accounted for.
- Assembly complete.
- QA passed.
- Packing complete.
- Blocking issues resolved.
- Storage/rack assigned.
- Vendor return reconciled.
- Required approval completed.

Payment shall not automatically prevent operational Ready unless tenant policy explicitly defines that behavior.

---

## 27. Release eligibility requirements

Release eligibility is separate from Ready.

Release policy may check:

- Outstanding amount.
- Payment method.
- Pay-on-collection policy.
- B2B contract and credit.
- Invoice approval.
- Customer identity.
- Authorized representative.
- Selected pieces/items.
- Hold status.
- Manager override.
- Required proof method.
- Delivery assignment.

Release denial shall return clear blocker codes.

---

## 28. Outsourcing requirements

### 28.1 Scope

Outsourcing may apply to:

- Entire order.
- Selected items.
- Selected pieces.

### 28.2 Outsourcing lifecycle

- Requested.
- Approval pending.
- Approved.
- Prepared for vendor.
- Sent to vendor.
- Vendor received.
- Vendor processing.
- Vendor completed.
- Returned from vendor.
- Reconciliation pending.
- Internal QA.
- Completed.
- Cancelled.

### 28.3 Vendor master

Vendor records shall include:

- Tenant.
- Name.
- English and Arabic display names.
- Contact details.
- Supported services.
- Active status.
- Default turnaround time.
- Notes.
- Currency.
- Cost behavior.
- Branch availability.

### 28.4 Outsource job

Track:

- Order/work group.
- Vendor.
- Selected items/pieces.
- Vendor service.
- Expected return.
- Estimated cost.
- Actual cost.
- Vendor reference.
- Send evidence.
- Receive evidence.
- Custody transfer.
- Status history.
- Reconciliation.
- Internal QA.
- Exceptions.

### 28.5 Outsourcing controls

- Permission required.
- Vendor required.
- Expected return required.
- Selected items/pieces required.
- Duplicate active outsourcing for the same piece prevented.
- Sent pieces removed from internal ready calculation.
- Returned quantity reconciled.
- Missing/damaged vendor return creates issue.
- Internal QA may be mandatory.
- Completion continues through configured transition.

### 28.6 Outsourcing UI

Operators see simple actions:

- Send to Vendor.
- Confirm Vendor Receipt.
- Receive from Vendor.
- Reconcile.
- Pass Internal QA.

Advanced financial and history details remain secondary.

---

## 29. Fulfilment requirements

### 29.1 Fulfilment types

- Customer collection.
- Laundry delivery.
- B2B handover.
- Optional pickup for inbound garments.
- Future locker types reserved but not required.

### 29.2 Fulfilment state

Fulfilment records shall be separate from operational workflow state.

### 29.3 Order fulfilment summary

Derived from required pieces/items:

- Not fulfilled.
- Partially fulfilled.
- Fully fulfilled.

---

## 30. Release and partial fulfilment requirements

### 30.1 Release concept

A release records selected items/pieces leaving laundry custody.

### 30.2 Release types

- Customer collection.
- Delivery.
- B2B handover.

### 30.3 Release lifecycle

- Draft.
- Ready for verification.
- Verified.
- Released.
- Dispatched.
- Out for delivery.
- Delivered.
- Failed.
- Returned to branch.
- Cancelled.

Not all states apply to every release type.

### 30.4 Partial fulfilment

The system shall allow:

- Some ready items/pieces to be released.
- Remaining items/pieces to stay active.
- Multiple releases.
- Mixed collection and delivery where policy allows.
- Outstanding count and value visibility.

### 30.5 Double-release prevention

The system shall prevent:

- Releasing the same piece twice.
- Releasing more quantity than available.
- Creating overlapping active releases.
- Delivering an already collected item.
- Releasing an item under unresolved hold.

### 30.6 Completion

The order becomes fully fulfilled only when all required items/pieces are released or formally resolved.

Commercial closure may also require financial resolution.

---

## 31. Customer collection requirements

Customer collection shall support:

- Search by order number, phone, barcode, or customer.
- Selected release.
- Customer/representative verification.
- OTP/PIN where configured.
- Authorized representative.
- Outstanding balance display.
- Collect payment action where permitted.
- Release eligibility check.
- Piece/item/package verification.
- Partial collection.
- Proof of handover.
- Receipt delivery.
- Audit.
- Customer notification.

Customer collection shall not be represented only as generic delivery.

---

## 32. Delivery requirements

Delivery shall support:

- Release creation.
- Delivery scheduling.
- Route/stop association.
- Driver assignment.
- Dispatch verification.
- Loading verification.
- Out for delivery.
- Customer contact.
- OTP/signature/photo POD.
- Payment collection where configured.
- Successful delivery.
- Failed attempt.
- Customer unavailable.
- Address issue.
- Refusal.
- Partial delivery.
- Return to branch.
- Rescheduling.
- Audit and notifications.

Delivery completion shall update release and fulfilment summary atomically or through a reliable transactional/outbox process.

---

## 33. Pickup requirements

Pickup is optional in V1 but shall be supported by the product model.

Pickup may include:

- Request.
- Slot.
- Address.
- Driver assignment.
- En route.
- Arrived.
- Picked up.
- Bag/piece evidence.
- OTP/signature/photo.
- Failed pickup.
- Reschedule.
- In transit to branch.
- Branch receipt.
- Custody transfer.

Pickup shall not be confused with outbound delivery.

---

## 34. Custody requirements

Custody events shall be created for relevant transfers:

- Customer to driver.
- Driver to branch.
- Branch to plant.
- Plant to branch.
- Branch to vendor.
- Vendor to branch.
- Branch to customer.
- Driver to customer.

Each event may record:

- From party/location.
- To party/location.
- Items/pieces/packages.
- Count.
- Actor.
- Time.
- Evidence.
- Discrepancy.
- Correlation ID.

---

## 35. Holds, blockers, and approvals

### 35.1 Holds

Supported hold reasons may include:

- Customer approval required.
- Payment issue.
- Missing information.
- Missing item.
- Machine unavailable.
- Vendor delay.
- Damage investigation.
- Credit block.
- Delivery exception.
- Manager review.

### 35.2 Hold behavior

A hold shall:

- Identify scope.
- Identify reason.
- Identify owner.
- Record start time.
- Optionally pause SLA.
- Prevent configured actions.
- Require resolution to resume.
- Preserve current operational stage.

### 35.3 Manager approval

Sensitive actions may require approval:

- Skip mandatory stage.
- Override QA.
- Release with balance.
- Cancel after processing.
- Outsource manually.
- Compensate or refund.
- Force close.

Approval shall record decision, actor, reason, and evidence.

---

## 36. Issues, rework, complaints, and returns

### 36.1 Pre-release issue

May remain on the same order/work group.

### 36.2 Internal rework

QA failure may return selected items/pieces to Processing.

### 36.3 Post-fulfilment complaint

Shall create an issue case and preserve original fulfilment history.

### 36.4 Rework child order

May be created for post-delivery reclean, repress, repair, or replacement.

### 36.5 Customer return

Customer return shall not automatically equal cancellation.

The product model shall distinguish:

- Return request.
- Return pickup/drop-off.
- Return received.
- Investigation.
- Rework.
- Refund/credit.
- Closure.

---

## 37. Cancellation and void requirements

### 37.1 Void

Used for invalid or erroneous draft transactions.

### 37.2 Cancellation

Used to stop a valid order.

Cancellation shall consider:

- Current operational stage.
- Items already processed.
- Outsourced items.
- Releases.
- Payments.
- Refund/store credit/keep-on-account disposition.
- Required permission.
- Reason.
- Customer notification.
- Audit.

### 37.3 Terminal protections

Delivered, collected, closed, or partially fulfilled orders shall not be cancelled using a simple status change.

They require a return, claim, refund, or controlled resolution flow.

---

## 38. Finance integration requirements

Workflow shall integrate with existing Order Fin capabilities.

### 38.1 Pricing

Workflow shall not independently recalculate financial truth except through approved Order Fin services.

### 38.2 Ready

Ready may coexist with:

- Payment pending.
- Partial payment.
- Pay on collection.
- B2B invoice.

### 38.3 Release

Release policy shall determine whether outstanding balance is acceptable.

### 38.4 Payment collection

Collection or delivery may invoke payment collection through Order Fin.

### 38.5 Idempotency

Workflow retries shall not duplicate:

- Payment.
- Invoice.
- Voucher.
- Refund.
- Credit.
- Cash-drawer movement.

### 38.6 B2B

B2B release may depend on:

- Contract.
- Credit limit.
- Invoice terms.
- Purchase order.
- Approval.
- Branch authorization.

---

## 39. Notifications requirements

Notifications may be triggered for:

- Order confirmed.
- Preparation completed.
- Customer approval required.
- Outsourcing delay.
- Ready.
- Ready for collection.
- Delivery scheduled.
- Out for delivery.
- Delivery failed.
- Delivered.
- Partial fulfilment.
- Remaining items ready.
- Hold.
- Cancellation.
- Return.
- Rework completed.

Notifications shall use the existing notification architecture/outbox.

Workflow shall emit events, not call providers directly.

Notifications must support English and Arabic templates.

---

## 40. Customer-facing milestone requirements

Internal stages may be mapped to fewer customer milestones.

Example:

| Internal | Customer |
|---|---|
| Intake/Preparation | Order Received |
| Processing/Outsourcing | Cleaning in Progress |
| Assembly/QA/Packing | Final Checks |
| Ready | Ready |
| Out for Delivery | Out for Delivery |
| Collected/Delivered | Completed |

Customer milestone labels and mappings shall be defined by HQ workflow profiles. A tenant may only choose among HQ-approved display options where explicitly exposed.

---

## 41. UI/UX requirements

### 41.1 Daily operations

- One primary action.
- Secondary actions in a menu.
- Current task prominent.
- Ready-by visible.
- Blockers prominent.
- Advanced details collapsed.
- Clear success/error feedback.
- No technical engine terms.
- No free-form status selection.

### 41.2 HQ workflow configuration wizard

The configuration wizard shall exist in the HQ Platform administration area only.

Steps:

1. Select target plan, market, tenant profile, service category, service, or branch scope.
2. Select an HQ preset or clone an HQ draft.
3. Enable supported stages.
4. Configure stage gates.
5. Configure conditional routes.
6. Configure outsourcing behavior.
7. Configure partial fulfilment and release behavior.
8. Configure customer milestones.
9. Preview affected assignments.
10. Simulate representative scenarios.
11. Validate.
12. Publish through authorized HQ approval.

### 41.3 HQ workflow editor

The V1 HQ editor shall use:

- Ordered stage list.
- Toggles.
- Dropdown-based rule builder.
- Validated drag reorder.
- Inline validation.
- English and Arabic label fields.
- Assignment and impact preview.
- Version comparison.
- Draft, review, approve, publish, and retire controls.

A complex free-form node canvas is excluded.

### 41.4 Tenant workflow view

The tenant administration area shall provide a simple read-only view showing:

- Assigned workflow profile.
- Version.
- Enabled operational stages.
- Enabled outsourcing and partial-fulfilment capabilities.
- Effective branch/service assignment summary.
- Customer-visible milestones.
- Effective date.
- Contact/request-change action where supported.

No tenant rule editor, stage editor, version publisher, or transition editor shall be provided in V1.

### 41.5 Available-action rendering

Screens shall render backend-provided actions.

### 41.6 Responsive design

Required for:

- Desktop.
- Tablet.
- Mobile operational use.
- Driver mobile use.

### 41.7 RTL

All relevant pages shall support:

- Mirrored layout.
- Correct Arabic alignment.
- Mixed Arabic/English identifiers.
- Number and currency rendering.
- Barcode/order-number readability.

### 41.8 Accessibility

- Keyboard navigation.
- Visible focus.
- Semantic labels.
- Error association.
- Sufficient contrast.
- Non-color-only status indication.
- Screen-reader-friendly action labels.

---

## 42. Required pages and screens

### 42.1 HQ Platform configuration

Available only to authorized HQ Platform users:

- Workflow catalog.
- Preset management.
- Workflow draft editor.
- Stage configuration.
- Conditional transitions.
- Tenant/profile assignments.
- Service-category and service assignments.
- Branch assignments.
- Plan and market availability.
- Preview/simulation.
- Impact analysis.
- Validation results.
- Version history.
- Approval and publish confirmation.
- Configuration audit.

### 42.2 Tenant workflow information

Tenant administrators receive:

- Read-only assigned workflow summary.
- Enabled capability summary.
- Branch/service effective-profile summary.
- Optional HQ-approved preset selector where enabled.
- Workflow change-request action.

No tenant workflow authoring screens are required.

### 42.3 Operations

- New Order.
- Preparation queue/detail.
- Processing queue/detail.
- Assembly queue/detail.
- QA queue/detail.
- Packing queue/detail.
- Ready queue/detail.
- Outsourcing queue/detail.
- Customer collection.
- Dispatch.
- Delivery.
- Pickup.
- Issues/holds.
- Order timeline.
- Release history.

### 42.4 Management

- Workflow health.
- Orders by stage.
- Time in stage.
- SLA risk.
- Outsourcing overdue.
- Partial fulfilment.
- Delivery exceptions.
- HQ workflow-profile usage and assignment coverage.

---

## 43. Search, filtering, and reporting

Operational queues shall support relevant filters:

- Branch.
- Stage.
- Priority.
- Ready-by.
- Service.
- Customer.
- Work group.
- Outsourcing vendor.
- Hold/blocker.
- Fulfilment method.
- Partial fulfilment.
- Driver.
- Payment/release eligibility.

Reporting shall distinguish:

- Operational stage.
- Customer milestone.
- Fulfilment state.
- Financial state.
- Exception state.

---

## 44. Permissions requirements

Minimum permission groups:

### HQ workflow configuration

Platform permissions:

- View workflow catalog.
- Create HQ draft.
- Edit HQ draft.
- Validate.
- Simulate.
- Review.
- Approve.
- Publish.
- Retire.
- Assign profiles to tenants/services/branches.
- Manage HQ-controlled overrides.
- View assignment impact.

Tenant permissions:

- View assigned workflow.
- Select an HQ-approved profile only where explicitly enabled.
- Submit workflow change request.

### Operations

- Complete Preparation.
- Complete Processing.
- Complete Assembly.
- Pass QA.
- Fail QA.
- Pack.
- Mark Ready.
- Assign storage.
- Create release.
- Confirm collection.
- Dispatch.
- Confirm delivery.
- Manage pickup.
- Create outsourcing job.
- Send/receive vendor work.
- Reconcile vendor return.

### Sensitive

- Skip stage.
- Override QA.
- Release with balance.
- Cancel processed order.
- Return order.
- Force close.
- Approve outsourcing.
- Approve manager override.

Operational permissions shall work with tenant custom roles, not only system defaults. Workflow authoring and publishing permissions shall be platform-level and unavailable to tenant roles.

---

## 45. Audit requirements

Audit shall include:

- HQ configuration creation/edit/review/approve/publish/retire.
- HQ profile assignment changes.
- Tenant limited-profile selection or change request where enabled.
- Workflow snapshot resolution.
- Every transition.
- Rule evaluation trace.
- Blocked action attempts where useful.
- Manager override.
- Outsourcing custody.
- Release.
- Delivery/POD.
- Customer collection proof.
- Cancellation/return.
- Status normalization/migration.

Audit history shall be append-only.

---

## 46. Error and blocker model

Errors shall be structured.

Minimum categories:

- Validation error.
- Permission denied.
- Feature unavailable.
- Workflow not assigned.
- Workflow version invalid.
- Transition not allowed.
- Condition evaluation failure.
- Quality gate failed.
- Release blocked.
- Payment required.
- Stale state.
- Duplicate request.
- Tenant mismatch.
- Outsourcing reconciliation failed.
- Partial release conflict.
- Delivery conflict.
- Internal error.

UI messages shall be clear, localized, and actionable.

---

## 47. Non-functional requirements

### 47.1 Availability

Target platform availability: 99.9%.

### 47.2 Performance

Target:

- Normal workflow command p50 below 300 ms where no external provider is required.
- p95 below 800 ms for standard commands.
- Available-actions response p95 below 500 ms.
- Operational queue search below 1 second at 100,000 orders under defined indexing and tenant scope.

### 47.3 Scalability

- Multi-tenant.
- Multi-branch.
- Large order volumes.
- Piece-level tracking.
- Multiple workflow versions.
- High audit volume.
- Partitioning strategy where justified.

### 47.4 Security

- PostgreSQL RLS for tenant-owned tables.
- Server-side permission enforcement.
- No trust in client-provided tenant IDs.
- Signed webhooks where applicable.
- Secure file URLs.
- Sensitive evidence access controls.

### 47.5 Reliability

- Atomic core transitions.
- Transactional outbox.
- Idempotency.
- Optimistic concurrency.
- Retry-safe consumers.
- No duplicate side effects.

### 47.6 Observability

- Structured logs.
- Correlation IDs.
- Workflow action metrics.
- Transition rejection metrics.
- Rule-evaluation failures.
- Drift metrics.
- Outsourcing overdue metrics.
- Release conflict metrics.
- Delivery failure metrics.
- Sentry errors.
- OpenTelemetry traces where available.

### 47.7 Backup and recovery

New workflow data shall be included in PostgreSQL backup/PITR strategy.

### 47.8 Localization

- English and Arabic.
- RTL.
- Localized validation and action labels.
- Tenant-configurable display names.

---

## 48. Migration and compatibility requirements

### 48.1 Existing orders

Existing active orders shall continue safely.

### 48.2 Current status fields

During migration:

- `current_status` is the migration-compatible physical field for the canonical order-level operational summary; the complete order state remains multidimensional.
- `status` is dual-written as compatibility alias.
- `current_stage` remains aligned projection until separate semantics are introduced.

### 48.3 Direct writers

All known direct writers shall be migrated to the facade.

### 48.4 Legacy and Enhanced engines

The facade may use compatibility adapters temporarily.

Callers shall not select engine.

### 48.5 Production discovery

Before cutover:

- Measure status drift.
- Measure literals.
- Identify workflow flags.
- Identify template assignments.
- Identify direct API usage.
- Identify delivery-in-progress.
- Identify ready orders with balances.
- Verify permissions.

### 48.6 Rollout

- Demo/internal tenant.
- Pilot tenant.
- Tenant-by-tenant.
- Feature-flagged writer policy.
- Shadow comparison.
- Rollback support.

---

## 49. Testing requirements

### 49.1 Unit tests

- Rule evaluation.
- Available actions.
- Gate services.
- Workflow resolution.
- Stage aggregation.
- Release eligibility.
- Outsourcing reconciliation.
- Partial fulfilment.
- Compatibility mappings.

### 49.2 Database tests

- Constraints.
- RLS.
- Tenant isolation.
- Idempotency.
- Concurrency.
- Workflow version immutability.
- Double-release prevention.
- Outsourcing uniqueness.
- Audit/outbox atomicity.

### 49.3 API integration tests

- Every action.
- Permission denial.
- Stale state.
- Duplicate request.
- Invalid workflow.
- Release blocked.
- Vendor mismatch.
- Partial fulfilment.

### 49.4 End-to-end tests

Minimum Playwright journeys:

1. Simple walk-in.
2. Quick Drop.
3. Quality-controlled order.
4. QA failure/rework.
5. Outsourced piece.
6. Partial customer collection.
7. Partial delivery.
8. Pay-on-collection.
9. B2B invoice release.
10. Failed delivery/return.
11. Cancellation with payment disposition.
12. HQ workflow configuration, approval, assignment, and publish.
13. Existing active order continuation.
14. Arabic RTL workflow.

### 49.5 Flutter tests

- Driver actions.
- Pickup.
- Delivery.
- Offline queue if included.
- OTP/POD.
- Conflict handling.

### 49.6 Performance tests

- Available actions.
- Transition command.
- Queue search.
- Bulk operational load.
- Audit writes.

### 49.7 Security tests

- Cross-tenant access.
- Permission escalation.
- Direct endpoint bypass.
- Forged tenant ID.
- Evidence access.
- Replay/idempotency.

---

## 50. Production readiness criteria

V1 may be released only when:

- One facade owns all workflow changes.
- No unapproved direct writer remains.
- Production data discovery is complete.
- Active-order continuation passes.
- Status drift is controlled.
- Commercial, operational, fulfilment, exception, and custody projections pass rebuild and drift tests.
- Workflow publish validation is complete.
- Conditional transitions are deterministic.
- Outsourcing prevents missing/duplicate pieces.
- Partial fulfilment prevents double release.
- Release policy is backend-enforced.
- Customer collection and delivery are distinct.
- Audit and outbox are atomic.
- RLS and RBAC tests pass.
- English and Arabic/RTL pass.
- Critical E2E journeys pass.
- Monitoring and alerts exist.
- Rollback is tested.
- No open critical or high-severity defects remain.
- Known medium defects have accepted mitigation and do not threaten data, money, custody, or tenant isolation.

---

## 51. Success metrics

Suggested V1 metrics:

- Workflow command error rate below 1%.
- Duplicate-transition incidents: zero.
- Double-release incidents: zero.
- Cross-tenant incidents: zero.
- Orders with status drift after cutover: near zero and automatically detected.
- Ready-by breach rate below product target.
- Missing-piece rate reduced.
- Incorrect handover rate reduced.
- Median operator action time reduced.
- HQ workflow configuration publish success rate above 95% after validation.
- Delivery exception resolution time measured.
- Outsourcing overdue rate visible.
- Partial fulfilment fully traceable.

---

## 52. Edge cases

The product shall explicitly support or block:

- Order with no assigned workflow.
- Disabled stage referenced by rule.
- Workflow version retired while order active.
- Service changed after order confirmation.
- Branch transfer after workflow snapshot.
- Item added after partial release.
- Piece already released.
- Piece in outsourcing and selected for release.
- Vendor returns fewer pieces.
- Vendor returns extra/wrong piece.
- QA fails one of several pieces.
- One work group ready while another is processing.
- Delivery release partly delivered.
- Customer collects one package and leaves another.
- Outstanding payment after partial release.
- B2B credit expires before release.
- Cancellation after outsourcing sent.
- Cancellation after partial fulfilment.
- Duplicate POD request.
- Offline driver submits stale completion.
- Customer return after delivery.
- Manager override followed by rollback.
- Arabic label missing.
- Permission removed during active session.
- Concurrent processing and cancellation.
- Direct legacy API called during rollout.
- Order summary projections temporarily lag authoritative domain records.
- Workflow condition produces no route.
- Multiple rules match at same priority.
- Circular rule configuration.
- Order data no longer satisfies workflow rule after snapshot.

---

## 53. Acceptance criteria by capability

### 53.1 HQ-configurable workflow

- Authorized HQ user can create or clone a workflow draft.
- Authorized HQ user can configure supported stages and rules.
- Invalid configuration cannot be published.
- Publishing requires the configured HQ approval flow.
- Published version is immutable.
- HQ can assign the version to tenant/service/branch scopes.
- Tenant onboarding requires no workflow configuration.
- Tenant users cannot author or publish workflow definitions.
- New orders use the correct effective version.
- Existing orders remain on their version.

### 53.2 Conditional transitions

- Supported conditions resolve deterministically.
- Exactly one default route is required.
- Trace explains chosen route.
- Unsupported logic is rejected.

### 53.3 Outsourcing

- Selected pieces can be sent.
- Custody is recorded.
- Duplicate active outsourcing is prevented.
- Return is reconciled.
- Missing pieces create blockers.
- Internal QA can be enforced.
- Order continues correctly afterward.

### 53.4 Partial fulfilment

- Staff can release selected ready pieces.
- Same piece cannot be released twice.
- Order shows partial fulfilment.
- Remaining pieces remain visible.
- Final release changes summary to fully fulfilled.
- Payment/release policy is enforced.

### 53.5 Simple UI

- Operator sees one primary action.
- Disabled stages are hidden.
- Blockers are actionable.
- No arbitrary technical status selection exists.
- Arabic/RTL remains usable.

### 53.6 Migration

- Existing active orders continue.
- Legacy callers are routed through facade.
- No duplicate history or notification occurs.
- Rollback is possible per tenant.

---

## 54. Dependencies

- Existing Order Fin services.
- Existing notification/outbox architecture.
- Existing delivery service.
- Existing item/piece models.
- Existing workflow template data.
- Existing authentication/RBAC.
- PostgreSQL RLS.
- File storage for photos/signatures.
- Customer and driver apps where applicable.

---

## 55. Risks

| Risk | Product response |
|---|---|
| V1 becomes too complex | Guided presets, controlled catalog, phased work packages |
| Existing orders break | Snapshot/version compatibility and pilot rollout |
| Two engines remain indefinitely | Facade adoption and measurable retirement criteria |
| UI duplicates rules | Backend available-actions |
| Payment gate bypass | Backend release policy |
| Double release | Database constraints and idempotency |
| Lost outsourced pieces | Custody and reconciliation |
| HQ workflow misconfiguration | Validation, simulation, approval separation, impact preview, immutable publish |
| Arabic usability gaps | RTL acceptance tests |
| Solo-developer overload | Strict sequencing, reusable patterns, no BPMN/custom scripts |

---

## 56. Open decisions for the ADR pack

The following shall be finalized in CMX-OW-V1-PACK-002:

1. Physical column rollout and backfill sequencing for the approved multidimensional state model.
2. Whether `current_stage` remains aligned or becomes separate in V1.
3. Exact workflow snapshot storage approach.
4. Work-group creation rules.
5. Package tracking required-by-default or optional.
6. Pickup included in general availability or feature-flagged.
7. Release value allocation behavior.
8. Exact B2B release policy ownership.
9. Hold/SLA pause rules.
10. Existing active-order migration eligibility.
11. Enhanced writer cutover prerequisites.
12. Exact condition evaluation representation.
13. Exact customer milestone configuration limits.

---

## 57. Traceability identifiers

Requirement IDs shall use:

- `OWV1-FR-###` — functional requirement.
- `OWV1-BR-###` — business rule.
- `OWV1-NFR-###` — non-functional requirement.
- `OWV1-SEC-###` — security requirement.
- `OWV1-UX-###` — UI/UX requirement.
- `OWV1-AC-###` — acceptance criterion.

The detailed traceability matrix will be maintained in CMX-OW-V1-PACK-018.

---

## 58. Approval

Approval of this PRD authorizes preparation of:

- Architecture Decision and Strategy Pack.
- Domain and State Model.
- Configurable Workflow Specification.
- Workflow Facade Technical Design.
- Database and Migration Specification.
- Backend/API/UI implementation specifications.
- Test and rollout plans.

Approval does not authorize direct production cutover without the later readiness gates.
