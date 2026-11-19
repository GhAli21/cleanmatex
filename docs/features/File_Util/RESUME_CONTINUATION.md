# File Util — Resume / Continuation (read this first)

**Purpose:** let any assistant or developer continue this feature without the chat history.
**Authoritative docs:** [PLAN.md](PLAN.md) (design, decisions, task checklist) · [STATUS.md](STATUS.md) (dated log).
**Last updated:** 2026-11-19 — **PLAN DONE in code (Phases 1–8).** All migrations `0743`–`0768` applied by owner. Phase 8: [ADR_001](ADR_001_file_util_storage_model.md), [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md), [FEATURE_REFERENCE.md](FEATURE_REFERENCE.md); inventories drift 0. Phase 10 (2026-11-19, `0771` applied): QA reject with photos, per-piece photos, locked pickup proof, delivery Files panels — see STATUS log. `npm run build` green 2026-11-19. Phase 9 (2026-11-19, `0770` applied): files record the order stage at upload (`stage_code`), stage filter + "stage · screen" line in the widget, Files panel on the 6 stage screens — see STATUS log. NEXT: nothing for dev — only the owner follow-ups in §5. New File Util work starts from DEVELOPER_GUIDE.md.

## 1. Where we are

| Phase | State |
|---|---|
| 1 Foundation (DB) | Done. Migration `0743_file_util_foundation.sql` applied local + remote. |
| 2 Backend | Done. `0744_file_util_cleanup_cron.sql` applied. HQ `platform-workers` purge job written; **owner must deploy platform-workers**. |
| 3 UI kit | Done. tsc/eslint clean, `npm run build` green, i18n check passes. Not yet browser-tested. |
| 4 Order photos | Code done, build green — owner browser QA pending (`QA_TEST_GUIDE.md` A + B). |
| 5 Close gaps | Code done, build green, `0750` applied (verified remote). Owner: delete `product-images` bucket in dashboard, QA §C. |
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
- [x] Phase 5 started 2026-11-17 (owner QA A + B is in §5). Was: Phase 5 (product images, tenant logo, product-images policy migration, remove MinIO/tenant-assets/upload-photo.ts).

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
- [x] 5.c (done: page shows `FileAttachments` TENANT_LOGO; PUT saves colors only, ignores `logo`; `BrandingSettingsInput.logo` removed; old routes/helpers/`uploadLogo` + its test deleted; `settings-access.ts` lists File Util deps; i18n `uploadLogo`/`noLogo` removed, `logoGuidelines` updated. FOUND and FIXED 2026-11-17 on owner request: `PATCH /api/v1/tenants/me` removed (no permission/CSRF/allowlist, no callers); route is GET-only) Branding page logo → File Util (TENANT_LOGO, entity = tenant id, source TENANT_SETTINGS); delete `settings/branding/logo` route, `tenants/me/logo` route, `tenants.service.uploadLogo` (+ its test), `lib/storage/tenant-logo.ts`; branding PUT must stop accepting `logo_url` from the client.
- [x] 5.d (done: files deleted; `npm uninstall minio -w web-admin` from repo root (24 packages left the root lockfile); MinIO service + volume removed from `docker-compose.yml`; dev scripts start/stop/status/check-prerequisites/smoke-test/reset-db cleaned and parse-checked; `.clauderc`, README, `docs/development-setup.md`, `web-admin/VERCEL_DEPLOYMENT.md` updated. Left as history: archive/plan docs, `.claude|.codex|.agents|.cursor` reference docs, generated `docs/features/Platform_Operations_Console/config_key_env_map.json`) Delete MinIO: `lib/storage/minio-client.ts`, `app/actions/orders/upload-photo.ts`, `minio` dep, docker-compose service, env docs.
- [x] 5.e Migration written: `supabase/migrations/0750_file_util_retire_product_images.sql` (bucket private, 1-byte limit, impossible MIME → Storage API refuses all writes; clears `product_image` URLs pointing into `product-images`). **Owner: apply local + remote, then delete the empty `product-images` bucket and its 4 policies in the dashboard.** Not applied by the assistant.
- [x] 5.f eslint clean (touched files), tests 81/81 (5 suites), i18n pass, tsc: 4 errors all outside this work, `npm run build` green (2026-11-17). PLAN (decision 14, 5.1–5.4 ticked), STATUS, QA guide §C written.
- Next: owner applies `0750` + deletes bucket + QA §C; then Phase 6.
- Deferred: FOR_ORDER-with-MAIN-fallback display on the New Order grid (needs `CmxFileThumb` + batch list); grid keeps using `product_image` (MAIN).

