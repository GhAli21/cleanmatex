# WP15 Review, Apply, and Change history

**Date:** 2026-10-15 (Asia/Muscat)
**Status:** DONE for the review dialog, proof-bound Apply, conflict reload, and read-only Change history. Apply now also saves catalog preferences and the tracked item and piece fields listed below. Structural item and piece writes stay stopped for a later writer package. Finance follow-up is the next package, WP16.
**Authority:** Living plan WP15.

## Scope delivered

Review opens a dialog over the shared New Order workspace. The dialog lists the operations, current and estimated totals, and the preview status. Apply is available only when that preview is `READY`.

- A draft edit clears the proof. Apply then requires a new review.
- The same idempotency key is reused until the review is cleared. A successful Apply, a 409, or a 422 clears it.
- A warning can be acknowledged and a reason can be entered. Either change marks the review stale until Preview runs again.
- A 409 tells the user to reload. Reload reads Change context again and does not merge the stale draft.
- `GET /api/v1/orders/[id]/changes` returns change number, revision, outcome, reason, and operation codes. Rows whose origin is not `order-edit` are labelled as an earlier order update. Financial snapshots are not returned.
- There is still no independent Save path.

## Apply coverage added after the review dialog

Review lists every screen change. A change with no Edit Policy operation is `CHANGE_UNLISTED`. Preview and Apply allow that code with reason `NOT_IN_POLICY`. A catalog operation with no policy rule still denies. Migration `0622_order_change_unlisted_operation.sql` allows the history row. The operator applied it locally and remotely. It does not seed the Edit Policy catalog.

Apply writes these rows inside the same Change transaction. It does not call `OrderService.updateOrder` and it does not delete and recreate items or pieces.

- Catalog preferences on the order, a saved item, or a saved piece: insert, content update, or logical removal. The extra price is read from `org_service_preference_cf` for that organization. The row source is `ORDER_EDIT`.
- An order-level preference with an extra price creates a `PREFERENCE` charge. Removing that preference voids the charge. Apply then calls `recalculateOrderFinancialSnapshotTx`. If the snapshot total does not match the reviewed total, the transaction rolls back with `FINANCIAL_SNAPSHOT_MISMATCH`.
- Tracked fields on an existing row: item notes, stain, damage, stain notes, damage notes, packing, price override, and override reason; piece color, brand, notes, packing, stain, and damage.

## Files added for that coverage

- `web-admin/lib/services/order-change/order-change-commercial-write.ts`
- `web-admin/lib/services/order-change/order-change-apply.service.ts`
- `web-admin/src/features/orders/order-change/change-builder.ts`
- `web-admin/src/features/orders/order-change/edit-workspace-adapter.ts`
- `supabase/migrations/0622_order_change_unlisted_operation.sql`

No new permission, feature flag, navigation entry, or billing change.

## Stops parked for later

These are not WP16. WP16 is additional collection and overpayment resolution after a committed Change. The structural writer remains WP17.

- `ADD_ITEM`, `REMOVE_ITEM`, `CHANGE_ITEM_QUANTITY`, `ADD_PIECE`, and `REMOVE_PIECE` still return `COMMERCIAL_LINE_UNSUPPORTED`. The old editor deleted every piece and created new ids. That must not be copied, because workflow scans keep the existing piece ids.
- A preference on a new item or piece that has no saved parent returns `PREFERENCE_PARENT_NOT_PERSISTED`.
- Piece conditions are not a column. The old editor wrote them as condition preference rows. Apply does not write them yet.
- A preference with no catalog id is only `CHANGE_UNLISTED`. Apply records it and does not create a preference row.
- A priced item or piece preference is stored only when the recalculated order total still matches the review. Those extras sit inside the line price, and this Apply does not rewrite line prices.
- A price override is stored on the item. The snapshot total still uses the line price, not that override column.
- A changed total with no preference operation still returns `COMMERCIAL_TOTAL_CHANGED`.
- An outstanding balance whose collection policy is not decided still returns `COLLECTION_POLICY_UNRESOLVED`. That decision belongs to WP16. Apply does not collect or refund.

## Files

- `web-admin/src/features/orders/order-change/edit-review-dialog.tsx`
- `web-admin/src/features/orders/order-change/edit-review-view.ts`
- `web-admin/src/features/orders/order-change/edit-order-controller.ts`
- `web-admin/src/features/orders/order-change/edit-shared-workspace.tsx`
- `web-admin/lib/services/order-change/order-change-history.service.ts`
- `web-admin/app/api/v1/orders/[id]/changes/route.ts`
- `web-admin/src/features/orders/access/orders-access.ts`
- `web-admin/messages/en/orders/edit.json`
- `web-admin/messages/ar/orders/edit.json`

The review dialog added no permission, feature flag, or navigation entry. The later `CHANGE_UNLISTED` history row is migration `0622`, already applied.

## Verification

- Jest: 26 passed (review 1, controller 6, workspace 3, New Order reducer 16). `--runInBand --forceExit --watchman=false`.
- Apply coverage re-run: 9 passed in `order-change-apply.service.test.ts`, including the catalog preference and piece-color case. `--forceExit`.
- Targeted ESLint on the controller, review dialog, review view, shared workspace, history service, changes route, Apply service, and commercial writer exited 0.
- `npm run check:i18n` exited 0. Existing catalog warnings are outside this package.
- `npm run check:ui-access-contract -- --route=/dashboard/orders/[id]/edit --wire --verbose` exited 0. The route contract includes `GET /api/v1/orders/[id]/changes` with `orders:read`.

## Still open inside WP15

- Acknowledgement and override collection re-runs Preview. This screen does not grant the override permission.
- History does not show before/after money snapshots.
- No browser pass was run. The local database has no committed order to open.
- Playwright coverage and navigation-away confirmation remain open.
- `cmx.cleanmatex.com` does not have this Apply until web-admin is deployed.

## Next package

WP16 — separate financial follow-up. A pay-on-collection balance uses the existing collection route. Stored value uses the disposition owner. Apply still does not collect or refund. See [WP16 report](WP16_Financial_Follow_Up_v3.0.md).
