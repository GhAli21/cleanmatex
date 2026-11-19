# File Util — QA Test Guide (owner-runnable)

**Covers:** Phase 4 (order photos and files), Phase 5 (product images, logo), Phase 6 (issue, assembly exception and customer files). Updated after each phase.
**Before you start:**
- Sign in to an organization that **has a subscription** (only 2 of the 4 demo organizations do). Without one, every upload shows "No active plan was found for this organization."
- Use a user with `orders:read` and `orders:update` for the edit tests, plus one with only `orders:read` for the read-only test.
- Have ready: a phone photo (JPEG), a PNG, a PDF, a `.docx`, an iPhone HEIC photo, a short MP4, and a file renamed to fake its type (e.g. a `.txt` renamed to `photo.jpg`).

## A. Order detail — Files tab

Sidebar **Orders** → open any order (`/dashboard/orders/<id>`) → tab **Files**.

| # | Do | Expect |
|---|---|---|
| A1 | Open the tab on an order with no files | "No files yet". A **File type** picker (default "Before processing"), a **Note** box, a drop zone and a **Take photo** button. |
| A2 | Drop the JPEG on the drop zone | A row shows Preparing → Uploading (progress bar) → Checking → Done; the photo appears in the grid with label "Before processing". |
| A3 | Choose File type **Damage**, type a note "Torn sleeve", pick the PNG | Tile shows "Damage" and the note. |
| A4 | Choose **Customer document**, upload the PDF and the `.docx` | Both appear with a document icon. |
| A5 | Choose **Item video**, upload the MP4 | Appears with a video icon. |
| A6 | Choose **Before processing**, upload the HEIC | Uploads. Chrome shows an icon instead of a preview (browsers can't display HEIC); Safari may show the image. |
| A7 | Upload the fake `photo.jpg` | Upload ends with "The file content does not match its type, so it was rejected." Nothing is added to the grid. |
| A8 | With **Before processing** selected, pick the PDF | Warning: not an allowed file type here (the drop zone checks before uploading). |
| A9 | Click a photo tile | Viewer opens full size. Arrow keys move between files; `+`/`-` zoom; clicking the image toggles 2×; **Download** saves it with its original name. |
| A10 | Open the PDF tile | Shows in the browser's PDF viewer. Open the `.docx` tile: "This file cannot be shown here", with Download. |
| A11 | Hover a tile → pencil; change File type to **Stain**, edit the note, Save | "File updated"; the tile label and note change. |
| A12 | Hover a tile → trash → confirm | "File deleted"; the tile disappears. |
| A13 | Use **Filter by file type** (top right, shown once files exist) | The grid shows only that type. |
| A14 | Click **Take photo** (phone or laptop camera) → Capture → Use photo | Photo uploads like A2. Retake shows the live camera again. Deny camera permission instead: "The camera is not available…". |
| A15 | Paste an image (Ctrl+V) while the drop zone is focused (Tab to it) | Uploads. Enter/Space on the focused drop zone opens the file picker. |
| A16 | Sign in as the read-only user, open the same tab | Files and viewer work; no picker, note, drop zone, camera, edit or delete. |
| A17 | Switch the app to Arabic | Labels in Arabic, layout mirrored; in the viewer the right arrow goes to the *previous* file. |
| A18 | Leave the tab open for more than 5 minutes, then open a file | Still opens (links refresh every 4 minutes). |

## B. New Order — photos saved with the order

Sidebar **Orders** → **New Order** (`/dashboard/orders/new`).

| # | Do | Expect |
|---|---|---|
| B1 | Next to **Add custom item** (or alone if you lack price-override), click **Photo** | Camera dialog opens. |
| B2 | Capture → Use photo, twice | The Photo button shows a badge **2**. |
| B3 | Add items and complete the order with payment | "Order … created", then "2 photos saved to the order". |
| B4 | Open the new order → **Files** | Both photos, File type "Before processing". |
| B5 | Take photos, then reset/cancel the new order without saving | Badge clears; nothing is uploaded. |
| B6 | Edit an existing order (Edit order), take a photo, save the edit | Photo is added to that order. |

## C. Product images and logo (Phase 5)

Apply `0750` first. Use a user with `products:update` and `settings:branding`.

| # | Where / do | Expect |
|---|---|---|
| C1 | Sidebar **Catalog** → Services → open a product (`/dashboard/catalog/services/<id>`) | Section **Product Image** with File type picker (Main image, Order image, Back side, Gallery), drop zone, camera. |
| C2 | Upload a JPEG as **Main image** | Appears in the grid; the small preview at the top of the image section shows it. |
| C3 | Open **Orders → New Order**, find that product | The product card shows the new image. |
| C4 | Back on the product, upload another **Main image** | It replaces the first one (only one Main image); New Order shows the new one. |
| C5 | Delete the Main image | Preview falls back to the icon; New Order card shows no image. |
| C6 | Upload a **Gallery** image, then change its type to **Main image** (pencil) | It becomes the product image (C3 shows it). |
| C7 | Sign in without `products:update` | Images visible, no upload, edit or delete. |
| C8 | New product (create mode) | No image section until the product is saved. |
| C9 | Sidebar **Settings → Branding** (`/dashboard/settings/branding`) → upload a PNG as **Logo** (not "Receipt logo") | Saved at once (no Save button needed). Reload: still there. Receipts and the customer app show it. |
| C10 | Change a brand color → **Save Changes** | Colors save; the logo is unchanged. |
| C11 | Try to upload an SVG or a PDF as logo | Refused before upload (type not allowed). |
| C12 | Supabase dashboard → Storage → `product-images` | After `0750`: bucket private; an upload attempt there is refused. Then delete the bucket. |

## D. Issues, assembly exceptions, customer files (Phase 6)

Apply `0751` first, then pull Prisma and regenerate types (the app fails on orders until you do).

| # | Where / do | Expect |
|---|---|---|
| D1 | Open an order → **Issues** → **Report issue** | The old "Photo URL" box is gone; a **Photos (optional)** drop zone and **Take photo** button are shown. |
| D2 | Add 2 photos, type a description, **Submit issue** | "Issue reported", then "2 photos saved to the order". |
| D3 | Same order → **Files** tab | Both photos, File type "Issue evidence". |
| D3b | Issues list → that issue → **Photos** | Dialog shows only this issue's photos; a user with `orders:transition` can add more there. |
| D4 | Try a PDF in the issue photos | Refused before upload (images only). |
| D5 | Remove one picked photo with the X before submitting | Only the remaining photo is saved. |
| D6 | Sign in as a user with `orders:transition` but **not** `orders:update`; report an issue with a photo | Photo saves. On the Files tab this user sees files without edit/delete. |
| D7 | Assembly (`/dashboard/assembly`) → open a task → **Record exception** → add a photo → submit | Exception recorded, then "1 photo saved to the order"; order Files tab shows it as "Assembly exception". |
| D8 | Sidebar **Customers** → open a customer → tab **Files** | Upload a photo (Photo), an ID document (PDF) under ID document; view, edit, delete. Without `customers:update`: view only. |
| D9 | Arabic | All new labels in Arabic, layout mirrored. |

## E. Delivery proof of delivery (task 6.4)

Needs an order out for delivery on a route with an active stop, and a user with `delivery:pod` + `orders:transition`.

| # | Where / do | Expect |
|---|---|---|
| E1 | Delivery screen → open the active stop → completion panel → method **Photo** → pick 2 photos → **Complete** | Delivery completes; stop shows Delivered. |
| E2 | Open the order → **Files** | The 2 photos, File type "Delivery proof", **no** edit/delete buttons (locked as proof). |
| E3 | Same order → delivery proof audit (order detail, proof of delivery section) | Both photos open (links valid ~5 minutes; reopen the audit for fresh links). |
| E4 | Method **Signature** with a signature image; then **Mixed** (signature + photo) on another stop | Each completes; the signature shows as "Signature" in Files, locked. |
| E5 | Pick photos, then cancel before completing | The uploaded photos stay in Files as normal (unlocked) delivery photos; they can be deleted. |
| E6 | Try to delete a locked delivery photo through any screen | Refused: "This file is proof of a completed record…". |
| E7 | HQ → Tenants → tenant → Maintenance → Delete Orders (dry run, then execute) on a test order with files | Succeeds; that order's files become deleted and the purge job removes their bytes. |

## F. HQ File Setup (`/file-util-config`, Phase 7.3–7.4)
Run in the HQ app (platform-web) as an operator with `file_util.manage` (TECH_ADMIN or SUPER_ADMIN). Sidebar: **Tenant Governance & Config → File Setup**.

| # | Where / do | Expect |
|---|---|---|
| F1 | Sidebar → **File Setup** | Hub with 7 cards (5 before 7.5b): Storage buckets, File categories, File purposes, Media kinds, File types, Storage usage, File health. EN and AR (RTL) both read correctly. |
| F2 | Card **Storage buckets** | List shows `TENANT_FILES` (tenants-cmx-files, private) and `TENANT_PUBLIC` (tenants-cmx-public, public). Both show no deactivate button (used by the app). |
| F3 | **New Storage bucket**: code `QA_TEST`, storage bucket id `qa-test-bucket`, owner HQ, not public, name "QA test" → **Create** | Saved. Supabase dashboard → Storage now lists `qa-test-bucket` (private). |
| F4 | New bucket again with storage id `QA_Test` | Refused under the id field: small letters, digits and dashes only. Nothing created in Storage. |
| F5 | New bucket with code `QA_TEST2` and the existing storage id `qa-test-bucket` | Refused: another bucket already uses this storage bucket id. No extra bucket in Storage. |
| F6 | **File categories** → New: code `QA_DOCS`, bucket `QA_TEST`, max size `1048576`, name "QA docs" → Create | Saved. |
| F7 | Open bucket `QA_TEST` → **Deactivate** | Refused: active categories still store files in this bucket (QA_DOCS). |
| F8 | **File purposes** → New: category `QA_DOCS`, code `MAIN`, default on → Create; then another purpose `EXTRA` in `QA_DOCS` with default on | First saves; second is refused under **Default**: this category already has a default purpose. |
| F9 | Open purpose `QA_DOCS / MAIN` → **Allowed file types**: tick PDF and JPEG → **Save file types** | "File types saved"; reopen the page, both stay ticked. SVG / HTML never appear in the list. |
| F10 | Open purpose `ORDER_FILE / DAMAGE` → Deactivate | Refused: used by the applications. |
| F11 | Sign in as an operator with only `*.view` (VIEWER) | Lists and forms open read-only; no Create / Save / Deactivate buttons. |
| F12 | HQ → audit logs, source `file-util-config` | One row per create / update / file-type change with before and after values. |
| Cleanup | Deactivate purpose `QA_DOCS/MAIN`, category `QA_DOCS`, then bucket `QA_TEST`; delete storage bucket `qa-test-bucket` in the Supabase dashboard | Done. |

### F-bis. Storage usage and File health (needs `0766` applied)

| # | Where / do | Expect |
|---|---|---|
| F13 | File Setup → **Storage usage** | All organizations, most used first; plan, used, plan limit ("Unlimited" for enterprise, "No active plan" when none), used % badge (green < 80, amber 80–99, red ≥ 100). Search by name works; paging works. |
| F14 | Click the chart button of an organization with files | Side panel lists every category with its size and file count. |
| F15 | File Setup → **File health** | KPIs for uploads in progress, pending over 25 h, deleted not purged, last bytes removed; cleanup jobs with file-util-expire On and its last run. |
| F16 | Same screen, Storage buckets | TENANT_FILES and TENANT_PUBLIC show "Storage bucket found"; a warning lists `delivery-pod-evidence` and `product-images` until you delete them in the dashboard. |
| F17 | Arabic UI on both screens | Right-to-left layout, sizes and dates readable, no English left. |

### F-ter. Media kinds, file types and size per type (7.5b; sidebar rows need `0767` applied)

Hub cards work without `0767`; the two sidebar child rows need it. Default kind limits (0765): Image / Text 10 MB, PDF / Document / Spreadsheet / Audio 20 MB, Presentation / Archive 50 MB, Video 100 MB. Upload limit = the smaller of (file type size, else its kind) and (purpose size, else category).

| # | Where / do | Expect |
|---|---|---|
| F18 | File Setup hub | 7 cards: Storage buckets, File categories, File purposes, **Media kinds**, **File types**, Storage usage, File health. Sidebar quick-find "Media" finds Media Kinds (after `0767`). |
| F19 | **Media kinds** → open IMAGE → empty the max size → Save | List shows 12 kinds with bytes (IMAGE 10485760, VIDEO 104857600). Save refused: size is required. |
| F20 | **File types** → filter Allowed = yes → open `image/jpeg` | URL `/file-util-config/mime-types/image%2Fjpeg`; the row opens; MIME type and Allowed are read-only; size empty (= kind limit). |
| F21 | HQ: set `image/jpeg` max size `1048576` → Save. Tenant app: order → **Files** → upload a 2–5 MB JPEG, then a 2 MB PDF | JPEG refused: "The file is larger than the 1 MB limit." PDF uploads. |
| F22 | HQ: clear the `image/jpeg` size, set kind IMAGE to `1048576`. Tenant: upload a 2 MB JPEG and a 2 MB PNG | Both refused (kind limit). Then restore IMAGE to `10485760`. |
| F23 | Switch kind VIDEO off; tenant: order Files purpose Item video | Video types no longer offered / refused. Switch VIDEO back on. |
| F24 | **File types** → New: `model/gltf-binary`, kind OTHER, preview any, extension `glb`, Allowed off, Active on → Create | Refused under Active: a blocked file type stays inactive. With Active off it saves. |
| F25 | Try a New type `text/html` with Allowed on | Refused (database never-allow rule); nothing saved. |
| F26 | Arabic UI on both screens | RTL; titles "أنواع الوسائط" / "أنواع الملفات". |
| Cleanup | Restore `image/jpeg` size to empty and IMAGE to 10485760; leave `model/gltf-binary` inactive | Done. |
| F27 | Open category `ORDER_FILE` → Max file size | A pick list: 512 KB, 1 MB, 2 MB, 5 MB, 10 MB … 1 GB, plus **Custom value…**. List screens show sizes as "10 MB", not bytes. Max files and Image max side also offer lists (1 … 100; 640 … 8192 px). |
| F28 | Pick **Custom value…**, type `7.5` → Save → reopen | The box says MB; "= 7.5 MB" shows under it; saved as 7.5 MB. Typing `2000` (over 1 GB) is refused. |
| F29 | Tenant: upload a 9 MB JPEG to an order (Before processing). HQ: set purpose ORDER_FILE / AFTER_IMAGE to 1 MB. Tenant: change that file's purpose to After processing | The move works and the file stays (limits only apply to new uploads). A new 9 MB upload to After processing is refused. Restore the purpose size afterwards. |

## H. File purge schedule in HQ (7.9; `0768` applied 2026-11-19; needs `platform-workers` deployed)

HQ app → **HQ Admin Console → Operations → Job Manager** (`/ops/jobs`), as an operator with `hq_ops:manage_jobs`.

| # | Where / do | Expect |
|---|---|---|
| H1 | Find **File Util: purge deleted file bytes** (module file_util) | Badge **HQ worker**; schedule `47 3 * * 0` ("every week on Sunday at 03:47 UTC"); Enabled; drift "In sync" within a minute of the worker starting. Before the worker runs: "Waiting for worker" and drift "Worker not reporting". |
| H2 | Pencil → **Common schedules** → "Every day at 03:00 UTC" → Save | Cron box shows `0 3 * * *`; saved; within about a minute the row shows no drift (worker applied it). Audit (clipboard icon) shows the change with you as actor. |
| H3 | Same dialog → type `99 * * * *` | Save disabled, "outside its allowed range". |
| H4 | Tenant app: delete a file on an order. HQ: **Run now** on the purge job → confirm | Dialog says the run is queued; result dialog "Queued". Within about a minute History shows a MANUAL run SUCCESS "Purged 1 deleted file(s) in 2 batch(es)"; File Setup → File health "Deleted, bytes not removed" goes to 0. |
| H5 | Press Run now twice quickly | Second is refused: a manual run is already waiting or running. |
| H6 | Disable the job, wait past a schedule slot (or set the schedule to the next minute first) | No SCHEDULE run appears; Run now still works. Enable again and restore `47 3 * * 0` ("Use default schedule"). |
| H7 | Stop the worker for 15+ minutes (owner, Render) | Row shows "Worker not reporting"; Run now still queues and runs when the worker is back. |
| H8 | Arabic UI | Badge "عامل المنصة", pick list and texts in Arabic, RTL. |

## G. Not testable yet

- Storage purge of deleted files runs in the HQ `platform-workers` job `file-util-purge` — needs that worker deployed.

## Financial_Expert_Tester Results

**Round 1 — 2026-11-19.** Tester: Financial_Expert_Tester (Grok Bot). Environment: remote only — tenant https://cmx.cleanmatex.com (Demo Laundry, admin; viewer for read-only checks) and HQ https://hqsaas.cleanmatex.com (SUPER_ADMIN, Incognito). Times are Asia/Muscat (UTC+4). Credentials: see the credentials file, none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\shots\` (names in Evidence).

### A. Order detail — Files tab

| # | Result | Evidence |
|---|---|---|
| A1 | PASS | Order Files tab with no files: "No files yet", File type default "Before processing", Note box, drop zone "Drop files here or click to choose", "Take photo" button. T01-order-files.png, T01-file-type-open.png |
| A2 | PASS | qa_photo.jpg: row Uploading… → Checking… → Done (+ "Clear finished"); tile "Before processing / qa_photo.jpg". "Preparing" too fast to see. A02.webp |
| A3 | PASS | Damage + note "Torn sleeve" + qa_image.png → tile "Damage / Torn sleeve". Tile appears a few seconds after the row says Done. |
| A4 | PASS | qa_doc.pdf and qa_doc.docx as Customer document: both Done, document icons. A04.webp |
| A5 | PASS | Item video: hint "Up to 50.0 MB per file", no Take photo button for this type; qa_video.mp4 Done, tile with a video icon. |
| A6 | FAIL | qa_photo.heic (526 bytes, valid ftyp "heic" header): row ends "The file name extension does not match the file. Rename it and try again." No tile. Test file is tiny, so a real iPhone HEIC should be retried (see FET-FU-Nov19-HeicRejected). DB shows image/heic and image/heif are active for the purpose. |
| A7 | PASS | photo_fake.jpg: "The file content does not match its type, so it was rejected." Nothing added to the grid. |
| A8 | PASS | Before processing + qa_doc.pdf: amber toast ""qa_doc.pdf" is not an allowed file type here." before any upload. A08.webp |
| A9 | PASS | JPEG tile opens the viewer "qa_photo.jpg · Before processing · 1 of 5" (fits the modal, not true full size); Right arrow moves 1→2→3→4; `+` zooms, `-` returns; clicking the image toggles zoom; Download saved qa_photo.jpg (8914 bytes, same as the original). After clicking the image to zoom, Right arrow no longer navigated (had to click ">"). A09_jpg.webp |
| A10 | PARTIAL | DOCX: "This file cannot be shown here. Download it to open it." + Download (PASS). PDF: opens in Chrome's PDF viewer inside the modal, but the page area looks small and mostly blank grey. A10_pdf.webp, A10_docx.webp, A10_video.webp |
| A11 | PASS | Pencil → "Edit file" dialog; File type Stain + note "QA edited" → toast "File updated"; tile shows "Stain / QA edited" after 2–5 s. |
| A12 | PASS | Trash → "Delete file? Delete "image.png"? This cannot be undone." Cancel/Delete; Tab stays inside, Escape closes, nothing deleted; Delete → toast "File deleted". All 6 QA files removed; grid "No files yet". |
| A13 | PASS | Filter by file type: Damage, Stain, Customer document each show only that type; reset to "All file types". |
| A14 | PARTIAL | Take photo → "Take a photo" dialog: "The camera is not available. Allow camera access in the browser, or choose a file instead." Capture is disabled. Capture / Use photo / Retake not testable (no camera on the box). |
| A15 | PASS | Drop zone is a focusable button; Enter opens the file chooser; Ctrl+V of an image uploads "image.png" → Done → tile "Before processing / image.png". |
| A16 | PARTIAL | Viewer (read-only): Files tab shows "No files yet" with no type picker, note, drop zone, Take photo, file input, edit or delete. The Files tab was empty, so viewing files and the viewer could not be exercised. P710_viewer_order_files.webp |
| A17 | PASS | Arabic: drop zone "أفلت الملفات هنا أو انقر للاختيار", "التقاط صورة", error texts translated; in the viewer Left arrow → next, Right arrow → previous. Minor: grid fills left-to-right; odd bidi in the size hint "10.0 MB حتى". A17_ar_files.webp, A17_ar_viewer.webp |
| A18 | NOT RUN | Needs the tab idle for over 5 minutes; not run. |

### B. New Order — photos saved with the order

| # | Result | Evidence |
|---|---|---|
| B1 | PASS | New Order: Photo button next to + Custom item opens "Take a photo" with "The camera is not available…". T11-new-order.png, T11-photo-dialog.png |
| B2 | BLOCKED | No camera on the box, so the badge 2 cannot be reached. |
| B3 | BLOCKED | Needs photos (no camera) and a paid order; creating a new order was not in the approved writes. |
| B4 | BLOCKED | Depends on B3. |
| B5 | BLOCKED | No camera on the box, so no photos to reset. |
| B6 | BLOCKED | Needs a camera photo on Edit order; not possible here. |

### C. Product images and logo

| # | Result | Evidence |
|---|---|---|
| C1 | PASS | Sweatpants (SWEATPANTS): "Product Image" section with File type Main image / Order image / Back side / Gallery, note box, drop zone "Up to 5.0 MB per file", Take photo. A separate "Image & Icon" card also exists. |
| C2 | PASS | qa_photo.jpg as Main image: Done; grid "Main image / qa_photo.jpg"; the preview in the Image & Icon card shows it. |
| C3 | PASS | New Order → Sweatpants card shows the uploaded image instead of the icon. |
| C4 | PASS | Second Main image replaced the first (only one Main image after reload); New Order shows the new red image. |
| C5 | PASS | Delete ("Delete file?" … toast "File deleted"): New Order card falls back to the icon. The preview tile in the Image & Icon card keeps the deleted image until reload (P3). |
| C6 | PARTIAL | Gallery image → pencil → Main image while a Main exists: toast "The maximum number of files is reached. Delete one first." After deleting the Main, the same edit worked ("File updated"; New Order shows it). |
| C7 | PARTIAL | Viewer: product page is denied: "Access not granted — You need the admin:manage permission to view Catalog & Pricing. Ask your tenant admin to grant it." The viewer menu has no Services, so images cannot be seen there. P711_viewer_catalog_denied.webp |
| C8 | PASS | /dashboard/catalog/services/new: no Product Image section; form has Image & Icon (emoji). It flashes "Access not granted — You need the admin:manage permission…" before rendering (P3). |
| C9 | FAIL | Logos card: "The request was not valid." + Retry (also after reload and Retry); uploading qa_logo.png as Logo: "qa_logo.png — The request was not valid." Nothing saved. T06-branding.png |
| C10 | BLOCKED | Branding page has no colour inputs or "Save Changes"; colours moved into Themes (PR-07). Cannot run as written, and the logo part is blocked by C9. |
| C11 | PARTIAL | PDF as logo: toast ""qa_doc.pdf" is not an allowed file type here." before upload. SVG not tried. |
| C12 | NOT RUN | Supabase dashboard not accessible to this run. HQ File health lists `product-images` and `delivery-pod-evidence` as unused buckets (see F16). |

### D. Issues, assembly exceptions, customer files

| # | Result | Evidence |
|---|---|---|
| D1 | BLOCKED | Order tabs (exact): Financial Summary, Order Master Data, Items & Pieces, Preferences, Financial Details, Payments & Credits, Invoices / Tax, Receipt Vouchers, Status & Lifecycle, Order History, Delivery Proof, Files, Edit History, Change History, Debug, Actions. No Issues tab or Report issue control. D01_order_tabs_no_issues.webp, D01b_issues_page.webp |
| D2 | BLOCKED | No Report issue control. |
| D3 | BLOCKED | No issue could be reported. |
| D3b | BLOCKED | /dashboard/issues ("Order Issues") shows 0 open / 0 total and no Report button. |
| D4 | BLOCKED | No Report issue control. |
| D5 | BLOCKED | No Report issue control. |
| D6 | BLOCKED | No Report issue control (and no `orders:transition`-only user). |
| D7 | BLOCKED | /dashboard/assembly: Pending 0, In Progress 0, QA Pending 0, Completed Today 0, Open Exceptions 0, "No orders in assembly". |
| D8 | PASS | Customer Files tab: types Profile photo / ID document / Other; "Up to 2.0 MB" vs "Up to 10.0 MB"; uploaded photo and PDF (Done), viewer "Profile photo · 2 of 2", edit to "QA edited", delete → "File deleted", ends "No files yet". Viewer account: Files tab shows "No files yet" with no controls (empty state). D08_customer_files_en.webp, P712_viewer_customer_files.webp |
| D9 | PARTIAL | Customer Files tab in Arabic is translated and mirrored with no sidebar overlap. Issue and assembly screens could not be seen. D09_customer_files_ar.webp |

### E. Delivery proof of delivery

| # | Result | Evidence |
|---|---|---|
| E1 | NOT RUN | Needs an order out for delivery on a route with an active stop and a `delivery:pod` user; none available, and no delivery was run. |
| E2 | NOT RUN | Needs an order out for delivery on a route with an active stop and a `delivery:pod` user; none available, and no delivery was run. |
| E3 | NOT RUN | Needs an order out for delivery on a route with an active stop and a `delivery:pod` user; none available, and no delivery was run. |
| E4 | NOT RUN | Needs an order out for delivery on a route with an active stop and a `delivery:pod` user; none available, and no delivery was run. |
| E5 | NOT RUN | Needs an order out for delivery on a route with an active stop and a `delivery:pod` user; none available, and no delivery was run. |
| E6 | NOT RUN | Needs an order out for delivery on a route with an active stop and a `delivery:pod` user; none available, and no delivery was run. |
| E7 | PARTIAL | HQ → Tenants → Demo Laundry → Maintenance → Delete Orders, mode SPECIFIC ORDERS, only ORD-20261117-00003 (had 1 uploaded file): dry run "1 order(s) would be targeted" (org_orders_mst 1, org_order_items_dtl 3, org_domain_events_outbox 2); Delete confirm "Delete tenant orders?" → toast "1 order(s) deleted". Tenant Total Orders 8 → 7. Read-only DB: its ORDER_FILE / BEFORE_IMAGE file row is DELETED at 2026-11-19 03:17:14 +04. Byte purge not re-checked. The result text says "Remaining orders: 0" though 7 remain. F00_E7_tenant_upload.png, F_E7_dryrun.webp, F_E7_deleted.webp |

### F. HQ File Setup and F-bis

| # | Result | Evidence |
|---|---|---|
| F1 | PASS | /file-util-config hub: 5 cards — Storage buckets, File categories, File purposes (SETUP), Storage usage, File health (MONITORING). AR also checked (F17). |
| F2 | PASS | TENANT_FILES / tenants-cmx-files (Public No) and TENANT_PUBLIC / tenants-cmx-public (Public Yes); rows only have an Edit action; "Showing 1 to 2 of 2". Deactivate on their edit pages not opened. |
| F3 | PASS | QA_TEST / qa-test-bucket created: toast "Storage bucket created" → /buckets/QA_TEST. F16 shows "Storage bucket found" for qa-test-bucket. Private flag in Supabase not checked. F03_bucket_created.webp |
| F4 | PASS | Storage id "QA_Test": under the field "This value does not have the required format"; toast "Use 3–63 small letters, digits and dashes, starting with a letter or digit". Not saved. F04_bad_id.webp |
| F5 | PASS | QA_TEST2 + qa-test-bucket: toast "Another bucket already uses this storage bucket id"; under the field "Another entry already uses this value". Not saved. F05_dup_id.webp |
| F6 | PASS | QA_DOCS (bucket QA_TEST, max 1048576, "QA docs"): toast "File category created". F06_category_created.webp |
| F7 | PASS | Deactivate QA_TEST → dialog "Deactivate “QA test”?" → red toast "Active categories still store files in this bucket: QA_DOCS. Move or switch them off first." Bucket stays Active. F07_bucket_deactivate_refused.webp |
| F8 | PASS | MAIN (default on) created: toast "File purpose created". EXTRA (default on): toast "This category already has a default purpose; turn that one off first". Not saved. The refusal is shown as a toast; no text under Default was seen (the page was not scrolled). Name is required, so "QA main" / "QA extra" were used. F08a_main_created.webp, F08b_extra_refused.webp |
| F9 | PARTIAL | Ticked JPEG and PDF → Save file types. The "File types saved" toast was not caught. After reload: "2 types allowed.", exactly 2 ticked; SVG and HTML never listed. F09_after_save_filetypes.webp |
| F10 | NOT RUN | Opened ORDER_FILE / DAMAGE → Deactivate, saw the dialog "Deactivate “Damage”?" and pressed Cancel on purpose (a refusal that might not trigger could deactivate a live purpose). The refusal text is unverified. F10_damage_confirm_dialog.webp |
| F11 | NOT RUN | No HQ viewer (`*.view` only) account available. |
| F12 | PASS | No "source" filter in Platform Audit & Forensics; searching "file_util_config" (Source Module file-util-config) gave 4 rows: #894 buckets.created, #895 categories.created, #896 purposes.created, #897 purposes.mime_types_updated (State Diff mime_types [] → ["application/pdf","image/jpeg"]). Refused attempts left no rows. F12_audit.webp |
| F13 | PASS | Storage usage: 5 organizations, columns ORGANIZATION / PLAN / USED / PLAN LIMIT / USED % / FILES / WAITING FOR PURGE; Demo Laundry LLC ENTERPRISE 9.5 KB "Unlimited"; "No active plan" rows; FREE_TRIAL 100 MB "0%". Search "blue" → BlueWave Laundry Co. Only one page, so paging was not exercised. F13_storage_usage.webp |
| F14 | PASS | Chart button for Demo Laundry LLC: panel lists Order files 9.5 KB / 1 file, Customer files, Product images, Organization logo, QA docs (0 B, No files). |
| F15 | PASS | File health: "No problems found"; UPLOADS IN PROGRESS 0; PENDING OVER 25 H 0; DELETED, BYTES NOT REMOVED 0; LAST BYTES REMOVED Nov 19, 2026, 2:47 AM; file-util-expire hourly On, last run 2:17 AM succeeded. |
| F16 | PASS | TENANT_FILES, TENANT_PUBLIC and QA_TEST show "Storage bucket found"; warning lists "delivery-pod-evidence, product-images". |
| F17 | PASS | Via /ar/ URLs (not the switch button): RTL, mirrored, hub and both screens Arabic. English left: plan codes, job names, "succeeded", my QA docs name, bucket names. F17_ar_storage_usage.webp (taken while loading). |
| Cleanup | PARTIAL | Deactivated QA_DOCS/MAIN, QA_DOCS, then QA_TEST (toasts "Deactivated"). Supabase bucket qa-test-bucket NOT deleted (no dashboard access); owner to delete. F_cleanup_purpose_inactive.webp, F_cleanup_category_inactive.webp, F_cleanup_bucket_inactive.webp |

### G. Not testable yet

| # | Result | Evidence |
|---|---|---|
| G | NOT RUN | Informational. HQ File health shows "LAST BYTES REMOVED … By the platform-workers purge job", so the purge worker appears deployed; not tested further. |

### Findings (Financial_Expert_Tester, 2026-11-19)

- **P1 FET-FU-Nov19-HeicRejected** — A .heic file with a valid `ftyp heic` header is refused with "The file name extension does not match the file. Rename it and try again." (A6) though image/heic and image/heif are active for the purpose. Caveat: the test file is 526 bytes; retry with a real iPhone photo. Likely cause: Chrome gives an empty MIME for .heic. Fix: infer the type from the extension and magic bytes when the browser type is empty.
- **P1 FET-FU-Nov19-TenantLogoInvalidRequest** — Logo list and upload fail with "The request was not valid." (C9, C10); no logo can be saved. Evidence: T06-branding.png. DB: no TENANT_LOGO rows; TENANT_LOGO category max_files_per_entity=2 against 4 purposes (MAIN, RECEIPT, DARK, FAVICON) (P2 config conflict). Fix: see FET-UIDS-Nov19-TenantLogoInvalidRequest.
- **P1 FET-FU-Nov19-IssuesUiMissing** — The order has no Issues tab or Report issue control and `/dashboard/issues` has no Report button, so D1–D6 cannot be run and issue photos cannot be reached. Evidence: D01_order_tabs_no_issues.webp, D01b_issues_page.webp. Fix: surface the Issues tab / Report issue (confirm the 0751 UI is deployed and the permission gate).
- **P1 FET-FU-Nov19-ProcessingPermissionDenied** — `/dashboard/processing` fails with "permission denied for table sys_order_sources_cd". Evidence: PR02-4-processing.png. Fix: grant SELECT on `sys_order_sources_cd`.
- **P2 FET-FU-Nov19-ProductPageAccessFlash** — Opening a catalog product by direct URL briefly shows "Access not granted — You need the admin:manage permission…" for the admin before the form renders; for the viewer it stays denied. A red banner "Invalid option: expected one of "piece"|"kg"|"item"" showed under Unit on the product edit page at times (Update not clicked). Fix: resolve permissions before rendering and align the unit options.
- **P2 FET-FU-Nov19-OrderFilesTabMissingInFullView** — "View full details" has no Files tab; Files only opens from All Orders → View. A user following the guide's `/dashboard/orders/<id>` path may miss it.
- **P2 FET-FU-Nov19-AssemblyNoData** — Assembly has no orders (all counts 0), so D7 cannot be run; no assembly fixture exists. Fix: seed one QA order in assembly.
- **P2 FET-FU-Nov19-ViewerCatalogDenied** — A viewer cannot open a product at all, so C7 (images visible, no upload) cannot be seen. Evidence: P711_viewer_catalog_denied.webp.
- **P3 FET-FU-Nov19-FileListLag** — After upload, edit or delete the grid lags 2–5 s (order Files tab "No files yet" until reload after an upload in E7; product Image & Icon preview stays on a deleted image until reload). Evidence: F00_E7_tenant_upload.png.
- **P3 FET-FU-Nov19-ViewerKeyboardAfterZoom** — Clicking the image to zoom in the viewer drops keyboard focus, so arrow keys stop navigating until ">" is clicked; modal size jumps per file type; PDF page area renders tiny/blank in the narrow modal. Evidence: A09_jpg.webp, A10_pdf.webp.
- **P3 FET-FU-Nov19-MaintenanceRemainingCountWrong** — After deleting one order, HQ Maintenance says "Deleted 1 order(s). Remaining orders: 0." while the tenant still has 7. Evidence: F_E7_deleted.webp. Fix: show the tenant's real remaining count or drop the line. Also: the dry run does not list file rows that the delete will mark deleted (F_E7_dryrun.webp).
- **P3 FET-FU-Nov19-FileSetupRefusalAsToast** — F8 duplicate-default refusal and F7 deactivate refusal appear only as toasts; the File types saved toast (F9) is fleeting. F10 refusal only after confirming. Evidence: F08b_extra_refused.webp.
- **P3 FET-FU-Nov19-GuideStaleBranding** — Guide C10 (brand colours + Save Changes on the logo page) no longer matches the app after PR-07 (colours are in Themes).
- **P3 FET-FU-Nov19-ArabicFileUiBidi** — Arabic Files tab: grid fills left to right, size hint "10.0 MB حتى" reads oddly, a stale English "Before processing" flashes in the type select. Evidence: A17_ar_files.webp.
- **P3 FET-FU-Nov19-ArabicFileSetupLeftovers** — HQ File Setup in Arabic still shows English plan codes, job names, "succeeded", and an English-only QA category name. Evidence: F17_ar_storage_usage.webp.

### Recount, caveats and test data

**Recount (File Util, 72 rows):** PASS 35 / FAIL 2 / PARTIAL 10 / BLOCKED 14 / NOT RUN 11 (total 72). By section: A PASS 13 / FAIL 1 / PARTIAL 3 / BLOCKED 0 / NOT RUN 1 (total 18); B PASS 1 / FAIL 0 / PARTIAL 0 / BLOCKED 5 / NOT RUN 0 (total 6); C PASS 6 / FAIL 1 / PARTIAL 3 / BLOCKED 1 / NOT RUN 1 (total 12); D PASS 1 / FAIL 0 / PARTIAL 1 / BLOCKED 8 / NOT RUN 0 (total 10); E PASS 0 / FAIL 0 / PARTIAL 1 / BLOCKED 0 / NOT RUN 6 (total 7); F PASS 14 / FAIL 0 / PARTIAL 2 / BLOCKED 0 / NOT RUN 2 (total 18); G PASS 0 / FAIL 0 / PARTIAL 0 / BLOCKED 0 / NOT RUN 1 (total 1).

**Caveats:** some uploads and text fills used the browser tool's `setInputFiles` / `fill` fallback (the native file dialog did not appear on the box; xdotool typing dropped characters); delete confirms, saves and the E7 delete used real mouse clicks. HQ section F ran through browser-tool actions rather than real mouse input except where noted. No camera on the box (A14, B2–B6). No HQ viewer account (F11). A read-only viewer was used for A16, C7, D8. F3 and F16 rely on the HQ screens, not the Supabase dashboard.

**Test data left behind (File Util):**
- HQ: bucket QA_TEST, category QA_DOCS and purpose QA_DOCS/MAIN exist and are Inactive (not deleted; the HQ screens only deactivate). Audit rows #894–#897 and the deactivations remain.
- Supabase: bucket `qa-test-bucket` still exists — owner to delete in the Supabase dashboard.
- Demo Laundry: ORD-20261117-00003 was deleted through HQ Maintenance (approved; its file row is DELETED). All other QA files (orders, product Sweatpants, customer "Jh Test dev21") are deleted; failed-upload rows (HEIC, fake JPG) were never stored.
- Demo Laundry theme Ocean is still in use (see the UI Design System guide).
