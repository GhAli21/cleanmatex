# 12 — Test Plan

**Status:** P7 hardening refreshed · **Date:** 2026-07-25

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
| T19 | Public tracking token route resolves opaque `/track/{token}` links and falls back cleanly while `0441` is unapplied |
| T20 | Public confirm-received shows pay-on-collection notice and disables once delivered |
| T21 | Staff `CONFIRM_PICKUP` is idempotent, tenant-scoped, blocks a pay-on-collection balance, fulfils its pickup release, and emits one workflow history/outbox result |
| T22 | A `ready_for_pickup` order without an active pickup release fails closed with `PICKUP_RELEASE_REQUIRED`; it must never manufacture an audit release during collection. |
| T23 | Local database integration proves direct and staged pickup handovers, `state_version_at` audit consistency, and the single-open-pickup-release database constraint after `0447` and `0448`. |
| T24 | Delivery evidence upload accepts only JPEG/PNG/WebP bytes, binds every receipt to one tenant and active stop, and removes the private object if receipt persistence fails. |
| T25 | Delivery completion rejects malformed, expired, cross-stop, duplicate, or over-limit evidence receipts and consumes valid receipts atomically with POD, stop, route, and workflow writes. |
| T26 | An order created under a tenant/branch assignment snapshots the exact active PUBLISHED profile/version; later HQ publish or reassignment does not alter that order. |
| T27 | Invalid, retired, unpublished, or ambiguous profile assignments fail order creation deterministically and write no partial order. |
| T28 | Server-side worklist, screen-contract, available-actions, and execute-action requests reject a profile-disabled screen/action even when invoked by a forged/deep-link/mobile request. |
| T29 | Profile capability flags gate initial routing, worklists, and commands; conflicting legacy template toggles cannot broaden a snapshot order's permissions. |
| T30 | Tenant, branch, and service assignment precedence is deterministic and tenant-isolated; a mixed-service order with conflicting service profiles is rejected or split according to the approved one-order/one-profile policy. |
| T31 | Historic orders without a profile snapshot retain documented legacy compatibility and are never auto-backfilled or rebound by profile reassignment. |
| T32 | Profile-context queries are indexed/bounded and preserve optimistic-concurrency, idempotency, audit, and outbox behavior under concurrent commands. |
| T33 | Delivery proof audit reads only the authenticated tenant's order/stops/POD/operator rows, signs only `{tenantId}/delivery/{stopId}/` private object keys, omits unavailable proof safely, and returns no workflow or money mutation. |
| T34 | Workboard API requires `workboard:read`, filters every `org_*` read by tenant, returns no transition command, and rejects invalid bounded query values including `ownerScreenKey`. |
| T35 | A pinned V2 order appears only when its pinned graph contains active `workboard` membership and an active owning stage; an unpinned order uses the live tenant contract fallback. |
| T36 | A Workboard row opens the owning stage screen; it cannot change status, money, release, evidence, or assignment from the Workboard. |
| T37 | Workboard summary-by-owner counts stay tenant-scoped, follow the active non-stage filters, and still show cross-stage queue totals after selecting one owner stage. |

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

## 4. Current automated coverage added on 2026-07-25

- `web-admin/__tests__/lib/utils/public-order-tracking.test.ts`
- `web-admin/__tests__/services/public-order-tracking.service.test.ts`
- `web-admin/__tests__/services/pickup-completion.service.test.ts`
- `web-admin/__tests__/api/v1/pickup-completion.route.test.ts`
- `web-admin/__tests__/auth/request-permission-auth.test.ts`
- `web-admin/__tests__/db-integration/pickup-handover.db.test.ts` (requires local `0447` and `0448`)
- `web-admin/__tests__/services/delivery-evidence.service.test.ts`
- `web-admin/__tests__/services/delivery-completion.service.test.ts`
- `web-admin/__tests__/api/v1/delivery-safety.route.test.ts`
- `web-admin/__tests__/services/delivery-proof-audit.service.test.ts`
- `web-admin/__tests__/api/v1/delivery-proof-audit.route.test.ts`
- `web-admin/__tests__/services/workboard-query.service.test.ts`
