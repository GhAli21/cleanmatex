# 12 — Test Plan

**Status:** T01–T18 traceability refreshed against real code/tests · **Date:** 2026-09-05

## 1. V1.0 mandatory scenarios

Verdict key: ✅ automated test proves it · 🟡 automated test exists but only proves part of the scenario · ⚠️ the mechanism exists in code but has zero automated test · ❌ real gap — automated test AND/OR mechanism missing.

| # | Scenario | Verdict | Automated evidence | Notes |
|---|----------|---------|---------------------|-------|
| T01 | Walk-in happy path to ready | 🟡 | None — no single test follows an order end-to-end to `ready`. Each stage transition (prep/processing/assembly/QA/packing/ready) has its own isolated test elsewhere. | Operator-attested via manual testing, not a regression test. A break in the chain (e.g. a stage wiring regression) would not be caught automatically. |
| T02 | Remote → confirm intake | 🟡 | `__tests__/api/v1/orders/confirm-physical-intake.route.test.ts` — `'uses the engine action and keeps the order update tenant-scoped'`, `'keeps an already received order idempotent without another engine action'`, `'maps an incomplete live-policy binding to HTTP 409'`. | Tests `CONFIRM_PHYSICAL_INTAKE` generically; not scoped to the `remote` order-source path specifically. |
| T03 | Retail-only: **not** auto-closed; Fin/fulfilment paths | 🟡 | `__tests__/services/order-create-workflow.service.test.ts:135` `'resolves POS retail to delivered with RETAIL_SOLD'`. | Only proves retail's *initial* status resolution (starts at `delivered`). Does not prove the actual claim — that retail still requires Fin/fulfilment before closing, i.e. is never silently auto-closed downstream. That guarantee itself is untested. |
| T04 | Quick drop → prep complete (no `sorting`) | 🟡 | `__tests__/services/workflow-engine.gates.test.ts:21` `'does not include sorting as an action'`. | Proves `sorting` isn't a valid action code catalog-wide, not a full quick-drop→prep-complete flow test. |
| T05 | Assembly scan gate | ⚠️ | **None found.** No test file exists for `app/api/v1/assembly/tasks/[taskId]/scan/route.ts` or `app/api/v1/assembly/[id]/complete/route.ts`. | Mechanism exists in `lib/services/assembly-service.ts`; zero automated coverage. |
| T06 | RELEASE blocked when Fin ineligible | ✅ | `__tests__/services/workflow-gate-evaluator.service.test.ts` — `'blocks semantic fulfilment gates when a pay-on-collection balance remains'` (`GATE_FIN_RELEASE`) + `'allows a settled pay-on-collection order within the shared money tolerance'`. | Solid, symmetric (block + allow) coverage. |
| T07 | Partial release no double-release | 🟡 | `__tests__/db-integration/pickup-handover.db.test.ts:330` `'the database rejects duplicate active pickup releases for the same tenant order'` (real DB unique-index proof). | Proves "no double release." The "partial" half is untested: the fail-closed guard for `release_type === 'partial'` (`pickup-completion.service.ts:207-211`, `PICKUP_PARTIAL_RELEASE_UNSUPPORTED`) has no test exercising it. |
| T08 | Cancel Fin unwind + engine | ✅* | `__tests__/services/workflow-cancel-guard.test.ts:128` `'cancels a paid order with REFUND and runs the financial unwind'`; real DB: `__tests__/db-integration/order-cancel-chain-flow.db.test.ts:177` `'REFUND disposition: unwind → initiateRefund → approveRefund → processRefund → real snapshot recalc, end to end'`. | *Important scope caveat (documented in that test's own header): this proves only the **legacy** cancel-money path, which is still the real/live/default path today. Workflow Engine V2's `CANCEL_ORDER` action has **no automatic Fin unwind** by ADR — money disposition there is deliberately explicit via Fin screens. Don't read this as "V2 cancel unwinds automatically." |
| T09 | `CONFIRM_DELIVERY` atomic with POD (no separate POD finalize) | ✅ | `__tests__/services/delivery-completion.service.test.ts` — 10 tests including `'consumes the exact tenant-stop receipt before committing the workflow transition'`, `'completes compiled POD confirmation without photo or signature uploads'`. | Solid, comprehensive. |
| T10 | `409` on stale `expectedStateVersion` | ✅ | `__tests__/db-integration/delivery-completion.db.test.ts:511` `'rejects a stale state version without mutating the stop'` (real DB, exercises the actual `VERSION_CONFLICT` check in `workflow-engine.service.ts:764`); HTTP mapping: `__tests__/api/v1/workflow-stage-command.route.test.ts:139` `'maps workflow version conflicts for a safe client retry'`. | Solid — both the real check and the HTTP status mapping are covered. |
| T11 | Idempotency replay | ✅ | `__tests__/db-integration/delivery-completion.db.test.ts:545` `'replays the same idempotency key without a second delivery write'` (real DB); `__tests__/api/v1/orders-transition.route.test.ts:71` `'does not re-notify when executeAction returns a cached idempotent replay'` (2026-09-05, new — also closes T17's duplicate-notify gap). | Solid. |
| T12 | Bulk/PATCH status denied or engine-only | ⚠️ | **None found** (`grep -rl "bulk-status" __tests__` empty). | Mechanism is real: `app/api/orders/bulk-status/route.ts` returns HTTP 410 `USE_WORKFLOW_ACTIONS` unconditionally; `app/api/v1/orders/[id]/route.ts` exposes no `PATCH` handler; `batch-update/route.ts` routes every status advance through `executeAction`. Correctly locked down in code, just untested. |
| T13 | Tenant cannot edit transitions (authz) | ⚠️ | **None found in this repo.** | Mechanism is real: `app/dashboard/settings/workflows/new` and `[id]/edit` redirect to the hub (legacy JSON editors retired); HQ-side (`cleanmatexsaas`) authoring writes return `LEGACY_WORKFLOW_RETIRED` via `rejectLegacyWorkflowMutation()`. No tenant-repo test asserts the redirect. |
| T14 | HQ assign → tenant effective profile read | ✅ | `__tests__/services/workflow-profile-resolution.service.test.ts:73` `'stamps the latest published version from an active tenant default assignment'` + 8 more in the same file (branch precedence, ambiguity rejection, Pilot-on-demo-tenant-only, fail-closed with no assignment). | Solid, comprehensive. |
| T15 | Graph CI on seed | ⚠️ | `__tests__/db-integration/wf-prof-ver-validate-live.db.test.ts` (e.g. `'returns every structural catalog code in one report'`) exercises the live-policy validator against seed data. | This is a jest DB test, **not a wired CI gate** — no `.github/workflows` pipeline and no `package.json` script runs it as a graph-validation check on every seed change. The scenario name overstates what exists. |
| T16 | RLS isolation | ❌ | `__tests__/tenant-isolation/rls-policies.test.ts` **mocks Supabase entirely** (`jest.mock('@/lib/supabase/server', ...)`) — its own comment admits "Real RLS enforcement is validated at the DB/integration level," which doesn't exist. DB-integration tests (`delivery-completion.db.test.ts:320` `'does not reveal another tenant stop'`, etc.) use Prisma with explicit `tenant_org_id` WHERE filters via a service-role client — that's **app-layer** filtering, not Postgres RLS-policy enforcement. No test found that runs as a non-service-role DB session and confirms RLS itself blocks a cross-tenant row. | Real gap. RLS policies exist in `supabase/migrations/**` but are unproven. |
| T17 | Central outbox single emit (no duplicate notify) | ✅ | **Closed 2026-09-05.** `__tests__/api/v1/orders-transition.route.test.ts` — 3 tests: fresh transition notifies once, idempotent replay does not re-notify, `NTF_ORDER_TRANSITION_NOTIFY=false` suppresses even a fresh notify. Root bug (legacy `/transition` route re-notified on every idempotent replay) fixed the same session — see CHANGELOG. | Was "later" in the prior pass; genuinely done now. |
| T18 | EN/AR action labels | ⚠️ | **None found** — no test exercises the Arabic branch. | Mechanism exists (`workflow-engine.service.ts` — `isArabic` branching building `message`/`message2` on every blocked-reason builder), just never asserted against `locale: 'ar'` in any test. |
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
| T35 | A semantic order appears only when its compiled artifact contains active `workboard` membership and an enabled primary-owner stage; an unsnapshotted order uses the live tenant contract fallback. A profile/version pin without an artifact is excluded. |
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
