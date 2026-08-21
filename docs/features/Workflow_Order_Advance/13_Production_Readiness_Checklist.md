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
- [x] New orders snapshot the active, valid tenant workflow profile/version when an assignment applies; historic orders intentionally remain unsnapshotted
- [ ] Profile-version enabled-screen enforcement is server-side for worklists, screen contracts, available actions, and command execution; disabled screens/actions reject forged requests
- [ ] Profile capability flags are server-side gates for initial routing, stage worklists, and commands; profile/template conflicts cannot silently merge
- [ ] Assignment precedence/ambiguity, mixed-service one-order/one-profile policy, HQ assignment audit, and published-version validation are covered
- [ ] Tenant navigation/deep links consume server-derived workflow context with EN/AR unavailable-state guidance
- [ ] No tenant graph editing
- [ ] Fin release gate server-side
- [x] Retail not auto-`closed`
- [ ] Atomic staff Delivery command implemented but not release-approved: database-backed rollback, tenant-isolation, and concurrency tests still required
- [x] Private POD evidence bucket, durable object keys, tenant-stop upload receipts, and method-specific receipt validation implemented (`0451`, `0452`)
- [x] Read-only delivery proof/audit is tenant-scoped, access-contract protected, and returns only time-limited authorized evidence links; it does not approve staff completion
- [ ] OTP retry/expiry controls intentionally deferred to VNext
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
- [ ] Profile runtime enforcement acceptance suite passes before enabling profile-governed operational flows

## 2026-08-14 release audit verdict

Staff delivery is not production-ready. Direct **Mark delivered** controls are disabled as containment. The P7R atomic completion command now composes POD, stop/route, engine, history, and outbox writes, but its server rollout remains disabled until database-backed rollback, payment, evidence-storage, RBAC, tenancy, and concurrency acceptance tests pass. The separate proof/audit read surface may be used to review completed handovers but cannot be treated as staff-delivery approval. Public anonymous confirm-received remains governed by its separately approved contract and completed smoke.

## Explicitly not required for V1.0 go-live

- Full outsourcing module
- Work groups complete
- Dropping `current_status` column
- Tenant Workflow Studio graph editor
