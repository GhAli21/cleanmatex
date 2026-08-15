# 06 — API Contracts

**Status:** P7R stage-command contracts started for Preparation and Delivery; staff delivery rollout remains disabled · **Date:** 2026-08-14
Routes below are **target contracts** for V1.0; align to existing `/api/v1/orders/...` style in P2 implementation. Gaps listed at end must be closed before P0 sign-off.

## 1. Available actions

`GET /api/v1/orders/{orderId}/available-actions?screen={screenKey}`

```json
{
  "stateVersion": 12,
  "actions": [
    {
      "actionCode": "COMPLETE_PREPARATION",
      "label": "Complete preparation",
      "label2": "إكمال التحضير",
      "enabled": false,
      "blockedReasons": [
        { "code": "GATE_PREP_INCOMPLETE", "message": "…", "message2": "…" }
      ]
    }
  ]
}
```

## 2. Execute action

`POST /api/v1/orders/{orderId}/actions`

Headers: `Idempotency-Key` (required)

```json
{
  "screen": "driver_delivery",
  "actionCode": "CONFIRM_DELIVERY",
  "expectedStateVersion": 12,
  "input": {
    "pod": { "photoIds": [], "signatureId": null, "notes": null },
    "releaseId": null
  }
}
```

```json
{
  "orderId": "…",
  "currentStatus": "delivered",
  "stateVersion": 13,
  "effects": ["history", "outbox"]
}
```

**Errors:** `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `422 GATE_FAILED` (+ reasons), `403 FORBIDDEN`, `404 NOT_FOUND`.

## 3. Worklist

Existing orders list filtered by screen membership (`current_status IN …`).

## 4. Create

Existing create; must call `InitialStatusResolver`; persist source/type/snapshot/`state_version=1`. No retail→`closed` shortcut.

## 5. Release (V1.0)

| Method | Path (target) | Purpose |
|--------|---------------|---------|
| POST | `/api/v1/orders/{id}/releases` | Create partial/full release intent |
| GET | `/api/v1/orders/{id}/releases` | List releases |
| POST | `/api/v1/orders/{id}/actions` + `RELEASE_*` | Advance after Fin OK |

Release body (target): lines (item/piece ids), channel (`pickup`|`delivery`), amounts TBD with Fin.

## 6. HQ profile APIs (V1.0 — may be saas + tenant consume)

| Capability | Notes |
|------------|--------|
| Publish profile version | HQ |
| Assign profile to tenant/service/branch | HQ |
| List approved profiles for tenant | Tenant read |
| Get effective profile | Tenant read |

Exact HQ OpenAPI: document in cleanmatexsaas integration contract; tenant app consumes via HQ API (no direct `sys_feature_flags_*` / stng tables).

## 7. Public confirm-received (tracking link)

| Item | Value |
|------|--------|
| Customer page | `GET /track/{token}` |
| Legacy page | `GET /public/orders/{tenantId}/{orderNo}` redirects to `/track/{token}` when a valid active token exists |
| Canonical path | `POST /api/v1/public/track/{token}/confirm-received` |
| Legacy compatibility | `POST /api/v1/public/orders/{tenantId}/{orderNo}/confirm-received` remains available during rollout and old readable page links redirect to `/track/{token}` when a token exists |
| Auth | None (public link); IP rate limit |
| Allowed from | `ready`, `out_for_delivery` (idempotent if already `delivered`) |
| V2 action | `CONFIRM_DELIVERY` on screen `public_tracking` |
| Actor | System user `WORKFLOW_SYSTEM_ACTOR` (`0437`) — satisfies history FK |
| Flag off | Legacy `WorkflowService.changeStatus` with same system actor UUID |
| Payment notice | Read APIs also expose `payment_type_code`, `outstanding_amount`, and `pay_on_collection_amount` so the public page can warn before confirm |

Staff physical intake remains `POST …/confirm-physical-intake` → `CONFIRM_PHYSICAL_INTAKE` (authenticated).

## 8. Mobile / cmx-api

V1.0: use same action APIs; **no second transition surface**. Offline: must send `expectedStateVersion`; 409 → refresh actions.

## 9. Preparation completion (P7R, active)

`POST /api/v1/preparation/{orderId}/complete`

This is the versioned adapter for the shared Preparation completion command. It requires an authenticated session, CSRF validation, `orders:update`, `orders:transition`, and an `Idempotency-Key` header. The request body may supply `expectedStateVersion`; otherwise the adapter reads the current state version before execution.

```json
{
  "expectedStateVersion": 7,
  "readyByOverride": "2026-08-15T13:00:00.000Z",
  "internalNotes": "Items checked and prepared."
}
```

The command locks the tenant-scoped order, verifies Preparation is active, calculates or validates `ready_by`, persists stage metadata, executes `COMPLETE_PREPARATION`, and caches the response for replay. The stage write and workflow/history/outbox write share one Prisma transaction, so an engine rejection rolls back the ready-by and note change too. The workflow engine remains the sole workflow-status writer.

Errors: `400 IDEMPOTENCY_KEY_REQUIRED`, `404 ORDER_NOT_FOUND`, `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `409 IDEMPOTENCY_IN_FLIGHT`, `422 PREPARATION_NOT_ACTIVE`, `422 GATE_FAILED`, `403 ACTION_NOT_ALLOWED`.

