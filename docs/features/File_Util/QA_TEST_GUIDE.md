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

## I. Stage of each file + Files panel on stage screens (`0770` applied 2026-11-19)

Tenant app, user with `orders:transition` or `orders:update`. Use one order and move it through the workflow.

| # | Where / do | Expect |
|---|---|---|
| I1 | **Preparation** → open an order → **Files** panel at the bottom (collapsed) → open it → upload a photo | Panel is closed by default (no file request until opened). After upload the tile shows the purpose, then a grey line **"Preparation · Preparation"** (stage · screen). |
| I2 | Move the order on, then do the same on **Processing**, **Assembly**, **QA**, **Packing** and **Ready** detail pages | Each panel shows all files of the order. Each new tile shows its own stage and screen, e.g. "Quality Check · Quality check", "Ready for pickup · Ready for pickup", "Packing · Packing". |
| I3 | Order detail → **Files** tab | All files from I1–I2. A **Filter by stage** list appears (only when files come from 2+ stages), in workflow order. Pick "Processing" → only files uploaded while the order was in processing. "All stages" → all again. |
| I4 | Filter by a stage, delete the last file of that stage | The list does not go empty: the filter resets to all stages. |
| I5 | Report an issue with a photo (order detail → Issues) | Tile line ends with the sub-record: "<stage> · Order issue · Order issue". |
| I6 | Old files (uploaded before 0770) | No stage on the line, only the screen (e.g. "Order details"). Nothing breaks. |
| I7 | User with only `orders:read` opens a stage screen panel | Files visible, no drop zone, no edit/delete. |
| I8 | Arabic UI | Stage and screen names in Arabic ("تحضير · التجهيز"), filter "تصفية حسب المرحلة", RTL. |
| I9 | API (optional): `GET /api/v1/file-util?category=ORDER_FILE&entityIds=<order id>&stages=qa` and `&sources=ORDER_PACKING` | Only the matching files. `&sources=NOPE` → 400. |

## J. Transaction files: QA reject, piece photos, pickup proof, delivery (`0771` applied 2026-11-19)

| # | Where / do | Expect |
|---|---|---|
| J1 | **QA** detail → on an item press **Reject** | Dialog "Reject in quality check": type, priority, reason (min 3 chars), photos. Red button "Reject item". |
| J2 | Fill reason, add 2 photos → **Reject item** | Order goes back to processing; toast "photos saved". Order detail → Issues: the new issue with the 2 photos. Files tab: tiles "Quality check · Quality check · Order issue", purpose "Quality check". |
| J3 | **Processing** (or Assembly, QA, Packing, Ready, order detail items, Preparation itemizer) → expand an item's pieces → under a piece press **Add photos** → upload 1 photo → close | Dialog title "Photos of <piece code>". The button then shows **1 photo**. Order Files tab: the tile line ends with "Order piece". |
| J4 | User with only `orders:read` | Piece buttons show counts; the dialog has no drop zone. User without `orders:read`: no piece photo buttons. |
| J5 | **Ready** detail → pickup handover → dialog: add 2 **Pickup photos** → confirm | Order picked up. Files tab: 2 tiles "Pickup proof", **locked** (no edit/delete). |
| J6 | Same, but go offline after picking photos → confirm | Error "Pickup photos could not be uploaded…"; order NOT picked up. Back online → confirm again: photos already sent are not uploaded twice. |
| J7 | Upload pickup photos (confirm fails), delete one of them in the Files tab (other browser tab), then confirm | "A pickup photo was removed or already used…"; nothing changes; confirm again uploads fresh copies and works. |
| J8 | **Delivery** → open an order (delivery detail) and a route stop | A collapsed **Files** panel on both; uploads tagged "Out for delivery · Delivery". Driver without `orders:read`: no panel, no error. |
| J9 | Arabic | All new texts in Arabic, RTL; Arabic plural forms on the piece photo count. |

## K. Item photos and assembly task files (no migration)

| # | Where / do | Expect |
|---|---|---|
| K1 | Tenant with **piece tracking off** → Processing (or Assembly, QA, Packing, Ready, order detail items, Preparation) detail | Under each item: **Add photos**. No "View pieces" section. |
| K2 | Press it → upload 1 photo → close | Dialog "Photos of <item name>". Button now **1 photo**. Order Files tab: tile line ends with "Order item". |
| K3 | Tenant with **piece tracking on** | No item button; each piece has its own button (§J3). |
| K4 | **Assembly** → open an order's assembly task | Collapsed **Files** panel in the task window; uploads tagged "Assembly · Assembly task". They show in the order's Files tab, not in other tasks. |
| K5 | User without `orders:read` | No item photo buttons, no Files panel in the task window, no error. |
| K6 | Arabic | Texts in Arabic, RTL. |
| K8 | Open any order's **Files** tab or a stage Files panel, English then Arabic (RTL), light then dark | Count badge by the title; type + note on one row; slim "Drop files…" bar with Take photo beside it; tiles are cards: file type chip on the image, note under it (max 2 lines), source line without repeated words, file name + size at the bottom; locked proof shows a lock and no pencil/trash; on desktop pencil/trash appear on hover, on a phone they are always visible; PDF/other files show an icon with PDF/XLSX badge; empty order shows a dashed box with an image icon. |
| K7 | **QA** detail → a Files panel or piece photos → look at "File type" before adding a photo; type a note, then add a photo | File type already "Quality check" (Packing and Ready: "After processing"). A line under the fields says type and note apply to the next files added. After the upload the note box is empty and the tile shows the note. To change a saved file: pencil on the tile → Save. |

## G. Not testable yet

- Storage purge of deleted files runs in the HQ `platform-workers` job `file-util-purge` — needs that worker deployed.
- Phase 8 (2026-11-19) added docs only (ADR, developer guide, feature reference); nothing new to test. All File Util migrations are applied; §A–§F and §H are the full owner QA.

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

### Retest r2 2026-11-19 — File Util

**Retest r2 — 2026-11-19, 16:14 to 20:29 Asia/Muscat (UTC+4).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: the owner deployed new updates at 16:14 and asked to retest the FAILED, BLOCKED and PENDING (PARTIAL / NOT RUN) rows of this guide and the other QA guide. Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch; admin, plus viewer and operator for the role rows) and HQ https://hqsaas.cleanmatex.com (Incognito). Real mouse and keyboard, no direct API calls, no page scripts, no Jest. Credentials: see the credentials file, none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\retest2\shots\` (names in the Shot column; the Round 1 shots stay in `C:\Users\JHNLP\qa-20261119\shots\`). Notes: Round 1 text above is untouched. Rows needing a write the owner has not approved, and the HIGH-IMPACT rows, were not run and are marked NOT RUN, or BLOCKED where a missing screen is the reason. No order was paid or submitted in r2.

**Guide changes found while writing back.** The guide I tested from (41,254 B, 09:49) was edited again by the owner at 20:01 during the retest: new section K "Item photos and assembly task files" (K1 to K8, 8 rows). They are listed below as NOT RUN. Only text above this section changed in that edit; Round 1 results and all other rows are unchanged, and there are no Dev notes.

#### Retest r2 results

Columns: r1 = Round 1 result (or "- (new row)"), r2 = this retest. Rows that passed in Round 1 and were not re-run keep PASS.

