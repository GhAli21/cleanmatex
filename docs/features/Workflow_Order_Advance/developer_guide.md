# Developer Guide — Workflow Order Advance

## Purpose

This guide is the practical handoff for engineers extending or debugging the V1 workflow rollout after the main numbered design pack was written.

## Where the current implementation lives

- Workflow engine core: `web-admin/lib/services/workflow/workflow-engine.service.ts`
- Semantic gate and context projections: `web-admin/lib/services/workflow/workflow-gate-evaluator.service.ts`, `web-admin/lib/services/workflow/semantic-workflow-context.service.ts`
- Stage-owned command adapters: `web-admin/lib/services/workflow/workflow-stage-command.service.ts`, `web-admin/lib/api/workflow-stage-command-route.ts`, `web-admin/lib/workflow/post-staff-workflow-command.ts`
- Floor worklist membership: `web-admin/lib/services/workflow/stage-worklist-query.service.ts` (`GET /api/v1/orders?workflow_screen=`)
- Ready fulfilment panel: `web-admin/src/features/pickup/ui/ready-fulfilment-panel.tsx`
- Public tracking resolver/service: `web-admin/lib/services/public-order-tracking.service.ts`
- Public tracking URL helpers: `web-admin/lib/utils/public-order-tracking.ts`
- Public customer page: `web-admin/src/features/orders/public/order-tracking-page.tsx`
- Public routes:
  - `web-admin/app/track/[token]/page.tsx`
  - `web-admin/app/api/v1/public/track/[token]/route.ts`
  - `web-admin/app/api/v1/public/track/[token]/confirm-received/route.ts`
- Legacy compatibility routes:
  - `web-admin/app/public/orders/[tenantId]/[orderNo]/page.tsx`
  - `web-admin/app/api/v1/public/orders/[tenantId]/[orderNo]/route.ts`
  - `web-admin/app/api/v1/public/orders/[tenantId]/[orderNo]/confirm-received/route.ts`
- Delivery floor vertical slice:
  - `web-admin/lib/services/delivery/delivery-completion.service.ts` (`completeDelivery`, `completeDeliveryByOrder`)
  - `web-admin/app/api/v1/delivery/orders/[orderId]/complete/route.ts`
  - `web-admin/app/api/v1/delivery/orders/[orderId]/active-stop/route.ts`
  - `web-admin/src/features/delivery/ui/delivery-order-detail-screen.tsx`
  - `web-admin/src/features/delivery/ui/delivery-handover-card.tsx`
  - `web-admin/app/dashboard/delivery/[id]/page.tsx`
- Delivery proof/audit vertical slice:
  - `web-admin/lib/services/delivery/delivery-proof-audit.service.ts`
  - `web-admin/app/api/v1/delivery/orders/[orderId]/proof/route.ts`
  - `web-admin/src/features/delivery/api/delivery-proof-audit-api.ts`
  - `web-admin/src/features/delivery/hooks/use-delivery-proof-audit.ts`
  - `web-admin/src/features/delivery/ui/delivery-proof-audit-card.tsx`
  - `web-admin/src/features/delivery/model/delivery-proof-audit.ts`
- Workboard vertical slice:
  - `web-admin/lib/services/workboard/workboard-query.service.ts`
  - `web-admin/app/api/v1/workboard/orders/route.ts`
  - `web-admin/src/features/workboard/`
  - `web-admin/src/features/workboard/access/workboard-access.ts`

## Current rollout state

- `0437_sys_wf_public_confirm_actor.sql` provides the system actor and `public_tracking` route support used by public confirm-received.
- `0441_public_order_tracking_tokens.sql` adds the opaque token columns and index for `/track/{token}`.
- Repo code already tolerates `0441` being absent by falling back to readable paths and by swallowing missing-column errors in token lookups.
- `0451_delivery_pod_private_evidence.sql` and `0452_delivery_evidence_upload_receipts.sql` provide the private evidence bucket and durable receipt records used by the P7R delivery contracts.
- `GET /api/v1/delivery/orders/{orderId}/proof` is implemented and guarded by `orders:read`. It is a read-only service shared by Delivery Stop Detail and Order Details; the Delivery page retains its stricter `drivers:read` and `orders:read` route gate.

