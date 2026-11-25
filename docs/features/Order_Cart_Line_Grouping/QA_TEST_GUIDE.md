# Order Cart Line Grouping — QA Test Guide

Nothing is testable yet (no phase built). These are the planned checks; each phase marks its own as ready.

Page: **Dashboard → Orders → New Order** (`/dashboard/orders/new`), and **Edit Order** on a saved order. Run each block once in EN and once in AR (RTL).

## P1 — line identity (expect: nothing looks different) — ✅ ready to test
1. Add 2 different products, change quantity, preferences, notes, price override, discount, line speed on each. Expected: only the line you touched changes. Totals as before.
2. Submit, open the order in Edit, change one line. Expected: only that line is in the review list.
2a. New Order: add a product, give its 2 pieces notes or stains, then add the same product again from the grid or Repeat last order. Expected: 3 pieces, the first 2 keep their notes (before P1 they were wiped).
2b. Edit Order: open the price override from a cart line (pencil). Expected: the dialog shows that line's current price and saving changes it (before P1 the dialog could not find the line in Edit).
2c. Edit Order: change nothing, then change one thing and undo it. Expected: Save/Review is enabled only while something really differs.

## P2 — add rule
3. Tap Turtleneck twice. Expected: one line, quantity 2 (as today).
4. Set a price override on that line, tap Turtleneck again. Expected: a **new** line at catalog price; the override line stays at 2.
5. Same as 4 with a line discount, then with a line speed. Expected: a new line each time.
6. Tap a measured product (e.g. Delicate Cardigan (Meter)) twice, entering 2.5 m then 4 m. Expected: two lines, each with its own measure, no choice step (measures differ). Card badge = 2.
6a. Tap it again and enter 2.5 m. Expected: the dialog shows "A line with this measure is already in the order", with **Add to line 1 — Becomes 2 pieces · 5 m** and **Add as a new line**. Choose Add to line 1 → line 1 shows 2 pieces, 5 m, and the server price for 5 m.
6b. Repeat 6a, choose **Add as a new line** → a separate 2.5 m line.
6c. Give line 1 a price override, then enter 2.5 m again. Expected: no choice step (line 1 is closed) → new line.
6d. Product with a minimum billable measure: the choice step shows the note "The minimum and billing step apply to the line total."
6e. Regression for today's gap: card `+` on a measured product in the cart always opens the measure dialog; it never adds a piece without a measure.
6f. AREA product (if one exists): equal length × width never shows the choice step.
6g. *(Measured Pricing owns this fix, DESIGN §0; re-check here after P2.)* Step 2) Order Items: on a measured line press `+` (or "Add piece"). Expected: the measure dialog opens: "Pieces changed from 2 to 3. Check the total measure." with the current total filled in. **Cancel** → the piece count goes back to 2. **Confirm** without changing → 3 pieces, same measure (allowed, e.g. an extra bag).
6h. Merge two 2.5 m pieces (6a), then on that line choose **Move one piece to a new line**. Expected: line 1 = 1 piece · 2.5 m, new line below = 1 piece · 2.5 m.
6i. A measured line with 3 pieces and 7 kg: **Move one piece to a new line** is disabled with "This line's measure can't be divided into equal shares…".
6j. Order Edit on a saved order with a measured line (setup: **HQ → Order Edit policy** has rules for Change Item Quantity, Add Piece and Change Item Measure at this stage). Add the same product with the same per-piece measure. Expected: the choice shows **Add to line 1 (agreed price …)** and **Add as a new line (today's price …)**. Choose add to line 1 → Review lists quantity, piece and measure changes → Apply succeeds. Remove one of the three HQ rules → the choice step no longer appears; the article becomes a new line.
6k. *(Label built by Measured Pricing P6/P8, DESIGN §0; check here once both are live.)* Customer-facing: create an order with Turtleneck ×1 at Express and Turtleneck ×1 at the order speed, and two identical 2.5 m measured lines. Check the WhatsApp/email receipt text, the printed receipt, the order details print, the tracking page and the customer app order screen. Expected: "Turtleneck Sweater · Express", "Turtleneck Sweater", "… · 2.5 m (1)", "… · 2.5 m (2)", in EN and AR.
7. Card `−` on a product with two lines. Expected: the most recently added line loses one piece (or is removed if it had one). On a measured product, a confirm appears first.

## P3 — move piece
8. Turtleneck quantity 2 → piece 2 menu → **Move to a new line**. Expected: two lines "Turtleneck Sweater · Line 1 / Line 2", piece keeps its notes and preferences, both lines re-priced by the server.
9. Give line 2 its own speed (ITEM-level tenant). Submit. Expected: order saved with two lines; order detail and receipt show both.
10. Piece on line 2 → **Move to line 1**. Expected: line 2 disappears, line 1 quantity 2.
11. ITEM-level tenant: piece rows show the hint "Need a different speed, price or discount…". PIECE-level tenant (HQ switch): per-piece speed and discount shown instead.
12. Edit Order: a **saved** piece's move action is disabled with the reason shown; a piece added during this edit can move.
13. Measured and custom lines show no move action.
14. Move a piece out of a line that has a price override. Expected: the menu item says "Leaves Line 1's price" before you click; after the move a confirmation "Moved to line 2" appears and the new line sits right below line 1.
15. Edit Order on an order with two lines of the same product: change only line 2's quantity. Expected: the screen shows unsaved changes, and the review lists only line 2.

## P4 — move a saved piece (Order Edit)
Setup (HQ): **HQ → Order Edit policy** → add a rule allowing **Move Piece** (`MOVE_PIECE`) for the order stage you test. Without the rule the move must stay disabled with the policy reason.
16. Saved order, Turtleneck 2 pieces → Edit → piece 2 → Move to a new line → Review → Apply. Expected: two lines; piece keeps its barcode and piece code; both lines re-priced; change history shows the move.
17. After 16, Labels / tags screen: the moved piece shows as "tag to print"; the reprinted tag shows the new line and piece number.
18. Move the only piece of a line into another line. Expected: the empty line is removed.
