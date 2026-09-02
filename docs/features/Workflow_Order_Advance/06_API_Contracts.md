# 06 — API Contracts

**Status:** Live normalized profile-version runtime is the tenant policy source. Stage-command contracts remain active for Preparation, Processing, Assembly, QA, Packing, Ready/Release, Pickup, and Delivery (order-keyed or stop-owned). Warning/override gate decisions persist `profile_version_id`. Public confirm maps `PROFILE_*` to HTTP 409. Staff S10 routed POD canary remains unsigned · **Date:** 2026-08-29
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
      ],
      "gateDecisions": [
        {
          "gateCode": "rack_required",
          "result": "WARNING",
          "messageKey": "workflow.gates.rack.warning",
          "acknowledgementChallenge": "short-lived-hmac-token"
        }
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
  "screen": "ready_release",
  "actionCode": "RELEASE_FOR_PICKUP",
  "expectedStateVersion": 12,
  "input": {
    "rackLocation": "R-12"
  },
  "gateDecisions": [
    {
      "gateCode": "rack_required",
      "acknowledgementChallenge": "short-lived-hmac-token"
    },
    {
      "gateCode": "fin_release_eligible",
      "overrideReason": "Supervisor approved a documented exception."
    }
  ]
}
```

Staff ActionBar submits `gateDecisions` after the server returned `WARNING` or `OVERRIDABLE` on available-actions. The execute command re-evaluates live facts, verifies the HMAC challenge or override permission/reason, inserts `org_wf_gate_decision_mst`, and emits `WORKFLOW_GATE_DECISION_ACCEPTED`. Stable errors: `WF_GATE_HARD_BLOCKED` (422), `WF_GATE_ACK_REQUIRED` (422), `WF_GATE_ACK_INVALID` (422), `WF_GATE_OVERRIDE_FORBIDDEN` (403), `WF_GATE_OVERRIDE_REASON_INVALID` (422), `WF_GATE_EVALUATION_STALE` (409). Public tracking never accepts warning or override.

Staff delivery `GET /api/v1/delivery/pod-methods?stopId=` returns catalog methods for historic orders, or the compiled `SIGNATURE` / `PHOTO` / `MIXED` / `POD` / `NOTES` subset for semantic snapshot stops. OTP is never listed.

```json
{
  "orderId": "…",
  "currentStatus": "delivered",
  "stateVersion": 13,
  "effects": ["history", "outbox"]
}
```

**Errors:** `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `422 GATE_FAILED` (+ reasons), `400 REASON_REQUIRED`, `400 UNSUPPORTED_GATE_MODE`, `400 EVIDENCE_RUNTIME_UNAVAILABLE`, `409 PROFILE_SNAPSHOT_INCOMPLETE|PROFILE_ARTIFACT_UNAVAILABLE|PROFILE_ARTIFACT_INVALID|PROFILE_EXECUTION_INVALID`, `403 FORBIDDEN`, `404 NOT_FOUND`.

For an order bound to a live profile version, the engine loads policy through `WorkflowPolicyResolver` (normalized profile-version rows). It checks screen membership, action edge, and the **server-assigned** command channel. An ordinary command requires an enabled `primary_owner` module and an `owner` status membership; observer visibility is read-only. An enabled `cross_cutting_command` module is the deliberate exception for a separately declared command surface such as `public_tracking`; it still requires a declared membership, execution edge, and permitted server-assigned channel. The service does not re-resolve the tenant assignment or read compiled artifacts, graph pins, templates, or action-catalog configuration as runtime fallback. Unbound orders fail closed with typed `PROFILE_*` codes.

**Channel (server-derived, never from the client body or a channel header):**

| Credential / adapter | Channel |
|---|---|
| Cookie session on generic staff APIs (`/actions`, `/transition`, stage commands, available-actions) | `staff_web` |
| `Authorization: Bearer` JWT on those same adapters | `mobile` |
| Public tracking confirm of OFD | `public_web` on screen `public_tracking` |
| Public tracking confirm of released pickup | pickup service / `pickup_handover` (0472 binds `CONFIRM_PICKUP` to `staff_web`+`pos`, not `public_web`) |
| Cookie session on pickup complete, confirm-physical-intake, and delivery complete **and** a tenant-scoped `OPEN` POS session for that actor (order branch must match when the adapter has it) | `pos` |
| Cookie session on those fulfilment adapters without an OPEN till, or POS lookup failure | `staff_web` |
| Paused POS session, or OPEN till at another branch | `staff_web` |

A client-supplied `channel` field is ignored (stripped). Bearer credentials cannot escalate to `staff_web` or `pos`. Generic `/actions` never becomes `pos` even if a till is open — that would mislabel processing/QA. 0472 floor execute rows (processing, packing, QA, …) are `staff_web` only, so a mobile bearer completing processing receives `403 ACTION_NOT_ALLOWED` until HQ publishes a version that includes `mobile`.

