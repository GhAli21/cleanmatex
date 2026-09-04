# Testing Guide And Scenarios — Workflow Order Advance

## Fast validation commands

Run from `web-admin`:

```bash
npx jest __tests__/services/workflow-policy-resolver.service.test.ts __tests__/services/semantic-workflow-artifact.service.test.ts __tests__/services/semantic-workflow-runtime.service.test.ts __tests__/services/workflow-engine.no-legacy.test.ts --runInBand
npx jest __tests__/api/v1/preparation-completion.route.test.ts __tests__/api/v1/delivery-safety.route.test.ts --runInBand
npx jest __tests__/services/complete-delivery-by-order.service.test.ts __tests__/services/delivery-completion.service.test.ts --runInBand
npx jest __tests__/services/delivery-proof-audit.service.test.ts __tests__/api/v1/delivery-proof-audit.route.test.ts --runInBand
npx jest __tests__/services/workflow-gate-evaluator.service.test.ts __tests__/services/semantic-workflow-artifact.service.test.ts __tests__/services/semantic-workflow-runtime.service.test.ts __tests__/services/workflow-profile-resolution.service.test.ts __tests__/services/initial-status-resolver.service.test.ts --runInBand --forceExit
npx jest __tests__/services/workboard-query.service.test.ts __tests__/services/stage-worklist-query.service.test.ts --runInBand
npx jest __tests__/api/workflow-engine-http.test.ts __tests__/api/v1/workflow-stage-command.route.test.ts __tests__/api/v1/workflow-actions-delivery-bypass.route.test.ts --runInBand
npm run test:db-integration -- delivery-completion.db.test.ts
npx playwright test e2e/public-order-tracking.spec.ts --project=public-chromium --reporter=line
npx eslint . --quiet
npx tsc --noEmit
npm run build
```

2026-08-29 live-runtime assurance evidence: resolver unit tests prove Published cache, Pilot reload, RETIRED/mismatch fail-closed, no assignment/artifact SQL, and missing-channel invalid. Runtime tests prove 0472 `mobile` deny on staff_web-only floor execs and `public_web` deny on `CONFIRM_PICKUP`. Source scan covers resolver, create binding, Workboard, floor lists, pickup, delivery, and public tracking. See [technical_docs/live_runtime_assurance.md](technical_docs/live_runtime_assurance.md). Residual: S10 canary, performance soak, local demo assignment if using local DB.

2026-08-21 implementation evidence: focused Delivery proof/audit service and API tests pass, in addition to the existing Preparation and Delivery fail-closed API coverage. Earlier evidence: 8 Jest suites / 49 tests passed; anonymous Playwright 2/2 passed; full ESLint passed; production build passed across 271 pages/routes. Standalone TypeScript diagnostics outside this cutover must still be tracked separately.

2026-08-22 semantic-runtime evidence: the immutable artifact loader, semantic runtime adapter, and profile-resolution tests pass (10 tests). They cover exact artifact identity, partial/mismatched snapshots, enabled owner/observer visibility, server channel filtering, and unsupported gate-mode projection. The Jest process currently needs `--forceExit`; investigate its existing open-handle warning before release sign-off.

2026-08-22 shared-gate/context evidence: TypeScript typecheck and targeted ESLint pass; Next.js production build completed. Focused Jest coverage includes the reusable gate evaluator, B2B payment-hold seam, and immutable context projection. It proves an unpaid `PAY_ON_COLLECTION` order blocks semantic `fin_release_eligible`, settlement at the shared money tolerance passes, all gate blockers are returned together, unknown semantic gates fail closed, B2B `CREDIT_INVOICE` delegates to its explicitly non-blocking seam, and the compatibility context uses enabled artifact modules rather than template stage flags.

2026-08-22 observer-ownership evidence: focused semantic runtime, artifact-loader, and workflow-gate tests pass. A malformed artifact execution on an enabled observer screen is excluded from both action discovery and execution. Explicit `cross_cutting_command` policy remains executable only with its declared membership, execution edge, and `public_web` channel.

2026-08-22 semantic-create evidence: initial-status resolver tests prove Quick Drop selects its artifact rule and an unmatched semantic order is rejected rather than receiving the legacy intake fallback.

