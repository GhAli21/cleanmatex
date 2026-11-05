# Scan and Piece Codes (P3 + P3b, Human-Friendly Codes)

Status: P3 (DB: `0682_ord_item_srno_barcode.sql`, `0683_ord_piece_code_human.sql`) applied by the user 2026-10-31 (local + remote). P3b (app only, **no migration**) code done 2026-10-31 (second slice with A-41..A-44 the same day), WAITING FOR USER (deploy/test). T3.9b (chips on the remaining station screens, pieces-panel filter) done 2026-10-31.
Plan: `IMPLEMENTATION_PLAN_Human_Friendly_Codes.md` §1, §19 (R17–R25), §20 (A-11, A-14, A-25, A-35..A-44), §21 (T3.x). Numbering: `ORDER_NUMBERING.md`. Apply and checks: `DEV_GUIDE_DOC_SEQ_ENGINE.md` §17–§18.

## 1. Codes

| What | Format | Example | Where |
|---|---|---|---|
| Order | `ORD-YYYYMMDD-NNNN`, sub-order `…-S<n>` | `ORD-20261101-0007`, `ORD-20261101-0007-S1` | `org_orders_mst.order_no` |
| Line | `<order_no>-<n>` (never reused) | `ORD-20261101-0007-2` | `org_order_items_dtl.order_item_srno`, line `barcode` = same value |
| Piece | `<line code>-<piece_seq>` (immutable) | `ORD-20261101-0007-2-3` | `org_order_item_pieces_dtl.piece_code` |
| External tag | trimmed, UPPER-case, `^[A-Z0-9._/-]{1,64}$`, never shaped like a code | `HT-0042` | piece `barcode` |
| Staff QR | `CMX1:<TYPE>:<code>`, TYPE = doc type `type_prefix` (3–5 letters: `ORD`, `ITM`, `PEC`) | `CMX1:PEC:ORD-20261101-0007-2-3` | `lib/services/scan-resolve/cmx-code-payload.ts` |

Tag rules (A-35..A-39): unique per tenant among live pieces of open orders; freed when the piece is removed or the order becomes delivered, closed or cancelled (`tag_released_at`, trigger `trg_ord_piece_tag_release`, `SECURITY DEFINER`); a reopened order keeps them released; tags starting with any registry prefix (incl. one-letter `U`, `Z`) plus a digit are refused.

## 2. Resolving a scan

`ScanResolveService.resolve(supabase, tenantId, raw, context)` (`lib/services/scan-resolve/scan-resolve.service.ts`). Every query filters `tenant_org_id`.

1. `normalizeScanInput` (trim, strip control characters), max 128 characters, then upper-case.
2. `classifyCode`: `CMX` payload → its inner code; order / line / piece shape → lookup by that code (`matchedBy` `ORDER_NO`, `ITEM_SRNO`, `PIECE_CODE`, or `CMX_QR`).
3. Anything else → live external tag (`matchedBy: EXTERNAL_TAG`). Code-shaped input is never tried as a tag.
4. Removed pieces are found by their code (`piece.removed: true`) but never by a tag.

Result `ScanResult`: `kind` (`ORDER` | `ORDER_ITEM` | `PIECE`), `matchedBy`, `code`, `context`, `order {id, orderNo, status, branchId, parentOrderNo?}`, `item? {id, srno, name, name2}`, `piece? {id, itemId, pieceSeq, pieceCode, externalTag, status, removed}`.

## 3. APIs

| Endpoint | Permission | Input | Success | Errors |
|---|---|---|---|---|
| `POST /api/v1/scan/resolve` | `orders:read` | `{ raw, context? }`, context `assembly|qa|packing|pickup|intake|any` (default `any`) | `{ success, data: ScanResult }` | 400 `VALIDATION_ERROR` / `SCAN_INVALID`, 404 `SCAN_NOT_FOUND`, 409 `SCAN_AMBIGUOUS` (guard only), 422 `SCAN_UNSUPPORTED_PAYLOAD`, 429 |
| `GET /api/v1/orders/lookup?code=` | `orders:read` | order number | `{ data: { order } }` | 400 `VALIDATION_ERROR`, 404 `ORDER_NOT_FOUND`, 429 |
| `GET /api/v1/orders/pieces/lookup?code=` | `orders:read` | piece code, `CMX1:` QR or tag | `{ data: { piece, item, order, matchedBy } }` | 400, 404 `PIECE_NOT_FOUND`, 429 |
| `PUT /api/v1/orders/pieces/:pieceId/external-tag` | `orders:update` + CSRF | `{ tag }` | updated piece | 400 `PIECE_TAG_INVALID` / `PIECE_TAG_LOOKS_LIKE_CODE`, 409 `PIECE_TAG_IN_USE` (`heldByPieceCode`), 409 `PIECE_TAG_ORDER_CLOSED`, 409 `PIECE_TAG_PIECE_REMOVED`, 404 `PIECE_NOT_FOUND` |
| `DELETE /api/v1/orders/pieces/:pieceId/external-tag` | `orders:update` + CSRF | — | tag cleared (allowed on closed orders) | 404 `PIECE_NOT_FOUND` |
| `POST /api/v1/orders/:id/items/:itemId/pieces/scan` | as before | as before | same response, now via the resolver (piece code, QR, tag) | as before |
| Assembly scan (`AssemblyService.scanItem`) | as before | as before | same response; own barcodes first, then the resolver (context `assembly`): piece / line code, `CMX1:` QR or live tag of the task's order → its pending assembly item (A-42) | removed piece, other order, order-only code → "not found" as before |
| `GET /api/v1/orders?search=` | as before | a full order / line / piece code | exact `order_no` and its sub-orders (fast path) | as before |
| `PATCH /api/v1/orders/:id/items/:itemId/pieces/:pieceId` | as before | `barcode` checked like batch-update | | same tag body and status as batch-update |

