# WP16 Separate financial follow-up

**Date:** 2026-10-15 (Asia/Muscat)
**Status:** DONE for the follow-up plan, the existing pay-on-collection route, and stored-value resolution. Cash refund, gateway refund, and collection for any other original payment type stay unavailable.
**Authority:** Living plan WP16. Apply still does not collect or refund.

## Scope delivered

After a committed Change, the edit screen reads the current order balance and shows only the follow-up the existing Finance owners can perform.

- A remaining balance on a `PAY_ON_COLLECTION` order points at the existing `POST /api/v1/orders/[id]/payments` route. Permission is `orders:collect_payment`. This screen does not take the payment and does not send `collectedBy`.
- Any other original payment type is shown as unavailable. The payment type is not changed.
- An extra amount with a customer can be moved, for the exact cap shown, to customer advance, customer credit, or customer wallet. `POST /api/v1/orders/[id]/financial-resolution` calls `executeOverpaymentDispositionTx` and then `recalculateOrderFinancialSnapshotTx`. Permission is `orders:overpayment_allocate`. The actor is the authenticated user. The same idempotency key replays through the disposition owner.
- A cash or original-method refund stays on the existing refund screen. An automatic gateway refund is not offered.
- An amount above the unresolved extra is rejected. A missing customer or currency is rejected. Both an amount due and an extra amount together stop the plan.

No new permission, feature flag, navigation entry, or billing change. No migration.

## Files

- `web-admin/lib/services/order-change/order-change-follow-up.ts`
- `web-admin/lib/services/order-change/order-change-follow-up.service.ts`
- `web-admin/app/api/v1/orders/[id]/changes/follow-up/route.ts`
- `web-admin/app/api/v1/orders/[id]/financial-resolution/route.ts`
- `web-admin/src/features/orders/order-change/order-change-follow-up-dialog.tsx`
- `web-admin/src/features/orders/access/orders-access.ts`

## Stops that remain later

- Structural item and piece writes stay in WP17.
- The shared lock order across payment, refund, voucher, and Change writers is still open.
- A refund initiated here is not implemented. Initiation is not settlement.
- Playwright and a browser pass of this dialog were not run.

## Next package

WP17 — migrate committed writers and restrict direct bypasses. It is not started.
