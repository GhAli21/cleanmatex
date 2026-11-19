# File Util — Feature Reference

Facts lookup (PLAN 8.2). Design: [ADR_001](ADR_001_file_util_storage_model.md) · how-to: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) · QA: [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md).

## Which stage, screen and transaction a file belongs to

The storage path says only tenant, category and record. Everything else is on the `org_file_mst` row:

| Question | Column | Set by |
|---|---|---|
| Which screen | `source_code` (`sys_file_source_cd`) | the screen (`source` prop) |
| Which stage of the record | `stage_code` (order: `current_status`, lowercase) | the server at upload; NULL before 0770 |
| What the file is | `purpose_code` | the user / screen |
| Which sub-record (issue, piece, QA decision, assembly task or exception, delivery stop) | `ref_type_code` + `ref_id` | the screen; the server checks it belongs to the order |
| Who and when | `created_by`, `created_at` | the server |

## Permissions

**Tenant app.** No File Util codes. Each category uses the owning domain's codes. The source is `FILE_CATEGORY_ACCESS` in `web-admin/lib/constants/file-util.ts`. A list means any one of the codes is enough.

| Category | Read | Write |
|---|---|---|
| `ORDER_FILE` | `orders:read` | `orders:update`, `orders:transition` |
| `CUSTOMER_FILE` | `customers:read` | `customers:update` |
| `PRODUCT_IMAGE` | `products:read` | `products:update` |
| `TENANT_LOGO` | `settings:read` | `settings:branding` |

On the order detail Files tab, edit controls show only with `orders:update`. The code is picked per request from the category, so the platform inventory does not list File Util routes; the inventory rebuild reports drift 0.

**HQ.** `file_util.view` (read), `file_util.manage` (write) and `file_util.*`, given to `TECH_ADMIN` by `0762`. The purge job uses the existing Job Manager permission `hq_ops:manage_jobs`.

## Feature flags and plan limits

- No feature flag.
- Plan limit `tenant_max_storage_mb` (`FEATURE_FLAGS.TENANT_MAX_STORAGE_MB`): checked at upload start by `canStoreBytes()` in `usage-tracking.service.ts`.
- Used bytes are the sum of `READY` rows.
- An organization with no subscription gets `PLAN_UNAVAILABLE` (503).

## API routes

**Tenant (`web-admin/app/api/v1/file-util/`)**

Every route goes through `guardFileRequest` (`lib/services/file-util/file-util-http.ts`) in this order: CSRF, then permission, then the tenant rate limit, then zod.

| Route | Does |
|---|---|
| `POST /api/v1/file-util` | Start an upload: checks rules, record ownership, limits and quota; adds a `PENDING` row; returns signed upload URLs. |
| `POST /api/v1/file-util/[id]/complete` | Checks size, magic bytes and sha256, then sets the file `READY`. Safe to repeat. |
| `GET /api/v1/file-util` | Lists files: `category`, `entityIds` (≤ 100), `purposes`, `refType`, `refId`, `sources` (screens), `stages` (record stage at upload, e.g. `qa`). Each file has `sourceCode`, `stageCode`, `refTypeCode`. |
| `POST /api/v1/file-util/sign` | Batch signed read URLs (≤ 200 ids, 5 minutes). |
| `PATCH /api/v1/file-util/[id]` | Notes, sort order, purpose. Locked files are refused. |
| `DELETE /api/v1/file-util/[id]` | Soft delete; the bytes are removed later by the purge job. |
| `GET /api/v1/file-util/config` | Upload rules of a category, for the drop zone, plus `labels` (EN/AR names of sources, stages, ref types). |

**HQ (`platform-api/src/modules/file-util-config/`, base `file-util-config`)**

| Route | Does |
|---|---|
| `GET overview`, `GET codes`, `GET code-options/:entity/:column` | Hub screen and pick lists. |
| `GET/POST/PATCH/DELETE codes/:entity[/:code[/:code2]]` | Edit `buckets`, `categories`, `purposes`, `media-kinds` and `mime-types` (shared code-table engine). |
| `GET/PUT purposes/:category/:purpose/mime-types` | Which file types a purpose allows. |
| `GET storage-usage`, `GET storage-usage/:tenantOrgId`, `GET health` | Read-only usage and file health. |

**HQ web pages:** `/file-util-config` (hub), `/file-util-config/[entity]`, `/file-util-config/storage-usage`, `/file-util-config/health`. The purge job is managed in `/ops/jobs`.

## Database objects

- **Lookups:** `sys_file_owner_scope_cd`, `sys_file_media_kind_cd`, `sys_file_preview_mode_cd`, `sys_file_status_cd`, `sys_file_source_cd`, `sys_file_ref_type_cd`.
- **Rules:** `sys_file_mime_types_cd`, `sys_file_bucket_cd`, `sys_file_category_cd`, `sys_file_purpose_cd`, `sys_file_purpose_mime_dtl`.
- **Files:** `org_file_mst`.
- **Storage buckets:**
  - `tenants-cmx-files`: private, 50 MB.
  - `tenants-cmx-public`: public, 5 MB.
