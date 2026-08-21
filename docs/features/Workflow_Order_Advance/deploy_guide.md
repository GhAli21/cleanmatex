# Deploy Guide — Workflow Order Advance

## Scope of this guide

This guide covers the operator-owned V1.0 engine cutover, public tracking, counter pickup, and the read-only P7R delivery proof/audit surface.

## Required migrations for the current slice

1. `0437_sys_wf_public_confirm_actor.sql`
2. `0441_public_order_tracking_tokens.sql`
3. `0442_retire_workflow_rpc_grants.sql` (operator confirmed applied locally and remotely on 2026-08-14)
4. `0447_ready_for_pickup_workflow_status.sql` (operator confirmed applied locally and remotely on 2026-08-15)
5. `0448_pickup_cutover_integrity.sql` (operator confirmed applied locally and remotely on 2026-08-15)
6. `0451_delivery_pod_private_evidence.sql` (private `delivery-pod-evidence` storage prerequisite)
7. `0452_delivery_evidence_upload_receipts.sql` (durable tenant-stop evidence receipt prerequisite)
8. `0455_workboard_permission_navigation.sql` (Workboard permission + Orders child navigation)

Do not modify older migrations. Apply them in normal sequence in the environment you are promoting.

## App deployment notes

- Deploy the web-admin code that includes:
  - token-aware public tracking routes
  - `public-order-tracking.service.ts`
  - updated receipt QR link generation
  - updated public tracking page messaging/disable behavior
  - `DeliveryProofAuditService` and `GET /api/v1/delivery/orders/{orderId}/proof`
  - Delivery Stop Detail and Order Details **Delivery Proof** card, including signed-link refresh
  - Workboard API and Cmx supervisor screen, including the profile-pinned membership read model
- Server workflow writes are engine-only. Keep UI/visibility flags scoped to the intended rollout until pilot acceptance is complete.

## Recommended rollout order

1. Confirm `0437`, `0441`, and `0442` are applied. The operator reported `0441` and `0442` success locally and remotely.
2. Deploy the web-admin build containing the pickup completion service and route before enabling the `ready_for_pickup` transition.
3. Pause pickup releases and pickup handovers in the environment. This makes the `0447` and `0448` reconciliation deterministic.
4. Apply `0447`, then `0448`, in normal migration sequence. Do not edit or re-run an older migration file.
5. Run `cd web-admin; npm run test:db-integration -- pickup-handover.db.test.ts` against the migrated local database before production promotion.
6. Resume pickup operations only after the migration assertion and database suite pass.
7. Run the focused canary smoke from [user_guide.md](user_guide.md), including direct counter handover, staged handover, collection blocking, public tracking, and cancel/hold/resume/stop.
8. Validate a legacy readable public link still opens during the compatibility window.
9. For one delivered pilot order, verify proof/audit from both Delivery Stop Detail and Order Details. Confirm the same tenant-scoped result appears, a private evidence link can be refreshed after expiry, and no private object key is present in the API response.
10. After applying `0455`, verify a permitted supervisor can open Workboard, filter tenant work, and deep-link to the owner stage; verify a user without `workboard:read` cannot access the page or API.

Do not enable staff delivery completion merely because proof/audit is visible. The Delivery completion command has separate database-backed assurance, payment, evidence, route-counter, RBAC, tenant-isolation, concurrency, pilot, and rollback gates.

## Post-deploy checks

- Public token lookup works for new and existing orders
- Receipt QR codes open the opaque route
- Public confirm-received succeeds from `ready_for_pickup` and `out_for_delivery`; public confirmation from unreleased `ready` is rejected
- Already delivered orders keep the button disabled and return idempotent success
- Pay-on-collection notice appears only when a remaining amount exists
- `ready_for_pickup` always has exactly one active pickup release before handover; `ready` has none
- Browser pickup calls require CSRF; bearer-token integrations require an authenticated tenant user with `orders:transition`
- Raw status PATCH and bulk status endpoints return authenticated `410 USE_WORKFLOW_ACTIONS`
- Application logs contain no permission errors for retired `cmx_order_*` / `cmx_ord_*` functions
- Proof/audit requests require `orders:read`; Delivery Stop Detail also retains `drivers:read`
- Private evidence keys never appear in browser payloads or logs; only short-lived signed URLs are returned to authorized users
- Refreshing a proof link performs no workflow, payment, POD, release, stop, route, history, or outbox mutation
- Workboard exposes no workflow, payment, POD, release, assignment, history, or outbox mutation; rows resolve against pinned V2 profile membership when present

## Rollback boundary

Do not drop the retained SQL functions. If a severe incident requires temporary RPC restoration, approve and re-grant only the exact function signature and role needed; prefer an application-forward fix. See [technical_docs/rpc_retirement.md](technical_docs/rpc_retirement.md).

For a proof/audit incident, keep bucket privacy intact and roll back the application release or disable the affected UI/API deployment path through the normal release process. Never work around an evidence-link issue by exposing object keys, making the bucket public, or persisting signed URLs.

## Post-deploy acceptance still required

- Confirm post-`0442` workflow smoke and monitoring in each promoted environment
- Complete the pilot tenant T01-T18 matrix and monitor workflow errors/outbox lag
- V1.1 return/sub-order follow-up remains outside V1.0