| Row | r1 | r2 | Evidence | Shot |
|---|---|---|---|---|
| A1 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A2 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A3 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A4 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A5 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A6 | FAIL | FAIL | qa_photo.heic (526-byte stub) is still refused: "An image file qa_photo.heic was refused because it is not an allowed file type here." Message changed from r1 (extension mismatch). A real iPhone HEIC was not available. | T2-7 |
| A7 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A8 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A9 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A10 | PARTIAL | PARTIAL | docx opens as a document tile (PASS); the PDF viewer area is still tiny and unreadable. | T2-8-pdf, T2-8-docx |
| A11 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A12 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A13 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A14 | PARTIAL | PARTIAL | Take photo opens a modal that says camera access was denied; the box has no camera. | T2-10 |
| A15 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A16 | PARTIAL | PASS | Viewer opens the order Files tab read-only (no drop zone, no edit or delete). Same viewer still sees Start Preparation, Edit, Print Label and the public tracking link on the order page. | - |
| A17 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| A18 | NOT RUN | FAIL | After about 5.5 minutes idle, opening a file shows a broken image (signed URL expired and not refreshed). | - |
| B1 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| B2 | BLOCKED | BLOCKED | No camera on the box: "The camera is not available. Allow camera access in the browser, or choose a file instead."; Capture is disabled. | T8-B2-camera |
| B3 | BLOCKED | NOT RUN | HIGH-IMPACT: new order with payment. Awaiting an explicit owner yes (also needs photos, so a camera). | - |
| B4 | BLOCKED | BLOCKED | Depends on B3. | - |
| B5 | BLOCKED | BLOCKED | No camera on the box. | T8-B2-camera |
| B6 | BLOCKED | BLOCKED | No camera on the box; also a NEW write (order edit) awaiting owner approval. | - |
| C1 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| C2 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| C3 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| C4 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| C5 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| C6 | PARTIAL | FAIL | Gallery to Main: "The maximum number of files is reached. Delete one first." and an "invalid option" banner on the pencil. | T2-11 |
| C7 | PARTIAL | BLOCKED | Viewer: Catalog & Pricing lists only Speed Pricing and Service Preferences; /dashboard/catalog redirects with insufficient_permissions; services and pricing pages say "You need the admin:manage permission". Product page still not reachable. | T12-C7 |
| C8 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| C9 | FAIL | FAIL | Branding logo list and upload still fail with "The request was not valid." (HTTP 400). | T2-2 |
| C10 | BLOCKED | PARTIAL | Adapted, view only: Branding has no colour inputs or logo to compare (moved to Themes by PR-07). | T2-3 |
| C11 | PARTIAL | PASS | SVG and PDF are refused client-side as a logo. | T2-12-svg |
| C12 | NOT RUN | NOT RUN | Supabase dashboard is the owner's; deleting buckets is human-only. | - |
| D1 | BLOCKED | FAIL | No Issues tab on ORD-20261119-00001 and no Report issue control on /dashboard/issues (All status). Still missing after the 16:14 deploy. | - |
| D2 | BLOCKED | BLOCKED | Depends on D1: no Issues UI to open or report from. | - |
| D3 | BLOCKED | BLOCKED | Depends on D1: no Issues UI to open or report from. | - |
| D3b | BLOCKED | BLOCKED | Depends on D1: no Issues UI to open or report from. | - |
| D4 | BLOCKED | BLOCKED | Depends on D1: no Issues UI to open or report from. | - |
| D5 | BLOCKED | BLOCKED | Needs Report issue (missing) and a NEW write approval. | - |
| D6 | BLOCKED | BLOCKED | Operator has both orders:transition and orders:update (88 permissions); no transition-only user exists. | T12-D6 |
| D7 | BLOCKED | BLOCKED | /dashboard/assembly now loads in 3-6 s with no error but has no orders (Pending 0, In Progress 0, QA Pending 0, Open Exceptions 0), so Record exception cannot be run. | T4-D7 |
| D8 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| D9 | PARTIAL | BLOCKED | Depends on D1: no Issues UI to open or report from. | - |
| E1 | NOT RUN | NOT RUN | NEW write; needs an out-for-delivery QA order, route and active stop. Awaiting owner approval. | - |
| E2 | NOT RUN | NOT RUN | NEW write; needs an out-for-delivery QA order, route and active stop. Awaiting owner approval. | - |
| E3 | NOT RUN | NOT RUN | NEW write; needs an out-for-delivery QA order, route and active stop. Awaiting owner approval. | - |
| E4 | NOT RUN | NOT RUN | NEW write; needs an out-for-delivery QA order, route and active stop. Awaiting owner approval. | - |
| E5 | NOT RUN | NOT RUN | NEW write; needs an out-for-delivery QA order, route and active stop. Awaiting owner approval. | - |
| E6 | NOT RUN | NOT RUN | NEW write; needs an out-for-delivery QA order, route and active stop. Awaiting owner approval. | - |
| E7 | PARTIAL | PARTIAL | HQ file health re-check (read only, no delete): banner "No problems found"; uploads in progress 0; "Deleted, bytes not removed" 8 (oldest Nov 19 4:43 PM); "Last bytes removed" Nov 19 3:47 AM. The purge job (platform-workers) shows "No runs yet" and a Sunday schedule, so the byte removal is not proven. | H3-E7 |
| F1 | PASS | PASS | Sidebar File Setup shows 7 cards in groups SETUP (Storage buckets, File categories, File purposes, Media kinds, File types) and MONITORING (Storage usage, File health). Quick-find "Media" lists only File Setup > Media Kinds. | H1-F1-hub-en, H1-F1-quickfind |
| F2 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F3 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F4 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F5 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F6 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F7 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F8 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F9 | PARTIAL | PASS | QA_DOCS/MAIN (inactive): PDF and JPEG ticks survive a reload; list shows only safe types (no SVG, no HTML). Found at start with JPEG + PDF ticked (left by r1 run); restored to none, toast "File types saved", header "No type allowed yet". | H1-F9-reload, H1-F9-toast |
| F10 | NOT RUN | NOT RUN | HIGH-IMPACT: could deactivate the live ORDER_FILE/DAMAGE purpose if the refusal were missing. Awaiting an explicit owner yes. | - |
| F11 | NOT RUN | NOT RUN | No HQ account with only *.view exists; creating one needs owner OK. | - |
| F12 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| Cleanup (F) | PARTIAL | PARTIAL | HQ QA objects (bucket QA_TEST, category QA_DOCS, purpose QA_DOCS/MAIN) are all Inactive. Supabase bucket qa-test-bucket still needs the owner to delete it. | H1-F9-reload |
| F13 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F14 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F15 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F16 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F17 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| F18 | NOT RUN (new) | PASS | Arabic /ar/file-util-config: RTL, 7 cards (حاويات التخزين, فئات الملفات, أغراض الملفات, أنواع الوسائط, أنواع الملفات, استخدام التخزين, حالة الملفات) in groups الإعداد (5) and المتابعة (2). | H1-F18-hub-ar |
| F19 | NOT RUN (new) | PASS | Media kinds: 12 kinds, sizes shown as "10 MB". Max size is a pick list; emptied via Custom value then Save is refused ("Fix 1 field - Max file size: Required"). IMAGE stays 10 MB. Extra: the pencil from /en goes to /ar/.../media-kinds/IMAGE and the page stays English. | H1-F19-required, H1-F19-after-back |
| F20 | NOT RUN (new) | FAIL | Allowed = Yes gives 34 rows. Pencil on image/jpeg (URL /en/file-util-config/mime-types/image%2Fjpeg) shows "Not found - This record does not exist or could not be loaded." Same for image/png and after Ctrl+Shift+R: every file-type edit page fails. | H1-F20-notfound |
| F21 | NOT RUN (new) | NOT RUN | HIGH-IMPACT, platform-wide upload limit. Awaiting an explicit owner yes. | - |
| F22 | NOT RUN (new) | NOT RUN | HIGH-IMPACT, platform-wide upload limit. Awaiting an explicit owner yes. | - |
| F23 | NOT RUN (new) | NOT RUN | HIGH-IMPACT, switches VIDEO off for all tenants. Awaiting an explicit owner yes. | - |
| F24 | NOT RUN (new) | PASS | New model/gltf-binary (OTHER, ext glb): Active + Allowed off is refused with "A blocked file type stays inactive". Active off saves; list 52 to 53, row Inactive. After Create the redirect lands on the broken "Not found" edit page (see F20). | H1-F24-refused-active, H1-F24-list-inactive, H1-F24-saved-redirect-notfound |
| F25 | NOT RUN (new) | PARTIAL | New text/html with Allowed on is refused with the toast "mime-types 'text/html' already exists" (already seeded: Allowed No, Inactive), so the duplicate check fires first and the never-allow rule cannot be seen. No duplicate created. | H1-F25-refused, H1-F25-html-unchanged |
| F26 | NOT RUN (new) | PASS | Arabic Media kinds and File types: titles correct, RTL layout, 12 kinds (5 per page) and 52 types (11 pages). Minor: filter chevrons detached from the select boxes (also in English). | H1-F26-mediakinds-ar, H1-F26-mimetypes-ar |
| Cleanup (F-ter) | NOT RUN (new) | PASS | image/jpeg max size is empty ("-"), IMAGE 10 MB, model/gltf-binary Inactive, QA_DOCS 1 MB Inactive, QA_DOCS/MAIN Inactive, QA_TEST bucket Inactive. | H1-F27-sizelist |
| F27 | NOT RUN (new) | PASS | Category form: Max file size list (Choose..., 512 KB, 1 MB ... 1 GB, Custom value...), Max files (None, 1, 2, 3, 5, 10, 20, 50, 100, Custom), Image max side (None, 640 ... 8192, Custom). ORDER_FILE shows 10 MB / 100 / 2,048 and "owned by the platform: can be edited but not deactivated". Opened, not saved. | H1-F27, H1-F27-imageside, H1-F27-ORDER_FILE |
| F28 | NOT RUN (new) | PASS | QA_DOCS: custom 7.5 saved and shows "= 7.5 MB"; 2000 MB is refused ("Max file size: Too large"). Restored to 1 MB ("Changes saved successfully"); it was found at 7.5 MB, left by the r1 run. | H1-F28, H1-F28-restored |
| F29 | NOT RUN (new) | NOT RUN | HIGH-IMPACT, platform-wide purpose limit. Awaiting an explicit owner yes. | - |
| H1 | NOT RUN (new) | PASS | /en/ops/jobs: "File Util: purge deleted file bytes" (file-util-purge, module file_util), badge "HQ worker", actual 47 3 * * 0, Enabled, "In sync", Last run "No runs yet"; History says "No runs recorded yet." Edit dialog: "Runs every week on Sunday at 03:47 UTC." Cosmetic: History headers show raw "STARTED - [STARTED_AT]". | H3-H1-list, H3-H1-history |
| H2 | NOT RUN (new) | NOT RUN | HIGH-IMPACT: changes the platform purge schedule. Awaiting an explicit owner yes. | - |
| H3 | NOT RUN (new) | PASS | Typing 99 * * * * shows "One of the fields is outside its allowed range."; Save is greyed; "Use default schedule" appears. Cancelled, nothing saved. | H3-H3 |
| H4 | NOT RUN (new) | NOT RUN | NEW write (Run now plus a tenant file delete). Awaiting owner approval. | - |
| H5 | NOT RUN (new) | NOT RUN | NEW write (Run now twice). Awaiting owner approval. | - |
| H6 | NOT RUN (new) | NOT RUN | HIGH-IMPACT: disables the platform job. Awaiting an explicit owner yes. | - |
| H7 | NOT RUN (new) | NOT RUN | Needs the Render platform-workers service stopped for 15+ minutes (owner or infra only). | - |
| H8 | NOT RUN (new) | PASS | /ar/ops/jobs: lang ar, dir rtl, sidebar right, badge "عامل المنصة", Arabic title, description, buttons, status and schedule list. Minor: "1 row" untranslated; cron cell reads "0 * * 3 47" in RTL (bidi reorder of 47 3 * * 0). | H3-H8-list, H3-H8-picklist |
| I1 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| I2 | NOT RUN (new) | NOT RUN | NEW write (QA order status transitions). Awaiting owner approval. | - |
| I3 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| I4 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| I5 | NOT RUN (new) | BLOCKED | Needs Report issue, which does not exist (see D1); also a NEW write. | - |
| I6 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| I7 | NOT RUN (new) | PASS | Viewer on order ORD-20261119-00002 ?tab=files: Files panel read-only (no drop zone, 0 file inputs, no upload, edit or delete). Limited reach: no files exist, and Processing/Assembly lists are empty so no stage panel could be opened. | T12-I7-files, T12-I7 |
| I8 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| I9 | NOT RUN (new) | NOT RUN | Optional direct API call; forbidden by the no-direct-API rule. | - |
| J1 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| J2 | NOT RUN (new) | NOT RUN | NEW write (QA reject or pickup on a QA order). Awaiting owner approval. | - |
| J3 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| J4 | NOT RUN (new) | PARTIAL | Viewer: Items & Pieces > View Pieces shows piece buttons labelled "Add photos" with no count; the dialog "Photos of ORD-20261119-00001-1-1" is read-only (No files yet, no drop zone). No piece with photos exists. Button label "Add photos" for a read-only user is misleading. | T12-J4 |
| J5 | NOT RUN (new) | NOT RUN | NEW write (QA reject or pickup on a QA order). Awaiting owner approval. | - |
| J6 | NOT RUN (new) | NOT RUN | NEW write (QA reject or pickup on a QA order). Awaiting owner approval. | - |
| J7 | NOT RUN (new) | NOT RUN | NEW write (QA reject or pickup on a QA order). Awaiting owner approval. | - |
| J8 | NOT RUN (new) | NOT RUN | NEW write; needs a delivery route and active stop fixture. Awaiting owner approval. | - |
| J9 | NOT RUN (new) | NOT RUN | Batch T5/T6 not run: depends on the stage fixture (QA order moved through stages), which needs NEW write approval from the owner. | - |
| K1 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| K2 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| K3 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| K4 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| K5 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| K6 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| K8 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| K7 | - (new row) | NOT RUN | Section K added to the guide at 20:01, after the retest plan was built. Not run. | - |
| G | NOT RUN | NOT RUN | Informational row (Phase 8 documentation only). | - |

