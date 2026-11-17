# File Util — QA Test Guide (owner-runnable)

**Covers:** Phase 4 (order photos and files). Updated after each phase.
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

## C. Not testable yet

- Storage purge of deleted files runs in the HQ `platform-workers` job `file-util-purge` — needs that worker deployed.
- Product images, logo, customer photos and other screens: Phases 5–6.
