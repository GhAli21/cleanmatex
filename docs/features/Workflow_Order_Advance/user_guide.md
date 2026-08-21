# User Guide — Workflow Order Advance

## Who this guide is for

- Store/floor operators checking workflow behavior
- QA/release testers validating the rollout
- Support staff verifying the customer-facing tracking experience

## Customer public tracking

- Preferred public link format is now opaque: `/track/{token}`
- Older readable links still work during rollout and will redirect when a token already exists
- The tracking page shows:
  - current order status
  - order total
  - item count
  - customer summary
  - timeline
- If the order still has a balance and `payment_type_code = PAY_ON_COLLECTION`, the page shows the remaining amount beside the current status context
- A `ready` order changes to `ready_for_pickup` and shows **Ready for collection** only after staff use **Make available for pickup**. Before that release, it is internally Ready but must not be presented as collectable.
- A customer can confirm a Ready for Pickup order only after this pickup release exists. If a pay-on-collection balance remains, the confirm action is unavailable until staff post the payment.
- If the customer confirms receipt, or the order is already `Delivered`, the confirm button is disabled.

## Operator smoke checklist

1. Apply `0437_sys_wf_public_confirm_actor.sql` and `0441_public_order_tracking_tokens.sql`.
2. Open an order that can legitimately move from `ready_for_pickup` or `out_for_delivery` to `delivered`.
3. Copy the public tracking link from dashboard order details or scan the receipt QR code.
4. Confirm the URL uses `/track/{token}` after `0441` is applied.
5. For a Ready pickup order that has not been released, confirm the page does not show **Ready for collection** or a receipt-confirmation button.
6. In the Ready dashboard, use **Make available for pickup** and confirm the order status changes from `ready` to `ready_for_pickup`. Refresh the public page and confirm it now shows **Ready for collection**.
7. If the order is `PAY_ON_COLLECTION` with balance due, confirm the page shows the remaining amount notice and has no receipt-confirmation button.
8. Click `I have received my clothes` only for an eligible released, paid pickup order.
9. Confirm the order becomes `delivered`, then refresh the page and confirm the button stays disabled.
10. Repeat a negative smoke where the order is not released, or is not in `ready` or `out_for_delivery`; the API should reject the action.

## Workflow canary reminders

- Keep `workflow_engine_v2` disabled outside the test tenant until smoke passes.
- Public confirm-received uses the V2 action path only when the canary is on.
- When the canary is off, the public flow still works through the legacy workflow service with the same system actor.

## Customer collection at the branch

Use this flow only when the customer is physically at the branch and staff have
handed over the items. It is different from making an order available on the
pickup shelf.

1. Open the Ready order and verify the customer/order number.
2. Check the **Pickup availability** card. A Ready order has one of two states:
   - **Not yet available for pickup**: use **Make available for pickup** when the items are staged for collection.
   - **Available for pickup**: the release timestamp is shown; the release actions are no longer offered.
3. If a **Collect remaining payment** button is shown, collect the balance using
   the existing payment screen. Do not confirm the pickup before payment is
   posted.
4. If the customer is present now and the order is still **Not yet available for
   pickup**, choose **Confirm customer pickup now**. This direct counter path
   moves `ready` to `delivered` and creates one fulfilled pickup audit record in
   the same transaction. Do not use it merely to stage an order on the shelf.
5. If the order is already **Available for pickup**, use **Confirm customer
   pickup**. This staged path moves `ready_for_pickup` to `delivered`.
6. Optionally add a handover note and confirm the dialog.
7. Verify the order is `delivered` and disappears from the Ready worklist after
   refresh.

**Make available for pickup** changes the order to `ready_for_pickup`. It does
not mean the customer has received the items; only customer handover moves it
to `delivered`.

### Pickup smoke checks