- **Jobs:**
  - pg_cron `file-util-expire` (`17 * * * *`, `fn_file_util_expire_pending()`).
  - HQ worker job `file-util-purge` (`sys_ops_job_cf`, `HQ_WORKER`, default `47 3 * * 0`).
- **URL columns kept as copies of the file row:** `org_product_data_mst.product_image` (PRODUCT_IMAGE/MAIN), `org_tenants_mst.logo_url` (TENANT_LOGO/MAIN), `org_tenants_mst.logo_dark_url` (TENANT_LOGO/DARK, from `0773`).

## Migrations (all applied by the owner)

| # | File | What |
|---|---|---|
| 0743 | `file_util_foundation` | Lookups, rules, `org_file_mst`, both buckets, RLS, indexes, seeds. |
| 0744 | `file_util_cleanup_cron` | `fn_file_util_expire_pending` + pg_cron + `sys_ops_job_cf` row. |
| 0750 | `file_util_retire_product_images` | Locks the old `product-images` bucket; clears its URLs. |
| 0751 | `file_util_drop_photo_url_columns` | Drops 5 empty photo URL columns. |
| 0758 | `file_util_delivery_pod_files` | Delivery POD on File Util: file lock columns; drops the old evidence table and columns; locks `delivery-pod-evidence`. |
| 0762 | `hq_file_util_config_perms` | HQ permissions. |
| 0763 | `hq_nav_file_util_config` | HQ navigation hub + 5 child rows. |
| 0765 | `file_util_type_size_limits` | Size per media kind and file type. |
| 0766 | `hq_file_util_usage_health` | 3 read-only `service_role` functions (usage, health). |
| 0767 | `hq_nav_file_util_kinds_types` | HQ navigation rows for Media kinds and File types. |
| 0768 | `ops_worker_job_file_purge` | `HQ_WORKER` job kind, `sys_ops_job_req_tr`, worker functions, purge job row. |
| 0771 | `file_util_pickup_proof` | ORDER_FILE purpose `PICKUP_PROOF` (images, max 10), locked by the pickup completion command. |
| 0770 | `file_util_upload_stage` | `org_file_mst.stage_code` (record stage at upload), source `ORDER_PACKING`, order statuses `PROCESSING` / `READY_FOR_PICKUP` in `sys_order_status_cd`. |

Also used: `0757` (theme runtime) added `TENANT_LOGO` purposes `DARK` and `FAVICON`.

## i18n namespaces

**Tenant (`web-admin/messages/{en,ar}/`)**
- `fileUtil.json`: widget, purposes, `errors.*`.
- `common.json` → `files.*`: shared Cmx file components.

**HQ (`platform-web/messages/{en,ar}/`)**
- `fileUtilConfig.json`.
- `codeTables.json`: shared engine, incl. presets.
- `opsJobs.json`: worker badge, `QUEUED`, schedule presets.
- `layout.json`: navigation.

## Code locations

**Tenant**
- Service: `web-admin/lib/services/file-util/` (`file-util.service.ts`, `file-sniff.ts`, `file-util-http.ts`).
- Constants: `lib/constants/file-util.ts`.
- Feature: `src/features/file-util/` (`FileAttachments`, `PendingFilesPicker`, hooks, image prep).
- Order stage screens: `src/features/orders/ui/order-stage-files.tsx` (`OrderStageFiles`), on preparation, processing, assembly, QA, packing, ready, delivery order and route stop pages.
- Piece photos: `src/features/orders/ui/pieces/piece-photos.tsx` (`PiecePhotosControl`), via `OrderPiecesManager fileSource`. Same control with `refType=ORDER_ITEM` under each item when piece tracking is off.
- Assembly task files: `assembly-task-modal.tsx` → `OrderStageFiles` with `refType=ASM_TASK`, `refId=taskId`.
- QA reject photos: `OrderIssueReportDialog qaReject`. Pickup proof: `pickup-handover-card.tsx` → `completePickup({ proofFileIds })` locks them.
- Locked proof: delivery (`delivery-completion.service.ts`, DELIVERY_STOP) and pickup (`pickup-completion.service.ts`, PICKUP_PROOF).
- Shared UI: `CmxFileDropZone`, `CmxCameraCaptureDialog`, `CmxFileGallery`, `CmxFileViewerDialog` in `src/ui/` (the planned `CmxFileThumb` was not built; add it when a list screen needs one image per row).

**HQ**
- API: `platform-api/src/modules/file-util-config/`.
- Web: `platform-web/src/features/file-util-config/`.
- Worker: `platform-workers/src/file-util/` (purge) and `src/ops/` (`worker-job-runner.ts`, `cron-match.ts`).

## Environment variables

No new variables. Both apps use the existing Supabase server settings:
- Tenant: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- HQ `platform-workers`: `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`.

The purge does not use Redis. The MinIO variables are no longer used.
