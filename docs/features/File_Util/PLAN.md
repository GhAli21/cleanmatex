# File Util — Plan

**Status:** APPROVED 2026-11-16 — Phase 1 in progress (see [STATUS.md](STATUS.md)).
**Date:** 2026-11-16
**Scope:** one shared, domain-agnostic module to upload, store, list, view and delete files (images, PDF, documents) for any feature. Built in `cleanmatex` (`web-admin`); catalog management in HQ (`cleanmatexsaas`).

**Progress rule:** after every task below, tick its checkbox here and update `STATUS.md` in this folder before starting the next task. Each phase ends with an explicit status task; a phase is not done until that task is ticked.

## 0. Progress

| # | Phase | Status |
|---|---|---|
| 1 | Foundation (migration) | Migration `0743` written — waiting for owner to apply |
| 2 | Backend | Not started |
| 3 | UI kit | Not started |
| 4 | First consumer: order photos | Not started |
| 5 | Close existing gaps | Not started |
| 6 | Remaining photo columns | Not started |
| 7 | HQ (catalog management, usage) | Not started |
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
5. **Authorization comes from the owning domain.** Each category maps to that domain's existing read/write permission. No new permission codes.
6. **Thumbnails are made in the browser** and stored as a second object. No dependency on Supabase image transforms or a paid plan.
7. **No new npm dependencies.** Drag-and-drop, canvas downscale and the native PDF viewer are browser features.
8. **Delivery POD stays as it is.** It is already sound and has its own receipt/consume rules.
9. **Module name: File Util** (owner, 2026-11-16). DB objects use the `file` marker (`sys_file_*`, `org_file_*`). Everything else uses `file-util`: `src/features/file-util/`, `lib/services/file-util/`, `/api/v1/file-util/`. This folder is renamed `docs/features/File_Util/` at implementation start.
10. **Bucket is data, not code** (owner, 2026-11-16). `sys_file_bucket_cd` lists the buckets; each category points to one. The service takes the bucket from the category, so no code path is tied to one bucket.
12. **Owner scope picks the metadata table; categories do not** (2026-11-16). TENANT buckets → `org_file_mst`, HQ buckets → `hq_file_mst` (same shape, no `tenant_org_id`), behind one store interface in code. No per-category table name in data (SQL built from data, no tenant guarantee, no Prisma typing, duplicated cleanup and quota logic). A domain table that needs a direct link adds an FK to the file, e.g. `org_product_data_mst.image_file_id` → `org_file_mst (tenant_org_id, id)` via `uq_ofm_tenant_id`; it never copies file metadata.
11. **HQ files are a later step.** They need their own table (`hq_file_mst`, no `tenant_org_id`) and a different storage policy, because the tenant-folder rule does not apply to HQ buckets. HQ buckets (`hq-files`, `hq-crm-files`, ...) are added as rows in `sys_file_bucket_cd` then. Not built in this plan.

## 3. Database (one migration; number = last + 1 at write time)

