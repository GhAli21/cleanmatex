# File Util — Resume / Continuation (read this first)

**Purpose:** let any assistant or developer continue this feature without the chat history.
**Authoritative docs:** [PLAN.md](PLAN.md) (design, decisions, task checklist) · [STATUS.md](STATUS.md) (dated log).
**Last updated:** 2026-11-17 — Phase 5 code done, build green. Owner: apply `0750`, delete `product-images` bucket, QA (A, B, C). Next: Phase 6.

## 1. Where we are

| Phase | State |
|---|---|
| 1 Foundation (DB) | Done. Migration `0743_file_util_foundation.sql` applied local + remote. |
| 2 Backend | Done. `0744_file_util_cleanup_cron.sql` applied. HQ `platform-workers` purge job written; **owner must deploy platform-workers**. |
| 3 UI kit | Done. tsc/eslint clean, `npm run build` green, i18n check passes. Not yet browser-tested. |
| 4 Order photos | Code done, build green — owner browser QA pending (`QA_TEST_GUIDE.md` A + B). |
| 5 Close gaps | Code done, build green. Owner: apply `0750`, delete `product-images` bucket in dashboard, QA §C. |
| 6–8 | Not started. |

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
- [x] `new-order-modals.tsx`: `PhotoCaptureModal` replaced by `CmxCameraCaptureDialog` (`@ui/overlays`); `handlePhotoCapture` dispatches `ADD_PENDING_PHOTO`, warns via `cmxMessage` at `ORDER_DEFAULTS.LIMITS.MAX_PHOTOS`.
- [x] Deleted `src/features/orders/ui/components/photo-capture-modal.tsx`; trimmed `messages/{en,ar}/newOrder/photoCapture.json` to the only key still used (`maxPhotosReached`).

- [x] `product-grid.tsx`: "Photo" button with pending count (`pendingPhotoCount` prop from `new-order-content.tsx`); key `newOrder.itemsGrid.photosPending` (EN/AR, plural).
- [x] `use-order-submission.ts`: after `setCreatedOrder`, `uploadFilesToRecord()` (new helper in `src/features/file-util/api/file-util-api.ts`, exported from index) uploads `pendingPhotos` to `ORDER_FILE`/`BEFORE_IMAGE`, source `ORDER_NEW` or `ORDER_EDIT`; not awaited; reports via `fileUtil.orderPhotosSaved` / `orderPhotosFailed`.
- [x] Order detail `app/dashboard/orders/[id]/order-detail-client.tsx`: new tab `files` (after `delivery_proof`) rendering `FileAttachments` (`ORDER_FILE`, source `ORDER_DETAIL`, `readOnly` unless `useHasPermission('orders','update')`); label `orders.detail.financial.tabs.files` (EN/AR).
- Gotcha: locale files under `messages/**` are CRLF in git; edit them byte-preserving (rebuild from `git show HEAD:...` + insert) or the diff becomes the whole file.

Not done yet (in order):
- [x] `npm run check:i18n` passes; tsc + eslint clean on all touched files (JSDoc warnings fixed in file-util-api; unused img eslint-disables removed).
- [x] `npm run build` green (2026-11-17).
- [x] `QA_TEST_GUIDE.md` written; PLAN 4.1–4.3 ticked; STATUS row added.
- [ ] Owner browser QA (QA_TEST_GUIDE A + B). Then Phase 5 (product images, tenant logo, product-images policy migration, remove MinIO/tenant-assets/upload-photo.ts).

## 3b. Phase 5 progress (live) — started 2026-11-17

Findings (remote DB, read-only):
- `PRODUCT_IMAGE` and `TENANT_LOGO` both use `TENANT_PUBLIC` → `tenants-cmx-public` (public). MAIN is single-slot (`max_files = 1`) in both.
- `tenant-assets` bucket does not exist, so `/api/v1/tenants/me/logo` (no callers) could never work.
- Only 1 product has `product_image` (in `product-images`), and 0 tenants have `logo_url`. All are demo data.
- `product-images` has 4 open policies (authenticated insert/update/delete on bucket_id only). `postgres` does **not** own `storage.objects` (owner `supabase_storage_admin`, not a member), so a migration **cannot DROP these policies**. Plan instead: a migration that locks the bucket on `storage.buckets` (private, size limit 1 byte, an impossible MIME list), so the Storage API refuses every upload. The owner then deletes the empty bucket in the dashboard; deleting it also kills the policies (FK).