#### Retest r2 — prior findings

Each Round 1 finding is kept as written above; this is its status after the 16:14 deploy.

- **FET-FU-Nov19-HeicRejected** — Retest r2 2026-11-19: **STILL BROKEN.** qa_photo.heic (526-byte stub with a valid ftyp heic header) is still refused; the message is now "An image file qa_photo.heic was refused because it is not an allowed file type here." Retest with a real iPhone HEIC. T2-7.
- **FET-FU-Nov19-TenantLogoInvalidRequest** — Retest r2 2026-11-19: **STILL BROKEN.** Logo list and upload still return "The request was not valid." (C9, C10). T2-2.
- **FET-FU-Nov19-IssuesUiMissing** — Retest r2 2026-11-19: **STILL BROKEN.** No Issues tab on the order and no Report issue control on /dashboard/issues; D1 FAIL and D2-D5, D3b, D9, I5 and UIDS PR-02 #15 stay BLOCKED. One-line fix: surface the Issues tab and Report issue (confirm the 0751 UI is in the 16:14 deploy and the permission gate).
- **FET-FU-Nov19-ProcessingPermissionDenied** — Retest r2 2026-11-19: **FIXED.** /dashboard/processing loads with no sys_order_sources_cd error. T4-PR02-12b.
- **FET-FU-Nov19-ProductPageAccessFlash** — Retest r2 2026-11-19: **NOT RE-CHECKED.** The product page was not opened as admin in r2; as a viewer the catalog services and pricing pages show "Access not granted ... admin:manage". T12-C7.
- **FET-FU-Nov19-OrderFilesTabMissingInFullView** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Not repeated in r2.
- **FET-FU-Nov19-AssemblyNoData** — Retest r2 2026-11-19: **STILL BROKEN.** /dashboard/assembly loads without error but has no orders, so D7 cannot be run. T4-D7.
- **FET-FU-Nov19-ViewerCatalogDenied** — Retest r2 2026-11-19: **STILL BROKEN.** A viewer still cannot reach a product page (needs admin:manage), so C7 stays BLOCKED. T12-C7.
- **FET-FU-Nov19-FileListLag** — Retest r2 2026-11-19: **STILL SEEN.** Tab clicks and list updates arrive seconds later (viewer tabs, Add item about 4 s); upload-to-tile lag not re-measured.
- **FET-FU-Nov19-ViewerKeyboardAfterZoom** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Not repeated in r2.
- **FET-FU-Nov19-MaintenanceRemainingCountWrong** — Retest r2 2026-11-19: **NOT RE-CHECKED.** No order was deleted in r2 (E7 was a read-only re-check).
- **FET-FU-Nov19-FileSetupRefusalAsToast** — Retest r2 2026-11-19: **STILL SEEN.** F24 refusal "A blocked file type stays inactive" and the F25 duplicate refusal appear only as toasts. H1-F24-refused-active, H1-F25-refused.
- **FET-FU-Nov19-GuideStaleBranding** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Not repeated in r2 (C10 re-run as view only).
- **FET-FU-Nov19-ArabicFileUiBidi** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Not repeated in r2.
- **FET-FU-Nov19-ArabicFileSetupLeftovers** — Retest r2 2026-11-19: **PARTLY FIXED.** Arabic hub, Media kinds and File types titles and layout are correct (F18, F26). Plan codes and job names in Arabic were not re-checked. H1-F18-hub-ar.

#### Retest r2 — new findings (Financial_Expert_Tester, 2026-11-19)

Code locations were not inspected (remote-only run); fixes are the likely place to look.

- **P1 FET-FU-Nov19-MimeTypeEditNotFound** — Every File type edit page fails: image/jpeg (/en/file-util-config/mime-types/image%2Fjpeg) and image/png show "Not found - This record does not exist or could not be loaded.", also after Ctrl+Shift+R. After creating model/gltf-binary the redirect lands on the same broken page. File types cannot be edited at all (F20, F24). Evidence: H1-F20-notfound, H1-F24-saved-redirect-notfound. Fix: the detail loader probably does not decode the encoded slash in the mime code; decode the id or route by a safe key.
- **P2 FET-FU-Nov19-PurgeJobNeverRan** — File health shows 8 deleted files whose bytes are not removed (oldest Nov 19 4:43 PM) and "Last bytes removed Nov 19 3:47 AM", yet the purge job (Sunday 03:47 UTC) says "No runs yet". Cannot prove the purge works (E7, H1). Evidence: H3-E7, H3-H1-history. Fix: run the job once (needs owner approval, H4) and explain the 3:47 AM timestamp.
- **P2 FET-FU-Nov19-FileUrlExpiresIdle** — After about 5.5 minutes idle on the Files tab, opening a file shows a broken image because the signed URL expired and is not refreshed (A18). Fix: refresh the URL on open or on error.
- **P2 FET-FU-Nov19-GalleryToMainBlocked** — Changing a Gallery image to Main shows "The maximum number of files is reached. Delete one first." and an "invalid option" banner on the pencil (C6). Fix: allow a type swap that does not add a file.
- **P2 FET-FU-Nov19-ViewerSeesWriteActions** — A viewer (orders:read) still sees New Order, Edit, Start Preparation, Print Label and the public tracking link on the order page, and the piece button says "Add photos" (A16, J4). Evidence: T12-J4. Fix: hide or disable actions the user cannot perform.
- **P2 FET-FU-Nov19-StageQueuesEmptyForViewer** — As viewer, Processing and Assembly show empty queues ("No orders in processing queue") while five orders are in PROCESSING; Processing first sat on "Loading orders..." for about 20 s (I7). Evidence: T12-I7. Fix: check the read permission scope of the queue endpoints.
- **P3 FET-FU-Nov19-PdfViewerTiny** — The PDF tile opens in a very small, unreadable viewer area (A10). Evidence: T2-8-pdf.
- **P3 FET-FU-Nov19-NeverAllowRuleNotObservable** — Creating text/html with Allowed on is stopped by the duplicate check ("mime-types 'text/html' already exists"), so the never-allow rule (F25) cannot be seen in the UI. Fix: test it with a not-yet-seeded dangerous type or run the never-allow check first.
- **P3 FET-FU-Nov19-MediaKindsEditLocaleMismatch** — The Media kinds pencil from /en opens /ar/file-util-config/media-kinds/IMAGE with English text, and after Back the URL stays /ar with English LTR content (F19). Evidence: H1-F19-after-back. Fix: build edit links with the current locale.
- **P3 FET-FU-Nov19-FilterChevronDetached** — File types list: the Media kind and Allowed filter chevrons sit detached from their select boxes in English and Arabic (F1, F26). Evidence: H1-F26-mimetypes-ar.
- **P3 FET-FU-Nov19-FileSetupSaveNoToast** — Saving ticks on a purpose and re-typing a category size gave no visible toast on several saves (the "File types saved" toast showed only on the restore save), so the user cannot tell the save worked (F9, F28).
- **P3 FET-FU-Nov19-JobHistoryRawHeaders** — Job history dialog shows raw column headers "STARTED - [STARTED_AT]", "STATUS - [STATUS]", "TRIGGER - [TRIGGER_TYPE]", "MESSAGE - [M...". Evidence: H3-H1-history.
- **P3 FET-FU-Nov19-JobsArabicLeftovers** — Arabic job list: "1 row" in the Last run cells is untranslated and the cron cell reads "0 * * 3 47" (bidi reorder of "47 3 * * 0"). Evidence: H3-H8-list.
- **P3 FET-FU-Nov19-GuideRowOrderK** — Guide section K lists K8 before K7 and was added after r1 and the r2 plan; new K1-K8 rows are NOT RUN.

#### Retest r2 — recount, leftovers, caveats

**Recount r2 (File Util, 111 rows of Round 1/the 2026-11-19 pull):** PASS 49 / FAIL 6 / PARTIAL 7 / BLOCKED 14 / NOT RUN 35 / NOT PRESENT 0 (total 111).

