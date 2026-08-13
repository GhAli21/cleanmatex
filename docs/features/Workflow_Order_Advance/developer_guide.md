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

## Current rollout state

- `0437_sys_wf_public_confirm_actor.sql` provides the system actor and `public_tracking` route support used by public confirm-received.
- `0441_public_order_tracking_tokens.sql` adds the opaque token columns and index for `/track/{token}`.
- Repo code already tolerates `0441` being absent by falling back to readable paths and by swallowing missing-column errors in token lookups.

## Extension rules

- Keep public tracking token behavior centralized in `public-order-tracking.service.ts` and `public-order-tracking.ts`.
- Preserve legacy readable route compatibility until `0441` is applied everywhere and old links are considered expired.
- Do not add alternate customer-facing tracking URL formats outside these helpers.
- Public order reads and confirm actions must remain tenant-safe and must not bypass the workflow engine when `workflow_engine_v2` is enabled.

## Suggested next engineering steps

1. Finish P7 with browser/e2e coverage for public confirm-received, cancel, hold, and stop flows.
2. Complete P5 retirement work for remaining workflow RPC dependencies.
3. Revisit legacy readable links only after `0441` is applied and historical QR/receipt links are assessed.

## Key references

- [02_Architecture.md](02_Architecture.md)
- [06_API_Contracts.md](06_API_Contracts.md)
- [08_UI_UX_Screens.md](08_UI_UX_Screens.md)
- [12_Test_Plan.md](12_Test_Plan.md)
- [technical_docs/public_tracking_token_rollout.md](technical_docs/public_tracking_token_rollout.md)
