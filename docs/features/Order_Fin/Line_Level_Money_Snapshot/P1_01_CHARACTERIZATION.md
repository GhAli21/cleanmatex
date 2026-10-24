# P1-01 — Characterization of today's Create money

**Plan:** [PLAN.md](PLAN.md) P1-01 (= Reusable Order Fin View P1B-01) · **Status:** [STATUS.md](STATUS.md)
**Date:** 2026-10-23 · **Owner sign-off:** ✅ 2026-10-23 (delegated: "decide and do your recommendations"), see §4.4

## 1. Purpose

These tests freeze how Create calculates and stores money **today**, before any calculator or migration work. They run before and after every later step (PLAN §12 "Proof"). A changed figure fails a test, and it may only change through §4 below:

- a signed-off bug fix, or
- a float→decimal difference.

All fixtures are synthetic (PLAN §21 C13). Every expectation is an exact value. None uses `toBeCloseTo`.

## 2. Test files

All in `web-admin/__tests__/characterization/create-money/`:

| File | Pins | Cases |
|---|---|---|
| `create-totals.golden.test.ts` | `calculateOrderTotals` with the **real** tax engine: lines, override, FIXED product, discounts (manual, rule, promo, auto-promo, stacking), tax profiles (exclusive, inclusive, compound, selected ids, VAT fallback, exemptions), charges, cash rounding, gift card, OMR and SAR | G01–G34 (28) |
| `create-pricing.golden.test.ts` | `PricingService.getPriceForOrderItem`: price list, express with and without an express price, price list under express, B2B/VIP lists, list discount, rounding, missing product | P01–P10 (10) |
| `create-line-write.golden.test.ts` | Rows written by `createOrderInTransaction`: header, item lines, pieces, ITEM/PIECE/ORDER preference rows, PREFERENCE charges, override audit, tenant id on every row | W01–W08 (8) |
| `new-order-cart.golden.test.tsx` | New Order cart money (stored by Create, PF-02): line formula, express reprice, override clear, piece preferences | C01–C06 (6) |
| `float-decimal-diff.golden.test.ts` | Float→decimal difference scan (snapshot) | FD-T1–T3 (3) |

**Run:** `cd web-admin && npx jest __tests__/characterization` (55 tests).

## 3. What today's Create does (pinned)

- **Line price:**
  - Create charges `basePrice` from SQL `get_product_price`, which already includes the price-list discount (G05, P08).
  - Express selects the `express` list. Without one, it uses the product express price; without that, the normal price. `multiplier_express` is never read (P02–P05).
  - A B2B/VIP customer replaces the express list with their own list (P06, PF-08).
- **Stored line prices are the cart's values,** not the server's (W01, PF-02). The cart:
  - computes qty × unit + line preferences + packing (C01)
  - reprices to the express price on the express toggle (C02)
- **FIXED products:** `price_type = 'FIXED'` and `min_sell_price` are never read, so a FIXED product is charged unit × quantity (G04).
- **Discount order:**
  1. manual (percent wins over amount)
  2. automatic rule (on the after-manual base)
  3. promo code or auto-promo (on the after-rule base)

  A non-stackable rule competes with the promo on the after-manual base, and the larger one wins; the losing typed promo is dropped silently (G10–G17).
- **Tax:** order-level, on the after-discount base, by default profiles or selected ids (compound profiles last). Inclusive extracts from the gross. With no profile, the tenant VAT rate applies. An exemption carries no tax and gets no fallback (G20–G27).
- **Order charges** (ORDER preferences) are added after tax: not discounted and not taxed (G30, G31; PF-19). A free ORDER preference gets a row but no charge (W06).
- **Cash rounding** applies to the grand total; the gift card is settlement only (G32–G34).
- **Pieces:**
  - piece price = item total ÷ quantity, so item extras are spread over the pieces (W03)
  - a piece's `service_pref_charge` holds only its own preferences and packing (W05)

## 4. Owner sign-off list

### 4.1 Known defects (pinned on purpose; each fix updates its case)

