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

## 10. Staff Delivery private evidence and completion (P7R, server-disabled)

`POST /api/v1/delivery/stops/{stopId}/evidence`

This authenticated multipart endpoint accepts `file` and `evidenceType` (`signature` or
`photo`). It requires `delivery:pod` and `orders:transition`, validates CSRF, verifies
the target stop under the resolved tenant, validates the binary JPEG/PNG/WebP signature,
and stores the object in the private `delivery-pod-evidence` bucket. It returns a
short-lived receipt, never an object or signed URL:

```json
{
  "success": true,
  "data": {
    "evidenceId": "b707421f-9f6b-4fd6-a8ab-dddc683b3b45",
    "evidenceType": "signature",
    "contentType": "image/png",
    "fileSizeBytes": 12345,
    "expiresAt": "2026-08-15T08:30:00.000Z"
  }
}
```

The receipt is tenant- and stop-bound in `org_dlv_ev_uploads_tr`, expires after 30
minutes, and is marked `consumed` inside the same transaction as completion. The atomic
completion capability has its own rollout guard, separate from legacy Delivery writes,
so enabling it cannot reopen older route or POD mutation endpoints.

`GET /api/v1/delivery/pod-methods`

Returns the active, staff-supported proof methods from `sys_dlv_pod_method_cd` for
web, mobile, and integration adapters. It requires `delivery:pod` and
`orders:transition`. `OTP` is deliberately excluded until its expiry, retry, resend,
and audit controls are released as a complete capability. The completion command
validates the chosen code again and never trusts a client-side method list.

`POST /api/v1/delivery/stops/{stopId}/complete`

This is the only target staff command for completing a delivery. It is a stage-owned application service, not a UI-specific status writer. The server resolves the authenticated tenant and actor, requires `delivery:pod` and `orders:transition`, and validates CSRF. Its rollout guard is intentionally independent of legacy Delivery write endpoints.

Headers: authenticated session and standard CSRF protection. Body:

```json
{
  "expectedStateVersion": 12,
  "idempotencyKey": "delivery-complete-9d4d5d06",
  "podMethodCode": "MIXED",
  "podNotes": "Customer confirmed all pieces at the front door.",
  "signatureEvidenceId": "b707421f-9f6b-4fd6-a8ab-dddc683b3b45",
  "photoEvidenceIds": ["48788923-ec98-4a92-ab9f-c74d29992d2b"]
}
```

The command locks the tenant-scoped stop, route, order, and unexpired evidence receipts;
blocks a remaining `PAY_ON_COLLECTION` balance; writes/upserts POD object keys; marks
receipts consumed; marks the stop delivered; executes engine `CONFIRM_DELIVERY`;
recomputes route counters/status; writes workflow history and outbox events; and stores a
replay response. All of those writes share one transaction.

Method evidence policy currently enforced by the command:

| POD method | Required evidence |
|---|---|
| `SIGNATURE` | One valid signature evidence receipt |
| `PHOTO` | At least one valid photo evidence receipt |
| `MIXED` | Signature and at least one photo |

Errors: `400 INVALID_REQUEST`, `404 STOP_NOT_FOUND`, `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `409 IDEMPOTENCY_IN_FLIGHT`, `409 STOP_ALREADY_DELIVERED`, `422 POD_METHOD_INVALID`, `422 POD_EVIDENCE_REQUIRED`, `422 POD_EVIDENCE_INVALID`, `422 DELIVERY_COLLECTION_REQUIRED`, `503 DELIVERY_HARDENING_REQUIRED`.

The command does not accept payment legs. A due balance must be collected through the existing Order Fin collection contract before delivery is retried; this preserves a single auditable money-write path. Private storage receipt validation is implemented; database-backed completion rollback, tenant-isolation, and concurrency tests remain release gates. OTP expiry/retry controls are intentionally deferred to VNext; this release must use configured `SIGNATURE`, `PHOTO`, or `MIXED` proof methods only.

### 10.1 Delivery proof and handover audit (P7R)

`GET /api/v1/delivery/orders/{orderId}/proof`

This read-only, tenant-scoped contract is the single delivery-proof source for both
the Delivery stop workspace and Order Details. It requires `orders:read`; the Delivery
workspace retains its additional `drivers:read` page gate. It returns the order
workflow outcome, payment state, completed delivery stops, verified operator, handover
time/notes, and evidence links.

Private evidence object keys never leave the server. For an object in the exact
`{tenantId}/delivery/{stopId}/` scope, the service issues a five-minute signed URL at
read time. Invalid/missing private evidence does not fail the audit response; it is
omitted and logged. Legacy HTTP(S) proof URLs remain readable only as a compatibility
fallback. The UI can refresh links after expiry; no URL is written back to the database.

This read contract is available independently of the staff delivery-completion rollout.
It does not enable `POST /api/v1/delivery/stops/{stopId}/complete`, create evidence,
or mutate an order. Completion remains subject to its separate P7R assurance gates.

Errors: `403 FORBIDDEN`, `404 ORDER_NOT_FOUND`. The contract does not mutate the
workflow, payment, POD, release, or delivery-stop state.

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

## 13. Workboard read model

`GET /api/v1/workboard/orders` requires `workboard:read` and accepts bounded
`page`, `pageSize`, `search`, `branchId`, `assigneeId`, `priority`,
`ownerScreenKey`, `blocker`, `sla`, and `sort` query parameters.

`sort` supports server-side ordering for order number, customer, stage, age,
ready-by, priority, and assignee in ascending or descending direction.

The response remains read-only and tenant-scoped. It returns:

- paginated Workboard rows,
- queue summary counts for the active filter set,
- `summary.byOwner` stage-owner totals for the quick-focus cards,
- filter options,
- configuration gaps, and
- an owner-stage path for each row.

It has no mutation endpoint.

For an order pinned to `wf_profile_id` + `wf_version_no`, the service evaluates
the pinned graph's `workboard` membership and its stage-owner membership. It
uses the tenant screen contract only for legacy/unpinned orders or documented
missing-pin fallback. A status without an active owner is excluded and returned
as a configuration gap rather than guessed or mutated.
