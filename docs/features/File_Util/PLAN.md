# File Util — Plan

**Status:** APPROVED 2026-11-16 — Phases 1–3 done, Phase 4 next (see [STATUS.md](STATUS.md)).
**Date:** 2026-11-16
**Scope:** one shared, domain-agnostic module to upload, store, list, view and delete files (images, PDF, documents) for any feature. Built in `cleanmatex` (`web-admin`); catalog management in HQ (`cleanmatexsaas`).

**Progress rule:** after every task below, tick its checkbox here and update `STATUS.md` in this folder before starting the next task. Each phase ends with an explicit status task; a phase is not done until that task is ticked.

## 0. Progress

| # | Phase | Status |
|---|---|---|
| 1 | Foundation (migration) | Done 2026-11-17 (`0743` applied) |
| 2 | Backend | Done 2026-11-17 (`0744` applied) |
| 3 | UI kit | Done 2026-11-17 (build green; browser QA in Phase 4) |
| 4 | First consumer: order photos | Code done 2026-11-17; owner browser QA pending |
| 5 | Close existing gaps | Code done 2026-11-17; owner: apply `0750`, delete `product-images` bucket, browser QA (guide C) |
| 6 | Remaining photo columns | Done 2026-11-17 (`0751`, `0758` applied); owner QA pending |
| 7 | HQ File Util workspace `/file-util-config` | Not started |
| 8 | Docs and close-out | Not started |

## 1. Current state (repo scan, 2026-11-16)

There is no shared file feature. Each feature has its own helper.

| Area | Today | Problem |
|---|---|---|
| Storage backends | Supabase Storage **and** MinIO | Two systems for one job |
| MinIO bucket (`lib/storage/minio-client.ts`) | Anonymous read policy; holds logo and order photos | World-readable tenant data, guessable URLs |
| `product-images` bucket (mig `0116`) | Public; write/delete policy checks only `bucket_id` | Any signed-in user can overwrite or delete another tenant's images |
| `tenant-assets` bucket | Used by `tenants.service.ts` `uploadLogo` | No migration creates it; route has no permission or CSRF check; accepts SVG |
| `api/v1/products/[id]/image` | `getAuthContext()` only | No permission check, no CSRF, trusts client MIME type |
| `actions/orders/upload-photo.ts` | No callers | Dead code, no permission or tenant check |
| Order photos | `PhotoCaptureModal` captures, then discards the photo | Feature not finished |
| File columns | Bare URL columns (`photo_urls`, `qa_photo_url`, `logo_url`, ...) | No metadata; cannot move to private storage |
| Storage quota | `tenant_max_storage_mb` flag, `org_usage_tracking.storage_mb` | `usage-tracking.service.ts` hard-codes `storageMb = 0` |
| Shared UI | Nothing in `src/ui/` for upload, gallery or viewer | — |

**Good pattern already in the repo:** delivery proof-of-delivery evidence (migs `0451`, `0452`, `delivery-evidence.service.ts`). Private bucket, tenant id as first path segment enforced by storage policy, server-made object key, magic-byte check, sha256, 5-minute signed URLs never stored in the DB, route guarded by CSRF + permission + tenant rate limit. This plan generalizes that pattern.

## 2. Decisions

