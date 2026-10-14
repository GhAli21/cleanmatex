# WP14 Edit V2 Workspace

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for preparing a supported Change without committing it. Apply, commercial line edits, and the review dialog remain later packages.
**Authority:** Living plan WP14. The edit route no longer uses the legacy status allowlist, lock, or update hook.

## Scope delivered

The existing edit route loads the Change context and renders a governed workspace. Review calls Preview. It does not call Apply.

- Revision, workflow status, access status, and the unsaved operation count are visible.
- Discard reloads the loaded baseline and reports that the draft was cleared.
- Customer id, branch, and currency stay locked. Customer snapshot name, mobile, and email can change.
- Internal notes, customer notes, priority, service speed, and ready-by can change. Service speed accepts only Standard or Express.
- A denied Preview decision disables that operation and shows the reason code. A blocked access status disables the draft.
- Current and estimated totals come from the Preview result. Before review, the loaded total remains the current total.
- Items stay read-only, including two lines for the same product and an order with no items. Piece and preference edits stay closed.
- The workspace does not read the context payload's deferred `featureEnabled: false` or `canEdit: false` as the live flag or permission. Preview remains the server decision.

## Reuse

| Piece | Classification | Boundary |
|---|---|---|
| Edit controller and change builder | REUSE_AS_IS | The workspace calls load, field setters, and preview. It does not build a second operation model. |
| Change context and Preview routes | REUSE_AS_IS | Context is read with `orders:read`. Preview stays `orders:edit` and CSRF. |
| Cmx controls and `cmxMessage` | REUSE_AS_IS | Notes, speed, and actions use the existing controls. Discard and review failures use `cmxMessage`. |
| Existing order and common messages | REUSE_AS_IS | Customer, notes, priority, branch, currency, close, and loading reuse current keys. |
| Edit workspace and context mapper | NEW_REQUIRED | The legacy form keys lines by product and is not the V2 authority. |
| Legacy edit screen | TEMPORARY_COMPATIBILITY | `edit-order-screen.tsx` remains in the repo and is no longer mounted by this route. |

## Files

- `web-admin/app/dashboard/orders/[id]/edit/page.tsx`
- `web-admin/src/features/orders/order-change/edit-order-workspace.tsx`
- `web-admin/src/features/orders/order-change/edit-order-view-model.ts`
- `web-admin/src/features/orders/order-change/edit-order-controller.ts`
- `web-admin/src/features/orders/access/orders-access.ts`
- `web-admin/messages/en/orders/edit.json`
- `web-admin/messages/ar/orders/edit.json`
- `web-admin/__tests__/features/orders/order-change/edit-order-workspace.test.tsx`

No migration, permission, feature flag, or navigation entry was added.

## Verification

- Workspace Jest: 4 passed. The notes review calls `/changes/preview` with the CSRF header and does not call `/changes`. A denied notes decision disables the field. Blocked access disables the draft. Discard restores the loaded notes. Two same-product lines stay separate. An empty item list is valid.
- Controller Jest from WP13: 5 passed after the optional request-header callback.
- Targeted ESLint on the workspace, view model, controller, edit page, and access contract exited 0.
- `npm run check:i18n` passed. New workspace keys exist in English and Arabic.
- `npm run check:ui-access-contract -- --route=/dashboard/orders/[id]/edit --wire --verbose` passed. The route contract now includes `GET /api/v1/orders/[id]/change-context` with `orders:read`.

## Gaps

- Review does not save. WP15 owns the commit dialog, acknowledgement, override reason, conflict reload, and Change history.
- Item, piece, and preference changes are visible as saved rows and are not editable. Apply still rejects those operations.
- Warning and override decisions are shown as the Preview status. This screen does not collect the acknowledgement or override.
- The legacy edit screen is unused by this route and was not deleted.
- No browser pass was run against a committed order. The local database has no order to open, and this package does not seed one.
