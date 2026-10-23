# Line-Level Money Snapshot — Pre-Plan Discussion

**Status:** CLOSED into [PLAN.md](PLAN.md) on 2026-10-23. Round 2 answers and notes a/b are recorded there as L9–L15. This file is kept as decision history; the plan wins on conflict.
**Date:** 2026-10-23
**Related:** [Reusable_Order_Fin_View/PLAN.md](../Reusable_Order_Fin_View/PLAN.md), Phase 1B (one shared commercial calculator, D25)

## 1. Goal

Save at creation, on the row where it applies, every commercial fact that was decided at creation: speed, price source, preference price mode, discount share, tax mode, tax category, and tax amount. Save it on items **and** pieces so money can later move to piece level. Create, Edit and every later flow go through one shared calculator, so all of them produce the same values.

## 2. Owner decisions (round 1, 2026-10-23)

| # | Decision |
|---|---|
| L1 | Speed is stored per item **and** per piece. The UI stays order-wide at first. The speed extra cost is pre-configured by tenant, branch, service category and product, in any combination (to be built). |
| L2 | The express premium is **included in the item price**, never a separate charge. |
| L3 | Preference price modes are agreed. The mode is configured at **tenant level**, not chosen by the cashier. |
| L4 | A preference extra is charged **once per line** now. The basis will be configurable later. |
| L5 | Discounts are allocated to lines when tax is calculated per line. |
| L6 | Tax rounding (per line or per document) is **pre-configured on tax profiles**. |
| L7 | No mixed inclusive/exclusive modes in one order. The mode is already a tenant/branch setting. |
| L8 | This work follows the pre-configured settings above and becomes the data contract of P1B. |
| N1 | Pieces get the same money columns as items (tax, discount, …), ready for money to move to pieces. |
| N2 | The work starts from Create Order. Create, Edit and the rest use the same calculation service. |
| N3 | A new tenant setting selects the **commercial level**: ITEM (current) or PIECE. At PIECE level the piece holds all the money and the item only groups pieces. |

## 3. What exists today (remote DB and code, 2026-10-23)

| Area | Fact | Consequence |
|---|---|---|
| Speed | `service_speed` exists only on `org_orders_mst` (`EXPRESS` or null). There is no speed code table. The express premium comes from `org_product_data_mst.default_express_sell_price` / `multiplier_express`; all 7 price lists are `standard`. | The one EXPRESS order has `express_charge_amount = 0`, so the premium is hidden in `price_per_unit`. |
| Express charge path | The header rollup also sums `EXPRESS` charge rows. | A second path for the same premium. L2 means it must be blocked. |
| **Extra-price mode setting: dead** | `org_tenants_mst.extra_price_pricing_mode` and the `org_branches_mst` override exist, with tenant/branch settings UI and `resolveExtraPricePricingMode()`. **Nothing in the calculation calls the resolver.** | The setting does nothing. The real behaviour is the hard-coded level rule in `lib/utils/order-charge-money.ts` (ITEM/PIECE extras inside the line, ORDER extras as charges). |
| Tax pricing mode | `resolveTaxPricingMode()`: branch, then tenant, then `TAX_EXCLUSIVE`; inclusive only with the `tax_inclusive_pricing` flag. Used by the calculation and the rollup. | This is the pattern the commercial-level setting should follow. |
| Item money | `price_per_unit`, `total_price`, `price_override`, `override_reason`, `service_pref_charge`. | No list price, price source, discount share, tax, or gross. |
| Piece money | `price_per_unit`, `total_price`, `service_pref_charge`; `quantity` is always 1. | Partial. |
| Preferences | `extra_price` only. All 4 live rows are PIECE level. | Extras are already priced per piece today. |
| Product price types | `PER_PC` 110, `per_piece` 3 (case drift), `FIXED` 8, null 6. | A FIXED price cannot be priced per piece. It can only be allocated across pieces. |
| Tax | Calculated per order (`org_order_taxes_dtl`). The header exempt/zero-rated/out-of-scope buckets are hard-coded to 0. `org_tax_profiles_cf` has no rounding setting. `is_tax_exempt` on product is an integer. | |
| Charges | `org_order_charges_dtl` has no tax columns. | |

## 4. Core design: one money shape, two levels, one authoritative row

### 4.1 The same line-money columns on items and pieces

Items and pieces carry an **identical** set of money columns, so the calculator returns one `LineMoney` type that maps 1:1 to either table.

