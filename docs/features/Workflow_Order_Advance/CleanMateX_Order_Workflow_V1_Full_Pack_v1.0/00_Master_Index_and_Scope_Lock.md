# CleanMateX Configurable Order Workflow V1 — Master Implementation Pack

**Document ID:** CMX-OW-V1-PACK-000  
**Status:** Active authoring baseline  
**Purpose:** Authoritative index and scope lock for production implementation  
**Product:** CleanMateX Laundry Management System  
**Audience:** Product owner, architect, developer, QA, AI coding assistants

---

## 1. V1 product goal

Build a production-ready, configurable Order Workflow for CleanMateX that remains simple for daily laundry operations while the platform handles workflow rules, tenant variation, financial release policy, outsourcing, partial fulfilment, auditability, and future extension behind the scenes.

The user experience must remain action-oriented:

- Receive order
- Prepare
- Process
- Quality check
- Pack
- Mark ready
- Collect or deliver
- Resolve exceptions

Operators must not manage technical state machines, status codes, rule expressions, workflow versions, or engine selection.

---

## 2. Non-negotiable principles

1. One permanent workflow command entry point.
2. No new direct order-status writers.
3. Existing active orders must continue safely.
4. The complete order state is multidimensional: commercial, operational, fulfilment, exception, custody, payment, and invoice.
5. During expand/change, `current_status` may temporarily mirror the operational summary. The final V1 schema uses `operational_status` and removes `current_status`.
6. `status` is a temporary compatibility alias and is removed after all readers are migrated.
7. Workflow templates and versions are immutable after publishing.
8. Workflow topology, rules, publishing, and assignments are controlled by CleanMateX HQ; tenant workflow setup is optional and very limited.
9. Daily UI exposes actions, not technical statuses.
10. Operational readiness and physical release are separate decisions.
11. All important changes are tenant-scoped, permission-checked, auditable, idempotent, and concurrency-safe.
12. Conditional transitions use a controlled rule catalog.
13. Outsourcing applies to selected order items or pieces.
14. Partial fulfilment uses release records, not child orders by default.
15. Customer collection and driver delivery remain separate fulfilment paths.
16. Financial calculations remain owned by the Order Fin domain.
17. No workflow feature may bypass RLS, audit, finance, or release policies.
18. English and Arabic are required from V1.
19. Existing features are upgraded and reused where safe; duplication is removed.
---

## 3. V1 scope

### 3.1 Workflow platform foundation

- Unified Workflow Transition Facade
- Legacy and Enhanced compatibility adapters during migration
- Canonical action catalog
- Canonical status vocabulary and compatibility mappings
- Atomic transition persistence
- Idempotency
- Optimistic concurrency
- Append-only workflow history
- Outbox event emission
- Per-tenant writer policy and controlled rollout
- Backend available-actions API
- Removal of direct status writes

### 3.2 Configurable workflow

- System presets
- HQ-managed tenant workflow-profile assignment
- Stage enable/disable
- Stage ordering
- Stage labels in English and Arabic
- Required permissions
- Required scans
- Ready gates
- Release gates
- Customer-visible milestone mapping
- HQ-assigned tenant operating profiles
- HQ-managed service-category assignments
- HQ-managed service assignments
- HQ-managed branch assignments
- Workflow preview
- Draft, validation, publish, retire
- Immutable workflow versions
- Order/work-group workflow snapshot

### 3.3 Conditional transitions

Controlled conditions:

- Service category
- Service code
- Order type
- Order subtype
- Fulfilment method
- Customer type
- B2B status
- Branch
- Priority
- Express flag
- Blocking issue
- QA result
- Outsourcing requirement
- Payment status
- Outstanding balance
- All pieces ready
- All selected pieces scanned
- Manager approval

Controlled operators:

- Equals
- Not equals
- In
- Not in
- Greater than
- Greater than or equal
- Less than
- Less than or equal
- Is true
- Is false
- Exists
- Not exists

V1 rules use priority ordering, deterministic evaluation, and exactly one default transition.

### 3.4 Operational stages

Supported V1 stage types:

- Draft
- Intake
- Preparation
- Processing
- Assembly
- Quality Assurance
- Packing
- Ready
- Outsourcing
- Ready for Collection
- Ready for Dispatch
- Out for Delivery
- Collected
- Delivered
- Cancelled
- Closed

Optional stages remain hidden when disabled.

### 3.5 Order execution

- Normal walk-in
- Guest, Stub, Full, and B2B customer orders
- Quick Drop
- Item and piece tracking
- Mixed-service order routing
- Processing steps
- Assembly
- QA pass/fail
- Packing
- Rack/storage assignment
- Split child orders
- Internal pre-release rework
- Cancellation
- Customer return
- Issues and exceptions
- Workflow holds and manager approval where required

### 3.6 Outsourcing

- Vendor master
- Outsourcing job
- Selected item/piece assignment
- Approval
- Send to vendor
- Vendor receipt
- Vendor processing
- Return from vendor
- Reconciliation
- Internal QA
- Estimated and actual cost
- Expected return and overdue indicators
- Custody events
- Audit history
- Controlled continuation to the next configured stage

