# Order Cart Line Grouping — Design

**Status:** Approved (2026-11-25) · not started · owner decisions recorded in §11
**Scope:** web-admin New Order + Order Edit shared cart. Server, API and DB core unchanged (verified, §3). One later phase touches both repos (§9 P4).

## 1. Problem

When staff add a product that is already in the cart, the cart always adds one piece to that product's line. A product can never have two lines in one order.

Staff need two lines when garments of the same product differ in something that is set **for the whole line**:

| What differs per garment | ITEM level (default, all tenants today) | PIECE level (HQ opt-in) |
|---|---|---|
| Preferences, packing, stain, damage, notes, color, brand | already per piece | already per piece |
| Speed | **line only** → needs a second line | per piece, except fallback lines¹ |
| Cashier discount | **line only** → needs a second line | per piece, except fallback lines¹ |
| Cashier price override | **line only** → needs a second line | **line only** → needs a second line |
| Measure (kg, m, m²) | **line only** → needs a second line | **line only** → needs a second line |

¹ Fallback lines are priced on the line even at PIECE level: measured lines, `price_type = FIXED`, and lines whose piece count differs from their quantity (`lib/commercial/levels.ts:59-72`).

Facts behind the table:
- `org_tenants_mst.commercial_level` is `ITEM | PIECE`, default `ITEM`, set only by HQ (Tenant → Order fin → Tax & pricing tab). It is copied to `org_orders_mst.commercial_level` when the order is created, and Edit never changes it. Live DB 2026-11-25: 5 of 5 tenants at `ITEM`.
- At ITEM level the engine rejects a piece's own speed or discount with `PIECE_PRICING_UNAVAILABLE` (`lib/commercial/commercial-order.ts:317-321`). The cart hides those controls (`summary-cart-item.tsx:265`).
- Pieces have no override or measure columns (`org_order_item_pieces_dtl`).

So a second line of the same product is the **only** way, at both levels, to give one garment its own price, measure, or (at ITEM level) its own speed or discount.

## 2. Decision summary

1. **Every cart line gets its own key** (`lineKey`). `productId` becomes a catalog fact only. This is the core change, and it fixes a latent Edit Order bug (§6).
2. **No screen-wide "merge / separate" switch.** It is hidden state, it changes what the card buttons mean, and it is needed on few orders. Rejected (§10).
3. **A clear add rule** in one pure function decides "add a piece to an existing line" or "start a new line" (§4).
4. **One explicit cart action, "Move to a new line" / "Move to line N"**, moves a piece between lines of the same product. Moving a piece back undoes it, so no separate "merge" action is needed (§5).
5. **No change to pricing engine, API, DB or HQ** for P1–P3. Moving a *saved* piece in Order Edit needs a new change code in both repos (P4).
6. Per-product "always a new line" behaviour is a designed extension point, built only on real demand (P5).

## 3. Verified: the server already accepts several lines per product

| Layer | Evidence | Result |
|---|---|---|
| Create / quote intents | `checkoutIntentOf` names lines by position (`L1`, `L2`…), `commercial-checkout.service.ts:198` | ✅ independent lines |
| Catalog lookup | product ids de-duplicated with a `Set` only for the lookup, `commercial-context.loader.ts:438` | ✅ |
| Request validation | per-line Zod schema, no uniqueness rule (`new-order-payment-schemas.ts:492, 627`) | ✅ |
| DB | no unique key on `(order_id, product_id)` in `org_order_items_dtl`; live DB has 0 orders with repeated products | ✅ no migration, no backfill |
| Cart quote | quote lines are matched to cart lines **by index** (`new-order-content.tsx:269-284`, `new-order-modals.tsx:250`) | ✅ |
| Order Edit server | change targets are `PERSISTED_ITEM {id}` / `LOCAL_ITEM {clientRef}` (`change-builder.ts:23-25`) | ✅ |
| Edit adapter | matches cart lines to saved lines by `persistedItemId` (`edit-workspace-adapter.ts:175, 258`) | ✅ |
| Prints, receipts, reports | no grouping by product found | ✅ show stored lines |
| Customer app booking | its own cart keyed `itemId → qty`, merge-only by design; customers never set cashier prices | not in scope |
| Staff app | does not create orders | not in scope |
| `FastItemizer` (preparation) | lists saved lines by id and hands edits to Order Edit | unaffected |

## 4. The add rule

One pure function, `resolveCartAddTarget`, in `src/features/orders/model/cart-line-grouping.ts`. Every path that adds a catalog product calls it: product card, barcode scan, Repeat last order, care packages, smart suggestions.

```ts
type CartAddTarget = { kind: 'MERGE'; lineKey: string } | { kind: 'NEW_LINE' };

resolveCartAddTarget(items, product, { forceNewLine?: boolean }): CartAddTarget
```

Rules, in order:

| # | Condition | Result | Why |
|---|---|---|---|
| R1 | `forceNewLine` | `NEW_LINE` | explicit request (Move action, future product rule) |
| R2 | product is measured (`base_uom_code` with a non-COUNT dimension) | measure dialog first, then `NEW_LINE` or, **on the user's choice**, `MERGE` (§4.1) | a line holds one measure; merging is only offered when it is exact |
| R3 | custom item | `NEW_LINE` | already the case today |
| R4 | there is an **open** line of the same product | `MERGE` into the most recently added open line | today's behaviour for the common case |
| R5 | otherwise | `NEW_LINE` | |