| Scenario | Expected result |
|---|---|
| Ready, not released | Worklist and detail show **Not yet available for pickup**; **Make available for pickup** is offered; public tracking does not claim collection is available. |
| Ready, pickup released | Order status is `ready_for_pickup`; worklist and detail show **Available for pickup**; release time is visible in detail; duplicate pickup/delivery release actions are not offered and server requests are rejected. |
| Ready, customer at counter | **Confirm customer pickup now** moves `ready` directly to `delivered` and creates one fulfilled pickup release in the same transaction. |
| Paid Ready for Pickup order | Pickup confirmation succeeds; status is `delivered`; one pickup release is `fulfilled`; workflow history and outbox contain `CONFIRM_PICKUP`. |
| Pay-on-collection balance due | Pickup confirmation is unavailable; collection UI opens; API returns `PICKUP_COLLECTION_REQUIRED` if forced. |
| Public confirmation before release | Public API returns `PICKUP_RELEASE_REQUIRED`; public tracking cannot use the staff-only direct counter path, so no release, fulfilment, history, outbox, or status change is written. |
| Stale second tab | Second confirmation returns `VERSION_CONFLICT`; no duplicate fulfilment/history/outbox record. |
| Retry after connection loss | Retrying with the same idempotency key returns the original result without duplicate handover. |
| Open partial release | API rejects with `PICKUP_PARTIAL_RELEASE_UNSUPPORTED`; no order status change occurs. |

### Pickup migration rollout

Before applying `0447_ready_for_pickup_workflow_status.sql` and
`0448_pickup_cutover_integrity.sql`, temporarily pause new pickup releases and
pickup handovers for the target environment. Apply both migrations in sequence,
then run the local database suite before resuming work:

```powershell
cd web-admin
npm run test:db-integration -- pickup-handover.db.test.ts
```

`0448` reconciles release records created during the `0447` cutover and stops the
deployment if a Ready order has an open pickup release or a Ready for Pickup order
has none. Resume pickup work only after the migration and database test succeed.
Browser staff users keep the normal CSRF-protected flow. Mobile or third-party
integrations must use a dedicated tenant user JWT with `orders:transition`, not a
Supabase service-role key, and must retry timeouts with the same idempotency key.

## Cancel, hold, resume, and stop smoke

Use disposable test orders for this smoke. `cancelled` and `stopped` are terminal statuses and cannot be resumed through the normal workflow.

### Prerequisites

1. Confirm `0436_sys_wf_cancel_hold_stop_adr.sql` is applied in the environment.
2. Enable the Workflow Engine V2 canary for only the intended test tenant/environment.
3. If the environment-force rollout is being used, configure both variables and restart or redeploy web-admin:

   ```env
   WORKFLOW_ENGINE_V2=true
   NEXT_PUBLIC_WORKFLOW_ENGINE_V2=true
   ```

4. Sign in as a user with the `orders:transition` permission.
5. Prepare two disposable test orders:
   - Order A in `intake` for cancellation.
   - Order B in `processing` for hold, resume, and stop.
6. Record Order B's financial summary before starting. Hold, resume, and stop must not change payments, refunds, or balances.

### Smoke sequence

| Test | Operator steps | Expected result |
|---|---|---|
| Cancel | Open Order A, click **Cancel Order**, enter a reason of at least 10 characters, and confirm. | Status changes from `intake` to `cancelled`; cancellation audit fields are populated; financial amounts remain unchanged. |
| Cancel rejection | Open an order in `processing`. | **Cancel Order** is not shown. A forced API request is rejected with `CANCEL_NOT_ALLOWED`. Use hold or stop after real work starts. |
| Hold validation | Open Order B, find **Hold / resume / stop**, enter fewer than 10 characters, and click **Hold order work**. | Validation is shown and the status remains `processing`. |
| Hold | Enter a valid reason of at least 10 characters and click **Hold order work**. | Status changes from `processing` to `on_hold`; `hold_from_status` is set to `processing`. |
| Resume | Click **Resume order work**. | Status changes from `on_hold` back to `processing`; `hold_from_status` is cleared. |
| Stop | Hold Order B again with a valid reason, then click **Stop order work** with a valid reason. | Status changes from `on_hold` to terminal `stopped`; `hold_from_status` is cleared. |
| Terminal check | Refresh the stopped order. | Hold, resume, stop, and cancel actions are no longer available. |

### Browser/API checks

For hold, resume, and stop, browser developer tools should show successful calls to:

- `GET /api/v1/orders/{id}/available-actions?screen=order_control`
- `POST /api/v1/orders/{id}/actions`

