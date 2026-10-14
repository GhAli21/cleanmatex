# WP14 Edit V2 Workspace

**Date:** 2026-10-15 (Asia/Muscat)
**Status:** DONE for the shared New Order workspace with a separate Edit session. Review calls Preview and does not commit. Apply, commercial line writes, and the review dialog remain later packages.
**Authority:** Living plan WP14 and Part 6. The first separate Edit form was an implementation deviation and has been removed.

The Edit Order feature reuses the existing New Order page/workspace presentation and shared UI components wherever applicable. It does not create a separate duplicate Edit Order screen. Only Edit-specific controller, state, capability, preview, review, conflict, and Apply logic are separate.

## Scope delivered

`/dashboard/orders/{orderId}/edit` loads Change context and mounts `NewOrderLayout`, `NewOrderContent`, and `NewOrderModals`. `EditOrderController` stays separate from `NewOrderController` and from `useOrderSubmission`. Shared components do not choose an API with `isEditMode`. The Edit session supplies Review, Discard, and the context bar through callbacks.

- The context bar shows the order number, revision, workflow status, unsaved header count, Discard, and Review.
- Review copies supported header fields into the Edit controller and calls Preview. An unchanged draft does not call Preview. There is no Save and no `/update` call.
- Discard reloads the loaded baseline.
- Customer identity, branch, and currency stay locked. Name, mobile, and email inputs are read-only.
- Internal notes, customer notes, service speed (the existing express control), and ready-by can change. The shared New Order workspace has no priority control, so this screen does not offer `CHANGE_PRIORITY`.
- Catalog, item, piece, preference, customer, and summary presentation are the existing New Order components. Committed item, piece, and preference UUIDs are projected into that presentation. Same-product lines stay separate because the cart key is the persisted item id.
- Commercial add, remove, quantity, piece, and preference writes are refused while the Edit session is present, because those writes still go through the product-keyed Create reducer and Apply does not accept them yet. The editors stay on screen.
- Current total is the loaded total. Estimated total appears after Preview.
- The workspace does not read the context payload's deferred `featureEnabled: false` or `canEdit: false` as the live flag or permission.

## Component classification

| Class | Components |
|---|---|
| Reused as-is | `NewOrderLayout`, `NewOrderModals`, `ProductGrid`, `OrderDetailsSection`, `OrderPiecePreferencesSection`, `OrderPiecesNotesSection`, `OrderSummaryPanel`, `OrderSummaryBottomSheet`, Cmx controls, existing locale keys |
| Small presentation extraction | `EditOrderContextBar`; summary `primaryAction`; cart id uses `persistedItemId` when present; customer identity fields are read-only when the Edit session is present |
| Create logic kept off the Edit action path | `useOrderSubmission`, `saveOrderUpdate`, and `isEditMode` API branches. The submission hook still mounts inside the shared content because hooks cannot be conditional. Edit does not call it. |
| Removed after migration | `edit-order-workspace.tsx`, the separate Edit-only form |
| Left unmounted | `edit-order-screen.tsx`. It still replaces piece ids with `temp-${productId}-n` and must not be mounted. |

## Reuse

| Piece | Classification | Boundary |
|---|---|---|
| New Order layout, catalog, editors, customer section, summary, and modals | REUSE_AS_IS | Presentation only. The Edit session does not mount the Create controller. |
| Edit controller and change builder | REUSE_AS_IS | Review calls load, header setters, and preview. |
| Change context and Preview routes | REUSE_AS_IS | Context is read with `orders:read`. Preview stays `orders:edit` and CSRF. |
| `cmxMessage` and existing order messages | REUSE_AS_IS | Discard, no-change, and review failure use `cmxMessage` with existing keys. |
| Edit session, context bar, and visual projection | NEW_REQUIRED | Chrome and identity projection around the shared workspace. |
| Legacy edit screen | TEMPORARY_COMPATIBILITY | Unmounted. It is not the V2 workspace. |

## Files

- `web-admin/app/dashboard/orders/[id]/edit/page.tsx`
- `web-admin/src/features/orders/order-change/edit-shared-workspace.tsx`
- `web-admin/src/features/orders/order-change/edit-workspace-adapter.ts`
- `web-admin/src/features/orders/order-change/order-workspace-session.tsx`
- `web-admin/src/features/orders/order-change/edit-order-context-bar.tsx`
- `web-admin/src/features/orders/ui/new-order-content.tsx`
- `web-admin/src/features/orders/ui/order-summary-panel.tsx`
- `web-admin/src/features/orders/hooks/use-new-order-state.ts`
- `web-admin/messages/en/orders/edit.json`
- `web-admin/messages/ar/orders/edit.json`
- `web-admin/__tests__/features/orders/order-change/edit-order-workspace.test.tsx`

No migration, permission, feature flag, or navigation entry was added. The separate form file was deleted.

## Verification

- Shared-workspace Jest: 3 passed. Same-product lines and the persisted piece id stay separate. A piece preference keeps its persisted row id. An unchanged header emits no operation. A notes change emits only `CHANGE_ORDER_NOTES`. The route source mounts `EditSharedWorkspace` and the shared New Order content, and it does not contain the removed form, `saveOrderUpdate`, or `/update`.
- Controller Jest: 5 passed.
- New Order reducer Jest: 16 passed. New Order submission-schema Jest: 9 passed.
- Targeted ESLint on the shared workspace, session, context bar, content, summary, state hook, customer section, piece section, and edit page exited 0.
- Workspace keys already exist in English and Arabic. The context bar uses `text-start` and row flow without physical `ml`/`mr`. No new message keys were added in this correction.
- The earlier route wire check still covers `GET /api/v1/orders/[id]/change-context` with `orders:read`. This correction did not change the access contract.

## Gaps

- Review does not save. WP15 owns the commit dialog, acknowledgement, override reason, conflict reload, and Change history.
- Item, piece, and preference editors are visible and show persisted ids. Their writes are refused on this screen. Apply still rejects those operations.
- The shared workspace has no priority field.
- Warning and override decisions are shown as the Preview status. This screen does not collect the acknowledgement or override.
- `edit-order-screen.tsx` remains on disk and is not mounted.
- No browser pass was run against a committed order. The local database has no order to open, and this package does not seed one.
