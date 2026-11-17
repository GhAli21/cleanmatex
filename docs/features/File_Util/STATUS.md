# File Util — Status

**Plan:** [PLAN.md](PLAN.md) · **Last update:** 2026-11-16

## Current

Phase 4 code done (build green). **Owner: browser QA with `QA_TEST_GUIDE.md` (A + B); deploy HQ `platform-workers`.** Next: Phase 5 (product images, logo, `product-images` policy fix, MinIO removal).

## Log

| Date | Task | Result |
|---|---|---|
| 2026-11-17 | Phase 4 code | New order: Photo button (badge = pending count) → `CmxCameraCaptureDialog` → `pendingPhotos` in state → `uploadFilesToRecord()` after save (not awaited; result via cmxMessage). Order detail: **Files** tab (`FileAttachments`, read-only without `orders:update`). Old `PhotoCaptureModal` deleted, dead `newOrder.photoCapture.*` keys removed. i18n check passes; tsc + eslint clean on touched files; `npm run build` green; File Util tests 47/47. `QA_TEST_GUIDE.md` written. Locale files are CRLF: edits made byte-preserving (minimal diffs). |
| 2026-11-17 | Phase 4 started | `uploadFile()` extracted (hook reuses it); new-order state gets `pendingPhotos` (uploaded right after save). Remaining steps listed in RESUME_CONTINUATION §3a. |
| 2026-11-17 | Phase 3 UI kit | Shared: `CmxFileDropZone`, `CmxCameraCaptureDialog`, `CmxFileGallery`, `CmxFileViewerDialog` (+4 stories with RTL). Feature: `src/features/file-util` (api, hook with upload queue, image downscale + WebP thumb, `FileAttachments` widget, index). i18n `common.files.*` + `fileUtil.json` EN/AR (check:i18n passes). `.clauderc` snippets. tsc + eslint clean on touched files; `npm run build` green. Not browser-tested yet (needs Phase 4 consumer). Note: rewriting `common.json` briefly reformatted it; rebuilt from HEAD so the diff is only the 21 new lines per locale. |
| 2026-11-17 | `0744` applied by owner (local + remote); types + Prisma regenerated | Verified remote: cron `file-util-expire` at `17 * * * *`, `sys_ops_job_cf` row present. Verification ran `fn_file_util_expire_pending()` once (0 rows; should have been read-only). **Phase 2 done.** HQ `platform-workers` deploy still owner's. |
| 2026-11-17 | Byte purge moved to HQ worker (owner) | `0744` now only creates `fn_file_util_expire_pending()` + pg_cron `file-util-expire` + `sys_ops_job_cf` row. Tenant-app cleanup route, `runFileCleanup` and its guard-bypass entry removed. HQ `platform-workers`: `file-util-purge` queue, hourly job scheduler, `purge.processor.ts` + spec (worker suite 40/40, tsc clean). cleanmatex tests 47/47. Ownership row added to `integration-contracts.md`; HQ runbook updated. |
| 2026-11-17 | `0744` redrafted (not applied) | Cleanup split: DB function `fn_file_util_expire_pending()` (abandoned uploads → DELETED, ≤5000/run) + app purge of bytes; one hourly job runs both. App sweep now only purges DELETED rows. Tests 47/47, tsc/eslint clean, `0744` parses. |
| 2026-11-17 | Phase 2 backend | Constants, service (init/complete/list/sign/update/delete/config/cleanup), content checks for the 14 active types, 7 route files, quota via plan `storage_mb_limit` (`canStoreBytes`), real `storageMb` in usage tracking, guard bypass registered (`file-util-cleanup-sweep`), `0744` cron migration written (not applied). Tests 47/47; tsc + eslint clean on touched files; inventories rebuilt, check green. Prisma client regenerated (`npx prisma generate`). |
| 2026-11-17 | Data gap found | Only 2 of 4 organizations have a subscription row. Without one, uploads fail with `PLAN_UNAVAILABLE` (503), same fail-closed rule as order creation. Fix the data, not the code. |
| 2026-11-17 | 1.5 `0743` applied by owner (local + remote); types + Prisma regenerated | Verified remote: 52 types (14 active), 21 purposes, 106 links, 16 sources, both buckets (50 MB private / 5 MB public); 12 Prisma models present. **Phase 1 done.** |
| 2026-11-16 | Plan approved by owner | — |
| 2026-11-16 | 1.1 Folder renamed `File_Attachments` → `File_Util`; this file created | Done |
| 2026-11-16 | 1.2 Read-only checks (remote DB) | Bucket names `tenants-cmx-files`, `tenants-cmx-public` free. No `sys_file_*` / `org_file_*` tables. **`tenant-assets` bucket does not exist live**, so today's logo upload (`tenants.service.ts uploadLogo`) fails in production; fixed by Phase 5.2. Live buckets: `product-images` (public, weak policies), `delivery-pod-evidence`. `pg_cron` available (5 jobs) for the Phase 2 cleanup job. `storage.objects` owned by `supabase_storage_admin`. |
| 2026-11-16 | 1.3 Migration `0743_file_util_foundation.sql` | Written; parses (pglast, 145 statements). Not applied. |

