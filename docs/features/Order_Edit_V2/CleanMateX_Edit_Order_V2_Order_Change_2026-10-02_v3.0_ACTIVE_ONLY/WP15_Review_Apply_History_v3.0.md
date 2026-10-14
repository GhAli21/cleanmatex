# WP15 Review, Apply, and Change history

**Date:** 2026-10-15 (Asia/Muscat)
**Status:** DONE for the review dialog on the shared workspace. Apply uses the reviewed proof and one retry key. A stale review reloads and does not merge. Change history is a read-only label list.
**Authority:** Living plan WP15. Commercial line Apply, finance follow-up, and the Playwright spec remain later packages.

## Scope delivered

Review opens a dialog over the shared New Order workspace. The dialog lists the operations, current and estimated totals, and the preview status. Apply is available only when that preview is `READY`.

- A draft edit clears the proof. Apply then requires a new review.
- The same idempotency key is reused until the review is cleared. A successful Apply, a 409, or a 422 clears it.
- A warning can be acknowledged and a reason can be entered. Either change marks the review stale until Preview runs again.
- A 409 tells the user to reload. Reload reads Change context again and does not merge the stale draft.
- `GET /api/v1/orders/[id]/changes` returns change number, revision, outcome, reason, and operation codes. Rows whose origin is not `order-edit` are labelled as an earlier order update. Financial snapshots are not returned.
- There is still no independent Save path.

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

No migration, permission, feature flag, or navigation entry was added.

## Verification

- Jest: 26 passed (review 1, controller 6, workspace 3, New Order reducer 16). `--runInBand --forceExit --watchman=false`.
- Targeted ESLint on the controller, review dialog, review view, shared workspace, history service, and changes route exited 0.
- `npm run check:i18n` exited 0. Existing catalog warnings are outside this package.
- `npm run check:ui-access-contract -- --route=/dashboard/orders/[id]/edit --wire --verbose` exited 0. The route contract includes `GET /api/v1/orders/[id]/changes` with `orders:read`.

## Gaps

- Apply still rejects commercial line operations and a changed total. Those editors stay closed.
- Acknowledgement and override collection re-runs Preview. This screen does not grant the override permission.
- History does not show before/after money snapshots.
- No browser pass was run. The local database has no committed order to open.
- Playwright coverage and navigation-away confirmation remain open.
