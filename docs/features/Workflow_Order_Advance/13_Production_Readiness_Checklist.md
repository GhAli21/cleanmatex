# 13 — Production Readiness Checklist (V1.0)

**Status:** P0 correction pass · **Date:** 2026-07-24

## Design / P0

- [ ] ADR accepted by product/engineering
- [ ] Discovery SQL signed (drift, flags, outbox reuse)
- [ ] Correction checklist in IMPLEMENTATION_PLAN §6 green

## Engineering go-live

- [ ] Additive schema + seed + graph CI + RLS
- [ ] `state_version` enforced
- [ ] Zero non-engine writers
- [ ] HQ assign + tenant read-only effective profile
- [ ] No tenant graph editing
- [ ] Fin release gate server-side
- [ ] Retail not auto-`closed`
- [ ] Atomic `CONFIRM_DELIVERY`
- [ ] Central outbox; no duplicate notify
- [ ] Canary + rollback rehearsed
- [ ] Access contracts + i18n
- [ ] T01–T18 pass on pilot tenants

## Explicitly not required for V1.0 go-live

- Full outsourcing module
- Work groups complete
- Dropping `current_status` column
- Tenant Workflow Studio graph editor
