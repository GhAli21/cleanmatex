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

#### P7R.3 — Delivery first, atomic completion

- Implement a single atomic completion orchestration that verifies tenant-scoped route/stop ownership, authorization, evidence policy (POD/OTP), pay-on-collection settlement policy, workflow eligibility, and optimistic concurrency.
- In the same transaction, persist permitted evidence, settle or explicitly reject required collection, transition through the engine, update route/stop state and counters, write an audit record, and enqueue the integration event.
- Define idempotent replay behavior and rollback/error semantics. Do not expose a separate delivered-status writer or unauthorised POD writer.

#### P7R.4 — Consumer cutover and controlled rollout

- Update web-admin to consume the new delivery API only. Mobile and third-party integration adapters must use the same versioned contract when introduced.
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