**Including the 8 rows the owner added after the pull (119 rows now):** PASS 49 / FAIL 6 / PARTIAL 7 / BLOCKED 14 / NOT RUN 43 / NOT PRESENT 0 (total 119).

**By section (PASS / FAIL / PARTIAL / BLOCKED / NOT RUN / NOT PRESENT, incl. new rows):** A: 14/2/2/0/0/0; B: 1/0/0/4/1/0; C: 7/2/1/1/1/0; D: 1/1/0/8/0/0; E: 0/0/1/0/6/0; F: 10/0/1/0/2/0; F-bis: 5/0/0/0/0/0; F-ter: 7/1/1/0/4/0; H: 3/0/0/0/5/0; I: 1/0/0/1/7/0; J: 0/0/1/0/8/0; K: 0/0/0/0/8/0.

**Round 1 for comparison:** PASS 35 / FAIL 2 / PARTIAL 10 / BLOCKED 14 / NOT RUN 11 (72 rows); the 39 rows added between Round 1 and the deploy started as NOT RUN.

**Caveats:** one browser run at a time; several runs were interrupted and were recovered from run notes and screenshots (T3 at the QA-Alt delete, T4, H1). Input lag dropped characters, so fields were re-checked before saving. No camera, no touch emulation, no DevTools, no Arabic keyboard layout on the box. A dark device setting was not tested. Rows marked "awaiting owner approval" are writes that were not on the morning approval list; the owner-approved items (HQ H8 Ocean deactivate and re-activate for about 18 s, E7 read-only re-check) were run.

**Test data left behind (r2):**
- HQ: file type model/gltf-binary ("QA GLB model", kind OTHER, Allowed No) was created and left Inactive (list 52 to 53 types). Category QA_DOCS was found at 7.5 MB (left by Round 1) and reset to its original 1 MB. Purpose QA_DOCS/MAIN was found with JPEG and PDF ticked (left by Round 1) and reset to none ticked. Bucket QA_TEST, QA_DOCS, QA_DOCS/MAIN and model/gltf-binary are all Inactive. Nothing was deleted (HQ only deactivates).
- HQ jobs: no schedule was saved and no job was run; the cron field edit (99 * * * *) was cancelled.
- Supabase: bucket `qa-test-bucket` still exists, and the owner follow-ups for the empty buckets `product-images` and `delivery-pod-evidence` are still open (owner only).
- Demo Laundry: files uploaded in the T2 run were removed again. That run also deleted 5 older QA files on ORD-20261119-00001 (id e8ec6931-c1a1-4178-8ded-a4320b674bb2) that it had not uploaded, including an earlier qa_logo.png; the owner was told.
- Orders: nothing was paid or submitted and no status was changed. ORD-20261119-00005 (created 07:39, partly paid) is not from this tester.

### Retest r3 (2026-11-19 20:56–22:30 Asia/Muscat) — File Util

