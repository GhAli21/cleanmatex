# 13 — Production Readiness Checklist (V1.0)

**Status:** **S10 staff routed POD canary SIGNED 2026-09-05** (see audit note below). Route planning is now hardened and owner-enabled after `0490`/`0491`; remaining V1.0 blockers are the `PAY_ON_COLLECTION` acceptance gate, central outbox, canary/rollback rehearsal, and T01–T18. Delivery floor confirm and public tracking remain available under their own gates · **Date:** 2026-08-27, updated 2026-09-05

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
- [x] Atomic staff Delivery command implemented; automated rollback, tenant-isolation, concurrency, RBAC, and replay tests pass. **S10 operator/e2e canary signed 2026-09-05** — see audit note.
- [x] Private POD evidence bucket, durable object keys, tenant-stop upload receipts, and method-specific receipt validation implemented (`0451`, `0452`)
- [x] Read-only delivery proof/audit is tenant-scoped, access-contract protected, and returns only time-limited authorized evidence links; it does not approve staff completion
- [ ] OTP retry/expiry controls intentionally deferred to VNext
- [x] Delivery route creation/counters/status changes are atomic, idempotent, tenant-scoped, and concurrency-safe; `0490` database backstop and 12-command DB-integration cases passed.
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

## 2026-09-05 release audit note — S10 SIGNED

Staff **routed POD (S10)** is now production-signed. Real operator (`admin@demo-laundry.example`, tenant `Demo Laundry LLC`), real UI (`/dashboard/delivery/routes/{route}/stops/{stop}`), real order (`ORD-20260903-0005`, `WF_V2_SIMPLE` v4, the live active profile assignment). Completed with POD method `NOTES` (no photo/signature required by this profile's delivery evidence policy). Verified atomically on remote: order `status → delivered`, `delivered_at` populated, `state_version` 3→4; stop `→ delivered`; route `→ completed`; `org_order_history` records `CONFIRM_DELIVERY` with a real idempotency key and actor. Route/stop were seeded via a one-off reviewed migration (`0490_s10_canary_route_seed.sql`) because `STAFF_DELIVERY_WRITES_ENABLED=false` still blocks route creation through the normal UI/API — that flag stays off pending a separate decision; only the isolated stop-completion command (already `true`) was exercised, which is what S10 actually needed to prove. Companion: the stale `delivery-completion.db.test.ts` DB-integration suite was found and fixed the same session (was silently failing 4/9 since Gate 4 due to a test-fixture gap, not a service bug) — now 9/9 passing, giving both automated and human-operator assurance for this command.

## 2026-09-05 route-planning rollout update

The owner confirmed `0491_nav_drivers_remove_driver_app_gate.sql` applied locally and remotely, then authorized the Phase 5 route-planning rollout. `STAFF_DELIVERY_WRITES_ENABLED=true` now enables only the hardened route command APIs. The legacy POD/OTP writers remain deleted; create, add, remove, cancel, and assignment stay tenant-scoped, permission-protected, CSRF-protected, transactional, and constrained by the active-stop uniqueness index. The Phase 4–5 browser scenario in `testing_guide_and_scenarios.md` is the required post-deploy evidence; no live execution result is recorded here yet.

## 2026-08-27 release audit note

Staff **routed POD (S10)** is still not production-signed. Direct generic **Mark delivered** / `/actions` `CONFIRM_DELIVERY` remain forbidden. The Delivery floor now confirms from `/dashboard/delivery/{id}` using order-keyed complete when no stop exists, or the stop complete command when a stop exists. Dummy routes are not created. Legacy capturePOD/route writers stay `503`. Simple floor confirm depends on HQ leaving `delivery_stop_active` unbound on the published artifact. Public anonymous confirm-received remains governed by its separately approved contract.

## 2026-08-14 release audit verdict

Staff routed POD was not production-ready at this checkpoint. Direct **Mark delivered** controls were disabled as containment. The P7R atomic stop-completion command composes POD, stop/route, engine, history, and outbox writes. The separate proof/audit read surface may be used to review completed handovers but cannot be treated as staff-delivery approval. Public anonymous confirm-received remains governed by its separately approved contract and completed smoke.

## Explicitly not required for V1.0 go-live

- Full outsourcing module
- Work groups complete
- Dropping `current_status` column
- Tenant Workflow Studio graph editor