2026-08-22 assignment-resolution evidence: profile-resolution tests prove branch precedence and reject different equally specific active bindings before an order can select an arbitrary workflow policy.

2026-08-22 service-scope assignment evidence: profile-resolution tests resolve every distinct item service category and reject a mixed order whose category scopes select different immutable profile snapshots. The public submission contract reports `422 PROFILE_SERVICE_SCOPE_CONFLICT` only after its rollback/idempotency cleanup path.

2026-08-22 pickup-policy UX evidence: EN/AR catalog parity, targeted pickup-card lint, and TypeScript typecheck pass. A semantic profile that omits the counter-handover command now receives a clear read-only configuration explanation; it never enables a local status change.

2026-08-22 extended-gate evidence: focused evaluator tests cover piece/QA/collection/release/stop/POD facts, missing-fact fail-closed behavior, discovery-vs-execute POD, and unsupported partial/return/OTP. Catalog seed `0463_sys_wf_gate_ops_fulfilment.sql` applied locally and remotely by the operator.

2026-08-27 delivery-floor evidence: order-keyed `completeDeliveryByOrder` unit tests pass (collection block, refuse existing stop, notes-only complete, compiled photo without a stop). Existing stop-complete unit tests remain green. Access contract `/dashboard/delivery/[id]` check/sync passed. `web-admin` typecheck, ESLint on touched files, i18n parity, and production build passed, including routes `/dashboard/delivery/[id]`, `POST /api/v1/delivery/orders/[orderId]/complete`, and `GET /api/v1/delivery/orders/[orderId]/active-stop`. No new workflow catalog migration. Simple vs routed remains HQ profile gate binding plus compile/publish.

2026-08-22 delivery-assurance evidence: focused Jest plus local DB integration (9/9) pass. DB coverage includes pay-on-collection blocking, cross-tenant isolation, OTP reject, already-delivered, engine-failure rollback, happy path with route counters, stale-version rollback, idempotent replay, and serialized dual-complete. Complete route RBAC requires `delivery:pod` and `orders:transition`. Staff `CONFIRM_DELIVERY` through `/actions` remains 403.

2026-08-22 floor-worklist evidence: stage-worklist unit tests prove unknown screens fail closed, semantic processing membership appears without a live contract, and a semantic order whose artifact does not own the screen is excluded from that queue.

2026-08-26 no-legacy cutover evidence: focused Jest coverage proves a profile/version pin without compiled artifact identity fails closed, create does not read a pinned graph, and Workboard/floor lists exclude those orders instead of using graph-pin membership. Migration `0464` is applied locally and remotely. Unsnapshotted historic orders are audit-readable but operationally fail closed; production callers of `loadPinnedGraphForProfileVersion` are removed.

2026-08-22 semantic-profile assurance evidence: 32 focused tests pass. Coverage includes Pilot-only-on-demo, production Pilot reject, latest-assignment ignoring Pilot, missing artifact fail-closed, forged staff channel and forged screen rejection, and `PROFILE_SNAPSHOT_INCOMPLETE` mapped to HTTP 409 on the stage command adapter. Recreation/rollback notes: `technical_docs/semantic_profile_assurance.md`. Residual: S10 canary, performance soak, visual a11y/RTL.

## Delivery proof/audit focused scenarios

1. Sign in with `orders:read` and open a delivered order from the same tenant through Delivery Stop Detail and through the **Delivery Proof** order tab.
2. Confirm both surfaces show the same workflow outcome, payment state, delivery time, operator, notes, and evidence count.
3. Confirm the API returns `404 ORDER_NOT_FOUND` for an order outside the authenticated tenant and does not reveal that tenant's proof, actor, stop, or evidence data.
4. Confirm a private evidence key is never returned. Evidence links must be signed only for the matching `{tenantId}/delivery/{stopId}/` scope and expire after five minutes.
5. Wait for or simulate link expiry, select **Refresh links**, and confirm new authorized links load without any workflow, payment, POD, release, stop, route, history, or outbox mutation.
6. Confirm the audit card alone offers no delivery-completion control. Complete from Delivery Details or Stop Detail, not from the proof tab.

## Public tracking focused scenarios

1. Opaque token helper behavior
   - valid token normalizes to lowercase
   - invalid token is rejected
   - opaque and legacy paths encode safely
