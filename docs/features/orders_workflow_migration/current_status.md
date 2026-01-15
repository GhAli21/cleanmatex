---
version: v0.1.0
last_updated: 2026-01-16
author: CleanMateX AI Assistant
---

# Current status

## Implemented in this session

- Added workflow system mode utility:
  - `web-admin/lib/config/workflow-config.ts`
- Added screen-contract driven orders hook:
  - `web-admin/lib/hooks/use-screen-orders.ts`
- Extended orders list API to optionally include order items (`include_items=true`):
  - `web-admin/app/api/v1/orders/route.ts`
- Migrated Preparation list page to use screen contract + server-side pagination + i18n:
  - `web-admin/app/dashboard/preparation/page.tsx`
- Updated Preparation detail flow to use workflow context + transition hook (compatible with old workflow too):
  - `web-admin/app/dashboard/preparation/[orderId]/page.tsx`
  - `web-admin/app/dashboard/preparation/components/FastItemizer.tsx`
- Migrated Processing list + detail to screen-contract driven listing and transitions:
  - `web-admin/app/dashboard/processing/page.tsx`
  - `web-admin/app/dashboard/processing/[id]/page.tsx`
- Updated OrderActions to use `useOrderTransition` and support gradual rollout:
  - `web-admin/app/dashboard/orders/components/order-actions.tsx`
- Made transition API accept the "new body shape" even when forcing old workflow:
  - `web-admin/app/api/v1/orders/[id]/transition/route.ts`
- Migrated Assembly (list + detail), QA (list + detail), Ready (list + detail) to screen contracts + transitions:
  - `web-admin/app/dashboard/assembly/page.tsx`
  - `web-admin/app/dashboard/assembly/[id]/page.tsx`
  - `web-admin/app/dashboard/qa/page.tsx`
  - `web-admin/app/dashboard/qa/[id]/page.tsx`
  - `web-admin/app/dashboard/ready/page.tsx`
  - `web-admin/app/dashboard/ready/[id]/page.tsx`
- Built Packing screen from scratch (list + detail):
  - `web-admin/app/dashboard/packing/page.tsx`
  - `web-admin/app/dashboard/packing/[id]/page.tsx`
- Replaced Delivery dashboard placeholder with functional delivery queue:
  - `web-admin/app/dashboard/delivery/page.tsx`
- Re-introduced required gradual-migration toggle on list pages:
  - `web-admin/lib/hooks/use-screen-orders.ts` now supports `useOldWfCodeOrNew` (false=old, true/undefined=new)
  - Wired into all workflow list pages (Preparation/Processing/Assembly/QA/Ready/Packing/Delivery)
- Delivery routes are now usable from the Delivery screen (no placeholders):
  - Added `GET /api/v1/delivery/routes` and `DeliveryService.listRoutes()`
  - Removed the hardcoded address placeholder in `DeliveryService.createRoute()` by resolving default customer address
- Delivery stats are now real (no hardcoded placeholders):
  - Added optional `created_after` / `updated_after` filters to `GET /api/v1/orders`
  - Delivery screen uses this to compute “Completed today” from delivered orders

## Pending

- No pending items for this migration. (`npm run build` is green)
