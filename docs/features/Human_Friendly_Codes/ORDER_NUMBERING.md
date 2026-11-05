# Order Numbering (P2, Human-Friendly Codes)

Status: P2, P2.1 and P3 applied 2026-10-31 (P3 line and piece codes `0682`, `0683`, applied by the user); P2.2 (HQ create, app only) written 2026-10-31; P3b scan (app only) written 2026-10-31, WAITING FOR USER (deploy/test). Migrations `0674_ord_order_no_engine.sql`, `0677_ord_root_order_id.sql` (P2.1). Plan: `IMPLEMENTATION_PLAN_Human_Friendly_Codes.md` §5.8, §5.8.1, decisions A-19, A-28..A-31. Engine: `DEV_GUIDE_DOC_SEQ_ENGINE.md`.

## Format

| Kind | Format | Example |
|---|---|---|
| Order | `ORD-<YYYYMMDD in the tenant time zone>-<seq, pad 4, grows past 9999>` | `ORD-20261030-0007` |
| Sub-order (split) | `<root order_no>-S<n>`, n = 1, 2, … under the root | `ORD-20261030-0007-S2` |

- The sequence resets every tenant day and never repeats; a rolled-back create gives its number back (no gaps).
- A split of a sub-order is numbered under the root: splitting `…-0007-S2` gives `…-0007-S3`.
- `order_no` is immutable after insert (`trg_ord_no_guard`).

## Family root (`root_order_id`, A-28, P2.1)

- `org_orders_mst.root_order_id`: NULL on a root order; on every sub-order the id of the family root (also for a sub-order of a sub-order). `parent_order_id` stays the order it was split from (history).
- Filled on INSERT by `trg_ord_root_guard` from the parent (same tenant), validated, then immutable (`ORD_ROOT_*` errors, DEV_GUIDE §16). Tenant-safe FK `fk_ord_root_order`, index `idx_ord_root_order`.
- `fn_ord_next_sub_order_no` reads the root from it, locks the root row and counts `-S<n>` over `root_order_id = root` (no parent walk).
- Family of an order: `SELECT * FROM org_orders_mst WHERE tenant_org_id = $1 AND (id = $2 OR root_order_id = $2)` with `$2 = COALESCE(root_order_id, id)`.

## How a number is taken

| Path | Where |
|---|---|
| Order create (web-admin) | `generateOrderNumberWithTx(tx, tenantId)` inside the create transaction, just before the header INSERT. Calls `generate_order_number(tenant)` → `fn_doc_seq_next(tenant, 'ORDER')`. |
| Any INSERT with an empty `order_no` | `trg_ord_no_assign` fills it from the engine. |
| Split | `nextSubOrderNoWithTx(tx, tenantId, parentId)` → `fn_ord_next_sub_order_no(tenant, parent)` (locks the root row found via `root_order_id`). |

Code: `web-admin/lib/services/order-numbering/` (format helpers + service). `web-admin/lib/utils/order-number-generator.ts` is a compatibility shim; new code imports `@/lib/services/order-numbering`.

Rules (DEV_GUIDE §13): keep the numbering transaction short, take the number last, no HTTP, queue, e-mail or PDF work before COMMIT. Same-tenant creates wait for each other until COMMIT (box: about 7k creates/s on one tenant).

## Split (A-29)

`web-admin/lib/services/order-split.service.ts` → `splitOrderUnits()`. `OrderService.splitOrder` and `splitOrderByPieces` delegate to it; route `POST /api/v1/orders/[id]/split`.

- One Prisma transaction (`lock_timeout 5s`): lock parent (reads `parent_order_id`, `root_order_id`), lock lines, validate units, take the sub-order number, create the sub-order header and lines, write bookkeeping, history row `SPLIT`, recalc the sub-order snapshot.
- Only moves (A-29, user decision): money stays on the parent. Sub-order lines are priced 0 and carry `metadata.split_from_order_id`, `split_from_item_id`, `split_root_order_id`, `split_piece_seqs`, `money_on_parent: true`.
- Before COMMIT the service re-reads the new sub-order's `root_order_id` and fails closed (`NUMBERING_FAILED`) if it is not the expected root. The result and the `SPLIT` history payload carry `rootOrderId` / `root_order_id`.
- Parent lines get `metadata.split_out_qty`, `split_out_piece_seqs`, `split_log`; pieces get `metadata.split_to_order_id`, `split_to_order_no`. Parent header gets `has_split = true`. Quantities, prices and totals on the parent do not change.
- Refused: closed/delivered/cancelled orders, units already split out, splitting every remaining unit (`ORD_SPLIT_WHOLE_ORDER`).
- Error codes (`ORDER_SPLIT_ERRORS`) map to HTTP 400 / 404 / 409 / 500 in the route; the response carries `errorCode`.

