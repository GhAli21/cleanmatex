# Deploy Guide — Workflow Order Advance

## Scope of this guide

This guide covers the current operator-owned rollout steps for the public tracking and confirm-received slice of Workflow Order Advance.

## Required migrations for the current slice

1. `0437_sys_wf_public_confirm_actor.sql`
2. `0441_public_order_tracking_tokens.sql`

Do not modify older migrations. Apply them in normal sequence in the environment you are promoting.

## App deployment notes

- Deploy the web-admin code that includes:
  - token-aware public tracking routes
  - `public-order-tracking.service.ts`
  - updated receipt QR link generation
  - updated public tracking page messaging/disable behavior
- Keep `WORKFLOW_ENGINE_V2` and `NEXT_PUBLIC_WORKFLOW_ENGINE_V2` scoped to the intended canary tenant/environment only.

## Recommended rollout order

1. Deploy application code.
2. Apply `0437` if not already present.
3. Apply `0441`.
4. Open one known order from dashboard order details and confirm the copied public link resolves to `/track/{token}`.
5. Execute the public confirm smoke from [user_guide.md](user_guide.md).
6. Validate no regression for legacy readable links by opening one previously generated link.

## Post-deploy checks

- Public token lookup works for new and existing orders
- Receipt QR codes open the opaque route
- Public confirm-received succeeds from `ready` and `out_for_delivery`
- Already delivered orders keep the button disabled and return idempotent success
- Pay-on-collection notice appears only when a remaining amount exists

## Known remaining work after this rollout

- P7 broader e2e/canary hardening
- P5 retirement of remaining workflow RPC dependencies
- V1.1 return/sub-order follow-up