2. Token service behavior
   - token resolves to tenant/order reference
   - missing token returns null
   - missing `0441` columns degrade safely without crashing
   - order detail link prefers `/track/{token}` and falls back to readable path during rollout
3. Customer page behavior
   - `PAY_ON_COLLECTION` balance shows remaining amount notice
   - confirm button disables when already delivered
   - confirm success updates status locally to delivered
4. API behavior
   - `ready` and `out_for_delivery` can confirm
   - already delivered returns idempotent success
   - other statuses reject

## Manual smoke after operator migration apply

1. Use a test order in `ready`.
2. Open the public link and verify the opaque token route.
3. Click confirm and verify the order reaches `delivered`.
4. Refresh and verify the button stays disabled.
5. Repeat with an `out_for_delivery` order.
6. Repeat with a `PAY_ON_COLLECTION` order that still has a balance.
7. Validate a legacy readable link still opens during the transition window.

## Post-0442 production smoke

Migration `0442_retire_workflow_rpc_grants.sql` was applied locally and remotely on 2026-08-14. Run this smoke against one pilot tenant before broader rollout. Use disposable orders and record the tenant/order IDs, operator, time, and evidence links.

### Preconditions

1. Confirm the engine-only application build is deployed.
2. Confirm migrations through `0442` appear in the target environment migration history.
3. Sign in as an operator with `orders:transition` and the stage permissions required by the configured actions.
4. Confirm the pilot tenant has an active published workflow profile and screen/action mappings.
5. Create a new order, then verify it snapshots the resolved profile/version. Existing orders are intentionally not backfilled:

```sql
SELECT
  order_no,
  wf_profile_id,
  wf_version_no,
  workflow_template_id,
  current_status,
  state_version
FROM public.org_orders_mst
WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111'::uuid
  AND order_no = 'ORD-REPLACE-WITH-NEW-ORDER';
```

Expected: `wf_profile_id` is the assigned profile and `wf_version_no` is its resolved active PUBLISHED version, with exact artifact identity/revision/checksum/schema persisted. A missing assignment or current valid artifact must reject order creation; there is no legacy template-only create path.
5. Prepare disposable orders in `preparing`, `processing`, `packing`, `ready`, `out_for_delivery`, and `intake` as required below.
6. Capture each order's initial `current_status`, `status`, `state_version`, financial summary, and outbox/history count.

### Required smoke matrix

| ID | Scenario | Operator action | Expected result |
|----|----------|-----------------|-----------------|
| S01 | Preparation completion | Complete an order from the Preparation screen. | `preparing → processing`; `state_version` increments once; history/outbox contain `COMPLETE_PREPARATION`. |
| S02 | Processing progression | Complete processing using the configured primary action. | Order advances to the configured next enabled stage; no raw `toStatus` mutation or legacy RPC is used. |
| S03 | Packing/auto-ready | Complete all items, assign rack location, and complete packing. | Engine executes `COMPLETE_PACKING`; order reaches `ready`; `ready_at` is populated. If the action is unavailable, the order does not silently jump. |
| S04 | Cancel allowed | Cancel a disposable `intake` order with a reason of at least 10 characters. | Status becomes `cancelled`; cancellation audit fields, history, and outbox are written; money is unchanged. |
| S05 | Cancel rejected | Try cancellation from `processing`, including a forced API request. | UI hides/disables cancel; API rejects with `CANCEL_NOT_ALLOWED`; status/version remain unchanged. |
| S06 | Hold validation | Submit a hold reason shorter than 10 characters from `processing`. | Validation is returned; status and version remain unchanged. |
| S07 | Hold | Hold a `processing` order with a valid reason. | `processing → on_hold`; `hold_from_status=processing`; version/history/outbox advance once. |
| S08 | Resume | Resume the held order. | `on_hold → processing`; `hold_from_status` is cleared; version/history/outbox advance once. |
| S09 | Stop | Hold again, then permanently stop with a valid reason. | `on_hold → stopped`; hold marker clears; stopped is terminal and actions no longer appear after refresh. |
| S10 | Staff POD delivery (routed) | On Delivery Stop Detail, complete an `out_for_delivery` stop with required POD evidence (not the generic Actions tab). | Stop, POD, route counters, and `CONFIRM_DELIVERY` commit together; order becomes `delivered`; `delivered_at` is populated. Unsigned until operator/e2e canary. |
| S10b | Staff simple delivery (no stop) | On `/dashboard/delivery/{id}`, confirm an `out_for_delivery` order whose compiled profile does not bind `delivery_stop_active` and has no pending stop. | Order becomes `delivered` through `POST /api/v1/delivery/orders/{orderId}/complete`; no route/stop row is created. If a stop exists, the API returns `USE_STOP_COMPLETE_COMMAND`. |
| S11 | Public ready confirmation | Open opaque `/track/{token}` for a `ready` order and confirm receipt anonymously. | `ready → delivered`; confirmation becomes disabled; refresh remains delivered. |
| S12 | Public OFD confirmation | Repeat public confirmation for `out_for_delivery`. | `out_for_delivery → delivered` through the same engine action. |
| S13 | Public idempotency | Confirm an already delivered order again through the API. | Idempotent success; no second state-version increment, history row, or outbox event. |
| S14 | Pay on collection | Open a `PAY_ON_COLLECTION` order with an outstanding balance. | Current status and remaining amount notice are shown before confirmation; no silent payment mutation occurs. |
| S15 | Invalid public state | Attempt public confirmation from a status other than `ready`, `out_for_delivery`, or `delivered`. | Request is rejected; no status, financial, history, or outbox mutation. |
| S16 | Raw PATCH retired | Call `PATCH /api/orders/{orderId}/status` as an authenticated user. | HTTP `410` with `USE_WORKFLOW_ACTIONS`; order is unchanged. |
| S17 | Bulk status retired | Call `POST /api/orders/bulk-status`. | HTTP `410` with `USE_WORKFLOW_ACTIONS`; every order is unchanged. |
| S18 | Reader continuity | Load screen contract, order state, and available actions. | Catalog/application-engine data loads successfully with no legacy RPC permission error. |

