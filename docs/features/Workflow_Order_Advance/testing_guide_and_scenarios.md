# Testing Guide And Scenarios — Workflow Order Advance

## Fast validation commands

Run from `web-admin`:

```bash
npx jest __tests__/api/v1/preparation-completion.route.test.ts __tests__/api/v1/delivery-safety.route.test.ts --runInBand
npx jest __tests__/services/delivery-proof-audit.service.test.ts __tests__/api/v1/delivery-proof-audit.route.test.ts --runInBand
npx playwright test e2e/public-order-tracking.spec.ts --project=public-chromium --reporter=line
npx eslint . --quiet
npx tsc --noEmit
npm run build
```

2026-08-21 implementation evidence: focused Delivery proof/audit service and API tests pass, in addition to the existing Preparation and Delivery fail-closed API coverage. Earlier evidence: 8 Jest suites / 49 tests passed; anonymous Playwright 2/2 passed; full ESLint passed; production build passed across 271 pages/routes. Standalone TypeScript diagnostics outside this cutover must still be tracked separately.

## Delivery proof/audit focused scenarios

1. Sign in with `orders:read` and open a delivered order from the same tenant through Delivery Stop Detail and through the **Delivery Proof** order tab.
2. Confirm both surfaces show the same workflow outcome, payment state, delivery time, operator, notes, and evidence count.
3. Confirm the API returns `404 ORDER_NOT_FOUND` for an order outside the authenticated tenant and does not reveal that tenant's proof, actor, stop, or evidence data.
4. Confirm a private evidence key is never returned. Evidence links must be signed only for the matching `{tenantId}/delivery/{stopId}/` scope and expire after five minutes.
5. Wait for or simulate link expiry, select **Refresh links**, and confirm new authorized links load without any workflow, payment, POD, release, stop, route, history, or outbox mutation.
6. Confirm the audit card alone offers no delivery-completion control while staff delivery remains a release blocker.

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

Expected: `wf_profile_id` is the assigned profile and `wf_version_no` is its resolved active PUBLISHED version. An active assignment with no valid PUBLISHED version must reject order creation; legacy template-only creation is allowed only when no assignment applies.
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
| S10 | POD delivery | Capture POD for an `out_for_delivery` order. | `CONFIRM_DELIVERY` moves it to `delivered`; POD and workflow mutation succeed together; `delivered_at` is populated. |
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

Staff POD delivery is not signed production-ready yet. The unsafe direct **Mark delivered** shortcut and route-creation UI are disabled until POD evidence, payment checks, stop/route mutation, and `CONFIRM_DELIVERY` can commit atomically through a completed bilingual Cmx flow. Staff delivery mutation APIs must return HTTP `503` with `DELIVERY_HARDENING_REQUIRED` and must not write data while this containment is active. S10 must remain failed/blocked until that hardening lands; public S11-S15 confirmation follows its separately approved customer contract.

### API evidence

Normal stage and control actions should use:

- `GET /api/v1/orders/{id}/available-actions?screen={screen_key}`
- `POST /api/v1/orders/{id}/actions`
- `POST /api/v1/orders/{id}/transition` only as the engine-backed compatibility adapter

Expected successful commands return HTTP `200`, the resulting status, and incremented `stateVersion`. Version conflicts should return HTTP `409`, not overwrite another operator's change.

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
3. Verify a V2 order appears only when its pinned graph contains both `workboard` and owner-stage membership.
4. Verify a legacy/unpinned order follows the tenant's live Workboard contract.
5. Exercise each filter, sorting, and pagination; every row/count must remain tenant-scoped.
6. Confirm the screen has no status, collection, release, POD, or assignment mutation.