Excluded from V1:

- Vendor portal
- Vendor mobile app
- Procurement bidding
- Multi-level subcontracting
- Full supplier accounting automation

### 3.7 Fulfilment and partial fulfilment

- Customer collection
- Driver delivery
- Optional pickup workflow
- Fulfilment records
- Release records
- Selected item/piece release
- Partial fulfilment
- Multiple releases from one order
- Recipient verification
- OTP/PIN where configured
- Proof of handover
- Proof of delivery
- Failed delivery attempt
- Return to branch
- Outstanding item visibility
- Derived fulfilment summary:
  - Not fulfilled
  - Partially fulfilled
  - Fully fulfilled

### 3.8 Finance and release integration

- Operational Ready independent from payment state
- Release eligibility policy
- Pay on collection
- Partial payment
- B2B credit/invoice release
- Manager override with permission and reason
- Payment collection before handover where required
- No duplicate payment, invoice, refund, or voucher side effects
- Financial state remains authoritative in Order Fin

### 3.9 UI/UX

- Guided workflow setup
- Preset selection
- Simple stage toggles
- Drag reorder only where valid
- Rule builder using dropdowns
- Preview before publish
- Clear validation errors
- One primary action per operational screen
- Progressive disclosure
- Role-based navigation
- Exception-first warnings
- Backend-provided available actions
- Mobile and tablet responsive
- RTL support
- Accessible controls and keyboard support
- No arbitrary status dropdown for normal staff

---

## 4. V1 workflow presets

### Simple Laundry

Received → Processing → Ready → Collection/Delivery

### Standard Laundry

Received → Preparation → Processing → Packing → Ready → Collection/Delivery

### Quality Controlled

Received → Preparation → Processing → Assembly → QA → Packing → Ready → Collection/Delivery

### Outsourcing Enabled

Received → Preparation → Processing → Conditional Outsourcing → QA → Packing → Ready → Collection/Delivery

### Pickup and Delivery

Pickup → Received → Preparation → Processing → Ready → Dispatch → Delivery

Presets are starting configurations, not separate products.

---

## 5. Configuration precedence

The resolved workflow is determined in this order:

1. Platform-supported stage and rule catalog
2. Subscription-plan availability
3. HQ-assigned tenant operating profile
4. HQ-managed service-category assignment
5. HQ-managed service-specific assignment
6. HQ-managed branch assignment
7. Order/work-group snapshot

A published version never changes in place. New configuration creates a new version.

---

## 6. Permanent architecture decision

All workflow actions use:

`OrderWorkflowFacade.execute(command)`

The facade owns:

- Tenant and order loading
- Permission checking
- Concurrency validation
- Idempotency
- Workflow-version resolution
- Available-action validation
- Conditional-transition evaluation
- Stage-specific gates
- Release-policy evaluation
- Persistence
- History
- Outbox
- Notification trigger metadata
- Compatibility dual-write during migration

Callers submit business actions, not target statuses.

Examples:

- COMPLETE_PREPARATION
- COMPLETE_PROCESSING
- COMPLETE_ASSEMBLY
- PASS_QA
- FAIL_QA
- SEND_TO_VENDOR
- RECEIVE_FROM_VENDOR
- COMPLETE_PACKING
- MARK_READY
- CREATE_RELEASE
- CONFIRM_COLLECTION
- DISPATCH_RELEASE
- CONFIRM_DELIVERY
- REPORT_DELIVERY_FAILURE
- CANCEL_ORDER
- RETURN_FOR_REWORK

---

## 7. Full pack document set

| ID | Document | Purpose |
|---|---|---|
| 000 | Master Index and Scope Lock | Authoritative index, principles, boundaries |
| 000A | Scope and Decision Baseline | Locked initial scope and technical baseline |
| 000C | Pre-Production Clean Break and Migration Governance | Test-data reset, preserved migration chain, clean final schema |
| 001 | Product Requirements Document | Business requirements and scenarios |
| 002 | Architecture Decision and Strategy Pack | Locked state ownership, compatibility, aggregation, and execution decisions |
| 003 | Domain and State Model | Complete multidimensional status catalogs, ownership, transitions, and aggregation |
| 004 | Configurable Workflow Specification | Presets, inheritance, versioning, rules, publishing |
| 005 | Workflow Facade Technical Design | Commands, validation pipeline, adapters, persistence |
| 006 | Database and Migration Specification | Tables, constraints, RLS, migrations, backfills |
| 007 | Backend Services Specification | Services, responsibilities, transactions, events |
| 008 | API and OpenAPI Specification | Endpoints, schemas, errors, idempotency |
| 009 | Web Admin UI/UX Specification | Pages, screens, components, flows, RTL |
| 010 | Outsourcing Module Specification | Vendor jobs, custody, costs, QA |
| 011 | Fulfilment and Partial Release Specification | Collection, delivery, releases, POD |
| 012 | Security, Permissions, Audit and Compliance | RBAC, RLS, audit, sensitive actions |
| 013 | Events, Notifications and Integrations | Outbox, notifications, webhooks |
| 014 | Testing and QA Master Plan | Unit, integration, SQL, RLS, E2E, RTL |
| 015 | Migration, Rollout and Rollback Plan | Existing orders, tenant pilots, telemetry |
| 016 | Implementation Backlog and Work Packages | Sequenced tasks with dependencies |
| 017 | Production Readiness Checklist | Go-live gates and operational acceptance |
| 018 | Traceability Matrix | Requirement → design → API → UI → test |
| 019 | Data Dictionary | All V1 fields, enums, constraints |
| 020 | Operations and Support Runbook | Monitoring, recovery, troubleshooting |

