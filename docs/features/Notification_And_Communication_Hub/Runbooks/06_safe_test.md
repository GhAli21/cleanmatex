# Runbook 06 — Safe Test

**Status: Partial.** Only a campaign-scoped "send test to myself" route exists. The plan's proposed generic per-event/per-template preview and test-send APIs (`POST /preview`, `POST /test-sends`) are not implemented, and no route in the current tenant codebase enforces the `notifications:send_test` permission the plan describes.

## Purpose

Send or render a notification in a way that proves rendering/delivery works, without creating a real business event, affecting campaign counters, or bypassing consent/rate limits.

## Preconditions / permissions

- `notifications:manage` permission (not `notifications:send_test` — see discrepancy below).
- Campaign must exist and be in `DRAFT`, `APPROVED`, or `PENDING_APPROVAL` status.

## Operator steps — the only implemented safe-test path

1. Identify the campaign ID to test.
2. `POST /api/v1/notifications/campaigns/[id]/test` (perm: `notifications:manage`).
   - Implementation: `web-admin/app/api/v1/notifications/campaigns/[id]/test/route.ts`.
   - Behavior, verified in code:
     - Bypasses `target_segment` entirely — delivers only to the requesting user (`userId` from the auth check), never to a real campaign audience.
     - Only works when `campaign.status` is in `{DRAFT, APPROVED, PENDING_APPROVAL}` (`TEST_ALLOWED_STATUSES`).
     - Writes a single outbox row via `emitNotificationEvent` — does **not** advance campaign state (`RUNNING`/`COMPLETED`) or increment `sent_count`/`skip_count`.
     - Fetch is explicitly scoped: `.eq('id', id).eq('tenant_org_id', tenantId).eq('is_active', true)` before any send.
3. Confirm the outbox row was created and processed normally (Runbook 07's query against `org_ntf_outbox_dtl`), addressed to the requesting operator's own channel address rather than a real customer.

## Operator steps — testing the *existing* direct-Twilio order-created flow

- A separate, older, already-documented runbook exists for this specific legacy path: [`Setup_And_Config/14_twilio_production_order_created.md`](../Setup_And_Config/14_twilio_production_order_created.md) (referenced directly by the plan, line 8). Use that document for order-created WhatsApp template testing — it predates and is unrelated to the campaign test route above.

## Expected outcomes

- Success: one outbox row, addressed to the caller, processed through the normal `process-outbox` pipeline; campaign counters unchanged; campaign status unchanged.
- No real customer or campaign audience member is ever touched by this route.

## Rollback / abort guidance

- Not applicable — a test send is a single, already-isolated side effect (one outbox row to the operator). No separate cleanup step exists or is needed.

## Known gaps and a discrepancy worth flagging

- **No generic preview-without-sending endpoint exists.** The plan proposes `POST /preview` (tenant) and `POST /templates/:code/versions/:id/validate` / `.../preview` (HQ) as explicit "renders without sending" operations (section 10.2/10.3) — neither exists in the current route tree for any individual template/event outside of a campaign.
- **No `POST /test-sends` / `GET /test-sends/:id` route exists** for sending a single templated test independent of a campaign.
- **Discrepancy:** the plan's access model (section 11.1) names `notifications:send_test` as the permission required for test sends ("notifications:send_test plus appropriate source read permission"), and lists it as an existing verified tenant permission in the same section. The one test-send route that actually exists (`campaigns/[id]/test`) is gated by `notifications:manage` instead — `notifications:send_test` is not referenced anywhere in `web-admin/app/api/v1/notifications/**` (confirmed by search). This is either a stale plan claim or a permission that was never wired into this specific route; it should be resolved explicitly rather than assumed.

**Last verified against source:** 2026-10-10 (`campaigns/[id]/test/route.ts`; search for `send_test` across `web-admin/app/api/v1/notifications`).