## Extension rules

- Keep public tracking token behavior centralized in `public-order-tracking.service.ts` and `public-order-tracking.ts`.
- Preserve legacy readable route compatibility until `0441` is applied everywhere and old links are considered expired.
- Do not add alternate customer-facing tracking URL formats outside these helpers.
- Public order reads and confirm actions must remain tenant-safe and must not bypass the workflow engine when `workflow_engine_v2` is enabled.
- Keep proof/audit assembly in `DeliveryProofAuditService`; UI code may only consume the API model and must not query POD, route, or storage tables directly.
- Keep Workboard assembly in `WorkboardQueryService`. It resolves compiled-artifact memberships per order, returns an owning stage path, and must never add workflow or money mutations to this route.
- Floor Processing, Assembly, QA, Packing, Ready/Release, and Delivery commands must use the versioned stage adapters. Do not post a guessed `toStatus` from a floor table or ActionBar.
- Delivery Details owns Confirm Delivery the same way Ready owns pickup. Hide generic `CONFIRM_DELIVERY` on the ActionBar. If an active stop exists, use the stop complete command; otherwise use order-keyed complete. Never auto-create a route or stop.
- Simple vs routed delivery is compiled profile policy. Catalog already has `CONFIRM_DELIVERY` on `driver_delivery` with no transition `gate_set_code`. HQ binds `delivery_stop_active` / POD evidence only for routed tenants. Do not seed that gate onto `TR_OFD_DELIV`.
- Ready Details owns make-available, remaining collection, and confirm-pickup in one fulfilment panel. Collection remains the existing Order Fin modal; never add a screen-local money or status writer.
- Ready embeds `PickupHandoverCard` inside `ReadyFulfilmentPanel`. A semantic profile must explicitly compile the `pickup_handover` command surface, its `ready_for_pickup` membership, `CONFIRM_PICKUP` execution, and permitted channel. If any are absent, the UI explains the policy gap and never substitutes a screen-local delivery writer.
- Semantic order actions load `semantic-workflow-artifact.service.ts` and project it through `semantic-workflow-runtime.service.ts`. Do not add a fallback from a semantic snapshot to a current tenant assignment, graph pin, or mutable workflow catalog: a missing, partial, or invalid snapshot is a typed command failure.
- The workflow engine receives a server-assigned channel (`staff_web` by default, `public_web` for the opaque public confirmation service). Browser input must never select a more privileged channel. Unsupported warning/override modes, evidence requirements, and unimplemented semantic gates remain fail closed.
- Semantic observer membership is display-only. `loadSemanticActionTransitions` requires an enabled `primary_owner` module and `owner` status membership, so a malformed compiled artifact cannot make Workboard or another observer screen a workflow writer. The explicit `cross_cutting_command` module mode remains available for declared non-owner commands such as `public_tracking`; it still needs a status membership, execution edge, and permitted server-assigned channel.
- New semantic orders resolve their first status from live profile-version initial rules for normal intake, remote intake, retail, and Quick Drop, including order type. `SemanticInitialStatusResolutionError` rejects an unmatched rule with `422 PROFILE_INITIAL_RULE_UNMATCHED` and staff copy in `workflow.profileErrors`; do not restore the legacy `intake`/`preparing` fallback for a profiled order.
- Profile resolution rejects different equally specific active profile/version assignments. Do not use creation time as a hidden policy tie-breaker; HQ must resolve the conflict before a new order can be pinned to the wrong workflow policy.
- `workflow-gate-evaluator.service.ts` is the shared semantic hard-block evaluator. It receives only facts selected under the enclosing order transaction lock, so available-action previews and command execution use the same payment, rack, preparation, piece, QA, release, stop, and POD state. Do not re-query an order inside a gate or place a money decision in a screen adapter. `workflow-gate-facts.service.ts` loads those extra facts when a bound gate needs them.
- `fin_release_eligible` blocks any positive outstanding balance using `SETTLEMENT_MONEY_EPSILON`. Piece/QA/fulfilment gates fail closed when their facts are missing. `pod_evidence_valid` is allowed during action discovery and enforced at execute from command input; OTP remains unsupported. `CREDIT_INVOICE` calls `evaluateB2BFulfilmentPaymentHold`; its current default is non-blocking because order creation is the current authority for B2B credit eligibility. Do not add B2B invoice, reservation, or account-policy logic to workflow. The future B2B feature replaces this seam's implementation without changing workflow callers.
- V2 stage pages must submit an action code, not infer `to_status` from `workflow-context` template flags. `GET /api/v1/orders/{id}/workflow-context` is now a display-only compatibility projection: semantic orders receive artifact modules and an invalid semantic snapshot returns a typed `PROFILE_*` error; only legacy orders may use template-stage reads.
- Do not infer a stage owner from a hard-coded status map. If a Workboard status has no owner, return the configuration gap and keep the order out of the queue until configuration is repaired.
- Never return private storage object keys. Only sign keys inside the exact `{tenantId}/delivery/{stopId}/` scope, use the configured five-minute TTL, and omit an unavailable proof item rather than failing the complete audit response.
- Floor queues must send `workflow_screen`. Do not rebuild membership from a client status list; semantic orders can use statuses the live contract does not mention, and a live-contract status must not pull a semantic order onto a screen its artifact does not own.
- The proof read does not authorize delivery completion. Staff writers are `POST /api/v1/delivery/orders/{orderId}/complete` (no stop) and `POST /api/v1/delivery/stops/{stopId}/complete` (active stop). Keep payment, evidence, idempotency, concurrency, RBAC, and rollback on those commands. Generic `/actions` `CONFIRM_DELIVERY` must stay `403 USE_DELIVERY_COMPLETE_COMMAND`.