A line is **open** when it has no commercial choice of its own: no price override, no line discount, and no speed of its own (`serviceSpeed == null`). A line staff customised is **closed** to automatic merging. A new piece then never inherits a cashier price, discount or premium that was set for other garments (CLAUDE.md rule 11, no silent money mutation). The new line shows at catalog price and the order speed, in plain sight.

Line preferences (starch, perfume…) do **not** close a line. A new piece on that line follows the line's preferences, as today.

### 4.1 Measured products: offer "add to the existing line" when the measure matches (owner addition, 2026-11-25)

**How a measured line is billed (verified):** the line's measure is the **total for the whole line**, not per piece. Money = billed measure × unit price, and the minimum billable measure and the billing step apply to that total (`lib/commercial/measure.ts:82-122`, `lib/utils/order-item-helpers.ts:23`). Quantity (pieces or bags) does not multiply the price. An AREA line stores one length × width.

**Existing money gap this fixes:** today the card `+` on a measured product already in the cart only raises quantity (`product-grid.tsx:303` → `onQuantityChange`) and keeps the measure, so the extra garment is free. Example in the owner's screenshot: Delicate Cardigan (Meter), 2 pieces, billed 2.5 m = 6.250 OMR. From P2, `+` on a measured product always opens the measure dialog.

**Flow** (measure dialog, add mode):
1. Staff enter the measure and press **Add**.
2. The cart looks for **matching lines**. A matching line has:
   - the same `productId` **and** the same `serviceCategoryCode`;
   - a measured unit, same unit code, and the dimension is **not AREA**;
   - is open (§4: no own price, discount or speed);
   - matching measure: **entered measure × line quantity = line measure**, compared exactly with decimals (no rounding, no averages). In words, every piece on the line has the same measure as the one entered.
   - in Order Edit only: the order's edit policy allows `CHANGE_ITEM_QUANTITY`, `ADD_PIECE` and `CHANGE_ITEM_MEASURE` at target type ITEM/PIECE (`useEditControlGroup`, `use-edit-control-capability.ts:9-14`; the policy is per change type, not per line). Otherwise no line is offered, and the article becomes a new line (`ADD_ITEM`), which is itself policy-checked.
3. **No matching line** → a new line is added (no extra step).
4. **One or more matching lines** → the same dialog switches to a choice step. It doesn't open a second popup, and the entered values stay visible:
   - **Add to Line N**, one per matching line, primary button for the first. Its subtext shows the result, e.g. "Becomes 3 pieces · 7.5 m".
   - **Add as a new line**, secondary button.
   - **Back**, to edit the values.
   - When the product has a minimum billable measure or a billing step, an inline note says: "The minimum and billing step apply to the line total." (Merging can bill less than separate lines when a minimum applies. The choice is the user's and is shown, not silent; rule 11.)
5. **Add to Line N** → that line's quantity + 1 and its measure = line measure + entered measure, in one reducer action (`MERGE_MEASURED`). The server quote then re-prices the line.

**Why AREA is excluded:** an AREA line stores one length × width, and the engine bills it once. Two 2 × 3 m rugs on one line can't be stored without changing the engine's measure model (per-article measure × count), which is a money-engine change at both commercial levels. AREA products always get a new line. Live DB has 0 AREA products today. If identical rugs become common, a separate engine package ("per-article measure") is the right fix, not a cart trick.

**Where the comparison lives:** a pure function `findMatchingMeasuredLines(items, product, entered)` in `model/cart-line-grouping.ts`, with unit tests for: LENGTH, MASS, VOLUME, TIME equal and unequal; decimals (2.5 vs 2.50); closed line excluded; different category excluded; AREA excluded; quantity 0 guard.

i18n keys added: `newOrder.lines.measureMatchTitle` ("A line with this measure is already in the order" / "يوجد في الطلب سطر بنفس هذا القياس"), `newOrder.lines.addToLine` ("Add to line {number}" / "إضافة إلى السطر {number}"), `newOrder.lines.addToLineResult` ("Becomes {pieces} pieces · {measure}" / "يصبح {pieces} قطع · {measure}"), `newOrder.lines.addAsNewLine` ("Add as a new line" / "إضافة كسطر جديد"), `newOrder.lines.measureMinimumNote` ("The minimum and billing step apply to the line total." / "يُطبَّق الحد الأدنى وخطوة الفوترة على إجمالي السطر.").

### 4.2 Measured lines: every piece-count change asks for the measure (review B2)

A measured line is billed on its total measure, so **any** change to its piece count that leaves the measure alone can add a free garment (or bill a removed one). Today four paths do exactly that:

| Path | Today | From P2 |
|---|---|---|
| Product card `+` | quantity + 1, measure unchanged (`product-grid.tsx:303`) | measure dialog, add mode (§4.1) |
| Step 2) Order Items `+` / `−` | quantity ± 1 (`order-details-section.tsx:363-379`) | piece count changes, then the measure dialog opens in **re-measure** mode |
| Step 2) "Add piece" / pieces manager "Add piece" | quantity = piece count (`order-details-section.tsx:159, 557`; `pre-submission-pieces-manager.tsx:80`) | same as above |
| Order Edit, saved measured line (`CHANGE_ITEM_QUANTITY` / `ADD_PIECE` / `REMOVE_PIECE` through the shared cart) | quantity changes, stored measure kept | same as above; the re-measure becomes `CHANGE_ITEM_MEASURE` when the value changes |