1. **One backend: Supabase Storage.** MinIO is retired (client, `minio` dependency, docker-compose service).
2. **Object keys in the DB, never URLs.** URLs are signed on demand.
3. **Direct-to-storage upload** through a signed upload URL. File bytes do not pass through the Next.js server.
4. **A file belongs to one entity.** No many-to-many link table until a real case needs it.
5. **Authorization comes from the owning domain.** Each category maps to that domain's existing read/write permission. No new permission codes. Each is an "any of" list (2026-11-17): `ORDER_FILE` write = `orders:update` **or** `orders:transition`, so floor staff who report issues and assembly exceptions can attach photos. The order detail Files tab still shows edit controls only with `orders:update`.
6. **Thumbnails are made in the browser** and stored as a second object. No dependency on Supabase image transforms or a paid plan.
7. **No new npm dependencies.** Drag-and-drop, canvas downscale and the native PDF viewer are browser features.
8. **Delivery POD keeps its own flow for now** (receipt/consume rules, `delivery-pod-evidence` bucket). `ORDER_FILE` already has `DELIVERY_PROOF` and `SIGNATURE` purposes; moving POD onto File Util is task 6.4 (owner, 2026-11-16).
9. **Module name: File Util** (owner, 2026-11-16). DB objects use the `file` marker (`sys_file_*`, `org_file_*`). Everything else uses `file-util`: `src/features/file-util/`, `lib/services/file-util/`, `/api/v1/file-util/`. This folder is renamed `docs/features/File_Util/` at implementation start.
10. **Bucket is data, not code** (owner, 2026-11-16). `sys_file_bucket_cd` lists the buckets; each category points to one. The service takes the bucket from the category, so no code path is tied to one bucket.
12. **Owner scope picks the metadata table; categories do not** (2026-11-16). TENANT buckets → `org_file_mst`, HQ buckets → `hq_file_mst` (same shape, no `tenant_org_id`), behind one store interface in code. No per-category table name in data (SQL built from data, no tenant guarantee, no Prisma typing, duplicated cleanup and quota logic). A domain table that needs a direct link adds an FK to the file, e.g. `org_product_data_mst.image_file_id` → `org_file_mst (tenant_org_id, id)` via `uq_ofm_tenant_id`; it never copies file metadata.
13. **Cleanup is split by what each side can do** (2026-11-17, owner). DB: pg_cron job `file-util-expire` runs `fn_file_util_expire_pending()` hourly (:17) — PENDING uploads older than 24 h → DELETED (`0744`, registered in `sys_ops_job_cf`). HQ `platform-workers` (cleanmatexsaas): BullMQ job `file-util-purge`, self-scheduled hourly (:47) — deletes stored bytes of DELETED rows via the Storage API, then sets `purged_at`. Cross-tenant maintenance belongs to HQ (integration-contracts §1); no inbound cleanup endpoint in the tenant app. **Update 2026-11-19 (7.9):** `file-util-purge` is now an `HQ_WORKER` job in the job registry (`0768`): default weekly (Sunday 03:47 UTC), schedule / on-off / Run now in HQ Job Manager `/ops/jobs`; a run repeats batches until the backlog is empty. A SQL-only purge is impossible: bytes live in the S3 object store outside Postgres and `storage.protect_delete` blocks direct deletes.
14. **Published URL columns stay, as a projection** (2026-11-17). `org_product_data_mst.product_image` and `org_tenants_mst.logo_url` hold the public URL of the record's PRODUCT_IMAGE/MAIN and TENANT_LOGO/MAIN file. The File Util service rewrites them in the same transaction as every change to that slot (complete, purpose change, delete); nothing else writes them (branding PUT ignores `logo`). The file row is the truth. About 20 readers (receipts, mobile app, public booking, HQ) keep working unchanged, and public-bucket URLs never change. An exception to decision 2, limited to public buckets; a private bucket clears the column instead.
11. **HQ files are a later step.** They need their own table (`hq_file_mst`, no `tenant_org_id`) and a different storage policy, because the tenant-folder rule does not apply to HQ buckets. HQ buckets (`hq-files`, `hq-crm-files`, ...) are added as rows in `sys_file_bucket_cd` then. Not built in this plan.

## 3. Database (one migration; number = last + 1 at write time)