Another tenant's code and a missing code both return 404 (no enumeration). Rate limit: `scan-user`, 600 requests per minute per user (`checkScanRateLimit` in `lib/middleware/rate-limit.ts`); it fails open without Upstash, like the other limiters.

## 4. UI

| Piece | Path | Notes |
|---|---|---|
| `useKeyboardWedge` | `lib/hooks/use-keyboard-wedge.ts` | Page-wide scanner listener. Reads `KeyboardEvent.code` (works on Arabic layouts), only outside text fields, ≥ 4 characters, ≤ 50 ms between keys, ends on Enter / Tab, same value ignored for 800 ms. |
| `CmxScanInput` | `src/ui/forms/cmx-scan-input.tsx` | Scan field: reads on Enter, clears after each scan (also a failed one), status `CmxScanStatus`. Used by `PieceBarcodeScanner` and `assembly-scanner`. |
| `CmxCodeChip` | `src/ui/data-display/cmx-code-chip.tsx` | Monospace code chip, LTR inside RTL, copy button. |
| `CmxCodeSearchInput` | `src/ui/forms/cmx-code-search-input.tsx` | Search box that spots a code (`toCodeSearch`). Used by the orders list (`order-filters-bar.tsx`): a full code opens the order via the resolver, else the list search. |
| Codes on screens (T3.9) | order page header (+ "Part of …" link for a sub-order), `order-items-list.tsx` (line chip), `PieceBaseCard` (piece code + live tag chips), gift-card log | `CmxCodeChip`; labels from `codes.json`. Order / piece UUID shortening removed. |
| `?piece=` highlight | `src/features/orders/lib/piece-highlight.ts`, `order-detail-client.tsx`, `order-items-list.tsx`, `OrderPiecesManager`, `PieceList` | Piece id or piece code; opens the items tab, the line and the page, scrolls to the piece, ring + `aria-current` + sr-only "Opened from scan". |
| Global scan | `src/features/scan` | `GlobalScanTrigger` in `cmx-top-bar` (button + `Ctrl+Shift+F` / `Cmd+Shift+F` + page-wide wedge), `GlobalScanDialog` (result card, Open order / piece → `/dashboard/orders/{id}?piece={pieceId}`), `LinkTagDialog` (link / change / remove tag). |

Feature flag: `human_codes_scan_labels` (default off; read by raw key, hidden while loading). It joins the flag catalog in P6.
i18n: `messages/{en,ar}/scan.json`, `messages/{en,ar}/codes.json` (glossary: order number, line code, piece code, tag, part of, opened from scan), `orders.pieces.errors.pieceNotFound`, `orders.pieces.scanHint`. Arabic terms: رقم الطلب, رمز القطعة, البطاقة.
Accessibility: `jest-axe@^10` (Jest 29); `CmxDialog` is named by its title and described by its description (A-44), and the scan dialog axe test runs the full rule set.

### 4.1 Printed codes (P4, 2026-10-31; `0685` applied 2026-10-31)

Labels carry the same codes the scanners read: CODE128 of `order_no` / line code / `piece_code` (hyphens kept) and the staff QR `CMX1:ORD:<order_no>` (piece tags: `CMX1:PEC:<piece_code>` when the piece-tag QR option is on). Data: `GET /api/v1/orders/[id]/label-data`; rendering: `@ui/print` (`CmxBarcode`, `CmxLabelRenderer`). Sizes and options come from the label config (`fn_label_printing_resolve`, branch → tenant → system; Settings → Labels & Tags, A-46..A-49); label printing is available to every tenant (no `label_printing` check). The scan UI is still behind `human_codes_scan_labels`, which also caps the receipt barcode. Sizes, options, printer setup: `USER_GUIDE_LABELS.md`.

## 5. Tests

- `__tests__/validations/code-format-scan-schemas.test.ts` (scan schemas, `classifyCode`).
- `__tests__/services/scan-resolve/scan-resolve.service.test.ts`, `cmx-code-payload.test.ts`, `__tests__/services/piece-code/update-piece-tag.test.ts`.
- `__tests__/api/scan/scan-routes.test.ts`, `external-tag-route.test.ts` (incl. CSRF).
- `__tests__/ui/scan/use-keyboard-wedge.test.tsx`, `scan-ui-components.test.tsx`, `global-scan.test.tsx` (incl. axe, dialog name), `codes-on-screens.test.tsx` (`orderNoFromCode`, `?piece=` helpers and highlight, chips, orders search jump), `codes-on-stations.test.tsx` (T3.9b: pieces filter, report chips, copy without opening the row).
- `__tests__/ui/overlays/cmx-dialog-a11y-name.test.tsx`; `__tests__/services/assembly-service.test.ts` (resolver fallback, A-42).

## 6. Open items

- None for P3b. Closed 2026-10-31 (T3.9b): order-number chips on the station, pickup, delivery, home-collection and report screens, receipt print as LTR monospace, reconciliation N/A (no order numbers shown), pieces-panel filter by piece code or tag.
- Closed 2026-10-31: `?piece=` highlight, order search fast path, UUID shortening on order screens, assembly scan via the resolver (A-42), `Ctrl+Shift+F` kept (A-41), limit kept (A-43), `CmxDialog` name (A-44).