The legacy server action is an authenticated compatibility adapter only. It ignores client-supplied tenant/user arguments and resolves both from the server session before invoking the same command.

## 10. Staff Delivery completion (P7R, server-disabled)

`POST /api/v1/delivery/stops/{stopId}/complete`

This is the only target staff command for completing a delivery. It is a stage-owned application service, not a UI-specific status writer. The server resolves the authenticated tenant and actor, requires `delivery:pod` and `orders:transition`, validates CSRF, and currently responds with `503 DELIVERY_HARDENING_REQUIRED` until the release gates are complete.

Headers: authenticated session and standard CSRF protection. Body:

```json
{
  "expectedStateVersion": 12,
  "idempotencyKey": "delivery-complete-9d4d5d06",
  "podMethodCode": "MIXED",
  "signatureUrl": "private/pod/signature.png",
  "photoUrls": ["private/pod/photo-1.jpg"]
}
```

The command locks the tenant-scoped stop, route, and order; validates a configured POD method; blocks a remaining `PAY_ON_COLLECTION` balance; writes/upserts POD evidence; marks the stop delivered; executes engine `CONFIRM_DELIVERY`; recomputes route counters/status; writes workflow history and outbox events; and stores a replay response. All of those writes share one transaction.

Method evidence policy currently enforced by the command:

| POD method | Required evidence |
|---|---|
| `SIGNATURE` | Non-empty `signatureUrl` |
| `PHOTO` | At least one non-empty `photoUrls` entry |
| `MIXED` | Signature and at least one photo |