| Object | Purpose |
|---|---|
| Lookups (FK targets, fully seeded; owner 2026-11-16: lookups + FK instead of value-list CHECKs) | `sys_file_owner_scope_cd` (TENANT, HQ) · `sys_file_media_kind_cd` (IMAGE, PDF, DOCUMENT, SPREADSHEET, PRESENTATION, TEXT, ARCHIVE, AUDIO, VIDEO, WEB, EXECUTABLE, OTHER) · `sys_file_preview_mode_cd` (IMAGE, PDF, AUDIO, VIDEO, DOWNLOAD) · `sys_file_status_cd` (PENDING, READY, DELETED — fixed system codes) · `sys_file_source_cd` (16 upload screens/channels: ORDER_NEW, ORDER_EDIT, ORDER_DETAIL, ORDER_PREPARATION, ORDER_PROCESSING, ORDER_ASSEMBLY, ORDER_QA, ORDER_READY, ORDER_DELIVERY, ORDER_ISSUE, CUSTOMER_PROFILE, PRODUCT_SETUP, TENANT_SETTINGS, MOBILE_APP, API, SYSTEM) · `sys_file_ref_type_cd` (ORDER_ITEM, ORDER_PIECE, ORDER_ISSUE, DELIVERY_STOP, QA_DECISION, ASM_TASK, ASM_EXCEPTION, with `table_name`). |
| `sys_file_mime_types_cd` | File types: `kind_code`, `preview_code`, `extensions`, `is_allowed` (security verdict), `is_active` (enabled now). Seed: 14 active (owner list: jpeg, png, webp, gif, heic, heif, pdf, docx, xlsx, pptx, txt, csv, mp4, webm), 20 safe-but-inactive (HQ can enable), 18 denied. The only value CHECK kept is the security floor `ck_sfmt_never_allow` (no data edit may weaken it). |
| `sys_file_bucket_cd` | `bucket_code` (stable code) + `storage_bucket_id` (real `storage.buckets.id`, no FK — Supabase owns the storage schema) + `scope_code` (FK) + `is_public`. Seeded `TENANT_FILES` → `tenants-cmx-files` (private, 50 MB ceiling), `TENANT_PUBLIC` → `tenants-cmx-public` (public, 5 MB). |
| `sys_file_category_cd` | One row per kind of owning record: `ORDER_FILE`, `CUSTOMER_FILE`, `PRODUCT_IMAGE`, `TENANT_LOGO`. Bucket, default `max_size_bytes`, `max_files_per_entity`, `image_max_dimension`. |
| `sys_file_purpose_cd` | What a file is for, picked by the user at upload: `max_files` (1 = single slot), optional `max_size_bytes` override, one `is_default` per category. `ORDER_FILE`: BEFORE_IMAGE (default), AFTER_IMAGE, DAMAGE, STAIN, ISSUE_EVIDENCE, QA_EVIDENCE, ASSEMBLY_EXCEPTION, DELIVERY_PROOF, SIGNATURE, ITEM_VIDEO (50 MB, max 5), CUSTOMER_DOCUMENT, OTHER. `CUSTOMER_FILE`: PHOTO, ID_DOCUMENT, OTHER. `PRODUCT_IMAGE`: MAIN, FOR_ORDER, BACKSIDE, GALLERY. `TENANT_LOGO`: MAIN, RECEIPT. |
| `sys_file_purpose_mime_dtl` | Allowed types per purpose (signature: images only; documents: PDF/Office/text/images). FK `(mime_type, is_allowed)`: denied types cannot be linked; a used type cannot be denied. |
| `org_file_mst` | One row per file: `tenant_org_id`, `category_code` + `purpose_code` (FK), `entity_id` (owning record), `ref_type_code` + `ref_id` (sub-record: piece, issue, delivery stop, ...), `source_code` (upload screen), `notes` (user note), `bucket_code`, `object_key`, `thumb_object_key`, `original_name`, `mime_type` (FK), `size_bytes`, `thumb_size_bytes`, `sha256_hex`, `width`, `height`, `duration_ms`, `status_code` (FK), `ready_at`, `purged_at`, `sort_order`, full audit columns. |
| Storage buckets | Key `{tenant_org_id}/{CATEGORY_CODE}/{entity_id}/{file_id}.{ext}`, thumbnail `{file_id}_thumb.webp` alongside (CHECK enforces the prefix). Bucket size/type lists = second gate (union of purpose rules). |
| Storage policies | None for browser sessions (security review 2026-11-16). Only the server touches objects. |
| RLS | `org_file_mst`: tenant read-only, writes revoked from `authenticated`/`anon`. `sys_file_*`: read for signed-in users, no tenant write. |
| Indexes | Entity list `(tenant, category, entity, purpose, sort_order)`, sub-record `(tenant, ref_type, ref_id)`, quota (index-only), pending cleanup, purge cleanup — all partial. |

The user's file name is stored for display only and is never part of the key. Every object and column is commented in the migration (`COMMENT ON`).

## 4. Backend (`web-admin`)

Service: `lib/services/file-util/file-util.service.ts`. Constants: `lib/constants/file-categories.ts` (codes mirror the DB; maps each category to its read/write permission and an entity-ownership check).

