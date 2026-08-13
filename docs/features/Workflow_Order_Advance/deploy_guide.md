# Deploy Guide — Workflow Order Advance

## Scope of this guide

This guide covers the operator-owned V1.0 engine cutover, public tracking, and RPC grant contraction.

## Required migrations for the current slice

1. `0437_sys_wf_public_confirm_actor.sql`
2. `0441_public_order_tracking_tokens.sql`
3. `0442_retire_workflow_rpc_grants.sql` (operator confirmed applied locally and remotely on 2026-08-14)

Do not modify older migrations. Apply them in normal sequence in the environment you are promoting.

## App deployment notes

- Deploy the web-admin code that includes:
  - token-aware public tracking routes
  - `public-order-tracking.service.ts`
  - updated receipt QR link generation
  - updated public tracking page messaging/disable behavior
- Server workflow writes are engine-only. Keep UI/visibility flags scoped to the intended rollout until pilot acceptance is complete.

## Recommended rollout order

1. Confirm `0437` and `0441` are applied. The operator reported both local and remote `0441` apply success on 2026-08-13.
2. Deploy the engine-only application build before revoking RPC grants.
3. Run the focused canary smoke from [user_guide.md](user_guide.md), including cancel/hold/resume/stop.
4. Confirm `0442` appears in migration history for the promoted environment.
5. Repeat preparation, processing, delivery, public confirm, and cancel/hold smoke after `0442`.
6. Validate a legacy readable public link still opens during the compatibility window.

## Post-deploy checks

- Public token lookup works for new and existing orders
- Receipt QR codes open the opaque route
- Public confirm-received succeeds from `ready` and `out_for_delivery`
- Already delivered orders keep the button disabled and return idempotent success
- Pay-on-collection notice appears only when a remaining amount exists
- Raw status PATCH and bulk status endpoints return authenticated `410 USE_WORKFLOW_ACTIONS`
- Application logs contain no permission errors for retired `cmx_order_*` / `cmx_ord_*` functions

## Rollback boundary

Do not drop the retained SQL functions. If a severe incident requires temporary RPC restoration, approve and re-grant only the exact function signature and role needed; prefer an application-forward fix. See [technical_docs/rpc_retirement.md](technical_docs/rpc_retirement.md).

## Post-deploy acceptance still required

- Confirm post-`0442` workflow smoke and monitoring in each promoted environment
- Complete the pilot tenant T01-T18 matrix and monitor workflow errors/outbox lag
- V1.1 return/sub-order follow-up remains outside V1.0
