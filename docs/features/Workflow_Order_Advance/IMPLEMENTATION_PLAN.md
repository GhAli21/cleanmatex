# Implementation Plan — Workflow Order Advance

**Version:** 0.3.0-p1-p2-engine  
**Date:** 2026-07-24  
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
- [ ] Discovery SQL executed & signed on **remote** — see [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md)
- [x] API gaps in 06 §9 closed or explicitly accepted (path inventory + HQ/release defer)