| Route | Does |
|---|---|
| `POST /api/v1/file-util` | Init. Checks category rules, entity ownership, quota. Inserts `PENDING` row. Returns signed upload URLs (file + thumbnail). |
| `POST /api/v1/file-util/[id]/complete` | Confirms the object exists, real size, magic bytes against declared type, sha256. Sets `READY`. Idempotent. |
| `GET /api/v1/file-util?category=&entityIds=&purposes=` | Files of one or many records (batch, so a list screen makes one call, not one per row), optionally only some purposes. With `fallback=true`, an empty single slot returns the category default purpose's file (e.g. `FOR_ORDER` → `MAIN`). |
| `POST /api/v1/file-util/sign` | Batch: many file ids to signed URLs in one call. |
| `PATCH /api/v1/file-util/[id]` | Caption, sort order. |
| `DELETE /api/v1/file-util/[id]` | Soft delete (`DELETED`); object purged by the cleanup job. |

Every route: `validateCSRF` → `requirePermission` (code from the category) → `checkAPIRateLimitTenant` → zod validation. Every query carries an explicit `tenant_org_id`. The tenant segment of the key comes from the session.

- **Security:** MIME allowlist per category; SVG and HTML rejected; non-image/PDF files served as download; signed URL lifetime 5 minutes.
- **Quota:** used bytes = `SUM(size_bytes)` of `READY` rows for the tenant, checked at init against `tenant_max_storage_mb`. `usage-tracking.service.ts` reports the same number instead of 0.
- **Cleanup job:** removes `PENDING` rows older than 24 hours and the objects of `DELETED` rows. Uses the scheduler the repo already has (confirmed in Phase 2).

## 5. Frontend (`web-admin/src/ui/`, EN/AR + RTL)

| Component | Role |
|---|---|
| `CmxFileDropZone` | Drag-and-drop, click, paste; multi-file; per-file progress, cancel, retry; validation before upload; image downscale and thumbnail before upload. |
| `CmxCameraCaptureDialog` | Camera capture. Promoted from the orders `PhotoCaptureModal`. |
| `CmxFileGallery` | Thumbnail grid or list, lazy-loaded, reorder, caption, delete with confirm. |
| `CmxFileViewerDialog` | Images with zoom and keyboard navigation; PDF in the browser viewer; download for other types. |
| `FileAttachments` (feature widget, `@features/file-util`) | One-line integration: `<FileAttachments source="ORDER_DETAIL" category="PRODUCT_IMAGE" entityId={id} purposes={['FOR_ORDER', 'BACKSIDE']} readOnly={...} />`. No `purposes` = all, grouped by purpose in `rec_order`; upload picks the purpose (default preselected). |
| `CmxFileThumb` | One image for list rows (`category`, `entityId`, `purpose`, fallback to default); fed by one batch call per list. |

Hooks `use-files`, `use-file-upload` (TanStack Query) and the API client live in `src/features/file-util/`. Feedback through `cmxMessage`. Loading, empty and error states on every component. Keyboard and screen-reader support. Stories for each component. `.clauderc` import snippets updated.

## 6. Performance

- Direct upload, at most three in parallel.
- Images downscaled in the browser before upload.
- One batch-sign call per list; signed URLs cached for less than their lifetime.
- Stored thumbnails for grids; full image loaded only in the viewer.
- Keys never change, so long cache headers are safe.

## 7. Phases and tasks

Every phase also ends with: eslint, typecheck, targeted tests, and `npm run build` when frontend changed.

### Phase 1 — Foundation

- [x] 1.1 Rename this folder to `docs/features/File_Util/`; create `STATUS.md`.
- [x] 1.2 Read-only checks on the remote DB: bucket names free, `tenant-assets` exists or not, current storage policies.
- [x] 1.3 Write the migration (tables, buckets, policies, RLS, seed buckets and categories, full comments) — `0743_file_util_foundation.sql`.
- [x] 1.4 Update `STATUS.md` and the progress table. **Stop for the owner to apply the migration.**
- [x] 1.5 Owner applied `0743` (local + remote), types regenerated (both repos), Prisma pulled (2026-11-17).

### Phase 2 — Backend

