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
- If the customer confirms receipt, or the order is already `Delivered`, the confirm button is disabled

## Operator smoke checklist

1. Apply `0437_sys_wf_public_confirm_actor.sql` and `0441_public_order_tracking_tokens.sql`.
2. Open an order that can legitimately move from `ready` or `out_for_delivery` to `delivered`.
3. Copy the public tracking link from dashboard order details or scan the receipt QR code.
4. Confirm the URL uses `/track/{token}` after `0441` is applied.
5. If the order is `PAY_ON_COLLECTION` with balance due, confirm the page shows the remaining amount notice.
6. Click `I have received my clothes`.
7. Confirm the order becomes `delivered`.
8. Refresh the page and confirm the button stays disabled and the status remains delivered.
9. Repeat a negative smoke where the order is not in `ready` or `out_for_delivery`; the API should reject the action.

## Workflow canary reminders

- Keep `workflow_engine_v2` disabled outside the test tenant until smoke passes.
- Public confirm-received uses the V2 action path only when the canary is on.
- When the canary is off, the public flow still works through the legacy workflow service with the same system actor.

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
