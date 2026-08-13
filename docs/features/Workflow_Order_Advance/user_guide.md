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
