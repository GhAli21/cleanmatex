# Developer Guide — Workflow Order Advance

## Purpose

This guide is the practical handoff for engineers extending or debugging the V1 workflow rollout after the main numbered design pack was written.

## Where the current implementation lives

- Workflow engine core: `web-admin/lib/services/workflow/workflow-engine.service.ts`
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
- Keep Workboard assembly in `WorkboardQueryService`. It resolves profile-pinned memberships per order, returns an owning stage path, and must never add workflow or money mutations to this route.
- Do not infer a stage owner from a hard-coded status map. If a Workboard status has no owner, return the configuration gap and keep the order out of the queue until configuration is repaired.
- Never return private storage object keys. Only sign keys inside the exact `{tenantId}/delivery/{stopId}/` scope, use the configured five-minute TTL, and omit an unavailable proof item rather than failing the complete audit response.
- The proof read does not authorize delivery completion. Keep staff completion behind its separate payment, evidence, idempotency, concurrency, RBAC, route-counter, and rollback release gates.

## Suggested next engineering steps

1. Complete Delivery database-backed rollback, tenant-isolation, concurrency, payment, RBAC, and route-counter acceptance coverage before enabling staff completion.
2. Cut remaining Processing, Quality, Packing, and Ready/Release callers to versioned stage services, then build mobile/integration adapters from the same contracts.

## Key references

- [02_Architecture.md](02_Architecture.md)
- [06_API_Contracts.md](06_API_Contracts.md)
- [08_UI_UX_Screens.md](08_UI_UX_Screens.md)
- [12_Test_Plan.md](12_Test_Plan.md)
- [technical_docs/public_tracking_token_rollout.md](technical_docs/public_tracking_token_rollout.md)
- [technical_docs/delivery_proof_audit.md](technical_docs/delivery_proof_audit.md)
