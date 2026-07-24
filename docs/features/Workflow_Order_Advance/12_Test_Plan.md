# 12 — Test Plan

**Status:** P0 correction pass · **Date:** 2026-07-24

## 1. V1.0 mandatory scenarios

| # | Scenario |
|---|----------|
| T01 | Walk-in happy path to ready |
| T02 | Remote → confirm intake |
| T03 | Retail-only: **not** auto-closed; Fin/fulfilment paths |
| T04 | Quick drop → prep complete (no `sorting`) |
| T05 | Assembly scan gate |
| T06 | RELEASE blocked when Fin ineligible |
| T07 | Partial release no double-release |
| T08 | Cancel Fin unwind + engine |
| T09 | `CONFIRM_DELIVERY` atomic with POD (no separate POD finalize) |
| T10 | `409` on stale `expectedStateVersion` |
| T11 | Idempotency replay |
| T12 | Bulk/PATCH status denied or engine-only |
| T13 | Tenant cannot edit transitions (authz) |
| T14 | HQ assign → tenant effective profile read |
| T15 | Graph CI on seed |
| T16 | RLS isolation |
| T17 | Central outbox single emit (no duplicate notify) |
| T18 | EN/AR action labels |

## 2. V1.1 / V1.2 suites (planned, not V1.0 gate)

- Work groups mixed-service
- Stage execution retries
- Outsourcing send/receive/damage
- Custody aggregation
- Milestone projection
- Contract migration off legacy columns
- Offline driver stale version reconciliation (expanded)

## 3. Layers

Unit / integration / e2e / canary parity as in IMPLEMENTATION_PLAN.