Design (decision 14): `org_product_data_mst.product_image` and `org_tenants_mst.logo_url` stay, as the **published public URL of the MAIN file**. The File Util service rewrites them in the same transaction whenever the MAIN slot changes (complete, purpose change, delete). The file row is the truth; the column is a read projection for ~20 readers (mobile, receipts, public booking, HQ). Public-bucket URLs never change, so no signed URL is stored.

Steps:
- [x] 5.a Service: `syncPublishedUrl` projection in complete/update/delete + tests (File Util tests 50/50).
- [x] 5.b (done: form edit mode shows `FileAttachments`, preview reads MAIN via `useFileAttachments({purposes:['MAIN']})`; route + helper deleted; `catalog-access.ts` lists File Util deps as `enforcement: 'external'`) Product form → `FileAttachments` (PRODUCT_IMAGE, source PRODUCT_SETUP); delete `api/v1/products/[id]/image`, `lib/storage/product-images.ts`; catalog-access deps.
- [x] 5.c (done: page shows `FileAttachments` TENANT_LOGO; PUT saves colors only, ignores `logo`; `BrandingSettingsInput.logo` removed; old routes/helpers/`uploadLogo` + its test deleted; `settings-access.ts` lists File Util deps; i18n `uploadLogo`/`noLogo` removed, `logoGuidelines` updated. FOUND, not fixed (outside File Util): `PATCH /api/v1/tenants/me` spreads the raw body into the `org_tenants_mst` update — no field allowlist, so any column incl. `logo_url` can be written; reported to owner) Branding page logo → File Util (TENANT_LOGO, entity = tenant id, source TENANT_SETTINGS); delete `settings/branding/logo` route, `tenants/me/logo` route, `tenants.service.uploadLogo` (+ its test), `lib/storage/tenant-logo.ts`; branding PUT must stop accepting `logo_url` from the client.
- [x] 5.d (done: files deleted; `npm uninstall minio -w web-admin` from repo root (24 packages left the root lockfile); MinIO service + volume removed from `docker-compose.yml`; dev scripts start/stop/status/check-prerequisites/smoke-test/reset-db cleaned and parse-checked; `.clauderc`, README, `docs/development-setup.md`, `web-admin/VERCEL_DEPLOYMENT.md` updated. Left as history: archive/plan docs, `.claude|.codex|.agents|.cursor` reference docs, generated `docs/features/Platform_Operations_Console/config_key_env_map.json`) Delete MinIO: `lib/storage/minio-client.ts`, `app/actions/orders/upload-photo.ts`, `minio` dep, docker-compose service, env docs.
- [x] 5.e Migration written: `supabase/migrations/0750_file_util_retire_product_images.sql` (bucket private, 1-byte limit, impossible MIME → Storage API refuses all writes; clears `product_image` URLs pointing into `product-images`). **Owner: apply local + remote, then delete the empty `product-images` bucket and its 4 policies in the dashboard.** Not applied by the assistant.
- [x] 5.f eslint clean (touched files), tests 81/81 (5 suites), i18n pass, tsc: 4 errors all outside this work, `npm run build` green (2026-11-17). PLAN (decision 14, 5.1–5.4 ticked), STATUS, QA guide §C written.
- Next: owner applies `0750` + deletes bucket + QA §C; then Phase 6.
- [ ] 5.f eslint/tsc/tests/build, QA guide section C, PLAN/STATUS.
- Deferred: FOR_ORDER-with-MAIN-fallback display on the New Order grid (needs `CmxFileThumb` + batch list); grid keeps using `product_image` (MAIN).

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