`public_tracking` OFD confirm uses `channel=public_web`. Integrity failures (`PROFILE_*`) map to HTTP `409` on public confirm, stage commands, `/actions`, `/transition`, available-actions, pickup, and confirm-physical-intake. `ACTION_NOT_ALLOWED` maps to `403`. Structured `wf.*` observe events record tenant/order/channel/outcome only — never tracking tokens, notes, proof keys, or money. Support diagnosis: [technical_docs/live_runtime_support.md](technical_docs/live_runtime_support.md).

Semantic hard-block gates are evaluated from tenant-scoped facts read under the command transaction lock. `rack_required`, preparation gates, `fin_release_eligible`, piece/QA gates, pickup/delivery collection, pickup-release, delivery-stop, and POD-evidence therefore return identical `GATE_FAILED` reasons during action discovery and command execution, except `pod_evidence_valid` which is discovery-allowed and execute-enforced from command input. A positive outstanding balance returns `GATE_FIN_RELEASE`. Missing piece/QA/fulfilment facts return `GATE_FACTS_UNAVAILABLE` in semantic mode. `CREDIT_INVOICE` invokes the B2B fulfilment payment-hold seam; its current result is non-blocking because order creation owns the existing B2B credit decision. Clients must not implement B2B finance policy: the future B2B feature will replace the seam with its own durable policy without changing this workflow contract. Partial fulfilment, returns, and OTP proof remain fail closed.

### 2.1 Workflow context compatibility read

`GET /api/v1/orders/{id}/workflow-context` remains a read-only compatibility endpoint for existing floor-page context displays. For a live-bound order it returns the pinned profile/version and enabled module keys. Its `assembly_enabled`, `qa_enabled`, and `packing_enabled` booleans are display hints, never a destination-selection contract. A missing or invalid live binding returns the typed `PROFILE_*` code with HTTP `409`; it never falls back to compiled artifacts or mutable templates.

## 3. Worklist

`GET /api/v1/orders?workflow_screen={screenKey}`

Floor queues (Preparation, Processing, Assembly, QA, Packing, Ready, Delivery) send `workflow_screen` instead of a client-computed `status_filter`. The server includes an order when that screen is a member of the order's **live profile-version** policy:

- live version binding → module membership (`ready` aliases to `ready_release`, `delivery` aliases to `driver_delivery`)
- profile/version pin without a complete live binding → excluded (fail closed)
- unbound historic order → excluded from operational floor lists (fail closed; audit/history remains readable)

Unknown screen keys return an empty page. `status_filter` remains for non-floor lists and as an optional extra narrowing filter. Staff S10 completion remains a separate command.

Ready list desk filters (same page, not a pickup URL): `GET /api/v1/orders?workflow_screen=ready` plus optional stacked flags `ready_staged=1`, `ready_unreleased=1`, `ready_due=1`, `ready_norack=1`. These flags apply **only** when `workflow_screen` is `ready` or `ready_release`. Pickup-desk alias `ready_focus=counter` does **not** hide `ready` (direct handover). Legacy exclusive `ready_focus=shelf|collection|no_rack` still maps to unreleased / due / no-rack. The Ready queue also includes `pickup_handover` memberships for `ready` / `ready_for_pickup` only — never `delivered`.

## 4. Create

Existing create must call `InitialStatusResolver`; persist source/type/`wf_profile_id`+`wf_profile_version_id`+`wf_version_no`/`state_version=1` (artifact columns stay null on new orders). No retail→`closed` shortcut. Every create path (normal intake, remote intake, retail, and Quick Drop) resolves only live profile-version initial rules. An unmatched rule returns `422 PROFILE_INITIAL_RULE_UNMATCHED`; it never falls back to legacy `intake` or `preparing` shortcuts.

When multiple active assignments match the same tenant/branch/service specificity, only exact duplicate bindings may be timestamp-ordered. Different profile/version bindings are rejected as a configuration conflict before an order is created; clients must direct the operator to HQ policy administration. Order creation resolves each distinct item `serviceCategoryCode` as the existing assignment `service_code` context. If service scopes select different immutable snapshots, it returns `422 PROFILE_SERVICE_SCOPE_CONFLICT`; the client must split the order rather than silently pinning the first item policy.

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
| Allowed from | `ready_for_pickup` (pickup service + release required), `out_for_delivery` (`CONFIRM_DELIVERY` / `public_web`). Status `ready` is rejected (`422 PICKUP_RELEASE_REQUIRED`); already `delivered` is idempotent |
| V2 action | OFD: `CONFIRM_DELIVERY` on screen `public_tracking`. Released pickup: `CONFIRM_PICKUP` via the pickup service on `pickup_handover` (never bound on `public_tracking`) |
| Actor | System user `WORKFLOW_SYSTEM_ACTOR` (`0437`) — satisfies history FK |
| Errors | Pickup service codes keep their HTTP mapping. Engine `PROFILE_*` → `409`. `ACTION_NOT_ALLOWED` → `403`. `VERSION_CONFLICT` → `409` |
| Privacy | GET tracking does **not** return `rackLocation` or other internal staff shelf data |
| Flag off | Legacy `WorkflowService.changeStatus` with same system actor UUID |
| Payment notice | Read APIs also expose `payment_type_code`, `outstanding_amount`, and `pay_on_collection_amount` so the public page can warn before confirm |

