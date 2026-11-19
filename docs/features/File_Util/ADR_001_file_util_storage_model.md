# ADR 001 — File Util: one shared, data-driven file module

**Status:** Accepted (owner, 2026-11-16; amended 2026-11-17 and 2026-11-19)
**Plan:** [PLAN.md](PLAN.md) §2 holds the full decision list; this ADR records the ones that shape the design.

## Context

Before File Util, each feature stored files its own way: MinIO with anonymous read, a public `product-images` bucket whose write policy checked only the bucket, a `tenant-assets` bucket no migration created, bare URL columns with no metadata, and order photos that were captured and then thrown away. Quota tracking reported `storageMb = 0`. Delivery proof of delivery was the one safe pattern (private bucket, server-made key, magic-byte check, short signed URLs).

## Decision

1. **One backend: Supabase Storage.** MinIO is removed.
2. **The database stores object keys, never URLs.** Private files are read through signed URLs that last 5 minutes and are never stored. Exception: the public MAIN slot of `PRODUCT_IMAGE` and `TENANT_LOGO` is copied as a public URL into `org_product_data_mst.product_image` and `org_tenants_mst.logo_url`, rewritten in the same transaction as every change to that slot, so about 20 URL readers keep working. The file row stays the truth.
3. **Upload goes straight to storage** through a signed upload URL; bytes never pass through Next.js. `complete` then checks the real size, magic bytes against the declared type, and sha256 before the row becomes `READY`.
4. **Rules are data.** Buckets, categories, purposes, media kinds, file types and per-purpose allowed types live in `sys_file_*` tables that HQ edits at `/file-util-config`. Code holds only the category codes, their permissions and their record-ownership checks.
5. **No File Util permission codes.** Each category reuses its owning domain's read/write permissions ("any of" lists in `lib/constants/file-util.ts`).
6. **Browser sessions have no storage policies.** Only the server (service role) touches objects. The key always starts with the tenant id, taken from the session: `{tenant}/{CATEGORY}/{entity}/{file}.{ext}` (DB CHECK).
7. **The upload size limit** is the smaller of (purpose size, else category size) and (file type size, else media kind size). It is checked only on new uploads; changed limits never touch saved files.
8. **Thumbnails are made in the browser** (WebP), so there is no dependency on paid image transforms.
9. **Cleanup is split.** pg_cron `file-util-expire` (hourly) marks `PENDING` uploads older than 24 h as `DELETED`. The HQ `platform-workers` job `file-util-purge` deletes the bytes of `DELETED` rows through the Storage API and sets `purged_at`. It is an `HQ_WORKER` job in the job registry (`0768`): weekly by default, with schedule, on/off and Run now in HQ Job Manager. A SQL-only purge is impossible, because the bytes live outside Postgres and `storage.protect_delete` blocks direct deletes.
10. **Quota:** used bytes = the sum of `READY` rows, checked at upload start against the plan's storage limit (`tenant_max_storage_mb`). Usage tracking reports the same number.
11. **Delivery proof of delivery moved onto File Util** (6.4). Accepted files are **locked** (`locked_at`), and locked files cannot be edited or deleted.

## Consequences

- One security review covers every feature that attaches files; new consumers add one widget (`FileAttachments`) and no routes.
- HQ can change limits, types and purposes without a migration. New *categories* still need code (permissions and ownership check). See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).
- Organizations without a subscription row get `PLAN_UNAVAILABLE` on upload (fails closed, same as order creation).
- Bytes of deleted files stay in storage until the next purge run (up to a week by default).

## Not chosen

- **A per-category metadata table named in data.** That would mean SQL built from data, no tenant guarantee and no Prisma typing. Instead there is one table per owner scope (`org_file_mst`; `hq_file_mst` later).
- **Storage policies for browser uploads.** They are harder to audit and cannot check purpose rules or quota.
- **A tenant-app cleanup endpoint.** Cross-tenant maintenance belongs to HQ (integration-contracts §1).
- **Out of scope:** virus scanning, resumable uploads, sharing one file across records, HQ-owned files (PLAN §8).