## 3c. Phase 6 progress (live) — started 2026-11-17

Findings (remote, read-only): URL columns `org_order_issues.photo_url`, `org_asm_exceptions_tr.photo_urls`, `org_asm_tasks_mst.qa_photo_url`, `org_qa_decisions_tr.qa_photo_url`, `org_orders_mst.photo_urls` are all **empty** (0 rows); `org_dlv_pod_tr` and `org_dlv_ev_uploads_tr` have 0 rows. **No customer avatar column exists** (6.3 = new `FileAttachments` on the customer screen, no column). No data to move.
Today: the issue dialog asks the user to *type* a photo URL; assembly exception/QA APIs accept URL strings (`photoUrls`, `qaPhotoUrl`). No real upload anywhere.

Design: each screen collects files, saves its record, then uploads with `uploadFilesToRecord` to `ORDER_FILE` with the sub-record ref (`ORDER_ISSUE` / `ASM_EXCEPTION` / `QA_DECISION` or `ASM_TASK`) and the matching purpose/source. URL inputs and URL API fields are removed (they accepted any outside URL). The empty URL columns are dropped by one migration at the end (STOP for owner).

Steps:
- [x] 6.1 (done: new reusable `PendingFilesPicker` in `@features/file-util`; `uploadFilesToRecord` takes `refType/refId/notes`; i18n `fileUtil.pendingHint/removePending`, `orders.issues.photos` replaces `photoUrl*`) Order issue dialog → file picker; upload after create (purpose ISSUE_EVIDENCE, ref ORDER_ISSUE, source ORDER_ISSUE); drop `photoUrl` from API/schema/service.
- [x] 6.2 (done: exception dialog → `PendingFilesPicker`, uploads after create with ref ASM_EXCEPTION, purpose ASSEMBLY_EXCEPTION, source ORDER_ASSEMBLY; modal passes `orderId`; `photoUrls`/`qaPhotoUrl` removed from routes, service, hook. QA endpoint has no screen yet, so no QA picker) Assembly exception + QA → same pattern; drop `photoUrls` / `qaPhotoUrl`.
- [x] 6.3 (done: `app/dashboard/customers/[id]/page.tsx` new tab `files` → `FileAttachments` CUSTOMER_FILE, source CUSTOMER_PROFILE, read-only without `customers:update`; i18n `customers.files`) Customer detail → `FileAttachments` CUSTOMER_FILE.
- [x] 6.4 Delivery POD onto ORDER_FILE — approved 2026-11-17, done in code (see §3d).
- [x] 6.5 Migration `0751_file_util_drop_photo_url_columns.sql` written (5 empty columns; no DB dependents; RESTRICT). **Owner: apply local + remote, then `npm run prisma:pull` + `npx prisma generate` + types BEFORE running the app** (stale Prisma client would select the dropped `org_orders_mst.photo_urls`).
- [x] 6.5b `FILE_CATEGORY_ACCESS` values are now any-of lists; ORDER_FILE write = `orders:update` or `orders:transition` (issue/exception routes use `transition`); guard tries the next code only after a 403; route tests 9 → 30/30 with service.
- [x] 6.5c Owner asked "are dropped columns really replaced?" → audit: upload path checks the ref belongs to the same order+tenant (service `assertRefOwned`). Found + fixed: `useFileAttachments` ignored `refType/refId` when listing (would show all order files); `fetchFiles` now sends them and the cache key includes them. Added per-issue **Photos** action in the issues list (dialog = `FileAttachments` filtered to the issue, add allowed with `orders:transition`). Assembly exceptions have no list screen; their photos show on the order Files tab.
- [x] 6.6 eslint clean; tests 100/100 (10 suites) + 38/38 after 6.5c; i18n pass; `npm run build` green. NOTE: `next build` here prints "Skipping validation of types", so run `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .` separately: 4 errors, all outside File Util (login, navigation route, fx profile, users membership lock). QA guide §D, STATUS, PLAN updated.
- [x] 6.7 Owner applied `0751` local + remote, regenerated types + Prisma (2026-11-17). Verified: the 5 columns are gone on remote; Prisma keeps only `org_dlv_pod_tr.photo_urls` (delivery, task 6.4).
- 2026-11-17: owner APPROVED the 6.4 sub-plan (PLAN.md §6.4). Done: see §3d.
- (was) NEXT: owner decision on 6.4 (delivery POD sub-plan in PLAN.md §6.4, incl. the driver upload-permission question). Then Phase 7 (HQ `/file-util-config`).