Staff physical intake remains `POST …/confirm-physical-intake` → `CONFIRM_PHYSICAL_INTAKE` (authenticated).

## 8. Mobile / cmx-api

V1.0: use the same action APIs; **no second transition surface**. Offline: must send `expectedStateVersion`; 409 → refresh actions. Bearer JWT on tenant adapters is channel `mobile`. Floor 0472 execute rows that list only `staff_web` will return `403 ACTION_NOT_ALLOWED` for those mobile calls until HQ publishes mobile channels.

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

## 10. Staff Delivery private evidence and completion (P7R)

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

This is the **stop-owned** staff command. Use it when the order already has a pending or in-transit delivery stop. It is a stage-owned application service, not a UI-specific status writer. The server resolves the authenticated tenant and actor, requires `delivery:pod` and `orders:transition`, and validates CSRF. Its rollout guard is intentionally independent of legacy Delivery write endpoints.

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
| `POD` | Compiled POD confirmation; no photo or signature unless those methods are also required |
| `NOTES` | Compiled notes overlay; non-empty `podNotes` when notes is required |

A semantic snapshot that names delivery evidence permits only those compiled methods. Independent optional methods may be combined; mixed is derived when both signature and photo are compiled. Required notes apply regardless of the selected method. OTP remains rejected until a durable verifier exists. Legacy orders and artifacts without delivery evidence still use the POD catalog.

Errors: `400 INVALID_REQUEST`, `404 STOP_NOT_FOUND`, `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `409 IDEMPOTENCY_IN_FLIGHT`, `409 STOP_ALREADY_DELIVERED`, `409 PROFILE_SNAPSHOT_INCOMPLETE|PROFILE_ARTIFACT_UNAVAILABLE|PROFILE_ARTIFACT_INVALID|PROFILE_EXECUTION_INVALID`, `422 POD_METHOD_INVALID`, `422 POD_EVIDENCE_REQUIRED`, `422 POD_EVIDENCE_INVALID`, `422 DELIVERY_COLLECTION_REQUIRED`, `403 ACTION_NOT_ALLOWED`, `503 DELIVERY_HARDENING_REQUIRED`.

The command does not accept payment legs. A due balance must be collected through the existing Order Fin collection contract before delivery is retried; this preserves a single auditable money-write path. Local database-backed tests now cover pay-on-collection blocking, cross-tenant stop isolation, OTP reject, already-delivered, engine-failure rollback, happy-path route counters, stale-version rollback, idempotent replay, and serialized dual-complete. Complete requires `delivery:pod` and `orders:transition`. Workflow `VERSION_CONFLICT` maps to HTTP 409. Staff `CONFIRM_DELIVERY` on `POST /api/v1/orders/{id}/actions` and `/transition` returns `403 USE_DELIVERY_COMPLETE_COMMAND`. OTP expiry/retry controls remain deferred to VNext; compiled profiles may list OTP as optional authoring only. Staff S10 canary still requires an explicit rollout decision.

### 10.0a Order-keyed floor complete (no planned stop)

`GET /api/v1/delivery/orders/{orderId}/active-stop`

Requires `orders:read`. Returns `{ stop }` or `{ stop: null }` for the current pending/in-transit stop on an active route. The Delivery floor uses this to choose the writer. It does not create a stop.

`POST /api/v1/delivery/orders/{orderId}/complete`

This is the **order-keyed** staff command used by `/dashboard/delivery/{id}` when no planned stop exists. Requires `delivery:pod` and `orders:transition`, CSRF, and header `Idempotency-Key`. The server never invents a dummy route.

```json
{
  "expectedStateVersion": 12,
  "podNotes": "Handed to the customer at the door."
}
```

The command locks the tenant order; refuses if status is not `out_for_delivery` (`ORDER_NOT_OUT_FOR_DELIVERY`); refuses if a pending/in-transit stop exists (`409 USE_STOP_COMPLETE_COMMAND`); blocks remaining `PAY_ON_COLLECTION`; compiles notes-only evidence (`NOTES`); then executes engine `CONFIRM_DELIVERY` on screen `driver_delivery` with `handoverMode: ad_hoc`.

Errors: `400 INVALID_REQUEST`, `400 IDEMPOTENCY_KEY_REQUIRED`, `404 ORDER_NOT_FOUND`, `409 USE_STOP_COMPLETE_COMMAND`, `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `409 IDEMPOTENCY_IN_FLIGHT`, `422 ORDER_NOT_OUT_FOR_DELIVERY`, `422 DELIVERY_COLLECTION_REQUIRED`, `422 POD_METHOD_INVALID` (compiled photo/signature required with no stop to attach), `409 PROFILE_*`, `503 DELIVERY_HARDENING_REQUIRED`.

