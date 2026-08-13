# 13 — Production Readiness Checklist (V1.0)

**Status:** Repository implementation complete; post-deploy acceptance open · **Date:** 2026-08-13

## Design / P0

- [ ] ADR accepted by product/engineering
- [x] Discovery SQL signed (drift, flags, outbox reuse) — 2026-07-25
- [ ] Correction checklist in IMPLEMENTATION_PLAN §6 green

## Engineering go-live

- [ ] Additive schema + seed + graph CI + RLS
- [x] `state_version` enforced by engine commands
- [x] Zero production non-engine post-create transition writers in the application
- [ ] HQ assign + tenant read-only effective profile
- [ ] No tenant graph editing
- [ ] Fin release gate server-side
- [x] Retail not auto-`closed`
- [x] Atomic engine `CONFIRM_DELIVERY`
- [ ] Central outbox; no duplicate notify
- [ ] Canary + rollback rehearsed
- [x] Access contracts + i18n
- [x] Public token rollout applied (`0441`) and anonymous customer smoke completed
- [x] Legacy/enhanced RPC grants retirement migration `0442` applied locally and remotely — 2026-08-14
- [x] Focused hardening: 49 Jest tests and 2 anonymous Playwright tests passed
- [ ] Post-`0442` engine smoke passed in production
- [ ] T01–T18 pass on pilot tenants

## Explicitly not required for V1.0 go-live

- Full outsourcing module
- Work groups complete
- Dropping `current_status` column
- Tenant Workflow Studio graph editor