- [x] 2.1 Constants (`lib/constants/file-util.ts`: codes mirroring the DB, category → read/write permission, TTLs).
- [x] 2.2 Service `lib/services/file-util/file-util.service.ts` (init, complete, list, sign, update, delete, config) + content checks `file-sniff.ts`.
- [x] 2.3 Routes under `/api/v1/file-util` (list/init, `[id]` PATCH/DELETE, `[id]/complete`, `sign`, `config`), shared guard in `file-util-http.ts`.
- [x] 2.4 `canStoreBytes` + `getTenantStorageBytes` in `usage-tracking.service.ts`; `storageMb` now real.
- [x] 2.5 Cleanup: `0744_file_util_cleanup_cron.sql` (DB expiry job `file-util-expire`, registered in `sys_ops_job_cf`) + HQ `platform-workers/src/file-util/purge.processor.ts` (hourly byte purge). **Stop for owner to apply `0744` and deploy platform-workers.**
- [x] 2.6 Tests: 47 passing in cleanmatex (`file-sniff`, `file-util.service`, `file-util.route`) + 4 in HQ `purge.processor.spec.ts`.
- [x] 2.7 Inventories rebuilt + check green. Known gap: routes pick the permission per category at runtime, so the scanner (literal codes only) does not list them.
- [x] 2.8 Update `STATUS.md` and the progress table.

### Phase 3 — UI kit

- [x] 3.1 API client `api/file-util-api.ts` (fetch + XHR PUT with progress) and hook `hooks/use-file-attachments.ts` (TanStack Query, upload queue, ≤3 parallel, cancel/retry) in `src/features/file-util/`.
- [x] 3.2 `CmxFileDropZone` (`src/ui/forms`; drag/drop, click, keyboard, paste, type/size pre-check) + browser downscale and WebP thumbnail `model/prepare-image.ts`.
- [x] 3.3 `CmxCameraCaptureDialog` (`src/ui/overlays`; promoted from orders `PhotoCaptureModal`; switching the orders caller is task 4.1).
- [x] 3.4 `CmxFileGallery` (`src/ui/data-display`) and `CmxFileViewerDialog` (`src/ui/overlays`; image zoom, PDF, audio, video, download; RTL-mirrored arrows).
- [x] 3.5 Connected widget `FileAttachments` in `src/features/file-util/ui/` (data-fetching UI stays out of `src/ui`): purpose picker, note, drop/camera, queue, gallery, viewer, edit, delete.
- [x] 3.6 i18n `common.files.*` + new `fileUtil.json` (EN/AR, check passes); 4 stories with RTL; `.clauderc` snippets; barrel exports.
- [x] 3.7 Update `STATUS.md` and the progress table.

### Phase 4 — First consumer: order photos

- [x] 4.1 New order: **Photo** button with pending count; photos kept in state (`pendingPhotos`) and uploaded with `uploadFilesToRecord()` right after save (`ORDER_FILE`/`BEFORE_IMAGE`, source `ORDER_NEW`/`ORDER_EDIT`). Old `PhotoCaptureModal` deleted.
- [x] 4.2 Order detail: new **Files** tab with `FileAttachments` (read-only without `orders:update`).
- [x] 4.3 QA guide `QA_TEST_GUIDE.md` (sections A order detail, B new order).
- [ ] 4.4 Update `STATUS.md` and the progress table.

### Phase 5 — Close existing gaps

- [x] 5.1 Product images moved to the module (product form edit mode → `FileAttachments`; `api/v1/products/[id]/image` and `lib/storage/product-images.ts` deleted).
- [x] 5.2 Tenant logo moved to the module (Branding page → `FileAttachments`; both old logo routes, `uploadLogo`, `tenant-logo.ts` deleted; PUT saves colors only).
- [x] 5.3 Migration `0750_file_util_retire_product_images.sql` written (policies cannot be dropped by a migration: `postgres` does not own `storage.objects`; the bucket is locked instead and its URLs cleared). **Owner applies, then deletes the bucket in the dashboard.**
- [x] 5.4 Remove MinIO (client, dependency, docker-compose), `upload-photo.ts`, `tenant-logo.ts`, `tenant-assets` code; old routes removed.
- [ ] 5.5 Update `STATUS.md`, the QA guide and the progress table.

### Phase 6 — Remaining photo columns

