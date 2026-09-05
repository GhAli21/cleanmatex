# Order Workspace current status

**Updated:** 2026-09-05  
**Status:** Implemented in the worktree — manual release verification pending

## Confirmed decisions

- User-facing name: **Order workspace**.
- It is an additive hidden detail route opened from existing Order Details; no navigation item, feature flag, or new permission is part of this scope.
- Workspace UI belongs exclusively in `web-admin/src/features/orders/orderdtlworkspace/ui/`.
- Customer contact uses `org_orders_mst.customer_mobile_number`; address/location uses the same order-level delivery context used by delivery.
- Version 1 supports copy-phone only. It does not introduce call, WhatsApp, or SMS actions.
- **Collect payment** opens the existing standard payment flow; Workspace owns no money mutation.
- Timezone fallback policy is branch timezone, then tenant timezone. Calculated SLA/ready-by remains out of V1 pending a canonical source and calendar rules.

## Observed implementation progress

The following implementation artifacts exist in the worktree and indicate the route/presentation foundation is being built. Their functional correctness and completeness have not yet been verified by this documentation pass:

| Artifact | Observed role | Status |
|---|---|---|
| `web-admin/app/dashboard/orders/[id]/workspace/page.tsx` | Hidden Workspace route boundary | Implemented; targeted typecheck/lint passed |
| `web-admin/app/dashboard/orders/[id]/workspace/loading.tsx` | Route loading UI | Implemented; targeted typecheck/lint passed |
| `web-admin/src/features/orders/orderdtlworkspace/ui/` | Isolated Workspace UI package | Implemented; targeted typecheck/lint passed |
| `web-admin/app/dashboard/orders/[id]/order-detail-client.tsx` | Existing page entry-point integration | Implemented; targeted typecheck/lint passed |
| `web-admin/messages/en/orders/detail.json` | English workspace strings | Implemented; i18n parity passed |
| `web-admin/messages/ar/orders/detail.json` | Arabic workspace strings | Implemented; i18n parity passed |

The Workspace implements an operational header, a premium horizontal workflow rail, a responsive command-center overview, standard-payment handoff, work/financial/customer/activity sections, copy-phone feedback, loading state, existing-detail deep links, and an **Actions** tab. The Actions tab reuses the canonical `order_control` Workflow Engine action bar; it does **not** introduce new workflow mutations, payment behavior, SLA calculations, or unsupported audit sources. Manual responsive, accessibility, and live-data verification remain required before release.

## Activity-source boundary

The current `OrderTimeline` is a possible starting point, not a complete Workspace Activity source.

- Usable when rows exist: workflow transitions, item steps, issue lifecycle, completion, voucher posting, AR invoice issuance, and certain financial-history events.
- Partial: QA transition activity can be visible through workflow history, but rich legacy assembly QA decision/note/photo records are not reliably part of order history.
- Not available as a proven V1 order activity event: scans, print-label use, and public-tracking copy/share.
- Required safeguard: Workspace must reach activity data through the approved tenant-scoped service/API boundary; it must not duplicate a client-side direct order-history query that omits visible tenant filtering.

## Release blockers

1. Verify tenant-safe route loading and return navigation against a live tenant session.
2. Verify the existing preparation/action and payment deep links against live data and permissions.
3. Verify customer address/location fields exist in the resolved order delivery context; absent values must remain safely empty.
4. Map only proven localized Activity events; defer all unsupported audit claims.
5. Complete manual EN/AR, RTL, keyboard, screen-reader, dark-theme, and responsive verification.

## Not yet validated

- Targeted automated tests.
- `npm run build` passed after the premium visual pass, including the `/dashboard/orders/[id]/workspace` route.
- Manual responsive checks at 320, 768, 1024, and 1440 pixels.
- Keyboard, screen-reader announcement, dark-theme, and RTL checks.

## Next update trigger

Update this file after live manual verification or a material scope change. Do not mark it release-ready merely because static validation passes.