### Preparation command API smoke

Use a disposable `preparing` order and an operator with both `orders:update` and `orders:transition`.

1. Send `POST /api/v1/preparation/{orderId}/complete` with a new `Idempotency-Key` and the current `expectedStateVersion`.
2. Verify `preparing → processing`, `preparation_status=completed`, calculated/overridden `ready_by`, one history row, and one workflow outbox event.
3. Repeat the identical request with the same key. Verify the cached success response and no second version/history/outbox change.
4. Send the request with a stale state version and a fresh key. Verify HTTP `409 VERSION_CONFLICT` and no change to workflow, preparation fields, notes, or ready-by.
5. Send a request without `Idempotency-Key`. Verify HTTP `400 IDEMPOTENCY_KEY_REQUIRED` and no mutation.
6. Attempt the same order ID from another tenant. Verify HTTP `404 ORDER_NOT_FOUND` and no mutation.

Staff delivery completion uses two stage-owned writers. No planned stop: `POST /api/v1/delivery/orders/{orderId}/complete`. Active stop: `POST /api/v1/delivery/stops/{stopId}/complete` with POD evidence. Both enforce the pay-on-collection gate. The floor never invents a dummy route. Legacy `capturePOD`, route create/assign, and OTP generate/verify remain HTTP `503 DELIVERY_HARDENING_REQUIRED`. Staff `CONFIRM_DELIVERY` through `/actions` or `/transition` returns `403 USE_DELIVERY_COMPLETE_COMMAND`. S10 canary still needs an explicit rollout decision; public S11-S15 confirmation follows its separately approved customer contract. S10b requires HQ to leave `delivery_stop_active` unbound on `CONFIRM_DELIVERY`.

Local database assurance: `npm run test:db-integration -- delivery-completion.db.test.ts` covers collection blocking, cross-tenant isolation, OTP reject, already-delivered, engine-failure rollback, happy-path route counters, stale-version rollback, idempotent replay, and serialized dual-complete. That is automated coverage for the S10 command path; it is not the signed operator/e2e canary.

### API evidence

Normal stage and control actions should use:

- `GET /api/v1/orders/{id}/available-actions?screen={screen_key}`
- Stage-owned commands, not a guessed destination:
  - `POST /api/v1/processing/{id}/complete`
  - `POST /api/v1/assembly/{id}/complete`
  - `POST /api/v1/qa/{id}/pass` and `POST /api/v1/qa/{id}/fail`
  - `POST /api/v1/packing/{id}/complete`
  - `POST /api/v1/ready/{id}/release-pickup` and `POST /api/v1/ready/{id}/release-delivery`
  - `POST /api/v1/pickup/orders/{orderId}/complete`
  - `POST /api/v1/delivery/orders/{orderId}/complete` (no stop)
  - `POST /api/v1/delivery/stops/{stopId}/complete` (active stop)
- `POST /api/v1/orders/{id}/actions` only for unmapped control/cancel/return commands
- `POST /api/v1/orders/{id}/transition` only as the legacy V2-off compatibility adapter

Expected successful commands return HTTP `200`, the resulting status, and incremented `stateVersion`. Version conflicts should return HTTP `409`, not overwrite another operator's change.

### Ready fulfilment panel smoke

1. Open a `ready` order whose profile includes pickup. Confirm **Make available for pickup**, **Collect remaining payment** (when pay-on-collection remains), and **Confirm customer pickup** appear in one **Pickup and collection** panel.
2. Make the order available and confirm the status becomes `ready_for_pickup` without a local status write.
3. For a remaining pay-on-collection balance, collect through the existing payment modal, then confirm pickup.
4. Confirm Processing list **Mark Ready** posts `/api/v1/processing/{id}/complete` and does not send `toStatus: ready`.

### Tenant-safe database verification

Replace every placeholder and keep the tenant predicate. These are read-only verification queries.

```sql
SELECT
  id,
  order_no,
  current_status,
  status,
  state_version,
  preparation_status,
  hold_from_status,
  ready_at,
  delivered_at,
  cancelled_at,
  cancelled_note,
  total_amount,
  total_paid_amount,
  outstanding_amount,
  refunded_amount
FROM public.org_orders_mst
WHERE tenant_org_id = '<TENANT_UUID>'::uuid
  AND id = ANY (ARRAY[
    '<ORDER_UUID_1>'::uuid,
    '<ORDER_UUID_2>'::uuid
  ]);
```

```sql
SELECT
  order_id,
  from_value,
  to_value,
  payload ->> 'actionCode' AS action_code,
  done_by,
  done_at
FROM public.org_order_history
WHERE tenant_org_id = '<TENANT_UUID>'::uuid
  AND order_id = ANY (ARRAY[
    '<ORDER_UUID_1>'::uuid,
    '<ORDER_UUID_2>'::uuid
  ])
ORDER BY done_at DESC;
```

Verify the central outbox using its current repository/environment schema. Each successful non-idempotent transition must enqueue exactly one `ORDER_WORKFLOW_TRANSITIONED` event for the same tenant/order/action. A rejected or idempotent request must not enqueue another event.

### Financial invariants

Compare before and after values for every control and invalid-action scenario:

- `total_amount`
- `total_paid_amount`
- `outstanding_amount`
- `refunded_amount`
- payment and refund transaction counts

Cancel, hold, resume, stop, public confirmation, and rejected actions must not silently collect, refund, credit, or rewrite money. Any required financial operation must use the explicit Order Fin workflow.

### Log and security checks

During and after the smoke window:

1. Search application/database logs for denied calls to retired `cmx_order_*` or `cmx_ord_*` workflow functions.
2. Treat any such call as an uncut runtime dependency; identify the route/client before considering the smoke passed.
3. Confirm no cross-tenant order, history, release, POD, or outbox record is returned or changed.
4. Confirm there are no duplicate transition notifications or outbox events.
5. Confirm anonymous access is limited to the opaque tracking routes and protected dashboard routes still redirect to authentication.

### Pass/fail sign-off

| Field | Value |
|-------|-------|
| Environment | |
| Tenant | |
| Application version/commit | |
| Migration `0442` confirmed | Yes / No |
| S01–S18 result | Pass / Fail |
| Legacy RPC calls observed | Yes / No |
| Financial drift observed | Yes / No |
| Duplicate history/outbox observed | Yes / No |
| Tested by / date | |
| Evidence links | |
| Approved for pilot T01–T18 | Yes / No |

## Post-deploy pending scenarios

- Pilot-tenant e2e for release, pickup, delivery, finance gates, and outbox consumers
- Full T01-T18 acceptance and rollback rehearsal

