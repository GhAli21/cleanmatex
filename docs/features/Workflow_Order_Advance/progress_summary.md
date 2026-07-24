# Progress summary — Workflow Order Advance

**Updated:** 2026-07-25  
**Overall:** Remote discovery **signed**; migrations applied; ready for **single-tenant canary**

## Accurate status

```text
ADR locked (engine-first V1.0)
Remote discovery signed: drift 0/64, no sorting, state_version live
Migrations 0427–0428 (+0431 membership fix, +0432 flag) applied local+remote
P2 engine + APIs + partial writers/UI in web-admin
Next: enable workflow_engine_v2 on one canary tenant and smoke
P3–P7 + final documentation pack remaining
```

## Completed

- [x] ADR + correction docs
- [x] Central outbox/idempotency reuse locked
- [x] Remote discovery signed ([DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md))
- [x] Migrations applied (operator) + types updated
- [x] `0427` catalogs + `state_version` + seeds
- [x] `0428` release mst/ln (Ready ≠ release)
- [x] `0431` membership gap fix; `0432` HQ flag `workflow_engine_v2`
- [x] `WorkflowEngine` `listAvailableActions` / `executeAction`
- [x] Prep / transition / POD / retail canary paths
- [x] `WorkflowActionBar` + prep complete UI path

## Remaining

- [ ] Product ack of ADR (optional)
- [ ] Canary smoke on one tenant (HQ flag or env)
- [ ] P3 remaining writers + canary ops
- [ ] P4 release harden + public confirm-intake
- [ ] P5 retire Legacy/Enhanced hot paths
- [ ] P6 tenant effective-profile UI + access-contract golden path
- [ ] P7 harden/e2e + production checklist
- [ ] Final `/documentation` pack

## Canary

HQ override `workflow_engine_v2` ON for pilot tenant, **or** `WORKFLOW_ENGINE_V2=true` + `NEXT_PUBLIC_WORKFLOW_ENGINE_V2=true`.

See [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md) · [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md).