Simple tenants must **not** bind hard `delivery_stop_active` on `CONFIRM_DELIVERY` in the published artifact, or the floor button stays disabled. Do not add that gate to catalog `TR_OFD_DELIV`; it would force every tenant to have a stop. Routed tenants bind `delivery_stop_active` and POD evidence, then complete from the stop command.

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

This read contract is available independently of which staff completion writer is used.
It does not enable `POST /api/v1/delivery/stops/{stopId}/complete` or
`POST /api/v1/delivery/orders/{orderId}/complete`, create evidence, or mutate an order.

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
staged route. When the compiled pickup evidence names required notes, empty
`handoverNotes` is rejected. It fulfils that release, or creates and fulfils one audit record for a
direct handover, then calls `CONFIRM_PICKUP` on `pickup_handover` in the same
transaction. The staged route is `ready_for_pickup` → `delivered`; the direct
counter route is `ready` → `delivered`. It writes workflow history/outbox through
the engine and stores a replay-safe response under the endpoint idempotency resource.

Errors: `400 INVALID_REQUEST|IDEMPOTENCY_KEY_REQUIRED`, `401 UNAUTHORIZED`,
`403 ACTION_NOT_ALLOWED`, `404 ORDER_NOT_FOUND`, `409
VERSION_CONFLICT|IDEMPOTENCY_CONFLICT|IDEMPOTENCY_IN_FLIGHT`, `422
ORDER_NOT_READY|PICKUP_RELEASE_REQUIRED|PICKUP_COLLECTION_REQUIRED|PICKUP_PARTIAL_RELEASE_UNSUPPORTED|PICKUP_NOTES_REQUIRED|PICKUP_POLICY_UNAVAILABLE`,
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

## 11.1 Stage-owned floor commands (P7R, active)

These adapters own the screen and action code. Web, mobile, and integrations post
`expectedStateVersion` plus optional `rackLocation` / `reason`; they must not send a
guessed `toStatus`. Cookie sessions require CSRF. Bearer JWTs skip CSRF and use the
same `orders:transition` check. `Idempotency-Key` is required.

| Command | Method / path |
|---|---|
| Complete processing | `POST /api/v1/processing/{orderId}/complete` |
| Complete assembly | `POST /api/v1/assembly/{orderId}/complete` |
| Pass QA | `POST /api/v1/qa/{orderId}/pass` |
| Fail QA | `POST /api/v1/qa/{orderId}/fail` |
| Complete packing | `POST /api/v1/packing/{orderId}/complete` |
| Make available for pickup | `POST /api/v1/ready/{orderId}/release-pickup` |
| Release for delivery | `POST /api/v1/ready/{orderId}/release-delivery` |

```json
{
  "expectedStateVersion": 12,
  "rackLocation": "RACK-A1",
  "reason": "Stain remained after finishing."
}
```

`FAIL_QA` requires a reason of at least 10 characters. Unexpected fields, including
client-supplied `tenantId` or actor IDs, return `400 INVALID_REQUEST`. The shared
engine remains the only workflow-status writer. Floor hooks resolve these paths
automatically; unmapped actions continue to `POST /api/v1/orders/{id}/actions`.

Errors: `400 INVALID_REQUEST|IDEMPOTENCY_KEY_REQUIRED|REASON_REQUIRED`,
`401 UNAUTHORIZED`, `403 ACTION_NOT_ALLOWED`, `404 NOT_FOUND`,
`409 VERSION_CONFLICT|IDEMPOTENCY_CONFLICT`, `422 GATE_FAILED`.

Staff delivery completion uses the stage-owned writers in section 10 (`orders/{orderId}/complete` or `stops/{stopId}/complete`), not generic `/actions`.

## 12. P0 sign-off gaps

- [x] state_version contract
- [x] blocker reason shape
- [x] Staff Delivery stage-owned writers implemented (order-keyed + stop-owned); S10 routed POD canary remains unsigned
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

For an order bound to `wf_profile_version_id`, the service evaluates
the live version's `workboard` membership and primary-owner stage
membership. Owner metrics group by that version identity (plus
`policy_revision` while Pilot), so distinct live policy versions are
never merged. Orders without a complete version binding are excluded.
A status without an active owner is excluded and returned as a
configuration gap rather than guessed or mutated.