Re-measure mode after a piece-count change:
- The title says what happened, e.g. "Pieces changed from 2 to 3. Check the total measure." The current total is filled in.
- **Confirm** keeps or changes the total. Keeping it unchanged is allowed, since bulk lines (kg in bags) can gain a bag without gaining weight. It is an explicit choice, never automatic (rule 11).
- **Cancel** reverts the piece-count change too, so the count and the measure never drift apart silently.
- Code never changes the measure on its own (no automatic "add one share" maths). The only exceptions are the explicit merge (§4.1) and split (§4.3) actions, which show the result before the click.
- The preparation screen's item list (`src/features/workflow/ui/ItemList.tsx`) only displays lines and needs no change.

### 4.3 Undoing a measured merge: "Move one piece to a new line" (review B1)

A merge (§4.1) must be reversible. A measured line with quantity ≥ 2 offers **Move one piece to a new line** when its measure divides exactly into equal shares:
- share = line measure ÷ quantity, exact at the unit's `qty_decimals` (decimal arithmetic, no floats). Example: 7.5 m ÷ 3 = 2.5 m ✅; 7 kg ÷ 3 = 2.333… ❌.
- Result: source line quantity − 1 and measure − share; a new line right below it with quantity 1 and measure = share, open (catalog price, order speed, no discount), source line preferences copied.
- When the share is not exact, the menu item is disabled with the reason "This line's measure can't be divided into equal shares. Change the measure first." Never offered on AREA lines, which are never merged (§4.1).
- **Order Edit:** offered only while the piece being moved is unsaved (added during this edit, e.g. the merge just made). A saved piece on a measured line can't move. P4 doesn't cover measured lines either, because moving a share would also change a saved measure. The reason is shown in the menu.

§5.3's "not on measured lines" rule is narrowed accordingly: free piece moves stay count-lines only; measured lines have only this exact one-share action.

### 4.4 Prices in Order Edit (review B4)

| Action in Order Edit | Unit price charged |
|---|---|
| Add a piece to a **saved** line, including a measured merge into a saved line | the line's **agreed** price: the list price, unit, minimum and billing step stored at drop-off (`commercial-edit.loader.ts:770-795`, L24) |
| A **new** line (add, move to a new line, split off a share) | **today's** catalog price and speed rules |

Where the two can differ, the choice is shown before the click:
- The §4.1 choice step shows both unit prices: "Add to line 1 (agreed price 2.500 OMR/m)" and "Add as a new line (today's price 2.750 OMR/m)". Prices come from the stored line and the server price preview, never client arithmetic.
- The move and split menus in Edit carry "New line uses today's price" when a saved line is the source.

### 4.5 Order Edit: a measured merge into a saved line (review B3)

The adapter sends three changes on one saved line in one Change: `CHANGE_ITEM_QUANTITY`, `ADD_PIECE` and `CHANGE_ITEM_MEASURE`. The one-change-per-line rules for `CHANGE_ITEM_MEASURE` were built and tested alone, so P2 adds:
- **DB-integration test** (`__tests__/db-integration/`): preview + apply of the three together on one saved measured line, at ITEM and PIECE commercial level. Checks: one re-priced line, measure = old + entered, a new piece row, money identities hold, one review entry per change, and a policy deny on any one of the three refuses the whole Change.
- **HQ Edit policy:** all three codes need a rule at the stages where staff may merge. A missing rule denies. The choice step is shown only when all three are allowed (§4.1). QA setup step in QA_TEST_GUIDE.

**Behaviour change vs today:** tapping a product whose only line has an override, discount or own speed now starts a new line instead of adding a piece at that price. This is intended. The product is pre-launch, so there are no live users to retrain.

## 5. Moving a piece between lines

### 5.1 Where it appears
- On every piece row in the cart (summary panel), and in step 2) Order Items and the step 3) / 4) piece lists, as a row menu (`CmxDropdownMenu` / `CmxIconButton`, never raw HTML):
  - **Move to a new line**: shown when the piece's line has 2 or more pieces.
  - **Move to line N**: one entry per other line of the same product, shown only when such lines exist.
- On a line header with quantity ≥ 2: **Move one piece to a new line** moves the last piece (keyboard-friendly shortcut for the common case).

### 5.2 What moves and what stays

