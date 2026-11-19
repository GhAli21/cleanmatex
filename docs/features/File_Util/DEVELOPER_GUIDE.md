# File Util — Developer Guide

Agents: load the `/file-util-wire` skill (`.claude/skills/file-util-wire/SKILL.md`) before wiring a screen.

Why it is built this way: [ADR_001_file_util_storage_model.md](ADR_001_file_util_storage_model.md). What exists (routes, tables, keys): [FEATURE_REFERENCE.md](FEATURE_REFERENCE.md).

## 1. Attach files to a screen (existing category)

No new route, table or permission is needed.

```tsx
import { FileAttachments } from '@features/file-util';

<FileAttachments
  category="ORDER_FILE"            // FILE_CATEGORIES in lib/constants/file-util.ts
  entityId={order.id}               // the owning record; must belong to the session's tenant
  source="ORDER_DETAIL"             // FILE_SOURCES: the screen the upload comes from
  purposes={['BEFORE_IMAGE', 'DAMAGE']} // optional; none = every active purpose, grouped
  readOnly={!canEdit}
/>
```

- A record that does not exist yet (new order, new issue): collect files with `PendingFilesPicker`, save the record, then call `uploadFilesToRecord()` with the new id. Pass `ref` / `notes` for an order sub-record (`ORDER_ISSUE`, `ASM_EXCEPTION`, …).
- One image in a list row: no component yet (`CmxFileThumb` was planned, not built). If you build it, feed it from one batch `GET /api/v1/file-util?entityIds=…` call per page, never one call per row.
- Pieces: pass `fileSource={FILE_SOURCES.X}` to `OrderPiecesManager`; each piece gets a "Photos (n)" button (ref `ORDER_PIECE`). Counts share one order-wide list call.
- Items when pieces are not tracked: `<PiecePhotosControl refType={FILE_REF_TYPES.ORDER_ITEM} refId={item.id} label={name} …/>` under the item, only when `!trackByPiece`.
- Preselect a file type for a screen: add its source to `ORDER_FILE_DEFAULT_PURPOSE_BY_SOURCE` (`lib/constants/file-util.ts`); or pass `defaultPurpose` to `FileAttachments`.
- One sub-record's files in a panel (e.g. an assembly task): `OrderStageFiles` with `refType` + `refId`.
- Reject or issue with photos: `OrderIssueReportDialog` (`qaReject` for QA reject: also rejects, saves QA_EVIDENCE from ORDER_QA).
- Proof that must not change (delivery, pickup): upload first, send the file ids to the completion command, lock them in its transaction (see `lockPickupProofFiles`).
- Order workflow stage screens: use `<OrderStageFiles orderId={id} source={FILE_SOURCES.ORDER_QA} />` (`src/features/orders/ui/order-stage-files.tsx`). It is collapsed until opened and sets read-only from `orders:update` / `orders:transition`.
- The server records the record's stage at upload (`stage_code`; for orders, the order status). Do not send it from the screen. To give another category stages, add a branch in `assertEntityOwned()` that returns its `stageCode`, and one in `stageLabels()` for the names.
- The upload rules (types, sizes, counts, image downscale size) come from `GET /api/v1/file-util/config`. Do not copy them into the screen.

## 2. Add a category (a new kind of owning record)

A category needs code, because it carries permissions and a record-ownership check. Do these steps in order:

1. **Tenant constants**, in `web-admin/lib/constants/file-util.ts`:
   - Add the code to `FILE_CATEGORIES`.
   - Add its purposes to `FILE_PURPOSES`.
   - Add its permissions to `FILE_CATEGORY_ACCESS`. Reuse the owning domain's existing codes (`read` and `write` are "any of" lists). Do not create File Util permissions.
2. **Ownership check**: add a `case` to `assertEntityOwned()` in `web-admin/lib/services/file-util/file-util.service.ts`. The query must filter `id` **and** `tenant_org_id` (CLAUDE.md rule 4).
3. **Published URL** (only if old readers need a URL column): add the category's single-slot purpose to `PUBLISHED_URL_PURPOSE` and a branch in `syncPublishedUrl()`. This works only for a public bucket; a private bucket clears the column.
4. **Seed the data in a migration** (`/database` skill; number = last + 1 at write time; the owner applies it):
   - A `sys_file_category_cd` row: bucket, `max_size_bytes`, `max_files_per_entity`, `image_max_dimension`, EN/AR names.
   - Its `sys_file_purpose_cd` rows, with exactly one `is_default`.
   - Their `sys_file_purpose_mime_dtl` links.

   You could also add these rows from the HQ screen, but a migration keeps every environment the same.
5. **HQ protected codes**: add the category to `APP_CATEGORIES` and its purposes to `APP_PURPOSES` in `cleanmatexsaas/platform-api/src/modules/file-util-config/file-util-config.service.ts`, so HQ cannot switch off codes the app uses.
6. **i18n**: add purpose names, if the screen shows them, to `messages/{en,ar}/fileUtil.json`, then run `npm run check:i18n`.
7. **Tests**: add an ownership test (wrong tenant gives `ENTITY_NOT_FOUND`) and a permission test to the File Util service tests.

If the DB has a category the code does not know, the code rejects it (zod enum), so seeding first is harmless.

## 3. Add a bucket

A bucket is data. Tenant code never names a bucket; the service takes it from the category.

1. In HQ, go to **File Setup → Buckets → New** (needs `file_util.manage`). Enter:
   - `bucket_code`: the stable code.
   - `storage_bucket_id`: the real storage bucket name.
   - Scope: `TENANT`.
   - Public or private.
   - Size ceiling.

   The HQ API creates the storage bucket first, then the row. If the row fails, it removes the bucket again (only if this request created it).
2. Point a category at the new bucket (**Categories → edit**). The change applies to **new uploads only**; existing files keep their `bucket_code`.
3. Public or private: use a public bucket only for content that is meant to be public (logo, product image). Everything else goes private and is read through 5-minute signed URLs.
4. Add no storage policies. Only the server's service role touches objects.
5. If the app must never lose the bucket, add it to `APP_BUCKETS` (HQ service above).

A bucket with active categories cannot be switched off. **Settings → File health** lists storage buckets that no bucket row uses.

`HQ`-scope buckets (`hq_file_mst`) are not built (PLAN decision 11).

## 4. Change limits or allowed types (no code)

All in HQ `/file-util-config`:
- Category or purpose size and counts.
- Media kind and file type size.
- Which types each purpose allows.
- Turning types on or off.

Blocked types (SVG, HTML, scripts, …) can never be enabled; the DB CHECK `ck_sfmt_never_allow` guards this. Limits apply to new uploads only.

## 5. Error codes the UI can expect

The service throws `FileUtilError` with a `code` and HTTP status. Examples: `ENTITY_NOT_FOUND` (404), `FILE_LOCKED`, `PLAN_UNAVAILABLE` (503).

`web-admin/lib/services/file-util/file-util-http.ts` turns it into `{ success: false, code, error }`. Unknown errors become `FILE_UTIL_FAILED` (500).

Messages for the user live in `fileUtil.errors.*`.
