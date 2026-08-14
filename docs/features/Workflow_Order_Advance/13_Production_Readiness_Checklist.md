# 13 — Production Readiness Checklist (V1.0)

**Status:** **NO-GO for V1.0 staff delivery**; public tracking contract remains available · **Date:** 2026-08-14

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
- [ ] Atomic staff Delivery command implemented but not release-approved: database-backed rollback, tenant-isolation, and concurrency tests still required
- [ ] POD method-specific evidence validation, OTP retry/expiry controls, and durable signature/photo storage
- [ ] Delivery route creation/counters/status changes are atomic, idempotent, and concurrency-safe
- [ ] `PAY_ON_COLLECTION` remaining-balance gate implemented in the P7R command; live collection composition and acceptance coverage remain required before staff rollout
- [ ] Delivery mutation RBAC and explicit tenant filtering verified by automated tests
- [ ] Central outbox; no duplicate notify
- [ ] Canary + rollback rehearsed
- [ ] Post-`0442` UI cannot hide engine actions through a client-only canary with no supported writer fallback
- [ ] Legacy `preparation` status rows are either normalized or mapped to order-control actions
- [x] Access contracts + i18n
- [x] Public token rollout applied (`0441`) and anonymous customer smoke completed
- [x] Legacy/enhanced RPC grants retirement migration `0442` applied locally and remotely — 2026-08-14
- [x] Focused hardening: 49 Jest tests and 2 anonymous Playwright tests passed
- [ ] Post-`0442` engine smoke passed in production
- [ ] T01–T18 pass on pilot tenants

## 2026-08-14 release audit verdict

Staff delivery is not production-ready. Direct **Mark delivered** controls are disabled as containment. The P7R atomic completion command now composes POD, stop/route, engine, history, and outbox writes, but its server rollout remains disabled until database-backed rollback, payment, evidence-storage, RBAC, tenancy, and concurrency acceptance tests pass. Public anonymous confirm-received remains governed by its separately approved contract and completed smoke.

## Explicitly not required for V1.0 go-live

- Full outsourcing module
- Work groups complete
- Dropping `current_status` column
- Tenant Workflow Studio graph editor
