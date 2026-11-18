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

## F. Not testable yet

- Storage purge of deleted files runs in the HQ `platform-workers` job `file-util-purge` — needs that worker deployed.
