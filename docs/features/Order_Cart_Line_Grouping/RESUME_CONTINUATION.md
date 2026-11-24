# Order Cart Line Grouping — Resume Here

**State (2026-11-25):** design approved ([DESIGN.md §11](DESIGN.md#11-owner-decisions-recorded-2026-11-25)), no code written. Ready for P1.

## What this is
Let one product have several lines in an order (New Order + Order Edit), so garments of the same product can get their own price, measure, and (at ITEM commercial level) speed or discount. No screen-wide switch: an add rule plus a "Move to a new line" action.

## Next step
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

- Review B1–B5 (DESIGN §13.2) is part of P2: §4.2 re-measure on every piece-count change of a measured line; §4.3 exact one-share split; §4.4 Edit prices; §4.5 combined Edit DB test; §8.1 customer line qualifier (`lib/orders/line-qualifier.ts`, shared with Measured Pricing P6, coordinate with that session before creating it).

## Gates per phase
`npm run build`, `npx eslint . --quiet`, `npm run check:i18n`, `npm run check:ui`, `/cmx-ui-design-review`, targeted jest. Update STATUS.md, QA_TEST_GUIDE.md and this file.