Cancellation loads available actions with `screen=canceling` and executes through the same `POST /api/v1/orders/{id}/actions` endpoint. Each successful action should return HTTP `200`, increment `stateVersion`, write order history, and enqueue an `ORDER_WORKFLOW_TRANSITIONED` outbox event.

## Delivery proof and handover review

Authorized operations staff can review a completed delivery without changing the order:

1. Open **Delivery**, choose the route stop, and open its detail page; or open **Order Details** and select **Delivery Proof**.
2. Review the workflow outcome, payment state, delivery time, operator, notes, proof method, and available evidence.
3. If an evidence link has expired, select **Refresh links**. The new link is short-lived and is shown only to authorized staff.
4. Treat missing evidence as an exception for investigation. Do not use the audit view, the generic Order Actions tab, or a direct URL to mark an order delivered.

The audit view is read-only. It does not create a delivery stop, collect payment, release an order, or complete staff delivery.

## Staff delivery containment

The Delivery dashboard permits the read-only proof/audit review above, but route creation, driver assignment, OTP generation/verification, POD capture, and direct staff **Mark delivered** actions remain disabled while atomic delivery hardening is open. Direct calls to staff delivery mutation APIs must return HTTP `503` with `DELIVERY_HARDENING_REQUIRED` and must not write route, stop, POD, order, history, or outbox data.

Do not bypass this containment or use the generic order Actions tab to mark an order delivered. Continue using the opaque public `/track/{token}` confirm-received flow only for its approved customer contract. Staff delivery S10 can resume after the production checklist confirms atomic POD, route counters, financial gates, idempotency, concurrency, RBAC, tenant isolation, and rollback coverage.

## Workboard supervisor queue

1. Open **Orders → Workboard** (requires `workboard:read`).
2. Use the overview cards to focus the queue on **All**, a specific owner stage, **Blocked**, or **Overdue** work.
3. Refine the list with branch, assignee, priority, risk, due state, or customer/order search. Use **Clear filters** to return to the default queue.
4. Review the active filter chips and matching-order count before paging through the list.
5. Select **Open stage** to continue work where that stage owns the action. Workboard cannot change an order status.
6. If a configuration warning is shown, ask the workflow administrator to configure an owner stage for the listed status. Do not work around it by changing an order directly.

### Tenant-safe database verification

Use read-only queries and always provide the test tenant ID.

```sql
SELECT
  id,
  order_no,
  current_status,
  status,
  state_version,
  preparation_status,
  hold_from_status,
  cancelled_at,
  cancelled_note,
  total_amount,
  total_paid_amount,
  outstanding_amount,
  refunded_amount
FROM public.org_orders_mst
WHERE tenant_org_id = '<TENANT_UUID>'::uuid
  AND id IN (
    '<CANCEL_ORDER_UUID>'::uuid,
    '<CONTROL_ORDER_UUID>'::uuid
  );
```

```sql
SELECT
  order_id,
  from_value,
  to_value,
  payload ->> 'actionCode' AS action_code,
  done_at
FROM public.org_order_history
WHERE tenant_org_id = '<TENANT_UUID>'::uuid
  AND order_id IN (
    '<CANCEL_ORDER_UUID>'::uuid,
    '<CONTROL_ORDER_UUID>'::uuid
  )
ORDER BY done_at DESC;
```

Expected history actions are:

1. `CANCEL_ORDER` for Order A.
2. `HOLD_ORDER_WORK` for Order B.
3. `RESUME_ORDER_WORK` for Order B.
4. `HOLD_ORDER_WORK` for Order B.
5. `STOP_ORDER_WORK` for Order B.

Compare the before-and-after financial values. `total_amount`, `total_paid_amount`, `outstanding_amount`, and `refunded_amount` must not change automatically.

### Important business rules

- Cancel is allowed only from `draft`, `intake`, or incomplete `preparing` before real processing starts.
- Hold is temporary and preserves the prior operational status in `hold_from_status`.
- Resume is allowed only from `on_hold` and returns the order to `hold_from_status`.
- Stop is permanent and moves the order to terminal `stopped`.
- Cancel, hold, resume, and stop do not automatically refund, credit, unwind, or otherwise mutate money. Any required financial handling must be performed explicitly through the appropriate Fin workflow.
- Customer return through `RETURN_ORDER` is deferred to V1.1 and is not part of this smoke.