| ID | Case | Defect | Planned fix |
|---|---|---|---|
| PF-02 | W01 | Stored item prices come from the browser and can differ from the server totals. | P5 (server is the price authority) |
| PF-03 | P08 | Edit uses `finalPrice`, which applies the list discount a second time. | P4-01 |
| PF-05 | G27 | One exempt service category exempts the whole order. | P4-04 (per line) |
| PF-08 | P06 | B2B/VIP express loses the express price. | P4-02 (speed premium independent of the list) |
| PF-12 | C04, C05 | **Confirmed.** Item-preference and piece-preference changes overwrite each other's charge. The overwritten preference rows stay on the order but are not charged. | P4-05 / P5 (one allocation rule) |
| PF-19 | G30 | Order charges are untaxed (the code comment says otherwise). | ADR-060 §6, M6 |
| PF-21 (new) | C03, C03b | Clearing a price override in the cart kept the overridden price, and the express toggle overwrote a typed override; in both cases submit failed with `AMOUNT_MISMATCH`. | ✅ **Fixed 2026-10-23** (hotfix in `new-order-reducer.ts`) |
| PF-22 (new) | G04 | `price_type = 'FIXED'` (8 products) and `min_sell_price` are stored but never applied. | Decided per L23: FIXED keeps unit × quantity (G04 stays); minimum price enforced in P4-02 |
| PF-24 (new) | — | 4 FIXED products have a default price below their own minimum (for example a tuxedo at 9.500 with a minimum of 80.000), so they could not be sold once the minimum is enforced. | Data cleanup by the owner in the catalog, plus P7 validation `min ≤ default` |
| G07 | G07 | No items with ORDER charges returns 0 and drops the charges. | P4 calculator |
| G15 | G15 | A typed promo that loses to a non-stackable rule is dropped without a message. | P5 disclosure (rule #15) |

Each defect is explained in detail in §5.

### 4.2 Float→decimal differences (the Phase 4 calculator corrects them)

| ID | Where | Today | Decimal | Size |
|---|---|---|---|---|
| FD-01 | Price rounding, 3.3335 OMR (P09) | 3.333 | 3.334 | 1 minor unit |
| FD-02 | Piece split 10 ÷ 3 (W03) | 3 × 3.3333 = 9.9999 stored, item 10.000 | Largest remainder: 3.3334 + 3.3333 + 3.3333 = 10.0000 | 0.0001 per line; breaks I-invariant piece Σ = item |
| FD-03 | Line charge 0.4 + 0.8 (W05) | 1.2000000000000002 sent | 1.2 | None after `numeric(19,4)` storage |
| FD-T1 | Rate × base, OMR grid of 120,000 | 2,223 differ | | Always 1 minor unit; today rounds a true half down |
| FD-T2 | Rate × base, SAR grid of 120,000 | 2,099 differ | | Always 1 minor unit; same direction |
| FD-T3 | Piece price rounding to 4 dp, grid of 60,000 | 0 differ | | The FD-02 problem is the remainder, not the rounding |
| FD-04 (live) | Remote order `ORD-20261023-0003` (`7620f179-…`), SAR, VAT 15% on 30.300 | VAT 4.54, total 34.84 | VAT 4.55, total 34.85 | 1 minor unit; the float product is 4.54499…, so the true half 4.545 rounds down |

The same order also confirms the step 2b PF-01 fix: `price_override` 30.3000, `override_reason` and `override_by` (the user's `org_users_mst.id`) are all written.

### 4.3 Data-model fact found

`org_order_items_dtl.price_per_unit` and `total_price` are `numeric(10,3)`, while piece prices and all charges are `numeric(19,4)`. The line-money migration (P3, M5) widens them to `DECIMAL(19,4)`, the project money standard.

### 4.4 Sign-off

| Item | Decision | By | Date |
|---|---|---|---|
| Fix the §4.1 defects as planned (Q2 already accepted for PF-03/04/08) | Accepted. PF-21 fixed now (hotfix); the others land in P4/P5/M6 per §5 | Owner (delegated) | 2026-10-23 |
| Accept the §4.2 one-minor-unit corrections | Accepted. Rounding rules per PLAN **L22** (exact decimals, round once at the end, coin step only on cash) | Owner (delegated) | 2026-10-23 |
| FIXED price type meaning (PF-22) | Per PLAN **L23**: FIXED = fixed price per unit (unit × quantity stays; G04 unchanged). `min_sell_price` = floor on the net unit price, rejected below it, except by an audited override | Owner (delegated) | 2026-10-23 |

## 5. Defect details and planned fixes

Each entry gives: what happens today, a worked example, the impact, the planned fix, and the golden case that changes when the fix lands.

### PF-02 — Stored item prices come from the browser
- **Today:**
  - The submit payload carries `pricePerUnit` / `totalPrice` per line, and Create writes them as they are.
  - The server recomputes and checks only the **order-level** totals (subtotal, discounts, VAT, sale total). The lines themselves are never checked.
  - The financial snapshot later sums the item `total_price` rows to get the subtotal (`order-financial-write.service.ts`).
- **Example:**
  - A price list gives shirts 10% off. The server prices 9.000, but the cart line still shows the product default 10.000.
  - The order totals sent with submit come from the server, so the totals check passes.
  - The order stores header subtotal 9.000 and the item line 10.000. A later snapshot rebuild then reads 10.000.
  - The same gap lets a direct API call store any line price.
- **Impact:** line prices, receipts, refunds per line and the rebuilt header can disagree with what the customer was charged.
- **Fix (P5, ADR-060 §2):**
  - The client sends intents only: product, quantity, speed, preferences, override with a reason, and `confirmedUnitPrice`.
  - The server resolves every line price with the shared calculator and writes it.
  - If the price the cashier saw changed, the server rejects with `PRICE_CHANGED` and the per-line list (the cashier confirms, no silent change).
- **Golden:** W01 changes to expect the server price on the line.

### PF-03 — Price-list discount applied twice in Order Edit
- **Today:**
  - SQL `get_product_price` already returns `price × (1 − discount_percent/100)`.
  - `PricingService` then computes `finalPrice = basePrice × (1 − discount_percent/100)` again.
  - Create uses `basePrice` (discounted once). Edit uses `finalPrice` (discounted twice).
  - The TypeScript lookup of the list row also ignores effective dates and priority, so it can pick a different row than the SQL function.
- **Example:** list price 10.000 with a 10% list discount. Create charges 9.000. Edit re-prices the same line at 8.100.
- **Impact:** editing an order silently lowers the price, and Create and Edit disagree.
- **Fix (P4-01, ADR-060 §5):**
  - One price resolver for Create and Edit returns the **list price and the discount separately**, using the same effective-date and priority rules.
  - The discount becomes a line discount row with source `PRICE_LIST`, applied exactly once, so it is also visible on the order.
- **Golden:** P08 changes (`finalPrice` disappears from the money path). The Create total stays 9.000, shown as 10.000 − 1.000.

### PF-05 — One exempt service category exempts the whole order
- **Today:** the exemption check asks "is **any** of the order's service categories exempt?". If yes, the whole order gets no tax.
- **Example:** an order with ironing (taxable, 20.000) and an exempt service (10.000) is charged VAT 0. The correct VAT is 5% on 20.000 = 1.000.
- **Impact:** VAT is under-collected, and the tax declaration is wrong for mixed orders.
- **Fix (P4-04, ADR-060 §6):**
  - Tax is calculated **per line**:
    - A customer exemption makes every line `EXEMPT`, with reason `CUSTOMER_EXEMPTION`.
    - A service-type exemption applies only to the lines of that service.
    - Each line records a tax category (S/Z/E/O, needed for ZATCA and Oman e-invoicing) and a reason code.
  - The order tax is the sum of the line taxes.
- **Golden:** G27 changes to VAT 1.000 on the taxable line only.

### PF-08 — B2B and VIP customers lose the express price
- **Today:** the list type is chosen as `express` or `standard`, and then a B2B or VIP customer **replaces** it with `b2b` / `vip`.
- **Example:** a B2B customer orders express. The order is priced at the B2B normal price, and the express premium is lost.
- **Impact:** lost express revenue on every B2B/VIP express order.
- **Fix (P4-02, ADR-060 §5):**
  - The price is built in two parts:
    - the customer's standard price (B2B/VIP list, else the standard list, else the product default)
    - **plus** the speed premium from the new speed rules (`SELL_PRICE` / `MULTIPLIER` / `FIXED_AMOUNT`)
  - The premium does not depend on the customer list. There is one speed signal, `service_speed`.
- **Golden:** P06 changes to the B2B price plus the speed premium.

### PF-12 — Item and piece preference charges overwrite each other
- **Today:**
  - A line has one charge field, `servicePrefCharge`, and two screens write it:
    - Item preference panels set it to the sum of the **item** preferences.
    - Piece preference chips set it to the sum of the **piece** preferences.
  - Whichever runs last wins.
  - The server trusts this client number for the totals and the item `service_pref_charge`.
  - The preference rows themselves are saved with their prices, so the order shows a preference that was not charged.
- **Example:**
  - Starch 0.300 is added on the item, then Perfume 0.250 on piece 1.
  - The line charge becomes 0.250 instead of 0.550, so Starch is free.
  - Doing it in the other order makes Perfume free.
- **Impact:** lost preference revenue, and the preference rows do not match the money.
- **Fix (P4-05 and P5):**
  - The server computes the line's preference money from **all** selected preferences (item + piece + packing) and the catalog prices, following the tenant's extra-price mode (included in the item price, or a separate charge).
  - The pieces receive their share through one allocation rule (largest remainder).
  - The client charge field is no longer trusted. The cart shows the server quote.
- **Golden:** C04 and C05 change to 0.550.

### PF-19 — Order-level charges are never taxed
- **Today:**
  - ORDER-level preference charges are added **after** tax: not discounted and not taxed.
  - The code comment says they "participate in the tax base", which is not what the code does.
- **Example:** a VAT 5% order of 10.000 with a 1.000 order-level charge totals 11.500 today. If the charge is a taxable supply, the correct total is 11.550.
- **Impact:** in Oman and KSA, a charge for the same service is normally part of the taxable value, so VAT is under-collected.
- **Fix (ADR-060 §6, migration M6):**
  - Each charge gets its own tax category and profile, taxed like a line.
  - Until a charge has an explicit category, today's treatment is kept (seeded per L17), so nothing changes silently. Configuring a category is a deliberate tenant step.
- **Golden:** G30 and G31 stay as they are until a category is set; new cases cover a taxable charge.

### PF-21 (new) — Clearing a price override keeps the overridden price
- **Today:**
  - Setting an override writes the override into the cart line's `pricePerUnit`.
  - Clearing it sets `pricePerUnit` back to `item.pricePerUnit`, which is already the overridden value.
- **Example:**
  - The catalog price is 1.500. Override to 1.000, then remove the override: the cart still shows 1.000.
  - The server prices 1.500, so submit fails with "totals mismatch". The cashier must remove and re-add the item.
- **Impact:** blocked checkout and confusion. It is not a silent loss, because the server check catches it.
- **Fix (P5 cart):**
  - Clearing restores the catalog price for the current speed (express price or normal price).
  - Once the quote route is in place, the cart shows server prices anyway.
  - This is a small, isolated reducer change and can be shipped early as a hotfix if the owner wants.
- **Golden:** C03 changes to expect 1.500.
- **✅ Fixed 2026-10-23:**
  - The cart remembers the price under an override (`pricePerUnitBeforeOverride`, cart only, never submitted) and restores it on clear.
  - The same fix stops the express toggle from overwriting a typed override; only the price under the override follows the speed (rule #15).
  - Goldens C03 and C03b.

### PF-22 (new) — The FIXED price type and the minimum price are not applied
- **Today:**
  - `org_product_data_mst.price_type` = `FIXED` (8 products) and `min_sell_price` are stored and editable in the catalog.
  - No pricing code reads either field.
  - A FIXED product is charged unit price × quantity, and an override can go below the minimum price.
- **Impact:** depends on what FIXED means. **The owner must decide**:
  - (a) **Flat per line:** one price whatever the quantity (for example, a bag or a service fee).
  - (b) **Locked price:** no price-list discount and no override.
  - (c) Something else.

  Separately: should `min_sell_price` block overrides and discounts below it (allowed with `pricing:override`, or never)?
- **Decision (L23, 2026-10-23):**
  - The FIXED products are suits, tuxedos, sarees and wetsuits, priced per set. So FIXED = fixed price per unit, and unit × quantity stays.
  - `min_sell_price` is a floor on the net unit price, rejected with `PRICE_BELOW_MINIMUM`. Only an audited override may go below it.
- **Fix (P4-02):** the minimum price becomes a validation with a clear bilingual message, never a silent price change (rule #15). The catalog gets `min ≤ default` validation (P7). PF-24 lists the 4 rows to clean.
- **Golden:** G04 stays unchanged; new cases cover the minimum.

### G07 — An order with no items drops order-level charges
- **Today:**
  - With no item lines, the calculator returns all zeros and ignores the order charges.
  - Create also writes ORDER-level preferences and their charges only inside the "has items" branch.
- **Example:** a quick-drop order (items counted later) with an order-level "Express bag 1.000" preference saves neither the preference nor the charge.
- **Impact:** the preference choice and its charge are lost without notice.
- **Fix (P4 calculator and P5 Create):**
  - Charges are calculated independently of lines.
  - ORDER preferences and charges are written whether or not item lines exist.
- **Golden:** G07 changes to charge 1.000.

### G15 — A typed promo code can be dropped without a message
- **Today:**
  - An automatic rule that may not stack with promos competes with the typed promo code, and the larger discount wins.
  - If the rule wins, the promo is dropped with no message. The cashier saw "promo valid" when entering it, but the total does not include it.
- **Example:** an automatic rule gives 1.000 off and the typed promo gives 0.500. The order gets 1.000, and the promo silently disappears.
- **Impact:** the customer is never charged more (the better discount wins), but the cashier and customer get no explanation.
- **Fix (P5, quote disclosure, rule #15):** the quote returns the discount decisions. The payment screen shows, in EN/AR: "Promo SAVE5 not applied: the automatic discount 'Ten off' gives a larger discount."
- **Golden:** G15 money unchanged; a new assertion checks the disclosure.

### Order of delivery

| When | Defects |
|---|---|
| ✅ Shipped as a hotfix 2026-10-23 | PF-21 |
| P4 (calculator) | PF-03, PF-05, PF-08, PF-22, G07 |
| P5 (Create on the calculator, Release A) | PF-02, PF-12, G15 |
| M6 + charge configuration | PF-19 |

Every fix flips its golden case in the same change and is logged in STATUS.