## Create hydration, home collection, and hold (20260903)

Tenant programme plan: [future_work_in_wf/04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md](future_work_in_wf/04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md). Operator applied **0479–0486**.

- Create orchestration lives in `web-admin/lib/services/workflow/order-create-workflow.service.ts`. Hydration is pure in `order-create-hydrator.ts` from `sys_wf_create_presets_cd` (`lib/constants/workflow-create-presets.ts`). Do not add retail/remote `if` trees back into `OrderService`.
- Matched Initial rules must carry `create_preset_code`. Unknown or missing presets fail closed.
- Home collection floor:
  - UI: `/dashboard/home-collection` and `/dashboard/home-collection/[id]` (`orders:read`)
  - Thin commands: `POST /api/v1/home-collection/{id}/assign`, `POST /api/v1/home-collection/{id}/fail`
  - Confirm: `POST /api/v1/home-collection/orders/{orderId}/complete` (intake stamps + `CONFIRM_HOME_COLLECTION`). Generic `/actions` for that confirm is blocked.
- `hold_from_status` is on `org_orders_mst` (0436). Engine guards are in `lib/workflow/order-control-transition.ts`. HOLD edges beyond `processing` are profile policy from **0486**.

## Suggested next engineering steps

1. Make the explicit staff S10 routed-POD rollout decision after canary/e2e. Legacy capturePOD/route writers must stay closed.
2. For simple tenants, compile `CONFIRM_DELIVERY` on `driver_delivery` without `delivery_stop_active`. For routed tenants, bind the stop and POD evidence gates, then compile.
3. Synchronize HQ/tenant close-out docs (`p7r-profile-cross-project-docs`). Residual assurance (performance soak, visual a11y/RTL) stays with that close-out and S10.
4. Implement durable B2B finance only in the B2B bounded context through the existing payment-hold seam. HQ can bind the piece/QA/fulfilment/evidence gates now that `0463_sys_wf_gate_ops_fulfilment.sql` is applied locally and remotely.

## Key references

- [02_Architecture.md](02_Architecture.md)
- [06_API_Contracts.md](06_API_Contracts.md)
- [08_UI_UX_Screens.md](08_UI_UX_Screens.md)
- [12_Test_Plan.md](12_Test_Plan.md)
- [technical_docs/public_tracking_token_rollout.md](technical_docs/public_tracking_token_rollout.md)
- [technical_docs/delivery_proof_audit.md](technical_docs/delivery_proof_audit.md)
- [future_work_in_wf/04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md](future_work_in_wf/04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md)
