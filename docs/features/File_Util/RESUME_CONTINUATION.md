# File Util — Resume / Continuation (read this first)

**Purpose:** let any assistant or developer continue this feature without the chat history.
**Authoritative docs:** [PLAN.md](PLAN.md) (design, decisions, task checklist) · [STATUS.md](STATUS.md) (dated log).
**Last updated:** 2026-11-17 — Phase 4 IN PROGRESS (see §3a for exactly what is done/not done).

## 1. Where we are

| Phase | State |
|---|---|
| 1 Foundation (DB) | Done. Migration `0743_file_util_foundation.sql` applied local + remote. |
| 2 Backend | Done. `0744_file_util_cleanup_cron.sql` applied. HQ `platform-workers` purge job written; **owner must deploy platform-workers**. |
| 3 UI kit | Done. tsc/eslint clean, `npm run build` green, i18n check passes. Not yet browser-tested. |
| 4 Order photos | **In progress** — see §3a. |
| 5–8 | Not started. |

## 2. Files that exist (do not recreate)

**DB (applied):** `supabase/migrations/0743_file_util_foundation.sql`, `0744_file_util_cleanup_cron.sql`.

**Backend (web-admin, tested 47/47):**
- `lib/constants/file-util.ts` — codes mirroring DB, category → permission map.
- `lib/services/file-util/file-util.service.ts` — init/complete/list/sign/update/delete/config.
- `lib/services/file-util/file-sniff.ts` — content checks (14 active types).
- `lib/services/file-util/file-util-http.ts` — route guard, zod schemas, error mapping.
- `app/api/v1/file-util/route.ts` (GET list, POST init), `[id]/route.ts` (PATCH, DELETE), `[id]/complete/route.ts`, `sign/route.ts`, `config/route.ts`.
- `lib/services/usage-tracking.service.ts` — added `getTenantStorageBytes`, `canStoreBytes`.
- Tests: `__tests__/services/file-sniff.test.ts`, `__tests__/services/file-util.service.test.ts`, `__tests__/api/v1/file-util.route.test.ts`.

**HQ (cleanmatexsaas, tested):** `platform-workers/src/file-util/purge.processor.ts` + `.spec.ts`; wired in `platform-workers/src/main.ts`.

**Phase 3 (done, build green):**
- `src/features/file-util/model/file-util-types.ts`, `model/prepare-image.ts` (downscale + WebP thumb)
- `src/features/file-util/api/file-util-api.ts` (fetch + XHR PUT with progress)
- `src/features/file-util/hooks/use-file-attachments.ts` (TanStack Query + upload queue, max 3 parallel)
- `src/features/file-util/ui/file-attachments.tsx` (connected widget `FileAttachments`)
- `src/ui/forms/cmx-file-drop-zone.tsx` (`CmxFileDropZone`)
- `src/ui/overlays/cmx-camera-capture-dialog.tsx` (`CmxCameraCaptureDialog`)
- `src/ui/data-display/cmx-file-gallery.tsx` (`CmxFileGallery`, `CmxFileItem`, `formatFileSize`)
- `src/ui/overlays/cmx-file-viewer-dialog.tsx` (`CmxFileViewerDialog`)
- Stories: `cmx-file-drop-zone.stories.tsx`, `cmx-file-gallery.stories.tsx`, `cmx-file-viewer-dialog.stories.tsx`, `cmx-camera-capture-dialog.stories.tsx` (wrap `NextIntlClientProvider` with real `common` messages)
- `src/features/file-util/index.ts` (public entry), i18n `messages/{en,ar}/common.json` → `files.*`, `messages/{en,ar}/fileUtil.json`, `.clauderc` snippets `file_drop_zone`, `camera_capture_dialog`, `file_viewer_dialog`, `file_gallery`, `file_attachments`

## 3a. Phase 4 progress (live)

Design chosen: photos taken on the New Order screen are kept as `pendingPhotos: File[]` in the new-order state and uploaded with `uploadFile()` right after the order is saved (the order id does not exist before). Source `ORDER_NEW` (or `ORDER_EDIT` in edit mode), purpose `BEFORE_IMAGE`, category `ORDER_FILE`.

Done:
- [x] `uploadFile()` extracted to `src/features/file-util/api/file-util-api.ts` (usable outside React); hook `use-file-attachments.ts` now calls it; exported from `src/features/file-util/index.ts`.
- [x] `pendingPhotos: File[]` + actions `ADD_PENDING_PHOTO` / `REMOVE_PENDING_PHOTO` in `src/features/orders/model/new-order-types.ts` and `src/features/orders/ui/context/new-order-reducer.ts` (initial `[]`; `RESET_ORDER` clears via initialState; `EXIT_EDIT_MODE` clears). tsc clean.