| Moves with the piece | Belongs to the line (the target line's value applies) |
|---|---|
| piece preferences, packing, color(s), brand, stain, damage, conditions, notes, rack | price override, line discount, line speed, line preferences, measure |
| at PIECE level: the piece's own speed and discount | |

A new line created by a move starts **open**: catalog price, order speed, no discount, and the source line's line preferences copied (the garment keeps the care it had). The quote re-prices both lines. The cart shows the new prices through the existing quote display, with no client-side money arithmetic.

### 5.3 Rules
- Same product only (a piece cannot become a different product; that is `CHANGE_ITEM_PRODUCT` territory).
- Not on measured lines, except the exact one-share action in §4.3 (a measured line's pieces share one measure).
- Not on custom-item lines in v1 (a custom line is a one-off by nature).
- A line left with 0 pieces is removed. `pieceSeq` is renumbered 1..n on both lines.
- Order Edit: unsaved pieces move freely. **Saved pieces** can't move in P1–P3. The action is shown disabled with the reason "Saved pieces can't be moved to another line yet" (no silent no-op). P4 adds this.

### 5.4 Naming (avoid "split")
"Split" already means splitting an order into a sub-order (`order-split.service.ts`). This feature uses **move**:

| Key | EN | AR |
|---|---|---|
| `newOrder.lines.moveToNewLine` | Move to a new line | نقل إلى سطر جديد |
| `newOrder.lines.moveToLine` | Move to line {number} | نقل إلى السطر {number} |
| `newOrder.lines.moveOnePieceToNewLine` | Move one piece to a new line | نقل قطعة واحدة إلى سطر جديد |
| `newOrder.lines.lineNumber` | Line {number} | السطر {number} |
| `newOrder.lines.savedPieceCannotMove` | Saved pieces can't be moved to another line yet | لا يمكن نقل القطع المحفوظة إلى سطر آخر حالياً |
| `newOrder.lines.itemLevelHint` | Need a different speed, price or discount for this piece? Move it to a new line. | تحتاج سرعة أو سعراً أو خصماً مختلفاً لهذه القطعة؟ انقلها إلى سطر جديد. |

Exact namespace to follow the existing `newOrder` catalog layout (`/i18n` at implementation). AR wording checked against `docs/dev/i18n_docs/GLOSSARY.md`.

### 5.5 Telling lines apart
When a product has more than one line, every place that names a line adds its number: "Turtleneck Sweater · Line 2". Places: cart, steps 2–4, price-override and discount dialogs, measure dialog title. With one line, nothing changes.

At **ITEM** level, a piece row shows `itemLevelHint` as muted helper text in the place where PIECE-level tenants see per-piece speed and discount. This makes the move action discoverable exactly where staff look for it.

## 6. Line identity (the core refactor)

### 6.1 Model
```ts
interface OrderItem {
  /** Cart identity of this line. Create: a new UUID. Edit: the saved item id. Never sent to the server. */
  lineKey: string;
  persistedItemId?: string;   // unchanged
  productId: string;          // catalog id (or `custom:<uuid>` for a custom item, unchanged)
  …
}
interface PreSubmissionPiece {
  id: string;        // `temp-<uuid>` on Create; the saved piece id in Edit. No longer derived from the product.
  itemId: string;    // = the line's lineKey
  pieceSeq: number;  // 1..n within the line
  …
}
```
- One helper creates keys: `newCartLineKey()` → `crypto.randomUUID()`, beside `CUSTOM_ITEM_KEY_PREFIX` in `model/checkout-line-intent.ts` or a new `model/cart-line-grouping.ts`.
- Edit projection (`edit-workspace-adapter.ts:69`) sets `lineKey = item.id`.
- `SET_ITEMS` and `ADD_ITEM` pass items through `ensureLineKeys()`. This is the single entry guard, so no line ever lacks a key (e.g. items rebuilt by older callers).

### 6.2 Every product-keyed place switches to `lineKey`
Reducer actions (`model/new-order-types.ts:366-447`): `REMOVE_ITEM`, `UPDATE_ITEM_QUANTITY`, `UPDATE_ITEM_MEASURE`, `UPDATE_ITEM_NOTES`, `UPDATE_ITEM_PIECES`, `UPDATE_ITEM_SERVICE_PREFS`, `UPDATE_ITEM_PACKING_PREF`, `ADJUST_ITEM_PACKING_PREF_CHARGE`, `UPDATE_ITEM_PRICE_OVERRIDE`, `SET_ITEM_SERVICE_SPEED`, `SET_ITEM_LINE_DISCOUNT`, `OPEN_PRICE_OVERRIDE_MODAL`; `ADD_ITEM` takes a `CartAddTarget`; new `MOVE_PIECE { pieceId, toLineKey | 'NEW' }`.

State and UI wiring: `hooks/use-new-order-state.ts` (all methods at lines 41–78), `priceOverrideItemId`, `discountProductId`, `measureTarget` (becomes `{ product, uom, mode: 'ADD' | 'REMEASURE', lineKey? }`), `selectedPieceId` resolution (`new-order-content.tsx:675-690`), `use-new-order-piece-preferences.ts`, `order-details-section.tsx`, `order-pieces-notes-section.tsx`, `piece-preferences/order-piece-preferences-section.tsx`, `preferences-panel.tsx`, `item-cart-list.tsx`, `summary-cart-item.tsx`, `order-summary-panel.tsx`, `new-order-modals.tsx`, `pre-submission-pieces-manager.tsx`, `custom-item-modal.tsx`, `lib/utils/piece-helpers.ts`, `lib/order-edit-dirty.ts`, preferences panels (Repeat last order, care packages, suggestions).

Also switch (found in the plan audit, §13):
- **Edit unsaved-changes check** `src/features/orders/lib/order-edit-dirty.ts:122-130` builds `Map<productId, row>`; two lines of one product collapse, so edits can look unchanged. Match by `persistedItemId` (saved lines) and `lineKey` (new lines) instead. Test file: `__tests__/features/orders/order-edit-dirty.test.ts`.
- **React list keys** `key={item.productId}` → `key={item.lineKey}`: `order-details-section.tsx:298`, `order-pieces-notes-section.tsx:145`, `piece-preferences/order-piece-preferences-section.tsx:162`, `preferences/PreferencesTabsSection.tsx:161`. Duplicate keys would make React reuse the wrong row's state.

Every `temp-${productId}-…` id and every `startsWith('temp-…')` parse (12 sites, e.g. `new-order-reducer.ts:275, 809-814`, `preferences-panel.tsx:95`) is replaced by a lookup on `piece.itemId`.

**Stays on `productId`** (catalog facts): `validateProductIds` (`use-order-submission.ts:219`), the request line (`checkoutLineOf`), speed price previews, preference resolve, product grid counts, measure-unit lookup.

### 6.3 Latent bug this fixes
Today two saved lines of the same product would collide in the Edit cart: every reducer action matches both lines, so changing one changes both. The live DB has none yet, but P2/P3 would create them. P1 must land before or with P2.

## 7. Product grid

| Product state | Badge | `+` | `−` |
|---|---|---|---|
| not in cart | — | add rule (§4) | — |
| count product, 1+ lines | Σ quantity over its lines | add rule (§4) | removes one piece from the most recently added line of the product (LIFO). A line reaching 0 is removed |
| measured product, 1+ lines | Σ quantity over its lines | opens the measure dialog (§4.1: new line, or the user's choice to add to a matching line) | removes the most recently added line, after a confirm (the line's measure goes with it) |

Re-measuring an existing measured line moves to the cart's existing "Change measure" link only (`measureTarget.mode = 'REMEASURE'`). This changes today's behaviour, where tapping a measured product in the cart re-measures it (`new-order-content.tsx:597`).

Performance: the grid gets one memoised `Map<productId, { count, lastLineKey }>` per items change, replacing `items.find` per card per render (`product-grid.tsx:110-113`).

## 8. Other screens and flows

| Area | Behaviour |
|---|---|
| Steps 2) Order Items, 3) Edit Items Preferences, 4) Edit Item Notes | list lines by `lineKey`, with line numbers per §5.5; piece move menu per §5.1 |
| Repeat last order | for each product in the last order, its first line's preferences are applied to **every** current line of that product (`RepeatLastOrderPanel.tsx:84-130`, today first-match) |
| Price override / discount dialogs | target one line by `lineKey`; title carries the line number when needed |
| Payment modal, order fin view (draft) | built from cart lines and the server quote by index → unchanged |
| Order detail, prints, receipts, tracking, public financial view, customer app | show stored lines; when a product has 2+ lines, each carries a **line qualifier** so customers can tell them apart (§8.1, review B5) |
| Reports / analytics | aggregate by `product_id` already; unchanged |
| Workflow, assembly, tags | per piece; unchanged |
| Order split (sub-orders) | works on saved lines and units; unchanged |

