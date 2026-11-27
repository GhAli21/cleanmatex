# Order Cart Line Grouping — Resume Here

**State (2026-11-27):** P1 and P2 done in code (P1 committed; P2 owner QA + commit left, STATUS.md log). Next: P3 (move a piece between lines of one product, ITEM-level hint), then PF, then P4 after QA.

## What this is
Let one product have several lines in an order (New Order + Order Edit), so garments of the same product can get their own price, measure, and (at ITEM commercial level) speed or discount. No screen-wide switch: an add rule plus a "Move to a new line" action.

## P2 facts for P3
- The add rule lives in `model/cart-line-grouping.ts`; the reducer never merges on its own (`ADD_ITEM` needs `mergeInto`).
- `SPLIT_MEASURED_SHARE` is the measured-only move; P3's `MOVE_PIECE` is for count lines and must keep the piece id stable (piece ids are still `temp-<lineKey>-<seq>`; the split renames the moved piece to `temp-<newLineKey>-1`).
- Line numbers come from `productLineNumber`; the cart and steps 2–4 already show them.

## P1 facts for P2/P3
- `LineKey` is branded: passing a product id where a line is meant does not compile. Comparing a `LineKey` with a string still compiles, so grep `productId ===` in cart code after each change.
- `**/*.test.ts` is not type-checked by `tsconfig.json`; type-check new `.test.ts` files with a temporary config.
- The product grid still works per product through `handleGridQuantityChange` / `handleGridRemoveItem` (`new-order-content.tsx`): they act on the product's first line. P2 replaces them with Σ quantity + LIFO (DESIGN §7).
- `ADD_ITEM` still merges by product (P1 rule); P2 replaces it with `resolveCartAddTarget`.
- Piece ids are `temp-<lineKey>-<seq>`; P3's move must keep a moved piece's id stable (DESIGN §6.1).

## Next step (historical: P1)
P1 (line identity), no behaviour change. Load `/frontend`, `/order-fin`, `/code-documentation` first. Start from DESIGN §6.2's list. Write reducer tests with **two lines of the same product** for every action before switching each action.

## Facts to rely on (verified 2026-11-25)
- Server and DB accept repeated product lines (DESIGN §3). No migration for P1–P3.
- Tenant `commercial_level` ITEM/PIECE is HQ-set; all live tenants are ITEM.
- Edit server change codes have no `MOVE_PIECE` → P4 needs a catalog migration here; HQ needs only a policy rule (no HQ code).
- "Split" is taken (order → sub-order). Use "move".
- A measured line's measure is the **line total** (not per piece); min billable and billing step apply to the total. Merging a measured article = quantity + 1 **and** measure + entered (DESIGN §4.1). AREA never merges.
- Existing money gap to close in P2: card `+` on a measured product in the cart adds a piece without a measure (free garment), `product-grid.tsx:303`.

- Plan audit 2026-11-25 (DESIGN §13): also fix `lib/order-edit-dirty.ts` (matches by product) and 4 React lists keyed by `productId` in P1. P4: catalog rows in `sys_oc_order_edit_ops_cd` / `sys_oc_order_edit_op_tgt_cd`; HQ needs only a policy rule; clear `tag_released_at` on a moved piece.

- **Closing gate PF (DESIGN §9.2):** before marking the program done, measure order-create (3 shapes) and batch the piece writes only if it misses the target. Owner requested it 2026-11-25.

- **Ownership with Measured Pricing (DESIGN §0):** MP owns §4.2 (free-garment fix) and §8.1 (line label helper, its P6/P8). This program owns §4.1, §4.3–§4.5 (in P2). During P1, MP stays off `new-order-reducer.ts`, `use-new-order-state.ts`, `new-order-content.tsx`, `edit-workspace-adapter.ts`, the measure dialog; tell that session when P1 is done.

## Gates per phase
`npm run build`, `npx eslint . --quiet`, `npm run check:i18n`, `npm run check:ui`, `/cmx-ui-design-review`, targeted jest. Update STATUS.md, QA_TEST_GUIDE.md and this file.