## Workboard smoke

1. Apply `0455_workboard_permission_navigation.sql`, deploy the Workboard build, and sign in as a role with `workboard:read`.
2. Confirm **Orders → Workboard** is visible; a role without the permission must not see it and the API must return `403`.
3. Verify a semantic order appears only when its compiled artifact contains both `workboard` and owner-stage membership.
4. Verify a historic unsnapshotted order is excluded from the operational Workboard and remains readable only through audit/history views.
5. Exercise each filter, sorting, quick-focus card, clear-filters action, and pagination; every row/count must remain tenant-scoped.
6. Verify the owner-stage quick-focus cards continue to show `summary.byOwner` totals for the current non-stage filters even after selecting one owner stage.
7. Confirm the screen has no status, collection, release, POD, or assignment mutation.

## Create hydration + home collection (§9 matrix — 2026-09-03)

Automated (Jest):

```bash
npx jest __tests__/services/order-create-workflow.service.test.ts __tests__/constants/order-types-booking.test.ts --runInBand
```

| ID | Scenario | Expect | Evidence |
|----|----------|--------|----------|
| C1–C4 | POS / mobile remote create | See `order-create-workflow.service.test.ts` | Jest |
| C5 | Mobile + `HOME_COLLECTION` | `awaiting_collection` + `HOME_COLLECTION_PENDING` + `pending_dropoff` | Jest |
| C6 | Mobile + `COLLECTION_AND_DELIVERY` | same inbound start as C5 | Jest |
| C7 | Staff New Order type/source context | defaults `POS` / `pos`; selected DB-mirror values reach canonical submit; unknown codes reject | reducer + submit-schema Jest |
| C8 | Rule without preset | fail closed at create / Check policy | Jest `order-create-workflow.service.test.ts`; `createOrder` + `createOrderInTransaction` map to profile 422; HQ persist + catalog; live_rpt **0487 applied** |
| C9 | Wildcard draft Initial rule | Check policy / live_rpt blocks | HQ persist from any Studio tab + catalog; live_rpt **0487 applied** |
| HC1 | ASSIGN then CONFIRM home collection | plant status + intake received | Manual smoke on `/dashboard/home-collection` |
| HC2 | FAIL home collection | back to awaiting + audit note | Manual smoke via ActionBar |

Staff UX / labels:

1. **Orders → Home Collection** appears after nav migration `0485_nav_home_collection.sql` (dual-write with `navigation.ts`).
2. Order list badge **Awaiting home collection** for `awaiting_collection` status (distinct from **Awaiting drop-off** on remote `draft`).
3. Order full detail shows sky banner + link to home collection floor when status is `awaiting_collection` and intake is pending.
4. Order type field shows localized labels: **Branch drop-off** vs **Home collection** vs **Collection & delivery** (EN/AR `orders.orderTypes.*`).
5. Mobile booking API accepts `fulfillmentType` `home_collection` and `collection_and_delivery` and maps to the correct `order_type_id`.
6. New Order’s top toolbar defaults to `POS` / `pos`, allows type/source selection before create, and hides those immutable create facts in edit mode. Use `HOME_COLLECTION` + `customer_mobile_app` for the existing HC1 Initial-rule matrix; the source must be tenant-allowed.

Access contract:

```bash
npm run check:ui-access-contract -- --route=/dashboard/home-collection --wire
npm run check:ui-access-contract -- --route=/dashboard/home-collection/[id] --wire
```

## Hold hardening (§9 H1–H4 — 2026-09-04)

Automated (Jest):

```bash
npx jest __tests__/lib/workflow/order-control-transition.test.ts __tests__/services/workflow-cancel-return-eligibility.test.ts --runInBand
```

| ID | Scenario | Expect | Evidence |
|----|----------|--------|----------|
| H1 | Hold from processing | `on_hold`, `hold_from_status=processing` | Jest |
| H2 | Resume | back to processing, column cleared | Jest |
| H3 | Hold from preparing / ready | resume restores the exact prior status | Jest |
| H4 | Nested hold / terminal / draft | reject; do not overwrite `hold_from_status` | Jest |

Floor smoke (**0486 applied**): on a live profile that owns the status, ActionBar Hold from `preparing` and `ready` must appear, then Resume must restore that same status.
