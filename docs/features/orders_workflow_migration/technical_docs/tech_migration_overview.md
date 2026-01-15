---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

# Technical: migration overview

## Key files touched (web-admin)

- `lib/config/workflow-config.ts`
- `lib/hooks/use-screen-orders.ts`
- `lib/hooks/use-order-transition.ts`
- `app/api/v1/orders/[id]/transition/route.ts`
- `app/dashboard/preparation/page.tsx`
- `app/dashboard/preparation/[orderId]/page.tsx`
- `app/dashboard/preparation/components/FastItemizer.tsx`
- `app/dashboard/orders/components/order-actions.tsx`

## Notes

- Orders listing is tenant-scoped via `/api/v1/orders` which applies `.eq('tenant_org_id', tenantId)`.
- Screen contracts are fetched via RPC `cmx_ord_screen_pre_conditions(p_screen)`.
- Transition route supports both old and new workflow engines; selection is based on `screen` + `useOldWfCodeOrNew`.