- [x] 6.1 Order-issue photos (issue dialog picks files with `PendingFilesPicker`, uploads after create: ISSUE_EVIDENCE, ref ORDER_ISSUE).
- [x] 6.2 Assembly exception and QA photos (exception dialog: ASSEMBLY_EXCEPTION, ref ASM_EXCEPTION; QA endpoint has no screen yet, its URL field removed).
- [x] 6.3 Customer files (no avatar column exists): customer detail **Files** tab, `CUSTOMER_FILE`.
- [x] 6.4 Delivery POD photos and signature onto `ORDER_FILE` (`DELIVERY_PROOF`, `SIGNATURE`, ref `DELIVERY_STOP`), keeping its receipt/consume rules; retire the `delivery-pod-evidence` bucket after data move.
- [x] 6.5 Migration `0751_file_util_drop_photo_url_columns.sql`: drops the 5 empty URL columns. **Stop for the owner.**
- [x] 6.6 Update `STATUS.md`, the QA guide and the progress table.

#### 6.4 sub-plan — Delivery POD onto File Util (approved 2026-11-17; migration `0758`)

Today (migs 0451/0452, `delivery-evidence.service.ts`, `delivery-completion.service.ts`): the driver uploads each photo/signature through `POST /api/v1/delivery/stops/[stopId]/evidence` (server receives bytes, checks type, sha256, writes to private bucket `delivery-pod-evidence`, inserts an `org_dlv_ev_uploads_tr` receipt that expires). Completion takes receipt ids, checks they belong to the stop and are unexpired/unconsumed, writes `org_dlv_pod_tr.photo_object_keys` / `signature_object_key`, and marks the receipts consumed in the same transaction. Workflow gates, the proof audit and pickup completion read those keys. All tables have 0 rows.

Target:
1. Upload: driver screens use File Util (`ORDER_FILE`, purposes `DELIVERY_PROOF` / `SIGNATURE`, ref `DELIVERY_STOP` = stop id, source `ORDER_DELIVERY`), direct-to-storage with content check. Upload permission must fit drivers (today `orders:update`; drivers may only hold delivery permissions) → per-category-purpose write permission or a delivery category. **Decision needed.**
2. Completion takes file ids instead of receipt ids and checks, in its transaction: READY, same tenant, entity = the stop's order, ref = this stop, purpose matches, not already bound to a POD. "Consumed" = bound: new `org_dlv_pod_tr.signature_file_id` + a `org_dlv_pod_files_dtl` link (composite FKs to `org_file_mst (tenant_org_id, id)`), which also stops a file being deleted while bound (delete refuses bound files).
3. Gates, proof audit, pickup completion read the bound files instead of object keys.
4. Migration: new link columns/table; drop `photo_urls`, `photo_object_keys`, `signature_url`, `signature_object_key`, `org_dlv_ev_uploads_tr`; owner deletes the `delivery-pod-evidence` bucket. Evidence route + service removed.
5. Tests for every completion check (wrong stop, wrong order, other tenant, unready, reused file).

### Phase 7 — HQ File Util workspace (`cleanmatexsaas`, route `/file-util-config`)

One HQ section where platform staff manage files setup and watch storage, without migrations. Built on the existing code-table engine of `products-items-config` (registry-driven list/edit screens, composite keys, `ref` and `textList` fields).

| Screen | Does |
|---|---|
| Buckets | List/edit `sys_file_bucket_cd`. Create = HQ API creates the storage bucket (service role) then inserts the row, so code and storage never drift. Deactivate only; no delete while files use it. |
| Categories | List/edit `sys_file_category_cd`: bucket, allowed MIME types (allowlist, SVG/HTML refused), max size, total files per record, image downscale size, EN/AR names, active. |
| Purposes | Per category, list/edit `sys_file_purpose_cd`: per-slot limit, default (one per category), display order, EN/AR names, active. |
| Storage usage | Per organization: used vs `tenant_max_storage_mb`, by category; sort by most used; drill into one organization. |
| Health | Files stuck `PENDING`, deleted-not-purged count, bucket rows whose storage bucket is missing, last cleanup run. |

Rules: changes to rules apply to new uploads only (existing files untouched); every write audited; codes are create-only.

