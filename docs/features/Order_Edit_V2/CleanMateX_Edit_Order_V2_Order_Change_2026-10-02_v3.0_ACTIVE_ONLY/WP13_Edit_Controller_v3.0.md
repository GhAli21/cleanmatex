# WP13 Shared Edit Controller

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for the Edit identity controller. WP14 later mounted this controller on the edit route and stopped using the legacy update from that route. This report records the controller only.
**Authority:** Living plan WP13. Create grouping and the Create submit route stay where they are.

## Scope delivered

The Edit controller keeps one draft keyed by persisted row ids. A new row uses a client reference. Create still groups a new line by product.

- Two lines for the same product stay separate. A quantity change names the edited item id, including the selected piece ids.
- A local item that is added and then removed produces no operation.
- Removing a persisted piece names that piece id. A new piece under a persisted item names the item id. A preference on that new piece names the piece client reference.
- Order, item, and piece preferences each get their own target.
- A loaded order without an item id or a revision is rejected. A loaded piece id is kept.
- Preview and Apply are the only HTTP calls. They go to `/api/v1/orders/[id]/changes/preview` and `/api/v1/orders/[id]/changes`. An unchanged draft does not call Preview.
- The Edit screen loads this controller once and supplies it to the shared workspace. The form still uses temporary piece ids for the existing selectors, and it now also keeps `persistedItemId`, `persistedId` on pieces, and `persistedId` on preferences.

## Reuse

| Piece | Classification | Boundary |
|---|---|---|
| New Order reducer and `use-order-submission` | REUSE_AS_IS | Create still submits through `submit-order`. The legacy Edit button still calls the existing update hook. |
| Change request schema | REUSE_AS_IS | Built operations parse through `orderChangeRequestSchema`. |
| Preview and Apply routes | REUSE_AS_IS | The controller calls them. It does not calculate prices or write rows. |
| Edit draft and change builder | NEW_REQUIRED | Persisted identity does not fit the Create product grouping. |

## Files

- `web-admin/src/features/orders/order-change/edit-order-view-model.ts`
- `web-admin/src/features/orders/order-change/change-builder.ts`
- `web-admin/src/features/orders/order-change/edit-order-controller.ts`
- `web-admin/src/features/orders/order-change/edit-order-controller-context.tsx`
- `web-admin/src/features/orders/ui/edit-order-screen.tsx`
- `web-admin/src/features/orders/model/new-order-types.ts`
- `web-admin/__tests__/features/orders/order-change/edit-order-controller.test.ts`

No migration, permission, feature flag, route, or screen layout was added.

## Verification

```text
npx jest __tests__/features/orders/order-change/edit-order-controller.test.ts --runInBand --forceExit --watchman=false
npx eslint src/features/orders/order-change/edit-order-view-model.ts src/features/orders/order-change/change-builder.ts src/features/orders/order-change/edit-order-controller.ts src/features/orders/order-change/edit-order-controller-context.tsx src/features/orders/ui/edit-order-screen.tsx src/features/orders/model/new-order-types.ts __tests__/features/orders/order-change/edit-order-controller.test.ts --quiet
```

Results: 5 tests passed. Targeted ESLint exited 0.

## Gaps

- The visible Save action still calls the legacy order update. WP14 must call this controller instead.
- The shared reducer can still update the first line when two lines share a product id. The controller does not.
- Preference rows are omitted from the baseline when the loaded payload has no preference row id. The current order GET response does not return that id.
- No browser pass was run. The Save button behavior did not change.