Not done yet (in order):
- [ ] `src/features/orders/ui/new-order-modals.tsx`: replace `PhotoCaptureModal` (~line 493) with `CmxCameraCaptureDialog` from `@ui/overlays`; `handlePhotoCapture` (~line 315) → `state.dispatch({ type: 'ADD_PENDING_PHOTO', payload: photo })`; warn via `cmxMessage` when `ORDER_DEFAULTS.LIMITS.MAX_PHOTOS` reached.
- [ ] `src/features/orders/ui/product-grid.tsx`: today it receives `onOpenPhotoCapture` and discards it (`void onOpenPhotoCapture;` ~line 121) → render a "photos (n)" button; add a `pendingPhotoCount` prop passed from `new-order-content.tsx` (~line 1283).
- [ ] `src/features/orders/hooks/use-order-submission.ts` (~line 724, after `state.setCreatedOrder`): read `state.state.pendingPhotos` before `resetOrder()`; if any, upload each with `uploadFile({ category:'ORDER_FILE', purpose:'BEFORE_IMAGE', entityId: orderId, source: isEditMode ? 'ORDER_EDIT' : 'ORDER_NEW', file, imageMaxDimension: 2048, csrfToken })`, fire-and-forget, then `cmxMessage` success/warning with counts (i18n keys under `fileUtil`).
- [ ] Delete `src/features/orders/ui/components/photo-capture-modal.tsx` when unused; grep `newOrder.photoCapture` keys before removing any.
- [ ] Order detail `app/dashboard/orders/[id]/order-detail-client.tsx`: add `<FileAttachments category="ORDER_FILE" entityId={order.id} source="ORDER_DETAIL" readOnly={!canUpdate} />` (edit needs `orders:update`).
- [ ] i18n for any new strings (EN+AR), `npm run check:i18n`; tsc, eslint, `npm run build`.
- [ ] `QA_TEST_GUIDE.md`; tick PLAN 4.x; STATUS row; update this file.

## 3. Next steps (in order) — Phase 4: order photos

1. Read `src/features/orders/ui/new-order-modals.tsx` (uses `PhotoCaptureModal` ~line 493) and find where captured photos are dropped today (plan §1: photos are discarded). New orders have no id until saved, so either upload after the order is created (queue files in state, then call `useFileAttachments` / API with the new order id, `source: 'ORDER_NEW'`, purpose `BEFORE_IMAGE`) or add photos from order detail. Pick the smallest flow that does not lose photos; explain it in STATUS.
2. Replace `PhotoCaptureModal` with `CmxCameraCaptureDialog` (`@ui/overlays`); delete `photo-capture-modal.tsx` once unused; remove its now-unused `newOrder.photoCapture.*` keys only if nothing else uses them (grep first).
3. Order detail (`app/dashboard/orders/[id]/order-detail-client.tsx`): add `<FileAttachments category="ORDER_FILE" entityId={order.id} source="ORDER_DETAIL" readOnly={!canUpdate} />` (`orders:update` decides edit).
4. Browser test end-to-end with a tenant that HAS a subscription (2 of 4 demo tenants do): upload JPEG, PDF, HEIC; delete; edit purpose/note; viewer; RTL.
5. Write `docs/features/File_Util/QA_TEST_GUIDE.md` (sidebar path, URL, what to click, expected).
6. eslint, tsc, build; tick 4.x in PLAN, STATUS row, update this file.

## 4. Rules that matter here

- Read CLAUDE.md (repo root). Load skills before writing: `/frontend`, `/i18n`, `/storybook`, `/backend`, `/database`, `/multitenancy`.
- Never apply migrations; write SQL then stop for the owner. Migration number = last in `supabase/migrations/` + 1 at write time.
- Every `org_*` query filters `tenant_org_id` explicitly.
- Cmx components only; feedback via `cmxMessage`; EN + AR + RTL.
- After every step: update PLAN.md checkboxes, STATUS.md log, and this file.

## 5. Owner follow-ups open

- Deploy HQ `platform-workers` (purge job `file-util-purge`).
- Data gap: only 2 of 4 organizations have a subscription → others get `PLAN_UNAVAILABLE` on upload.