- [x] 7.1 Move the code-table engine out of `products-items-config` into a shared module (behavior unchanged; existing tests stay green), so File Util registers its own tables instead of copying the engine. Done 2026-11-18: API `platform-api/src/common/code-tables/`, web `lib/api/code-tables.ts` + `src/features/code-tables/`, strings in `codeTables` i18n namespace.
- [x] 7.2 HQ permissions for view/manage (format of existing HQ permissions); migration written in `cleanmatex`. **Stop for owner to apply.** Written 2026-11-19: `0762_hq_file_util_config_perms.sql` (`file_util.view`, `file_util.manage`, `file_util.*` → TECH_ADMIN). Route renamed to `/file-util-config` (owner, 2026-11-19).
- [x] 7.3 Registry entries + Buckets, Categories, Purposes screens (EN/AR, RTL). Done 2026-11-19: API `platform-api/src/modules/file-util-config/` (registry, service on `CodeTableEngine`, purpose allowed file types `GET/PUT purposes/:category/:purpose/mime-types`, app-used codes cannot be switched off), web `src/features/file-util-config/` + routes `app/file-util-config/[entity]/…`.
- [x] 7.4 Bucket create flow (storage bucket + row) with rollback if either step fails. Done 2026-11-19: storage bucket first; removed again if the row fails (only when this request created it); bucket with active categories cannot be switched off.
- [x] 7.5 Storage usage and Health screens (read-only APIs, paginated). Code done 2026-11-19; needs migration `0766_hq_file_util_usage_health.sql` (3 read-only service_role functions) applied.
- [x] 7.5b File size per media kind / file type (owner decision 2026-11-19): `0765_file_util_type_size_limits.sql` applied by owner 2026-11-19. Done 2026-11-19: tenant `file-util.service.ts` `effectiveMaxSize` = min(purpose ?? category, type ?? kind) in `resolveRules` and per type in `getCategoryConfig` (purpose size = largest of its types, for the drop zone); an inactive media kind stops its types. HQ registry `media-kinds` + `mime-types` screens (blocked type must stay inactive; never-allow CHECK stays the guard); nav rows in `0767_hq_nav_file_util_kinds_types.sql` (**owner applies**).
- [x] 7.6 HQ navigation entry; HQ docs; tests (validation, permissions, one-default-purpose rule). Navigation 2026-11-19: `0763` (applied) + `0767` (7.5b rows) + sidebar fallback + breadcrumbs + `layout.json` + hub page. Tests 2026-11-19: API File Setup spec 22 (registry limits incl. kinds/types, permission gates view/manage on every write, one default purpose, protected codes, bucket rollback, blocked type), web model 7. HQ docs: `cleanmatexsaas/docs/features/hq-navigation/STATUS.md`; the feature docs stay in this folder.
- [x] 7.7 Update `STATUS.md`, the QA guide and the progress table. Done 2026-11-19 (QA §F-ter F18–F26).
- [x] 7.8 Owner feedback 2026-11-19: (a) size limits apply to new uploads only — confirmed in code (checked only in `initFileUpload`; moving a saved file to another purpose checks type and room, never size) + test; (b) HQ number fields get well-known pick lists (`presets` + `unit: 'bytes'` in the shared code-table engine): sizes 512 KB … 1 GB, file counts 1 … 100, image sides 640 … 8192 px, each with "Custom value" (byte sizes typed in MB); lists show sizes as KB/MB/GB.
- [x] 7.9 File purge schedule set by HQ (weekly default, editable interval, Run now) — owner chose the I11 pilot 2026-11-19. Code done: migration `0768_ops_worker_job_file_purge.sql` (applied by owner 2026-11-19, local + remote), HQ `platform-workers` runner (`src/ops/worker-job-runner.ts`, `cron-match.ts`, `file-util/purge.job.ts`; old hourly timer removed), HQ API ops-jobs (`QUEUED`, worker kind), HQ web Job Manager (worker badge, schedule pick list). I11 plan rows 2.3 / 2.4 / 4.4 + progress log updated.

Any migration this phase needs is still written in `cleanmatex`. Not in v1: browsing an organization's actual files from HQ (privacy; would need its own permission and access log).

### Phase 8 — Docs and close-out

- [ ] 8.1 ADR; developer guide ("how to add a category", "how to add a bucket").
- [ ] 8.2 Feature doc list: permissions used, flags, plan limits, i18n keys, API routes, migrations, env vars.
- [ ] 8.3 Platform inventories refresh; final `STATUS.md`; owner follow-ups list.

## 8. Not in this plan

- Virus scanning (needs an external scanner; a `SCANNING` status can be added later).
- Resumable uploads for very large files.
- A central file-manager page.
- `cmx-api` / mobile endpoints (same tables and buckets; added when the mobile app needs them).
- Sharing one file across several entities.
- HQ-owned files (`hq_file_mst` and HQ buckets); see decision 11.
