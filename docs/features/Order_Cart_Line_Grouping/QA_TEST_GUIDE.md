# Order Cart Line Grouping — QA Test Guide

All phases below are built. Work top to bottom: set up first, then test, then commit.

Page: **Dashboard → Orders → New Order** (`/dashboard/orders/new`), and **Edit Order** on a saved order. Run each block once in EN and once in AR (RTL).

## Before testing — your steps

### A. HQ Edit policy rules (needed for the Order Edit checks)
HQ → **Order Change Config → Edit policies** (`/order-change-config/edit-policies`). Open a new draft of the policy your test organization uses, add these rules for the order stage you test, then publish it.

| Change | Target |
|---|---|
| Add Item | Order |
| Change Item Quantity | Item |
| Add Piece | Item |
| Remove Piece | Piece |
| Change Item Measure | Item |

A missing rule refuses the change. No "Move Piece" rule is needed (saved pieces can't move).

### B. Testing order
1. Run `npm run dev` in `web-admin` and test the blocks below (P1, P2, P3, PF) in EN, then once in AR.
2. Note any failure with the check number.
3. Commit the Line Grouping files when the checks pass.

## P1 — line identity (expect: nothing looks different) — ✅ ready to test
1. Add 2 different products, change quantity, preferences, notes, price override, discount, line speed on each. Expected: only the line you touched changes. Totals as before.
2. Submit, open the order in Edit, change one line. Expected: only that line is in the review list.
2a. New Order: add a product, give its 2 pieces notes or stains, then add the same product again from the grid or Repeat last order. Expected: 3 pieces, the first 2 keep their notes (before P1 they were wiped).
2b. Edit Order: open the price override from a cart line (pencil). Expected: the dialog shows that line's current price and saving changes it (before P1 the dialog could not find the line in Edit).
2c. Edit Order: open a saved order, change nothing and leave the page (back, or close the tab). Expected: no "unsaved changes" prompt. Change one thing, then leave: the prompt appears. Undo the change: Review is disabled again.

## P2 — add rule — ✅ ready to test
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
6i. A measured line with 3 pieces and 7 kg: press **Move one piece to a new line**. Expected: nothing changes and the message says the measure can't be divided into equal shares.
6j. Order Edit on a saved order with a measured line (setup: **HQ → Order Edit policy** has rules for Change Item Quantity, Add Piece and Change Item Measure at this stage). Add the same product with the same per-piece measure. Expected: the choice shows **Add to line 1 (agreed price …)** and **Add as a new line (today's price …)**. Choose add to line 1 → Review lists quantity, piece and measure changes → Apply succeeds. Remove one of the three HQ rules → the choice step no longer appears; the article becomes a new line.
6k. *(Label built by Measured Pricing P6/P8, DESIGN §0; check here once both are live.)* Customer-facing: create an order with Turtleneck ×1 at Express and Turtleneck ×1 at the order speed, and two identical 2.5 m measured lines. Check the WhatsApp/email receipt text, the printed receipt, the order details print, the tracking page and the customer app order screen. Expected: "Turtleneck Sweater · Express", "Turtleneck Sweater", "… · 2.5 m (1)", "… · 2.5 m (2)", in EN and AR.
7. Card `−` on a product with two lines. Expected: the most recently added line loses one piece (or is removed if it had one). On a measured line with 2+ pieces the measure check dialog opens first.

2d. (P2) Line labels: when a product has 2+ lines, the cart and steps 2–4 show "Turtleneck Sweater · Line 1 / Line 2"; with one line, no label.
2e. (P2) Grid badge = all pieces of the product across its lines; − takes a piece off the most recently added line.

2f. Line numbers in dialogs: with two lines of one product, open the price override, the line discount and **Change measure** on line 2. Expected: each title ends with "· Line 2".
6l. With a measured product already in the cart, tap it again. Expected: the measure field is **empty** and the button says **Add** (not Save). Entering the same measure per piece then shows the "add to line" choice (6a).

## P3 — move piece — ✅ ready to test
The move button is the ⇄ icon: on a cart line, and on each piece row in steps 2) Order Items, 3) Preferences and 4) Notes.
8. Turtleneck quantity 2 → piece 2 menu → **Move to a new line**. Expected: two lines "Turtleneck Sweater · Line 1 / Line 2", piece keeps its notes and preferences, both lines re-priced by the server.
9. Give line 2 its own speed (ITEM-level tenant). Submit. Expected: order saved with two lines; order detail and receipt show both.
10. Piece on line 2 → **Move to line 1**. Expected: line 2 disappears, line 1 quantity 2.
11. ITEM-level organization: expand a cart line with 2+ pieces → the hint "Need a different speed, price or discount for one piece? Move it to a new line." PIECE-level (HQ switch): per-piece speed and discount show instead.
12. Edit Order: the ⇄ menu on a **saved** piece is greyed and says "A saved piece can't be moved. Remove it, add the product again, then move the new piece." A piece added during this edit can move.
13. Measured and custom lines show no move action.
14. Move a piece out of a line that has a price override. Expected: the menu item says "Leaves Line 1's price" before you click; after the move a confirmation "Moved to line 2" appears and the new line sits right below line 1.
15. Edit Order on an order with two lines of the same product: change only line 2's quantity. Expected: the screen shows unsaved changes, and the review lists only line 2.

15a. Open the menu with the keyboard (Tab to ⇄, Enter, arrows). Expected: after the move, focus is on the moved piece's ⇄ button (or the new line's); a message "Moved to line N".
15b. Step 2) Order Items: move a piece from the expanded line. Expected: the receiving line expands and the piece is selected.
15c. Cart, count line with 2+ pieces on an item-level organization: expand the line's breakdown. Expected: "Need a different speed, price or discount for one piece? Move it to a new line."
15d. Move a piece into a line with its own speed or discount. Expected: the menu says "Takes line N's speed/discount" before you click.
15e. Order Edit, saved order with a line that has preferences: add a piece, move it to a new line, Review → Apply. Expected: the new line has the same preferences; the saved line is unchanged. For a measured line, repeat with the P2 "Move one piece to a new line".
15f. Order Edit: choose a greyed entry on a saved piece. Expected: nothing moves and the same message shows.

## Order Edit — replacing a saved piece (✅ ready to test; setup A)
16. Saved order, Turtleneck 2 pieces → Edit → step 2) Order Items → remove piece 1 → tap Turtleneck → the new piece joins the line → ⇄ **Move to a new line** → Review → Apply. Expected: the old line has 1 piece, a new line has 1 piece at today's price; totals match the review.
17. Same order → remove one saved piece and add one piece on the **same** line, without moving it. Review. Expected: the review lists one piece added and one removed (before this fix nothing was sent). Apply → same quantity, the removed piece is gone.
18. Remove the only piece of a line. Expected: the whole line is removed (and the review says so).
19. A removed piece's barcode, tag and workflow status do not carry to the new piece: print the new tag.

## PF — create order writes (✅ ready to test)
PF1. Create an order with 3 lines of 2+ pieces; on some pieces set a preference, a packing, a condition, a colour and a note. Submit. Expected: the order opens with every piece in order and each piece shows exactly what you set; totals match the cart.
PF2. Create a large order (about 30 lines / 60 pieces). Expected: it saves; note how long Submit takes.