### 8.1 Line qualifier on customer-facing documents (review B5)

Two rows "Turtleneck Sweater ×1" with different prices confuse customers. Every place that lists an order's lines adds a short qualifier after the name:

| Part | Shown when | Example |
|---|---|---|
| measure | the line is measured (always) | 2.5 m |
| speed | the line's speed differs from the order speed | Express |
| ordinal | the product has 2+ lines **and** the parts above are identical | (1), (2) |

So: "Turtleneck Sweater · Express ×1", "Turtleneck Sweater ×1"; or "Rug · 2.5 m (1)", "Rug · 2.5 m (2)". The price differences are already visible as amounts; a cashier override or discount is not named to the customer.

**One source:** a pure server helper `orderLineQualifiers(lines, orderSpeed)` in `lib/orders/line-qualifier.ts` returns structured parts per line id (`{ measure?: {qty, uomCode}, speedCode?, ordinal? }`), not text. Each renderer formats it with its own i18n (EN/AR, RTL-safe separators).

| Surface | File | Change |
|---|---|---|
| Text receipts (WhatsApp, email) | `lib/services/receipt-service.ts:538-545, 605` | name + qualifier |
| Receipt print, order detail print | `src/features/orders/ui/order-receipt-print.tsx`, `order-details-print.tsx` | name + qualifier |
| Order money view (staff + `public` preset) | `lib/services/order-fin-view/normalize.ts:167` (`label`) + items source | label gets the qualifier; the public projection allowlist test classifies the new field (order-fin pitfall) |
| Public tracking page | `lib/services/public-order-tracking.service.ts` → `PublicOrderItem` (`order-tracking-page.tsx:27-34`) | add `qualifier` |
| Customer app order detail | public customer orders API → `customer_order_detail_screen.dart:243-250` | API adds `qualifier`; Flutter renders it (mobile l10n EN/AR) |

**Coordination:** Measured Pricing P6 (display on order detail, prints, tracking, booking, owned by the measured-units session) shows the measure on these same surfaces. Both must use the same helper: whichever lands first creates `line-qualifier.ts`, the other extends it. Don't show the measure twice.

**When:** P2 is the first phase that can create two lines of one product (closed lines, measured new lines), so §8.1 ships **in P2**.

## 9. Phases

Each phase ends with: gates green (`npm run build`, `npx eslint . --quiet`, `npm run check:i18n`, `npm run check:ui` on changed files, `/cmx-ui-design-review`, targeted jest), STATUS.md + QA_TEST_GUIDE.md + RESUME_CONTINUATION.md updated.