| Object | Purpose |
|---|---|
| `sys_file_bucket_cd` | One row per storage bucket: `bucket_code` (stable code, PK, referenced by categories and files), `storage_bucket_id` (real `storage.buckets.id`, unique, no FK — Supabase owns the storage schema), `owner_scope` (`TENANT` / `HQ`), `is_public`, `name`/`name2`, audit columns. Seeded: `TENANT_FILES` → `tenants-cmx-files` (private), `TENANT_PUBLIC` → `tenants-cmx-public` (public). (Owner, 2026-11-16.) |
| `sys_file_category_cd` | One row per use (`ORDER_PHOTO`, `PRODUCT_IMAGE`, `TENANT_LOGO`, ...): `bucket_code` (FK), `allowed_mime_types TEXT[]`, `max_size_bytes`, `max_files_per_entity`, `image_max_dimension`, `name`/`name2`, audit columns. |
| `sys_file_purpose_cd` | Slots inside a category (owner, 2026-11-16): PK `(category_code, purpose_code)`, `max_files` (NULL = category total only; 1 = single slot, new upload replaces), `is_default` (one per category), `name`/`name2`, `rec_order` = display order. Seeded e.g. `PRODUCT_IMAGE`: `MAIN`, `FOR_ORDER`, `BACKSIDE`, `GALLERY`; `ORDER_PHOTO`: `INTAKE`, `DAMAGE`, `STAIN`, `AFTER_CLEANING`; `TENANT_LOGO`: `MAIN`, `RECEIPT`. Not in the object key, so re-tagging never moves the object. |
| `org_file_mst` | One row per file: `tenant_org_id`, `category_code` (FK), `purpose_code` (FK `(category_code, purpose_code)`), `entity_id`, `object_key`, `thumb_object_key`, `original_name`, `mime_type`, `size_bytes BIGINT`, `sha256_hex`, `width`, `height`, `status` (`PENDING` / `READY` / `DELETED`), `sort_order`, `caption`/`caption2`, full audit columns. Unique `(tenant_org_id, object_key)`. |
| Storage buckets | The two seeded buckets. Key: `{tenant_org_id}/{CATEGORY_CODE}/{entity_id}/{file_id}.{ext}`, thumbnail `{file_id}_thumb.webp` in the same folder (owner, 2026-11-16). A CHECK on `org_file_mst` enforces the prefix. |
| Storage policies | None for browser sessions (security review 2026-11-16). Only the server touches objects: signed upload URLs, 5-minute signed read URLs, service-role deletes. Public bucket readable only through its public URL. |
| RLS | `org_file_mst`: tenant read-only; writes revoked from `authenticated`/`anon`, done by the service role. `sys_file_*`: read for signed-in users, no tenant write. |
| Indexes | `(tenant_org_id, category_code, entity_id, sort_order)`; partial index on `status = 'PENDING'`. |

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
| `CmxFileUpload` | Drag-and-drop, click, paste; multi-file; per-file progress, cancel, retry; validation before upload; image downscale and thumbnail before upload. |
| `CmxPhotoCapture` | Camera capture. Promoted from the orders `PhotoCaptureModal`. |
| `CmxFileGallery` | Thumbnail grid or list, lazy-loaded, reorder, caption, delete with confirm. |
| `CmxFileViewer` | Images with zoom and keyboard navigation; PDF in the browser viewer; download for other types. |
| `CmxAttachments` | One-line integration: `<CmxAttachments category="PRODUCT_IMAGE" entityId={id} purposes={['FOR_ORDER', 'BACKSIDE']} readOnly={...} />`. No `purposes` = all, grouped by purpose in `rec_order`; upload picks the purpose (default preselected). |
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
- [ ] 1.5 Owner applied `0743`; `npm run prisma:pull`.

### Phase 2 — Backend

- [ ] 2.1 Constants and types (`file-categories.ts`, category → permission map).
- [ ] 2.2 Service: init, complete, list, sign, update, delete.
- [ ] 2.3 Six routes with the full guard chain.
- [ ] 2.4 Quota check; real `storageMb` in `usage-tracking.service.ts`.
- [ ] 2.5 Cleanup job on the existing scheduler.
- [ ] 2.6 Tests: tenant isolation, type spoofing, quota, idempotent complete, permission denial.
- [ ] 2.7 Refresh platform inventories (`surface=api`).
- [ ] 2.8 Update `STATUS.md` and the progress table.

### Phase 3 — UI kit

- [ ] 3.1 API client and hooks in `src/features/file-util/`.
- [ ] 3.2 `CmxFileUpload` (with downscale and thumbnail).
- [ ] 3.3 `CmxPhotoCapture` (promoted from orders).
- [ ] 3.4 `CmxFileGallery` and `CmxFileViewer`.
- [ ] 3.5 `CmxAttachments`.
- [ ] 3.6 i18n keys EN/AR, `npm run check:i18n`; stories; `.clauderc` snippets.
- [ ] 3.7 Update `STATUS.md` and the progress table.

### Phase 4 — First consumer: order photos

- [ ] 4.1 New order: captured photos are uploaded and linked to the order.
- [ ] 4.2 Order detail: photos shown with `CmxAttachments`.
- [ ] 4.3 QA guide with owner-runnable scenarios.
- [ ] 4.4 Update `STATUS.md` and the progress table.

### Phase 5 — Close existing gaps

- [ ] 5.1 Product images moved to the module.
- [ ] 5.2 Tenant logo moved to the module.
- [ ] 5.3 Migration fixing the `product-images` policy. **Stop for the owner to apply.**
- [ ] 5.4 Remove MinIO (client, dependency, docker-compose), `upload-photo.ts`, `tenant-logo.ts`, `tenant-assets` code; old routes removed.
- [ ] 5.5 Update `STATUS.md`, the QA guide and the progress table.

### Phase 6 — Remaining photo columns

- [ ] 6.1 Order-issue photos.
- [ ] 6.2 Assembly exception and QA photos.
- [ ] 6.3 Customer avatar.
- [ ] 6.4 Update `STATUS.md`, the QA guide and the progress table (after each of 6.1–6.3).

### Phase 7 — HQ (`cleanmatexsaas`)

- [ ] 7.1 Register `sys_file_bucket_cd` and `sys_file_category_cd` in the HQ code-table engine, so HQ staff manage limits and allowed types without a migration.
- [ ] 7.2 Show each tenant's storage used against its limit on the HQ tenant screen.
- [ ] 7.3 Update `STATUS.md` and the progress table.

Any migration this phase needs is still written in `cleanmatex`.

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
