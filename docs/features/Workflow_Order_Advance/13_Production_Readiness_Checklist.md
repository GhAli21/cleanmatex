# 13 — Production Readiness Checklist (V1.0)

**Status:** **NO-GO for V1.0 routed staff POD (S10)**; Delivery floor confirm and public tracking remain available under their own gates · **Date:** 2026-08-27

## Design / P0

- [ ] ADR accepted by product/engineering
- [x] Discovery SQL signed (drift, flags, outbox reuse) — 2026-07-25
- [ ] Correction checklist in IMPLEMENTATION_PLAN §6 green

## Engineering go-live

- [ ] Additive schema + seed + graph CI + RLS
- [x] `state_version` enforced by engine commands
- [x] Zero production non-engine post-create transition writers in the application
- [x] New orders snapshot the active, valid tenant workflow profile/version when an assignment applies; historic orders intentionally remain unsnapshotted
- [x] Profile-version enabled-screen enforcement is server-side for worklists, screen contracts, available actions, and command execution; disabled screens/actions reject forged requests; profile-stamped orders without a compiled artifact fail closed instead of using a graph pin
- [ ] Profile capability flags are server-side gates for initial routing, stage worklists, and commands; profile/template conflicts cannot silently merge
- [x] Assignment precedence/ambiguity, mixed-service one-order/one-profile policy, HQ assignment audit, and published-version validation are covered
- [ ] Tenant navigation/deep links consume server-derived workflow context with EN/AR unavailable-state guidance
- [ ] No tenant graph editing
- [ ] Fin release gate server-side
- [x] Retail not auto-`closed`
- [x] Atomic staff Delivery command implemented; automated rollback, tenant-isolation, concurrency, RBAC, and replay tests pass. Not release-approved until S10 operator/e2e canary.
- [x] Private POD evidence bucket, durable object keys, tenant-stop upload receipts, and method-specific receipt validation implemented (`0451`, `0452`)
- [x] Read-only delivery proof/audit is tenant-scoped, access-contract protected, and returns only time-limited authorized evidence links; it does not approve staff completion
- [ ] OTP retry/expiry controls intentionally deferred to VNext
- [ ] Delivery route creation/counters/status changes are atomic, idempotent, and concurrency-safe
- [ ] `PAY_ON_COLLECTION` remaining-balance gate implemented in the P7R command; live collection composition and acceptance coverage remain required before staff rollout
- [x] Delivery mutation RBAC (`delivery:pod` + `orders:transition`) and explicit tenant filtering verified by automated tests
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

## 2026-08-27 release audit note

Staff **routed POD (S10)** is still not production-signed. Direct generic **Mark delivered** / `/actions` `CONFIRM_DELIVERY` remain forbidden. The Delivery floor now confirms from `/dashboard/delivery/{id}` using order-keyed complete when no stop exists, or the stop complete command when a stop exists. Dummy routes are not created. Legacy capturePOD/route writers stay `503`. Simple floor confirm depends on HQ leaving `delivery_stop_active` unbound on the published artifact. Public anonymous confirm-received remains governed by its separately approved contract.

## 2026-08-14 release audit verdict

Staff routed POD was not production-ready at this checkpoint. Direct **Mark delivered** controls were disabled as containment. The P7R atomic stop-completion command composes POD, stop/route, engine, history, and outbox writes. The separate proof/audit read surface may be used to review completed handovers but cannot be treated as staff-delivery approval. Public anonymous confirm-received remains governed by its separately approved contract and completed smoke.

## Explicitly not required for V1.0 go-live

- Full outsourcing module
- Work groups complete
- Dropping `current_status` column
- Tenant Workflow Studio graph editor
