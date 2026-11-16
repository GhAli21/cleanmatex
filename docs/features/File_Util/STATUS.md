# File Util — Status

**Plan:** [PLAN.md](PLAN.md) · **Last update:** 2026-11-16

## Current

Phase 1 — migration `0743_file_util_foundation.sql` written. **Waiting for the owner to apply it.** Phase 2 starts after the owner confirms it applied.

## Log

| Date | Task | Result |
|---|---|---|
| 2026-11-16 | Plan approved by owner | — |
| 2026-11-16 | 1.1 Folder renamed `File_Attachments` → `File_Util`; this file created | Done |
| 2026-11-16 | 1.2 Read-only checks (remote DB) | Bucket names `tenants-cmx-files`, `tenants-cmx-public` free. No `sys_file_*` / `org_file_*` tables. **`tenant-assets` bucket does not exist live**, so today's logo upload (`tenants.service.ts uploadLogo`) fails in production; fixed by Phase 5.2. Live buckets: `product-images` (public, weak policies), `delivery-pod-evidence`. `pg_cron` available (5 jobs) for the Phase 2 cleanup job. `storage.objects` owned by `supabase_storage_admin`. |
| 2026-11-16 | 1.3 Migration `0743_file_util_foundation.sql` | Written; parses (pglast, 145 statements). Not applied. |

| 2026-11-16 | Storage structure finalized with owner | Bucket table has `bucket_code` (stable code) + `storage_bucket_id` (real storage id); key layout `{tenant}/{CATEGORY}/{entity_id}/{file_id}.{ext}`; bucket names kept. Draft `0743` updated; parses (140 statements). |

| 2026-11-16 | Purposes added with owner | New `sys_file_purpose_cd` (slots per category, per-slot limits, one default); `org_file_mst.purpose_code` with composite FK; entity index now includes purpose. PRODUCT_IMAGE total raised to 20, TENANT_LOGO to 2. Draft parses (174 statements). |

## Migration 0743 — what it creates

- `sys_file_bucket_cd` (seed: `TENANT_FILES` → `tenants-cmx-files` private, `TENANT_PUBLIC` → `tenants-cmx-public` public).
- `sys_file_category_cd` (seed: `ORDER_PHOTO`, `ORDER_ATTACHMENT`, `ORDER_ISSUE_PHOTO`, `ASM_EXCEPTION_PHOTO`, `QA_PHOTO`, `CUSTOMER_AVATAR`, `PRODUCT_IMAGE`, `TENANT_LOGO`).
- `org_file_mst` with RLS, audit trigger, 4 partial indexes (entity list, quota, pending cleanup, purge cleanup).
- Two storage buckets with **no** client `storage.objects` policies: only the server touches objects (signed upload URLs after permission/quota checks, 5-minute signed read URLs, service-role deletes).
- `org_file_mst`: tenant-scoped **read-only** RLS; INSERT/UPDATE/DELETE revoked from `authenticated`/`anon`; all writes through the service role.

Security review 2026-11-16 (automated): first draft let any signed-in user write/delete objects in their organization folder and write `org_file_mst` rows directly, bypassing category permissions. Fixed in the draft before apply as described above.

Notes for review:
- `org_file_mst.bucket_code` is stored per file (copied from the category at upload) so changing a category's bucket never orphans existing files.
- `org_file_mst` adds `ready_at` and `purged_at` beyond the plan: needed by the cleanup job and to keep deleted rows for audit.
- Phase 2 must therefore use the service-role Supabase client for storage and `org_file_mst` writes, with explicit `tenant_org_id` on every query.

## Owner follow-ups

- [ ] Apply `0743`, then tell me; I then run `npm run prisma:pull` and start Phase 2.
