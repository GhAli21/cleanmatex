# CleanMateX Configurable Order Workflow V1 — Scope and Decision Baseline

**Document ID:** CMX-OW-V1-PACK-000A  
**Status:** Draft baseline

## 1. Locked V1 capabilities

- Unified workflow facade
- Controlled configurable workflows
- Immutable workflow versions
- Presets
- Optional stages
- Stage ordering
- HQ-managed tenant/service/branch profile assignment
- Conditional transitions
- Outsourcing
- Partial fulfilment
- Customer collection
- Delivery integration
- Optional pickup workflow
- Quick Drop
- Item and piece tracking
- Split orders
- Issues and internal rework
- Ready and release separation
- Backend available actions
- English and Arabic UI

## 2. Locked simplicity principles

- Operators see tasks and actions, not transition graphs.
- HQ workflow administrators use a guided configuration interface; tenant workflow setup is not required.
- One primary action per operational screen.
- Optional capabilities remain hidden until enabled.
- Advanced rules are authored only at HQ using dropdowns and supported values.
- Customer milestones remain fewer and simpler than internal stages.

## 3. Locked technical decisions

- Permanent application entry: `OrderWorkflowFacade`.
- Complete order state is multidimensional: commercial, operational, fulfilment, exception, custody, payment, and invoice.
- `current_status` may temporarily coexist during expand/change; the final V1 schema uses `operational_status` and removes `current_status`.
- Detailed stage truth belongs to workflow instances/work groups, items, and pieces.
- Compatibility state: `status`, dual-written until reader migration completes.
- Workflow definitions are HQ-authored, versioned, and immutable after publish.
- Templates own stage enablement and allowed transitions.
- Screen contracts own screen membership and UI metadata.
- Domain policies own readiness, release, QA, cancellation, outsourcing, and delivery gates.
- Audit uses append-only order history and transactional outbox.
- No new direct status update endpoint may bypass the facade.
- Conditional rules use a controlled catalog and deterministic priority.
- Outsourcing jobs attach to selected items or pieces.
- Partial fulfilment uses release records and prevents duplicate release.
- Operational Ready does not automatically mean financially releasable.

## 3A. Locked configuration governance

- Workflow authoring, conditional rules, stage ordering, publishing, and retirement are HQ Platform responsibilities.
- Tenants do not receive a workflow designer in V1.
- Tenant onboarding uses an HQ-assigned default profile and requires no workflow setup.
- HQ may expose only a limited approved-profile selector or non-structural preferences.
- Tenant management of vendors, employees, services, branches, drivers, and racks remains supported.


## 3B. Locked state ownership

- Commercial lifecycle: order `commercial_status`.
- Operational summary: domain `operational_status`, physically stored in existing `current_status` during migration.
- Fulfilment summary: order `fulfilment_status`, derived from releases.
- Exception summary: order `exception_status`, derived from issues, holds, approvals, and exceptions.
- Custody summary: order `custody_summary_status`, derived from custody records and pieces/packages.
- Payment and invoice: Order Fin authority.
- Detailed stage: workflow instance/work group.
- Outsourcing: outsource jobs and lines.
- Collection/delivery: releases and delivery records.
- Customer status: small derived milestone catalog.
- `status` is temporary during cutover and is removed in the contract migration.
- `current_stage` is temporary compatibility data and shall not become permanent detailed truth.

## 4. Core user journeys

1. Normal walk-in order
2. Quick Drop order
3. Mixed-service order
4. Quality-controlled order
5. Outsourced item within a normal order
6. Partial customer collection
7. Partial driver delivery
8. Pay-on-collection release
9. B2B invoiced release
10. QA failure and internal rework
11. Failed delivery and return to branch
12. Cancellation and customer return
13. HQ workflow configuration draft, review, preview, test, assignment, and publish
14. Existing active order continuation after migration

## 5. Quality bar

Production readiness requires correctness, auditability, tenant isolation, predictable rollback, no duplicate effects, complete UI states, complete permissions, complete tests, RTL, and documented operations.
