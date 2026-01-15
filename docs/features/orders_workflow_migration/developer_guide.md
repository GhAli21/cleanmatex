---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

# Developer guide

## Key primitives

### Screen contracts

- Client hook: `web-admin/lib/hooks/use-screen-contract.ts`
- API route: `web-admin/app/api/v1/workflows/screens/[screen]/contract/route.ts`
- DB entry point: `cmx_ord_screen_pre_conditions(p_screen text)` (RPC)

Screen contract drives:

- Which statuses appear on a screen
- Additional filters
- Required permissions (future)

### Screen-driven order listing

- Hook: `web-admin/lib/hooks/use-screen-orders.ts`
- Uses the contract’s `preConditions.statuses` to query `/api/v1/orders?status_filter=...`

### Workflow context

- Hook: `web-admin/lib/hooks/use-workflow-context.ts`
- API route: `web-admin/app/api/v1/orders/[id]/workflow-context/route.ts`

### Transitions

- Hook: `web-admin/lib/hooks/use-order-transition.ts`
- API route: `web-admin/app/api/v1/orders/[id]/transition/route.ts`

**Important semantics**

When calling the transition route with `screen`:

- `useOldWfCodeOrNew === false` => OLD workflow code path
- `useOldWfCodeOrNew !== false` => NEW (enhanced) workflow code path

To support gradual rollout without breaking older callers, the transition API also normalizes the request body so that the "new body shape" can be sent even when forcing the old workflow.

### Workflow system toggle

- `web-admin/lib/config/workflow-config.ts`
- Env: `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM`
- Default: false (old workflow)