| 2026-11-16 | Storage structure finalized with owner | Bucket table has `bucket_code` (stable code) + `storage_bucket_id` (real storage id); key layout `{tenant}/{CATEGORY}/{entity_id}/{file_id}.{ext}`; bucket names kept. Draft `0743` updated; parses (140 statements). |

| 2026-11-16 | Purposes added with owner | New `sys_file_purpose_cd` (slots per category, per-slot limits, one default); `org_file_mst.purpose_code` with composite FK; entity index now includes purpose. PRODUCT_IMAGE total raised to 20, TENANT_LOGO to 2. Draft parses (174 statements). |

| 2026-11-16 | HQ workspace planned with owner | Phase 7 expanded: `/file-util-ws` with Buckets, Categories, Purposes, Storage usage, Health; reuses the `products-items-config` code-table engine (moved to a shared module first). No change to `0743`. |

| 2026-11-16 | Pre-apply review of `0743` | **Fixed:** broken default `CURRENT_TIMESTAMP` and comment text in `sys_file_purpose_cd` (edit-script bug; would have failed on apply). **Hardened:** MIME allowlist must be lowercase and may not contain svg/html/xml/script types; explicit write revokes on `sys_file_*`; `thumb_size_bytes` so thumbnails count in the quota; `ck_ofm_rec_sync` keeps `rec_status`/`is_active` equal to the file status; limits on name (≤255) and captions (≤500); lowercase `mime_type`. Verified live: `fn_audit_touch_row` sets only `updated_at`/`updated_count`; `current_tenant_id()` exists. Parses (180 statements). |

| 2026-11-16 | MIME type catalog (owner request) | New `sys_mime_types_cd` (52 curated types: 34 allowed incl. HEIC, Office, ODF, archives, audio, video; 18 deny-list with `is_allowed=false`: SVG, HTML, XML, scripts, executables, macro Office, unknown binary). `ck_smt_never_allow` = hard safety floor. Category array replaced by `sys_file_category_mime_dtl` with FK `(mime_type, is_allowed)` → a denied type cannot be linked, a used type cannot be denied. `org_file_mst.mime_type` FK to the catalog. Owner's `DEFAULT Now` fixed to `now()` (bare `Now` is invalid). Caught by seed simulation: `xml` pattern would have rejected `openxmlformats` (docx/xlsx/pptx) — narrowed to `[/+]xml$`. 237 statements; all seeds pass every CHECK/FK in simulation. |

| 2026-11-16 | Redesign with owner: lookups + order context | Migration now generated by a script with seed self-checks (`gen_0743.py` in the session scratchpad; the SQL file is the source of truth). Renamed to `sys_file_mime_types_cd`. Value-list CHECKs replaced by 6 seeded lookup tables + FKs (owner scope, media kind, preview mode, status, upload source, ref type); security floor stays a CHECK. Active types = owner's 14. Categories consolidated: `ORDER_FILE` (12 purposes incl. DELIVERY_PROOF, SIGNATURE, BEFORE/AFTER_IMAGE, ITEM_VIDEO 50 MB), `CUSTOMER_FILE`, `PRODUCT_IMAGE`, `TENANT_LOGO`. Allowed types moved to purpose level (`sys_file_purpose_mime_dtl`, 106 links). `org_file_mst` gains `source_code`, `ref_type_code`/`ref_id`, `notes` (replaces captions), `duration_ms`. 399 statements; all seeds pass every CHECK/FK; no identifier > 30 chars. |

**Rules the database cannot enforce; Phase 2 service must:**
- `ref_id` must belong to the same record (`entity_id`) and organization, in the table named by `sys_file_ref_type_cd.table_name`.
- Linked type must also be `is_active` (inactive types may stay linked).
- Per-purpose and per-category file limits under concurrent uploads: take a transaction advisory lock on (tenant, category, entity) before counting.
- A tenant category must point to a `TENANT` bucket (cross-table rule).
- The `storage_bucket_id` must exist in `storage.buckets`.
- `entity_id` must exist in this organization in the category's table.

## Migration 0743 — what it creates

See PLAN.md §3 (kept current). In short: 6 lookups, `sys_file_mime_types_cd`, `sys_file_bucket_cd`, `sys_file_category_cd`, `sys_file_purpose_cd`, `sys_file_purpose_mime_dtl`, `org_file_mst` (tenant read-only RLS, writes via service role), 2 storage buckets, no client storage policies.

## Owner follow-ups

- [ ] Apply `0743`, then tell me; I then run `npm run prisma:pull` and start Phase 2.
