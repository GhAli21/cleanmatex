# CleanMateX Configurable Order Workflow V1 — HQ Workflow Configuration Specification

**Document ID:** CMX-OW-V1-PACK-004  
**Version:** 1.0  
**Status:** Implementation specification  
**Configuration owner:** CleanMateX HQ Platform

## 1. Goal

HQ shall create and assign reliable workflow profiles while tenants receive a ready-to-use system and operators execute simple actions.

## 2. Configuration chain

```text
HQ catalogs
→ Workflow definition
→ Immutable workflow version
→ HQ assignment
→ Order/work-group snapshot
→ Available actions
```

Tenant workflow authoring is not available in V1.

## 3. Core entities

### Definition
Stable identity such as Simple Laundry, Standard Laundry, Quality Controlled, Outsourcing Enabled, Pickup and Delivery, or Central Plant.

### Version
Immutable published configuration containing stages, transitions, conditions, gates, permissions, milestones, notifications, outsourcing behavior, partial-fulfilment behavior, and SLA defaults.

### Assignment
HQ assigns a published version to platform default, plan, market, tenant, service category, service, or branch.

### Snapshot
Order/work group records the resolved version and assignment context so later HQ changes do not alter active work.

## 4. Resolution precedence

1. Mandatory platform rules
2. Market restrictions
3. Subscription-plan availability
4. Tenant operating profile
5. Service-category assignment
6. Service assignment
7. Branch assignment
8. Order/work-group snapshot

The most specific valid assignment wins. Runtime returns an explanation trace.

## 5. Version lifecycle

```text
draft → in_review → approved → published → retired
                     ↘ rejected
```

- Published versions are immutable.
- Editing published content creates a new draft version.
- Retired versions remain valid for historical snapshots.
- New assignments cannot target retired versions.

## 6. Maker/checker

Production publication requires author, reviewer, and publisher permissions. Author and publisher should be different users. Emergency publication requires elevated permission and reason.

## 7. Supported stage types

- intake
- preparation
- processing
- assembly
- qa
- packing
- outsourcing
- ready
- ready_for_collection
- ready_for_dispatch
- out_for_delivery
- collected
- delivered
- closed

Commercial cancellation/voiding are controlled commands, not normal configurable production stages.

## 8. Stage settings

Each stage supports:

- Stage type and sequence
- English/Arabic labels
- Required/optional
- Skippable with permission/reason
- Required action permission
- All-items/all-pieces gate
- Scan gate
- QA gate
- Rack/storage gate
- SLA and warning threshold
- Customer milestone mapping
- Notification policy
- Help content

## 9. Conditional transitions

V1 supports priority-ordered rules, AND conditions inside each rule, and exactly one default route.

Supported facts include:

- Service category/code
- Branch
- Order type/subtype
- Customer type/B2B
- Priority/express
- Fulfilment method
- QA result
- Outsourcing requirement
- All pieces ready/scanned
- Blocking issue
- Release-policy result
- Manager approval
- Work-group type
- Vendor reconciliation result

Operators:

- equals / not_equals
- in / not_in
- greater_than / greater_than_or_equal
- less_than / less_than_or_equal
- is_true / is_false
- exists / not_exists

No SQL, JavaScript, arbitrary scripts, or unrestricted expression trees.

## 10. Validation before publish

Reject:

- Missing start or terminal path
- Unreachable enabled stage
- Transition to disabled stage
- Missing/multiple default route
- Duplicate priority
- Unsupported action/fact/operator
- Invalid permission or milestone
- Unbounded loop
- Terminal stage with normal outgoing edge
- Required stage that cannot be reached
- Partial fulfilment without release policy
- Outsourcing without post-return route
- Missing English/Arabic labels

## 11. Supported loops

Only controlled loops:

- QA fail → Processing
- Vendor discrepancy → Outsourcing resolution
- Delivery failure → Return/re-dispatch
- Manager-approved internal rework

Each loop records attempt, reason, history, SLA behavior, and escalation threshold.

## 12. Presets

### Simple
`Intake → Processing → Ready → Collection/Delivery`

### Standard
`Intake → Preparation → Processing → Packing → Ready → Collection/Delivery`

### Quality Controlled
`Intake → Preparation → Processing → Assembly → QA → Packing → Ready`

### Outsourcing Enabled
Conditional outsourcing followed by internal QA.

### Pickup and Delivery
`Pickup → Intake → Processing → Ready → Dispatch → Delivery`

## 13. Tenant capabilities

Tenant may view assigned profile/version, enabled capabilities, branch/service resolution, and submit a change request. HQ may expose a small approved profile selector.

Tenant may not add/reorder stages, create rules, publish versions, override financial/security behavior, or edit active snapshots.

## 14. Simulation

Inputs include tenant, branch, service, customer type, fulfilment method, priority, QA result, outsourcing, readiness, payment decision, and blockers.

Output includes resolved version, assignment trace, route, actions, blockers, milestones, and rule trace. Simulation writes nothing.

## 15. Impact preview

Show affected tenants, branches, services, new orders, permissions, notifications, plan/market constraints, and configuration differences. Existing active orders are unaffected by default.

## 16. Effective dating

Assignments support `effective_from`, optional `effective_to`, and statuses scheduled/active/expired/cancelled. Overlapping assignments at the same scope are prohibited.

## 17. Active-order migration

Prohibited by default. Exception requires HQ elevated permission, compatibility dry run, per-order report, audit, and rollback plan.

## 18. Acceptance criteria

- Tenant onboarding requires no workflow setup.
- HQ can create, validate, review, approve, publish, assign, retire, and restore.
- Published content is immutable.
- Resolution and simulation are deterministic.
- Invalid graphs cannot publish.
- Existing orders retain their snapshot.
- Tenant authoring APIs are inaccessible.
