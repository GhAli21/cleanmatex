# 06 - Order Service Track By Piece

## Summary (Updated: Always Use Pieces)

**As of the "always use pieces" enhancement**, piece creation no longer checks the `USE_TRACK_BY_PIECE` tenant setting. Pieces are **always** created for every order item (when quantity > 0). The UI always shows piece-level tracking (`trackByPiece` is effectively true everywhere).

## Historical Context

- Previously, `if (trackByPiece || true)` forced piece creation for every order (testing override).
- That was changed to `if (trackByPiece)` so piece creation respected the tenant setting.
- **Current behavior:** The check was removed entirely; pieces are always created. `USE_TRACK_BY_PIECE` is no longer used to gate piece creation or display.

## File(s) Affected (Current)

- `web-admin/lib/services/order-service.ts` – always create pieces in both `createOrder` and `createOrderInTransaction`
- `web-admin/lib/db/orders.ts` – always create pieces in `addOrderItems`
- `web-admin/app/api/v1/orders/[id]/batch-update/route.ts` – always use piece update path
- `web-admin/lib/hooks/useTenantSettings.ts` – `trackByPiece` forced to `true` in returned settings
- Documentation and type comments updated accordingly

## Effects

- Every new order item gets corresponding rows in `org_order_item_pieces_dtl`.
- All workflow and order-detail UIs show piece-level data (no setting gate).