| Phase | Content | Repos | DB |
|---|---|---|---|
| **P1 Line identity** | `lineKey` model, all actions/handlers/UI by `lineKey`, piece ids, `ensureLineKeys`, Edit projection. **No visible behaviour change.** | tenant | none |
| **P2 Add rule** | `resolveCartAddTarget` + all add paths; measured: dialog on every `+`, §4.1 match-and-choose step with Edit prices (§4.4), `MERGE_MEASURED`; §4.2 re-measure on every piece-count change (all 4 paths); §4.3 exact one-share split; §4.5 combined Edit DB test + HQ rules; §8.1 line qualifier on all customer surfaces; grid badge/LIFO; measure dialog modes (`ADD` / `REMEASURE`) | tenant + customer app (`cmx_mobile_apps`) | none |
| **P3 Move piece** | `MOVE_PIECE` reducer action, cart + steps menus, line numbering, ITEM-level hint, i18n EN/AR, Edit: unsaved pieces only, saved pieces disabled with reason, "New line uses today's price" note in Edit (§4.4) | tenant | none |
| **P4 Move saved piece (Order Edit)** | see §9.1 | tenant (+ HQ owner adds a policy rule; no HQ code) | 1 migration: catalog rows |
| **PF Create write-path check (required before the program closes)** | see §9.2 | tenant | none expected |
| **P5 Product line mode (on demand)** | typed column `org_product_data_mst.cart_line_mode TEXT NULL CHECK IN ('MERGE','SEPARATE')` (NULL = rule default), product form field, feeds R1. Only if staff ask for "always separate" products (wedding dresses, carpets by count) | tenant (+ HQ template mirror if HQ seeds products) | 1 migration |

### 9.1 P4 in detail (move a saved piece in Order Edit)

| Area | Work |
|---|---|
| DB (tenant repo owns migrations) | Insert `MOVE_PIECE` into `sys_oc_order_edit_ops_cd` (name/name2/description EN+AR) and the pair `('MOVE_PIECE','PIECE')` into `sys_oc_order_edit_op_tgt_cd`, following `0637_edit_policy_resolution_scopes.sql` (upsert `ON CONFLICT`, `COMMENT`, no grants to `anon`/`authenticated`). Migration number = latest + 1 at write time. Then **stop for review**. |
| HQ | **No code.** HQ reads the catalog from the DB (`cleanmatexsaas/platform-api/src/modules/order-change-config/edit-policy/edit-policy.repository.ts:163-185`). A missing rule **denies** the change, so the HQ owner adds an Edit policy rule for `MOVE_PIECE` (which order stages allow it). QA step in QA_TEST_GUIDE. |
| Constants / schema | `lib/constants/order-change.ts` (code list, target map), `lib/services/order-change/order-change-capability.service.ts:207` (PIECE target), Zod in `lib/validations/order-change/order-change.schemas.ts`: target `PERSISTED_PIECE`, payload `{ toLine: { kind: 'PERSISTED_ITEM', id } \| { kind: 'LOCAL_ITEM', clientRef } }`; the target line must be the same product, not measured, not custom, same order |
| Server write | structural writer: update the piece's `order_item_id` (filter `tenant_org_id` + `order_id` + piece id), renumber `piece_seq` on both lines, update both lines' `quantity`; **keep `id`, `piece_code`, `barcode`, workflow status, scan state**; remove a line left with 0 pieces (`REMOVE_ITEM` semantics); re-price both lines through the existing commercial edit path; one transaction |
| Tags | piece labels print `order_item_srno` and `piece_seq` (`lib/services/labels/label-data.service.ts:41-56`). After a move the printed tag is stale: clear the piece's `tag_released_at` so it shows as "tag to print", and the review dialog says "Reprint the tag for the moved piece" |
| Audit / history | change history row per move (from line, to line, piece code); `orders-change-history-tab-rprt.tsx` label for the new code (EN/AR) |
| Frontend | enable the move menu on saved pieces when the policy allows `MOVE_PIECE`; `edit-workspace-adapter.ts` emits `MOVE_PIECE` instead of remove + add when a saved piece's line changed; review dialog text |
| Tests | DB-integration: move between two saved lines, to a new line, last piece (line removed), other tenant's piece refused, policy deny; money: both lines re-priced, item = Σ pieces at PIECE level |

### 9.2 PF: order-create write path (required closing gate)

**Why:** order create writes rows one at a time inside one transaction (`lib/services/order-service.ts:655-880`):

| Per | Sequential writes |
|---|---|
| line | 1 item insert (`:657`) + up to 2 preference writes (`:700`, `:725`) |
| piece | 1 piece insert (`:764`) + up to 4 preference/condition writes (`:798`, `:824`, `:850`, `:877`) |

So an order with L lines and P pieces makes up to about 3L + 5P database round trips, plus the money rows. This feature does **not** add pieces; it adds at most one item insert (and its preference copies) per extra line. The risk is the existing cost growing with larger orders, so it is checked rather than assumed (`docs/dev/rules/performance-engineering.md` §2, §9: measure first, one change, retest).

**When:** after P3 is built, before the program is marked complete. It does not wait for P4 (P4 changes Order Edit, not create).