Errors: `400 INVALID_REQUEST`, `404 STOP_NOT_FOUND`, `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `409 IDEMPOTENCY_IN_FLIGHT`, `409 STOP_ALREADY_DELIVERED`, `422 POD_METHOD_INVALID`, `422 POD_EVIDENCE_REQUIRED`, `422 DELIVERY_COLLECTION_REQUIRED`, `503 DELIVERY_HARDENING_REQUIRED`.

The command does not accept payment legs. A due balance must be collected through the existing Order Fin collection contract before delivery is retried; this preserves a single auditable money-write path. Signed URL/storage ownership validation and database-backed integration testing are remaining release gates. OTP expiry/retry controls are intentionally deferred to VNext; this release must use configured `SIGNATURE`, `PHOTO`, or `MIXED` proof methods only.

## 11. Staff counter pickup completion (P7R, active)

`POST /api/v1/pickup/orders/{orderId}/complete`

This is the sole staff, mobile, and integration command for confirming that a
customer physically collected an order. The authenticated command supports both
the staged `ready_for_pickup` handover and an explicit direct counter handover
from `ready` when the customer is present. Browser calls authenticate through the
server session and require CSRF validation. Mobile and integration calls send an
authenticated tenant-user Supabase bearer JWT; they do not use CSRF, but must pass
the same `orders:transition` permission check under that JWT. It does not accept
tenant, actor, or payment data from the caller.

```json
{
  "expectedStateVersion": 12,
  "handoverNotes": "Collected at the branch counter."
}
```

The command locks the tenant-scoped order and open pickup releases, accepts
`ready_for_pickup` for the staged route or `ready` for the authenticated direct
counter route, blocks a remaining `PAY_ON_COLLECTION` balance, rejects unresolved
partial-release records, and requires an existing active pickup release for the
staged route. It fulfils that release, or creates and fulfils one audit record for a
direct handover, then calls `CONFIRM_PICKUP` on `pickup_handover` in the same
transaction. The staged route is `ready_for_pickup` → `delivered`; the direct
counter route is `ready` → `delivered`. It writes workflow history/outbox through
the engine and stores a replay-safe response under the endpoint idempotency resource.

Errors: `400 INVALID_REQUEST|IDEMPOTENCY_KEY_REQUIRED`, `401 UNAUTHORIZED`,
`403 ACTION_NOT_ALLOWED`, `404 ORDER_NOT_FOUND`, `409
VERSION_CONFLICT|IDEMPOTENCY_CONFLICT|IDEMPOTENCY_IN_FLIGHT`, `422
ORDER_NOT_READY|PICKUP_RELEASE_REQUIRED|PICKUP_COLLECTION_REQUIRED|PICKUP_PARTIAL_RELEASE_UNSUPPORTED`,
and `503 AUTHORIZATION_CHECK_UNAVAILABLE`.

`GET /api/v1/orders` and `GET /api/v1/orders/{id}/state` return a
`pickupRelease` read model derived from tenant-scoped release records. Its
`not_released` and `available_for_pickup` values retain the release audit
timestamp, while `current_status = ready_for_pickup` is the canonical workflow
state after release. All staff and future mobile clients therefore display the
same physical availability. Public tracking exposes only the safe boolean
`pickupAvailability.availableForPickup`; it never exposes a rack or staff data.

For public confirmation, a Ready for Pickup order must already have an active pickup
release. The public adapter then delegates to the same atomic pickup-completion
service using the workflow system actor, with `requireReleasedPickup = true`; it
cannot use the authenticated direct-counter route from `ready`. This prevents an
opaque link from manufacturing a release or bypassing the counter/payment gate.

Integration credentials must be a dedicated, least-privilege tenant user with
`orders:transition`; never use a Supabase service-role key for this endpoint. The
caller must retain and retry the same idempotency key after a timeout. Invalid order
IDs and unexpected request fields return `400 INVALID_REQUEST` before any command,
workflow, or audit write is attempted.

## 12. P0 sign-off gaps

- [x] state_version contract
- [x] blocker reason shape
- [ ] Staff Delivery endpoint and atomic transaction implemented, but server rollout and database-backed atomicity/evidence/payment tests remain pending
- [x] Existing path inventory (baseline for P2 align) — see below
- [ ] HQ OpenAPI link once saas contract exists (**accepted defer** to HQ integration doc)
- [ ] Release JSON schema finalized with Fin (**accepted defer** to P4 with Fin owners)

### Existing path inventory (remote-facing app today)

| Path | Today | V1.0 target |
|------|-------|-------------|
| `POST /api/v1/orders/[id]/transition` | Legacy + Enhanced fork | `POST …/actions` (`executeAction`) |
| `GET /api/v1/workflows/screens/[screen]/contract` | Screen contract | Membership + available-actions |
| `POST /api/v1/preparation/[id]/complete` | Writes toward `sorting` | `COMPLETE_PREPARATION` |
| `POST /api/v1/orders/[id]/batch-update` | May auto-ready | Engine action only |
| `GET /api/dashboard/workflow-stats` | Legacy-shaped | Membership aggregates |
| Public/staff confirm-intake routes | Legacy | `CONFIRM_PHYSICAL_INTAKE` |

Exact OpenAPI path freeze happens in P2 when routes are implemented; inventory above is sufficient for P0 design sign-off.

## 10. Related

- [05_Business_Rules_and_Gates.md](05_Business_Rules_and_Gates.md)