## 3d. Task 6.4 — Delivery POD onto File Util (approved 2026-11-17, done)

Facts (remote, read-only): `org_dlv_pod_tr`, `org_dlv_ev_uploads_tr`, bucket `delivery-pod-evidence` all empty (0 rows / 0 objects); no cron/ops job uses them; HQ code does not use them. SIGNATURE allows jpeg/png/webp; DELIVERY_PROOF also heic/heif. The evidence route already needs `delivery:pod` AND `orders:transition`, and ORDER_FILE write accepts `orders:transition` → **no new permission needed for drivers**. DB function `hq_mntnc_cleanup_tenant_orders` deletes `org_dlv_ev_uploads_tr` rows (live text at lines ~1060-1068) → must be patched like 0659 (live-definition transform, asserted).

Design (decided):
- "Consumed" = **locked file**: new `org_file_mst.locked_at` / `locked_by` (CHECK: locked only while READY). Completion locks exactly the submitted files in its transaction; locked files cannot be edited or deleted (service error `FILE_LOCKED`, gallery hides edit/delete). Generic: later QA evidence can lock the same way.
- Completion keeps its API fields `signatureEvidenceId` / `photoEvidenceIds`; they are now **File Util file ids**. Checks in the tx (FOR UPDATE): same tenant, ORDER_FILE, entity = stop's order, ref DELIVERY_STOP = this stop, READY, not locked, purpose SIGNATURE / DELIVERY_PROOF.
- POD evidence = locked files of the stop (no file columns on the POD row). Proof audit reads them via File Util (5-min signed URLs).
- Driver panel uploads with `uploadFile` (ORDER_FILE, ref DELIVERY_STOP, source ORDER_DELIVERY).
- Migration: locked columns; patch HQ cleanup (drop the receipts DELETE, add soft-delete of the orders' ORDER_FILE rows so the purge job removes bytes — also fixes orphan files after tenant order cleanup); drop `org_dlv_ev_uploads_tr`; drop `org_dlv_pod_tr.signature_url/photo_urls/signature_object_key/photo_object_keys`; lock bucket `delivery-pod-evidence` like 0750 (owner deletes it + its 4 policies after).
- Delete: evidence route, `delivery-evidence.service.ts`, `lib/constants/delivery-evidence.ts` (after audit no longer needs it).

Steps:
- [x] a. Migration written: `supabase/migrations/0758_file_util_delivery_pod_files.sql` (numbers 0752–0757 were taken by other work). Cleanup-function anchor verified on remote: found exactly once. Owner applied 0758 local + remote + types + Prisma (2026-11-17); verified remote: `locked_at/locked_by` present, `org_dlv_ev_uploads_tr` gone, 4 POD columns gone, cleanup function patched, bucket locked.
- [x] b. File Util service: lock support (`FILE_LOCKED` 409; update/delete refuse locked, also guarded in the write's WHERE; `lockedAt` in `FileView`; gallery hides edit/delete for `locked`; story; i18n `fileUtil.errors.FILE_LOCKED`). Service tests 24/24.
- [x] c. Completion service: `lockEvidenceFiles` (READY, unlocked, tenant + stop's order + DELIVERY_STOP ref, FOR UPDATE), purpose checks, `lockFilesAsProof` in the tx, gate input `signatureEvidenceId/photoEvidenceIds` = file ids; POD row no longer stores evidence. Tests 18/18 (2 new). DB-integration test seeds READY `org_file_mst` rows instead of receipts.
- [x] d. Proof audit reads the stop's **locked** SIGNATURE/DELIVERY_PROOF files via `listFiles` (one batch per order; signing outage → audit without links). `DeliveryProofEvidenceLink.source` is only `private_signed` now. Tests 5/5 (route + service, 1 new).
- [x] e. `uploadDeliveryEvidence` (delivery API client) now uploads via File Util `uploadFile` (ORDER_FILE, ref DELIVERY_STOP, source ORDER_DELIVERY) and returns the file id; panel passes `orderId`. Panel otherwise unchanged.
- [x] f. Deleted evidence route, `delivery-evidence.service.ts` + test, `lib/constants/delivery-evidence.ts`; evidence case removed from `delivery-safety.route.test.ts`; orders access contract: 2 stale `[StopId] Evidence` + 2 receipt entries replaced by File Util upload deps. Gate evaluator object-key aliases left (harmless input aliases).
- [x] g. Tests 444/444 (42 suites) + DB integration 14/14 (local DB; ran `npx prisma generate` first — client was stale); eslint clean; i18n pass; tsc: same 4 errors outside File Util; `npm run build` green. QA guide §E, STATUS, PLAN updated.
- **6.4 DONE (code).** Owner: delete bucket `delivery-pod-evidence` + its 4 `dlv_pod_evidence_*` policies in the dashboard; QA §E. NEXT: Phase 7 (HQ `/file-util-config`).

## 3e. Phase 7 — HQ `/file-util-config` (done, repo `F:\jhapp\cleanmatexsaas`)

### 7.1 Shared code-table engine (design decided 2026-11-17)

Today the engine lives inside Products & Items Config (PIC): API `platform-api/src/modules/products-items-config/code-tables/` (registry, validation, repository, service, controller) and web `platform-web/src/features/products-items-config/` (`pic-code-list-screen`, `pic-code-entry-screen`, `pic-field-control`, `pic-week-hours-control`, `pic-model`, hooks) with all strings in the `productsItemsConfig` i18n namespace.

Target (behavior of `/products-items-config` unchanged):
- **API** `platform-api/src/common/code-tables/`: `code-table.types.ts` (CodeTableDef etc., `key: string`), `code-table.validation.ts` (moved as-is), `code-table.repository.ts` (generic; refs resolved by the engine into `{table,value,label,label2}`), `code-table-engine.ts` (abstract service: registry/list/get/create/update/deactivate/options/overview + audit; config = registry lookup, audit action prefix, source module, label). PIC keeps its registry, `CodeTablesService extends CodeTableEngine` (+ `confirmPublicHolidays`), `CodeTablesRepository extends CodeTableRepository` (+ `confirmEstimated`), its controller and permissions. File Util adds its own registry + service + controller + permissions the same way.
- **Web** `platform-web/src/features/code-tables/`: types, pure model helpers (paths take the module's base path), `CodeTableModule` config (API base, base path, query-key root, i18n namespace for `entities.*` / `fields.*` / `options.*`, view/manage permission codes, back link), hooks, and the generic list/entry/field/week-hours screens. Generic strings move to a new `codeTables` namespace (EN/AR). PIC public-holiday "confirm year" becomes a list toolbar slot passed by PIC.
- Steps: [x] API move + PIC rewired, PIC tests green (2026-11-18: tsc clean, PIC 6/6 suites, 74 tests; files in HQ `platform-api/src/common/code-tables/`) · [x] web move + PIC rewired (2026-11-18): `lib/api/code-tables.ts` (types + `createCodeTableApi(base)`), `src/features/code-tables/` (model `CodeTableModule` + helpers, hooks `useCodeTable*`, screens `CodeTableListScreen` (prop `toolbarExtra(filters)`) / `CodeTableEntryScreen` / field + week-hours controls), i18n `codeTables` (EN/AR; generic texts, `{permission}` in no-access/read-only). PIC keeps thin wrappers (`pic-code-list-screen` adds the holidays confirm slot) and `PIC_CODE_TABLES` in `pic-model.ts`. PIC web tests 15/15, tsc clean except pre-existing `ops-jobs-screen.test.tsx`, eslint clean on changed files (332 pre-existing errors elsewhere), build compiles; type-check step fails only on that ops-jobs test. File Util will add `FILE_UTIL_CODE_TABLES` the same way · [x] 7.2 permissions migration `0762_hq_file_util_config_perms.sql` — applied by owner 2026-11-19 · [x] navigation (from 7.6, done early): `0763_hq_nav_file_util_config.sql` written — **WAITING for owner to apply**; sidebar fallback, breadcrumbs map, `layout.json` `sidebar.routes.fileUtil*`, hub `app/file-util-config/page.tsx` + `messages/{en,ar}/fileUtilConfig.json` (namespace also hosts the code-table module texts: `hub.title` exists; add `entities.*`, `fields.*`, `options.*` in 7.3).
- [x] 7.3 + 7.4 DONE 2026-11-19 — API `modules/file-util-config/` (`file-util-config.{permissions,registry,repository,service,controller,module}.ts`, spec `__tests__/file-util-config.service.spec.ts`), registered in `app.module.ts`; web `lib/api/file-util-config.ts`, `src/features/file-util-config/{model,ui}`, `app/file-util-config/{layout,page}.tsx` + `[entity]/{page,new/page,[...key]/page}.tsx`; shared entry screen got `extraSection(row, canManage)` (used for purpose file types). Protected codes: buckets TENANT_FILES/TENANT_PUBLIC and the 4 categories via `protectedCodes`; app purposes (mirror of cleanmatex `FILE_PURPOSES`) refused in `assertCanSwitchOff` — keep both lists in sync when the tenant app adds a code. Known v1 limits: sizes entered in bytes; purpose list does not show the platform-owned badge for app purposes (server refuses).
- [x] 7.5 code DONE 2026-11-19 — migration `0766_hq_file_util_usage_health.sql` (`fn_hq_file_storage_usage(p_search,p_limit,p_offset)`, `fn_hq_file_storage_by_category(p_tenant_org_id)`, `fn_hq_file_health(p_stuck_hours)`; SECURITY DEFINER, service_role only; bodies tested as plain SELECTs on remote). API: repository `storageUsage/storageByCategory/health` (rpc), service clamps paging (1–200), UUID check, stuck hours 1–720; controller `GET storage-usage`, `storage-usage/:tenantOrgId`, `health`. Web: `lib/api/file-util-config.ts` (types + calls), `ui/storage-usage-screen.tsx` (FinCatalogListShell, search + paging, drawer per category), `ui/file-health-screen.tsx` (problems summary, KPIs, jobs, buckets), model `formatBytes` / `usedPercent`, i18n `fileUtilConfig.storageUsage.*` / `health.*`.
- [x] 7.5b DONE 2026-11-19 (see STATUS log; nav `0767` waiting for owner). Tenant `effectiveMaxSize()` exported from `file-util.service.ts`; HQ service `assertBlockedTypeInactive`; web `[...key]` page decodes keys (file type keys hold `/`). New HQ file types are offered to tenants only when `file-sniff.ts` `canVerifyMime` knows them — adding a type in HQ alone does not open uploads. Original brief: (1) cleanmatex `web-admin/lib/services/file-util/file-util.service.ts` `resolveRules`: select `sys_file_mime_types_cd.max_size_bytes` + its kind's `sys_file_media_kind_cd.max_size_bytes`; `maxSizeBytes = min(purpose ?? category, type ?? kind)`; `getCategoryConfig`: per type `maxSizeBytes` = min(context, type ?? kind) and purpose `maxSizeBytes` = largest of its types (upper bound for the drop zone; server checks exactly) + unit test. (2) HQ registry: add `media-kinds` (`sys_file_media_kind_cd`, key `kind_code`, `max_size_bytes` required 1..1 GB, names, rec_order, active) and `mime-types` (`sys_file_mime_types_cd`, key `mime_type` text createOnly, `kind_code` ref media-kinds, `preview_code` ref `sys_file_preview_mode_cd`, `extensions` textList, `is_allowed` createOnly, `max_size_bytes` optional); hub cards + nav rows (new migration via `manage-hq-navigation`) + i18n; never-allow CHECK in DB stays the guard.
- [x] 7.6 / 7.7 DONE 2026-11-19: permission-gate + kinds/types tests in HQ `file-util-config.service.spec.ts` (22), web model test (7); `hq-navigation/STATUS.md`; QA §F-ter.
- Earlier 7.5 notes: `/file-util-config/storage-usage` (per organization used vs plan `tenant_max_storage_mb`, by category, sort most used, paginated; `org_file_mst` filtered by `tenant_org_id` per org) and `/file-util-config/health` (PENDING older than N min, DELETED not purged, bucket rows whose storage bucket is missing, last purge run). Read-only APIs on `FileUtilConfigController`, `file_util.view`.
- 7.3 data model (read 2026-11-19): `sys_file_bucket_cd` (key `bucket_code`, `storage_bucket_id` unique `^[a-z0-9][a-z0-9-]{2,62}$`, `scope_code` FK `sys_file_owner_scope_cd`, `is_public`), `sys_file_category_cd` (key `category_code`, `bucket_code` FK, `max_size_bytes` > 0, `max_files_per_entity`, `image_max_dimension` 64–8192), `sys_file_purpose_cd` (key `category_code`+`purpose_code`, `max_files`, `max_size_bytes`, `is_default` unique per category `uq_sfp_default`), allowed types per purpose in `sys_file_purpose_mime_dtl` (key category+purpose+mime; FK to `sys_file_mime_types_cd(mime_type,is_allowed)`, never-allow CHECK for svg/html/xml/js). All codes `^[A-Z][A-Z0-9_]{1,49}$`. Display order = `rec_order`.

### 7.3+ notes (decided 2026-11-19)
- Route / slug `/file-util-config` (owner; replaces `/file-util-config`). HQ rule 17: one slug for route, `platform-web/src/features/file-util-config/`, `platform-api/src/modules/file-util-config/`, camelCase message file `fileUtilConfig`.
- Permissions `file_util.view` / `file_util.manage` (0762).
- Web module config `FILE_UTIL_CODE_TABLES: CodeTableModule` like `PIC_CODE_TABLES` in `pic-model.ts`; API `FileUtilConfigService extends CodeTableEngine` like PIC `CodeTablesService`.
- Navigation: load HQ skill `.claude/skills/manage-hq-navigation/SKILL.md` (cleanmatexsaas) — `hq_navigation_cd` rows in a new cleanmatex migration + `layout.json` keys + `FALLBACK_SECTIONS` in `cmx-sidebar.tsx` + hub page (`CmxHubScreen`) + `docs/features/hq-navigation/STATUS.md`. Add rows only once pages exist.

## 3. Next steps

No code work open: all 10 phases are done in code (2026-11-19). Only the owner follow-ups in §5 remain. The old Phase 4 step list was removed; its steps are done (see PLAN.md Phase 4 and STATUS log).

## 4. Rules that matter here

- Read CLAUDE.md (repo root). Load skills before writing: `/frontend`, `/i18n`, `/storybook`, `/backend`, `/database`, `/multitenancy`.
- Never apply migrations; write SQL then stop for the owner. Migration number = last in `supabase/migrations/` + 1 at write time.
- Every `org_*` query filters `tenant_org_id` explicitly.
- Cmx components only; feedback via `cmxMessage`; EN + AR + RTL.
- After every step: update PLAN.md checkboxes, STATUS.md log, and this file.

## 5. Owner follow-ups open (the plan closes when these are done)

- Deploy HQ `platform-workers`; Job Manager `/ops/jobs` then shows the purge job "In sync".
- Supabase dashboard: delete the empty, locked buckets `product-images` and `delivery-pod-evidence` with their 4 policies each (a migration cannot drop `storage.objects` policies).
- Browser QA in `QA_TEST_GUIDE.md`: A–E (tenant), F incl. F18–F29 (HQ File Setup), H (purge schedule; needs the worker deployed), I (stage of each file, stage screens), J (QA reject, piece photos, pickup proof, delivery).
- Data gap: only 2 of 4 organizations have a subscription → others get `PLAN_UNAVAILABLE` on upload (fix the data, not the code).
- Commit both repos (`cleanmatex`, `cleanmatexsaas`).
