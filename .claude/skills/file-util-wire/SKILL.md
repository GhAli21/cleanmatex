---
name: file-util-wire
description: Wire, change or unwire File Util (the shared upload/storage module) on any tenant web-admin screen — add a Files tab or attachments panel, photos on a create dialog (upload after save), a single image slot (logo, product main image), new purposes/sources/ref types/categories, change which purposes a screen shows, make it read-only, or remove it. Use whenever a screen needs to attach, show, capture, replace or stop handling files, photos, images, PDFs, documents or evidence on a record, even if the user does not say "File Util" (e.g. "let staff attach photos to X", "add documents to the customer page", "remove the image upload from Y", "replace this photo URL field").
user-invocable: true
version: 1.0.0
---

# File Util — wire a screen

File Util is one module that stores files for every feature. A screen never uploads to storage itself, never stores URLs and never adds file routes. It uses the widgets in `@features/file-util`; the server checks the rules (permissions, types, sizes, counts, quota) in `lib/services/file-util/`.

Before you change anything, read the parts of these that apply:
- `docs/features/File_Util/DEVELOPER_GUIDE.md` (how-to)
- `docs/features/File_Util/FEATURE_REFERENCE.md` (routes, tables, permissions)
- `web-admin/lib/constants/file-util.ts` (codes that mirror the DB)

Also load `/frontend` and `/i18n` before writing UI. Load `/database` before any migration.

## 0. Decide what the change is

| The user wants | Recipe |
|---|---|
| Files on a record that already exists (detail page, edit form, tab) | §1 `FileAttachments` |
| Files picked while the record is being created (dialog, new form) | §2 `PendingFilesPicker` + `uploadFilesToRecord` after save |
| One image whose URL other code reads (logo, product main image) | §3 published single slot |
| A different set of purposes, read-only mode, another sub-record | §4 change |
| Remove files from a screen, or replace an old URL field | §5 unwire / replace |
| A record type with no category yet | §6 new category / purpose / source / ref type |

A screen is often two cases at once. Example: a "new issue" dialog is §2, and the issue list that shows the photos afterwards is §1 with `refType`/`refId`. Wire both, or the files are saved but nobody can see them.

## 1. Existing record — `FileAttachments`

```tsx
import { FileAttachments } from '@features/file-util';
import { FILE_CATEGORIES, FILE_PURPOSES, FILE_SOURCES } from '@/lib/constants/file-util';

<FileAttachments
  category={FILE_CATEGORIES.CUSTOMER_FILE}
  entityId={customer.id}
  source={FILE_SOURCES.CUSTOMER_PROFILE}
  purposes={[FILE_PURPOSES.CUSTOMER_FILE.ID_DOCUMENT]} // optional; omitted = every active purpose
  refType={...} refId={...}                             // optional: one sub-record (ORDER_FILE only)
  readOnly={!canUpdateCustomer}
/>
```

Get these right:
- **Constants, not string literals.** Every code comes from `lib/constants/file-util.ts` (CLAUDE.md rule 9). If a code you need is missing there, it is a §6 change, not a literal.
- **`readOnly` must mirror the server's write permission** in `FILE_CATEGORY_ACCESS` (any of the listed codes). Get it with the screen's existing permission hook. `readOnly` only hides buttons; the server still enforces. If the two disagree, users see buttons that fail with 403, or are blocked from something they are allowed to do. Exception: the order detail Files tab deliberately uses `orders:update` only.
- **Which `entityId` to pass:**
  - The owning record's id, in the session tenant.
  - For `TENANT_LOGO` it is the tenant id.
  - For order sub-records (issue, piece, QA decision, assembly task or exception, delivery stop) it is the **order id**, plus `refType`/`refId`. The server checks that the sub-record belongs to that order (`assertRefOwned`).
