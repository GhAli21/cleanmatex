# 01 — Product Requirements Document

**Status:** P0 correction pass · **Date:** 2026-07-24  
**Scope lock:** [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)

## 1. Problem

Dual Legacy/Enhanced engines, dual status columns, hardcoded next-status maps, and bypass writers make production transitions unsafe. Operators need action-oriented screens; configuration must not be edited on the floor.

## 2. Goals (V1.0)

1. Single app `WorkflowEngine` as sole writer of operational transitions (cutover via `current_status`).
2. Floor UX: actions from `listAvailableActions` — no graphs, no raw status pickers.
3. **HQ-controlled** workflow profiles (author, validate, publish, assign). Tenant onboarding requires **no** workflow designer setup.
4. Initial status from `sys_wf_initial_rules` by `order_source_code` + modifiers (not screen `statuses[0]`).
5. Ready ≠ financial/physical release; Order Fin owns money eligibility; partial release via release records.
6. `state_version` concurrency; central outbox; writer inventory exit criteria; canary.
7. EN/AR + RTL; Cmx + `cmxMessage`.

## 3. Non-goals (V1.0) — deferred to V1.1 / V1.2

- Full multidimensional column cutover / drop `current_status` (V1.1 contract migration)
- Work groups MVP (V1.1)
- Full outsourcing jobs (V1.2)
- Rich HQ Platform designer UI in saas (V1.2); V1.0 uses HQ APIs + seed/admin publish path
- Tenant editing of transitions, statuses, gates, initial rules

## 4. Personas

| Persona | Needs |
|---------|--------|
| Floor staff | One primary action; clear blockers |
| Tenant admin | View effective profile; optional pick from HQ-approved list; manage ops data (vendors, racks, staff) — **not** state machine |
| HQ workflow admin | Author/publish/assign profiles |
| Platform ops | Discovery, canary, rollback |

## 5. Journeys (V1.0 acceptance)

1. Walk-in / POS / web_admin happy path through enabled stages → ready → pickup or delivery.
2. Remote source → confirm intake → happy path.
3. Quick Drop incomplete → prep complete → continue.
4. **Retail-only** → operationally completed path + Fin/fulfilment as applicable — **not** forced `closed` at create.
5. Partial collection/delivery via release records (no double-release).
6. Cancel/return: Fin unwind then engine action.
7. Delivery complete: single atomic `CONFIRM_DELIVERY` with POD evidence.

## 6. Acceptance criteria (V1.0)

- [ ] All active writers use `executeAction`
- [ ] Tenant cannot edit transition graph
- [ ] HQ can assign profile; tenant sees effective config read-only
- [ ] Fin blocks RELEASE_* server-side
- [ ] Retail create does not set `closed` unless closure policy says so
- [ ] Delivery finalize is one atomic command
- [ ] EN/AR action labels seeded

## 7. Related

- [02_Architecture.md](02_Architecture.md)
- [08_UI_UX_Screens.md](08_UI_UX_Screens.md)
