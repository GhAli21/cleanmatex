# Implementation Plan — Workflow Order Advance

**Version:** 0.4.3-p7r-stage-api-architecture
**Date:** 2026-08-14
**Scope lock:** [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)  
**Checkpoint:** [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md)

## 1. Objective

Ship **V1.0 production cutover** of a single app WorkflowEngine with HQ-authored config and action UX — then V1.1/V1.2 deepen platform capabilities without blocking safe go-live.

## 2. Preconditions

| Gate | Before |
|------|--------|
| ADR + correction pass docs aligned | P0 sign-off |
| Discovery SQL + outbox reuse decision signed | P1 |
| Writer inventory complete | P3 |

## 3. Work packages

### WP-P0c — Correction pass (current)

Align docs to ADR; mark P0 incomplete until checklist in §6 green.

### WP-P1 — Schema (additive-first)

- Add missing `sys_wf_*` catalogs / assignments / `state_version` / snapshot cols
- Rename **only** if required; prefer seed-from existing templates
- Full seed + graph CI + RLS
- **No** feature-specific outbox unless discovery fails reuse

### WP-P2 — Engine

`executeAction` + `listAvailableActions` + `state_version` + Fin gate + central outbox emit + logs

### WP-P2b — Screen integrations

`integ-*` for New Order → Delivery/Cancel (atomic `CONFIRM_DELIVERY`)

### WP-P3 — Writer cutover + canary

### WP-P4 — Release harden + public confirm-intake

### WP-P5 — Retire Legacy/Enhanced app paths

### WP-P6 — Tenant effective-profile UI + HQ assign consume; access contracts

### WP-P7R — Production stage API architecture and delivery hardening (reopened)

The release audit found that staff Delivery was still a screen-oriented composition of POD, stop, route, payment, and workflow writes. It is fail-closed until this work package is complete. The workflow engine stays authoritative for state transitions; P7R provides the reusable application boundary around it.

#### P7R.1 — Shared workflow-command contract

- Define versioned command request/result/error contracts for stage operations.
- Standardize authenticated actor and `tenant_org_id` context, permissions, input validation, idempotency keys, `state_version` concurrency, audit metadata, and central outbox emission.
- Keep transport adapters thin: web, mobile, and partner integrations call the same application command rather than reimplementing rules.

#### P7R.2 — Stage-owned services and API surfaces

- Establish one service boundary per operational stage: Preparation, Processing, Quality, Packing, Ready/Release, Pickup, and Delivery.
- Give each stage explicit versioned endpoints and DTO/schema contracts. Stage-specific gates and side effects live in that service; workflow status changes go through the engine.
- Inventory and retire direct screen/API writers after their service replacement is live. A disabled endpoint is not considered a completed architecture replacement.
- Resolve the most-specific active HQ workflow-profile assignment at order creation and snapshot its exact PUBLISHED profile/version into `org_orders_mst`. Preserve `workflow_template_id` only as compatible legacy lineage. Do not permit a configured but unpublished/retired profile to create an order silently.

#### P7R.2a — Profile-version runtime enforcement (P0 release blocker)

`sys_wf_prof_ver_scr_dtl` is the immutable per-version operating-screen allowlist. It is not a page registry and it must not be enforced only by hiding a sidebar item. Profile snapshots are now written for new orders; this package makes those snapshots effective at every operational boundary.

- Resolve the order's immutable `wf_profile_id` / `wf_version_no` before a worklist is queried, a screen contract is resolved, actions are listed, or an action is executed. Compose its enabled screens with the global `sys_wf_screen_status_cd`, `sys_wf_action_trans_cd`, transition, and gate catalogs. Global catalogs remain the graph authority; the profile determines which valid parts of that graph this order may use.
- Reject forged or stale requests for a disabled screen/action server-side with stable, localized error codes such as `PROFILE_SCREEN_DISABLED`; client navigation and button visibility are UX only, never security.
- Enforce the immutable version capabilities (`use_preparation_screen`, `use_assembly_screen`, `use_qa_screen`, `use_packing_screen`, piece tracking, split orders, and back steps) in initial-status resolution, routing/worklists, and every stage command. For snapshot orders, profile capability values win; do not merge conflicting Gen 1 template values.
- The semantic-only code cutover removes legacy compatibility resolution for orders with no complete profile snapshot. Migration `0464_require_semantic_order_snapshots.sql` prevents future incomplete active rows after operator application. Do not auto-backfill or silently rebind historic/test orders because that would change their in-flight policy; recreate the test orders under an assigned compiled profile instead. A subsequent HQ assignment or published version affects only newly created orders.
- Define and enforce assignment precedence for tenant, branch, and service scopes. One order receives one profile. If a multi-service order resolves to conflicting service profiles, fail creation with an actionable split-order message rather than choosing an item arbitrarily.
- Expose one server-derived workflow-context contract for web, mobile, and integration consumers: resolved profile/version, enabled screens, capabilities, and available actions. Stage navigation must show clear EN/AR unavailable-state guidance, guard deep links, and use accessible empty states, but must not reimplement policy.
- Add HQ assignment/version validation for active/PUBLISHED status, scope ambiguity, catalog compatibility, and audit history. The HQ Console owns authoring; tenant applications consume the approved runtime contract.