- **No id yet** (the form is in create mode): render nothing, or a hint, or use §2. Do not pass an empty id. The hook also has `enabled` to pause queries.
- **`source`** is the screen the upload comes from. Pick the closest `FILE_SOURCES` value; add a new one through §6 when none fits. It is stored for audit and shown on each tile.
- **Stage is not a prop.** The server stores the record's stage at upload (`stage_code`; orders: the order status). The widget shows "stage · screen · sub-record" and a stage filter by itself.
- **Order workflow stage screen** (preparation, processing, assembly, QA, packing, ready, delivery, or a new one): use `OrderStageFiles` from `src/features/orders/ui/order-stage-files.tsx` with that screen's source, not a new wrapper. It hides itself without `orders:read`.
- **Pieces on a screen:** pass `fileSource` to `OrderPiecesManager` (per-piece photos, ref `ORDER_PIECE`). Never add a per-piece list call; `PiecePhotosControl` shares one. Items without piece tracking: the same control with `refType={FILE_REF_TYPES.ORDER_ITEM}`, shown only when `!trackByPiece`.
- **Proof that is locked** (delivery, pickup): upload first, pass the file ids to the completion command, lock them in its transaction with `tenant_org_id` + order + purpose + READY + unlocked filters; fewer locked than sent = roll back.
- **Placement:** put it in a tab or section that mounts only when it is shown (for example `activeTab === 'files' && …`), so a page does not fetch files nobody looks at.
- **Lists:** never render `FileAttachments` or `useFileAttachments` once per row. There is no list thumbnail component yet (`CmxFileThumb` was planned, not built). If a list needs one image per row, build it on one batch `GET /api/v1/file-util?category=…&entityIds=a,b,…` (≤ 100 ids) per page and add it to `src/ui/` with a story (load `/storybook`).

## 2. Record being created — pick now, upload after save

Bytes can only be attached to a record that exists. So the dialog keeps the `File[]` in state and uploads them once the save returns the new id. Example: `src/features/orders/ui/issues/order-issue-report-dialog.tsx`.

```tsx
const [photos, setPhotos] = useState<File[]>([]);
const { token: csrfToken } = useCSRFToken();
// In the form:
<PendingFilesPicker label={t('photos')} category={FILE_CATEGORIES.ORDER_FILE}
  purpose={FILE_PURPOSES.ORDER_FILE.ISSUE_EVIDENCE} files={photos} onChange={setPhotos}
  disabled={mutation.isPending} />
// In onSuccess, with the id the save returned:
if (newId && photos.length > 0) {
  void uploadFilesToRecord({ category, entityId, purpose, source, refType, refId: newId,
    files: photos, csrfToken }).then(({ saved, failed }) => {
      if (failed > 0) cmxMessage.warning(tFiles('orderPhotosFailed', { failed }));
      else cmxMessage.success(tFiles('orderPhotosSaved', { count: saved }));
    });
}
```

Get these right:
- **Upload only after the save succeeds**, with the id from the response. Never upload before the save, or the files have no owning record.
- **The save must return the id.** If the API does not return it, change the API to return it. Do not look the record up again by other fields.
- **Report the result through `cmxMessage`.** The upload does not block closing the dialog, but a failure must still be shown: the files were lost and the user has to know.
- **Reset `photos`** when the dialog closes or reopens, so files from one record do not carry over to the next.
- **Disable the picker while saving.**
- **Make the files visible afterwards.** The screen that shows the record needs a §1 widget with the same `refType`/`refId`.
- The picker checks type, size and count against the server config before upload. The server checks again; that is expected.

## 3. Single published slot (logo, product main image)

- Purposes with `max_files = 1` are single slots.
- `PRODUCT_IMAGE/MAIN`, `TENANT_LOGO/MAIN` and `TENANT_LOGO/DARK` also write a public URL into `org_product_data_mst.product_image`, `org_tenants_mst.logo_url` and `org_tenants_mst.logo_dark_url`. The service does this in `PUBLISHED_URL_PURPOSES` / `syncPublishedUrl(…, purposeCode)`, in the same transaction as the file change.
- Old readers keep reading that column. **No screen or API may write the column itself.** Remove any old upload route, form field or PUT body field that did; the branding PUT, for example, now ignores `logo`.
- To show the current image on the edit form, use `useFileAttachments` with `purposes: ['MAIN']`, as `product-form.tsx` does.
- A new published slot needs service code: §6 step 3, and only for a public bucket.

## 4. Change an existing wiring

- **Purposes shown:** change `purposes` to constants. Files saved under purposes you no longer list stay in the DB, but this screen no longer shows them. Say so to the user, and check whether another screen still shows them.
- **Read-only rule:** change it in step with the permission. If the server permission itself must change, edit `FILE_CATEGORY_ACCESS` and that page's access contract (§7) together.
- **Limits, allowed types, purpose names, turning a purpose off:** these are data in HQ `/file-util-config`, not code. Do not hard-code limits in the screen. Do not add client-only checks that are stricter than the server.

