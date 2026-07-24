# Progress summary — Workflow Order Advance

**Updated:** 2026-07-24 (overnight)  
**Overall:** P0 still **unsigned** on remote discovery; P1–P2b **implemented in repo** (migrations not applied)

## Accurate status

```text
ADR locked (engine-first V1.0)
P1 migration files ready (0427, 0428) — await human apply
P2 WorkflowEngine + APIs in web-admin
P2b partial wire: prep, transition canary, delivery POD, retail create
Remote discovery SQL still pending MCP execute_sql
P3–P7 + final documentation pack remaining
```

## Completed

- [x] ADR + correction docs
- [x] Central outbox/idempotency reuse locked
- [x] `0427` catalogs + `state_version` + seeds (incl. no sorting path)
- [x] `0428` release mst/ln (Ready ≠ release)
- [x] `WorkflowEngine` `listAvailableActions` / `executeAction`
- [x] `GET …/available-actions`, `POST …/actions`
- [x] Prep complete: engine path + legacy bridge → `processing` (never `sorting`)
- [x] Transition canary when `actionCode` + flag
- [x] POD capture → `CONFIRM_DELIVERY` when flag on
- [x] Retail create uses initial rules (not `closed`) when flag on
- [x] `useWorkflowActions` hook + access-contract API deps
- [x] Overnight checkpoint doc

## Blocked / remaining

- [ ] Sign remote discovery ([DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md))
- [ ] You apply migrations 0427/0428 + product ack of ADR
- [ ] P3 writer elimination + canary ops
- [ ] P4 release harden + public confirm-intake
- [ ] P5 retire Legacy/Enhanced hot paths
- [ ] P6 tenant effective-profile UI + full access-contract golden path
- [ ] P7 harden/e2e + production checklist
- [ ] Final `/documentation` pack

## Canary

`WORKFLOW_ENGINE_V2=true` (+ optional `NEXT_PUBLIC_WORKFLOW_ENGINE_V2=true`)

See [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md).
