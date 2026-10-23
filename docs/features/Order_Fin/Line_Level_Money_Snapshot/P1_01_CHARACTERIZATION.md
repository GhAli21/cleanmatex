# P1-01 — Characterization of today's Create money

**Plan:** [PLAN.md](PLAN.md) P1-01 (= Reusable Order Fin View P1B-01) · **Status:** [STATUS.md](STATUS.md)
**Date:** 2026-10-23 · **Owner sign-off:** pending (§4)

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
| PF-21 (new) | C03 | Clearing a price override in the cart keeps the overridden price; submit then fails with `AMOUNT_MISMATCH`. | P5 cart fix (restore the catalog price) |
| PF-22 (new) | G04 | `price_type = 'FIXED'` (8 products) and `min_sell_price` are stored but never applied. | P4-02 (owner to confirm FIXED semantics) |
| G07 | G07 | No items with ORDER charges returns 0 and drops the charges. | P4 calculator |
| G15 | G15 | A typed promo that loses to a non-stackable rule is dropped without a message. | P5 disclosure (rule #15) |

### 4.2 Float→decimal differences (the Phase 4 calculator corrects them)

| ID | Where | Today | Decimal | Size |
|---|---|---|---|---|
| FD-01 | Price rounding, 3.3335 OMR (P09) | 3.333 | 3.334 | 1 minor unit |
| FD-02 | Piece split 10 ÷ 3 (W03) | 3 × 3.3333 = 9.9999 stored, item 10.000 | Largest remainder: 3.3334 + 3.3333 + 3.3333 = 10.0000 | 0.0001 per line; breaks I-invariant piece Σ = item |
| FD-03 | Line charge 0.4 + 0.8 (W05) | 1.2000000000000002 sent | 1.2 | None after `numeric(19,4)` storage |
| FD-T1 | Rate × base, OMR grid of 120,000 | 2,223 differ | | Always 1 minor unit; today rounds a true half down |
| FD-T2 | Rate × base, SAR grid of 120,000 | 2,099 differ | | Always 1 minor unit; same direction |
| FD-T3 | Piece price rounding to 4 dp, grid of 60,000 | 0 differ | | The FD-02 problem is the remainder, not the rounding |

### 4.3 Data-model fact found

`org_order_items_dtl.price_per_unit` and `total_price` are `numeric(10,3)`, while piece prices and all charges are `numeric(19,4)`. The line-money migration (P3, M5) widens them to `DECIMAL(19,4)`, the project money standard.

### 4.4 Sign-off

| Item | Decision | By | Date |
|---|---|---|---|
| Fix the §4.1 defects as planned (Q2 already accepted for PF-03/04/08) | | | |
| Accept the §4.2 one-minor-unit corrections | | | |
| FIXED price type meaning (PF-22) | | | |