**P0 acceptance criteria:** a profile-disabled screen/action cannot be reached through UI, deep link, mobile client, or forged API request; reassignment/new publishing cannot alter an in-flight order's profile snapshot; invalid or ambiguous assignments fail deterministically; no operational workflow caller can resolve policy for an unsnapshotted order; tests cover tenancy, concurrency, scope precedence, legacy-fallback absence, and performance.

#### P7R.3 — Delivery first, atomic completion

- Implement a single atomic completion orchestration that verifies tenant-scoped route/stop ownership, authorization, evidence policy (POD/OTP), pay-on-collection settlement policy, workflow eligibility, and optimistic concurrency.
- In the same transaction, persist permitted evidence, settle or explicitly reject required collection, transition through the engine, update route/stop state and counters, write an audit record, and enqueue the integration event.
- Define idempotent replay behavior and rollback/error semantics. Do not expose a separate delivered-status writer or unauthorised POD writer.
- Build a driver/staff route manifest and stop-detail work experience on the Delivery API: assigned stops, route progress, customer/contact and order context, and a navigation-ready address. Do not add a screen-local status writer.
- Delivery route-manifest and stop-detail read contracts are implemented: the web-admin pages consume tenant-scoped `/api/v1/delivery/routes/{routeId}` and `/api/v1/delivery/stops/{stopId}` APIs, show payment/proof state, and deep-link to Financial Collection.
- The atomic stop-completion panel is implemented with configured signature/photo proof capture, remaining pay-on-collection amount, an existing Financial Collection deep link, gate explanations, idempotent retry receipts, and stale-version recovery. It uses the isolated atomic-completion rollout control; legacy Delivery writes remain fail-closed. Do not create a duplicate payment-collection screen. OTP remains deferred to VNext.
- Add one reusable proof-of-delivery and handover-audit view shared by Delivery and Order Details; it must show evidence, actor, time, payment state, and workflow outcome.
- Build a dedicated supervisor Workboard after Delivery proof/audit and before mobile/integration adapters. It aggregates configured in-flight stages with branch, assignee, priority, SLA/age, and blocker filters; it deep-links to the owner stage screen and may invoke only that stage's API. Add dedicated Workboard RBAC, an access contract, and dual-written navigation. Never add a raw status change control or another workflow writer.

#### P7R.3a — Pickup action-panel consistency

- Render **Make available for pickup**, **Confirm customer pickup**, and **Collect remaining payment** as context-aware first-class actions in one Ready Details action panel.
- The UI must retain the existing atomic pickup service/API; it must not add a generic status mutation or duplicate the pickup business rules in the screen.

#### P7R.3b — B2B fulfilment authorization

- Validate B2B credit when creating an order and reserve it durably where Finance supports reservation. At release and handover, revalidate the order's approved AR invoice and reservation rather than relying on the customer's remaining global credit.
- Show account-billed and AR invoice context instead of a cash-collection action. A physical payment remains an explicit Financial Collection operation, never a handover side effect.
- Record the authorized recipient, company/site, staff actor, handover time, note, release lines, and AR invoice reference.
- Disable anonymous public confirmation for B2B until an authenticated B2B-contact confirmation contract exists.
- Block partial B2B handover until Finance approves invoice/release allocation semantics; do not invent a prorated receivable in the pickup screen.

#### P7R.4 — Consumer cutover and controlled rollout

- Update web-admin to consume the new delivery API only. Mobile and third-party integration adapters must use the same versioned contract when introduced.
- Mobile and third-party integration adapters must pass authenticated tenant context, idempotency, and optimistic-concurrency values to the same stage API. They must never implement channel-specific delivery or workflow business logic.
- Convert the existing Processing, Quality, Packing, and Ready/Release screens to their respective stage services and APIs. These are cutovers of existing pages, not new duplicate dashboards.
- Keep legacy and bypass writers fail-closed until removal is safe; use a server-side rollout control, not a client-only visibility flag.
- Re-enable staff delivery only after the acceptance suite passes, a pilot tenant is signed off, monitoring is in place, and rollback is rehearsed.

**P7R exit criteria:** no direct workflow/status writers remain in stage screens; every command is tenant-scoped, authorized, idempotent, concurrency-safe, audited, and evented; Delivery passes unit/API/integration/concurrency/RBAC/tenant-isolation/payment regressions; S10 and pilot T01-T18 are signed; production checklist is green.

### WP-P7 — Harden / e2e / production checklist

### WP-V1.1 — Projections, stage executions, work groups MVP

### WP-V1.2 — Outsourcing + richer HQ designer (saas)

### WP-Final — `/documentation` full pack

## 4. Rollback

Flag off `workflow_engine_v2`; schema expand/contract runbook; pause outbox consumers if needed.

## 5. Skills when coding

`/database` `/frontend` `/i18n` `/backend` `/multitenancy` `/navigation` `/rebuild-ui-access-contract` `/documentation`

## 6. P0 sign-off checklist (correction)

- [x] ADR scope lock written
- [x] HQ config vs tenant viewer documented
- [x] state_version concurrency
- [x] Retail not auto-closed
- [x] Atomic CONFIRM_DELIVERY
- [x] Central outbox reuse
- [x] Rename policy softened
- [x] Stage execution as V1.1 target
- [x] Progress status = incomplete / correction
- [x] Discovery SQL executed & signed on **remote** — see [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md) (2026-07-25)
- [x] API gaps in 06 §9 closed or explicitly accepted (path inventory + HQ/release defer)