## Checks

```sql
SELECT order_no FROM org_orders_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5;
SELECT * FROM org_doc_seq_mst WHERE tenant_org_id = $1 AND doc_type_code = 'ORDER' ORDER BY period_key DESC LIMIT 5;
SELECT * FROM vw_doc_seq_consistency WHERE doc_type_code = 'ORDER';
```

Sorting by `order_no` in lists uses `created_at` then `order_no` (text sort breaks once a day passes 9999).

## Known limits / follow-ups

- Sub-orders have no piece rows; pieces stay on the parent with a pointer (Order_Fin follow-up).
- The stage worklist still sorts `order_no` as text.
- Tenant hard delete (0678, A-31): only a tenant in status `creating` (still being created) can be deleted; the DB trigger removes its counters first. The web-admin signup rollback (`registerTenant`) and, since P2.2, the HQ create rollback (`TenantsService.create`) rely on it; no other path deletes or resets counters (A-24).
- A deleted uncommitted root leaves deeper sub-orders without a root: splitting under them fails with `ORD_ROOT_INCONSISTENT` until repaired (DEV_GUIDE §16).

## Line and piece codes (P3, migrations `0682`, `0683`)

- Line serial `order_item_srno` = `<order_no>-<n>`, unique per tenant, set once. `n` = 1 + the highest `n` of the order (removed lines count, so a number is never reused). The DB trigger and every app writer (`lib/db/orders.ts`, `OrderService.updateOrder`, order-change ADD_ITEM, split) take the same per-order advisory lock `ord_item_srno:<order_id>` (`lib/services/order-item-code.service.ts`).
- Sub-order lines: `<sub order_no>-<k>`, with `metadata.split_from_item_srno` pointing at the parent line.
- Line `barcode` stores the plain serial; labels draw the image at print time (no data: URLs, `ck_ord_item_barcode_val`).
- Piece code `piece_code` = `<order_item_srno>-<piece_seq>` (e.g. `ORD-20261101-0007-2-3`), set by the DB trigger, unique per tenant, immutable.
- External tag = piece `barcode` (A-35..A-38):
  - stored trimmed and upper-case, only `A-Z 0-9 - _ . /`, 1..64 characters (`ck_ord_piece_barcode_fmt`; the DB trigger `trg_ord_piece_tag_rules` normalises);
  - never shaped like one of our codes: any `sys_doc_seq_type_cd` prefix / type_prefix (so order, line and piece codes, and `CMX1:` payloads) followed by a digit is refused (`PIECE_TAG_LOOKS_LIKE_CODE`);
  - unique per tenant among live pieces of open orders; freed when the piece is removed or the order becomes delivered, closed or cancelled (`tag_released_at`, set by `trg_ord_piece_tag_release` on `org_orders_mst`); the old piece keeps the value as history;
  - batch-update checks every tag first and saves nothing on a problem: 400 `PIECE_TAG_INVALID` / `PIECE_TAG_LOOKS_LIKE_CODE`, 409 `PIECE_TAG_IN_USE` (with `heldByPieceCode`) / `PIECE_TAG_DUPLICATE_IN_BATCH`, all listed in `issues[]`; a clash at the same instant returns 409 with `piecesUpdated`.
- Pre-checks, repairs and apply order: DEV_GUIDE §17 (applied 2026-10-31). Accepted choices: plan A-39 (closed orders free tags; a reopened order keeps them released; `U` / `Z` prefixes refused; release trigger `SECURITY DEFINER`; piece `PATCH` uses the batch-update tag checks).
- Scanning any of these codes or a tag (P3b): `SCAN_AND_PIECE_CODES.md`.

## Search by number (P3b T3.9)

- `orderNoFromCode(raw)` (`lib/validations/code-format-schemas.ts`) reduces a full order, line or piece code to its order number (`ORD-…-0007-2-3` → `ORD-…-0007`; a sub-order keeps `-S<n>`); free text and tags give null.
- When it returns a number, the orders list (`GET /api/v1/orders`, `listOrders`) searches only `order_no = <no>` OR `order_no LIKE '<no>-S%'` (the order and its sub-orders) for the tenant, instead of the slow text search.
- The orders search box first asks the scan resolver and opens the order straight away; on a miss it runs the list search.