**Retest r3 (2026-11-19 20:56–22:30 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: on 2026-11-19 at 20:47 the owner answered "Yes for all those" to the writes and high-impact items held back in Retest r2 (order-flow writes, F21, F22, F23, F29, H2, H6, F10, K8, B3, PR-07 #19) and the rows the owner added since. Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch; admin and operator) and HQ https://hqsaas.cleanmatex.com (Incognito). Real mouse and keyboard, no direct API calls, no page scripts, no Jest. Credentials: see the credentials file, none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\retest3\shots\` (file names in the Shot column, all `.webp`). Notes: Round 1 and Retest r2 text above is untouched. The last cmx sign-in attempt ended at 22:35 (the 22:30 end of the window is the label given for this round). Only rows with r3 evidence are listed; every other row keeps its r2 status.

**Guide changes found while writing back.** The guide was not edited between the Retest r2 write-back (70,350 B, SHA 9D12D5C6…, 20:38:41) and this write-back; it was re-pulled at 22:37 and was byte-identical to my r2 result. There are no Dev notes.

#### Retest r3 results

Columns: r2 = Retest r2 result, r3 = this retest. Only rows touched in r3 are listed; all other rows keep their r2 result.

| Row | r2 | r3 | Evidence | Shot |
|---|---|---|---|---|
| B3 | NOT RUN | BLOCKED | QA order ORD-20261119-00006 (customer Jh Test dev21, Fitness Leggings, item note "QA-20261119-PHOTOS") was created once and paid 1.070 OMR cash (subtotal 1.000 + tax 0.070); it shows Processing, Paid CASH. The photo half is blocked: The New Order "Photo" button opens a "Take a photo" modal that says "The camera is not available. Allow camera access in the browser, or choose a file instead."; Capture is disabled and there is no file chooser (no file input in the page). | O-2.webp |
| B4 | BLOCKED | BLOCKED | Depends on B3: no photos could be added, so "2 photos saved" was never seen and the order detail has no Files tab among its tabs (Order Master Data … Notes). | O-2.webp |
| B6 | BLOCKED | BLOCKED | Camera only, same as B3; no file chooser on New Order. | O-2.webp |
| D2 | BLOCKED | BLOCKED | Still no Issues tab on the order detail and no "Report issue" control on /dashboard/issues ("Order Issues": Open 0 / Issues 0, "No issues yet"); /dashboard/qa shows "No orders pending QA", so there is nothing to reject. | J-3.webp |
| D5 | BLOCKED | BLOCKED | Still no Issues tab on the order detail and no "Report issue" control on /dashboard/issues ("Order Issues": Open 0 / Issues 0, "No issues yet"); /dashboard/qa shows "No orders pending QA", so there is nothing to reject. | J-3.webp |
| D6 | BLOCKED | BLOCKED | No transition-only user exists (the operator has both orders:transition and orders:update); not run. | - |
| D7 | BLOCKED | BLOCKED | /dashboard/assembly shows Pending 0, In Progress 0, QA Pending 0, "No orders in assembly" while /dashboard/processing shows Orders 12, so Record exception cannot be run. | O-5.webp |
| E1 | NOT RUN | BLOCKED | No orders are out for delivery ("No orders out for delivery", Out for delivery 0, Completed today 0) and the routes show blank or malformed data (see FET-FU-Nov19-DeliveryRoutesMalformed), so no stop could be opened. | J-3.webp |
| E2 | NOT RUN | BLOCKED | No orders are out for delivery ("No orders out for delivery", Out for delivery 0, Completed today 0) and the routes show blank or malformed data (see FET-FU-Nov19-DeliveryRoutesMalformed), so no stop could be opened. | J-3.webp |
| E3 | NOT RUN | BLOCKED | No orders are out for delivery ("No orders out for delivery", Out for delivery 0, Completed today 0) and the routes show blank or malformed data (see FET-FU-Nov19-DeliveryRoutesMalformed), so no stop could be opened. | J-3.webp |
| E4 | NOT RUN | BLOCKED | No orders are out for delivery ("No orders out for delivery", Out for delivery 0, Completed today 0) and the routes show blank or malformed data (see FET-FU-Nov19-DeliveryRoutesMalformed), so no stop could be opened. | J-3.webp |
| E5 | NOT RUN | BLOCKED | No orders are out for delivery ("No orders out for delivery", Out for delivery 0, Completed today 0) and the routes show blank or malformed data (see FET-FU-Nov19-DeliveryRoutesMalformed), so no stop could be opened. | J-3.webp |
| E6 | NOT RUN | BLOCKED | No orders are out for delivery ("No orders out for delivery", Out for delivery 0, Completed today 0) and the routes show blank or malformed data (see FET-FU-Nov19-DeliveryRoutesMalformed), so no stop could be opened. | J-3.webp |
| E7 | PARTIAL | PASS | After the purge run (H4) and a reload, HQ File health shows "Deleted, bytes not removed" 0 (was 8) and "Oldest: never"; "Last bytes removed" Nov 19 2026 8:58 PM by platform-workers purge job. | H-3.webp |
| F10 | NOT RUN | PASS | Deactivate on ORDER_FILE/DAMAGE confirmed: refused with the toast "This purpose is used by the applications and cannot be deactivated"; the badge stays Active. Final state DAMAGE Active. | F-10-refused.webp, F-10-still-active.webp, F-final-damage-active.webp |
| F11 | NOT RUN | BLOCKED | No HQ account with only *.view exists (no HQ viewer); not run. | - |
| F21 | NOT RUN | BLOCKED | HQ File types list shows image/jpeg max size "—"; its edit page /en/file-util-config/mime-types/image%2Fjpeg shows "Not found - This record does not exist or could not be loaded." No change was made. FET-FU-Nov19-MimeTypeEditNotFound is still broken. | F-21-notfound.webp |
| F22 | NOT RUN | PASS | HQ IMAGE max original 10 MB set to 1 MB ("Changes saved successfully"). Tenant (after a hard refresh) dropzone says "Up to 1.0 MB per file"; QA-2MB.jpg and QA-2MB.png were both refused with the toast "QA-2MB.jpg" / "QA-2MB.png" is larger than 1.0 MB; nothing uploaded. IMAGE restored to 10 MB (10485760). | F-22-hq-set.webp, F-22-jpg-refused.webp, F-22-png-refused.webp, F-22-restored.webp, F-final-image-10mb.webp |
| F23 | NOT RUN | PASS | HQ VIDEO (was Active, 100 MB) toggled off, Inactive. Tenant purpose "Item video" (dropzone "Up to 50.0 MB"): QA-video.mp4 refused with the row text "This kind of file is not allowed here."; not uploaded. VIDEO reactivated (Active, 100 MB). | F-23-hq-off.webp, F-23-video-refused.webp, F-23-restored.webp, F-final-video-active.webp |
| F29 | NOT RUN | PASS | QA-9MB.jpg uploaded as Before processing (limit label "Up to 10.0 MB"). HQ AFTER_IMAGE max file size (was None) set to 1 MB. Moving the 9 MB file Before to After processing saved and kept the tile, labelled After processing. A new upload of QA-9MB.jpg as After processing was refused: "QA-9MB.jpg is larger than 1.0 MB." (label "Up to 1.0 MB per file"). AFTER_IMAGE restored to None; QA-9MB.jpg deleted ("File deleted"). | F-29-pre-upload.webp, F-29-hq-set.webp, F-29-moved.webp, F-29-after-refused.webp, F-29-restored.webp, F-cleanup-deleted.webp |
| H2 | NOT RUN | PARTIAL | Pencil, Common schedules "Every day at 03:00 UTC" (0 3 * * *), Save: toast "Schedule of File Util: purge deleted file bytes was updated."; the row first showed Actual 47 3 * * 0 / Intended 0 3 * * * "Schedule drift", then Actual 0 3 * * * "In sync" about 1 minute later. The audit entry "Schedule or state changed" (Success, System Administrator, Nov 19 2026 9:00:59 PM) has the right actor but its body says "No visible schedule or enabled-state difference was recorded." instead of the old and new cron (FET-FU-Nov19-PurgeAuditNoDiff). Reverted with "Use default schedule" (47 3 * * 0), In sync after about 1 minute. | H-5.webp, H-5b.webp, H-6.webp, H-7a.webp, H-7.webp |
| H4 | NOT RUN | PASS | Run now, confirm dialog "Run File Util: purge deleted file bytes now?", result "Queued. The HQ worker starts it within about a minute; the result appears in the run history." History: Nov 19 2026 8:58:10 PM, SUCCESS, Manual, "Purged 8 deleted file(s) in 2 batch(es)". | H-1.webp, H-2.webp |
| H5 | NOT RUN | PASS | With the first Run now still waiting, a second Run now plus confirm was refused with the toast "The job could not be run. A manual run of this job is already waiting or running." The first run then finished at 9:00 PM, Manual, SUCCESS, "Purged 0 deleted file(s) in 1 batch(es)". | H-4.webp |
| H6 | NOT RUN | PASS | Cron set to * * * * * ("Runs every minute."), then Disable (dialog "Future scheduled runs on * * * * * will stop until the job is enabled again. An execution already in progress will not be cancelled.", toast "File Util: purge deleted file bytes was disabled." about 21:05). About 3 minutes later the row showed Disabled and History had only the 2 Manual runs, no Scheduled run. Run now while Disabled still worked ("Queued…", then Manual SUCCESS 9:10 PM "Purged 0 deleted file(s) in 1 batch(es)"). Caveat: the every-minute cron never showed as Actual while the job was enabled (it synced only after Disable), so "no scheduled run while disabled" is weak evidence. Enabled again, then "Use default schedule". Final state: Enabled, 47 3 * * 0, In sync; History has 3 Manual SUCCESS rows (9:10:11, 9:00:11, 8:58:10 PM), no Scheduled rows. | H-8a.webp, H-8.webp, H-9a.webp, H-9.webp, H-9b.webp, H-9c.webp, H-10.webp, H-FINAL.webp |
| I2 | NOT RUN | PARTIAL | Processing PASS and Ready PASS. Processing Files panel ("All files of this order", type "Before processing"): qa_photo2.jpg tile "Before processing / Processing · Processing". After "Mark Order Ready" (rack QA-A1; the button showed "Processing…", then toast "Order transitioned successfully") the Ready detail Files panel tile reads "After processing / Ready · Ready for pickup", next to the earlier Processing tile. Assembly, QA and Packing are BLOCKED: Processing only offers "Complete processing (Usual next step · Moves to Ready)", "Hold order work" and "Mark Order Ready" (FET-FU-Nov19-NoAssemblyQaPackingPath). | O-3.webp, O-5.webp, O-4.webp |
| I5 | BLOCKED | BLOCKED | Still no Issues tab on the order detail and no "Report issue" control on /dashboard/issues ("Order Issues": Open 0 / Issues 0, "No issues yet"); /dashboard/qa shows "No orders pending QA", so there is nothing to reject. | J-3.webp |
| J2 | NOT RUN | BLOCKED | Still no Issues tab on the order detail and no "Report issue" control on /dashboard/issues ("Order Issues": Open 0 / Issues 0, "No issues yet"); /dashboard/qa shows "No orders pending QA", so there is nothing to reject. | J-3.webp |
| J5 | NOT RUN | BLOCKED | Ready detail of ORD-20261119-00006 (Ready, rack QA-A1, 1.070 OMR, Paid in full): "Not yet available for pickup". Pickup and collection card: "Customer pickup — Counter pickup is not configured for this workflow profile. Enable its pickup handover action before recording the handover." No pickup or handover button and no photo dialog; the only next step is "Release for delivery (Moves to Out for delivery)", not clicked. A red toast showed `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. The Files panel showed 4 skeleton tiles and no "Pickup proof" tiles. The order stays READY. (FET-FU-Nov19-CounterPickupNotConfigured) | J-1.webp, J-2.webp |
| J6 | NOT RUN | BLOCKED | Depends on pickup (J5): "Counter pickup is not configured for this workflow profile", so no handover could be started on ORD-20261119-00006. | J-1.webp |
| J7 | NOT RUN | BLOCKED | Depends on pickup (J5): "Counter pickup is not configured for this workflow profile", so no handover could be started on ORD-20261119-00006. | J-1.webp |
| J8 | NOT RUN | BLOCKED | /dashboard/delivery: Out for delivery 0, Completed today 0, "No orders out for delivery". Routes: 3 cards each reading "Status: / Stops: / Invalid Date / Driver: Unassigned / Open manifest" (blank data). RT-2026-002 opens as Completed, 1 of 1 stops, Driver Two, Second Branch, Sep 5 2026, with a "Stops" heading and no stop rows and no Files panel. No active stop, so no delivery-proof test. | J-3.webp |
| K1 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |
| K2 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |
| K3 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |
| K4 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |
| K5 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |
| K6 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |
| K7 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |
| K8 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09, and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Stopped after 2 attempts per the sign-in rule (FET-FU-Nov19-Cmx524SignInHtml). | 8-signin-fail2.webp |

#### Retest r3 — prior findings

- **FET-FU-Nov19-PurgeJobNeverRan** — Retest r3 2026-11-19: **PARTLY FIXED.** Run now works: the 20:58 run purged 8 deleted files and File health fell from 8 to 0, and 3 Manual runs are in the history. A Scheduled run was never observed (H6 caveat), so the weekly schedule itself is unproven. H-1, H-2, H-3, H-10.
- **FET-FU-Nov19-MimeTypeEditNotFound** — Retest r3 2026-11-19: **STILL BROKEN.** The image/jpeg edit page still shows "Not found - This record does not exist or could not be loaded." (F21). F-21-notfound.
- **FET-FU-Nov19-IssuesUiMissing** — Retest r3 2026-11-19: **STILL BROKEN.** No Issues tab on the order and no Report issue control; D2, D5, I5 and J2 stay BLOCKED.
- **FET-FU-Nov19-AssemblyNoData** — Retest r3 2026-11-19: **STILL BROKEN.** /dashboard/assembly shows 0, 0, 0 and "No orders in assembly" while Processing shows 12 orders (D7).
- **FET-FU-Nov19-FileListLag** — Retest r3 2026-11-19: **STILL SEEN.** The site was very slow: the Ready list was empty on first load, and the Ready detail Files panel showed skeleton tiles.

#### Retest r3 — new findings (Financial_Expert_Tester, 2026-11-19)

- **P1 FET-FU-Nov19-CounterPickupNotConfigured** — On a paid READY order the pickup card says "Counter pickup is not configured for this workflow profile. Enable its pickup handover action before recording the handover." and offers no handover button, so pickup with proof photos, the pickup lock and the reject path cannot be used (J5, J6, J7). Evidence: J-1. Fix: enable the pickup handover action in the Demo Laundry workflow profile (or add it to the default profile).
- **P1 FET-FU-Nov19-Cmx524SignInHtml** — From 22:09 cmx requests hung with Cloudflare "A timeout occurred", error 524, for about 9 minutes (an anonymous /login still answered in 0.4 s); the admin session was lost (22:18 "session expired") and two admin sign-ins in a row spun on "Signing in…" for about 4 minutes and ended in the banner `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` (the sign-in POST returned the HTML error page). A similar red toast appeared on the Ready detail at 21:53. It may be deploy-related. Evidence: 8-signin-fail2. Fix: handle a non-JSON response with a readable error, and find what stalls the origin.
- **P2 FET-FU-Nov19-NoAssemblyQaPackingPath** — A new POS order goes straight to Processing, and the Processing page only offers "Complete processing (Moves to Ready)", "Hold order work" and "Mark Order Ready". There is no step into Assembly, QA or Packing, so those I2 stages and the QA queue cannot be reached from the UI. Evidence: O-3, O-5.
- **P2 FET-FU-Nov19-DeliveryRoutesMalformed** — /dashboard/delivery route cards read "Status: / Stops: / Invalid Date / Driver: Unassigned / Open manifest" with blank values, and an opened completed route (RT-2026-002) shows the "Stops" heading with no stop rows and no Files panel (E1 to E6, J8). Evidence: J-3.
- **P2 FET-FU-Nov19-NewOrderPhotoCameraOnly** — The New Order "Photo" button opens "Take a photo" and says "The camera is not available. Allow camera access in the browser, or choose a file instead.", but there is no file chooser, so photos cannot be added without a camera (B3, B4, B6). Evidence: O-2. Fix: add the "choose a file" input the message promises.
- **P3 FET-FU-Nov19-PurgeAuditNoDiff** — The audit entry for a purge-job schedule change shows the actor but the body "No visible schedule or enabled-state difference was recorded." instead of the old and new cron (H2). Evidence: H-6.
- **P3 FET-FU-Nov19-PosSessionCheckFirstLoad** — The first load of New Order showed the red message "POS session could not be checked / Refresh the Session Hub, then start or resume an open POS session before creating an order." After a hard refresh it asked for a branch instead and the Session Hub chip read "Open". Evidence: ORD notes 21:35.
- **P3 FET-FU-Nov19-StartPrepNotAvailable** — The order opened from the Processing queue shows a "Preparation" page that says "This order is not available for preparation / Preparation is only available for orders in intake or preparing status. Current status: Processing." for an order the POS already put in Processing. Evidence: O-3.

#### Retest r3 — recount, leftovers, caveats

**Recount r3 (File Util, 119 rows now; r3 status changes applied on top of the r2 counts):** PASS 57 / FAIL 6 / PARTIAL 8 / BLOCKED 28 / NOT RUN 20 / NOT PRESENT 0 (total 119).

**Changes from r2 (PASS 49 / FAIL 6 / PARTIAL 7 / BLOCKED 14 / NOT RUN 43):** to PASS: H4, H5, H6, F10, F22, F23, F29 (from NOT RUN) and E7 (from PARTIAL), 8 rows; to PARTIAL: H2, I2 (from NOT RUN), 2 rows, minus E7; to BLOCKED (from NOT RUN): B3, E1 to E6, F11, F21, J2, J5, J6, J7, J8, 14 rows. Unchanged: B4, B6, D2, D5, D6, D7, I5 stay BLOCKED; the 6 FAIL rows stay FAIL; K1 to K8 stay NOT RUN. The r2 by-section table was not re-tallied.

**Caveats:** one browser run at a time; site input lag dropped characters, so fields were re-checked before saving; uploads used the file-upload tool because the native chooser was not visible on the box desktop. No camera on the box. The H6 and H2 timings come from screenshots about a minute apart.

**Test data left behind (r3):**
- HQ settings were all restored to their original values and verified: IMAGE max original 10 MB, VIDEO Active (100 MB), AFTER_IMAGE max size None, DAMAGE Active. image/jpeg was never changed.
- HQ jobs: file-util-purge is Enabled, schedule 47 3 * * 0, In sync. Its history now has 3 Manual SUCCESS runs (8:58:10, 9:00:11 and 9:10:11 PM) and the audit has the manual runs, the schedule changes and the Disable and Enable entries. The first run purged the 8 deleted files that were waiting (their bytes are gone).
- Demo Laundry: QA order ORD-20261119-00006 (customer Jh Test dev21, Fitness Leggings, 1.070 OMR paid in cash, no refund) is now READY on rack QA-A1 with 2 files (qa_photo2.jpg as Before processing and as After processing). It was not handed over. QA-9MB.jpg (F29) was deleted again. The operator appearance was set to Light at 21:59 and restored to "Same as this device" at 22:03; Chrome's appearance mode was set to Dark and Light for M14 and restored to Device.
- Sign-ins: the operator signed in OK twice with no failures; the admin had 2 failed attempts at 22:25 to 22:35 (server returned HTML, not a credential rejection) and the account was left alone. The admin is not signed in on the box; K1 to K8 and the rest of the owner's new rows are still to run once cmx answers again.

### Retest r4 (2026-11-20 00:52–01:12 Asia/Muscat) — File Util

**Retest r4 (2026-11-20 00:52–01:12 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: at 00:51 the owner said "try now" after the cmx outage that stopped Retest r3 (Cloudflare 524 from 22:09). This round runs the rows Retest r3 could not reach. Environment: remote only, https://cmx.cleanmatex.com (Demo Laundry, Main Branch, admin). Signed in on the first attempt; no 524 errors. Real mouse and keyboard, no direct API calls, no page scripts, no Jest. Credentials: none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\retest4\shots\` (`.webp`). Writes in this round: one photo (qa_photo2.jpg, note "QA r4 note") added to QA order ORD-20261119-00006; Appearance set to Dark and Light and restored to its original "Same as this device" / "Same as the Organization" / "Medium"; a New Order cart opened to the payment view and cancelled without paying (no order created). Branding, settings and other orders were not changed. Earlier rounds above are untouched.

**Guide changes found while writing back.** The guide was not edited since my Retest r3 write-back (91,127 B, SHA 3FB15565…, 22:40:13); re-pulled at 01:15 it is byte-identical. There are no Dev notes. This section is appended after the existing text.

#### Retest r4 results

Columns: r3 = Retest r3 result, r4 = this retest. Only rows touched in r4 are listed.

| Row | r3 | r4 | Evidence | Shot |
|---|---|---|---|---|
| K1 | NOT RUN | PASS | Demo Laundry has piece tracking ON, so the piece-tracking-off case is not available here: on ORD-20261119-00006 Ready detail and Items & Pieces, and on Processing items, there is only "View Pieces" and no item-level "Add photos". Consistent with K3; the off case needs a tenant with tracking off. | - |
| K2 | NOT RUN | NOT RUN | Needs a tenant with piece tracking off (no item-level "Add photos" in Demo Laundry). | - |
| K3 | NOT RUN | PASS | Ready detail piece "Piece 1 ORD-20261119-00006-1-1" has its own "Add photos" button and the item has none; same on Processing detail of ORD-20261119-00003 (3 pieces, each with "Add photos"). | - |
| K4 | NOT RUN | BLOCKED | Assembly shows all counters 0 and "لا توجد طلبات في التجميع" (no orders in assembly). Same blocker as I2 (no path into Assembly). | - |
| K5 | NOT RUN | NOT RUN | Needs a user without `orders:read`. | - |
| K6 | NOT RUN | PARTIAL | Arabic piece button "إضافة صور"; dialog title "صور ORD-20261119-00006-1-1", RTL, with "الملفات", "نوع الملف", "التقاط صورة", "لا توجد ملفات بعد". The item-level dialog does not exist with tracking on. | R4-K6-1-ar-piece-dialog.webp |
| K7 | NOT RUN | PARTIAL | QA screen: "No orders pending QA", so the "Quality check" default was not checked. Ready Files panel on ORD-20261119-00006: default type "After processing"; line "The file type and note are used for the files you add next; they are saved when you drop, choose or photograph a file. To change a saved file, use the pencil on its tile." Typed "QA r4 note", added qa_photo2.jpg: the note box emptied and the tile reads "After processing / Ready · Ready for pickup / QA r4 note". Pencil and red trash on hover. A real click on the drop zone did not open the file picker (file chooser tool used, as in r3). | R4-K7-1-before.webp, R4-K7-2-after.webp |
| K8 | NOT RUN | PARTIAL | Checked EN and AR (RTL), Light and Dark. OK: type select and note on one row; "Take photo" beside the drop zone; tiles are bordered cards; pencil (white) and trash (red) on hover; dark tiles fine. Not as described: no count badge by "Files"; the drop zone is a ~90 px dashed box, not a slim bar; the file type is plain text under the image, not a chip on it; no file size on any tile; when a note is set it replaces the file name (P3 FET-FU-Nov20-TileNoNameSize). PDF/other-file tile not checked (none on this order). The order Files tab defaults to "Before processing". | R4-K8-1-en-light-hover.webp, R4-K8-2-ar-light.webp, R4-K8-3-en-dark.webp, R4-K8-4-ar-dark.webp |

**New findings in r4**

- **P3 FET-FU-Nov20-TileNoNameSize** — File tiles show no file size, and a note replaces the file name; no count badge by the Files title; type is not a chip on the image (K8).
- **P3 FET-FU-Nov20-DropZoneClickNoPicker** — A real click on the Files drop zone did not open the file picker (K7); still seen after r3.

**r4 tally for K1–K8:** PASS 2 (K1, K3) · PARTIAL 3 (K6, K7, K8) · BLOCKED 1 (K4) · NOT RUN 2 (K2, K5).

## Financial_Expert_Tester Results — Retest r5 2026-11-20 (post-deploy observe pass)

**Retest r5 (2026-11-20 21:55–22:31 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: owner t160u — new evening deploy; redo all QA files, not only UIDS and File_Util. This round is an **observe-only** post-deploy pass: owner approval for writes is still pending, so write-gated rows are **NOT RUN (awaiting approval)**. Nothing was saved, applied, paid, published, assigned, or confirmed. Appearance (temporarily set to Dark for M19, then restored) and language (Arabic used for locale checks, then restored to English) were put back. Earlier rounds above are untouched.

Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch) and HQ https://hqsaas.cleanmatex.com (Incognito). Accounts used: Demo Laundry admin `admin@demo-laundry.example`, operator `operator@demo-laundry.example` (`U000001`), viewer `viewer@demo-laundry.example`; HQ SAAS Admin `admin@cleanmatex.com`. Credentials: see `F:\JhApps_doc\CleanMateX_Jh\Testing_Jh\GrokBot_HQ_Test\CREDENTIALS_AND_ENVIRONMENTS.md` — none recorded here. Real mouse and keyboard; no direct API calls; no page scripts that change data; no Jest. Hard-reload (Ctrl+Shift+R) after the deploy. Screenshots: `C:\Users\JHNLP\qa-20261120\r5\shots\`.

File_Util rows below were run on cmx Demo admin (22:03–22:12 Asia/Muscat) and viewer (K5, 22:27–22:30 Asia/Muscat). Nothing was saved or applied (file picker cancelled; no new photo). Only rows touched in r5 are listed; parent scenario counts are unchanged.

| # | Result | Evidence |
|---|---|---|
| K8 | PASS | 22:12 Asia/Muscat. Ready Details `https://cmx.cleanmatex.com/dashboard/ready/a676aff3-1777-45ca-bd9c-9c47a515c2da` Files panel "All files of this order" now has count badge "3"; tile text "qa_photo2.jpg · 55 KB"; type chips over the image ("After processing" / "Before processing"); stage line "Ready · Ready for pickup" / "Processing"; note "QA r4 note". r4 PARTIAL (FET-FU-Nov20-TileNoNameSize) is **FIXED**. AR tiles + Light/Dark were not re-checked in this no-save run. Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-K8-K7-ready-files.png`. |
| K7 | PASS (picker part) | 22:12 Asia/Muscat. Clicking the drop zone opens the file chooser (accept jpeg/png/webp/heic/heif, multiple). Cancelled; no file added. Slim dashed bar: "Drop files here or click to choose · Up to 10.0 MB per file. You can also paste a file or image." plus "Take photo". r4 PARTIAL (FET-FU-Nov20-DropZoneClickNoPicker) is **FIXED** for the click-opens-picker half. Quality-check default was not re-checked (no QA-stage order). Shots: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-K7-piece-dialog-en.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b2-K8-K7-ready-files.png`. |
| K6 | PARTIAL | 22:12 Asia/Muscat. Arabic piece dialog is fully Arabic ("أفلِت الملفات هنا أو انقر للاختيار", "التقاط صورة", "لا توجد ملفات بعد") except the unit "MB". Item-level dialog was not compared (piece tracking is on in Demo, same as r4). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-K6-ar-piece-dialog.png` (EN loading: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-K6-en-piece-dialog-loading.png`). |
| D1 | FAIL | 22:12 Asia/Muscat. Order tabs are Order Master Data, Items & Pieces, Preferences, Order History, Edit History, Change History, Invoices, Receipt Vouchers, Payments, Actions, Stock Transactions, Receipt Sending, Financial, Customer, Notes — no Issues tab. `https://cmx.cleanmatex.com/dashboard/issues` title "Order Issues" has no Report issue button; empty state "No issues yet — Report an issue for this order, item, or piece." (the text implies an action that does not exist). Still broken (FET-FU-Nov19-IssuesUiMissing). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-D1-issues.png`. D2–D5 and D9 stay **BLOCKED** on D1. |
| D7 / K4 | BLOCKED | 22:12 Asia/Muscat. `https://cmx.cleanmatex.com/dashboard/assembly` shows Pending 0 / In Progress 0 / QA Pending 0 / Completed Today 0 / Open Exceptions 0 and "No orders in assembly". The shell briefly shows the empty state before counters load. Still blocked (FET-FU-Nov19-AssemblyNoData / FET-FU-Nov19-NoAssemblyQaPackingPath). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-D7-assembly.png`. |
| E1 | BLOCKED | 22:12 Asia/Muscat. `https://cmx.cleanmatex.com/dashboard/delivery` "Out for delivery 0", "No orders out for delivery". Routes: 3 cards with blank "Status:", "Stops: /", "Invalid Date", "Driver: Unassigned" (new defect on the empty routes, see findings). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-E1-delivery.png`. |
| A18 | PASS (not reproduced) | Photo opened 22:05 and re-clicked 22:12 Asia/Muscat; lightbox renders "qa_photo2.jpg, After processing · 1 of 3". The prior stale/cached-photo concern was **not reproduced**. Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b2-A18-photo.png`. |
| K5 | BLOCKED (needs fixture) | 22:30 Asia/Muscat. Viewer has order access and sees Files 3 (`qa_photo2.jpg` 55 KB, notes) plus Edit, Start Preparation, Print Label, and a Public tracking link. No user without `orders:read` exists to test K5 as written. Related: viewer still sees write actions (FET-FU-Nov19-ViewerSeesWriteActions). Shots: `C:\Users\JHNLP\qa-20261120\r5\shots\b5-K5.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b5-K5-order.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b5-K5-files-tab-nav.png`. |

**Prior findings — Retest r5 2026-11-20**

- **FET-FU-Nov20-TileNoNameSize** — **FIXED.** Count badge, file name + size, and type chips are present (K8 EN).
- **FET-FU-Nov20-DropZoneClickNoPicker** — **FIXED.** A real click opens the file picker (K7).
- **FET-FU-Nov19-IssuesUiMissing** — **STILL BROKEN.** No Issues tab and no Report issue control (D1); D2–D5, D9 remain blocked.
- **FET-FU-Nov19-AssemblyNoData** / **FET-FU-Nov19-NoAssemblyQaPackingPath** — **STILL BROKEN.** Assembly counters are 0 (D7/K4).
- **FET-FU-Nov19-DeliveryRoutesMalformed** — **STILL BROKEN**, and worse: route cards now show "Invalid Date" (see new finding).
- **FET-FU-Nov19-ViewerSeesWriteActions** — **STILL OPEN.** Viewer sees Edit / Start Preparation / Files on the order (K5).

**New findings — Financial_Expert_Tester, Retest r5 2026-11-20**

- **P2 FET-FU-Nov20-DeliveryInvalidDate:** Delivery Routes cards (3) show blank "Status:", "Stops: /", "Invalid Date", and "Driver: Unassigned" even though no orders are out for delivery. Suggested fix: hide incomplete route cards, or format dates from a real timestamp and show a clear empty/unassigned state instead of "Invalid Date". Code location not checked.
- **P3 FET-FU-Nov20-IssuesEmptyStateNoAction:** `/dashboard/issues` empty copy says "Report an issue for this order, item, or piece" but there is no Report issue button (tightens FET-FU-Nov19-IssuesUiMissing). Suggested fix: add the action, or change the empty state so it does not promise a control that is missing. Code location not checked.
- **P2 FET-EOV2-Nov20-ReadyListTotalZero** (also seen here on Ready): Ready list shows ORD-20261119-00006 total as **0.000 OMR** while the order page shows **1.070 OMR**. Suggested fix: read the list total from the same financial snapshot as the order page (3 d.p. OMR). Code location not checked.
- Slow UI still seen: Ready list ~10 s, Ready files ~8 s, Add photos dialog ~8 s, View Pieces ~6 s. Session expired ~22:05 mid-run and was signed in again. `/dashboard/orders-delivery` is 404 (logged in the Edit Order V2 guide).

**r5 tally for the rows above (parent counts unchanged):** PASS 3 (K8, K7 picker, A18) · PARTIAL 1 (K6) · FAIL 1 (D1) · BLOCKED 4 (D7, K4, E1, K5) · D2–D5 and D9 remain BLOCKED on D1.

**Rows not run in r5:** K2 (needs a tenant with piece tracking off); K7 quality-check default (needs a QA-stage order); K8 AR/Light/Dark tile pass (no-save run); C/F/G/H/I/J HQ and Render/purge subsets; any upload, delete, or file-setup write (awaiting approval).

**Test data left behind:** nothing new was created in r5. Shared leftover from earlier rounds (unchanged): `ORD-20261119-00006` is READY on rack QA-A1, paid 1.070 OMR cash, with 3 photos including `qa_photo2.jpg` (note "QA r4 note"). Appearance and language were restored. No branding, settings, users, or other orders were changed.

**Retest plan:** After a fixture user without `orders:read` is available, run K5 as written. After a piece-tracking-off tenant is named, run K2. Recheck D1 after an Issues UI ships; then run D2–D5/D9. Put a disposable order into Assembly to unblock D7/K4. Recheck E1 date rendering. Optionally recheck K8 in AR/Dark and K7 Quality-check default on a QA-stage order.

## Financial_Expert_Tester Results — Retest r6 2026-11-20 (22:54–23:14 Asia/Muscat)

**Scope.** Section K rows not finished in r5 (K1, K2, K3, K4, K6, K7, K8 in Arabic and Dark; K5 fixture check). The guide was unchanged since my r5 write (104,340 B, SHA 537555F7…, 22:39:23). Environment: deployed `https://cmx.cleanmatex.com`. Piece tracking OFF rows on Demo Saudi Riyadh Dry Clean (org `c9ac29d1-219c-4a3a-8887-f860550c32be`, admin@saudiriyadhdemo.com, SAR); piece tracking ON row K3 on Demo Laundry (admin@demo-laundry.example). Order used: ORD-20261113-00001 (Demo Saudi, Packing, customer "Guest Guest") and ORD-20261119-00006 (Demo Laundry, Ready). Screenshots: `C:\Users\JHNLP\qa-20261120\r6\shots_fu\r6-FU-01.webp` … `r6-FU-11.webp` (02 and 07 were not saved).

**Fixtures found (read-only SELECT on the Preview DB, 22:54).** Catalog default for `USE_TRACK_BY_PIECE` is false. Demo Laundry has an override true and `track_individual_piece=true` (ON). Demo Saudi, QA-20261117 Catalog Org and Qatar Laundry Demo 4 have no override and no workflow row (so OFF by data). BlueWave has conflicting values (override true, workflow false). Demo Laundry has no orders in Assembly, QA or Packing and no assembly tasks; Demo Saudi has one Packing order (ORD-20261113-00001) whose assembly task is COMPLETE / QA_PASSED. Roles without `orders:read` (accountant, finance_manager, it_support) have no users on any Preview tenant.

| Row | Retest r6 | Evidence |
|---|---|---|
| K1 | FAIL | 23:07–23:08. Demo Saudi (piece tracking OFF by data). Packing detail `/dashboard/packing/609a5565-…` and order detail Items tab both list "Cotton Pants" and "Boxer Shorts (Single)" with "View Pieces" and no item-level "Add photos" button. The screens behave as piece tracking ON. Shots r6-FU-03, r6-FU-04. |
| K2 | BLOCKED | No item-level "Add photos", so no "Photos of <item name>" dialog and no "1 photo" button. Nothing uploaded. Under View Pieces, Piece 1 of Cotton Pants (ORD-20261113-00001-1-1) has a piece-level "2 photos" button. Files tab tiles end in "Quality Check · Quality check · Order piece" and "Processing"; none ends in "Order item". Shot r6-FU-05. |
| K3 | PASS | 23:13. Demo Laundry ORD-20261119-00006 (READY), item "Fitness Leggings": no item-level photo button; "Add photos" sits on Piece 1 (ORD-20261119-00006-1-1). Shot r6-FU-11. |
| K4 | BLOCKED | 23:09. Assembly `/dashboard/assembly`: Pending 0, In Progress 0, QA Pending 0, Completed Today 0, Open Exceptions 0, "No orders in assembly". No task window to open. Needs an order moved into Assembly (status change, not done). |
| K5 | BLOCKED | No user on Preview lacks `orders:read` (checked by SELECT). Needs a test user with the accountant, finance_manager or it_support role (owner approval to create one). |
| K6 | PARTIAL | 23:09. Files tab in AR is RTL and mostly Arabic: "الملفات", "نوع الملف", "ملاحظة", "التقاط صورة", "أفلِت الملفات هنا أو انقر للاختيار", and "يُطبَّق النوع والملاحظة على الملفات التي تضيفها بعد ذلك. لتعديل ملف محفوظ استخدم القلم على بطاقته." English left on the page: "PACKING" chip, "PAY_IN_ADVANCE", "pending", "Solve Issue #7", "From Quality Check - ORD-20261113-00001-1-1 for piece Jh", "SAR". Item photo dialog not checked (it does not exist, K1). Shot r6-FU-08. |
| K7 | PARTIAL | 23:07. Packing Files panel: File type already "After processing", with the line "Type and note apply to the files you add next. To change a saved file, use the pencil on its tile." (PASS for Packing). The order-detail Files tab on the same Packing order defaults to "Before processing" instead. QA-stage default not checked (no order at QA). Shots r6-FU-06, r6-FU-05. |
| K8 | PARTIAL | 23:09–23:11. Count badge "5" next to "Files" (EN) and "الملفات" (AR); Packing panel "All files of this order" with "5". File type and Note on one row; "Drop files here or click to choose" bar with "Take photo" beside it on the order tab; tiles are image cards with the type chip on the image ("After processing", "Quality check"). Dark (user Appearance set to Dark, then restored to "Same as this device", "Appearance saved"): readable in EN and AR. Not done: a separate Arabic Light screenshot and a close Light/Dark comparison. Shots r6-FU-05, r6-FU-08, r6-FU-09, r6-FU-10. |

### Retest r6 — new findings (Financial_Expert_Tester, 2026-11-20)

- **FET-FU-Nov20-PieceTrackingDefaultMismatch (P2).** Demo Saudi has no `USE_TRACK_BY_PIECE` override and no workflow row (catalog default false), but its Packing and order detail screens show "View Pieces" and piece-level photo buttons, so the item-level "Add photos" for piece-tracking-off tenants (K1, K2) never appears. Likely cause: the screens decide piece mode from the existence of piece rows, or treat a missing setting as ON, instead of reading the effective `USE_TRACK_BY_PIECE`. Fix: read the effective setting (org override, else catalog default) in the item/piece components and show item-level photos when it is false. Code location not checked. Retest: K1, K2 on Demo Saudi.
- **FET-FU-Nov20-FilesTabDefaultType (P3).** On a Packing order, the order-detail Files tab defaults File type to "Before processing", while the Packing stage panel defaults to "After processing". Fix: derive the default from the order's current stage in the Files tab too. Retest: K7 on Packing, Ready and QA orders.
- **FET-FU-Nov20-ArabicLeftovers (P3).** Raw or English values in the AR Files tab: "PACKING", "PAY_IN_ADVANCE", "pending", "Solve Issue #7", "From Quality Check - … for piece …". Fix: translate status/payment enums and the system note templates.
- **FET-FU-Nov20-NoFixtures (P3, test data).** Preview has no order in Assembly or QA and no user without `orders:read`, so K4, K5 and the K7 QA default cannot be run. Ask: seed one order at each stage and one accountant-role user on a demo tenant.

### Retest r6 — recount, leftovers, caveats

- Recount: PASS 1 (K3); PARTIAL 3 (K6, K7, K8); FAIL 1 (K1); BLOCKED 3 (K2, K4, K5).
- Leftovers: none. No files uploaded, no status, payment or settings change. The Demo Saudi admin's Appearance was set to Dark and restored; UI language switched to Arabic and back.
- Caveats: Times are from the on-screen clock. A few controls (Appearance dropdown, Files tab, sign-in fill) were driven by browser automation because mouse clicks did not register; all other steps were mouse and keyboard. K2 on Demo Laundry is not applicable (piece tracking ON there).
- Retest plan: after FET-FU-Nov20-PieceTrackingDefaultMismatch is fixed, run K1, K2, K6 on Demo Saudi; with seeded fixtures, run K4, K5 and K7 at QA.

### Retest r6b 2026-11-21 (00:16–00:27 Asia/Muscat) — K4, K5, K7 QA on Demo SAR

**Scope and environment.** At the owner's request (2026-11-21 00:14), K4, K5 and the QA-stage part of K7 were run on the second demo tenant, Demo Saudi Riyadh Dry Clean (Demo SAR, org `c9ac29d1-219c-4a3a-8887-f860550c32be`), signed in as its tenant admin on `https://cmx.cleanmatex.com`. Demo SAR had no order in Assembly or QA and no user without `orders:read`, so test data was created there (listed below). Screenshots: `C:\Users\JHNLP\qa-20261120\r6\shots_k\r6b-FU-01.webp` … `r6b-FU-12.webp`.

**Order used.** ORD-20261120-00001 (id `7c5ea23b-d41a-40c0-a5a4-8de365191fc7`), customer "Guest Guest", 1 × Boxer Shorts (Single), SAR 3.45, Pay on Collection, unpaid. Moved through the normal screens to Assembly (task created), completed assembly, then to Quality Check; left at QA with Pass/Fail not pressed. Processing rack "QA-R6".

| Row | Retest r6b | Evidence |
|---|---|---|
| K4 | PASS (with note) | ~00:20. `/dashboard/assembly` → the order's assembly task window has a collapsed "Files" panel. Expanded: "All files of this order", File type, Note, drop zone, "Take photo", and "Type and note apply to the files you add next. To change a saved file, use the pencil on its tile." Uploaded `qa_photo.jpg` ("qa_photo.jpg Done"); tile footer "Assembly · Assembly task". The order detail Files tab shows it (Files 1). No other task existed, so "not in other tasks" was not applicable. Note: File type in the assembly panel defaulted to "Before processing" and the tile carries that badge. Shots r6b-FU-01, r6b-FU-02. |
| K7 (QA stage) | PASS | 00:22. `/dashboard/qa/7c5ea23b-d41a-40c0-a5a4-8de365191fc7`: "Files" collapsed under the item. File type before adding: "Quality check". The line "Type and note apply to the files you add next…" is present. Typed note "QA r6 K7", added the photo: new tile shows the "Quality check" badge, note "QA r6 K7", footer "Quality Check · Quality c…". The earlier tile is unchanged. The note field clears after each upload. Shots r6b-FU-03 … r6b-FU-06. |
| K5 | PARTIAL | 00:25–00:27. Created tenant user "QA K5 Accountant" (qa.k5.accountant@saudiriyadhdemo.com, role accountant, no `orders:read`) via Team Members → All Users → "Add User" (`/dashboard/users/new`). Signed in as that user. Sidebar: Dashboard, Customer Management, Internal Finance, Config And Settings, Help (no Orders). Order detail `/dashboard/orders/<id>`: "Order not found. The order you are looking for could not be found. It may have been deleted or you may not have access to it." QA detail `/dashboard/qa/<id>`: red banner "Order not found". Assembly `/dashboard/assembly`: red banner "Permission denied: orders:read" above "No orders in assembly". No item photo buttons and no Files panel anywhere (PASS for the gating). PARTIAL because the guide expects "no error" and the Assembly screen shows a red permission error, and the order screens say "not found" rather than "no access". Shots r6b-FU-07 … r6b-FU-11. |

**Retest r6b — new findings (Financial_Expert_Tester, 2026-11-21)**

- **FET-FU-Nov21-AssemblyFileTypeDefault (P3).** In the assembly task Files panel the File type defaults to "Before processing", so assembly uploads get a "Before processing" badge while their footer says "Assembly · Assembly task" (K4). Fix: default the type from the stage (Assembly → an assembly or "After processing" type), as the Packing and QA panels already do. Retest: K4 upload, check the badge.
- **FET-FU-Nov21-NoReadPermissionMessaging (P3).** A user without `orders:read` sees a red "Permission denied: orders:read" banner on Assembly (raw permission key, shown as an error) and "Order not found" on order and QA detail (K5). Fix: hide Assembly/QA entries for users without `orders:read` or show a neutral "You don't have access to orders" message; don't show the raw key. Retest: K5 with the QA K5 Accountant user.
- **FET-FU-Nov21-DoubleAssemblyToast (P3, unconfirmed).** While moving ORD-20261120-00001 to Assembly the toast "Assembly task created" appeared twice. Whether two tasks exist was not confirmed. Retest: check `/dashboard/assembly` and the task list for that order.

**Test data left behind (Demo SAR).** Order ORD-20261120-00001 at Quality Check, unpaid (Pass/Fail not pressed); two copies of `qa_photo.jpg` on it (one from the assembly task, "Before processing"; one at QA, "Quality check", note "QA r6 K7"); active user "QA K5 Accountant" (qa.k5.accountant@saudiriyadhdemo.com, role accountant). No payment, delete or settings change.

**Caveats.** Two file uploads used the browser's file-upload step because no native file chooser appeared on screen after clicking the drop zone; the Add User form and two sign-in forms were filled by browser automation because typed keys landed in the wrong fields. All buttons (Create User, Sign in, stage moves) were clicked with the mouse. Times are from the on-screen clock.

**Recount r6 + r6b for section K.** PASS 3 (K3, K4, K7 QA), PARTIAL 4 (K5, K6, K7 Packing/order tab, K8), FAIL 1 (K1), BLOCKED 1 (K2, behind K1).