### 4.2 `money_basis` says which row is authoritative

Each item and piece row stores `money_basis`:

| Order commercial level | Item row | Piece rows |
|---|---|---|
| ITEM | `PRICED` (priced here) | `ALLOCATED` (exact split of the item) |
| PIECE | `ROLLUP` (exact sum of pieces) | `PRICED` (priced here) |

**Both levels are always filled.** Readers never need to know the level:
- totals, reports and the header read **items**
- piece-level refund, rejection and the piece view read **pieces**

There is no runtime allocation at refund time, because the split was stored once by the same calculator under the same rules.

### 4.3 Exact-sum invariant

- ALLOCATED: Σ pieces = item, exactly, for every money column. The calculator uses one largest-remainder allocation at the currency's minor unit (tenant decimals), with ties broken by `piece_seq`.
- ROLLUP: item = Σ pieces, exactly.
- Header = Σ item `line_total_amount` + Σ separate charges, including their tax.
- Enforced by the calculator, checked by the reconciliation rules (BF-14), and covered by DB-integration tests. No sum triggers.

### 4.4 Commercial level is a snapshot on the order

- New tenant setting `commercial_level` (`ITEM` | `PIECE`, default `ITEM`). It follows the `tax_pricing_mode` pattern (a column on `org_tenants_mst` plus the tenant settings screen) and has **no branch override**.
- Create copies it to `org_orders_mst.commercial_level`. Edit, refund and recalculation use the order's stored level and never the current setting. Changing the setting affects new orders only (CRITICAL RULE #15: no silent money mutation of existing orders).

### 4.5 The effective level can fall back per line

Under PIECE level, a line whose product cannot be priced per piece (for example `FIXED` price types, or future per-kg prices) stays `PRICED` at item level, and its pieces are `ALLOCATED`. `money_basis` records this per row, so one order can mix without ambiguity.

### 4.6 Speed: item default, piece override

- `service_speed` on the item is the line default; the piece copies it.
- At PIECE level a piece may override it (UI later).
- The ready-by of an item is the latest ready-by of its pieces.

## 5. Speed pricing configuration (L1, L2)

- **`sys_service_speed_cd`** — speed codes (`STANDARD`, `EXPRESS`, extensible) with bilingual names. Existing `EXPRESS` values stay as they are.
- **`org_speed_price_rules_cf`** — premium rules:
  - `service_speed`, with optional `branch_id`, `service_category_code`, `product_id`
  - `premium_type`: `FIXED_AMOUNT` or `PERCENT` of the standard price
  - `premium_value`, `price_basis` (`PER_UNIT` / `PER_LINE`)
  - `effective_from` / `effective_to`, `is_active`
- **Resolution:** the most specific active rule wins. The ranking is product > service category, then branch-specific > tenant-wide. A unique index (`NULLS NOT DISTINCT`) on the dimensions makes ties impossible. No matching rule means no premium.
- **Price:** unit price = standard price + premium (L2, inside the price). `speed_premium_amount` on the line explains how much of the price is the premium.
- **Single source:** the product fields `default_express_sell_price` and `multiplier_express` become product-level rules (data moved; pre-launch, so no compatibility code). The `EXPRESS` charge-row path is blocked.

## 6. Line-money column set (items and pieces, identical)

Money is `DECIMAL(19,4)`; strings are `TEXT`.

| Column | Meaning |
|---|---|
| `money_basis` | `PRICED` / `ALLOCATED` / `ROLLUP` (§4.2) |
| `service_speed` | Speed of this row |
| `price_source` | `PRICE_LIST` / `PRODUCT_DEFAULT` / `CUSTOMER_PRICE` / `MANUAL` |
| `price_list_id` | Price list used, if any |
| `list_unit_price` | Standard catalog price before speed, override or discount |
| `speed_premium_amount` | Premium inside the price |
| `price_per_unit` *(exists)* | Effective unit price |
| `service_pref_charge` *(exists)* | Preference extras added to this row (mode `INCLUDED_IN_ITEM_PRICE`) |
| `total_price` *(exists, meaning fixed)* | Gross before discount and tax |
| `discount_amount` | Allocated discount share |
| `net_amount` | `total_price − discount_amount` |
| `tax_pricing_mode` | `TAX_INCLUSIVE` / `TAX_EXCLUSIVE` (same for every line of an order, L7) |
| `tax_category_code` | `STANDARD` / `ZERO_RATED` / `EXEMPT` / `OUT_OF_SCOPE` |
| `tax_exempt_reason` | Reason code when not `STANDARD` |
| `tax_rate` | Combined rate applied |
| `taxable_amount` | Tax base |
| `tax_amount` | Tax |
| `line_total_amount` | Payable for the row, including tax |

