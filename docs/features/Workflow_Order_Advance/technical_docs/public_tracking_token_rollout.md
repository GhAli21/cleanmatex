# Public Tracking Token Rollout

## Purpose

Hide readable tenant/order identifiers from customer-facing tracking links without breaking already-issued links during the migration window.

## Core implementation

- New helper: `web-admin/lib/utils/public-order-tracking.ts`
- New service: `web-admin/lib/services/public-order-tracking.service.ts`
- New routes:
  - `web-admin/app/track/[token]/page.tsx`
  - `web-admin/app/api/v1/public/track/[token]/route.ts`
  - `web-admin/app/api/v1/public/track/[token]/confirm-received/route.ts`
- Compatibility route redirect:
  - `web-admin/app/public/orders/[tenantId]/[orderNo]/page.tsx`

## Migration dependency

`0441_public_order_tracking_tokens.sql` adds:

- `public_tracking_token`
- `public_tracking_token_expires_at`
- `public_tracking_token_revoked_at`
- backfill + active-token unique index

## Rollout safety behavior

- Code handles `0441` not being applied yet by catching missing-column errors in token lookups.
- Dashboard detail pages and receipt QR generation prefer opaque links when a token exists.
- If a token cannot be resolved yet, the app falls back to the readable route so customer tracking does not break mid-rollout.

## Confirm-received behavior

- Allowed source states: `ready`, `out_for_delivery`
- Idempotent when already `delivered`
- V2 path: `executeAction(CONFIRM_DELIVERY)` on `public_tracking`
- Fallback path: legacy `WorkflowService.changeStatus`
- Customer page disables confirm once delivered and shows pay-on-collection balance context when relevant