**Steps:**
1. **Baseline.** Production build, DB-integration fixture against a remote-like DB. Measure create-order API time and DB round trips for 3 shapes: small (5 lines / 10 pieces), typical-large (30 lines / 60 pieces), heavy (60 lines / 150 pieces, with piece preferences and conditions). Record p50/p95 of 10 runs each, plus the transaction duration (lock time).
2. **Decide against a target.** Proposed target, to be confirmed by the owner at the gate: p95 create ≤ 1.5 s for the typical-large shape, and no shape holding the transaction longer than 3 s. If the baseline meets it, record the evidence and close; no code change.
3. **If it misses: one change.** Batch the piece inserts per line with `createManyAndReturn`, mapping the returned ids back to `commercial.recordPiece` by `piece_seq` (never by array position: Postgres does not promise RETURNING order), and batch piece preference/condition rows for the whole order into one `createMany` after the pieces exist. Keep one transaction, the same row values, `tenant_org_id` on every row, and no unbounded `Promise.all` (rules §4).
4. **Prove nothing changed but speed.** DB-integration parity test: the same order before and after the change produces identical item, piece, preference, condition and money rows (ignoring ids and timestamps), at ITEM and PIECE commercial level. Then re-measure the 3 shapes and record the result in STATUS.md.

**Out of scope here:** Order Edit apply, and the money writer's own row count (measured in step 1; a separate package if it is the bottleneck).

## 10. Alternatives rejected

| Option | Why not |
|---|---|
| Screen-wide "merge / separate" switch (header) | hidden mode → forgotten state, orders with 12 one-piece lines; card `−` loses meaning; far from where it acts; a choice on every order for a rare need |
| Tenant setting for the default | business behaviour already decided by a rule; a setting adds HQ API + config surface for no case the rule misses (memory: avoid general settings) |
| Per-piece price override / per-piece measure | pieces only receive a share of the line price at ITEM level; measured lines are line-priced at both levels by design (`levels.ts:39-40, 67`); needs new columns + engine + Edit + print + report work at both levels; a second line gives the same result with no money-code change |
| Card "add as new line" button | the hottest control gets two meanings; the cart move covers it in one extra click, where the details are set anyway. Revisit if QA shows the move is too slow |
| Long-press on `+` | not discoverable, poor accessibility |

## 11. Owner decisions (recorded 2026-11-25)

1. **Closed-line rule (§4):** ✅ approved. A line with its own override, discount or speed takes no automatic pieces.
2. **Measured products:** ✅ approved. New line per tap; re-measure only from the cart (§7). **Owner addition:** when the entered measure matches an existing line of the same product and service category, offer "Add to line N" or "Add as a new line" (§4.1; AREA excluded, with the reason).
3. **P4 (move saved pieces in Order Edit):** ✅ after P1–P3 QA.

## 12. Risks

| Risk | Mitigation |
|---|---|
| P1 touches ~25 files; a missed `productId` comparison mis-targets a line | P1 ships with no behaviour change; reducer tests with two lines of one product for **every** action; grep gate: no `productId ===` or `temp-${…productId` left in cart code |
| Selected piece lost after a move | piece ids no longer depend on the line, so selection survives |
| Quote briefly out of step after a move | existing quote flow; cart shows the placeholder until the server answers, never a client sum |
| Old in-memory items without `lineKey` | `ensureLineKeys` on `SET_ITEMS` / `ADD_ITEM` |

## 13. Plan audit (2026-11-25)

Second pass over every layer. Each finding is now part of the plan.

| # | Area | Finding | Fixed in |
|---|---|---|---|
| A1 | Server create | `order-service.ts:655-790` writes lines and pieces **by position** (`order_item_srno = <order>-<index+1>`, piece k of line `index`); no product matching | verified, no change |
| A2 | Server Edit | `commercial-edit.loader.ts:289` de-duplicates product ids for lookup only; change targets are item/piece ids | verified, no change |
| A3 | Request limits | `items` array has `.min(1)` and no max (`new-order-payment-schemas.ts:460`), so more lines can't hit a cap | verified, no change |
| A4 | Payment modal draft money view | `map-draft-to-source-set.ts` is order-level (payment legs), no product keys | verified, no change |
| A5 | Barcode "Scan" in the New Order header | scans pieces/orders, does not add products | no add path to wire |
| A6 | **Edit unsaved-changes check** | `order-edit-dirty.ts:122-130` matches lines by product → two lines collapse | §6.2, P1 |
| A7 | **React keys** | 4 lists keyed by `productId` → duplicate keys | §6.2, P1 |
| A8 | Edit policy for measured merge | policy is per change type, not per line | §4.1 wording fixed |
| A9 | **P4 catalog** | change codes live in `sys_oc_order_edit_ops_cd` + `sys_oc_order_edit_op_tgt_cd`; HQ reads them dynamically; missing rule denies | §9.1 |
| A10 | **P4 tags** | labels print line no. and piece no.; a moved saved piece's tag goes stale | §9.1 |
| A11 | Existing tests that assume one line per product | `new-order-reducer.test.ts`, `characterization/create-money/new-order-cart.golden.test.tsx`, `order-edit-dirty.test.ts`, `order-change/edit-order-workspace.test.tsx`, `order-item-helpers.test.ts` | updated in P1/P2, never deleted to pass |
| A12 | Leaving a priced line | moving a piece out of a line with an override or discount changes that piece's price | §13.1 |
| A13 | Line order | where a new line appears was undefined | §13.1 |
| A14 | Accessibility + feedback | menus, the choice step and moves had no a11y/feedback spec | §13.1 |
| A15 | Create write path | create inserts rows one by one (`order-service.ts:655-880`), about 3L + 5P round trips | owner request: **PF gate**, §9.2 (measure, change only if it misses the target) |