**Header:** `org_orders_mst.commercial_level`. The header exempt/zero-rated/out-of-scope buckets become real sums of the lines by category.

**Known limit:** the line stores one combined tax. A per-tax-type breakdown per line (more than one tax type at once) would need a child table later. GCC VAT needs only one.

## 7. Preferences, charges, tax profiles

- **Preference mode (L3):** reuse the existing tenant/branch setting and its exact codes, `INCLUDED_IN_ITEM_PRICE` / `SEPARATE_CHARGE` (CRITICAL RULE #12). Wire the dead resolver into the calculator and replace the hard-coded level rule.
  - The catalog flag `is_included_in_base` stays a per-preference property: "no extra, already in the base price", so the extra is 0.
  - ORDER-level preferences are always `SEPARATE_CHARGE`.
- **`org_order_preferences_dtl` gains:** `extra_price_pricing_mode` (snapshot), `price_basis` (only `PER_LINE` used now, L4; "line" means the priced row at the effective level, so one per piece at PIECE level), `list_extra_price`, `is_price_override`, `bundle_code`, `bundle_discount_amt`, `extra_turnaround_min`.
- **`org_order_charges_dtl` gains:** `tax_category_code`, `tax_rate`, `taxable_amount`, `tax_amount`. SEPARATE_CHARGE preferences become taxable charges.
- **`org_tax_profiles_cf` gains:** `rounding_level` (`LINE` / `DOCUMENT`, L6). With DOCUMENT, tax is calculated on the total and then allocated to lines, so line values still sum to the header.
- **Discount allocation (L5):** always allocate, proportional to the gross amount of each row. This is cheap and gives exact piece refunds, even when a profile rounds per document.
- **Product:** `tax_category_code` replaces the integer `is_tax_exempt`.

## 8. Order of work (N2)

1. **P0 discovery:**
   - map every current money calculator (`order-calculation.service`, `pricing.service`, `pricing-calculator`, Order Edit preview and apply, the financial-write rollup)
   - check whether `total_price` already includes `service_pref_charge` today
   - list every reader of the old fields
2. **Characterization tests on Create** before changing anything (as P1B already requires).
3. **Config:** speed code table, speed rules, `commercial_level` setting, tax-profile rounding, product tax category.
4. **Line-money columns** on items, pieces, preferences, charges and header. One migration per concern; stop and wait after each.
5. **Shared calculator:** returns `LineMoney` for items and pieces, with the allocation function. It is the only writer.
6. **Create** writes through it, then **Order Edit V2** apply and preview, then refund/cancel/collection readers.
7. **Rollup** reads lines. Retire the hard-coded level rule and the `EXPRESS` charge path.
8. **Recompute demo orders** (pre-launch).
9. **PIECE level:** calculator support and tests are built with step 5. The `PIECE` option stays hidden in settings until a piece-pricing UI exists, so it is never a dead option.

## 9. Open decisions (round 2)

1. Should the speed premium be `FIXED_AMOUNT` only, as you said, or also `PERCENT`? I recommend both.
2. Should the product-level express price fields move into the speed rules table and be retired? I recommend yes: one source.
3. Should `commercial_level` have no branch override? I recommend tenant-only.
4. Should PIECE level be plan-gated by a feature flag, or free for all tenants?
5. Should Order Edit be allowed to change an order's commercial level? I recommend never: the level is fixed at creation.
6. Should this be a new package inside the Reusable Order Fin View plan (P1B data contract), or a separate plan in this folder that P1B depends on?

## 10. Risks

- Columns added without the single calculator would leave Create and Edit writing different values. Steps 5 and 6 must land together.
- The dead `extra_price_pricing_mode` setting may already be set by demo tenants to `SEPARATE_CHARGE`; wiring it in changes their new orders' presentation. Check the values in P0.
- `price_type` case drift (`per_piece` vs `PER_PC`) breaks the effective-level fallback; fix the data in P0.
- More piece columns means more writes per edit: small, because orders have tens of pieces.