---

## 8. Implementation workstreams

### Workstream A — Stabilization

- Production discovery
- Transition telemetry
- Caller inventory
- Status-drift measurement
- Permission verification
- Template assignment verification

### Workstream B — Unified facade

- Facade contracts
- Legacy adapter
- Enhanced adapter
- Caller migration
- Direct-writer removal
- Dual-write correction
- Available-actions API

### Workstream C — HQ configuration and versioning

- Stage catalog
- Presets
- Workflow definitions and versions
- HQ tenant/service/branch assignments
- Rule engine
- Validation and publishing
- Snapshot resolution

### Workstream D — Execution upgrades

- Preparation
- Processing
- Assembly
- QA
- Packing
- Ready gates
- Holds and exceptions

### Workstream E — Outsourcing

- Vendors
- Jobs
- Items/pieces
- Custody
- Return and reconciliation
- Internal QA
- Costs

### Workstream F — Fulfilment

- Releases
- Partial fulfilment
- Customer collection
- Delivery integration
- Optional pickup
- POD and failed attempts

### Workstream G — HQ configuration UI and operational UX

- HQ setup wizard
- HQ workflow editor
- Preview and publish
- Operational screens
- Available-action rendering
- Exception and blocker design
- RTL/accessibility

### Workstream H — Quality and rollout

- Automated tests
- Data migration verification
- Shadow comparison
- Pilot tenant
- Monitoring
- Rollback

---

## 9. Production-readiness gates

V1 is not complete until:

- All workflow state changes use the facade.
- No unapproved direct status writer remains.
- Active-order continuation is tested.
- Status drift is measured and controlled.
- Multidimensional order projections can be rebuilt from authoritative domain records.
- Commercial, operational, fulfilment, exception, and custody ownership is enforced.
- All published workflows pass graph validation.
- Exactly one default transition exists per action context.
- Unsupported loops and unreachable stages are rejected.
- Outsourcing reconciliation prevents lost pieces.
- Partial release prevents double release.
- Financial release policies are backend-enforced.
- Customer collection and delivery produce independent evidence.
- Idempotency prevents duplicate history, notification, payment, release, and POD effects.
- RLS tests pass for every new tenant table.
- RBAC tests cover every workflow action.
- English and Arabic UI and notifications are complete.
- Mobile/tablet/desktop and RTL flows pass.
- Critical Playwright journeys pass.
- Rollback is proven on a pilot tenant.
- Monitoring and support runbooks are complete.

---

## 10. Initial implementation order

1. Production data discovery and telemetry
2. Workflow facade design
3. Canonical actions and available-actions contract
4. Dual-write and direct-writer migration
5. Workflow definitions and immutable versions
6. Presets and HQ-managed tenant assignment
7. Conditional transition engine
8. HQ-managed service and branch assignments
9. HQ Platform workflow configuration UI
10. Outsourcing data model and services
11. Outsourcing UI and operational flow
12. Release and partial-fulfilment data model
13. Customer collection
14. Delivery integration and failed attempts
15. Pickup option
16. Migration and pilot rollout
17. Production readiness and general availability

---

## 11. Suggested additional V1 points

- Workflow simulation before publishing
- Impact preview showing affected services and branches
- Effective-date publishing
- Draft and published configuration comparison
- Clone existing workflow version
- Safe rollback to a prior published version for new orders
- Order/work-group workflow snapshot
- Transition reason codes
- Manager override reason and evidence
- Time-in-stage tracking
- Basic SLA warnings
- Customer milestone mapping
- Operational blocker codes
- Configuration audit history
- Import/export of workflow configuration as validated JSON
- Demo/test order mode for managers
- Feature availability by subscription plan
- HQ configuration health diagnostics

---

## 12. Explicit non-goals for V1

- General-purpose BPMN engine
- Arbitrary executable scripts
- Arbitrary SQL conditions
- Unlimited custom code-defined stages
- Vendor portal
- Machine automation
- Full production batch optimization
- Route optimization engine replacement
- Full accounting redesign
- Visual node canvas as the primary configuration UI

---

## 13. Authoring rule

Documents 001–020 must remain aligned with this master scope. Any scope change must update:

1. Master Index
2. Decision Register
3. Traceability Matrix
4. Backlog
5. Production Readiness Checklist