### 13.2 Review from the measured-units session (2026-11-25)

| # | Finding | Verified | Fixed in |
|---|---|---|---|
| B1 | a measured merge could not be undone (§5.3 forbade moves on measured lines) | yes | §4.3 exact one-share split |
| B2 | the free-garment gap is also in step 2 `+`/`−`, "Add piece", the pieces manager, and Edit quantity changes | yes: `order-details-section.tsx:159, 363-379, 557`, `pre-submission-pieces-manager.tsx:80`; the cart itself only displays quantity | §4.2 re-measure on every piece-count change |
| B3 | an Edit merge into a saved line sends 3 changes on one line; only `CHANGE_ITEM_MEASURE` alone was tested | accepted (rules built by that session) | §4.5 DB-integration test + 3 HQ rules |
| B4 | price rule for Edit merges was implied, not stated | yes: saved lines keep agreed price (`commercial-edit.loader.ts:770-795`) | §4.4 |
| B5 | customers can't tell two lines of one product apart | yes: 5 surfaces show name only | §8.1 line qualifier, in P2 |

### 13.1 UX details added by the audit (extends §5)
- **Line order:** "Add" puts a new line at the end (as today). "Move to a new line" inserts the new line **right after** the source line, so lines of one product stay together. The server numbers lines in cart order (A1).
- **Leaving a priced line:** when the source line has a price override or line discount, the menu item carries a short note ("Leaves Line 1's price" / "Leaves Line 1's discount"), so the price change is visible before the click (rule 11).
- **Feedback:** after a move, `cmxMessage.success` ("Moved to line 2" / "نُقلت إلى السطر 2") and focus moves to the moved piece row.
- **Accessibility:** menus are `CmxDropdownMenu` (keyboard, `aria-label` with the product, line and piece number); the measure dialog's choice step moves focus to its first button, `Esc` goes **Back** (not close), and the result line ("Becomes 3 pieces · 7.5 m") is announced with `aria-live="polite"`.
- **RTL:** logical classes only; line labels use `{name} · {lineLabel}` from the message catalog, not string concatenation.

## 14. Implementation requirements (per feature-doc template)

| Item | P1–P3 | P4 | P5 |
|---|---|---|---|
| Permissions | none (price override and discount keep their existing permissions) | none (policy rule, not a permission) | product edit permission (existing) |
| Navigation / routes / pages | none new (changed: New Order, Order Edit, receipt and order prints, tracking page, customer app order detail) | none | product form field |
| API endpoints | P2: additive `qualifier` field on line items in the public tracking API and the public customer orders API (§8.1); no new routes | none new; existing Order Edit change/preview/apply routes accept `MOVE_PIECE` | product save route field |
| Feature flag | none (pre-launch; rollout flags add little, see memory) | none | none |
| Tenant / HQ settings | none | HQ Edit policy rule for `MOVE_PIECE` (data, not code) | none |
| Plan limits | none | none | none |
| Migrations | none | 1 (catalog rows) | 1 (typed column) |
| i18n | §5.4 + §4.1–§4.4 + §8.1 + §13.1 keys, EN + AR (web) and mobile l10n EN + AR (customer app qualifier) | change-history label, review text | field label |
| Env vars / infra | none | none | none |

## 15. Test plan

| Level | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| Unit (pure) | `ensureLineKeys` | `resolveCartAddTarget` table; `findMatchingMeasuredLines` table (§4.1); exact share (§4.3: 7.5/3 ✅, 7/3 ❌, decimals); `orderLineQualifiers` (§8.1: ordinal only when other parts are identical) | move rules: same product only, measured/custom refused, empty line removed, `pieceSeq` renumbered, piece fields carried, line fields not carried | change-builder emits `MOVE_PIECE` |
| Reducer | **every action with two lines of the same product**: only the targeted line changes | `ADD_ITEM` with targets; `MERGE_MEASURED` (qty + 1, measure sum, exact decimals) | `MOVE_PIECE` to new / to existing | — |
| Component | cart, steps 2–4, grid badge with duplicate products | measure dialog choice step, card `+`/`−` | move menus, notes, focus | review dialog |
| Edit adapter | projection + apply with two saved lines of one product | measured merge into a saved line = quantity + measure + added piece | local piece moves | `MOVE_PIECE` vs remove + add |
| Server / DB integration | create + quote with two lines of one product at **ITEM** and **PIECE** level, different overrides priced separately; `order-change-edit-parity.db.test.ts` with two saved lines | §4.5 three-change merge on a saved measured line (ITEM + PIECE, policy deny); public projection allowlist test for the qualifier | — | §9.1 tests |
| Gates | build, eslint, i18n, `check:ui`, `/cmx-ui-design-review` | same | same | same + migration reviewed and applied by owner |
| PF (closing gate) | baseline for 3 order shapes → compare to target → if missed, batch writes + parity DB test + re-measure (§9.2) | | | |