## 5. Unwire or replace

- **Removing the widget never deletes files.** Saved files stay, still count toward quota, and still show on other screens of the same record. If the user wants them gone, that is a data decision: ask, then soft-delete them through the service (`status_code = 'DELETED'`, with an explicit `tenant_org_id` filter). Never delete storage objects directly; the HQ `file-util-purge` job removes the bytes later.
- **Do not remove constants or purposes** that other screens, the HQ protected lists (`APP_PURPOSES` / `APP_CATEGORIES` in cleanmatexsaas `file-util-config.service.ts`) or seeds still use. Grep both repos before deleting a code.
- **Replacing an old URL input, URL column or custom upload:**
  1. Move the screen to §1/§2.
  2. Delete the old upload route, helper and URL field from the API body.
  3. Check that the old column is empty or no longer read: grep readers in web-admin, cmx-api, mobile and HQ.
  4. Drop it in a new migration with `RESTRICT` (example: `0751`). Stop for the owner to apply it, and tell them to run `npm run prisma:pull` + generate + types **before** they run the app, because a stale client would select the dropped column.
- **When a record type is hard-deleted** anywhere (tenant cleanup, HQ cleanup), its files must be soft-deleted in the same work, or the bytes stay forever. Example: the 0758 HQ cleanup patch.

## 6. New category, purpose, source or ref type

| New | Code | Data (migration; owner applies) |
|---|---|---|
| Purpose in an existing category | Add to `FILE_PURPOSES` only if code uses it by value; add to HQ `APP_PURPOSES` if the app depends on it | `sys_file_purpose_cd` row (EN/AR name, `max_files`, `rec_order`, at most one `is_default` per category) + `sys_file_purpose_mime_dtl` links |
| Source (screen) | `FILE_SOURCES` | `sys_file_source_cd` row |
| Ref type (order sub-record) | `FILE_REF_TYPES` + a `case` in `assertRefOwned()` filtering `id`, `tenant_org_id`, `order_id` | `sys_file_ref_type_cd` row with `table_name` |
| Category | DEVELOPER_GUIDE §2 (constants, `FILE_CATEGORY_ACCESS`, `assertEntityOwned()` case with `tenant_org_id`, HQ `APP_CATEGORIES`) | category + purposes + type links |

- Migration number = last file in `supabase/migrations/` + 1 at write time.
- Comment every object.
- Write the file and **stop** for the owner; never apply it.
- The code rejects codes it does not know (zod enums), so add the constant and the data together.
- Purpose names come from the DB (`name` / `name2`), not i18n.

## 7. Access contract of the page

A page that uses File Util must list the File Util routes it calls in its `*-access.ts` `apiDependencies`, with the category's permission and `enforcement: 'external'`. Copy the block from `src/features/catalog/access/catalog-access.ts`:
- `GET /api/v1/file-util` and `/config` → the read code.
- `POST` / `PATCH` / `DELETE` → the write code.

Then run:
```bash
# from the repo root
npm run check:ui-access-contract -- --route=<route> --wire
npm run rebuild:platform-info-inventories   # drift must stay 0
```

## 8. Done means

- [ ] Codes are constants; `entityId` / `refType` / `refId` are correct; `readOnly` matches the server's write permission.
- [ ] The create flow uploads after save, reports failures, resets on close; the files are visible on the record afterwards.
- [ ] No storage, URL or upload code left in the screen or API; old routes and fields are removed when replaced.
- [ ] New UI text is in `messages/en` + `messages/ar` (`npm run check:i18n`); RTL checked; only Cmx components; feedback via `cmxMessage`.
- [ ] Access contract updated; inventories drift 0.
- [ ] Tests: the screen's existing test updated or one added (widget rendered with the right props / read-only without permission; the create flow calls `uploadFilesToRecord` only after save). Service changes go in `__tests__/services/file-util.service.test.ts`, including a wrong-tenant case.
- [ ] `npx tsc --noEmit`, `npx eslint . --quiet`, `npm run build` green in web-admin.
- [ ] Any migration written and stopped for the owner.
- [ ] `docs/features/File_Util/STATUS.md` log row added and `QA_TEST_GUIDE.md` steps added (page, what to click, expected), plus the owning feature's docs.
